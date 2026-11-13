import test from "node:test";
import assert from "node:assert/strict";
import {finishSushiBoard} from "../src/knowledge-cycle-cleanup.mjs";
import {validateComboReplay,simulateMerge} from "../src/optimizer-core.mjs";

test("T64 + T64 really becomes one T64, retaining the anchor position",()=>{
 const initial=[64,64,64],slots=[0,0,0];
 const result=finishSushiBoard(initial,slots,0,0,[2]);
 assert.equal(result.repeatable,true);
 assert.deepEqual(result.board,[0,0,64]);
 assert.deepEqual(result.leftover,[]);
 assert.equal(result.mergeCount,2);
 assert.ok(result.moves.every(move=>move.kind==="merge"&&move.events[0].tier===64));
 assert.deepEqual(validateComboReplay(initial,result.moves,0,0,slots).board,result.board);
 assert.deepEqual(initial,[64,64,64],"Cleanup must not mutate its input");
});

test("T63 merges to T64 and can then merge into a retained T64",()=>{
 const initial=[63,63,64],slots=[0,0,0];
 const result=finishSushiBoard(initial,slots,0,0,[2]);
 assert.equal(result.repeatable,true);
 assert.deepEqual(result.board,[0,0,64]);
 assert.equal(result.mergeCount,2);
 assert.deepEqual(result.moves.map(x=>x.events[0].tier),[64,64]);
});

test("Orphan Sushi cannot be deleted or marked repeatable",()=>{
 const result=finishSushiBoard([1,0,64],[0,0,0],0,0,[2]);
 assert.equal(result.repeatable,false);
 assert.deepEqual(result.board,[1,0,64]);
 assert.deepEqual(result.leftover,[{position:0,tier:1}]);
 assert.equal(result.mergeCount,0);
});

test("Cleanup never consumes permanently preserved high-tier Sushi",()=>{
 const input=[64,64,63,63],slots=[0,0,0,0];
 const result=finishSushiBoard(input,slots,0,0,[0,1]);
 assert.equal(result.repeatable,false);
 assert.equal(result.board[0],64);
 assert.equal(result.board[1],64);
 assert.ok(result.moves.every(x=>x.src!==0&&x.src!==1));
 assert.ok(result.moves.every(x=>x.events.every(ev=>slots[ev.at]>=0)));
});
test("No fictional cleanup actions can enter an exact replay",()=>{
 const board=[64,64];
 const legit=simulateMerge(board,0,1,58,25);
 assert.deepEqual(legit.board,[0,64]);
 const trace=finishSushiBoard([64,64],[0,0],58,25,[1]);
 assert.deepEqual(trace.board,[0,64]);
 assert.ok(trace.moves.every(x=>x.kind==="merge"&&x.events.length===1));
 assert.throws(()=>validateComboReplay([64,64],[{kind:"clear",src:0,dst:1,
  events:[],board:[0,64],score:0}],58,25,[0,0]));
});
