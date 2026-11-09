import test from "node:test";
import assert from "node:assert/strict";
import {buildExperimental13Candidates,EXPERIMENTAL_13_BENCHMARK} from "../src/experimental13-preparation.mjs";
import {searchCombos} from "../src/merge-search.mjs";
import {searchLookaheadCombos} from "../src/lookahead-search.mjs";
import {validateComboReplay} from "../src/optimizer-core.mjs";

for(const offset of [0,20]){
 test("Exp 13 Cascade Resonance replay at offset "+offset,()=>{
  const positions=Array.from({length:100},(_,i)=>i+offset);
  const [candidate]=buildExperimental13Candidates(positions,64,58,25,true);
  assert.ok(candidate);
  const board=candidate.board;
  assert.equal(board.length,120);
  assert.equal(board.filter(x=>x>0).length,100);
  assert.equal(board.filter(x=>x===64).length,1);
  assert.equal(board[offset],64);
  const slots=Array.from({length:120},(_,i)=>i>=offset&&i<offset+100?0:-1);
  const greedy=searchCombos(board,58,25,4,99,"descending domino");
  assert.equal(greedy.score,EXPERIMENTAL_13_BENCHMARK);
  const result=searchLookaheadCombos(board,58,25,greedy);
  const checked=validateComboReplay(board,result.moves,58,25,slots);
  assert.equal(result.score,EXPERIMENTAL_13_BENCHMARK);
  assert.equal(checked.score,EXPERIMENTAL_13_BENCHMARK);
  assert.equal(checked.merges,93);
  assert.equal(checked.repositions,0);
  assert.equal(result.moves.reduce((n,m)=>n+m.events.filter(e=>e.kind==="wind").length,0),1925);
 });
}
test("Exp13 is gated on full-upgrade 100 contiguous slots at Tier 64",()=>{
 const pos=Array.from({length:100},(_,i)=>i);
 for(const [tier,cap,chain,protected64] of [[66,60,25,true],[63,57,25,false],
    [64,57,25,true],[64,58,24,true],[64,58,25,false]])
   assert.deepEqual(buildExperimental13Candidates(pos,tier,cap,chain,protected64),[]);
 assert.deepEqual(buildExperimental13Candidates([...pos,100],64,58,25,true),[]);
 assert.deepEqual(buildExperimental13Candidates(pos.map((p,i)=>i<50?p:p+1),64,58,25,true),[]);
});
