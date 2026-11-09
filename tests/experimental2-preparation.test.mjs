import test from "node:test";
import assert from "node:assert/strict";
import {buildExperimental2Candidates,EXPERIMENTAL_2_BENCHMARK} from "../src/experimental2-preparation.mjs";
import {searchCombos} from "../src/merge-search.mjs";
import {validateComboReplay} from "../src/optimizer-core.mjs";
const offsets=[0,20];
for(const offset of offsets){
  test("Experimental 2.0 reproduces 56,315 points at board offset "+offset,()=>{
    const positions=Array.from({length:100},(_,i)=>i+offset);
    const candidates=buildExperimental2Candidates(positions,64,58,25,true);
    assert.equal(candidates.length,1);
    const board=candidates[0].board;
    assert.equal(board.filter(t=>t>0).length,100);
    assert.equal(board.filter(t=>t===64).length,1);
    assert.equal(board[offset],64);
    const slots=Array.from({length:120},(_,i)=>i>=offset&&i<offset+100?0:-1);
    const result=searchCombos(board,58,25,4,99,"descending domino");
    const replay=validateComboReplay(board,result.moves,58,25,slots);
    assert.equal(result.score,EXPERIMENTAL_2_BENCHMARK);
    assert.equal(replay.score,EXPERIMENTAL_2_BENCHMARK);
    assert.equal(replay.merges,88);
    assert.equal(replay.repositions,0);
    assert.equal(result.moves.reduce((n,m)=>n+m.events.filter(e=>e.kind==="wind").length,0),1373);
  });
}
test("Experimental 2.0 requires a legal contiguous full-upgrade setup",()=>{
  const positions=Array.from({length:100},(_,i)=>i);
  assert.equal(buildExperimental2Candidates(positions,63,57,25,true).length,0);
  assert.equal(buildExperimental2Candidates(positions,64,57,25,true).length,0);
  assert.equal(buildExperimental2Candidates(positions,64,58,20,true).length,0);
  assert.equal(buildExperimental2Candidates(positions,64,58,25,false).length,0);
  assert.equal(buildExperimental2Candidates(Array.from({length:101},(_,i)=>i),64,58,25,true).length,0);
  assert.equal(buildExperimental2Candidates(positions.map((i)=>i>=50?i+1:i),64,58,25,true).length,0);
});
