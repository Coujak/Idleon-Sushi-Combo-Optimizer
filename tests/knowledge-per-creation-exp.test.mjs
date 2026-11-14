import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {calculateKnowledgeCreationExp}
 from "../src/knowledge-creation-exp.mjs";
import {simulateContinuousKnowledgeRotation}
 from "../src/knowledge-continuous-rotation.mjs";
import {buildKnowledgeActiveExpHistory}
 from "../src/knowledge-active-exp-history.mjs";

const upgradeRows=[
 {id:37,level:10,doubled:true,rawBonus:20},
 {id:38,level:50,doubled:false,rawBonus:50}
];
const knowledgeRows=[
 {tier:2,category:1,bonus:50,discovered:true},
 {tier:7,category:1,bonus:100,discovered:true},
 {tier:13,category:1,bonus:500,discovered:false},
 {tier:41,category:0,bonus:800,discovered:true}
];
test("Uses effective upgrade bonuses including Doubler, Knowledge bonuses, and Lithium",()=>{
 const xp=calculateKnowledgeCreationExp({
  upgradeRows,knowledgeRows,lithiumUnlocked:true
 });
 assert.equal(xp.base,3);
 assert.equal(xp.thirdMultiplier,1.5);
 assert.equal(xp.knowledgeMultiplier,2.5);
 assert.equal(xp.regular,11.25);
 assert.equal(xp.pink,22.5);
 const fires=Array(15).fill(0);fires[3]=3;
 assert.equal(xp.expAt(fires,3),22.5);
 assert.equal(xp.expAt(fires,18),22.5);
 assert.equal(xp.expAt(fires,4),11.25);
});
test("Manual EXP base calibration overrides only the base, not the multipliers",()=>{
 const profile=calculateKnowledgeCreationExp({
  upgradeRows,knowledgeRows,lithiumUnlocked:true,
  options:{expPerCreation:4,lithiumMultiplier:3}
 });
 assert.equal(profile.manuallyCalibrated,true);
 assert.equal(profile.base,4);
 assert.equal(profile.regular,15);
 assert.equal(profile.pink,45);
});
test("Locked Seared Knowledge awards no new-Sushi EXP",()=>{
 const xp=calculateKnowledgeCreationExp({
  upgradeRows,knowledgeRows,lithiumUnlocked:true,searedUnlocked:false
 });
 assert.equal(xp.regular,0);
 assert.equal(xp.pink,0);
});
test("Every new Sushi event retains its own modeled EXP and fireplace column",()=>{
 const slots=Array(120).fill(-1);
 for(let i=0;i<25;i++)slots[i]=0;
 const startingBoard=Array(120).fill(0);
 startingBoard[0]=9;startingBoard[1]=9;startingBoard[24]=64;
 const fires=Array(15).fill(0);fires[0]=3;
 const xp=calculateKnowledgeCreationExp({
  upgradeRows,knowledgeRows,lithiumUnlocked:true
 });
 const rotation=simulateContinuousKnowledgeRotation({
  startingBoard,slots,mode:"balanced",targetTier:64,
  balancedEndTier:10,requestedTier:1,guaranteedBonus:0,
  rounds:2,pattern:"t1Climb",windCap:0,chain:0,protectedIndices:[24],
  expAt:(_tier,at)=>xp.expAt(fires,at),
  cookCost:()=>1,maximumActions:1000
 });
 assert.equal(rotation.completed,true);
 const created=rotation.frames.flatMap(frame=>(frame.events??[]).filter(event=>
  ["cook","merge","wind"].includes(event.kind)));
 assert.equal(created.length,1);
 assert.equal(created[0].tier,10);
 assert.equal(created[0].at,0);
 assert.equal(created[0].knowledgeExp,22.5);
 assert.equal(rotation.gains[10],22.5);
 const h=buildKnowledgeActiveExpHistory(rotation.frames);
 assert.deepEqual(h.atStep(10,rotation.frames.length-1),
  {exp:22.5,creations:1});
});
test("Per-event gains sum to the exact model totals in the rotation",()=>{
 const slots=Array(120).fill(-1);
 for(let i=0;i<40;i++)slots[i]=0;
 const board=Array(120).fill(0);board[39]=64;
 const fires=Array(15).fill(3);
 const xp=calculateKnowledgeCreationExp({
  upgradeRows,knowledgeRows,lithiumUnlocked:true
 });
 const rotation=simulateContinuousKnowledgeRotation({
  startingBoard:board,slots,mode:"focused",targetTier:10,
  requestedTier:1,guaranteedBonus:9,rounds:2,pattern:"uniform",
  windCap:0,chain:0,protectedIndices:[39],
  expAt:(_tier,at)=>xp.expAt(fires,at),
  cookCost:()=>1,maximumActions:1000
 });
 const expEvents=rotation.frames.flatMap(frame=>(frame.events??[]).filter(e=>
  Number.isFinite(e.knowledgeExp)));
 for(let tier=1;tier<=64;tier++){
  const byEvents=expEvents.filter(e=>e.tier===tier)
   .reduce((sum,e)=>sum+e.knowledgeExp,0);
  assert.ok(Math.abs(byEvents-rotation.gains[tier])<1e-8,
   "T"+tier+" EXP sum mismatch");
 }
 assert.ok(expEvents.length>1);
 assert.ok(expEvents.every(e=>e.knowledgeExp===22.5));
});
test("Both the account breakdown and event-by-event gains are visible in the UI",()=>{
 const ui=readFileSync(new URL("../src/knowledge-leveling-ui.mjs",import.meta.url),"utf8");
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 assert.match(ui,/Calculated Knowledge EXP per sushi created/);
 assert.match(ui,/event\.knowledgeExp/);
 assert.match(ui,/p\.creationXp/);
 assert.match(html,/id="knowledgePlanCreatedXp"/);
});
