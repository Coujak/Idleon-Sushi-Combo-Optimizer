import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {optimizeKnowledgeCycle,normalizeKnowledgeCycleOptions} from "../src/knowledge-cycle-optimizer.mjs";
import {simulateMerge} from "../src/optimizer-core.mjs";

function example(){
 const slots=Array(120).fill(-1),tiles=Array(120).fill(-1),fires=Array(15).fill(0);
 for(let i=0;i<15;i++)slots[i]=i===2?3:i===4?2:0;
 tiles[14]=11; // T12 must survive every cycle.
 const upgrades=Array(46).fill(0);
 upgrades[6]=5; // Direct cooking through T6.
 upgrades[13]=1; // Seared Knowledge.
 upgrades[26]=1; // Lithium Firelighter.
 upgrades[29]=1; // Wind.
 upgrades[37]=1; // Searing bonus.
 const track=Array(64).fill(-1);
 for(let i=0;i<12;i++)track[i]=0;
 const xp=Array(64).fill(0),knowledge=Array(64).fill(5);
 return {slots,tiles,fires,sushi:[[],[],upgrades,[],[100,0,0,0],track,xp,knowledge]};
}
const settings={mode:"focused",targetTier:2,fuelGeneration:1e9,fuelCapacity:10000,
 secondsPerCook:2,secondsPerMerge:1.5,secondsPerClear:0.7};

test("Knowledge EXP solver preserves highest tier and creates a genuinely repeatable recipe",()=>{
 const save=example();
 const plan=optimizeKnowledgeCycle(save,settings);
 assert.equal(plan.available,true,plan.reason);
 assert.equal(plan.repeatable,true);
 assert.equal(plan.anchorTier,12);
 assert.deepEqual(plan.protectedIndices,[14]);
 assert.equal(plan.startCookTier>=1,true);
 assert.equal(plan.layout.slots.length,120);
 assert.equal(plan.startingBoard.length,120);
 assert.equal(plan.proposedFires.length,15);
 assert.ok(plan.cooks>=2);
 assert.ok(plan.steps.length>plan.cooks);
 assert.equal(plan.steps[0].kind,"start");
 assert.equal(plan.steps.at(-1).kind,"repeat");
 assert.equal(plan.steps.at(-1).board[14],12);
 assert.ok(plan.steps.at(-1).board.every((tier,i)=>i===14?tier===12:tier===0));
 assert.ok(plan.considered>0);
 assert.ok(plan.totalExpPerCycle>0);
 assert.ok(plan.cycleSeconds>0);
 assert.ok(plan.totalExpPerHour>0);
 assert.ok(Number.isFinite(plan.estimatedFuelGeneration));
 assert.ok(plan.fuelPerCycle>0);
 assert.ok(plan.perTier.some(t=>t.tier===2&&t.etaHours!==null));
 assert.ok(plan.steps.some(step=>step.kind==="merge"));
 const total=plan.steps.reduce((n,step)=>n+step.exp,0);
 assert.ok(Math.abs(total-plan.totalExpPerCycle)<Math.max(1e-8,total*1e-8));
});
test("Lithium's 2x effect is applied automatically and pink setups are evaluated",()=>{
 const save=example();
 const withLithium=optimizeKnowledgeCycle(save,settings);
 assert.equal(withLithium.available,true,withLithium.reason);
 assert.equal(withLithium.pinkMultiplier,2);
 assert.ok(withLithium.proposedFires.some(x=>x===3));
 assert.ok(withLithium.fireChoice.includes("Lithium"));
 const raw=example();raw.sushi[2][26]=0;
 const withoutLithium=optimizeKnowledgeCycle(raw,settings);
 assert.equal(withoutLithium.available,true,withoutLithium.reason);
 assert.equal(withoutLithium.pinkMultiplier,null);
 assert.ok(!withoutLithium.proposedFires.includes(3));
 assert.ok(withLithium.targetExpPerHour>=withoutLithium.targetExpPerHour);
});
test("Balanced rotates actual creation events rather than a static tier list",()=>{
 const plan=optimizeKnowledgeCycle(example(),{...settings,mode:"balanced"});
 assert.equal(plan.available,true,plan.reason);
 assert.equal(plan.mode,"balanced");
 assert.ok(plan.expByTier.filter(x=>x>0).length>=2);
 assert.ok(plan.steps.some(step=>step.kind==="cook"));
 assert.ok(plan.steps.some(step=>step.kind==="clear"));
 assert.ok(plan.steps.every(step=>step.board.length===120));
 assert.ok(plan.totalExpPerHour>0);
});
test("Invalid saves and locked Knowledge creation cannot fabricate EXP/hr",()=>{
 assert.equal(optimizeKnowledgeCycle(null).available,false);
 const save=example();save.sushi[2][13]=0;
 const blocked=optimizeKnowledgeCycle(save,settings);
 assert.equal(blocked.available,false);
 assert.match(blocked.reason,/Seared Knowledge/);
 const normalized=normalizeKnowledgeCycleOptions({mode:"bad",targetTier:100,
  secondsPerCook:-1,lithiumMultiplier:null});
 assert.equal(normalized.mode,"balanced");
 assert.equal(normalized.targetTier,null);
 assert.equal(normalized.secondsPerCook,2);
 assert.equal(normalized.lithiumMultiplier,null);
 const board=[1,1,0,0];
 assert.equal(simulateMerge(board,0,1,0,0).board[1],2);
});
test("Knowledge EXP planner exposes board replay and rate controls without a second Knowledge tab",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../src/knowledge-leveling-ui.mjs",import.meta.url),"utf8");
 const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
 for(const id of ["knowledgePlanMode","knowledgePlanTarget","knowledgePlanRun",
  "knowledgePlanBoard","knowledgePlanFeatured","knowledgePlanRotation",
  "knowledgePlanLevelRows","knowledgePlanPlay","knowledgePlanPrepared",
  "knowledgePlanFuelRate","knowledgePlanFuelCap","knowledgePlanStepXp"]){
  assert.ok(html.includes('id="'+id+'"'),id+" missing");
 }
 assert.match(ui,/new Worker\(new URL\(/);
 assert.match(ui,/search\.postMessage\(\{save,options:calibration\(\)\}\)/);
 assert.match(ui,/stopSearch\(\)/);
 assert.ok(html.includes('id="knowledgePlanCancel"'));
 const worker=readFileSync(new URL("../src/knowledge-cycle-worker.mjs",import.meta.url),"utf8");
 assert.match(worker,/optimizeKnowledgeCycle\(save,options\)/);
 assert.match(ui,/createReplayController\(/);
 assert.match(ui,/pinkMultiplier/);
 assert.match(css,/#knowledgePlanner \.lab-kp-board\{/);
 assert.doesNotMatch(html,/id="knowledgePlanGoal"/);
 assert.doesNotMatch(css,/#knowledgePlanner \.lab-kp-board thead th\{\s*position:sticky/);
});
