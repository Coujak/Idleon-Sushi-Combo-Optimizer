import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {getDoublerPlacementPlan,getDoublerValueComparison,DOUBLER_FOCUS_OPTIONS} from "../src/doubler-advisor.mjs";

function scenario({owned=5,levels={},assignments=[31,12,38,35,21]}={}){
 const upgrades=Array(46).fill(0);
 for(const [id,level] of Object.entries({
  31:200,12:200,38:100,35:120,21:20,37:80,36:50,...levels
 }))upgrades[Number(id)]=level;
 const spelunk=Array.from({length:53},()=>[]);
 spelunk[52]=assignments;
 const menagerie=Array.from({length:7},()=>[]);
 menagerie[3]=Array(11).fill(0);
 menagerie[3][10]=owned;
 return {sushi:[[],[],upgrades,[],[],Array(64).fill(0),[],Array(64).fill(0)],
  spelunk,menagerie};
}

test("Each Doubler category has only its own eligible upgrades, regardless of owned count",()=>{
 const first=scenario(),extra=scenario({owned:6});
 assert.deepEqual(DOUBLER_FOCUS_OPTIONS.map(o=>o.value),
  ["knowledge","perfecto","discount","bucks","fuel","capacity"]);
 for(const [category,count] of [["knowledge",2],["perfecto",1],["discount",1],
  ["capacity",5],["fuel",6]]){
  for(const save of [first,extra]){
   const plan=getDoublerPlacementPlan(save,category);
   assert.equal(plan.ready,true);
   assert.equal(plan.totalOptions,count);
   assert.equal(plan.recommendations.length,count);
   assert.ok(plan.recommendations.every(u=>u.goals.includes(category)),
    "No recommendations from other categories ("+category+")");
  }
 }
 const bucks=getDoublerPlacementPlan(first,"bucks");
 assert.ok(bucks.totalOptions>1);
 assert.ok(bucks.recommendations.every(u=>u.goals.includes("bucks")));
});

test("Knowledge recommendations remain two regardless of five or six owned Doublers",()=>{
 const withFive=getDoublerPlacementPlan(scenario());
 const withSix=getDoublerPlacementPlan(scenario({owned:6}));
 assert.deepEqual(withFive.recommendations.map(u=>u.id),[38,37]);
 assert.deepEqual(withSix.recommendations.map(u=>u.id),[38,37]);
 assert.equal(withFive.recommendations[0].status,"Keep");
 assert.equal(withFive.recommendations[1].status,"Check / reassign");
 assert.equal(withSix.recommendations[1].status,"Use available");
 assert.equal(withFive.totalOptions,2);
 assert.equal(withFive.actionable,2);
});

test("Perfecto and discounts stay independent, even with Doubler assignments elsewhere",()=>{
 const save=scenario();
 const perfecto=getDoublerPlacementPlan(save,"perfecto");
 const discounts=getDoublerPlacementPlan(save,"discount");
 assert.deepEqual(perfecto.recommendations.map(u=>u.id),[21]);
 assert.equal(perfecto.recommendations[0].status,"Keep");
 assert.deepEqual(discounts.recommendations.map(u=>u.id),[36]);
 assert.equal(discounts.recommendations[0].status,"Check / reassign");
 assert.ok(discounts.recommendations.every(u=>!u.goals.includes("perfecto")));
});

test("Zero-level upgrades remain visible as future options but cannot consume Doublers",()=>{
 const plan=getDoublerPlacementPlan(scenario({levels:{37:0}}),"knowledge");
 assert.equal(plan.totalOptions,2);
 assert.equal(plan.actionable,1);
 assert.deepEqual(plan.recommendations.map(u=>u.id),[38,37]);
 assert.equal(plan.recommendations[1].status,"Level first");
 assert.equal(plan.recommendations[1].level,0);
});

