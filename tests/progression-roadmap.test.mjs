import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildProgressionPurchasePlan,normalizePurchaseCount,PURCHASE_PRESETS,
 MAX_CUSTOM_PURCHASES} from "../src/progression-roadmap.mjs";
import {progressionGoalMetric} from "../src/progression-goal-impact.mjs";

function fixture(bucks=1e14){
 const levels=Array(46).fill(0),tracking=Array(64).fill(0),knowledge=Array(64).fill(0);
 const research=Array.from({length:18},()=>[]);
 research[7]=Array(20).fill(0);
 return {sushi:[[],[],levels,[],[0,0,0,bucks],tracking,[],knowledge],
  spelunk:Array.from({length:53},()=>[]),research,
  tiles:Array(120).fill(-1),fires:Array(15).fill(0)};
}
test("Preset and custom purchase counts stay within reasonable bounds",()=>{
 assert.deepEqual(PURCHASE_PRESETS,[5,10,25,50,100]);
 assert.equal(MAX_CUSTOM_PURCHASES,500);
 assert.equal(normalizePurchaseCount(25),25);
 assert.equal(normalizePurchaseCount("100"),100);
 assert.equal(normalizePurchaseCount(0),1);
 assert.equal(normalizePurchaseCount(-17),1);
 assert.equal(normalizePurchaseCount("999999"),500);
 assert.equal(normalizePurchaseCount("bad"),5);
 assert.equal(normalizePurchaseCount(14.9),14);
});
test("Purchase plan advances levels and reprices repeat purchases without changing the save",()=>{
 const save=fixture();
 const untouched=JSON.stringify(save);
 const plan=buildProgressionPurchasePlan(save,"fuel",25);
 assert.equal(plan.requestedCount,25);
 assert.equal(plan.steps.length,25);
 assert.deepEqual(plan.steps.map(x=>x.number),Array.from({length:25},(_,i)=>i+1));
 assert.ok(plan.steps.some((x,i)=>plan.steps.slice(0,i).some(p=>p.id===x.id)),
  "Twenty-five sequential purchases should allow repeats");
 const observed=new Map();
 for(const step of plan.steps){
  const last=observed.get(step.id);
  if(last!==undefined)assert.equal(step.fromLevel,last);
  observed.set(step.id,step.toLevel);
  assert.equal(step.toLevel,step.fromLevel+1);
  assert.ok(step.price>=0&&Number.isFinite(step.price));
  assert.ok(step.goalResult);
  assert.equal(step.goalResult.label,plan.initialGoal.label);
 }
 assert.equal(JSON.stringify(save),untouched,"Projection must not mutate imported data");
});
test("Budget is simulated in order, and future savings are not called affordable now",()=>{
 const save=fixture(20);
 const plan=buildProgressionPurchasePlan(save,"capacity",10);
 assert.equal(plan.steps.length,10);
 assert.ok(plan.steps.some(x=>x.missingBucks>0));
 assert.ok(plan.steps.filter(x=>x.fundedByImport).every(x=>x.missingBucks===0));
 assert.ok(plan.steps.some(x=>!x.fundedByImport));
 assert.ok(plan.additionalBucksNeeded>0);
 assert.ok(Math.abs(plan.totalEstimatedCost-
  (plan.initialBucks+plan.additionalBucksNeeded-plan.finalProjectedBucks))<
  Math.max(1,Math.abs(plan.totalEstimatedCost))*1e-10);
});
test("Goal result is recomputed at every purchase, not only the first",()=>{
 const save=fixture(1e15);
 const fuel=buildProgressionPurchasePlan(save,"fuel",5);
 assert.equal(fuel.initialGoal.label,"Estimated passive Fuel / hour");
 assert.equal(fuel.steps.length,5);
 assert.ok(fuel.steps.some(step=>step.goalResult.changed));
 assert.equal(fuel.steps[0].goalResult.current,fuel.initialGoal.display);
 assert.equal(fuel.steps.at(-1).goalResult.projected,fuel.finalGoal.display);
 assert.ok(fuel.finalGoal.value>fuel.initialGoal.value);
 const capacity=buildProgressionPurchasePlan(save,"capacity",5);
 assert.equal(capacity.initialGoal.label,"Estimated maximum Fuel capacity");
 assert.ok(capacity.finalGoal.value>capacity.initialGoal.value);
});
test("Goal-specific models don't pretend partial Bucks, Knowledge and Perfecto estimates are totals",()=>{
 const save=fixture();
 const bucks=progressionGoalMetric(save,"bucks");
 assert.match(bucks.label,/Modeled passive Bucks multiplier/);
 assert.match(bucks.note,/Partial model/);
 assert.ok(!bucks.label.includes("Bucks\/hr"));
 const knowledge=progressionGoalMetric(save,"knowledge");
 assert.match(knowledge.label,/Knowledge EXP multiplier/);
 assert.match(knowledge.note,/Partial global/);
 const perfecto=progressionGoalMetric(save,"perfecto");
 assert.match(perfecto.label,/Pepper/);
 assert.match(perfecto.note,/not the probability/);
 const discount=progressionGoalMetric(save,"discount");
 assert.match(discount.label,/discount/);
});
test("Completed goals stop early, and missing saves yield a clear reason",()=>{
 const save=fixture(1e20);
 save.sushi[2][18]=1;
 save.sushi[2][21]=20;
 const complete=buildProgressionPurchasePlan(save,"perfecto",25);
 assert.equal(complete.steps.length,0);
 assert.match(complete.stopReason,/maxed/i);
 const missing=buildProgressionPurchasePlan(null,"fuel",10);
 assert.equal(missing.steps.length,0);
 assert.match(missing.stopReason,/Import/);
});
test("Progression Advisor exposes custom count, cards/list toggle and per-step goal results",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../src/lab-ui.mjs",import.meta.url),"utf8");
 const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
 for(const id of ["labAdvisorPurchaseCount","labAdvisorCustomPurchases","labAdvisorCustomCountLabel",
  "labAdvisorViewCards","labAdvisorViewList","labAdvisorPlanSummary","labAdvisorPurchaseSteps",
  "labAdvisorGoalProjection"]){
  assert.ok(html.includes('id="'+id+'"'),"Missing UI control "+id);
 }
 assert.match(ui,/setPurchaseView\("list"\)/);
 assert.match(ui,/step\.goalResult\.projected/);
 assert.match(ui,/plan\.finalGoal\.display/);
 assert.match(css,/\.lab-advisor-view-list/);
 assert.match(css,/\.lab-advisor-view-cards/);
 assert.match(css,/\.lab-advisor-goal-projection/);
});
