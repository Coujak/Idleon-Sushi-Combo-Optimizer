import test from "node:test";
import assert from "node:assert/strict";
import {researchContext,rememberEvaluatedBoards,rememberBestCandidate,
 loadResearchHistory,exportResearchData,importResearchData,resetResearchHistory}
 from "../src/research-memory.mjs";

const slots=Array.from({length:120},(_,i)=>i<100?0:-1);
const context=researchContext({maxTier:64,cap:58,chain:25,
 selectedBase:0,protectHighest:true,slots});
const board=[64,...Array(99).fill(12),...Array(20).fill(0)];
test("Export/import preserves checked fingerprints and best score",async()=>{
 await resetResearchHistory();
 await rememberEvaluatedBoards([{context,key:board.join(",")}]);
 const candidate={board,slots,search:{score:400,remaining:8,board,moves:[]}};
 await rememberBestCandidate(context,candidate);
 const exported=await exportResearchData();
 assert.equal(exported.checked.length,1);
 assert.equal(exported.best.length,1);
 assert.equal(exported.format,"idleon-sushi-research");
 assert.equal(JSON.stringify(exported).includes('"Sushi":'),false);
 await resetResearchHistory();
 const result=await importResearchData(exported,()=>true);
 assert.deepEqual(result,{checked:1,best:1});
 const restored=await loadResearchHistory(context);
 assert.equal(restored.seen.size,1);
 assert.equal(restored.best.search.score,400);
 await resetResearchHistory();
});
test("Import rejects malformed board keys and unverifiable best scores",async()=>{
 await resetResearchHistory();
 const base={format:"idleon-sushi-research",version:1,checked:[],best:[]};
 await assert.rejects(importResearchData({...base,
  checked:[{context,key:"bad-board"}]},()=>true),/invalid/);
 await assert.rejects(importResearchData({...base,
  best:[{context,candidate:{board,search:{score:999999999}}}]},()=>false),/invalid/);
 const after=await loadResearchHistory(context);
 assert.equal(after.seen.size,0);
 assert.equal(after.best,null);
});
