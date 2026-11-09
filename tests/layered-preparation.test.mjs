import test from "node:test";
import assert from "node:assert/strict";
import {buildLayeredCandidates} from "../src/layered-preparation.mjs";
import {searchCombos} from "../src/merge-search.mjs";
import {validateComboReplay} from "../src/optimizer-core.mjs";

function layout(count){
  const board=Array(120).fill(-1);
  for(let i=0;i<count;i++)board[i]=0;
  return {positions:Array.from({length:count},(_,i)=>i),slots:board};
}
test("100-slot layered preparation remains legal and replayable",()=>{
  const {positions,slots}=layout(100);
  const candidates=buildLayeredCandidates(positions,64,58,25,true);
  assert.equal(candidates.length,1);
  const {board}=candidates[0];
  assert.equal(board.filter(t=>t>0).length,100);
  assert.equal(board[0],64);
  assert.equal(board.filter(t=>t===64).length,1);
  assert.ok(board.slice(1).every(t=>t>=1&&t<64));
  const result=searchCombos(board,58,25,4,99,"descending domino");
  assert.equal(result.score,49771);
  const replay=validateComboReplay(board,result.moves,58,25,slots);
  assert.equal(replay.score,49771);
  assert.equal(replay.merges,89);
  assert.equal(replay.repositions,0);
});
test("layered preparation supports slots in the bottom row",()=>{
  const {positions}=layout(90);
  const shifted=positions.map(i=>i+30);
  const candidate=buildLayeredCandidates(shifted,64,58,25,true)[0];
  assert.ok(candidate);
  assert.equal(candidate.board[30],64);
  assert.equal(candidate.board.filter(t=>t>0).length,90);
  assert.equal(candidate.board.filter(t=>t===64).length,1);
  assert.ok(candidate.board[119]>0);
});
test("layered preparation skips locked gaps or incompatible upgrades",()=>{
  const {positions}=layout(100);
  assert.equal(buildLayeredCandidates(positions,63,57,25,false).length,0);
  assert.equal(buildLayeredCandidates(positions,64,58,20,true).length,0);
  const gapped=positions.map((x,i)=>i>40?x+1:x);
  assert.equal(buildLayeredCandidates(gapped,64,58,25,true).length,0);
});
