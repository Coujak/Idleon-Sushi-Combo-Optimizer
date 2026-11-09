import test from "node:test";
import assert from "node:assert/strict";
import {buildExperimental7Candidates,EXPERIMENTAL_7_BENCHMARK} from "../src/experimental7-preparation.mjs";
import {searchCombos} from "../src/merge-search.mjs";
import {validateComboReplay} from "../src/optimizer-core.mjs";
for(const offset of [0,20]){
  test("Experimental 7.0 exceeds 65,000 with a valid replay at offset "+offset,()=>{
    const positions=Array.from({length:100},(_,i)=>i+offset);
    const [candidate]=buildExperimental7Candidates(positions,64,58,25,true);
    assert.ok(candidate);
    const board=candidate.board;
    assert.equal(board.filter(t=>t>0).length,100);
    assert.equal(board.filter(t=>t===64).length,1);
    assert.equal(board[offset],64);
    const slots=Array.from({length:120},(_,i)=>i>=offset&&i<offset+100?0:-1);
    const result=searchCombos(board,58,25,4,99,"descending domino");
    const verified=validateComboReplay(board,result.moves,58,25,slots);
    assert.equal(result.score,EXPERIMENTAL_7_BENCHMARK);
    assert.equal(verified.score,EXPERIMENTAL_7_BENCHMARK);
    assert.equal(verified.merges,85);
    assert.equal(verified.repositions,0);
    assert.equal(result.moves.reduce((n,m)=>n+m.events.filter(e=>e.kind==="wind").length,0),1759);
    assert.equal(result.strategy,"East Wind chains");
  });
}
test("Experimental 7.0 only runs on full-upgrade 100-slot contiguous preparations",()=>{
  const positions=Array.from({length:100},(_,i)=>i);
  assert.equal(buildExperimental7Candidates(positions,63,57,25,true).length,0);
  assert.equal(buildExperimental7Candidates(positions,64,57,25,true).length,0);
  assert.equal(buildExperimental7Candidates(positions,64,58,20,true).length,0);
  assert.equal(buildExperimental7Candidates(positions,64,58,25,false).length,0);
  assert.equal(buildExperimental7Candidates([...positions,100],64,58,25,true).length,0);
  assert.equal(buildExperimental7Candidates(positions.map((v,i)=>i<50?v:v+1),64,58,25,true).length,0);
});
