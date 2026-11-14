import test from "node:test";
import assert from "node:assert/strict";
import {designKnowledgeStartingBoard,captureKnowledgePreparedBoard}
 from "../src/knowledge-board-design.mjs";
import {simulateContinuousKnowledgeRotation}
 from "../src/knowledge-continuous-rotation.mjs";
import {simulateMerge,simulateRelocation} from "../src/optimizer-core.mjs";
import {readFileSync} from "node:fs";

const layout=()=>{
 const slots=Array(120).fill(-1),tiles=Array(120).fill(0);
 for(let i=0;i<100;i++)slots[i]=0;
 tiles[5]=45;tiles[20]=29;tiles[65]=58;tiles[99]=64;
 return {slots,tiles,fires:Array(15).fill(0)};
};
test("Design uses available plates but does not copy an arbitrary imported Sushi layout",()=>{
 const source=layout(),snapshot=source.tiles.slice();
 const design=designKnowledgeStartingBoard(source);
 assert.equal(design.anchor,99);
 assert.equal(design.anchorTier,64);
 assert.equal(design.board[99],64);
 assert.equal(design.board[5],0);
 assert.equal(design.board[20],0);
 assert.equal(design.board[65],0);
 assert.equal(design.unlockedCount,100);
 assert.equal(design.omittedCount,3);
 assert.equal(design.availableWorkingSlots,99);
 assert.equal(design.requiresManualCleanup,true);
 assert.deepEqual(source.tiles,snapshot,"Never modify the imported Sushi board");
 assert.deepEqual(design.protectedIndices,[99]);
 assert.equal(design.board.filter(t=>t>0).length,1);
});
test("Even multiple imported T64 Sushi are not silently copied or teleported",()=>{
 const source=layout();source.tiles[40]=64;
 const d=designKnowledgeStartingBoard(source);
 assert.equal(d.anchor,99);
 assert.equal(d.board.filter(t=>t===64).length,1);
 assert.equal(d.omittedImportedPositions.includes(40),true);
 assert.equal(d.board[40],0);
 assert.match(d.preparationNote,/NOT solved/);
});
test("With lower maximum, an existing highest-tier Sushi stays fixed",()=>{
 const source=layout();source.tiles[99]=0;
 const d=designKnowledgeStartingBoard(source);
 assert.equal(d.anchor,65);
 assert.equal(d.anchorTier,58);
 assert.equal(d.board[65],58);
 assert.deepEqual(d.protectedIndices,[65]);
});
test("Optional passive preservation keeps precisely the specified special occupants",()=>{
 const source=layout();
 source.slots[20]=2;source.slots[65]=3;
 const d=designKnowledgeStartingBoard(source,{preservePassive:true});
 assert.equal(d.board[20],29);
 assert.equal(d.board[65],58);
 assert.equal(d.board[99],64);
 assert.equal(d.board[5],0);
 assert.deepEqual(d.protectedIndices,[20,65,99]);
 assert.equal(d.omittedCount,1);
});
test("Designed Focused preparation cooks a distinct legal ingredient board",()=>{
 const source=layout();
 const seed=designKnowledgeStartingBoard(source);
 const p=simulateContinuousKnowledgeRotation({
  startingBoard:seed.board,slots:source.slots,
  mode:"focused",targetTier:58,requestedTier:45,
  protectedIndices:seed.protectedIndices,startingContext:"designed",
  guaranteedBonus:0,windCap:58,chain:25,
  expAt:()=>1,cookCost:()=>1,rounds:2,
  pattern:"longWind",maximumActions:1800
 });
 assert.equal(p.valid,true);
 assert.match(p.frames[0].detail,/Designed preparation scenario/);
 const snapshot=captureKnowledgePreparedBoard(p.frames,seed.board);
 assert.equal(snapshot.ready,true);
 assert.ok(snapshot.cooks>0);
 assert.deepEqual(p.frames[snapshot.step].board,snapshot.board);
 assert.equal(snapshot.board[99],64);
 assert.ok(snapshot.board.some((tier,i)=>tier>0&&seed.board[i]===0));
 assert.ok(snapshot.board.some((tier,i)=>tier===44&&seed.board[i]===0));
 let board=p.frames[0].board;
 for(const step of p.frames.slice(1)){
  if(step.kind==="cook"){
   assert.equal(board[step.at],0);
   assert.ok(step.board[step.at]>0);
  }else if(step.kind==="merge"){
   assert.deepEqual(step.board,simulateMerge(
    board,step.src,step.dst,58,25,64)?.board);
  }else if(step.kind==="move"){
   assert.deepEqual(step.board,simulateRelocation(
    board,step.src,step.dst,source.slots,64)?.board);
  }else assert.deepEqual(step.board,board);
  assert.equal(step.board[99],64);
  board=step.board;
 }
});
test("User-facing Knowledge planner has a standalone designed-board preview",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../src/knowledge-leveling-ui.mjs",import.meta.url),"utf8");
 assert.match(html,/id="knowledgePlanDesign"/);
 assert.match(html,/Recommended prepared Sushi board|Prepared board/);
 assert.match(ui,/renderDesignedBoard\(plan\)/);
 assert.match(ui,/scenarioRequiresCleanup/);
 assert.match(ui,/p\.preparedBoard\[i\]/);
 assert.match(ui,/p\.preparedStep/);
});

test("Different candidate ingredient offsets give distinct, legally cookable prepared boards",()=>{
 const source=layout();
 const d=designKnowledgeStartingBoard(source);
 const plans=[0,3].map(recipeOffset=>simulateContinuousKnowledgeRotation({
  startingBoard:d.board,slots:source.slots,mode:"focused",
  targetTier:58,requestedTier:22,recipeOffset,
  guaranteedBonus:0,windCap:58,chain:25,
  expAt:()=>1,cookCost:()=>1,rounds:1,
  pattern:"wind",protectedIndices:d.protectedIndices,
  startingContext:"designed",maximumActions:1200
 }));
 const boards=plans.map(p=>captureKnowledgePreparedBoard(p.frames,d.board));
 assert.equal(boards.every(x=>x.ready),true);
 assert.notDeepEqual(boards[0].board,boards[1].board);
 assert.equal(boards[0].board.filter(x=>x>0).length,100);
 assert.equal(boards[1].board.filter(x=>x>0).length,100);
 assert.equal(boards.every(x=>x.board[99]===64),true);
 assert.equal(boards.every(x=>x.cooks===99),true);
 for(const p of plans){
  let previous=p.frames[0].board;
  for(const frame of p.frames.slice(1)){
   if(frame.kind==="cook"){
    assert.equal(previous[frame.at],0);
    assert.equal(frame.events.length,1);
    assert.ok(frame.events[0].tier>0&&frame.events[0].tier<=22);
   }else if(frame.kind==="merge")
    assert.deepEqual(frame.board,simulateMerge(
     previous,frame.src,frame.dst,58,25,64)?.board);
   else if(frame.kind==="move")
    assert.deepEqual(frame.board,simulateRelocation(
     previous,frame.src,frame.dst,source.slots,64)?.board);
   else assert.deepEqual(frame.board,previous);
   previous=frame.board;
  }
 }
});
