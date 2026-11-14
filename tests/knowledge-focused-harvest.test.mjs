import test from "node:test";
import assert from "node:assert/strict";
import {simulateMerge,simulateRelocation,validateComboReplay}
 from "../src/optimizer-core.mjs";
import {simulateContinuousKnowledgeRotation}
 from "../src/knowledge-continuous-rotation.mjs";

const filled=(n,t=0)=>{
 const board=Array(120).fill(0),slots=Array(120).fill(-1);
 for(let i=0;i<n;i++){slots[i]=0;board[i]=t;}
 return {board,slots};
};
const simulate=(board,slots,options={})=>simulateContinuousKnowledgeRotation({
 startingBoard:board,slots,mode:"focused",targetTier:58,
 requestedTier:57,rounds:3,pattern:"uniform",expAt:()=>1,
 cookCost:()=>1,windCap:58,chain:25,protectFocusedMilktoast:false,
 maximumActions:1800,...options
});
function verifyAll(result,slots){
 let previous=result.frames[0].board;
 for(const frame of result.frames.slice(1)){
  if(frame.kind==="cook"){
   assert.equal(previous[frame.at],0);
   assert.ok(frame.board[frame.at]>0);
   assert.equal(frame.board.filter(x=>x>0).length,
    previous.filter(x=>x>0).length+1);
  }else if(frame.kind==="merge"){
   assert.deepEqual(frame.board,
    simulateMerge(previous,frame.src,frame.dst,58,25,64)?.board);
  }else if(frame.kind==="move"){
   assert.deepEqual(frame.board,
    simulateRelocation(previous,frame.src,frame.dst,slots,64)?.board);
  }else assert.deepEqual(frame.board,previous,"No hidden clearing in phase labels");
  previous=frame.board;
 }
 assert.deepEqual(result.finalBoard,previous);
 assert.equal(result.targetCreated,
  result.frames.flatMap(f=>f.events)
   .filter(e=>e.kind!=="move"&&e.tier===result.targetTier).length);
 assert.equal(result.targetExp,result.gains[result.targetTier]);
 assert.equal(result.targetExp,result.frames.reduce((sum,frame)=>
  sum+(frame.gains[result.targetTier]??0),0));
}
test("Focused T58 prepares the entire board before merging T58 into T59",()=>{
 const {board,slots}=filled(18,0);
 board[17]=64;
 const result=simulate(board,slots,{targetTier:58,requestedTier:58,rounds:2});
 assert.equal(result.valid,true);
 assert.ok(result.targetCreated>=17);
 assert.ok(result.harvested>=1);
 assert.ok(result.peakTargetCopies>=17);
 const firstHarvest=result.frames.findIndex(f=>f.phase==="harvest");
 const firstTargetMerge=result.frames.findIndex(f=>
  f.kind==="merge"&&f.events[0]?.tier===59);
 assert.ok(firstHarvest>0);
 assert.ok(firstTargetMerge>=firstHarvest);
 const before=result.frames.slice(0,firstHarvest);
 assert.ok(before.some(f=>f.kind==="cook"&&f.events[0]?.tier===58));
 assert.ok(!before.some(f=>f.kind==="merge"&&f.events[0]?.tier===59),
  "Banked T58 must not be consumed before the explicit harvest phase");
 const firstBatch=result.harvestBatches[0];
 assert.ok(firstBatch.before>=17);
 assert.ok(firstBatch.reclaimed>0);
 assert.ok(result.targetMergedInHarvest>0);
 assert.ok(result.frames.some(f=>f.kind==="stage"&&
  /Harvest finished/.test(f.title)));
 verifyAll(result,slots);
});

test("Focused T58 earns EXP when T57 merges to T58, not in later T58 harvest",()=>{
 const {board,slots}=filled(8,0);
 // Start with two T57 so one target copy is made by an actual merge.
 board[0]=57;board[1]=57;
 board[7]=64;
 const result=simulate(board,slots,{requestedTier:58,rounds:2});
 assert.ok(result.frames.some(f=>f.kind==="merge"&&
  f.events[0]?.tier===58&&f.phase==="prepare"));
 const harvested=result.frames.filter(f=>f.kind==="merge"&&f.phase==="harvest");
 assert.ok(harvested.length>0);
 assert.ok(harvested.some(f=>f.events[0].tier===59));
 assert.equal(harvested.some(f=>f.events[0].tier===58),false,
  "Merging banked T58 creates T59 rather than awarding T58 EXP");
 assert.equal(result.targetExp,result.targetCreated);
 verifyAll(result,slots);
});

test("Focused T58 cannot harvest protected Milktoast T58, but harvests spare copies",()=>{
 const {board,slots}=filled(12,0);
 board[0]=58;slots[0]=3;
 board[11]=64;slots[11]=2;
 const result=simulate(board,slots,{
  requestedTier:58,rounds:2,
  protectedIndices:[0,11],protectFocusedMilktoast:true
 });
 assert.ok(result.harvested>=1);
 assert.ok(result.frames.every(f=>f.board[0]===58&&f.board[11]===64));
 assert.ok(!result.frames.some(f=>f.kind==="merge"&&f.src===0));
 assert.ok(result.targetCreated>0);
 assert.ok(result.targetMergedInHarvest>0);
 verifyAll(result,slots);
});

test("Focused progress-only preview never claims to have harvested T58",()=>{
 const {board,slots}=filled(12,2);
 board[11]=64;
 const result=simulate(board,slots,{
  requestedTier:2,targetTier:58,rounds:2
 });
 assert.equal(result.valid,true);
 assert.equal(result.targetCreated,0);
 assert.equal(result.harvested,0);
 assert.equal(result.targetMergedInHarvest,0);
 assert.ok(result.frames.every(f=>f.phase!=="harvest"));
 assert.match(result.reason,/preview limit|Board full/);
 verifyAll(result,slots);
});

test("Focused creation EXP may originate in Wind, while stored target is not auto-upgraded",()=>{
 const {board,slots}=filled(8,0);
 // The Wind cap permits a T2 merge to upgrade T1 into T2, or a
 // T57 merge to upgrade T56 into T57; the creation target is assigned
 // to the *event tier*, regardless of whether it was manual or Wind.
 board[0]=57;board[1]=57;board[2]=57;board[3]=57;board[7]=64;
 const result=simulate(board,slots,{requestedTier:57,targetTier:58,rounds:2});
 const prepare=result.frames.filter(f=>f.phase==="prepare");
 for(let i=0;i<prepare.length;i++){
  const f=prepare[i],prev=prepare[i-1]?.board;
  if(!prev||f.kind!=="merge")continue;
  for(let j=0;j<120;j++)if(prev[j]===58)
   assert.equal(f.board[j],58,"Prepared T58 must not be upgraded before harvest");
 }
 verifyAll(result,slots);
});
