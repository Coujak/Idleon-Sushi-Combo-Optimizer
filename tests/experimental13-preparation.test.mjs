import test from "node:test";
import assert from "node:assert/strict";
import {buildExperimental13Candidates,EXPERIMENTAL_13_BENCHMARK} from "../src/experimental13-preparation.mjs";
import {searchCombos} from "../src/merge-search.mjs";
import {searchLookaheadCombos} from "../src/lookahead-search.mjs";
import {validateComboReplay} from "../src/optimizer-core.mjs";

for(const offset of [0,20]){
 test("Exp 13 Cascade Resonance replay at offset "+offset,()=>{
  const positions=Array.from({length:100},(_,i)=>i+offset);
  const [candidate]=buildExperimental13Candidates(positions,64,58,25,true);
  assert.ok(candidate);
  const board=candidate.board;
  assert.equal(board.length,120);
  assert.equal(board.filter(x=>x>0).length,100);
  assert.equal(board.filter(x=>x===64).length,1);
  assert.equal(board[offset],64);
  const slots=Array.from({length:120},(_,i)=>i>=offset&&i<offset+100?0:-1);
  const greedy=searchCombos(board,58,25,4,99,"descending domino");
  assert.equal(greedy.score,EXPERIMENTAL_13_BENCHMARK);
  const result=searchLookaheadCombos(board,58,25,greedy);
  const checked=validateComboReplay(board,result.moves,58,25,slots);
  assert.equal(result.score,EXPERIMENTAL_13_BENCHMARK);
  assert.equal(checked.score,EXPERIMENTAL_13_BENCHMARK);
  assert.equal(checked.merges,93);
  assert.equal(checked.repositions,0);
  assert.equal(result.moves.reduce((n,m)=>n+m.events.filter(e=>e.kind==="wind").length,0),1925);
  for(const [index,move] of result.moves.entries())
    assert.ok(move.events.filter(e=>e.kind==="wind").length<=25,
      "Step "+(index+1)+" exceeded the 25-upgrade Wind limit");
  // Reported problem step: T37 from position 23 to position 75 at offset 0.
  // The initial merge at position 75 is separate from the 25 Wind procs.
  const fortyFour=result.moves[43];
  assert.equal(fortyFour.src,offset+22);
  assert.equal(fortyFour.dst,offset+74);
  assert.equal(fortyFour.score,588);
  assert.equal(fortyFour.events[0].kind,"merge");
  assert.equal(fortyFour.events[0].at,offset+74);
  const wind=fortyFour.events.filter(e=>e.kind==="wind");
  assert.equal(wind.length,25);
  assert.deepEqual(wind.map(e=>e.at),
    Array.from({length:25},(_,i)=>offset+75+i));
  assert.equal(fortyFour.events.length,26);
  assert.equal(fortyFour.board[offset+99],10);
  assert.equal(fortyFour.board[offset+100]??0,0);
 });
}
test("Exp13 is gated on full-upgrade 100 contiguous slots at Tier 64",()=>{
 const pos=Array.from({length:100},(_,i)=>i);
 for(const [tier,cap,chain,protected64] of [[66,60,25,true],[63,57,25,false],
    [64,57,25,true],[64,58,24,true],[64,58,25,false]])
   assert.deepEqual(buildExperimental13Candidates(pos,tier,cap,chain,protected64),[]);
 assert.deepEqual(buildExperimental13Candidates([...pos,100],64,58,25,true),[]);
 assert.deepEqual(buildExperimental13Candidates(pos.map((p,i)=>i<50?p:p+1),64,58,25,true),[]);
});
