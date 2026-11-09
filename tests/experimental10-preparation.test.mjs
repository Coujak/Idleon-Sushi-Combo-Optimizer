import test from "node:test";
import assert from "node:assert/strict";
import {buildExperimental10Candidates,EXPERIMENTAL_10_BENCHMARK} from "../src/experimental10-preparation.mjs";
import {searchCombos} from "../src/merge-search.mjs";
import {validateComboReplay} from "../src/optimizer-core.mjs";

for(const offset of [0,20]){
  test("Experimental 10.0 reproduces 73,367 and validates its replay at offset "+offset,()=>{
    const positions=Array.from({length:100},(_,i)=>i+offset);
    const [candidate]=buildExperimental10Candidates(positions,64,58,25,true);
    assert.ok(candidate);
    const board=candidate.board;
    assert.equal(board.length,120);
    assert.equal(board.filter(t=>t>0).length,100);
    assert.equal(board.filter(t=>t===64).length,1);
    assert.equal(board[offset],64);
    const slots=Array.from({length:120},(_,i)=>i>=offset&&i<offset+100?0:-1);
    const result=searchCombos(board,58,25,4,99,"descending domino");
    const validated=validateComboReplay(board,result.moves,58,25,slots);
    assert.equal(result.score,EXPERIMENTAL_10_BENCHMARK);
    assert.equal(validated.score,EXPERIMENTAL_10_BENCHMARK);
    assert.equal(validated.merges,92);
    assert.equal(validated.repositions,0);
    assert.equal(result.strategy,"East Wind chains");
    assert.equal(result.moves.reduce((n,m)=>n+m.events.filter(e=>e.kind==="wind").length,0),1871);
  });
}
test("Experimental 10.0 requires 100 consecutive slots and compatible full upgrades",()=>{
  const positions=Array.from({length:100},(_,i)=>i);
  assert.equal(buildExperimental10Candidates(positions,63,57,25,true).length,0);
  assert.equal(buildExperimental10Candidates(positions,64,57,25,true).length,0);
  assert.equal(buildExperimental10Candidates(positions,64,58,24,true).length,0);
  assert.equal(buildExperimental10Candidates(positions,64,58,25,false).length,0);
  assert.equal(buildExperimental10Candidates([...positions,100],64,58,25,true).length,0);
  assert.equal(buildExperimental10Candidates(positions.map((p,i)=>i<50?p:p+1),64,58,25,true).length,0);
});
