import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {SUSHI_UPGRADES} from "../src/sushi-reference.mjs";
import {getUpgradeRows} from "../src/lab-model.mjs";
import {CATALOG_SORT_OPTIONS,CATALOG_STATUS_OPTIONS,upgradeSummary,readableUpgradeDescription,catalogHasVariableValues,filterSortCatalog} from "../src/upgrade-catalog.mjs";

const upgrades=getUpgradeRows(null);
test("All 46 upgrades have readable short summaries",()=>{
 assert.equal(SUSHI_UPGRADES.length,46);
 assert.ok(upgrades.every(u=>upgradeSummary(u).length>20&&upgradeSummary(u).length<135));
 assert.equal(upgradeSummary(upgrades[0]).includes("{"),false);
 assert.ok(upgradeSummary(upgrades.find(u=>u.name==="Heat of the East Wind")).includes("tier-up"));
});
test("Full descriptions remove raw game placeholder tokens",()=>{
 const raw=SUSHI_UPGRADES.find(u=>u.name==="Fastburn Fuel II").description;
 const cleaned=readableUpgradeDescription(raw);
 assert.equal(catalogHasVariableValues(raw),true);
 assert.ok(cleaned.includes("[variable]%"));
 assert.ok(cleaned.includes("[in-game value]×"));
 assert.ok(!/[{}@$]/.test(cleaned));
 assert.equal(catalogHasVariableValues(SUSHI_UPGRADES.find(u=>u.name==="Sushi Slot").description),false);
});
test("Category filter includes utility and excludes unrelated goals",()=>{
 const bucks=filterSortCatalog(upgrades,{category:"bucks"});
 assert.ok(bucks.length>0&&bucks.every(u=>u.goals.includes("bucks")));
 const other=filterSortCatalog(upgrades,{category:"other"});
 assert.ok(other.length>0&&other.every(u=>u.goals.length===0));
 assert.ok(other.some(u=>u.name==="Combo Meter"));
 assert.ok(filterSortCatalog(upgrades,{query:"Fuel Capacity IV"}).some(u=>u.shop===31));
 assert.ok(filterSortCatalog(upgrades,{query:"tier-up"}).some(u=>u.name==="Heat of the East Wind"));
});
test("Sort defaults to in-game shop order, and name sorting is deterministic",()=>{
 assert.deepEqual(filterSortCatalog(upgrades).map(u=>u.shop),Array.from({length:46},(_,i)=>i+1));
 const asc=filterSortCatalog(upgrades,{sort:"name-asc"});
 const desc=filterSortCatalog(upgrades,{sort:"name-desc"});
 assert.equal(asc.at(0).name.localeCompare(asc.at(-1).name)<0,true);
 assert.deepEqual(desc.map(u=>u.shop),asc.map(u=>u.shop).reverse());
});
test("Saved account statuses, Doubler and costs filter and sort correctly",()=>{
 const s={sushi:[[],[],Array(46).fill(0),[],[],[],[],[]],spelunk:Array.from({length:53},()=>[])};
 s.sushi[2][0]=50;
 s.sushi[2][8]=5;
 s.sushi[2][41]=7;
 s.spelunk[52]=[8,41];
 const actual=getUpgradeRows(s);
 const maxed=filterSortCatalog(actual,{status:"maxed",hasSave:true});
 assert.ok(maxed.some(u=>u.name==="Sushi Slot"));
 assert.ok(maxed.every(u=>u.maxLevel>0&&u.atMax));
 const notMaxed=filterSortCatalog(actual,{status:"not-maxed",hasSave:true});
 assert.ok(notMaxed.every(u=>u.maxLevel>0&&!u.atMax));
 const doubled=filterSortCatalog(actual,{status:"doubled",hasSave:true});
 assert.equal(doubled.length,2);
 const eligible=filterSortCatalog(actual,{status:"eligible"});
 assert.ok(eligible.every(u=>u.doublerEligible));
 const byLevel=filterSortCatalog(actual,{sort:"level-desc",hasSave:true});
 assert.ok(byLevel[0].level>=byLevel.at(-1).level);
 const byPrice=filterSortCatalog(actual,{sort:"cost-asc",hasSave:true});
 const costs=byPrice.filter(u=>!u.atMax&&Number.isFinite(u.baseNextCost)).map(u=>u.baseNextCost);
 assert.ok(costs.every((n,i)=>i===0||n>=costs[i-1]));
 assert.equal(byPrice.at(-1).atMax,true);
 assert.equal(filterSortCatalog(actual,{status:"doubled",hasSave:false}).length,0);
 assert.deepEqual(filterSortCatalog(actual,{sort:"cost-asc",hasSave:false}).map(u=>u.shop),upgrades.map(u=>u.shop));
});
test("Upgrade Catalog has accessible controls without the reference footer",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../src/lab-ui.mjs",import.meta.url),"utf8");
 for(const id of ["labUpgradeSearch","labUpgradeCategory","labUpgradeStatus","labUpgradeSort","labUpgradeCount","labUpgradeEmpty"])
  assert.ok(html.includes('id="'+id+'"'));
 for(const col of ["name","level","cost","doubler"])assert.ok(html.includes('data-catalog-column="'+col+'"'));
 assert.ok(!html.includes('id="labReferenceSource"'));
 assert.ok(!ui.includes('labReferenceSource'));
 assert.ok(ui.includes('lab-catalog-summary'));
 assert.equal(CATALOG_SORT_OPTIONS[0].value,"shop");
 assert.equal(CATALOG_STATUS_OPTIONS[0].value,"all");
});

