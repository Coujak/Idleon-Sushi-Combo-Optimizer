import test from "node:test";
import assert from "node:assert/strict";
import {buildExperimental8Candidates,EXPERIMENTAL_8_BENCHMARK} from "../src/experimental8-preparation.mjs";
import {searchCombos} from "../src/merge-search.mjs";
import {validateComboReplay} from "../src/optimizer-core.mjs";

for(const offset of [0,20]){
 test("Experimental 8.0 reproduces 68,415 with complete replay at offset "+offset,()=>{
   const positions=Array.from({length:100},(_,i)=>i+offset);
   const [candidate]=buildExperimental8Candidates(positions,64,58,25,true);
   assert.ok(candidate);
   const {board}=candidate;
   assert.equal(board.length,120);
   assert.equal(board.filter(t=>t>0).length,100);
   assert.equal(board.filter(t=>t===64).length,1);
   assert.equal(board[offset],64);
   const slots=Array.from({length:120},(_,i)=>i>=offset&&i<offset+100?0:-1);
   const result=searchCombos(board,58,25,4,99,"descending domino");
   const replay=validateComboReplay(board,result.moves,58,25,slots);
   assert.equal(result.score,EXPERIMENTAL_8_BENCHMARK);
   assert.equal(replay.score,EXPERIMENTAL_8_BENCHMARK);
   assert.equal(replay.merges,94);
   assert.equal(replay.repositions,0);
   assert.equal(result.strategy,"East Wind chains");
   assert.equal(result.moves.reduce((n,m)=>n+m.events.filter(e=>e.kind==="wind").length,0),1818);
 });
}
test("Experimental 8.0 requires exactly 100 contiguous slots and full upgrade limits",()=>{
  const positions=Array.from({length:100},(_,i)=>i);
  assert.equal(buildExperimental8Candidates(positions,63,57,25,true).length,0);
  assert.equal(buildExperimental8Candidates(positions,64,57,25,true).length,0);
  assert.equal(buildExperimental8Candidates(positions,64,58,24,true).length,0);
  assert.equal(buildExperimental8Candidates(positions,64,58,25,false).length,0);
  assert.equal(buildExperimental8Candidates([...positions,100],64,58,25,true).length,0);
  assert.equal(buildExperimental8Candidates(positions.map((p,i)=>i<50?p:p+1),64,58,25,true).length,0);
});
