import test from "node:test";
import assert from "node:assert/strict";
import {getModeCandidates} from "../src/optimizer-modes.mjs";
import {throwIfCancelled,yieldToUI} from "../src/optimizer-run.mjs";

const positions=Array.from({length:100},(_,i)=>i);
test("Default never adds layered Wind preparations",()=>{
  const normal=getModeCandidates(positions,64,58,0,25,true,"default");
  assert.ok(normal.length>0);
  assert.equal(normal.some(c=>c.shape==="layered Wind reserves"),false);
});
test("Experimental includes default candidates and the layered setup",()=>{
  const normal=getModeCandidates(positions,64,58,0,25,true,"default");
  const experimental=getModeCandidates(positions,64,58,0,25,true,"experimental");
  assert.equal(experimental.length,normal.length+2);
  assert.deepEqual(experimental.slice(0,normal.length),normal);
  assert.equal(experimental.at(-2).shape,"layered Wind reserves");
  assert.equal(experimental.at(-1).shape,"tuned Wind reserves");
});
test("Experimental respects selected base and unsupported boards",()=>{
  const selected=getModeCandidates(positions,64,58,32,25,true,"experimental");
  assert.equal(selected.some(c=>c.shape==="layered Wind reserves"),false);
  const limited=getModeCandidates(positions,63,57,0,25,false,"experimental");
  assert.equal(limited.some(c=>c.shape==="layered Wind reserves"),false);
});
test("Cancellation stops processing at asynchronous checkpoints",async()=>{
  const controller=new AbortController();
  throwIfCancelled(controller.signal);
  await yieldToUI(controller.signal);
  controller.abort();
  assert.throws(()=>throwIfCancelled(controller.signal),{name:"AbortError"});
  await assert.rejects(yieldToUI(controller.signal),{name:"AbortError"});
});
