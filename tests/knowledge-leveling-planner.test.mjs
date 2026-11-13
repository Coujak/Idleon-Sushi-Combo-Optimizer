import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {getKnowledgeRows} from "../src/lab-model.mjs";
import {KNOWLEDGE_LEVELING_GOALS,KNOWLEDGE_LEVELING_ORDERS,
 normalizeKnowledgeLevelingOptions,planKnowledgeLeveling}
 from "../src/knowledge-leveling-planner.mjs";

function account(){
 const tracking=Array(64).fill(-1);
 const xp=Array(64).fill(0);
 const levels=Array(64).fill(0);
 tracking[1]=0;tracking[6]=1;tracking[49]=0;tracking[53]=1;
 levels[1]=5;levels[6]=5;levels[49]=4;levels[53]=4;
 xp[1]=1e12;xp[6]=0;xp[49]=6;xp[53]=0;
 return {sushi:[[],[],[],[],[],tracking,xp,levels]};
}

test("Knowledge planner recommends actionable discovered tiers for the selected bonus",()=>{
 const all=getKnowledgeRows(account());
 const exp=planKnowledgeLeveling(all);
 assert.equal(exp.length,2);
 assert.ok(exp.every(k=>k.discovered&&k.category===1));
 assert.equal(exp[0].tier,2);
 assert.equal(exp[0].ready,true);
 assert.equal(exp[0].remainingExp,0);
 assert.equal(exp[0].targetLevel,6);
 assert.equal(exp[0].nextBonus,exp[0].bonus+exp[0].nextLevelGain);
 const perfectos=planKnowledgeLeveling(all,{category:"10"});
 assert.deepEqual(new Set(perfectos.map(x=>x.tier)),new Set([50,54]));
 assert.equal(perfectos.find(x=>x.tier===54).perfecto,true);
 assert.equal(perfectos.find(x=>x.tier===54).nextBonus,
  perfectos.find(x=>x.tier===54).bonus+perfectos.find(x=>x.tier===54).nextLevelGain);
 assert.deepEqual(planKnowledgeLeveling(all,{category:8}),[]);
});
test("Knowledge goal and ranking options are validated",()=>{
 assert.equal(normalizeKnowledgeLevelingOptions().category,1);
 assert.equal(normalizeKnowledgeLevelingOptions({category:"10",order:"closest"}).category,10);
 assert.equal(normalizeKnowledgeLevelingOptions({category:"99",order:"invalid"}).order,"efficiency");
 assert.ok(KNOWLEDGE_LEVELING_GOALS.some(x=>x.category===10));
 assert.ok(KNOWLEDGE_LEVELING_ORDERS.some(x=>x.value==="gain"));
 assert.equal(new Set(KNOWLEDGE_LEVELING_GOALS.map(x=>x.category)).size,11);
});
test("Knowledge ranking is ready-first, then goal-specific and stable",()=>{
 const rows=[
  {tier:1,category:1,name:"A",discovered:true,levelKnown:true,xpKnown:true,mapped:true,
   level:3,xp:30,xpReq:30,xpRemaining:0,bonus:10,nextLevelGain:2,readyToLevel:true},
  {tier:2,category:1,name:"B",discovered:true,levelKnown:true,xpKnown:true,mapped:true,
   level:2,xp:5,xpReq:105,xpRemaining:100,bonus:20,nextLevelGain:10,readyToLevel:false},
  {tier:3,category:1,name:"C",discovered:true,levelKnown:true,xpKnown:true,mapped:true,
   level:5,xp:15,xpReq:25,xpRemaining:10,bonus:30,nextLevelGain:1,readyToLevel:false},
  {tier:4,category:1,name:"D",discovered:true,levelKnown:false,xpKnown:true,mapped:true,
   level:0,xp:0,xpReq:10,xpRemaining:10,bonus:0,nextLevelGain:50,readyToLevel:false}
 ];
 assert.deepEqual(planKnowledgeLeveling(rows).map(x=>x.tier),[1,2,3]);
 assert.deepEqual(planKnowledgeLeveling(rows,{order:"closest"}).map(x=>x.tier),[1,3,2]);
 assert.deepEqual(planKnowledgeLeveling(rows,{order:"gain"}).map(x=>x.tier),[1,2,3]);
 assert.deepEqual(planKnowledgeLeveling(rows,{category:10}),[]);
 assert.deepEqual(planKnowledgeLeveling(null),[]);
 assert.deepEqual(planKnowledgeLeveling([{...rows[0],xpRemaining:Infinity}]),[]);
});
test("Knowledge Leveling has its own planner tab, simple controls, and no duplicate Knowledge table",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const nav=readFileSync(new URL("../src/perfecto-ui.mjs",import.meta.url),"utf8");
 const lab=readFileSync(new URL("../src/lab-ui.mjs",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../src/knowledge-leveling-ui.mjs",import.meta.url),"utf8");
 const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
 assert.ok(html.includes('data-planner-target="knowledge"'));
 assert.ok(html.includes('id="knowledgePlanner"'));
 for(const id of ["knowledgePlanGoal","knowledgePlanOrder","knowledgePlanFeatured",
  "knowledgePlanAlternatives","knowledgePlanTips","knowledgePlanStatus"])
  assert.ok(html.includes('id="'+id+'"'),id+" missing");
 assert.ok(nav.includes('const tabs=["combo","perfecto","knowledge"]'));
 assert.ok(nav.includes('$("knowledgePlanner").classList.toggle'));
 assert.ok(lab.includes("initializeKnowledgeLevelingUI(getSave)"));
 assert.ok(lab.includes("knowledgeLevelingUI.refresh()"));
 assert.match(ui,/planKnowledgeLeveling\(getKnowledgeRows\(save\)/);
 assert.ok(ui.includes("localStorage.setItem(PREF_KEY"));
 assert.ok(ui.includes('formatKnowledgeBonusValue(item.category,item.nextBonus)'));
 assert.ok(ui.includes('assets/Perfecto_Symbol.png'));
 assert.ok(css.includes("#knowledgePlanner .lab-kp-card.is-featured"));
 assert.ok(!css.includes("#knowledgePlanner .lab-knowledge-table thead th"));
});
