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
