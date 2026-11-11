import test from "node:test";
import assert from "node:assert/strict";
import {MODE_CATALOG,getModeInfo,modeOptionLabel,modeDisplayLabel} from "../src/mode-catalog.mjs";
test("All 13 historical experimental modes retain stable score-board IDs and benchmarks",()=>{
 assert.equal(MODE_CATALOG.length,21);
 assert.equal(new Set(MODE_CATALOG.map(m=>m.id)).size,21);
 assert.equal(new Set(MODE_CATALOG.map(m=>m.name)).size,21);
 const historic=MODE_CATALOG.filter(m=>m.id.startsWith("experimental"));
 assert.equal(historic.length,13);
 for(let i=1;i<=13;i++){
  const m=historic[i-1];
  assert.equal(m.id,i===1?"experimental":"experimental"+i);
  assert.ok(modeOptionLabel(m).includes("Exp "+i+".0"));
  assert.ok(modeDisplayLabel(m).includes("Experimental "+i+".0"));
  assert.ok(["Advanced","Expert","Master","Grandmaster"].includes(m.difficulty));
  assert.ok(m.benchmark>(i===1?0:historic[i-2].benchmark));
 }
});
test("Default fallback and highest benchmark remain correct",()=>{
 assert.equal(getModeInfo("unrecognized").id,"default");
 assert.equal(getModeInfo("default").benchmark,null);
 assert.equal(getModeInfo("experimental12").name,"Wind Foresight");
 assert.equal(getModeInfo("experimental12").benchmark,75546);
 assert.equal(getModeInfo("experimental13").name,"Cascade Resonance");
 assert.equal(getModeInfo("experimental13").benchmark,76532);
});

test("Adaptive strategy mode is not assigned an experiment number or T64 benchmark",()=>{
 const adaptive=getModeInfo("adaptive");
 assert.equal(adaptive.number,null);
 assert.equal(adaptive.benchmark,null);
 assert.equal(adaptive.difficulty,"Adaptive");
 assert.match(modeOptionLabel(adaptive),/^Adaptive —/);
 assert.match(modeDisplayLabel(adaptive),/^Adaptive ·/);
 assert.match(adaptive.summary,/available tier/);
});

test("Simple and five split search modes are unnumbered, keeping historic experiments intact",()=>{
 const split=MODE_CATALOG.filter(m=>m.kind==="split");
 assert.deepEqual(split.map(m=>m.id),
  ["simple","optimizer1","optimizer2","optimizer3","optimizer4","optimizer5"]);
 assert.ok(split.every(m=>m.number===null&&m.benchmark===null));
 for(const mode of split){
  assert.ok(modeOptionLabel(mode).includes(mode.name));
  assert.ok(!modeOptionLabel(mode).includes("Exp "));
 }
});
