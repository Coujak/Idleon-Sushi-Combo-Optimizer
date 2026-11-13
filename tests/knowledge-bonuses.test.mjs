import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {SUSHI_KNOWLEDGE} from "../src/sushi-reference.mjs";
import {sushiTierReward,SUSHI_TIER_REWARDS} from "../src/sushi-tier-rewards.mjs";
import {describeKnowledgeBonus,formatKnowledgeBonusValue} from "../src/knowledge-bonus-format.mjs";
import {getKnowledgeRows} from "../src/lab-model.mjs";
import {filterKnowledgeRows} from "../src/knowledge-view.mjs";

function sampleSave(){
 const sushi=Array.from({length:8},()=>[]);
 sushi[5]=Array(64).fill(-1);
 sushi[6]=Array(64).fill(0);
 sushi[7]=Array(64).fill(0);
 sushi[5][0]=0;sushi[5][1]=1;
 sushi[7][0]=12;sushi[7][1]=7;
 return {sushi};
}
test("Every Sushi tier has one non-empty documented permanent reward",()=>{
 assert.equal(SUSHI_TIER_REWARDS.length,64);
 assert.equal(SUSHI_KNOWLEDGE.length,64);
 for(const {tier} of SUSHI_KNOWLEDGE){
  const bonus=sushiTierReward(tier);
  assert.equal(typeof bonus,"string","Missing T"+tier);
  assert.ok(bonus.length>=10,"Incomplete reward for T"+tier);
 }
 assert.equal(sushiTierReward(0),null);
 assert.equal(sushiTierReward(65),null);
 assert.match(sushiTierReward(1),/Research EXP/);
 assert.match(sushiTierReward(50),/Total Damage/);
 assert.match(sushiTierReward(64),/Jelly Operator/);
});
test("Tier rewards are visible even when undiscovered or without account data",()=>{
 const noAccount=getKnowledgeRows(null);
 assert.equal(noAccount[0].discovered,false);
 assert.match(noAccount[0].tierReward,/Research EXP/);
 assert.ok(noAccount[0].baseLevelBonus>0);
 assert.equal(noAccount[0].bonus,null);
 const tracked=getKnowledgeRows(sampleSave());
 assert.equal(tracked[0].discovered,true);
 assert.equal(tracked[0].tierReward,noAccount[0].tierReward);
 assert.equal(tracked[1].perfecto,true);
 assert.equal(tracked[1].nextLevelGain,2*tracked[1].baseLevelBonus);
 assert.ok(tracked[1].bonus>0);
});
test("Knowledge descriptions distinguish percentages from multiplicative effects",()=>{
 assert.equal(describeKnowledgeBonus(0,120),"+120% Sushi Bucks generated");
 assert.equal(describeKnowledgeBonus(1,30),"+30% Knowledge EXP");
 assert.equal(describeKnowledgeBonus(2,20),"+20% chance of +1 cooked tier");
 assert.equal(describeKnowledgeBonus(3,50),"1.5× maximum Fuel capacity");
 assert.equal(describeKnowledgeBonus(4,75),"+75% Fuel generation");
 assert.equal(describeKnowledgeBonus(5,10),"+10% chance of a free Shaker use");
 assert.equal(describeKnowledgeBonus(6,10),"+10% upgrade discount bonus");
 assert.equal(describeKnowledgeBonus(7,25),"1.25× Fuel generation");
 assert.equal(describeKnowledgeBonus(8,2),"+2% stronger slot effects");
 assert.equal(describeKnowledgeBonus(9,8),"+8% stronger fireplace effects");
 assert.equal(describeKnowledgeBonus(10,263),"3.63× Perfecto chance");
 assert.equal(describeKnowledgeBonus(10,Infinity),"Unavailable");
});
test("Search finds permanent rewards rather than only Knowledge categories",()=>{
 const rows=getKnowledgeRows(null);
 assert.deepEqual(filterKnowledgeRows(rows,{query:"Divinity Points"}).map(x=>x.tier),[47]);
 assert.deepEqual(filterKnowledgeRows(rows,{query:"Royal Guard"}).map(x=>x.tier),[60,61,63]);
});
test("Knowledge table combines name and tier reward, keeps four columns and Perfecto icon",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../src/lab-ui.mjs",import.meta.url),"utf8");
 assert.match(html,/<th scope="col">Sushi tier<\/th>/);
 assert.match(html,/<th scope="col">Knowledge level<\/th>/);
 assert.match(html,/<th scope="col">EXP to next level<\/th>/);
 assert.match(html,/<th scope="col">Knowledge Bonus<\/th>/);
 assert.doesNotMatch(html,/<th scope="col">Perfecto<\/th>/);
 assert.doesNotMatch(html,/<th scope="col">Tier reward · permanent<\/th>/);
 assert.match(ui,/tr\.append\(tier,levelCell,xpCell,bonus\)/);
 assert.match(ui,/lab-knowledge-perfecto-emblem/);
 assert.match(ui,/mark\.src="assets\/Perfecto_Symbol\.png"/);
 assert.doesNotMatch(ui,/lab-knowledge-perfecto-emblem","✦"/);
 assert.match(ui,/k\.tierReward\?\?"Tier reward unavailable"/);
 assert.match(ui,/describeKnowledgeBonus\(k\.category,k\.bonus\)/);
 assert.match(ui,/describeKnowledgeBonus\(k\.category,nextAmount\)/);
 assert.match(ui,/formatKnowledgeBonusValue\(k\.category,k\.baseLevelBonus\)/);
});

test("Knowledge bubble formatter keeps only numbers and preserves bonus units",()=>{
 const cases=[
  [0,120,"+120%"],[1,30,"+30%"],[2,1200,"+1.2K%"],
  [3,50,"1.5×"],[4,75,"+75%"],[5,10,"+10%"],
  [6,10,"+10%"],[7,25,"1.25×"],[8,2,"+2%"],
  [9,8,"+8%"],[10,263,"3.63×"]
 ];
 for(const [category,amount,expected] of cases)
  assert.equal(formatKnowledgeBonusValue(category,amount),expected);
 assert.equal(formatKnowledgeBonusValue(0,Infinity),null);
 assert.equal(formatKnowledgeBonusValue(1,NaN),null);
 assert.equal(formatKnowledgeBonusValue(12,5),null);
});
