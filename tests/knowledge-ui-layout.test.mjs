import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const ui=readFileSync(new URL("../src/knowledge-leveling-ui.mjs",import.meta.url),"utf8");
const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
const section=html.split('<section id="knowledgePlanner"')[1]
 .split('<div id="lab-upgrades"')[0];

test("Knowledge has four themed sections and all existing functional controls",()=>{
 for(const label of ["1 · Choose your strategy","2 · Prepared Sushi board",
  "3 · Preparation walkthrough","4 · Projected Knowledge progression"]){
  if(label.startsWith("2 ·"))assert.ok(ui.includes(label));
  else assert.ok(section.includes(label));
 }
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
 assert.match(section,/Modeled EXP · verify in game/);
});