test("Exact, incomplete and missing ownership data remain distinguishable",()=>{
 const exact=scenario();exact.sushiDoublerInfo={owned:5};
 assert.equal(getDoublerPlacementPlan(exact,"knowledge").recommendations[1].status,"Reassign needed");
 const unknown=scenario();unknown.menagerie=null;
 const plan=getDoublerPlacementPlan(unknown,"knowledge");
 assert.equal(plan.ready,true);
 assert.equal(plan.availabilityKnown,false);
 assert.equal(plan.recommendations[1].status,"Check availability");
 assert.equal(getDoublerPlacementPlan(null),null);
 const noAssignment=scenario();delete noAssignment.spelunk;
 assert.equal(getDoublerPlacementPlan(noAssignment).ready,false);
 assert.equal(getDoublerPlacementPlan(scenario(),"priorities").ready,false);
});

test("Doubler Advisor HTML and controls contain only one selected focus",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../src/lab-ui.mjs",import.meta.url),"utf8");
 const code=readFileSync(new URL("../src/doubler-advisor.mjs",import.meta.url),"utf8");
 for(const id of ["labDoublerGoal","labDoublerAdvice"])
  assert.equal(html.split('id="'+id+'"').length-1,1);
 assert.ok(!html.includes('id="labDoublerResults"'));
 assert.match(ui,/getDoublerPlacementPlan\(save\(\),doublerGoal\)/);
 assert.match(ui,/doublerGoal="knowledge"/);
 assert.doesNotMatch(code,/value:"priorities"/);
 assert.doesNotMatch(code,/value:"all"/);
 assert.match(ui,/u\.status!=="Level first"/);
});

test("Already-doubled upgrades use the Upgrade Catalog's purple highlight",()=>{
 const ui=readFileSync(new URL("../src/lab-ui.mjs",import.meta.url),"utf8");
 const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
 assert.match(ui,/u\.doubled\?" is-doubled"/);
 assert.match(ui,/u\.doubled\?"×2 Active · Keep"/);
 assert.match(css,/\.lab-doubler-plan-card\.is-doubled\{/);
 assert.match(css,/background:#26273b;border-color:#9f77cb/);
 assert.match(css,/box-shadow:inset 3px 0 0 #cda2fa/);
 assert.match(css,/\.lab-doubler-plan-status\.is-doubled\{/);
 const plan=getDoublerPlacementPlan(scenario(),"knowledge");
 assert.equal(plan.recommendations[0].doubled,true);
 assert.equal(plan.recommendations[0].status,"Keep");
 assert.equal(plan.recommendations[1].doubled,false);
});

test("Doubler cards compare current base and doubled values without inventing levels",()=>{
 const knowledge=getDoublerPlacementPlan(scenario(),"knowledge");
 const doubled=getDoublerValueComparison(knowledge.recommendations[0]);
 const undoubled=getDoublerValueComparison(knowledge.recommendations[1]);
 assert.equal(doubled.normal,"+100%");
 assert.equal(doubled.doubled,"+200%");
 assert.equal(doubled.label,"Knowledge EXP bonus");
 assert.equal(undoubled.normal,"+80 EXP");
 assert.equal(undoubled.doubled,"+160 EXP");
 assert.equal(knowledge.recommendations[0].level,100);
 assert.equal(knowledge.recommendations[1].level,80);
 const perfecto=getDoublerPlacementPlan(scenario(),"perfecto");
 assert.equal(getDoublerValueComparison(perfecto.recommendations[0]).doubled,"+40%");
});

test("Wholesale Pricing shows effective percent cheaper, not raw discount strength",()=>{
 const discount=getDoublerPlacementPlan(scenario(),"discount").recommendations[0];
 const values=getDoublerValueComparison(discount);
 assert.equal(discount.level,50);
 assert.equal(values.normal,"33.33%");
 assert.equal(values.doubled,"50%");
 assert.match(values.note,/Other discounts stack separately/);
});

test("Doubler Advisor compares values and highlights the active one in purple",()=>{
 const ui=readFileSync(new URL("../src/lab-ui.mjs",import.meta.url),"utf8");
 const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
 assert.match(ui,/getDoublerValueComparison\(u\)/);
 assert.match(ui,/Without Doubler/);
 assert.match(ui,/With Doubler · Active/);
 assert.match(ui,/With Doubler · Potential/);
 assert.match(ui,/value\.normal/);
 assert.match(ui,/value\.doubled/);
 assert.match(css,/\.lab-doubler-values\{/);
 assert.match(css,/\.lab-doubler-value\.is-doubled\{/);
 assert.match(css,/color:#f4d9ff/);
});
