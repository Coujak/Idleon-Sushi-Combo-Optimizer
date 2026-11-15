import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const ui=readFileSync(new URL("../src/knowledge-leveling-ui.mjs",import.meta.url),"utf8");
const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
const section=html.split('<section id="knowledgePlanner"')[1]
 .split('<div id="lab-upgrades"')[0];

test("Knowledge has a concise three-section layout and all functional controls",()=>{
 for(const label of ["1 · Strategy","2 · Walkthrough",
  "3 · Knowledge progression"])assert.ok(section.includes(label));
 assert.doesNotMatch(section,/id="knowledgePlanDesign"/);
 assert.doesNotMatch(ui,/renderDesignedBoard/);
 assert.match(ui,/renderFrame/);
 assert.match(ui,/preparedStep/);
 for(const id of [
  "knowledgePlanMode","knowledgePlanTarget","knowledgePlanProtectPassive",
  "knowledgePlanRun","knowledgePlanCancel","knowledgePlanRounds",
  "knowledgePlanContinue","knowledgePlanSpeed","knowledgePlanNextRefill",
  "knowledgePlanNextHarvest","knowledgePlanPlay","knowledgePlanPrev",
  "knowledgePlanNext","knowledgePlanEnd","knowledgePlanPrepared",
  "knowledgePlanStepTitle","knowledgePlanBoard","knowledgePlanLevelRows",
  "knowledgePlanReplayProgress","knowledgePlanStepKind",
  "knowledgePlanStrategyDetail","knowledgePlanContinueStatus"
 ])assert.equal((section.match(new RegExp('id="'+id+'"',"g"))??[]).length,1,
  "Expected exactly one #"+id);
 assert.match(section,/lab-kp-replay-group-playback/);
 assert.match(section,/lab-kp-board-legend/);
});

test("Primary metrics and supporting metrics preserve all original fields",()=>{
 assert.match(ui,/lab-kp-primary-stats/);
 assert.match(ui,/lab-kp-secondary-stats/);
 assert.match(ui,/lab-kp-more-metrics/);
 for(const field of ["p.targetCreated","p.peakTargetCopies","p.targetExp",
  "p.harvestCount","p.totalExpPerCycle","p.coverageTotal",
  "p.previewExpPerHour","p.refillFuelSafety","p.windEvents",
  "p.packingMode","p.fireChoice"])
  assert.ok(ui.includes(field),field);
 assert.match(ui,/const metricsOpen=summary\.querySelector/);
 assert.match(ui,/more\.open=metricsOpen/);
 assert.match(ui,/replayProgress\.value=index/);
});

