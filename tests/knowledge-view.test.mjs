import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {getKnowledgeRows} from "../src/lab-model.mjs";
import {formatKnowledgeBonusValue} from "../src/knowledge-bonus-format.mjs";
import {describeKnowledgeBonus} from "../src/knowledge-bonus-format.mjs";
import {filterKnowledgeRows,knowledgeOverview,KNOWLEDGE_SORT_OPTIONS,KNOWLEDGE_STATUS_OPTIONS,
 KNOWLEDGE_PREFERENCES_KEY,normalizeKnowledgePreferences,nextKnowledgeHeaderSort,knowledgeCheckpoint}
 from "../src/knowledge-view.mjs";

function fixture(){
 const track=Array(64).fill(-1),exp=Array(64).fill(0),levels=Array(64).fill(0);
 track[0]=0;track[1]=1;track[2]=0;track[49]=1;
 levels[0]=5;levels[1]=5;levels[2]=2;levels[49]=29;
 exp[0]=6;exp[1]=1e12;exp[2]=0;exp[49]=350;
 return {sushi:[[],[],[],[],[],track,exp,levels]};
}
test("EXP progress respects next-level cost and can be ready to claim",()=>{
 const rows=getKnowledgeRows(fixture());
 assert.equal(rows.length,64);
 assert.equal(rows[0].xpKnown,true);
 assert.equal(rows[0].levelKnown,true);
 assert.equal(rows[0].readyToLevel,false);
 assert.ok(rows[0].xpRemaining>0);
 assert.ok(rows[0].xpProgress>0&&rows[0].xpProgress<1);
 assert.equal(rows[1].readyToLevel,true);
 assert.equal(rows[1].xpRemaining,0);
 assert.equal(rows[1].xpProgress,1);
 assert.equal(rows[3].discovered,false);
 assert.equal(rows[3].readyToLevel,false);
 assert.equal(rows[3].xpProgress,null);
});
test("Missing EXP or Knowledge level is unknown rather than zero progress",()=>{
 const save=fixture();
 save.sushi[6][0]=undefined;
 save.sushi[7][2]=null;
 const rows=getKnowledgeRows(save);
 assert.equal(rows[0].xpKnown,false);
 assert.equal(rows[0].xp,null);
 assert.equal(rows[0].xpProgress,null);
 assert.equal(rows[0].readyToLevel,false);
 assert.equal(rows[2].levelKnown,false);
 assert.equal(rows[2].bonus,null);
 assert.equal(rows[2].xpProgress,null);
 const none=getKnowledgeRows(null);
 assert.ok(none.every(k=>k.xpProgress===null&&!k.readyToLevel));
});
test("Knowledge filters support ready, Perfecto, discovery, categories and text",()=>{
 const rows=getKnowledgeRows(fixture());
 assert.deepEqual(filterKnowledgeRows(rows,{status:"ready"}).map(k=>k.tier),[2]);
 assert.deepEqual(filterKnowledgeRows(rows,{status:"perfecto"}).map(k=>k.tier),[2,50]);
 assert.deepEqual(filterKnowledgeRows(rows,{status:"unfinished"}).map(k=>k.tier),[1,3]);
 assert.deepEqual(filterKnowledgeRows(rows,{status:"discovered"}).map(k=>k.tier),[1,2,3,50]);
 assert.equal(filterKnowledgeRows(rows,{status:"undiscovered"}).length,60);
 assert.deepEqual(filterKnowledgeRows(rows,{category:"1"}).map(k=>k.tier).slice(0,2),[2,7]);
 assert.deepEqual(filterKnowledgeRows(rows,{query:"Soylent"}).map(k=>k.tier),[50]);
 assert.deepEqual(filterKnowledgeRows(rows,{query:"t50"}).map(k=>k.tier),[50]);
});
test("Knowledge sorting preserves stable tier tie-breakers and puts unknown progress last",()=>{
 const rows=getKnowledgeRows(fixture());
 assert.deepEqual(filterKnowledgeRows(rows,{status:"discovered",sort:"level-desc"}).map(k=>k.tier),
  [50,1,2,3]);
 assert.deepEqual(filterKnowledgeRows(rows,{status:"discovered",sort:"progress-desc"}).map(k=>k.tier),
  [2,1,50,3]);
 assert.equal(filterKnowledgeRows(rows,{sort:"next"})[0].tier,2);
 assert.equal(filterKnowledgeRows(rows,{sort:"tier-desc"})[0].tier,64);
 assert.ok(KNOWLEDGE_SORT_OPTIONS.some(o=>o.value==="next"));
 assert.ok(KNOWLEDGE_STATUS_OPTIONS.some(o=>o.value==="ready"));
});
test("Knowledge overview summarizes discovered and only actually tracked levels",()=>{
 const rows=getKnowledgeRows(fixture());
 const overview=knowledgeOverview(rows,true);
 assert.equal(overview.discovered,4);
 assert.equal(overview.perfectos,2);
 assert.equal(overview.totalLevels,41);
 assert.equal(overview.ready,1);
 assert.equal(overview.tracked,4);
 assert.ok(overview.categoryTotals.length>0);
 assert.deepEqual(knowledgeOverview(rows,false).discovered,null);
});
test("Knowledge tab renders EXP progress and one compact filter toolbar",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../src/lab-ui.mjs",import.meta.url),"utf8");
 const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
 for(const id of ["labKnowledgeOverview","labKnowledgeSearch",
  "labKnowledgeCategory","labKnowledgeStatus","labKnowledgeSort","labKnowledgeCount","labKnowledgeRows"])
  assert.ok(html.includes('id="'+id+'"'),id+" missing");
 assert.ok(html.includes("lab-catalog-toolbar lab-knowledge-toolbar"));
 assert.ok(ui.includes("filterKnowledgeRows(all,"));
 assert.ok(ui.includes("knowledgeOverview(all,hasSave)"));
 assert.ok(ui.includes('el("progress","lab-knowledge-exp-progress")'));
 assert.ok(ui.includes("k.readyToLevel"));
 assert.ok(ui.includes('knowledgeCategoryInput.addEventListener("change"'));
 assert.ok(css.includes("#lab-knowledge .lab-knowledge-exp-progress"));
 assert.ok(css.includes("#lab-knowledge .lab-knowledge-toolbar"));
 assert.ok(!html.includes('id="labKnowledgeCategoryChips"'),
  "Redundant effect chips should be removed");
 assert.ok(!ui.includes('const chips=$("labKnowledgeCategoryChips")'),
  "Renderer should not require deleted chips");
 assert.ok(!css.includes("#lab-knowledge .lab-knowledge-category-chip"),
  "Remove unused category chip CSS");
 assert.ok(css.includes("height:12px"),"EXP progress bar is taller");
 assert.ok(css.includes("background:linear-gradient(90deg,#28b88b"),
  "EXP bar has a higher-contrast fill");
});

