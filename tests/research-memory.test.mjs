import test from "node:test";
import assert from "node:assert/strict";
import {researchContext,researchBoardKey,loadResearchHistory,
 rememberEvaluatedBoards,rememberBestCandidate,resetResearchHistory}
 from "../src/research-memory.mjs";

const slots=Array.from({length:120},(_,i)=>i<100?0:-1);
test("Research identity separates game-rule changes, not optimizer modes",()=>{
 const original={maxTier:64,cap:58,chain:25,selectedBase:0,protectHighest:true,slots};
 const a=researchContext(original);
 assert.equal(a,researchContext({...original}));
 assert.notEqual(a,researchContext({...original,maxTier:80,cap:74}));
 assert.notEqual(a,researchContext({...original,chain:24}));
 assert.notEqual(a,researchContext({...original,selectedBase:10}));
 assert.notEqual(a,researchContext({...original,slots:[...slots].reverse()}));
});
test("Research memory records exact evaluated boards and retains the highest best",async()=>{
 await resetResearchHistory();
 const context=researchContext({maxTier:64,cap:58,chain:25,
  selectedBase:0,protectHighest:true,slots});
 const boardA=[64,...Array(99).fill(15),...Array(20).fill(0)];
 const boardB=[64,...Array(99).fill(16),...Array(20).fill(0)];
 const keyA=researchBoardKey(boardA),keyB=researchBoardKey(boardB);
 await rememberEvaluatedBoards([{context,key:keyA},{context,key:keyB}]);
 const saved=await loadResearchHistory(context);
 assert.ok(saved.seen.has(keyA)&&saved.seen.has(keyB));
 const best={board:boardA,search:{score:30000,remaining:12,moves:[],board:boardA}};
 await rememberBestCandidate(context,best);
 await rememberBestCandidate(context,{...best,search:{...best.search,score:20000}});
 assert.equal((await loadResearchHistory(context)).best.search.score,30000);
 await rememberBestCandidate(context,{...best,board:boardB,
  search:{...best.search,score:31000,board:boardB}});
 assert.equal((await loadResearchHistory(context)).best.search.score,31000);
 await resetResearchHistory();
 const erased=await loadResearchHistory(context);
 assert.equal(erased.seen.size,0);
 assert.equal(erased.best,null);
});
