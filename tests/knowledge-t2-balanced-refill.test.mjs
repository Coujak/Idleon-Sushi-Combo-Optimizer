import test from "node:test";
import assert from "node:assert/strict";
import {simulateContinuousKnowledgeRotation}
 from "../src/knowledge-continuous-rotation.mjs";
import {simulateMerge,simulateRelocation} from "../src/optimizer-core.mjs";

function run(options={}){
 const board=Array(120).fill(0),slots=Array(120).fill(-1);
 for(let i=0;i<40;i++)slots[i]=0;
 board[39]=64;
 return simulateContinuousKnowledgeRotation({
  startingBoard:board,slots,mode:"balanced",targetTier:64,
  requestedTier:2,windCap:58,chain:25,rounds:4,
  pattern:"t2Climb",coverageTiers:Array.from({length:64},(_,i)=>i+1),
  expAt:()=>1,cookCost:()=>1,maximumActions:4000,...options
 });
}

test("T2-first Balanced cooks T2 on every refill, preserving survivors",()=>{
 const result=run();
 const refills=result.frames.map((frame,i)=>frame.kind==="refill"?i:-1)
  .filter(i=>i>=0);
 assert.ok(refills.length>=2,"Must continue beyond the first refill");
 for(let j=0;j<refills.length;j++){
  const end=refills[j+1]??result.frames.length;
  const cooks=result.frames.slice(refills[j]+1,end).filter(f=>f.kind==="cook");
  assert.ok(cooks.length>0);
  assert.ok(cooks.every(f=>f.requestedTier===2));
 }
 assert.ok(result.gains[2]>0);
 assert.equal(result.finalBoard[39],64);
});

test("T2-first Balanced walkthrough is legal and never deletes Sushi",()=>{
 const result=run();
 const slots=Array(120).fill(-1);
 for(let i=0;i<40;i++)slots[i]=0;
 let previous=result.frames[0].board;
 for(const frame of result.frames.slice(1)){
  if(frame.kind==="cook"){
   assert.equal(previous[frame.at],0);
   assert.equal(frame.board[frame.at],frame.events[0].tier);
  }else if(frame.kind==="merge"){
   assert.deepEqual(frame.board,
    simulateMerge(previous,frame.src,frame.dst,58,25,64)?.board);
  }else if(frame.kind==="move"){
   assert.deepEqual(frame.board,
    simulateRelocation(previous,frame.src,frame.dst,slots,64)?.board);
  }else assert.deepEqual(frame.board,previous);
  assert.equal(frame.board[39],64);
  previous=frame.board;
 }
 const total=result.gains.reduce((a,b)=>a+b,0);
 assert.equal(result.totalExp,total);
});

test("Milktoast does not alter active Knowledge EXP without passive preservation",()=>{
 const ordinary=run();
 const milk=run({slots:(()=>{
  const a=Array(120).fill(-1);
  for(let i=0;i<40;i++)a[i]=i%4===0?3:0;
  return a;
 })(),protectFocusedMilktoast:false});
 assert.deepEqual(milk.gains,ordinary.gains);
});
