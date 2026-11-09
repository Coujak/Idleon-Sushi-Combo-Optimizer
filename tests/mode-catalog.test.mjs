import test from "node:test";
import assert from "node:assert/strict";
import {MODE_CATALOG,getModeInfo,modeOptionLabel,modeDisplayLabel} from "../src/mode-catalog.mjs";
test("All 12 experimental modes have distinct names, stable IDs and increasing benchmarks",()=>{
 assert.equal(MODE_CATALOG.length,13);
 assert.equal(new Set(MODE_CATALOG.map(m=>m.id)).size,13);
 assert.equal(new Set(MODE_CATALOG.map(m=>m.name)).size,13);
 for(let i=1;i<=12;i++){
  const m=MODE_CATALOG[i];
  assert.equal(m.id,i===1?"experimental":"experimental"+i);
  assert.ok(modeOptionLabel(m).includes("Exp "+i+".0"));
  assert.ok(modeDisplayLabel(m).includes("Experimental "+i+".0"));
  assert.ok(["Advanced","Expert","Master","Grandmaster"].includes(m.difficulty));
  assert.ok(m.benchmark>MODE_CATALOG[i-1].benchmark);
 }
});
test("Default fallback and highest benchmark remain correct",()=>{
 assert.equal(getModeInfo("unrecognized").id,"default");
 assert.equal(getModeInfo("default").benchmark,null);
 assert.equal(getModeInfo("experimental12").name,"Wind Foresight");
 assert.equal(getModeInfo("experimental12").benchmark,75546);
});
