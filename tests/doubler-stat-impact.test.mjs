import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {getUpgradeRows} from "../src/lab-model.mjs";
import {getDoublerValueComparison} from "../src/doubler-advisor.mjs";
import {getDoublerAccountImpact} from "../src/doubler-stat-impact.mjs";
import {parseGameQuantity} from "../src/progression-calibration.mjs";

function fixture(){
 const levels=Array(46).fill(0);
 for(const [id,level] of Object.entries({
  1:400,8:500,9:100,20:10,21:15,22:5,30:100,31:200,35:60,36:50,37:80,38:100
 }))levels[Number(id)]=level;
 const tiles=Array(120).fill(-1);
 tiles[0]=18;tiles[1]=21;
 const spelunk=Array.from({length:53},()=>[]);
 spelunk[52]=[31,38,21];
 const research=Array.from({length:18},()=>[]);
 research[7]=Array(20).fill(0);
 const sushi=[tiles.slice(),Array(120).fill(0),levels,Array(15).fill(0),
  [0,1e6,100,1e15,0,1,1,1,2000],Array(64).fill(0),
  Array(64).fill(0),Array(64).fill(0)];
 return {sushi,spelunk,research,menagerie:[[],[],[],Array(11).fill(0)],
  tiles,slots:Array(120).fill(0),fires:Array(15).fill(0)};
}
function impact(save,id,readings){
 const upgrade=getUpgradeRows(save).find(u=>u.id===id);
 return getDoublerAccountImpact(save,upgrade,{readings});
}
function quantity(s){
 const n=parseGameQuantity(s?.replace(/(?: EXP \/ Sushi| Bucks\/hr| Fuel\/hr| Fuel)$/,""));
 return n;
}

test("Knowledge shows account-wide modeled EXP per Sushi below both Searing upgrades",()=>{
 const save=fixture(),unchanged=JSON.stringify(save);
 for(const id of [37,38]){
  const row=impact(save,id);
  assert.equal(row.goal,"knowledge");
  assert.match(row.label,/Knowledge EXP per created Sushi/);
  assert.match(row.without,/EXP \/ Sushi$/);
  assert.match(row.withDoubler,/EXP \/ Sushi$/);
  assert.ok(quantity(row.withDoubler)>quantity(row.without));
  assert.match(row.note,/Partial model/);
 }
 const second=getUpgradeRows(save).find(u=>u.id===37);
 const base=getDoublerValueComparison(second);
 assert.equal(base.normal,"9 EXP");
 assert.equal(base.doubled,"17 EXP");
 assert.equal(JSON.stringify(save),unchanged,"Calculations must not modify imported assignments");
});

test("Wholesale Pricing changes the combined modeled account discount",()=>{
 const save=fixture(),current=impact(save,36);
 assert.equal(current.goal,"discount");
 assert.match(current.label,/Upgrade price discount/);
 assert.match(current.without,/%$/);
 assert.match(current.withDoubler,/%$/);
 assert.ok(parseFloat(current.withDoubler)>parseFloat(current.without));
 assert.match(current.note,/discount/i);
 // Other discount sources are retained, so the account discount differs
 // from just the standalone Wholesale Pricing effect.
 const owned=getUpgradeRows(save).find(u=>u.id===36);
 const direct=getDoublerValueComparison(owned);
 assert.equal(direct.normal,"33.33%");
 assert.equal(direct.doubled,"50%");
});

test("Bucks generation projects Bucks/hr when board data exists",()=>{
 const save=fixture();
 const doubled=impact(save,31);
 assert.equal(doubled.goal,"bucks");
 assert.equal(doubled.currentSide,"with");
 assert.match(doubled.without,/Bucks\/hr$/);
 assert.match(doubled.withDoubler,/Bucks\/hr$/);
 assert.ok(quantity(doubled.withDoubler)>quantity(doubled.without));
 const other=impact(save,30);
 assert.equal(other.currentSide,"without");
 assert.ok(quantity(other.withDoubler)>quantity(other.without));
});

test("Optional in-game rates anchor projections without claiming exact simulation",()=>{
 const save=fixture();
 const before=JSON.stringify(save);
 const bucks=impact(save,31,{bucks:"1.25E30"});
 assert.match(bucks.basis,/Anchored to in-game reading/);
 assert.equal(bucks.withDoubler,"1.25No Bucks/hr");
 assert.ok(quantity(bucks.without)<quantity(bucks.withDoubler));
 const fuel=impact(save,9,{fuel:"22.2T"});
 assert.match(fuel.without,/Fuel\/hr/);
 assert.equal(fuel.without,"22.2T Fuel/hr");
 assert.ok(quantity(fuel.withDoubler)>quantity(fuel.without));
 const cap=impact(save,1,{capacity:"6.23T"});
 assert.match(cap.without,/Fuel$/);
 assert.equal(cap.without,"6.23T Fuel");
 assert.ok(quantity(cap.withDoubler)>quantity(cap.without));
 assert.equal(JSON.stringify(save),before);
});

test("Perfecto chance follows the doubled free-use quantity, not Perfecto roll odds",()=>{
 const row=impact(fixture(),21);
 assert.equal(row.goal,"perfecto");
 assert.equal(row.without,"15%");
 assert.equal(row.withDoubler,"30%");
 assert.match(row.note,/not the chance that a Sushi becomes Perfecto/);
});

test("Action-only upgrades do not fabricate passive Bucks or Fuel gains",()=>{
 const save=fixture();
 const quickpay=impact(save,35);
 assert.equal(quickpay.withDoubler,quickpay.without);
 assert.match(quickpay.note,/instant Bucks/);
 const saffron=impact(save,22);
 assert.equal(saffron.withDoubler,saffron.without);
 assert.match(saffron.note,/Shaker Bucks/);
 const shaker=impact(save,20);
 assert.equal(shaker.withDoubler,shaker.without);
 assert.match(shaker.note,/Shaker is used/);
 const fuel=impact(save,8);
 assert.ok(quantity(fuel.withDoubler)>quantity(fuel.without));
});

test("With missing board show the partial multiplier, never invent Bucks/hr",()=>{
 const save=fixture();
 save.tiles.fill(-1);save.sushi[0].fill(-1);
 const row=impact(save,31);
 assert.equal(row.label,"Known passive Bucks multiplier");
 assert.match(row.without,/×$/);
 assert.match(row.withDoubler,/×$/);
 assert.match(row.basis,/Bucks\/hr unavailable/);
 const measured=impact(save,31,{bucks:"2E32"});
 assert.match(measured.without,/Bucks\/hr$/);
 assert.match(measured.basis,/Anchored/);
 assert.equal(getDoublerAccountImpact(save,null),null);
});

test("Doubler UI shows account results beneath each raw comparison",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../src/lab-ui.mjs",import.meta.url),"utf8");
 const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
 assert.ok(ui.includes("getDoublerAccountImpact(save(),u,{readings})"));
 assert.ok(ui.includes('el("div","lab-doubler-account-stat")'));
 assert.ok(ui.includes('option.account'));
 assert.ok(ui.includes('impact.label'));
 assert.ok(ui.includes('impact.basis'));
 assert.ok(ui.includes('renderAdvisor();renderDoubler()'));
 assert.ok(css.includes(".lab-doubler-account-stat{"));
 assert.ok(css.includes(".lab-doubler-impact-note{"));
 assert.match(html,/labDoublerAdvice/);
});