test("Knowledge styling is isolated within its planner and remains responsive",()=>{
 assert.match(css,/#knowledgePlanner \.lab-kp-primary-stats/);
 assert.match(css,/#knowledgePlanner \.lab-kp-replay-shell/);
 assert.match(css,/#knowledgePlanner \.lab-kp-progress-table tr\.is-target/);
 assert.match(css,/#knowledgePlanner \.lab-kp-board-legend/);
 assert.match(css,/@media\(max-width:490px\)/);
 assert.match(section,/lab-kp-estimate-tag">Estimated/);
});

test("Passive Sushi checkbox aligns with strategy select and stays at right",()=>{
 const rule=css.split("/* Align Preserve passive Sushi with the selector's lower control row.")[1];
 assert.ok(rule,"Right-hand alignment rule is present");
 assert.match(rule,/grid-column:3/);
 assert.match(rule,/justify-self:end/);
 assert.match(rule,/align-self:end/);
 assert.match(rule,/@media\(max-width:960px\)/);
 assert.match(rule,/grid-column:2/);
 assert.match(rule,/@media\(max-width:490px\)/);
 assert.match(section,/id="knowledgePlanProtectPassive"/);
});
test("Balanced uses one shared dual-handle slider and EXP chips never scroll",()=>{
 assert.match(section,/id="knowledgePlanDualRange"/);
 assert.match(section,/id="knowledgePlanRangeStart"/);
 assert.match(section,/id="knowledgePlanRangeEnd"/);
 assert.match(ui,/--kp-start/);
 assert.match(ui,/--kp-end/);
 assert.match(ui,/Created · predicted EXP/);
 assert.match(css,/#knowledgePlanner \.lab-kp-dual-range-track/);
 const chips=css.split("#knowledgePlanner .lab-kp-created-exp{")[1].split("}")[0];
 assert.match(chips,/overflow:visible/);
 assert.doesNotMatch(chips,/overflow:auto/);
 assert.match(ui,/lab-kp-plan-notes/);
 assert.match(ui,/lab-kp-formula-details/);
});

test("Knowledge can hide zero-EXP Sushi while preserving step history",()=>{
 assert.match(section,/id="knowledgePlanShowZero" type="checkbox"/);
 assert.doesNotMatch(section,/id="knowledgePlanShowZero"[^>]*checked/);
 assert.match(ui,/showZero\?\.checked\|\|entry\.expPerCycle>0\|\|entry\.passiveExpPerDay>0/);
 assert.match(ui,/showZero\?\.addEventListener\("change"/);
 assert.match(ui,/renderVisibleActiveExp\(controller\?\.step\?\?0\)/);
 assert.match(section,/id="knowledgePlanLevelCount"/);
 assert.match(section,/id="knowledgePlanLevelEmpty"/);
});
test("Knowledge search progress and EXP overlays are tied to real data",()=>{
 assert.match(section,/id="knowledgePlanLoadingBar"/);
 assert.match(section,/id="knowledgePlanLoadingText"/);
 assert.match(ui,/msg\.phase==="search"/);
 assert.match(ui,/updateProgress\(msg\.completed,msg\.total\)/);
 assert.match(ui,/updateProgress\(msg\.completedWaves,msg\.requestedWaves,"refills"\)/);
 assert.match(ui,/loadBar\.removeAttribute\("value"\)/);
 assert.match(ui,/entry\.xp\/entry\.xpReq/);
 assert.match(ui,/display\.projected\.style\.width=additional/);
 assert.match(section,/is-current/);
 assert.match(section,/is-gained/);
 assert.match(css,/lab-kp-tier-exp-new/);
});
test("Balanced defaults to T1–T64 even with old persisted preferences",()=>{
 assert.match(ui,/state\.balancedStartTier=1;state\.balancedEndTier=64/);
 assert.match(ui,/const maxTier=64/);
 assert.match(section,/id="knowledgePlanRangeStart"[^>]*value="1"/);
 assert.match(section,/id="knowledgePlanRangeEnd"[^>]*value="64"/);
});

test("Knowledge EXP bars stay inside aligned table cells",()=>{
 assert.match(ui,/const nameContent=elem\("div","lab-kp-tier-content"\)/);
 assert.match(ui,/name\.append\(nameContent\)/);
 assert.match(ui,/const activeContent=elem\("div","lab-kp-active-content"\)/);
 assert.match(ui,/const activeHeading=elem\("div","lab-kp-active-heading"\)/);
 assert.match(ui,/activeHeading\.append\(gained,created\)/);
 assert.match(ui,/activeContent\.append\(progressWrap\)/);
 assert.match(ui,/active\.append\(activeContent\)/);
 assert.match(css,/#knowledgePlanner \.lab-kp-tier\{display:table-cell\}/);
 assert.doesNotMatch(css,/#knowledgePlanner \.lab-kp-tier\{display:flex/);
 assert.match(css,/#knowledgePlanner \.lab-kp-progress-table td\{\s*display:table-cell/);
 assert.match(css,/#knowledgePlanner \.lab-kp-active-heading\{/);
 assert.match(css,/#knowledgePlanner \.lab-kp-progress-table\{\s*width:100%;\s*min-width:880px;\s*table-layout:fixed/);
});
