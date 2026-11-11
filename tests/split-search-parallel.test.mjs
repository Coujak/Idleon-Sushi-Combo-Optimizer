import test from "node:test";
import assert from "node:assert/strict";
import {scanSplitDirectionsInParallel} from "../src/split-search-parallel.mjs";
import {buildSplitComboCandidates} from "../src/combo-split-strategies.mjs";
import {evaluateSplitCandidate,betterSplitResult} from "../src/split-search-core.mjs";
import {validateComboReplay} from "../src/optimizer-core.mjs";

// A mock worker verifies that BOTH directions are dispatched before either
// has finished and that either Cancel control can terminate both threads.
class FakeWorker{
 static instances=[];
 static dispatches=[];
 constructor(){this.closed=false;FakeWorker.instances.push(this);}
 postMessage(message){
  const direction=message.candidates[0].splitDirection;
  FakeWorker.dispatches.push(direction);
  setTimeout(()=>{
   if(this.closed)return;
   this.onmessage?.({data:{
    type:"progress",processed:message.candidates.length,
    splitPercent:message.candidates.at(-1).splitPercent,
    improved:null
   }});
  },8);
 }
 terminate(){this.closed=true;}
}
const examples=[
 ...Array.from({length:12},(_,i)=>({splitDirection:"supply",splitPercent:50+i,board:[1]})),
 ...Array.from({length:12},(_,i)=>({splitDirection:"engine",splitPercent:50-i,board:[1]}))
];
test("Supply and engine directions run concurrently and complete independently",async()=>{
 const original=globalThis.Worker;
 globalThis.Worker=FakeWorker;
 FakeWorker.instances=[];FakeWorker.dispatches=[];
 try{
  const progress={supply:0,engine:0};
  await scanSplitDirectionsInParallel(examples,
   {cap:58,chain:25,mode:"descending domino",maxTier:64},null,
   ({direction,processed})=>{progress[direction]+=processed;});
  assert.equal(FakeWorker.instances.length,2);
  assert.deepEqual(FakeWorker.dispatches.slice(0,2),["supply","engine"]);
  assert.deepEqual(progress,{supply:12,engine:12});
  assert.ok(FakeWorker.instances.every(worker=>worker.closed));
 }finally{globalThis.Worker=original;}
});
test("Abort terminates both split workers",async()=>{
 const original=globalThis.Worker;
 globalThis.Worker=FakeWorker;
 FakeWorker.instances=[];FakeWorker.dispatches=[];
 try{
  const controller=new AbortController();
  await assert.rejects(
   scanSplitDirectionsInParallel(examples,
    {cap:58,chain:25,mode:"descending domino",maxTier:64},
    controller.signal,()=>controller.abort()),
   {name:"AbortError"});
  assert.ok(FakeWorker.instances.every(worker=>worker.closed));
 }finally{globalThis.Worker=original;}
});
test("Shared split evaluator preserves the former greedy plus staircase replay",()=>{
 const positions=Array.from({length:20},(_,i)=>i);
 const candidates=buildSplitComboCandidates(positions,64,58,25,0,true,"optimizer1");
 const candidate=candidates[0];
 const result=evaluateSplitCandidate({...candidate,
  slots:Array.from({length:120},(_,i)=>i<20?0:-1)},58,25,
  "descending domino",64);
 const verified=validateComboReplay(result.board,result.search.moves,58,25,result.slots,64);
 assert.equal(verified.score,result.search.score);
 assert.ok(betterSplitResult(result,null));
 assert.equal(betterSplitResult(result,result),false);
});
