import test from "node:test";
import assert from "node:assert/strict";
import {buildExperimental3Candidates,EXPERIMENTAL_3_BENCHMARK} from "../src/experimental3-preparation.mjs";
import {searchCombos} from "../src/merge-search.mjs";
import {validateComboReplay} from "../src/optimizer-core.mjs";

for(const offset of [0,20]){
 test("Experimental 3.0 replay: "+offset+"-position offset",()=>{
  const positions=Array.from({length:100},(_,i)=>i+offset);
  const [candidate]=buildExperimental3Candidates(positions,64,58,25,true);
  assert.ok(candidate);
  const board=candidate.board;
  assert.equal(board.filter(t=>t>0).length,100);
  assert.equal(board.filter(t=>t===64).length,1);
  assert.equal(board[offset],64);
  const slots=Array.from({length:120},(_,i)=>i>=offset&&i<offset+100?0:-1);
  const searched=searchCombos(board,58,25,4,99,"descending domino");
  const verified=validateComboReplay(board,searched.moves,58,25,slots);
  assert.equal(searched.score,EXPERIMENTAL_3_BENCHMARK);
  assert.equal(verified.score,EXPERIMENTAL_3_BENCHMARK);
  assert.equal(verified.merges,88);
  assert.equal(verified.repositions,0);
  assert.equal(searched.moves.reduce((sum,move)=>sum+move.events.filter(event=>event.kind==="wind").length,0),1418);
 });
}
test("Experimental 3.0 requires a legal full-upgrade contiguous 100-slot board",()=>{
 const p=Array.from({length:100},(_,i)=>i);
 assert.equal(buildExperimental3Candidates(p,63,57,25,true).length,0);
 assert.equal(buildExperimental3Candidates(p,64,57,25,true).length,0);
 assert.equal(buildExperimental3Candidates(p,64,58,20,true).length,0);
 assert.equal(buildExperimental3Candidates(p,64,58,25,false).length,0);
 assert.equal(buildExperimental3Candidates([...p,100],64,58,25,true).length,0);
 assert.equal(buildExperimental3Candidates(p.map((v,i)=>i<50?v:v+1),64,58,25,true).length,0);
});
