import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fireplaceOverviewAdvice,sparkFireplaceBonus} from "../src/fireplace-advice.mjs";

function saveWith({sparks=100,fires=[0,1,2,3,4],potassium=1}={}){
 const upgrades=Array(45).fill(0);upgrades[25]=potassium;
 upgrades[24]=1;upgrades[26]=1;upgrades[27]=1;
 const tiles=Array(120).fill(-1);
 tiles[0]=50;tiles[1]=40;tiles[15]=40;
 return {sushi:[[],[],upgrades,[],[0,0,sparks]],tiles,fires};
}
test("A fixed number of Sparks gives diminishing bonus and doubling adds a fixed increment",()=>{
 const perDouble=sparkFireplaceBonus(2_000)-sparkFireplaceBonus(1_000);
 assert.ok(Math.abs(perDouble-(.2+Math.log10(2)))<1e-10);
 assert.ok(Math.abs(perDouble-
  (sparkFireplaceBonus(2_000_000)-sparkFireplaceBonus(1_000_000)))<1e-10);
 assert.ok(sparkFireplaceBonus(100+86400)-sparkFireplaceBonus(100)>
  sparkFireplaceBonus(1_000_000+86400)-sparkFireplaceBonus(1_000_000));
 assert.equal(sparkFireplaceBonus(undefined),null);
});
test("Overview explains Potassium when it is not unlocked",()=>{
 const item=fireplaceOverviewAdvice(saveWith({potassium:0,sparks:100,fires:[0,1,2]}));
 assert.match(item.heading,/not unlocked/i);
 assert.match(item.detail,/Charcoal for Fuel/);
});
test("Low Spark accounts see idle-growth guidance instead of a universal all-purple rule",()=>{
 const item=fireplaceOverviewAdvice(saveWith({sparks:100,fires:[0,0,0]}));
 assert.match(item.heading,/Consider one Potassium/);
 assert.match(item.summary,/low-value Charcoal column/);
 assert.equal(item.weakestCharcoal.column,3);
});
test("High Spark accounts see diminishing returns and relevant alternatives",()=>{
 const item=fireplaceOverviewAdvice(saveWith({sparks:1e9,fires:[0,1,2,3,4]}));
 assert.match(item.heading,/productive fireplaces/);
 assert.match(item.detail,/Barium for Bucks/);
 assert.match(item.detail,/Copper for active merges/);
 assert.match(item.detail,/Lithium for Knowledge EXP/);
 assert.equal(item.counts[4],1);
 assert.ok(item.marginalSparkPointsPerDay<.01);
});
test("Missing Spark amounts do not produce invented percentages",()=>{
 const missing=saveWith();missing.sushi[4][2]=undefined;
 const item=fireplaceOverviewAdvice(missing);
 assert.match(item.heading,/data unavailable/);
 assert.equal(item.sparkBalance,null);
 assert.equal(fireplaceOverviewAdvice(null),null);
});
test("The existing Overview board includes and renders one simple info panel, no new planner",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../src/lab-ui.mjs",import.meta.url),"utf8");
 for(const id of ["overviewFireplaceAdvice","overviewFireplaceAdviceHeading",
  "overviewFireplaceAdviceSummary","overviewFireplaceAdviceDetail"]){
  assert.equal(html.split('id="'+id+'"').length-1,1);
  assert.match(ui,new RegExp(id));
 }
 assert.match(ui,/fireplaceOverviewAdvice\(data\)/);
});
