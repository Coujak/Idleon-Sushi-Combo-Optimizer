import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {getKnowledgeRows} from "../src/lab-model.mjs";
import {filterKnowledgeRows,knowledgeOverview,KNOWLEDGE_SORT_OPTIONS,KNOWLEDGE_STATUS_OPTIONS}
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
  [2,1,3,50]);
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
test("Knowledge tab renders progress, category chips and a shared visual style",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../src/lab-ui.mjs",import.meta.url),"utf8");
 const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
 for(const id of ["labKnowledgeOverview","labKnowledgeCategoryChips","labKnowledgeSearch",
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
 assert.ok(css.includes("#lab-knowledge .lab-knowledge-category-chip.is-selected"));
});
