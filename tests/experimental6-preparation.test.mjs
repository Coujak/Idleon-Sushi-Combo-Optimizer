import test from "node:test";
import assert from "node:assert/strict";
import {buildExperimental6Candidates,EXPERIMENTAL_6_BENCHMARK} from "../src/experimental6-preparation.mjs";
import {searchCombos} from "../src/merge-search.mjs";
import {validateComboReplay} from "../src/optimizer-core.mjs";

for(const offset of [0,20]){
  test("Experimental 6.0 reproduces 64,017 on a legal 100-slot layout at offset "+offset,()=>{
    const positions=Array.from({length:100},(_,i)=>i+offset);
    const [candidate]=buildExperimental6Candidates(positions,64,58,25,true);
    assert.ok(candidate);
    const board=candidate.board;
    assert.equal(board.filter(t=>t>0).length,100);
    assert.equal(board.filter(t=>t===64).length,1);
    assert.equal(board[offset],64);
    const slots=Array.from({length:120},(_,i)=>i>=offset&&i<offset+100?0:-1);
    const result=searchCombos(board,58,25,4,99,"descending domino");
    const checked=validateComboReplay(board,result.moves,58,25,slots);
    assert.equal(result.score,EXPERIMENTAL_6_BENCHMARK);
    assert.equal(checked.score,EXPERIMENTAL_6_BENCHMARK);
    assert.equal(checked.merges,85);
    assert.equal(checked.repositions,0);
    assert.equal(result.moves.reduce((n,m)=>n+m.events.filter(e=>e.kind==="wind").length,0),1709);
  });
}
test("Experimental 6.0 only uses 100 contiguous unlocked positions with full upgrades",()=>{
  const positions=Array.from({length:100},(_,i)=>i);
  assert.equal(buildExperimental6Candidates(positions,63,57,25,true).length,0);
  assert.equal(buildExperimental6Candidates(positions,64,57,25,true).length,0);
  assert.equal(buildExperimental6Candidates(positions,64,58,20,true).length,0);
  assert.equal(buildExperimental6Candidates(positions,64,58,25,false).length,0);
  assert.equal(buildExperimental6Candidates([...positions,100],64,58,25,true).length,0);
  assert.equal(buildExperimental6Candidates(positions.map((v,i)=>i<50?v:v+1),64,58,25,true).length,0);
});
