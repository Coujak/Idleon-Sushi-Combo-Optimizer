import test from "node:test";
import assert from "node:assert/strict";
import {packSushiStaircase} from "../src/knowledge-staircase-packing.mjs";
import {simulateRelocation,simulateMerge} from "../src/optimizer-core.mjs";
import {simulateContinuousKnowledgeRotation} from "../src/knowledge-continuous-rotation.mjs";

test("Staircase packing sorts survivors using vacant-slot moves only",()=>{
 const slots=[0,0,0,0,0,0],board=[8,6,7,0,0,64];
 const result=packSushiStaircase(board,slots,"ascending");
 assert.equal(result.complete,true);
 assert.deepEqual(result.board,[6,7,8,0,0,64]);
 assert.deepEqual(board,[8,6,7,0,0,64],"Source board must remain unchanged");
 let replay=board;
 for(const move of result.actions){
  const verified=simulateRelocation(replay,move.src,move.dst,slots,64);
  assert.ok(verified,"Packing emitted an invalid Sushi relocation");
  replay=verified.board;
 }
 assert.deepEqual(replay,result.board);
 const desc=packSushiStaircase(board,slots,"descending");
 assert.deepEqual(desc.board,[8,7,6,0,0,64]);
 assert.equal(desc.complete,true);
});

test("No vacancy prevents Sushi packing; it may not swap or delete",()=>{
 const slots=[0,0,0,0],board=[9,5,7,64];
 const result=packSushiStaircase(board,slots,"ascending");
 assert.equal(result.actions.length,0);
 assert.deepEqual(result.board,board);
 assert.equal(result.complete,false);
});

test("Staircase-recycling comparison: 99 T2, last-slot T64, 12 refills",()=>{
 const slots=Array.from({length:120},(_,i)=>i<100?0:-1);
 const seed=Array(120).fill(0);
 seed.fill(2,0,99);seed[99]=64;
 const run=packingMode=>simulateContinuousKnowledgeRotation({
  startingBoard:seed,slots,mode:"balanced",targetTier:58,
  requestedTier:2,guaranteedBonus:0,windCap:58,chain:25,
  expAt:()=>1,cookCost:()=>1,rounds:12,pattern:"uniform",
  packingMode,maximumActions:3600
 });
 const simple=run("simple"),ascending=run("ascending"),descending=run("descending");
 const peak=result=>Math.max(...result.frames.map(x=>Math.max(...x.board.slice(0,99))));
 const summary=[simple,ascending,descending].map((result,i)=>({
  parking:["simple","ascending","descending"][i],
  peak:peak(result),refills:result.rounds,cooks:result.cooks,
  merges:result.merges,moves:result.moves,windUpgrades:result.windEvents
 }));
 console.log("12-refill T2 staircase comparison:",JSON.stringify(summary));
 for(const result of [simple,ascending,descending]){
  assert.equal(result.valid,true);
  assert.equal(result.initialBoard[99],64);
  assert.ok(result.frames.every(frame=>frame.board[99]===64));
  assert.ok(result.frames.every(frame=>frame.kind!=="clear"));
  assert.equal(result.rounds,12);
  assert.ok(result.cooks>0&&result.merges>0);
  for(let j=1;j<result.frames.length;j++){
   const before=result.frames[j-1].board,frame=result.frames[j];
   if(frame.kind==="move"){
    const verified=simulateRelocation(before,frame.src,frame.dst,slots,64);
    assert.ok(verified);
    assert.deepEqual(frame.board,verified.board);
   }else if(frame.kind==="merge"){
    const verified=simulateMerge(before,frame.src,frame.dst,58,25,64);
    assert.ok(verified);
    assert.deepEqual(frame.board,verified.board);
   }else if(frame.kind==="cook"){
    assert.equal(before[frame.at],0);
    assert.ok(frame.board[frame.at]>0);
   }else assert.deepEqual(frame.board,before);
  }
 }
 assert.ok(ascending.moves>simple.moves,"Staircase preparation must consist of real Sushi relocations");
});
