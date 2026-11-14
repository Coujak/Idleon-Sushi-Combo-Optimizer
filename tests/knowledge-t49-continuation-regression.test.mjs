import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {canExtendBalancedRotation} from "../src/knowledge-rotation-continuation-eligibility.mjs";
import {simulateContinuousKnowledgeRotation} from "../src/knowledge-continuous-rotation.mjs";

const slots=Array.from({length:120},(_,i)=>i<100?0:-1);
const screenshotBoard=()=>{
 const board=Array(120).fill(0);
 // Recreate the reported T49 down-to-T22 staircase, with many open
 // unlocked plates and an existing protected T64 anchor.
 const observed=[...Array.from({length:16},(_,i)=>49-i),27,26,25,24,23,22];
 observed.forEach((tier,i)=>board[i]=tier);
 board[99]=64;
 return board;
};
const plan=(board=screenshotBoard(),additional={})=>({
 mode:"balanced",available:true,completed:false,rotationTerminal:false,
 layout:{slots},finalBoard:board,protectedIndices:[99],windCap:58,
 roundsRequested:64,roundsCompleted:64,
 haltReason:"Reached the requested preview refill limit",...additional
});
test("Continue is available at the reported T49 board even after 64 refills",()=>{
 assert.equal(canExtendBalancedRotation(plan()),true);
 assert.equal(canExtendBalancedRotation(plan(screenshotBoard(),{
  roundsRequested:72,roundsCompleted:69,
  haltReason:"Replay step limit reached"
 })),true);
});
test("Creating a new T64 correctly hides continuation",()=>{
 assert.equal(canExtendBalancedRotation(plan(screenshotBoard(),{
  rotationTerminal:true,completed:true
 })),false);
});
test("The T49 staircase makes further real progress when more empty cells are refilled",()=>{
 const rotation=simulateContinuousKnowledgeRotation({
  startingBoard:screenshotBoard(),slots,mode:"balanced",targetTier:64,
  requestedTier:1,guaranteedBonus:21,windCap:58,chain:25,
  rounds:6,roundOffset:64,pattern:"t1Climb",
  packingMode:"simple",protectedIndices:[99],
  expAt:()=>1,cookCost:()=>1,maximumActions:5000
 });
 assert.equal(rotation.rounds,6);
 assert.ok(rotation.cooks>0);
 assert.ok(rotation.merges>0);
 assert.ok(rotation.frames.some(frame=>frame.title==="Refill 65"));
 assert.ok(rotation.frames.filter(frame=>frame.kind==="cook")
  .every(frame=>frame.requestedTier===1&&frame.events[0].tier===22));
 const working=rotation.finalBoard.filter(tier=>tier>0&&tier!==64);
 assert.ok(Math.max(...working)>49,
  "The screenshot T49 staircase must advance on a six-wave continuation");
 assert.equal(rotation.finalBoard[99],64);
});
test("No invisible 64-round guard remains on UI continuation buttons",()=>{
 const ui=readFileSync(new URL("../src/knowledge-leveling-ui.mjs",import.meta.url),"utf8");
 assert.ok(ui.includes('canExtendBalancedRotation(p)'));
 assert.ok(ui.includes('canExtendBalancedRotation(result)'));
 assert.ok(!ui.includes("roundsRequested<64"));
 assert.ok(!ui.includes("roundsRequested>=64"));
 assert.ok(!ui.includes("roundsCompleted!==result.roundsRequested"));
});
