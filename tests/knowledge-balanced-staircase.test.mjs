import test from "node:test";
import assert from "node:assert/strict";
import {balancedStaircase,optimizeKnowledgeRotation}
 from "../src/knowledge-rotation-optimizer.mjs";
import {simulateContinuousKnowledgeRotation}
 from "../src/knowledge-continuous-rotation.mjs";

const gains=values=>[0,...values];
test("descending EXP across tiers fits Balanced better than ascending EXP",()=>{
 const descending=balancedStaircase(gains([40,30,20,10]),600,[1,2,3,4]);
 const ascending=balancedStaircase(gains([10,20,30,40]),600,[1,2,3,4]);
 assert.equal(descending.coverage,4);
 assert.ok(descending.fit>ascending.fit);
 assert.ok(descending.weightedRate>ascending.weightedRate);
});
test("Balanced compares actual EXP tiers, not requested cook tier",()=>{
 const slots=Array(120).fill(-1),board=Array(120).fill(0);
 for(let i=0;i<24;i++)slots[i]=0;
 board[23]=64;
 const plan=simulateContinuousKnowledgeRotation({
  startingBoard:board,slots,mode:"balanced",
  requestedTier:2,guaranteedBonus:36,rounds:2,pattern:"t2Climb",
  windCap:58,chain:25,cookCost:()=>1,expAt:()=>1,maximumActions:1000
 });
 const cooks=plan.frames.filter(f=>f.kind==="cook");
 assert.ok(cooks.length>0);
 assert.ok(cooks.every(f=>f.requestedTier===2));
 assert.ok(cooks.every(f=>f.events[0].tier===38));
 assert.equal(plan.gains[2],0);
 assert.ok(plan.gains[38]>0);
});
test("Balanced T2-first refills still preserve the highest-tier anchor",()=>{
 const slots=Array(120).fill(-1),board=Array(120).fill(0);
 for(let i=0;i<30;i++)slots[i]=0;
 board[29]=64;
 const plan=simulateContinuousKnowledgeRotation({
  startingBoard:board,slots,mode:"balanced",targetTier:64,
  requestedTier:2,rounds:3,pattern:"t2Climb",windCap:58,chain:25,
  cookCost:()=>1,expAt:()=>1,maximumActions:2000
 });
 assert.ok(plan.frames.filter(f=>f.kind==="refill").length>=2);
 assert.ok(plan.frames.every(f=>f.board[29]===64));
 assert.ok(plan.frames.filter(f=>f.kind==="cook")
  .every(f=>f.requestedTier===2));
});
