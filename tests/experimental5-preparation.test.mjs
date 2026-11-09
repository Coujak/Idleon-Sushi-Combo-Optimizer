import test from "node:test";
import assert from "node:assert/strict";
import {buildExperimental5Candidates,EXPERIMENTAL_5_BENCHMARK} from "../src/experimental5-preparation.mjs";
import {searchCombos} from "../src/merge-search.mjs";
import {validateComboReplay} from "../src/optimizer-core.mjs";

for(const offset of [0,20]){
 test("Experimental 5.0 score and complete Wind replay at offset "+offset,()=>{
  const positions=Array.from({length:100},(_,i)=>i+offset);
  const [candidate]=buildExperimental5Candidates(positions,64,58,25,true);
  assert.ok(candidate);
  const {board}=candidate;
  assert.equal(board.length,120);
  assert.equal(board.filter(t=>t>0).length,100);
  assert.equal(board.filter(t=>t===64).length,1);
  assert.equal(board[offset],64);
  const slots=Array.from({length:120},(_,i)=>i>=offset&&i<offset+100?0:-1);
  const result=searchCombos(board,58,25,4,99,"descending domino");
  const checked=validateComboReplay(board,result.moves,58,25,slots);
  assert.equal(result.score,EXPERIMENTAL_5_BENCHMARK);
  assert.equal(checked.score,EXPERIMENTAL_5_BENCHMARK);
  assert.equal(checked.merges,88);
  assert.equal(checked.repositions,0);
  const totalWind=result.moves.reduce((n,m)=>n+m.events.filter(e=>e.kind==="wind").length,0);
  assert.equal(totalWind,1595);
 });
}
test("Experimental 5.0 requires 100 continuous slots and the tested upgrades",()=>{
 const positions=Array.from({length:100},(_,i)=>i);
 assert.equal(buildExperimental5Candidates(positions,63,57,25,true).length,0);
 assert.equal(buildExperimental5Candidates(positions,64,57,25,true).length,0);
 assert.equal(buildExperimental5Candidates(positions,64,58,20,true).length,0);
 assert.equal(buildExperimental5Candidates(positions,64,58,25,false).length,0);
 assert.equal(buildExperimental5Candidates([...positions,100],64,58,25,true).length,0);
 assert.equal(buildExperimental5Candidates(positions.map((p,i)=>i<50?p:p+1),64,58,25,true).length,0);
});
