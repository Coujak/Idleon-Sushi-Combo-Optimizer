import test from "node:test";
import assert from "node:assert/strict";
import {replayPosition,summarizeReplayMove,buildReplayGuide,nextWindReplayStep}
 from "../src/replay-guide.mjs";
import {buildExperimental13Candidates} from "../src/experimental13-preparation.mjs";
import {searchCombos} from "../src/merge-search.mjs";
import {validateComboReplay} from "../src/optimizer-core.mjs";

test("Step directions use one-based position and correct row/column",()=>{
 assert.deepEqual(replayPosition(0),{position:1,row:1,column:1});
 assert.deepEqual(replayPosition(14),{position:15,row:1,column:15});
 assert.deepEqual(replayPosition(15),{position:16,row:2,column:1});
 assert.deepEqual(replayPosition(119),{position:120,row:8,column:15});
 assert.throws(()=>replayPosition(-1),/Invalid/);
});
test("Merge instructions say which tier to combine and describe Wind results",()=>{
 const before=Array(120).fill(0);before[16]=11;before[31]=11;
 const move={kind:"merge",src:16,dst:31,score:25,
  events:[{kind:"merge",at:31,tier:12},{kind:"wind",at:32,tier:13}],
  board:before.slice()};
 const described=summarizeReplayMove(move,before);
 assert.equal(described.fromTier,11);
 assert.equal(described.toTier,12);
 assert.equal(described.windUpgrades,1);
 assert.equal(described.windPoints,13);
 assert.equal(described.mergePoints,12);
 assert.match(described.instruction,/position 17 \(R2 C2\)/);
 assert.match(described.instruction,/position 32 \(R3 C2\)/);
 assert.match(described.outcome,/1 Wind upgrades/);
});
test("Relocations always say empty destination and zero added points",()=>{
 const before=[10,0,12];const after=[0,10,12];
 const guide=buildReplayGuide(before,[{kind:"move",src:0,dst:1,tier:10,score:0,events:[],board:after}],3);
 assert.equal(guide[0].kind,"move");
 assert.equal(guide[0].step,1);
 assert.equal(guide[0].score,0);
 assert.match(guide[0].instruction,/empty position 2/);
 assert.match(guide[0].outcome,/no combo points/);
});
test("Next Wind navigation finds the first Wind merge strictly after current state",()=>{
 const m=[
  {events:[]},{events:[{kind:"merge"},{kind:"wind"}]},
  {events:[]},{events:[{kind:"wind"}]}
 ];
 assert.equal(nextWindReplayStep(m,0),2);
 assert.equal(nextWindReplayStep(m,2),4);
 assert.equal(nextWindReplayStep(m,4),null);
});
test("Experiment 13 guide describes all replay-valid actions without changing score",()=>{
 const positions=Array.from({length:100},(_,i)=>i);
 const slots=Array.from({length:120},(_,i)=>i<100?0:-1);
 const [candidate]=buildExperimental13Candidates(positions,64,58,25,true);
 const result=searchCombos(candidate.board,58,25,4,99,"descending domino",64);
 const moves=buildReplayGuide(candidate.board,result.moves);
 const checked=validateComboReplay(candidate.board,result.moves,58,25,slots,64);
 assert.equal(result.score,76532);
 assert.equal(checked.score,76532);
 assert.equal(moves.length,result.moves.length);
 assert.equal(moves.filter(m=>m.kind==="merge").length,93);
 assert.ok(moves.every((m,index)=>m.score===result.moves[index].score&&
  m.source.position===result.moves[index].src+1&&
  m.destination.position===result.moves[index].dst+1));
 assert.equal(moves.reduce((sum,m)=>sum+m.score,0),result.score);
 assert.equal(moves.reduce((sum,m)=>sum+m.windUpgrades,0),1925);
});
