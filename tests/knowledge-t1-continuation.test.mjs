import test from "node:test";
import assert from "node:assert/strict";
import {simulateContinuousKnowledgeRotation}
 from "../src/knowledge-continuous-rotation.mjs";
import {simulateMerge,simulateRelocation}
 from "../src/optimizer-core.mjs";

const setup=(rounds=2,guaranteedBonus=0)=>{
 const slots=Array(120).fill(-1);
 for(let i=0;i<40;i++)slots[i]=0;
 const startingBoard=Array(120).fill(0);
 startingBoard[39]=64;
 return simulateContinuousKnowledgeRotation({
  startingBoard,slots,mode:"balanced",targetTier:64,
  requestedTier:1,guaranteedBonus,windCap:58,chain:25,rounds,
  pattern:"t1Climb",coverageTiers:Array.from({length:64},(_,i)=>i+1),
  expAt:()=>1,cookCost:()=>1,maximumActions:10000
 });
};
test("Balanced cooks T1, unless guaranteed tier-up changes the actual tier",()=>{
 const noBonus=setup(2,0);
 const withBonus=setup(2,1);
 for(const [plan,produced] of [[noBonus,1],[withBonus,2]]){
  const cooks=plan.frames.filter(f=>f.kind==="cook");
  assert.ok(cooks.length>=1);
  assert.ok(cooks.every(f=>f.requestedTier===1));
  assert.ok(cooks.every(f=>f.events[0].tier===produced));
  assert.equal(plan.finalBoard[39],64);
 }
 assert.ok(noBonus.gains[1]>0);
 assert.equal(withBonus.gains[1],0);
 assert.ok(withBonus.gains[2]>0);
});
test("Balanced continues past a finite refill preview without replacing previous moves",()=>{
 const short=setup(2,26); // minimum cooked Sushi is T27
 const extended=setup(8,26);
 assert.equal(short.rounds,2);
 assert.equal(extended.rounds,8);
 assert.ok(extended.frames.length>short.frames.length);
 const prefix=short.frames.slice(0,-1);
 for(let i=0;i<prefix.length;i++){
  const a=prefix[i],b=extended.frames[i];
  assert.equal(b.kind,a.kind,"Step "+i+" kind unchanged");
  assert.deepEqual(b.board,a.board,"Step "+i+" board unchanged");
  assert.deepEqual(b.events,a.events,"Step "+i+" events unchanged");
 }
 assert.ok(extended.frames.filter(x=>x.kind==="refill").length>
  short.frames.filter(x=>x.kind==="refill").length);
 assert.equal(extended.finalBoard[39],64);
 const firstHighest=Math.max(...short.frames.flatMap(f=>f.events.map(e=>e.tier)));
 const laterHighest=Math.max(...extended.frames.flatMap(f=>f.events.map(e=>e.tier)));
 assert.ok(laterHighest>=firstHighest,"Extended rotation must retain progress");
});
test("Extended Balanced steps use legal cooking, merging and repositioning",()=>{
 const plan=setup(8,26);
 const slots=Array(120).fill(-1);
 for(let i=0;i<40;i++)slots[i]=0;
 let board=plan.frames[0].board;
 for(const step of plan.frames.slice(1)){
  if(step.kind==="cook"){
   assert.equal(board[step.at],0);
   assert.equal(step.board[step.at],27);
  }else if(step.kind==="merge"){
   assert.deepEqual(step.board,
    simulateMerge(board,step.src,step.dst,58,25,64)?.board);
  }else if(step.kind==="move"){
   assert.deepEqual(step.board,
    simulateRelocation(board,step.src,step.dst,slots,64)?.board);
  }else assert.deepEqual(step.board,board);
  board=step.board;
 }
});
