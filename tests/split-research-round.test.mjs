import test from "node:test";
import assert from "node:assert/strict";
import {buildNovelSplitCandidates} from "../src/split-research-round.mjs";
import {buildSplitComboCandidates} from "../src/combo-split-strategies.mjs";
import {researchBoardKey} from "../src/research-memory.mjs";

const positions=Array.from({length:100},(_,i)=>i);
const base=buildSplitComboCandidates(positions,64,58,25,0,true,"optimizer1");
test("Repeated runs generate a new batch with no previously checked boards",()=>{
 const first=buildNovelSplitCandidates(base,positions,64,0,50,{seen:new Set(),best:null});
 assert.equal(first.length,250); // 5 unique split ratios, 50 per ratio
 const seen=new Set(first.map(c=>researchBoardKey(c.board)));
 assert.equal(seen.size,first.length);
 const second=buildNovelSplitCandidates(base,positions,64,0,50,{seen,best:null});
 assert.equal(second.length,250);
 assert.ok(second.every(c=>!seen.has(researchBoardKey(c.board))));
 assert.equal(new Set(second.map(c=>researchBoardKey(c.board))).size,250);
});
test("Candidate generation can exploit previous best without replaying it",()=>{
 const first=buildNovelSplitCandidates(base,positions,64,0,50,{seen:new Set(),best:null});
 const selected=first.find(x=>x.splitPercent===30);
 const seen=new Set(first.map(c=>researchBoardKey(c.board)));
 const history={seen,best:{...selected,search:{score:55000,remaining:10}}};
 const next=buildNovelSplitCandidates(base,positions,64,0,50,history);
 assert.equal(next.length,250);
 assert.ok(next.every(c=>!seen.has(researchBoardKey(c.board))));
 assert.ok(next.some(c=>c.splitPercent===30&&c.variant==="incremental search"));
});
test("Each unique split gets its own budget; 50/50 is not counted twice",()=>{
 for(const perSplit of [1,25,50,75]){
  const found=buildNovelSplitCandidates(base,positions,64,0,perSplit,{seen:new Set(),best:null});
  const bySplit=new Map();
  for(const candidate of found){
   bySplit.set(candidate.splitPercent,(bySplit.get(candidate.splitPercent)??0)+1);
  }
  assert.deepEqual([...bySplit.keys()].sort((a,b)=>a-b),[10,30,50,70,90]);
  assert.ok([...bySplit.values()].every(n=>n===perSplit));
 }
});
test("Future unlocked tiers are not treated as T64-only boards",()=>{
 const maxTier=80,cap=74;
 const generated=buildSplitComboCandidates(positions,maxTier,cap,25,0,true,"optimizer1");
 const found=buildNovelSplitCandidates(generated,positions,maxTier,0,50,{seen:new Set(),best:null});
 assert.equal(found.length,250);
 assert.ok(found.every(candidate=>candidate.board[0]===80&&
  candidate.board.slice(1,100).every(tier=>tier>=1&&tier<80)));
});
