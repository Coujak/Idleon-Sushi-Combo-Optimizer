import test from "node:test";
import assert from "node:assert/strict";
import {SUSHI_UPGRADES,SUSHI_KNOWLEDGE,ELIGIBLE_DOUBLERS} from "../src/sushi-reference.mjs";
import {baseUpgradeCost,getUpgradeRows,getKnowledgeRows,getSushiSnapshot,
 advisorUpgrades,doublerUpgrades} from "../src/lab-model.mjs";
test("reference data follows current Sushi shop order and 64 knowledge tiers",()=>{
 assert.equal(SUSHI_UPGRADES.length,46);
 assert.equal(new Set(SUSHI_UPGRADES.map(x=>x.id)).size,46);
 assert.equal(SUSHI_UPGRADES[0].shop,1);
 assert.equal(SUSHI_UPGRADES.find(x=>x.id===39).name,"Combo Meter");
 assert.equal(SUSHI_KNOWLEDGE.length,64);
 assert.equal(ELIGIBLE_DOUBLERS.length,25);
});
test("upgrade cost grows and doublers double per-level effects without changing the cost",()=>{
 const save={sushi:[[],[],Array(46).fill(0),[],[],Array(64).fill(0),[],Array(64).fill(0)],spelunk:Array.from({length:53},()=>[])};
 save.sushi[2][8]=4;save.spelunk[52]=[8];
 const u=getUpgradeRows(save).find(x=>x.id===8);
 assert.equal(u.level,4);
 assert.equal(u.doubled,true);
 assert.equal(u.increment,30);
 assert.equal(u.rawBonus,120);
 assert.ok(baseUpgradeCost(u,5)>baseUpgradeCost(u,4));
});
test("Knowledge bonus includes Perfecto multiplier and account progress",()=>{
 const save={sushi:[[],[],[],[],[],Array(64).fill(-1),Array(64).fill(0),Array(64).fill(0)],slots:Array(100).fill(0),tiles:Array(100).fill(0)};
 save.sushi[5][49]=1;save.sushi[7][49]=29;
 const rows=getKnowledgeRows(save);
 assert.equal(rows.length,64);
 assert.equal(rows[49].perfecto,true);
 assert.ok(rows[49].bonus>rows[49].nextLevelGain);
 assert.equal(rows[50].discovered,false);
 assert.equal(getSushiSnapshot(save).perfectos,1);
});
test("advisor goals and doubler eligibility use actual upgrade ids",()=>{
 const s={sushi:[[],[],Array(46).fill(10),[],[],[],[],[]],spelunk:Array.from({length:53},()=>[])};
 s.spelunk[52]=[31];
 assert.ok(advisorUpgrades(s,"bucks").some(x=>x.id===31));
 assert.ok(doublerUpgrades(s,"bucks").some(x=>x.id===31&&x.doubled));
 assert.ok(doublerUpgrades(s,"all").every(x=>x.doublerEligible));
});

test("knowledge tiers lacking reference bonus metadata are labelled unknown, not zero",()=>{
 const s={sushi:[[],[],[],[],[],Array(64).fill(0),Array(64).fill(0),Array(64).fill(5)]};
 const k=getKnowledgeRows(s);
 assert.equal(k[63].name,"Chromatic Nigiri");
 assert.equal(k[63].mapped,false);
 assert.equal(k[63].bonus,null);
 assert.equal(k[49].mapped,true);
});
