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
 assert.match(app,/try\{sushiLab\.markImported\(\);\}/);
 assert.match(app,/JSON imported · dashboard incomplete/);
 assert.match(app,/Your JSON loaded successfully, but the dashboard could not finish updating/);
 assert.match(html,/src\/app\.js\?v=\d+\.\d+\.\d+/);
 assert.match(app,/lab-ui\.mjs\?v=\d+\.\d+\.\d+/);
});

test("Combo strategy UI starts in Simple mode with real dual-direction split bars",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const code=readFileSync(new URL("../src/app.js",import.meta.url),"utf8");
 assert.match(html,/id="optimizerMode"><option value="simple" selected>/);
 assert.match(html,/id="optimizerSingleProgress"/);
 assert.match(html,/id="optimizerDualProgress"/);
 assert.match(html,/id="optimizerSupplyProgress"/);
 assert.match(html,/id="optimizerEngineProgress"/);
 assert.match(code,/candidate\?\.splitDirection/);
 assert.match(code,/tracks\[candidate\.splitDirection\]/);
 assert.match(code,/getModeCandidates\(layoutPositions,maxTier,cap/);
 assert.match(code,/detectSushiProgress\(imported\)/);
 assert.match(code,/if\(foundInfo\|\|optimizerMode==="adaptive"\|\|/);
 assert.match(code,/if\(solution.adaptive\)/);
});

test("Choose a planner cards are full-surface accessible buttons linked to matching panels",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const perfectoUI=readFileSync(new URL("../src/perfecto-ui.mjs",import.meta.url),"utf8");
 const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
 for(const id of ["combo","perfecto","knowledge"]){
  assert.match(html,new RegExp('<button type="button" class="lab-planner-card" data-planner-card="'+id+'"'));
  assert.match(html,new RegExp('data-planner-target="'+id+'"'));
 }
 assert.match(perfectoUI,/document\.querySelectorAll\("\[data-planner-card\]"\)/);
 assert.match(perfectoUI,/card\.addEventListener\("click",/);
 assert.match(perfectoUI,/setPlannerTab\(target\)/);
 assert.match(perfectoUI,/card\.setAttribute\("aria-pressed",String\(selected\)\)/);
 assert.match(perfectoUI,/scrollIntoView\(\{behavior:"smooth",block:"start"\}\)/);
 assert.match(css,/\.lab-planner-cards button\.lab-planner-card/);
});


test("approved transparent Sushi Lab logo is used in the tab and hero",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
 const png=readFileSync(new URL("../assets/sushi-station-lab-logo.png",import.meta.url));
 assert.equal(png.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
 assert.equal(png.readUInt32BE(16),160);
 assert.equal(png.readUInt32BE(20),160);
 assert.ok(png.includes(Buffer.from("tRNS")),"PNG preserves transparency");
 assert.match(html,/<link rel="icon" type="image\/png"[^>]*sushi-station-lab-logo\.png/);
 assert.match(html,/<link rel="apple-touch-icon"[^>]*sushi-station-lab-logo\.png/);
 assert.match(html,/<div class="hero-visual"[^>]*><div class="hero-orbit"><\/div><img src="assets\/sushi-station-lab-logo\.png\?v=1" alt=""><\/div>/);
 assert.match(css,/\.hero-orbit\{position:absolute;width:192px;height:192px;border-radius:50%/);
 assert.doesNotMatch(html,/<div class="hero-visual"[^>]*>.*?Leviathan/);
 assert.match(css,/\.hero-visual img\{\s*width:170px;height:170px;image-rendering:auto;transform:none/);
});
