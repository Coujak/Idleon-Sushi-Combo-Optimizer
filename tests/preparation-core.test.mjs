import test from "node:test";
import assert from "node:assert/strict";
import {buildCandidates} from "../src/preparation-core.mjs";

test("Tier 64 is preserved at the first unlocked position in auto preparations",()=>{
  const positions=Array.from({length:100},(_,i)=>i);
  const candidates=buildCandidates(positions,64,58);
  assert.ok(candidates.length>20);
  for(const candidate of candidates){
    assert.equal(candidate.board[0],64);
    assert.equal(candidate.board.filter(t=>t===64).length,1);
    assert.ok(candidate.board.slice(1).every(t=>t<=63));
  }
});
test("noncontiguous positions preserve the same number of sushi and one Tier 64",()=>{
  const positions=[32,8,17,45,20,52,119];
  const candidates=buildCandidates(positions,64,58,32);
  assert.ok(candidates.length>0);
  for(const candidate of candidates){
    assert.equal(candidate.board[8],64);
    assert.equal(candidate.board.filter(t=>t===64).length,1);
    assert.equal(candidate.board.filter(t=>t>0).length,positions.length-1);
    for(let i=0;i<120;i++)if(i>=100||!positions.includes(i))assert.equal(candidate.board[i],0);
  }
});
test("no permanent Tier 64 is invented below Tier 64",()=>{
  const candidates=buildCandidates([0,1,2,3],63,57,62);
  assert.ok(candidates.length>0);
  for(const candidate of candidates){
    assert.equal(candidate.board.filter(t=>t===64).length,0);
    assert.equal(candidate.board.filter(t=>t>0).length,4);
  }
});
test("an imported Tier 64 remains protected when recommended preparation max is lower",()=>{
  const candidates=buildCandidates([0,1,2,3,4],60,54,57,25,true);
  assert.ok(candidates.length>0);
  for(const candidate of candidates){
    assert.equal(candidate.board[0],64);
    assert.equal(candidate.board.filter(t=>t===64).length,1);
    assert.ok(candidate.board.slice(1).every(t=>t<=60));
  }
});