test("Account levels replace supported upgrade bonus placeholders, including Doubler",()=>{
 const save={sushi:[[],[],Array(46).fill(0),[],[],[],[],[]],spelunk:Array.from({length:53},()=>[])};
 save.sushi[2][41]=1240;
 const hourly=getUpgradeRows(save).find(u=>u.shop===1);
 const description=readableUpgradeDescription(hourly.description,hourly,true);
 assert.match(description,/\+1,240% total Bucks/);
 assert.equal(catalogHasVariableValues(hourly.description,hourly,true),false);
 assert.match(readableUpgradeDescription(hourly.description,hourly,false),/\+\[variable\]%/);

 save.spelunk[52]=[41];
 const doubled=getUpgradeRows(save).find(u=>u.shop===1);
 assert.match(readableUpgradeDescription(doubled.description,doubled,true),/\+2,480% total Bucks/);
 assert.equal(doubled.rawBonus,2480);
});
test("Other supported per-level percentages and amounts use the imported level",()=>{
 const save={sushi:[[],[],Array(46).fill(0),[],[],[],[],[]],spelunk:[]};
 save.sushi[2][30]=9;  // Customer Surcharge I: +2% per level
 save.sushi[2][35]=5;  // Quickpay Fee: +1 minute per level
 const rows=getUpgradeRows(save);
 const surcharge=rows.find(u=>u.name==="Customer Surcharge I");
 const quickpay=rows.find(u=>u.name==="Quickpay Fee");
 assert.match(readableUpgradeDescription(surcharge.description,surcharge,true),/\+18%/);
 assert.match(readableUpgradeDescription(quickpay.description,quickpay,true),/5 minutes/);
});
test("Descriptions preserve unknown non-linear game values instead of guessing",()=>{
 const save={sushi:[[],[],Array(46).fill(0),[],[],[],[],[]],spelunk:[]};
 save.sushi[2][9]=10;
 const fuel= getUpgradeRows(save).find(u=>u.name==="Fastburn Fuel II");
 const text=readableUpgradeDescription(fuel.description,fuel,true);
 assert.match(text,/\+1,000% faster Fuel/);
 assert.match(text,/\[in-game value\]× Fuel Generation/);
 assert.ok(catalogHasVariableValues(fuel.description,fuel,true));
});
