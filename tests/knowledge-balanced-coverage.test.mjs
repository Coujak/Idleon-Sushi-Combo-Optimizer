import test from "node:test";
import assert from "node:assert/strict";
import {simulateContinuousKnowledgeRotation} from "../src/knowledge-continuous-rotation.mjs";
import {simulateMerge,simulateRelocation} from "../src/optimizer-core.mjs";
const setup=()=>{
 const board=Array(120).fill(0),slots=Array(120).fill(-1);
 for(let i=0;i<100;i++)slots[i]=0;
 board[99]=64;
 return {board,slots};
};
const run=(coverageMode="recover",pattern="longWind")=>{
 const {board,slots}=setup();
 return simulateContinuousKnowledgeRotation({
  startingBoard:board,slots,mode:"balanced",targetTier:64,
  requestedTier:20,windCap:58,chain:25,rounds:4,pattern,
  coverageTiers:Array.from({length:40},(_,i)=>i+1),coverageMode,
  expAt:()=>1,cookCost:()=>1,maximumActions:5000
 });
};
test("Balanced starts from a uniformly cooked full starter board",()=>{
 const p=run();
 const refill=p.frames.findIndex(f=>f.kind==="refill");
 assert.ok(refill>=0);
 const cooked=[];
 for(let i=refill+1;i<p.frames.length&&p.frames[i].kind==="cook";i++)
  cooked.push(p.frames[i]);
 assert.equal(cooked.length,99);
 assert.ok(cooked.every(f=>f.requestedTier===20),
  "First full preparation must use the chosen starter tier");
 assert.equal(cooked.at(-1).board.filter(t=>t===20).length,99);
 assert.equal(cooked.at(-1).board[99],64);
});
test("Balanced recovery refills genuinely create missing low Sushi tiers",()=>{
 const p=run();
 const firstRefillIndex=p.frames.findIndex(f=>f.kind==="refill");
 const nextRefill=p.frames.findIndex((f,i)=>i>firstRefillIndex&&f.kind==="refill");
 assert.ok(nextRefill>firstRefillIndex);
 const coverage=p.frames.slice(nextRefill).filter(f=>f.kind==="cook")
  .map(f=>f.events[0]?.tier);
 for(let tier=1;tier<=19;tier++)
  assert.ok(coverage.includes(tier),"Balanced needs missing T"+tier+" Knowledge EXP");
 assert.ok(p.coveredTiers.length>=20);
 assert.ok(p.coveredTiers.includes(1));
 assert.ok(p.coveredTiers.includes(20));
 assert.equal(p.coveredTiers.every(t=>p.gains[t]>0),true);
 assert.equal(p.uncoveredTiers.every(t=>p.gains[t]===0),true);
 assert.equal(p.rounds,4);
});
test("Balanced recovery improves tier coverage versus classic high-tier refills",()=>{
 const coverage=run("recover","uniform"),classic=run("classic","uniform");
 assert.ok(coverage.coveredTiers.length>classic.coveredTiers.length,
  "A targeted coverage sweep should reach tiers missed by the old refill heuristic");
 assert.ok(classic.uncoveredTiers.includes(1));
 assert.ok(!coverage.uncoveredTiers.includes(1));
});
test("Balanced coverage plan replays without swapping, deletion or illegal Wind",()=>{
 const p=run();
 const {slots}=setup();
 let previous=p.frames[0].board;
 for(const f of p.frames.slice(1)){
  if(f.kind==="merge")
   assert.deepEqual(f.board,simulateMerge(previous,f.src,f.dst,58,25,64)?.board);
  else if(f.kind==="move")
   assert.deepEqual(f.board,simulateRelocation(previous,f.src,f.dst,slots,64)?.board);
  else if(f.kind==="cook"){
   assert.equal(previous[f.at],0);
   assert.equal(f.board[f.at],f.events[0].tier);
  }else assert.deepEqual(f.board,previous);
  assert.equal(f.board[99],64);
  previous=f.board;
 }
 assert.equal(p.cooks,p.frames.filter(f=>f.kind==="cook").length);
 assert.equal(p.merges,p.frames.filter(f=>f.kind==="merge").length);
});
