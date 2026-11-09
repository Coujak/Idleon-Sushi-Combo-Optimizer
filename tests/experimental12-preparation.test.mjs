import test from "node:test";
import assert from "node:assert/strict";
import {buildExperimental12Candidates,EXPERIMENTAL_12_BENCHMARK,EXPERIMENTAL_12_GREEDY} from "../src/experimental12-preparation.mjs";
import {searchCombos} from "../src/merge-search.mjs";
import {searchLookaheadCombos} from "../src/lookahead-search.mjs";
import {validateComboReplay} from "../src/optimizer-core.mjs";

for(const offset of [0,20]){
  test("Experimental 12.0 reaches 75,546 after bounded lookahead at offset "+offset,()=>{
    const positions=Array.from({length:100},(_,i)=>i+offset);
    const [candidate]=buildExperimental12Candidates(positions,64,58,25,true);
    assert.ok(candidate);
    const board=candidate.board;
    assert.equal(board.length,120);
    assert.equal(board.filter(t=>t>0).length,100);
    assert.equal(board.filter(t=>t===64).length,1);
    assert.equal(board[offset],64);
    const slots=Array.from({length:120},(_,i)=>i>=offset&&i<offset+100?0:-1);
    const greedy=searchCombos(board,58,25,4,99,"descending domino");
    assert.equal(greedy.score,EXPERIMENTAL_12_GREEDY);
    const result=searchLookaheadCombos(board,58,25,greedy);
    const replay=validateComboReplay(board,result.moves,58,25,slots);
    assert.equal(result.score,EXPERIMENTAL_12_BENCHMARK);
    assert.equal(replay.score,EXPERIMENTAL_12_BENCHMARK);
    assert.equal(replay.merges,96);
    assert.equal(replay.repositions,0);
    assert.equal(result.moves.reduce((n,m)=>n+m.events.filter(e=>e.kind==="wind").length,0),1881);
    assert.equal(result.strategy,"Deeper East Wind lookahead");
  });
}
test("Experimental 12.0 is gated on 100 consecutive, full-upgrade slots",()=>{
  const positions=Array.from({length:100},(_,i)=>i);
  assert.equal(buildExperimental12Candidates(positions,63,57,25,true).length,0);
  assert.equal(buildExperimental12Candidates(positions,64,57,25,true).length,0);
  assert.equal(buildExperimental12Candidates(positions,64,58,24,true).length,0);
  assert.equal(buildExperimental12Candidates(positions,64,58,25,false).length,0);
  assert.equal(buildExperimental12Candidates([...positions,100],64,58,25,true).length,0);
  assert.equal(buildExperimental12Candidates(positions.map((p,i)=>i<50?p:p+1),64,58,25,true).length,0);
});
