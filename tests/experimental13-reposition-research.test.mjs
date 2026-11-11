import test from "node:test";
import assert from "node:assert/strict";
import {buildExperiment13RepositionResearch,EXPERIMENT13_REPOSITION_SCORE,
 EXPERIMENT13_REPOSITION_ACTIONS} from "../src/experimental13-reposition-research.mjs";
import {EXPERIMENTAL_13_BENCHMARK} from "../src/experimental13-preparation.mjs";
import {validateComboReplay,simulateMerge,simulateRelocation} from "../src/optimizer-core.mjs";
import {certifyComboMilestone} from "../src/combo-score-milestones.mjs";

for(const offset of [0,20]){
 test("Experiment 13 late-reposition research validates independently at offset "+offset,()=>{
  const result=buildExperiment13RepositionResearch(offset);
  assert.equal(result.score,EXPERIMENT13_REPOSITION_SCORE);
  assert.equal(result.improvement,113);
  assert.equal(result.score-EXPERIMENTAL_13_BENCHMARK,113);
  assert.equal(result.board.filter(t=>t>0).length,100);
  assert.equal(result.board.filter(t=>t===64).length,1);
  assert.equal(result.merges,95);
  assert.equal(result.repositions,3);
  assert.equal(result.windUpgrades,1925);
  assert.equal(result.moves.length,98);
  const slots=Array.from({length:120},(_,i)=>
   i>=offset&&i<offset+100?0:-1);
  const verified=validateComboReplay(result.board,result.moves,58,25,slots,64);
  assert.equal(verified.score,76645);
  assert.equal(verified.merges,95);
  assert.equal(verified.repositions,3);
  assert.ok(result.moves.every(action=>
   action.events.filter(event=>event.kind==="wind").length<=25));
  assert.deepEqual(result.moves.slice(75,78).map(move=>[move.src-offset,move.dst-offset]),
   EXPERIMENT13_REPOSITION_ACTIONS);
  assert.deepEqual(result.moves.slice(75,78).map(move=>move.kind),["move","move","move"]);
  assert.equal(verified.board.filter(t=>t>0).length,5);
  assert.throws(()=>certifyComboMilestone(result.board,result.moves,14,{offset}),
   /requires 80000 points/);
 });
}
test("The reposition candidate does not modify the original prepared template",()=>{
 const first=buildExperiment13RepositionResearch();
 const original=first.board.slice();
 const second=buildExperiment13RepositionResearch();
 assert.deepEqual(first.board,original);
 assert.deepEqual(second.board,original);
 assert.notEqual(first.moves[75].board,second.moves[75].board);
});
test("A fake move cannot inflate the 76,645 score",()=>{
 const result=buildExperiment13RepositionResearch();
 const slots=Array.from({length:120},(_,i)=>i<100?0:-1);
 const fake=result.moves.map(x=>x);
 fake[75]={...fake[75],board:fake[75].board.slice(),score:9999};
 assert.throws(()=>validateComboReplay(result.board,fake,58,25,slots,64),
  /Replay failed at action 76/);
});
