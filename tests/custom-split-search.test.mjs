import test from "node:test";
import assert from "node:assert/strict";
import {buildCustomSplitCandidates} from "../src/custom-split-search.mjs";

const positions=Array.from({length:100},(_,i)=>i);
for(const [mode,expected] of [
 ["optimizer1",5],["optimizer2",9],["optimizer3",19],["optimizer4",99]
]){
 for(const perSplit of [1,50,100]){
  test("Custom "+mode+" generates "+perSplit+" distinct boards per unique split",()=>{
   const candidates=buildCustomSplitCandidates(positions,64,58,25,0,true,mode,perSplit);
   const group=new Map();
   for(const candidate of candidates){
    assert.equal(candidate.board[0],64);
    assert.equal(candidate.board.length,120);
    assert.equal(candidate.board.filter(n=>n>0).length,100);
    assert.equal(candidate.board.filter(n=>n===64).length,1);
    assert.ok(candidate.board.slice(1,100).every(n=>n>=1&&n<=63));
    assert.ok(candidate.board.slice(1,candidate.supplyCount)
      .every((n,i,values)=>i===0||values[i-1]>=n));
    if(!group.has(candidate.splitPercent))group.set(candidate.splitPercent,new Set());
    const variants=group.get(candidate.splitPercent);
    assert.ok(!variants.has(candidate.board.join(",")),"Duplicate board at same split");
    variants.add(candidate.board.join(","));
   }
   assert.equal(group.size,expected);
   assert.equal(candidates.length,expected*perSplit);
   for(const variants of group.values())assert.equal(variants.size,perSplit);
  });
 }
}
test("Custom mode validates resolution and budget",()=>{
 assert.deepEqual(buildCustomSplitCandidates(positions,64,58,25,0,true,"other",50),[]);
 assert.deepEqual(buildCustomSplitCandidates(positions,64,58,25,0,true,"optimizer1",0),[]);
 assert.deepEqual(buildCustomSplitCandidates(positions,64,58,25,0,true,"optimizer1",1001),[]);
});
test("Custom mode is deterministic and preserves the prepared tier ceiling",()=>{
 const p=Array.from({length:40},(_,i)=>20+i);
 const first=buildCustomSplitCandidates(p,80,74,25,0,true,"optimizer1",75);
 const second=buildCustomSplitCandidates(p,80,74,25,0,true,"optimizer1",75);
 assert.deepEqual(first.map(c=>c.board),second.map(c=>c.board));
 for(const candidate of first){
  assert.equal(candidate.board[20],80);
  assert.ok(candidate.board.slice(21,60).every(n=>n>=1&&n<=79));
  assert.ok(candidate.board.slice(0,20).every(n=>n===0));
  assert.ok(candidate.board.slice(60).every(n=>n===0));
 }
});
