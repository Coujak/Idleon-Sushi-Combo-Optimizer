import test from "node:test";
import assert from "node:assert/strict";
import {buildExperimental13Candidates} from "../src/experimental13-preparation.mjs";
import {validateComboReplay} from "../src/optimizer-core.mjs";

// Exercise the actual module Worker message handler without a browser by
// installing the same minimal self.postMessage API before importing it.
test("Split search Worker reproduces the validated Exp 13 24/76 score",async()=>{
 const previousSelf=globalThis.self;
 const outbound=[];
 globalThis.self={postMessage:message=>outbound.push(message)};
 try{
  await import("../src/split-search-worker.mjs?regression=experiment13");
  const positions=Array.from({length:100},(_,i)=>i);
  const slots=Array.from({length:120},(_,i)=>i<100?0:-1);
  const [benchmark]=buildExperimental13Candidates(positions,64,58,25,true);
  globalThis.self.onmessage({data:{type:"evaluate",
   candidates:[{...benchmark,slots,splitDirection:"engine",splitPercent:24}],
   cap:58,chain:25,mode:"descending domino",maxTier:64}});
  assert.equal(outbound.length,1);
  const message=outbound[0];
  assert.equal(message.type,"progress");
  assert.equal(message.processed,1);
  assert.equal(message.bestScore,76532);
  assert.equal(message.splitPercent,24);
  const search=message.improved.search;
  const replay=validateComboReplay(benchmark.board,search.moves,58,25,slots,64);
  assert.equal(replay.score,76532);
  assert.equal(replay.merges,93);
  assert.equal(search.moves.reduce((count,move)=>
   count+move.events.filter(event=>event.kind==="wind").length,0),1925);
 }finally{
  if(previousSelf===undefined)delete globalThis.self;
  else globalThis.self=previousSelf;
 }
});
