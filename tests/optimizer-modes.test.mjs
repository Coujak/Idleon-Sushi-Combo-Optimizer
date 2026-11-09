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
test("Experimental 5.0 includes older candidates plus one verified 60,572-point layout",()=>{
 const before=getModeCandidates(positions,64,58,0,25,true,"experimental4");
 const newest=getModeCandidates(positions,64,58,0,25,true,"experimental5");
 assert.equal(newest.length,before.length+1);
 assert.deepEqual(newest.slice(0,before.length),before);
 assert.equal(newest.at(-1).name,"Experimental 5.0 · Extended Tier 12–34 Wind reserves");
 assert.ok(getModeCandidates(positions,64,58,0,25,true,"default")
   .every(candidate=>candidate.name!==newest.at(-1).name));
});
test("Experimental 6.0 retains all earlier candidates and adds one new layout",()=>{
  const old=getModeCandidates(positions,64,58,0,25,true,"experimental5");
  const newest=getModeCandidates(positions,64,58,0,25,true,"experimental6");
  assert.equal(newest.length,old.length+1);
  assert.deepEqual(newest.slice(0,old.length),old);
  assert.equal(newest.at(-1).name,"Experimental 6.0 · Extended third Wind wave");
  assert.ok(getModeCandidates(positions,64,58,0,25,true,"default")
    .every(candidate=>candidate.name!==newest.at(-1).name));
});
test("Experimental 7.0 preserves older benchmarks and adds the 65K preparation",()=>{
  const previous=getModeCandidates(positions,64,58,0,25,true,"experimental6");
  const newMode=getModeCandidates(positions,64,58,0,25,true,"experimental7");
  assert.equal(newMode.length,previous.length+1);
  assert.deepEqual(newMode.slice(0,previous.length),previous);
  assert.equal(newMode.at(-1).name,"Experimental 7.0 · 65K Wind chains");
  assert.ok(getModeCandidates(positions,64,58,0,25,true,"default")
    .every(candidate=>candidate.name!==newMode.at(-1).name));
});
test("Experimental 8.0 retains all prior preparations and adds the new benchmark",()=>{
  const prior=getModeCandidates(positions,64,58,0,25,true,"experimental7");
  const latest=getModeCandidates(positions,64,58,0,25,true,"experimental8");
  assert.equal(latest.length,prior.length+1);
  assert.deepEqual(latest.slice(0,prior.length),prior);
  assert.equal(latest.at(-1).name,"Experimental 8.0 · 68K Wind chains");
  assert.ok(getModeCandidates(positions,64,58,0,25,true,"default")
    .every(c=>c.name!==latest.at(-1).name));
});
test("Experimental 9.0 adds a record without changing older mode candidates",()=>{
  const previous=getModeCandidates(positions,64,58,0,25,true,"experimental8");
  const latest=getModeCandidates(positions,64,58,0,25,true,"experimental9");
  assert.equal(latest.length,previous.length+1);
  assert.deepEqual(latest.slice(0,previous.length),previous);
  assert.equal(latest.at(-1).name,"Experimental 9.0 · 70K Wind chains");
  assert.ok(getModeCandidates(positions,64,58,0,25,true,"default")
    .every(candidate=>candidate.name!==latest.at(-1).name));
});
test("Experimental 10.0 includes all previous layouts plus a new verified preparation",()=>{
  const prior=getModeCandidates(positions,64,58,0,25,true,"experimental9");
  const latest=getModeCandidates(positions,64,58,0,25,true,"experimental10");
  assert.equal(latest.length,prior.length+1);
  assert.deepEqual(latest.slice(0,prior.length),prior);
  assert.equal(latest.at(-1).name,"Experimental 10.0 · Extended high-tier Wind waves");
  assert.ok(getModeCandidates(positions,64,58,0,25,true,"default")
    .every(candidate=>candidate.name!==latest.at(-1).name));
});
