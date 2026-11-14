import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {simulateContinuousKnowledgeRotation} from "../src/knowledge-continuous-rotation.mjs";
import {combineKnowledgeContinuation} from "../src/knowledge-rotation-extension.mjs";
import {simulateMerge,simulateRelocation} from "../src/optimizer-core.mjs";

function run(board,rounds=6,roundOffset=0){
 const slots=Array(120).fill(-1);
 for(let i=0;i<40;i++)slots[i]=0;
 return simulateContinuousKnowledgeRotation({
  startingBoard:board,slots,mode:"balanced",targetTier:64,
  requestedTier:1,guaranteedBonus:26,windCap:58,chain:25,
  rounds,roundOffset,pattern:"t1Climb",
  protectedIndices:[39],
  coverageTiers:Array.from({length:64},(_,i)=>i+1),
  expAt:()=>1,cookCost:()=>1,maximumActions:5000
 });
}
const anchored=()=>{
 const board=Array(120).fill(0);board[39]=64;return board;
};
test("The original T64 is not full rotation; creating a NEW T64 immediately completes it",()=>{
 const board=anchored();
 board[0]=63;board[1]=63;
 const rotation=run(board);
 assert.equal(rotation.completed,true);
 assert.equal(rotation.balancedCycles,1);
 assert.equal(rotation.merges,1);
 assert.equal(rotation.cooks,0);
 assert.equal(rotation.rounds,0);
 assert.equal(rotation.frames.at(-2).kind,"merge");
 assert.equal(rotation.frames.at(-2).events[0].tier,64);
 assert.match(rotation.reason,/new T64 created/i);
 assert.equal(rotation.finalBoard.filter(t=>t===64).length,2,
  "The original protected anchor and newly created T64 both remain; no clearing is required.");
 assert.equal(rotation.frames.at(-1).title,"New T64 created · full Balanced rotation");
});
test("Fresh T64 stops further cooking in the middle of a refill wave",()=>{
 const board=anchored();board[0]=63;board[1]=63;
 const result=run(board,12);
 const completedIndex=result.frames.findIndex(f=>f.kind==="merge"&&
  f.events.some(e=>e.tier===64));
 assert.ok(completedIndex>0);
 assert.equal(result.frames.slice(completedIndex+1).every(f=>
  !["cook","merge","move","refill"].includes(f.kind)),true);
});
test("Cooking a new T64 also ends Balanced immediately when tier-up bonus guarantees it",()=>{
 const board=anchored();
 const slots=Array(120).fill(-1);
 for(let i=0;i<40;i++)slots[i]=0;
 const result=simulateContinuousKnowledgeRotation({
  startingBoard:board,slots,mode:"balanced",targetTier:64,
  requestedTier:1,guaranteedBonus:63,windCap:58,chain:25,
  rounds:6,pattern:"t1Climb",protectedIndices:[39],
  expAt:()=>1,cookCost:()=>1,maximumActions:5000
 });
 assert.equal(result.completed,true);
 assert.equal(result.cooks,1);
 assert.equal(result.merges,0);
 assert.equal(result.rounds,1);
 assert.equal(result.frames.at(-2).kind,"cook");
 assert.equal(result.frames.at(-2).events[0].tier,64);
 assert.equal(result.finalBoard.filter(t=>t===64).length,2);
 assert.ok(result.frames.slice(-1).every(f=>f.kind==="repeat"));
});

test("Incremental refills work after global refill 64 and preserve earlier steps",()=>{
 const first=run(anchored(),2);
 assert.equal(first.completed,false);
 const next=run(first.finalBoard,6,64);
 assert.equal(next.rounds,6);
 assert.ok(next.frames.some(f=>f.title==="Merge and refill wave 65"));
 assert.ok(next.frames.some(f=>f.kind==="refill"&&f.title==="Refill 65"));
 const plan={
  available:true,mode:"balanced",completed:false,
  steps:first.frames,finalBoard:first.finalBoard,startingBoard:first.initialBoard,
  expByTier:first.gains,perTier:Array.from({length:64},(_,i)=>({
   tier:i+1,remaining:100,passiveExpPerDay:0,expPerCycle:first.gains[i+1]
  })),
  options:{secondsPerCook:2,secondsPerMerge:1.5},
  estimatedFuelGeneration:3600,cycleSeconds:400,
  cooks:first.cooks,merges:first.merges,moves:first.moves,
  windEvents:first.windEvents,fuelPerCycle:first.fuel,
  activeSeconds:200,fuelWaitSeconds:200,
  totalExpPerCycle:first.totalExp,roundsCompleted:64,roundsRequested:64,
  highestNewTier:40,highestWorkingTier:40,balancedCycles:first.balancedCycles,
  targetTier:64,targetPassiveExpPerDay:0,passive:{averageTotalPerDay:0}
 };
 const extended=combineKnowledgeContinuation(plan,next,6);
 assert.equal(extended.roundsCompleted,70);
 assert.equal(extended.roundsRequested,70);
 assert.ok(extended.steps.length>first.frames.length);
 assert.equal(extended.steps[0],first.frames[0]);
 for(let i=0;i<first.frames.length-1;i++)
  assert.equal(extended.steps[i],first.frames[i],"Old replay frame "+i+" unchanged");
 assert.deepEqual(extended.finalBoard,next.finalBoard);
 assert.equal(extended.totalExpPerCycle,first.totalExp+next.totalExp);
});
test("All new refill and merge operations remain legal after resuming existing board",()=>{
 const first=run(anchored(),2);
 const next=run(first.finalBoard,6,2);
 const slots=Array(120).fill(-1);
 for(let i=0;i<40;i++)slots[i]=0;
 let previous=next.frames[0].board;
 for(const frame of next.frames.slice(1)){
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
});
test("Knowledge walkthrough offers continuation beyond 64 refills",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../src/knowledge-leveling-ui.mjs",import.meta.url),"utf8");
 assert.match(html,/id="knowledgePlanContinue"/);
 assert.match(ui,/combineKnowledgeContinuation\(previous,msg\.result\.rotation,additionalWaves\)/);
 assert.ok(!ui.includes("roundsRequested>=64"));
 assert.match(ui,/jumpToNextRefill=true;continueButton\.click\(\)/);
});
