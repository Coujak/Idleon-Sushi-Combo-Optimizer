import test from "node:test";
import assert from "node:assert/strict";
import {cookingTierOverflow,getSushiDashboardMetrics} from "../src/dashboard-metrics.mjs";
import {readFileSync} from "node:fs";

function save(){
 const sushi=Array.from({length:8},()=>[]);
 sushi[0]=Array(120).fill(-1);
 sushi[1]=Array(120).fill(0);
 sushi[2]=Array(46).fill(0);
 sushi[3]=Array(15).fill(0);
 sushi[4]=[1e8,0,0,1e30];
 sushi[5]=Array(64).fill(-1);
 sushi[6]=Array(64).fill(0);
 sushi[7]=Array(64).fill(0);
 const research=Array.from({length:18},()=>[]);
 research[7]=Array(20).fill(0);
 return {sushi,tiles:sushi[0].slice(),slots:sushi[1].slice(),
  fires:sushi[3].slice(),research,spelunk:Array.from({length:53},()=>[])};
}
test("120% cooking tier-up rollover means guaranteed +1 and 20% at least +2",()=>{
 assert.deepEqual(cookingTierOverflow(0),
  {guaranteed:0,remainder:0,atLeastOne:0,atLeastTwo:0});
 assert.deepEqual(cookingTierOverflow(80),
  {guaranteed:0,remainder:80,atLeastOne:80,atLeastTwo:0});
 assert.deepEqual(cookingTierOverflow(120),
  {guaranteed:1,remainder:20,atLeastOne:100,atLeastTwo:20});
 assert.deepEqual(cookingTierOverflow(220),
  {guaranteed:2,remainder:20,atLeastOne:100,atLeastTwo:100});
 assert.equal(cookingTierOverflow(Infinity).atLeastTwo,null);
});
test("Cooking chance includes Quality Freshness plus tracked Sushi Knowledge, without blue fireplace",()=>{
 const s=save();
 s.sushi[2][7]=25;
 s.sushi[5][2]=0;
 s.sushi[7][2]=1000;
 const d=getSushiDashboardMetrics(s);
 assert.equal(d.qualityFreshness,25);
 assert.ok(d.knowledgeCookBonus>100);
 assert.ok(d.cookTierBonus>100);
 assert.equal(d.chanceAtLeastOne,100);
 assert.ok(d.chanceAtLeastTwo>0);
 assert.equal(d.blueColumns,0);
 assert.equal(d.blueProcChance,0);
 assert.ok(Number.isFinite(d.fuelRate));
 assert.ok(Number.isFinite(d.fuelCapacity));
});
test("Partial imports show unknown bonus rather than fabricated proc chance",()=>{
 const s=save();
 s.sushi[5]=[];
 s.sushi[7]=[];
 const d=getSushiDashboardMetrics(s);
 assert.equal(d.chanceAtLeastTwo,null);
 assert.equal(d.chanceAtLeastOne,null);
 assert.equal(getSushiDashboardMetrics(null),null);
});
test("Dashboard and Knowledge progress render guards are visible in UI",()=>{
 const ui=readFileSync(new URL("../src/lab-ui.mjs",import.meta.url),"utf8");
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 assert.match(html,/id="labProductionStats"/);
 assert.match(ui,/getSushiDashboardMetrics\(data\)/);
 assert.match(ui,/Number\.isFinite\(k\.xpProgress\*100\)/);
 assert.match(ui,/k\.xpProgress>=0&&k\.xpProgress<=1/);
 assert.match(ui,/Cooking: at least \+2 tiers/);
});
