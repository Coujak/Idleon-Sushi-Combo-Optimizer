import test from "node:test";
import assert from "node:assert/strict";
import {buildExperimental9Candidates,EXPERIMENTAL_9_BENCHMARK} from "../src/experimental9-preparation.mjs";
import {searchCombos} from "../src/merge-search.mjs";
import {validateComboReplay} from "../src/optimizer-core.mjs";

for(const offset of [0,20]){
  test("Experimental 9.0 breaks 70,000 with a replay-valid 100-sushi board at offset "+offset,()=>{
    const positions=Array.from({length:100},(_,i)=>i+offset);
    const [candidate]=buildExperimental9Candidates(positions,64,58,25,true);
    assert.ok(candidate);
    const board=candidate.board;
    assert.equal(board.length,120);
    assert.equal(board.filter(t=>t>0).length,100);
    assert.equal(board.filter(t=>t===64).length,1);
    assert.equal(board[offset],64);
    const slots=Array.from({length:120},(_,i)=>i>=offset&&i<offset+100?0:-1);
    const result=searchCombos(board,58,25,4,99,"descending domino");
    const replay=validateComboReplay(board,result.moves,58,25,slots);
    assert.equal(result.score,EXPERIMENTAL_9_BENCHMARK);
    assert.equal(replay.score,EXPERIMENTAL_9_BENCHMARK);
    assert.equal(replay.merges,91);
    assert.equal(replay.repositions,0);
    assert.equal(result.strategy,"East Wind chains");
    assert.equal(result.moves.reduce((n,m)=>n+m.events.filter(e=>e.kind==="wind").length,0),1851);
  });
}
test("Experimental 9.0 honors 100 unlocks, max-tier and Wind-cap restrictions",()=>{
  const positions=Array.from({length:100},(_,i)=>i);
  assert.equal(buildExperimental9Candidates(positions,63,57,25,true).length,0);
  assert.equal(buildExperimental9Candidates(positions,64,57,25,true).length,0);
  assert.equal(buildExperimental9Candidates(positions,64,58,24,true).length,0);
  assert.equal(buildExperimental9Candidates(positions,64,58,25,false).length,0);
  assert.equal(buildExperimental9Candidates([...positions,100],64,58,25,true).length,0);
  assert.equal(buildExperimental9Candidates(positions.map((p,i)=>i<50?p:p+1),64,58,25,true).length,0);
});
