import test from "node:test";
import assert from "node:assert/strict";
import {buildTuned100Candidates} from "../src/tuned-preparation.mjs";
import {buildCandidates} from "../src/preparation-core.mjs";
import {getModeCandidates} from "../src/optimizer-modes.mjs";
import {searchCombos} from "../src/merge-search.mjs";
import {validateComboReplay} from "../src/optimizer-core.mjs";

const positions=Array.from({length:100},(_,i)=>i);
test("100-slot tuned board is legal and exceeds 50,000 in replay",()=>{
  const [candidate]=buildTuned100Candidates(positions,64,58,25,true);
  assert.ok(candidate);
  const board=candidate.board;
  assert.equal(board.length,120);
  assert.equal(board.filter(t=>t>0).length,100);
  assert.equal(board[0],64);
  assert.equal(board.filter(t=>t===64).length,1);
  assert.deepEqual(board.slice(100),Array(20).fill(0));
  const slots=Array.from({length:120},(_,i)=>i<100?0:-1);
  const result=searchCombos(board,58,25,4,99,"descending domino");
  assert.equal(result.score,51608);
  const replay=validateComboReplay(board,result.moves,58,25,slots);
  assert.equal(replay.score,51608);
  assert.equal(replay.merges,89);
  assert.equal(replay.repositions,0);
});
test("Experimental preserves the maximum of 100 unlocked slots",()=>{
  const invalid=Array.from({length:105},(_,i)=>i);
  assert.equal(buildTuned100Candidates(invalid,64,58,25,true).length,0);
  assert.equal(buildTuned100Candidates(positions,63,57,25,false).length,0);
  const baseline=buildCandidates(invalid,64,58);
  assert.equal(baseline.length,0);
  const experiment=getModeCandidates(invalid,64,58,0,25,true,"experimental");
  assert.equal(experiment.length,0);
});
test("tuned Wind preparation can occupy the last 100 grid positions",()=>{
  const positions=Array.from({length:100},(_,i)=>i+20);
  const [candidate]=buildTuned100Candidates(positions,64,58,25,true);
  assert.ok(candidate);
  assert.deepEqual(candidate.board.slice(0,20),Array(20).fill(0));
  assert.equal(candidate.board[20],64);
  assert.ok(candidate.board[119]>0);
  assert.equal(candidate.board.filter(t=>t>0).length,100);
  const result=searchCombos(candidate.board,58,25,4,99,"descending domino");
  const slots=Array.from({length:120},(_,i)=>i>=20?0:-1);
  const replay=validateComboReplay(candidate.board,result.moves,58,25,slots);
  assert.equal(replay.score,result.score);
  assert.equal(result.score,51608);
});