test("Knowledge tab actually renders imported tiers, ready filter and missing-save state",()=>{
 const ui=readFileSync(new URL("../src/lab-ui.mjs",import.meta.url),"utf8");
 const start=ui.indexOf(" function renderKnowledge(){");
 const end=ui.indexOf(" const perfectoUI=initializePerfectoUI(",start);
 assert.ok(start>=0&&end>start,"Locate Knowledge renderer");
 class Node{
  constructor(tag="div",css="",value=""){
   this.tag=tag;this.className=css;this.textContent=String(value??"");
   this.children=[];this.attributes={};this.events={};
   this.classList={toggle(){}};
  }
  append(...items){this.children.push(...items)}
  replaceChildren(...items){this.children=[...items]}
  setAttribute(k,v){this.attributes[k]=v}
  addEventListener(k,fn){this.events[k]=fn}
 }
 const nodes=new Map(["labKnowledgeOverview",
  "labKnowledgeCount","labKnowledgeRows","labKnowledgeEmpty"]
  .map(id=>[id,new Node()]));
 nodes.set("labKnowledgeSearch",{value:""});
 const knowledgeCategoryInput={value:"all"};
 const knowledgeStatusInput={value:"all"};
 const make=(tag,css="",value="")=>new Node(tag,css,value);
 const values={
  $:id=>nodes.get(id),el:make,save:()=>account,
  knowledgeCategoryInput,knowledgeStatusInput,
  knowledgeCategory:"all",knowledgeSort:"tier",
  getKnowledgeRows,knowledgeOverview,filterKnowledgeRows,describeKnowledgeBonus,
  formatKnowledgeBonusValue,knowledgeCheckpoint,
  KNOWLEDGE_CATEGORIES:["Bucks earned","Knowledge XP","Cooking +1 tier chance",
   "Fuel capacity","Fuel generation","Free Shaker chance","Upgrade discounts",
   "Fuel generation multiplier","Slot strength","Fireplace strength","Perfecto chance"],
  fmt:n=>String(n),numberDisplay:n=>String(n),
  sushiArtwork:tier=>make("span","art","T"+tier)
 };
 const renderer=new Function(...Object.keys(values),ui.slice(start,end)+
  "\nreturn renderKnowledge;")(...Object.values(values));
 let account=fixture();
 renderer();
 assert.equal(nodes.get("labKnowledgeRows").children.length,64);
 const displayRow=nodes.get("labKnowledgeRows").children[0];
 assert.equal(displayRow.children.length,4,"Compact table has four columns");
 const firstIdentity=displayRow.children[0].children[0];
 const firstInfo=firstIdentity.children[1];
 const rewardParts=firstInfo.children[1].children;
 assert.equal(rewardParts.map(part=>part.textContent).join(""),"2× Research EXP.",
  "Permanent tier reward is visible beneath Sushi name");
 assert.equal(rewardParts[0].textContent,"2×");
 assert.equal(rewardParts[0].className,"lab-knowledge-value-pill lab-knowledge-tier-value",
  "Only the numeric tier reward is highlighted");
 assert.equal(rewardParts[1].textContent," Research EXP.",
  "Reward explanation remains plain text");
 const firstBonus=displayRow.children[3];
 const current=firstBonus.children[0],next=firstBonus.children[1];
 assert.equal(current.className,"lab-knowledge-bonus-line");
 assert.equal(current.children[0].textContent,"Bucks earned",
  "Effect text stays outside the pill");
 assert.equal(current.children[1].className,"lab-knowledge-value-pill");
 assert.match(current.children[1].textContent,/^\+\d+(?:\.\d+)?%$/,
  "Only the current numeric value belongs in the green bubble");
 assert.equal(next.children[0].textContent,"Next Lv 6");
 assert.equal(next.children[1].className,"lab-knowledge-value-pill");
 assert.match(next.children[1].textContent,/^\+\d+(?:\.\d+)?%$/);
 const perfectoBonus=nodes.get("labKnowledgeRows").children[1].children[3];
 assert.ok(perfectoBonus.children[0].children[1].className.includes("is-perfecto"),
  "Perfecto current pill should be purple");
 assert.ok(perfectoBonus.children[1].children[1].className.includes("is-perfecto"),
  "Perfecto next-level pill should be purple");
 const perfectoIdentity=nodes.get("labKnowledgeRows").children[1].children[0].children[0];
 const perfectoMark=perfectoIdentity.children[0].children[1];
 assert.equal(perfectoMark.tag,"img","Perfecto overlay uses existing PNG");
 assert.equal(perfectoMark.className,"lab-knowledge-perfecto-emblem");
 assert.equal(perfectoMark.src,"assets/Perfecto_Symbol.png");
 assert.equal(perfectoMark.alt,"Perfecto");
 const perfectoReward=nodes.get("labKnowledgeRows").children[1].children[0].children[0].children[1].children[1];
 assert.ok(perfectoReward.children.some(part=>
  part.className.includes("lab-knowledge-tier-value")&&part.className.includes("is-perfecto")),
  "Perfecto tier reward value uses purple status styling");
 assert.equal(firstIdentity.children[0].children.length,1,
  "Non-Perfecto Sushi should have no achievement symbol");
 assert.equal(nodes.get("labKnowledgeOverview").children.length,4);

 const first=nodes.get("labKnowledgeRows").children[0];
 assert.ok(first.children.some(cell=>cell.className==="lab-knowledge-exp"));
 knowledgeStatusInput.value="ready";
 renderer();
 assert.equal(nodes.get("labKnowledgeRows").children.length,1);
 assert.equal(nodes.get("labKnowledgeCount").textContent,"1 / 64 tiers");
 account=null;
 knowledgeStatusInput.value="all";
 renderer();
 assert.equal(nodes.get("labKnowledgeRows").children.length,64);
 const metrics=nodes.get("labKnowledgeOverview").children;
 assert.equal(metrics[0].children[1].textContent,"—");
});

