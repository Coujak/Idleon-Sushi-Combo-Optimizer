import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {getDoublerPlacementPlan,DOUBLER_FOCUS_OPTIONS} from "../src/doubler-advisor.mjs";

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
test("Knowledge then Perfecto then cheaper upgrades are recommended before other effects",()=>{
 const plan=getDoublerPlacementPlan(scenario());
 assert.equal(plan.ready,true);
 assert.equal(plan.slotCount,5);
 assert.deepEqual(plan.recommendations.map(u=>u.id),[38,37,21,36,31]);
 assert.equal(plan.recommendations[0].status,"Keep");
 assert.equal(plan.recommendations[1].status,"Move Doubler");
 assert.equal(plan.recommendations[1].from,"Fastburn Fuel V");
 assert.equal(plan.recommendations[2].status,"Keep");
 assert.equal(plan.recommendations[3].status,"Move Doubler");
 assert.equal(plan.recommendations[3].from,"Quickpay Fee");
 assert.equal(plan.changes,2);
});
test("An available Doubler gets used before moving any existing ones",()=>{
 const plan=getDoublerPlacementPlan(scenario({owned:6}));
 assert.equal(plan.slotCount,6);
 assert.equal(plan.recommendations.find(u=>u.id===37)?.status,"Use available");
 assert.equal(plan.recommendations.find(u=>u.id===36)?.status,"Move Doubler");
});
test("A zero-level upgrade is not recommended because its doubling adds nothing",()=>{
 const plan=getDoublerPlacementPlan(scenario({levels:{37:0,36:0}}));
 assert.equal(plan.recommendations.some(u=>u.id===37),false);
 assert.equal(plan.recommendations.some(u=>u.id===36),false);
 assert.equal(plan.changes,0);
});
test("Specific goals lead with their eligible upgrades but keep other slots in place",()=>{
 const plan=getDoublerPlacementPlan(scenario(),"perfecto");
 assert.equal(plan.recommendations[0].id,21);
 assert.ok(plan.recommendations.some(u=>u.id===38));
 assert.ok(plan.recommendations.every(u=>u.level>0));
 assert.ok(DOUBLER_FOCUS_OPTIONS.some(o=>o.value==="priorities"));
});
test("Unknown free Doublers do not become imaginary placements",()=>{
 const save=scenario();save.menagerie=null;
 const plan=getDoublerPlacementPlan(save);
 assert.equal(plan.ready,true);
 assert.equal(plan.availableKnown,false);
 assert.equal(plan.slotCount,5);
 assert.ok(plan.recommendations.every(u=>u.status!=="Use available"));
 const noAssignment=scenario();delete noAssignment.spelunk;
 assert.equal(getDoublerPlacementPlan(noAssignment).ready,false);
 assert.equal(getDoublerPlacementPlan(null),null);
});
test("Doubler Advisor is actionable on the dev UI without new tabs",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../src/lab-ui.mjs",import.meta.url),"utf8");
 const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
 for(const id of ["labDoublerGoal","labDoublerAdvice","labDoublerResults"])
  assert.equal(html.split('id="'+id+'"').length-1,1);
 assert.match(html,/<details class="lab-doubler-compare">/);
 assert.match(ui,/getDoublerPlacementPlan\(data,doublerGoal\)/);
 assert.match(ui,/doublerGoal="priorities"/);
 assert.match(ui,/u\.from/);
 assert.match(css,/\.lab-doubler-plan-grid/);
});
