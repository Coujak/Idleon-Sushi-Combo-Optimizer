import {readFileSync} from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import {SUSHI_UPGRADES,SUSHI_KNOWLEDGE,ELIGIBLE_DOUBLERS} from "../src/sushi-reference.mjs";
import {numberText,baseUpgradeCost,getUpgradeRows,getKnowledgeRows,getSushiSnapshot,
 advisorUpgrades,doublerUpgrades,sushiUpgradeDiscounts,sushiUpgradeExtraText,upgradeAffordability} from "../src/lab-model.mjs";
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

test("latest Sushi knowledge tiers use pinned category and effect data",()=>{
 const s={sushi:[[],[],[],[],[],Array(64).fill(0),Array(64).fill(0),Array(64).fill(5)]};
 const k=getKnowledgeRows(s);
 assert.equal(k[63].name,"Chromatic Nigiri");
 assert.equal(k[63].mapped,true);
 assert.equal(k[63].category,0);
 assert.equal(k[63].perLevel,20);
 for(let i=59;i<64;i++){
  assert.equal(k[i].category,0,"Tier "+(i+1)+" must use the game-data default category");
  assert.equal(k[i].perLevel,20);
 }
 assert.ok(k[63].bonus>0);
 assert.equal(k[49].mapped,true);
});

test("Sushi shaker uses are read from Sushi[4] fields 5 through 7",()=>{
 const snap=getSushiSnapshot({sushi:[[],[],[],[],[0,0,0,0,0,2,4,6]]});
 assert.deepEqual(snap.shakers,[2,4,6]);
});

test("Sushi upgrade discounts match the Toolbox's four multiplicative sources",()=>{
 const levels=Array(46).fill(0),tracking=Array(64).fill(0),knowledge=Array(64).fill(0);
 levels[36]=100;
 knowledge[18]=10; // Tier 19: Knowledge upgrade discount
 const research=Array.from({length:18},()=>[]);
 research[7]=Array(20).fill(0);research[7][9]=19; // Jelly obstruction 19 cleared
 const save={sushi:[[],[],levels,[],[],tracking,[],knowledge],spelunk:Array.from({length:53},()=>[]),research};
 const factors=sushiUpgradeDiscounts(save);
 assert.equal(factors.complete,true);
 assert.equal(factors.known,4);
 assert.equal(factors.sources[0].percent,100);
 assert.equal(factors.sources[1].percent,50);
 assert.equal(factors.sources[2].percent,16);
 assert.equal(factors.sources[3].percent,25);
 const expected=.5*.5/(1+.16)/(1+.25);
 assert.ok(Math.abs(factors.factor-expected)<1e-12);
 const wage=getUpgradeRows(save).find(u=>u.shop===1);
 assert.ok(Math.abs(wage.estimatedNextCost/wage.baseNextCost-expected)<1e-12);
 save.spelunk[52]=[36]; // Doubled Wholesale
 assert.equal(sushiUpgradeDiscounts(save).sources[0].percent,200);
});
test("Discount calculator distinguishes partial save data from full estimates",()=>{
 const raw={sushi:[[],[],Array(46).fill(0),[],[],Array(64).fill(0),[],Array(64).fill(0)]};
 const summary=sushiUpgradeDiscounts(raw);
 assert.equal(summary.complete,false);
 assert.equal(summary.known,3);
 assert.equal(summary.sources[3].known,false);
 assert.equal(sushiUpgradeDiscounts(null).known,0);
});
test("Additional Sushi display values resolve only when their inputs exist",()=>{
 const levels=Array(46).fill(0),tracking=Array(64).fill(0),knowledge=Array(64).fill(0);
 levels[29]=10;levels[36]=100;levels[6]=8;
 const save={sushi:[[],[],levels,[],[0,1e8,128],tracking,[],knowledge],spelunk:[]};
 const rows=getUpgradeRows(save);
 assert.equal(sushiUpgradeExtraText(rows.find(u=>u.id===29),save),"58");
 assert.equal(sushiUpgradeExtraText(rows.find(u=>u.id===6),save),"9");
 assert.equal(sushiUpgradeExtraText(rows.find(u=>u.id===36),save),"50%");
 assert.match(sushiUpgradeExtraText(rows.find(u=>u.id===28),save),/Overtuned Fuel/);
 assert.match(sushiUpgradeExtraText(rows.find(u=>u.id===25),save),/Sparks/);
 assert.equal(sushiUpgradeExtraText(rows.find(u=>u.id===8),save),null);
});

test("Bucks affordability uses the discounted next cost, not the base cost",()=>{
 const info={maxLevel:9999,atMax:false,baseNextCost:1000,estimatedNextCost:100,
  costBreakdown:{complete:true}};
 assert.equal(upgradeAffordability(info,100),"affordable");
 assert.equal(upgradeAffordability(info,99.999),"unaffordable");
 assert.equal(upgradeAffordability(info,0),"unaffordable");
 assert.equal(upgradeAffordability({...info,costBreakdown:{complete:false}},99),"uncertain");
 // Missing discounts only ever reduce costs, so sufficient Bucks is a safe conclusion.
 assert.equal(upgradeAffordability({...info,costBreakdown:{complete:false}},100),"affordable");
 assert.equal(upgradeAffordability({...info,atMax:true},1000),"unavailable");
 assert.equal(upgradeAffordability({...info,estimatedNextCost:Infinity},1e50),"unknown");
 assert.equal(upgradeAffordability(info,NaN),"unknown");
});
test("The imported Sushi[4][3] balance is used for affordability",()=>{
 const raw=[[],[],Array(46).fill(0),[],[0,0,0,5e40],Array(64).fill(0),[],Array(64).fill(0)];
 const save={sushi:raw,spelunk:Array.from({length:53},()=>[])};
 const balance=getSushiSnapshot(save).bucks;
 assert.equal(balance,5e40);
 const prices=getUpgradeRows(save);
 const candidate=prices.find(u=>u.shop===1);
 assert.equal(upgradeAffordability(candidate,balance),"affordable");
});

test("Scientific notation omits the positive exponent plus sign across account numbers",()=>{
 assert.equal(numberText(2.99e37),"2.990E37");
 assert.equal(numberText(1.2345e12),"1.234E12");
 assert.equal(numberText(1.234e-5),"1.234E-5");
 const fmt=readFileSync(new URL("../src/progression-goal-impact.mjs",import.meta.url),"utf8");
 assert.match(fmt,/toExponential\(3\)\.replace/);
});