test("Normal Knowledge bonuses use green value bubbles; Perfecto uses purple",()=>{
 const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
 assert.match(css,/#lab-knowledge \.lab-knowledge-value-pill\{/);
 assert.match(css,/background:#234a3f;/);
 assert.match(css,/#lab-knowledge \.lab-knowledge-value-pill\.is-perfecto\{/);
 assert.match(css,/background:#573a72;/);
 assert.match(css,/#lab-knowledge \.lab-knowledge-bonus-label\{/);
 assert.match(css,/#lab-knowledge \.lab-knowledge-exp-values>span\{/);
 assert.match(css,/th:nth-child\(1\)\{width:33%\}/);
 assert.match(css,/th:nth-child\(4\)\{width:28%\}/);
});

test("Tier reward prose remains neutral, and only Perfecto bubbles use purple",()=>{
 const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
 const plain=css.match(/#lab-knowledge \.lab-knowledge-tier-reward-text\{([^}]+)\}/);
 const subtitle=[...css.matchAll(/#lab-knowledge \.lab-knowledge-tier-info \.lab-row-subtitle\{([^}]+)\}/g)].at(-1);
 const normalPill=css.match(/#lab-knowledge \.lab-knowledge-value-pill\{([^}]+)\}/);
 const perfectoPill=css.match(/#lab-knowledge \.lab-knowledge-value-pill\.is-perfecto\{([^}]+)\}/);
 assert.ok(plain&&subtitle&&normalPill&&perfectoPill);
 assert.match(plain[1],/color:#b5cbd4;/);
 assert.match(subtitle[1],/color:#b5cbd4;/);
 assert.doesNotMatch(plain[1],/#d5c3f0|#f1d6ff/);
 assert.match(normalPill[1],/background:#234a3f;/);
 assert.match(perfectoPill[1],/background:#573a72;/);
});

 
test("Knowledge preferences restore only validated filters, without storing account JSON",()=>{
 assert.equal(KNOWLEDGE_PREFERENCES_KEY,"idleon-sushi-knowledge-ui-v1");
 assert.deepEqual(normalizeKnowledgePreferences(null),{
  search:"",category:"all",status:"all",sort:"tier"});
 assert.deepEqual(normalizeKnowledgePreferences({search:"T50",category:"10",status:"perfecto",sort:"next-desc"}),{
  search:"T50",category:"10",status:"perfecto",sort:"next-desc"});
 assert.deepEqual(normalizeKnowledgePreferences({search:42,category:"99",status:"bogus",sort:"nope"}),{
  search:"",category:"all",status:"all",sort:"tier"});
 assert.equal(normalizeKnowledgePreferences({search:"a".repeat(200)}).search.length,120);
 const ui=readFileSync(new URL("../src/lab-ui.mjs",import.meta.url),"utf8");
 assert.match(ui,/localStorage\.getItem\(KNOWLEDGE_PREFERENCES_KEY\)/);
 assert.match(ui,/localStorage\.setItem\(KNOWLEDGE_PREFERENCES_KEY/);
 assert.ok(!ui.includes('localStorage.setItem("account'));
});
test("Knowledge table headers share dropdown sorting with natural page scrolling",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../src/lab-ui.mjs",import.meta.url),"utf8");
 assert.equal((html.match(/data-knowledge-sort=/g)||[]).length,4);
 assert.match(html,/<div class="lab-table-wrap">\s*<table class="lab-data-table lab-knowledge-table"/);
 assert.doesNotMatch(html,/lab-knowledge-scroll/);
 assert.doesNotMatch(css,/#lab-knowledge \.lab-knowledge-table thead th\{\s*position:sticky/);
 assert.doesNotMatch(css,/#lab-knowledge \.lab-knowledge-scroll/);
 assert.match(css,/#lab-knowledge \.lab-knowledge-sort-button:focus-visible/);
 assert.match(ui,/nextKnowledgeHeaderSort\(knowledgeSort/);
 assert.match(ui,/setAttribute\("aria-sort",state\)/);
 assert.equal(nextKnowledgeHeaderSort("tier","tier","tier-desc"),"tier-desc");
 assert.equal(nextKnowledgeHeaderSort("tier-desc","tier","tier-desc"),"tier");
 assert.equal(nextKnowledgeHeaderSort("tier","level-desc","level-asc"),"level-desc");
 const rows=getKnowledgeRows(fixture());
 assert.equal(filterKnowledgeRows(rows,{sort:"level-asc"})[0].tier,3);
 assert.equal(filterKnowledgeRows(rows,{sort:"next-desc",status:"discovered"}).at(-1).tier,2);
});
test("Knowledge 5-level checkpoint hints are only near a real upcoming level and never invent a reward",()=>{
 const rows=getKnowledgeRows(fixture());
 assert.equal(knowledgeCheckpoint(rows[49]).nextLevel,30);
 assert.equal(knowledgeCheckpoint(rows[49]).levelsAway,1);
 assert.equal(knowledgeCheckpoint(rows[0]),null);
 assert.equal(knowledgeCheckpoint(rows[3]),null);
 assert.equal(knowledgeCheckpoint({...rows[49],levelKnown:false}),null);
 assert.equal(knowledgeCheckpoint({...rows[49],discovered:false}),null);
 const ui=readFileSync(new URL("../src/lab-ui.mjs",import.meta.url),"utf8");
 assert.match(ui,/lab-knowledge-checkpoint/);
 assert.match(ui,/not an extra in-game reward/);
});
