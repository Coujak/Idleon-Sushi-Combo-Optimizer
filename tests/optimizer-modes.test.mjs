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
test("Experimental 2.0 adds a new candidate without altering existing modes",()=>{
  const defaults=getModeCandidates(positions,64,58,0,25,true,"default");
  const oldExperimental=getModeCandidates(positions,64,58,0,25,true,"experimental");
  const second=getModeCandidates(positions,64,58,0,25,true,"experimental2");
  assert.equal(second.length,oldExperimental.length+1);
  assert.deepEqual(second.slice(0,oldExperimental.length),oldExperimental);
  assert.equal(second.at(-1).name,"Experimental 2.0 · Multi-wave Wind");
  assert.ok(defaults.every(c=>c.name!=="Experimental 2.0 · Multi-wave Wind"));
  assert.ok(oldExperimental.every(c=>c.name!=="Experimental 2.0 · Multi-wave Wind"));
});
test("Experimental 3.0 keeps previous modes intact",()=>{
  const defaults=getModeCandidates(positions,64,58,0,25,true,"default");
  const older=getModeCandidates(positions,64,58,0,25,true,"experimental");
  const second=getModeCandidates(positions,64,58,0,25,true,"experimental2");
  const third=getModeCandidates(positions,64,58,0,25,true,"experimental3");
  assert.equal(third.length,second.length+1);
  assert.deepEqual(third.slice(0,second.length),second);
  assert.equal(third.at(-1).name,"Experimental 3.0 · Layered multi-wave Wind");
  for(const group of [defaults,older,second]){
    assert.ok(group.every(candidate=>candidate.name!=="Experimental 3.0 · Layered multi-wave Wind"));
  }
});
test("Experimental 4.0 adds a new benchmark without changing earlier modes",()=>{
 const third=getModeCandidates(positions,64,58,0,25,true,"experimental3");
 const fourth=getModeCandidates(positions,64,58,0,25,true,"experimental4");
 assert.equal(fourth.length,third.length+1);
 assert.deepEqual(fourth.slice(0,third.length),third);
 assert.equal(fourth.at(-1).name,"Experimental 4.0 · Extended Wind reserves");
});
