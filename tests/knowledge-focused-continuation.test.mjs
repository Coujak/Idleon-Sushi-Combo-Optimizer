import test from "node:test";
import assert from "node:assert/strict";
import {simulateContinuousKnowledgeRotation}
 from "../src/knowledge-continuous-rotation.mjs";
import {combineKnowledgeContinuation}
 from "../src/knowledge-rotation-extension.mjs";
import {canExtendKnowledgeRotation}
 from "../src/knowledge-rotation-continuation-eligibility.mjs";
import {simulateMerge,simulateRelocation}
 from "../src/optimizer-core.mjs";
import {knowledgeContinueWaveCount}
 from "../src/knowledge-refill-scale.mjs";

const slots=Array.from({length:120},(_,i)=>i<40?(i===3?3:0):-1);
const fresh=()=>{
 const board=Array(120).fill(0);board[39]=64;return board;
};
const options={
 slots,mode:"focused",targetTier:23,requestedTier:1,
 guaranteedBonus:20,windCap:58,chain:25,
 rounds:6,pattern:"uniform",protectedIndices:[39],
 expAt:()=>1,cookCost:()=>1,maximumActions:5000,
 protectFocusedMilktoast:false
};
const run=(board,created=0,offset=0,extra={})=>
 simulateContinuousKnowledgeRotation({
  ...options,...extra,startingBoard:board,startingTargetCreated:created,
  roundOffset:offset,startingContext:offset?"continuation":"designed"
 });

test("Focused continues past the old 16-refill cutoff without resetting target counts",()=>{
 let board=fresh(),created=0,offset=0,totalHarvests=0;
 const chunks=[];
 for(let batch=0;batch<6;batch++){
  const chunk=run(board,created,offset);
  chunks.push(chunk);
  assert.equal(chunk.frames[0].targetCreated,created);
  assert.ok(chunk.frames.every(frame=>frame.board[39]===64));
  assert.ok(chunk.targetCreated>=created);
  assert.ok(chunk.rounds>=1);
  created=chunk.targetCreated;
  offset+=chunk.rounds;
  totalHarvests+=chunk.harvested;
  board=chunk.finalBoard;
 }
 assert.ok(offset>16,"Focused must continue beyond old 16-wave limit");
 assert.ok(created>chunks[0].targetCreated);
 assert.ok(totalHarvests>=1,"Long Focused research should legally harvest banked copies");
 assert.equal(board[39],64);
 assert.ok(board.some(t=>t>0&&t<64));
});
test("Focused continuation preserves all old steps, EXP and target harvest history",()=>{
 const first=run(fresh());
 const second=run(first.finalBoard,first.targetCreated,first.rounds);
 const plan={
  available:true,mode:"focused",completed:false,rotationTerminal:false,
  layout:{slots},steps:first.frames,startingBoard:first.initialBoard,
  finalBoard:first.finalBoard,protectedIndices:first.protectedIndices,
  expByTier:first.gains,
  perTier:Array.from({length:64},(_,i)=>({
   tier:i+1,remaining:10,passiveExpPerDay:0,
   expPerCycle:first.gains[i+1]
  })),
  options:{secondsPerCook:2,secondsPerMerge:1.5},
  estimatedFuelGeneration:3600,cycleSeconds:200,
  totalExpPerCycle:first.totalExp,roundsCompleted:first.rounds,
  roundsRequested:first.rounds,cooks:first.cooks,merges:first.merges,
  moves:first.moves,windEvents:first.windEvents,fuelPerCycle:first.fuel,
  activeSeconds:200,fuelWaitSeconds:200,targetTier:23,
  targetPassiveExpPerDay:0,passive:{averageTotalPerDay:0},
  highestNewTier:23,highestWorkingTier:23,
  targetCreated:first.targetCreated,
  targetMergedInHarvest:first.targetMergedInHarvest,
  harvestBatches:first.harvestBatches,harvestCount:first.harvested,
  peakTargetCopies:first.peakTargetCopies,
  focusCopies:first.focusCopies,focusCompressed:first.focusCompressed
 };
 assert.equal(canExtendKnowledgeRotation(plan),true);
 const combined=combineKnowledgeContinuation(plan,second,6);
 assert.equal(combined.mode,"focused");
 assert.equal(combined.roundsCompleted,first.rounds+second.rounds);
 assert.equal(combined.targetCreated,second.targetCreated);
 assert.equal(combined.targetExp,first.gains[23]+second.gains[23]);
 assert.equal(combined.harvestCount,first.harvested+second.harvested);
 assert.deepEqual(combined.protectedIndices,second.protectedIndices);
 assert.ok(combined.steps.length>plan.steps.length);
 for(let i=0;i<plan.steps.length-1;i++)
  assert.equal(combined.steps[i],plan.steps[i],"Old replay step "+i+" was retained");
 assert.ok(combined.steps.some(frame=>frame.title==="Refill 7"));
 assert.equal(combined.finalBoard[39],64);
 assert.equal(combined.rotationTerminal,false,
  "Focused does not stop on an existing or newly created T64");
});
test("Focused continuation contains only legal moves and real target EXP events",()=>{
 const first=run(fresh());
 const continued=run(first.finalBoard,first.targetCreated,first.rounds);
 let board=continued.frames[0].board;
 for(const frame of continued.frames.slice(1)){
  if(frame.kind==="cook"){
   assert.equal(board[frame.at],0);
   assert.equal(frame.board[frame.at],frame.events[0].tier);
  }else if(frame.kind==="merge"){
   assert.deepEqual(frame.board,
    simulateMerge(board,frame.src,frame.dst,58,25,64)?.board);
  }else if(frame.kind==="move"){
   assert.deepEqual(frame.board,
    simulateRelocation(board,frame.src,frame.dst,slots,64)?.board);
  }else assert.deepEqual(frame.board,board);
  assert.equal(frame.board[39],64);
  board=frame.board;
 }
 assert.ok(continued.targetCreated>=first.targetCreated);
});
test("Focused uses the same five-percent refill scale as Balanced",()=>{
 assert.equal(knowledgeContinueWaveCount(100),5);
 assert.equal(knowledgeContinueWaveCount(1000),50);
});
