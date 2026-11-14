import test from "node:test";
import assert from "node:assert/strict";
import {estimateKnowledgeRefillFuel} from "../src/knowledge-fuel-safety.mjs";
import {optimizeKnowledgeRotation} from "../src/knowledge-rotation-optimizer.mjs";
import {simulateContinuousKnowledgeRotation} from "../src/knowledge-continuous-rotation.mjs";
import {simulateRelocation,simulateMerge} from "../src/optimizer-core.mjs";

const cook=(n,cost,requestedTier=46)=>[
 {kind:"refill",board:[]},
 ...Array.from({length:n},()=>({kind:"cook",cookFuel:cost,requestedTier}))
];
test("Full-board preparation cannot choose high-tier Sushi merely because one cook fits cap",()=>{
 const budget={capacity:1e13,generationPerHour:1e13,secondsPerCook:2};
 const T46=estimateKnowledgeRefillFuel(cook(99,6460989536909),budget);
 const T36=estimateKnowledgeRefillFuel(cook(99,15338684193,36),budget);
 assert.equal(T46.noWait,false);
 assert.ok(T46.estimatedWaitSeconds>3600);
 assert.equal(T36.noWait,true);
 assert.ok(T36.fuel<T36.budget);
 assert.equal(T46.cooks,99);
 assert.equal(T36.cooks,99);
});
test("No-wait Fuel budget credits natural generation, not infinite fuel capacity",()=>{
 const frames=cook(100,1000,30);
 const low=estimateKnowledgeRefillFuel(frames,{
  capacity:10000,generationPerHour:1000,secondsPerCook:2
 });
 const high=estimateKnowledgeRefillFuel(frames,{
  capacity:10000,generationPerHour:1e7,secondsPerCook:2
 });
 assert.equal(low.noWait,false);
 assert.equal(high.noWait,true);
 assert.equal(high.highestRequestedTier,30);
 assert.equal(high.cooks,100);
});
test("Focus places a new target Sushi on a yellow Milktoast plate without active EXP bonus",()=>{
 const slots=Array(120).fill(-1),board=Array(120).fill(0);
 for(let i=0;i<12;i++)slots[i]=0;
 slots[10]=3;board[10]=2;board[11]=64;
 const plan=simulateContinuousKnowledgeRotation({
  startingBoard:board,slots,mode:"focused",targetTier:58,requestedTier:58,
  rounds:2,pattern:"uniform",windCap:58,chain:25,
  protectFocusedMilktoast:false,expAt:()=>1,cookCost:()=>1,
  maximumActions:2500
 });
 assert.ok(plan.frames.some(f=>f.board[10]===58),
  "A target copy should eventually occupy yellow Milktoast");
 assert.ok(plan.frames.some(f=>(f.kind==="move"||f.kind==="cook"||
  f.kind==="merge")&&f.board[10]===58),
  "A newly created or legally relocated T58 should occupy Milktoast");
 assert.equal(plan.targetExp,plan.targetCreated,
  "Milktoast must not duplicate EXP from creating T58");
 for(let i=1;i<plan.frames.length;i++){
  const before=plan.frames[i-1].board,f=plan.frames[i];
  if(f.kind==="move")
   assert.deepEqual(f.board,simulateRelocation(before,f.src,f.dst,slots,64)?.board);
  if(f.kind==="merge")
   assert.deepEqual(f.board,simulateMerge(before,f.src,f.dst,58,25,64)?.board);
 }
});
test("Preserve existing passive-source Sushi is off unless explicitly requested",()=>{
 const slots=Array(120).fill(-1),tiles=Array(120).fill(-1);
 const upgrades=Array(46).fill(0),flags=Array(64).fill(0);
 for(let i=0;i<12;i++)slots[i]=0;
 slots[2]=3;tiles[2]=5;tiles[11]=63;
 upgrades[6]=4;upgrades[13]=1;upgrades[37]=1;
 const save={slots,tiles,fires:Array(15).fill(0),
  sushi:[[],[],upgrades,[],[0,0,0,0],flags,Array(64).fill(0),Array(64).fill(1)]};
 const run=optimizeKnowledgeRotation(save,{
  mode:"focused",targetTier:2,rounds:1,
  fuelCapacity:1e5,fuelGeneration:1e10
 });
 assert.equal(run.available,true,run.reason);
 assert.equal(run.options.preservePassive,false);
 assert.equal(run.startingBoard[2],0);
 assert.equal(run.initialProtectedIndices.length,1);
});

