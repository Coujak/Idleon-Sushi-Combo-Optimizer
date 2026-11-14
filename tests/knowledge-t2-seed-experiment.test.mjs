import test from "node:test";
import assert from "node:assert/strict";
import {simulateMerge,validateComboReplay,MAX_SUSHI_WIND_CHAIN}
 from "../src/optimizer-core.mjs";
import {simulateContinuousKnowledgeRotation}
 from "../src/knowledge-continuous-rotation.mjs";

const CELLS=120,UNLOCKED=100,ANCHOR=99,CAP=58;
const initialBoard=()=>{
 const board=Array(CELLS).fill(0);
 board.fill(2,0,ANCHOR);
 board[ANCHOR]=64;
 return board;
};
const unlockedSlots=()=>Array.from({length:CELLS},(_,i)=>i<UNLOCKED?0:-1);
const work=board=>board.slice(0,ANCHOR).filter(x=>x>0);
function candidates(board){
 const byTier=new Map();
 for(let i=0;i<ANCHOR;i++){
  const tier=board[i];
  if(tier>=1&&tier<=CAP){
   if(!byTier.has(tier))byTier.set(tier,[]);
   byTier.get(tier).push(i);
  }
 }
 const result=[];
 for(const indices of byTier.values()){
  if(indices.length<2)continue;
  const last=indices.length;
  const destinations=last<12?indices:[
   ...indices.slice(0,4),...indices.slice(-4),
   ...indices.slice(Math.floor(last/2),Math.floor(last/2)+3)];
  for(const dst of new Set(destinations)){
   const sorted=indices.filter(i=>i!==dst)
    .sort((a,b)=>Math.abs(a-dst)-Math.abs(b-dst));
   const sources=new Set([
    ...sorted.slice(0,2),...sorted.filter(i=>i<dst).slice(-2),
    ...sorted.filter(i=>i>dst).slice(-2)
   ]);
   for(const src of sources){
    const action=simulateMerge(board,src,dst,CAP,MAX_SUSHI_WIND_CHAIN);
    if(action&&action.events.every(e=>e.at<ANCHOR))result.push(action);
   }
  }
 }
 return result;
}
function score(action){
 const tierCounts=new Map(),board=action.board;
 for(const tier of work(board))
  tierCounts.set(tier,(tierCounts.get(tier)??0)+1);
 const peak=Math.max(...tierCounts.keys());
 const pairs=[...tierCounts.values()].reduce((total,n)=>total+Math.floor(n/2),0);
 const created=Math.max(...action.events.map(x=>x.tier));
 return peak*100000+created*100+
  (action.events.length-1)*50+pairs*3-Math.abs(action.src-action.dst)*.1;
}
function greedyT2Experiment(){
 let board=initialBoard(),trace=[];
 while(trace.length<ANCHOR){
  let best=null,bestScore=-Infinity;
  for(const action of candidates(board)){
   const n=score(action);
   if(n>bestScore){best=action;bestScore=n;}
  }
  if(!best)break;
  trace.push(best);
  board=best.board;
 }
 return {board,trace,maxTier:Math.max(...work(board))};
}
test("Full board: T64 in last unlocked slot, 99 T2, no refills or deletes",()=>{
 const board=initialBoard(),slots=unlockedSlots();
 assert.equal(board.length,120);
 assert.equal(slots.filter(x=>x>=0).length,100);
 assert.equal(board.filter(x=>x===2).length,99);
 assert.equal(board[99],64);
 const result=greedyT2Experiment();
 assert.equal(result.maxTier,20,
  "This is the tested greedy baseline, not a proof of the global optimum");
 assert.equal(result.trace.length,90);
 assert.equal(work(result.board).length,9);
 assert.equal(result.board[99],64);
 assert.ok(result.trace.every(move=>move.kind==="merge"&&
  move.events.filter(e=>e.kind==="wind").length<=25));
 assert.deepEqual(
  validateComboReplay(board,result.trace,CAP,25,slots).board,result.board);
});
test("T58 is impossible from one fill of 99 T2 under the 25-upgrade cap",()=>{
 // Excluding the existing, untouched T64: initial sum of working tier numbers
 // is exactly 99 × 2 = 198. For any Tt+Tt merge, sum changes by 1-t+w,
 // where w is the number of Wind upgrades, bounded by 25. With all
 // initially T2 and no cooking/refills, this sum cannot increase.
 //
 // To first reach T58, the working maximum must pass T28..T58.
 // Each new tier k requires a merge of T(k-1) and loses at least k-27
 // units of total tier-number sum, even with all 25 Wind upgrades.
 // Hence the unavoidable loss is 1+2+...+31 = 496.
 const minimumLoss=Array.from({length:58-27},(_,i)=>i+1)
  .reduce((total,n)=>total+n,0);
 const initialWorkingSum=99*2;
 const necessaryWorkingSum=58+minimumLoss;
 assert.equal(MAX_SUSHI_WIND_CHAIN,25);
 assert.equal(minimumLoss,496);
 assert.equal(necessaryWorkingSum,554);
 assert.ok(initialWorkingSum<necessaryWorkingSum);
 assert.equal(Math.ceil(necessaryWorkingSum/2),277,
  "At least 277 initial T2 would be needed, even ignoring board geometry");
});
test("Refills after a T2-only start preserve the T64 and every legal change",()=>{
 const initial=initialBoard(),slots=unlockedSlots();
 const result=simulateContinuousKnowledgeRotation({
  startingBoard:initial,slots,mode:"balanced",targetTier:58,
  requestedTier:2,guaranteedBonus:0,windCap:58,chain:25,
  expAt:()=>1,cookCost:()=>1,
  rounds:3,pattern:"uniform",maximumActions:1000
 });
 assert.equal(result.valid,true);
 assert.deepEqual(result.initialBoard,initial);
 assert.ok(result.frames.some(frame=>frame.kind==="refill"));
 assert.ok(result.frames.some(frame=>frame.kind==="cook"));
 assert.ok(result.frames.every(frame=>frame.board[99]===64));
 assert.ok(result.frames.every(frame=>frame.kind!=="clear"));
 assert.ok(result.frames.some(frame=>frame.kind==="merge"));
});
