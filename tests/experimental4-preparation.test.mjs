import test from "node:test";
import assert from "node:assert/strict";
import {buildExperimental4Candidates,EXPERIMENTAL_4_BENCHMARK} from "../src/experimental4-preparation.mjs";
import {searchCombos} from "../src/merge-search.mjs";
import {validateComboReplay} from "../src/optimizer-core.mjs";

for(const offset of [0,20]){
 test("Experimental 4.0 reproduces 58,684 on 100 slots at offset "+offset,()=>{
  const positions=Array.from({length:100},(_,i)=>i+offset);
  const [candidate]=buildExperimental4Candidates(positions,64,58,25,true);
  assert.ok(candidate);
  const board=candidate.board;
  assert.equal(board.filter(t=>t>0).length,100);
  assert.equal(board.filter(t=>t===64).length,1);
  const slots=Array.from({length:120},(_,i)=>i>=offset&&i<offset+100?0:-1);
  const found=searchCombos(board,58,25,4,99,"descending domino");
  const verified=validateComboReplay(board,found.moves,58,25,slots);
  assert.equal(found.score,EXPERIMENTAL_4_BENCHMARK);
  assert.equal(verified.score,EXPERIMENTAL_4_BENCHMARK);
  assert.equal(verified.merges,88);
  assert.equal(verified.repositions,0);
  assert.equal(found.moves.reduce((n,m)=>n+m.events.filter(e=>e.kind==="wind").length,0),1483);
 });
}
test("Experimental 4.0 excludes invalid/unavailable configurations",()=>{
 const p=Array.from({length:100},(_,i)=>i);
 assert.equal(buildExperimental4Candidates(p,63,57,25,true).length,0);
 assert.equal(buildExperimental4Candidates(p,64,57,25,true).length,0);
 assert.equal(buildExperimental4Candidates(p,64,58,20,true).length,0);
 assert.equal(buildExperimental4Candidates(p,64,58,25,false).length,0);
 assert.equal(buildExperimental4Candidates([...p,100],64,58,25,true).length,0);
 assert.equal(buildExperimental4Candidates(p.map((v,i)=>i<50?v:v+1),64,58,25,true).length,0);
});