test("Per-cook Fuel validation rejects a first cook that needs more Fuel than is currently available",()=>{
 const frames=[{kind:"refill"},{
  kind:"cook",requestedTier:40,cookFuel:6000
 },{kind:"cook",requestedTier:2,cookFuel:1}];
 const fuel=estimateKnowledgeRefillFuel(frames,{
  capacity:10000,startingFuel:6000,
  generationPerHour:1000000,secondsPerCook:2,reserveFraction:0.5
 });
 assert.ok(fuel.fuel<=fuel.budget,
  "Aggregate Fuel can look affordable despite the timing of the first cook");
 assert.equal(fuel.noWait,false);
 assert.ok(fuel.waitingCooks>=1);
 assert.ok(fuel.estimatedWaitSeconds>0);
});
test("Fuel safety never spends more imported Fuel than the JSON currently reports",()=>{
 const frames=cook(3,1000,20);
 const low=estimateKnowledgeRefillFuel(frames,{
  capacity:100000,startingFuel:0,
  generationPerHour:1,secondsPerCook:2
 });
 const full=estimateKnowledgeRefillFuel(frames,{
  capacity:100000,startingFuel:100000,
  generationPerHour:1,secondsPerCook:2
 });
 assert.equal(low.tankAllocation,0);
 assert.equal(low.noWait,false);
 assert.equal(full.tankAllocation,50000);
 assert.equal(full.noWait,true);
});

test("Account-based Focused T58 does not select a full board of prohibitively costly T46",()=>{
 const slots=Array.from({length:120},(_,i)=>i<100?0:-1);
 const tiles=Array(120).fill(-1);
 tiles[99]=63;
 const upgrades=Array(46).fill(0);
 upgrades[6]=45;upgrades[13]=1;upgrades[29]=1;upgrades[37]=2;
 const flags=Array(64).fill(0),levels=Array(64).fill(1);
 const account={slots,tiles,fires:Array(15).fill(0),
  sushi:[[],[],upgrades,[],[1e13,0,0,0],flags,
   Array(64).fill(0),levels]};
 const plan=optimizeKnowledgeRotation(account,{
  mode:"focused",targetTier:58,rounds:1,
  preservePassive:false,secondsPerCook:2,secondsPerMerge:1.5,
  fuelCapacity:1e13,fuelGeneration:1e13
 });
 assert.equal(plan.available,true,plan.reason);
 assert.equal(plan.refillFuelSafety.cooks,99);
 assert.equal(plan.fuelSafePreparation,true,
  "A safe lower-tier recipe exists and should outrank slow T46 preparation");
 assert.ok(plan.startCookTier<46,
  "Full T46 should lose to a lower wait-free starting Sushi tier");
 assert.ok(plan.refillFuelSafety.estimatedWaitSeconds<.001);
 assert.ok(plan.refillFuelSafety.fuel<=plan.refillFuelSafety.budget);
 assert.equal(plan.steps[plan.preparedStep].board.filter(t=>t>0).length,100);
});
test("Knowledge UI exposes exact end-state navigation, missed-tier counts and default unchecked passive protection",()=>{
 const {readFileSync}=await import("node:fs");
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../src/knowledge-leveling-ui.mjs",import.meta.url),"utf8");
 assert.match(html,/id="knowledgePlanEnd"/);
 assert.match(ui,/No further simulated refill/);
 assert.match(ui,/knowledgePlanEnd/);
 assert.match(ui,/uncoveredTiers/);
 assert.match(ui,/fuelSafePreparation/);
 assert.match(html,/id="knowledgePlanProtectPassive" type="checkbox"/);
 assert.doesNotMatch(html,/id="knowledgePlanProtectPassive"[^>]*checked/);
});
