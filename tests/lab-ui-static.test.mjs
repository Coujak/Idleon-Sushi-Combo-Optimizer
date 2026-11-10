import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {initializeSushiLab} from "../src/lab-ui.mjs";
test("Sushi Lab UI module imports and exposes its initializer",()=>{
 assert.equal(typeof initializeSushiLab,"function");
});
test("Overview is the visible default; planner and reference tabs are present",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 for(const tab of ["overview","planners","upgrades","knowledge"]){
  assert.ok(html.includes('data-lab-target="'+tab+'"'));
  assert.ok(html.includes('id="lab-'+tab+'"'));
 }
 assert.match(html,/id="lab-overview" class="lab-tab-content"/);
 assert.match(html,/id="lab-planners" class="lab-tab-content hidden"/);
 assert.match(html,/id="lab-upgrades" class="lab-tab-content hidden"/);
 assert.match(html,/id="lab-knowledge" class="lab-tab-content hidden"/);
 for(const sub of ["catalog","advisor","doubler"])assert.ok(html.includes('data-upgrade-target="'+sub+'"'));
 assert.ok(html.includes('id="solver"'));
 assert.ok(html.includes('id="labKnowledgeRows"'));
});
