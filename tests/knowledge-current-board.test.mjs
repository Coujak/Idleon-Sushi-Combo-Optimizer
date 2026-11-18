import test from "node:test";
import assert from "node:assert/strict";
import {
  importKnowledgeStartingBoard,designKnowledgeStartingBoard
} from "../src/knowledge-board-design.mjs";
import {simulateContinuousKnowledgeRotation} from "../src/knowledge-continuous-rotation.mjs";
import {normalizeKnowledgeCycleOptions} from "../src/knowledge-cycle-optimizer.mjs";

const original=Array(120).fill(0);
original[0]=2;original[1]=2;original[2]=14;original[15]=64;
const slots=[...Array(16).fill(0),...Array(104).fill(-1)];
const setup={tiles:original,slots};

test("Use current board is optional and defaults off",()=>{
 assert.equal(normalizeKnowledgeCycleOptions().useCurrentBoard,false);
 assert.equal(normalizeKnowledgeCycleOptions({useCurrentBoard:true}).useCurrentBoard,true);
 assert.equal(normalizeKnowledgeCycleOptions({useCurrentBoard:false}).useCurrentBoard,false);
});
test("Imported-board source preserves every Sushi at its original plate",()=>{
 const state=importKnowledgeStartingBoard(setup);
 assert.deepEqual(state.board,original);
 assert.deepEqual(state.protectedIndices,[15]);
 assert.equal(state.initialOccupied,4);
 assert.equal(state.omittedCount,0);
 assert.equal(state.requiresManualCleanup,false);
 assert.equal(state.goalOnly,false);
 assert.equal(state.usesImportedBoard,true);
});
test("Designed mode remains a separate, clean starting state",()=>{
 const clean=designKnowledgeStartingBoard(setup);
 assert.deepEqual(clean.protectedIndices,[15]);
 assert.equal(clean.board[15],64);
 assert.equal(clean.omittedCount,3);
 assert.equal(clean.requiresManualCleanup,true);
});
test("Preserve passive keeps existing Cold or Milktoast Sushi while retaining all Sushi",()=>{
 const specialSlots=slots.slice();specialSlots[2]=3;
 const state=importKnowledgeStartingBoard({tiles:original,slots:specialSlots},
  {preservePassive:true});
 assert.deepEqual(state.protectedIndices,[2,15]);
 assert.deepEqual(state.board,original);
});
test("Balanced replay starts from imported state, only new creations gain EXP",()=>{
 const start=importKnowledgeStartingBoard(setup);
 const result=simulateContinuousKnowledgeRotation({
  startingBoard:start.board,slots,mode:"balanced",targetTier:28,
  balancedEndTier:28,stackEndTier:true,requestedTier:1,
  guaranteedBonus:1,windCap:0,chain:0,expAt:()=>10,cookCost:()=>1,
  rounds:2,pattern:"rangeClimb",protectedIndices:start.protectedIndices,
  startingContext:"imported",maximumActions:1000
 });
 assert.equal(result.valid,true);
 assert.equal(result.frames[0].title,"Current Sushi board");
 assert.deepEqual(result.frames[0].board,original);
 assert.equal(result.frames[0].exp,0);
 for(const frame of result.frames)assert.equal(frame.board[15],64);
 assert.ok(result.cooks+result.merges>0);
 const creations=result.frames.flatMap(frame=>frame.events??[])
  .filter(event=>["cook","merge","wind"].includes(event.kind));
 assert.equal(result.totalExp,creations.length*10);
});
test("Invalid imported positions are rejected rather than removed silently",()=>{
 const bad=original.slice();bad[99]=3;
 assert.throws(()=>importKnowledgeStartingBoard({tiles:bad,slots}),
  /invalid or locked/);
});
