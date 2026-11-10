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

test("Import precedes dashboard and new collections replace shortcut buttons",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 assert.ok(html.indexOf('id="importPanel"')<html.indexOf('class="panel lab-welcome-panel"'));
 for(const name of ["labShakerCards","labMissingPerfectos","labMissingTiers"])
  assert.ok(html.includes('id="'+name+'"'));
 assert.ok(!html.includes('class="lab-quick-links"'));
 assert.ok(!html.includes('id="labOverviewInsights"'));
});

test("Imported IT JSON is not rejected when cached Advisor markup lacks optional projection containers",()=>{
 const app=readFileSync(new URL("../src/app.js",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../src/lab-ui.mjs",import.meta.url),"utf8");
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 assert.match(ui,/function ensureAdvisorResultMount\(id,className\)/);
 assert.match(ui,/ensureAdvisorResultMount\("labAdvisorGoalProjection","lab-advisor-goal-projection"\)/);
 assert.match(ui,/ensureAdvisorResultMount\("labAdvisorPlanSummary","lab-advisor-plan-summary"\)/);
 assert.match(ui,/panel\.insertBefore\(node,before\|\|null\)/);
 assert.match(app,/try\{sushiLab\.refresh\(\);\}/);
 assert.match(app,/JSON imported · dashboard incomplete/);
 assert.match(app,/Your JSON loaded successfully, but the dashboard could not finish updating/);
 assert.match(html,/src\/app\.js\?v=1\.16\.7/);
 assert.match(app,/lab-ui\.mjs\?v=1\.16\.7/);
});
