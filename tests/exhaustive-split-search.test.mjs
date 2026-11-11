import test from "node:test";
import assert from "node:assert/strict";
import {enumerateTierMultisets,enumerateSplitTierBoards} from "../src/exhaustive-split-search.mjs";

test("multiset enumeration is exhaustive and duplicate-free for small domains",()=>{
 const actual=[...enumerateTierMultisets(3,1,3)];
 assert.equal(actual.length,10); // combinations with repetition: C(5,3)
 assert.equal(new Set(actual.map(x=>x.join(","))).size,10);
 assert.ok(actual.every(x=>x.every((v,i)=>i===0||x[i-1]>=v)));
 assert.deepEqual(actual[0],[3,3,3]);
 assert.deepEqual(actual.at(-1),[1,1,1]);
});
test("every supply/engine multiset combination is visited",()=>{
 const positions=[4,5,6,7,8];
 const results=[...enumerateSplitTierBoards({
  positions,supplyCount:2,maxTier:3,minTier:1,protectedTier:3
 })];
 // Supply: one of 2 tiers. Engine: C(4,3)=4 multisets.
 assert.equal(results.length,8);
 assert.equal(new Set(results.map(x=>x.board.join(","))).size,8);
 assert.ok(results.every(x=>x.board[4]===3&&x.supplyCount===2&&
  x.engineCount===3&&x.board.slice(0,4).every(v=>v===0)));
});
test("empty tier multiset has exactly one configuration",()=>{
 assert.deepEqual([...enumerateTierMultisets(0,1,2)],[[]]);
});
