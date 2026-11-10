import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {getUpgradeRows,getSushiSnapshot} from "../src/lab-model.mjs";
import {getProgressionAdvice,progressionEffect,PROGRESSION_SORT_OPTIONS,
 PROGRESSION_FILTER_OPTIONS} from "../src/progression-advisor.mjs";

function sampleSave(bucks=1e15){
 const upgrades=Array(46).fill(0),tracking=Array(64).fill(0);
 const knowledge=Array(64).fill(0);
 const research=Array.from({length:18},()=>[]);
 research[7]=Array(20).fill(0);
 return {sushi:[[],[],upgrades,[],[0,0,0,bucks],tracking,[],knowledge],
  spelunk:Array.from({length:53},()=>[]),research};
}
test("Progression Advisor uses live Sushi Bucks, mapped goals and discounted prices",()=>{
 const save=sampleSave();
 const advice=getProgressionAdvice(save,"fuel");
 const actual=getUpgradeRows(save);
 assert.equal(advice.bucks,getSushiSnapshot(save).bucks);
 assert.ok(advice.count>0);
 assert.ok(advice.all.every(x=>x.goals.includes("fuel")));
 assert.ok(advice.all.every(x=>x.estimatedNextCost===
  actual.find(item=>item.id===x.id).estimatedNextCost));
 assert.ok(advice.best);
 assert.equal(advice.best.affordability,"affordable");
 assert.equal(advice.best.id,advice.roadmap[0].id);
 assert.ok(advice.roadmap.length<=3);
 assert.ok(advice.roadmap.every(x=>!x.atMax));
 assert.ok(advice.all.every(x=>x.exactCost));
});
test("Recommend an affordable upgrade over unaffordable candidates",()=>{
 const save=sampleSave();
 const baseline=getProgressionAdvice(save,"bucks");
 const prices=baseline.all.map(x=>x.estimatedNextCost).filter(Number.isFinite).sort((a,b)=>a-b);
 assert.ok(prices.length>=3);
 save.sushi[4][3]=prices[1];
 const advice=getProgressionAdvice(save,"bucks");
 assert.ok(advice.affordableCount>=1);
 assert.equal(advice.best.affordability,"affordable");
 assert.ok(advice.roadmap.some(x=>x.affordability!=="affordable"));
});
test("When none are affordable, the top pick is a savings target",()=>{
 const save=sampleSave(0);
 const advice=getProgressionAdvice(save,"fuel");
 assert.equal(advice.affordableCount,0);
 assert.notEqual(advice.best.affordability,"affordable");
 assert.ok(advice.best.missing>0);
 assert.ok(advice.roadmap.length>0);
});
test("Partial account data marks a non-affordable price as uncertain",()=>{
 const save=sampleSave(0);
 delete save.research;
 const advice=getProgressionAdvice(save,"discount");
 assert.equal(advice.partialPrices,true);
 assert.ok(advice.all.every(x=>!x.exactCost));
 assert.ok(advice.all.some(x=>x.affordability==="uncertain"));
 const u=advice.all[0];
 assert.equal(u.missing,u.estimatedNextCost);
 assert.match(u.budgetNote,/upper estimate/);
});
test("Next-level raw effect respects assigned Doubler, but does not claim universal ROI",()=>{
 const save=sampleSave();
 save.sushi[2][8]=4;
 save.spelunk[52]=[8];
 const upgrade=getUpgradeRows(save).find(u=>u.id===8);
 const effect=progressionEffect(upgrade);
 assert.equal(effect.current,120);
 assert.equal(effect.next,150);
 assert.equal(effect.delta,30);
 assert.match(effect.label,/120 → 150/);
 const unlock=getUpgradeRows(save).find(u=>u.name==="Pepper Shaker");
 assert.equal(progressionEffect(unlock).unlock,true);
 assert.match(progressionEffect(unlock).label,/Unlock/);
});
test("Maxed upgrades are excluded by default and can be surfaced in a filter",()=>{
 const save=sampleSave();
 save.sushi[2][23]=15; // Charcoal Fireplace
 const noMax=getProgressionAdvice(save,"fuel");
 assert.ok(noMax.rows.every(x=>!x.atMax));
 const all=getProgressionAdvice(save,"fuel",{includeMaxed:true});
 assert.ok(all.rows.some(x=>x.id===23&&x.atMax));
 const filtered=getProgressionAdvice(save,"fuel",{filter:"maxed"});
 assert.ok(filtered.rows.length>0&&filtered.rows.every(x=>x.atMax));
 assert.ok(filtered.roadmap.every(x=>!x.atMax));
});
test("Filters and alternative sorts are deterministic and never change the featured priority",()=>{
 const save=sampleSave(1e30);
 const regular=getProgressionAdvice(save,"bucks");
 const cost=getProgressionAdvice(save,"bucks",{sort:"cost"});
 const impact=getProgressionAdvice(save,"bucks",{sort:"impact"});
 const value=getProgressionAdvice(save,"bucks",{sort:"value"});
 assert.equal(regular.best.id,cost.best.id);
 assert.equal(regular.best.id,impact.best.id);
 assert.equal(regular.best.id,value.best.id);
 const costs=cost.rows.map(x=>x.estimatedNextCost);
 assert.ok(costs.every((x,i)=>i===0||costs[i-1]<=x));
 const impacts=impact.rows.map(x=>x.relativeGain);
 assert.ok(impacts.every((x,i)=>i===0||impacts[i-1]>=x));
 const vals=value.rows.map(x=>x.valueScore);
 assert.ok(vals.every((x,i)=>i===0||vals[i-1]>=x));
 const affordable=getProgressionAdvice(save,"bucks",{filter:"affordable"});
 assert.ok(affordable.rows.every(x=>x.affordability==="affordable"));
 const saving=getProgressionAdvice(save,"bucks",{filter:"saving"});
 assert.ok(saving.rows.every(x=>x.affordability!=="affordable"));
 assert.equal(getProgressionAdvice(save,"bucks").best.id,regular.best.id);
});
test("No save cannot be misrepresented as a personalized recommendation",()=>{
 const a=getProgressionAdvice(null,"fuel");
 assert.equal(a.best,null);
 assert.deepEqual(a.rows,[]);
 assert.equal(a.bucks,null);
});
test("New advisor navigation and rendering are present without changing the upgrade catalog",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../src/lab-ui.mjs",import.meta.url),"utf8");
 const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
 for(const id of ["labAdvisorGoal","labAdvisorFilter","labAdvisorSort","labAdvisorShowMaxed",
  "labAdvisorSummary","labAdvisorFeature","labAdvisorRoadmap","labAdvisorResults",
  "labAdvisorResultsCount"]){
  assert.ok(html.includes('id="'+id+'"'),"missing "+id);
 }
 assert.ok(ui.includes("getProgressionAdvice(save(),goal,"));
 assert.ok(ui.includes('advisorShortfall('));
 assert.ok(ui.includes("advisorDetail(advice.best,true)"));
 assert.ok(css.includes(".lab-advisor-feature"));
 assert.ok(css.includes(".lab-advisor-roadmap"));
 assert.ok(html.includes('id="labUpgradeRows"'),"Existing catalog must remain intact");
 assert.ok(PROGRESSION_SORT_OPTIONS.some(x=>x.value==="value"));
 assert.ok(PROGRESSION_FILTER_OPTIONS.some(x=>x.value==="affordable"));
});
