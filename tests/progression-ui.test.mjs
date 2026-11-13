import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const ui=readFileSync(new URL("../src/lab-ui.mjs",import.meta.url),"utf8");
const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");

test("Progression Advisor matches Catalog and Doubler styling and uses aligned upgrade rows",()=>{
 assert.match(html,/id="labAdvisorPurchaseSteps"/);
 assert.match(html,/id="labAdvisorViewList" class="selected"/);
 assert.match(html,/id="labAdvisorViewCards" aria-pressed="false"/);
 assert.match(html,/class="lab-advisor-column-head lab-advisor-plan-columns"/);
 assert.match(html,/class="lab-advisor-column-head lab-advisor-rank-columns"/);
 assert.match(html,/class="lab-catalog-toolbar lab-advisor-compare-toolbar"/);
 assert.match(html,/class="lab-advisor-goalbar lab-catalog-toolbar"/);
 assert.ok(ui.includes('purchaseView="list"'));
 assert.ok(ui.includes('detail.open=purchaseView==="cards"'));
 assert.ok(ui.includes('steps.querySelectorAll(".lab-advisor-step-details")'));
 assert.ok(ui.includes('featured?"lab-advisor-feature-row":"lab-advisor-rank-row"'));
 assert.ok(css.includes("#lab-upgrades{"));
 assert.ok(css.includes("--up-head:#203548"));
 assert.ok(css.includes("#lab-upgrade-catalog .lab-catalog-toolbar"));
 assert.ok(css.includes("#lab-upgrade-doubler .lab-doubler-filters"));
 assert.ok(css.includes("#lab-upgrade-advisor .lab-advisor-rank-row"));
 assert.ok(css.includes("#lab-upgrade-advisor .lab-advisor-purchase-list.lab-advisor-view-cards"));
 assert.ok(css.includes("grid-template-columns:minmax(0,1fr)"));
 assert.ok(css.includes("#lab-upgrade-advisor .lab-advisor-row-details"));
 assert.ok(css.includes("#lab-upgrade-doubler .lab-doubler-plan-card.is-doubled"));
});

test("Rendering a purchase plan never removes its ordered-list mount",()=>{
 const start=ui.indexOf(" function renderAdvisor(){");
 const end=ui.indexOf(" function renderDoubler(){",start);
 assert.ok(start>=0&&end>start,"Must locate the Progression Advisor render function");
 const section=ui.slice(start,end);
 assert.doesNotMatch(section,/roadmap\.replaceChildren\s*\(/);
 assert.match(section,/purchaseList\.replaceChildren\s*\(/);
 assert.match(section,/roadmap\.prepend\(purchaseList\)/);

 class Node{
  constructor(tag="div",className="",value=null){
   this.tag=tag;this.className=className;this.textContent=value===null?"":String(value);
   this.children=[];this.id="";this.classList={toggle(){}};
  }
  append(...items){this.children.push(...items)}
  prepend(...items){this.children.unshift(...items)}
  replaceChildren(...items){this.children=[...items]}
  querySelectorAll(selector){
   if(selector===".lab-advisor-plan-end,.lab-advisor-plan-empty")
    return this.children.filter(n=>/lab-advisor-plan-(end|empty)/.test(n.className));
   return [];
  }
  remove(){}
 }
 const ids=["labAdvisorResults","labAdvisorFeature","labAdvisorRoadmap",
  "labAdvisorSummary","labAdvisorResultsCount","labAdvisorPlanSummary",
  "labAdvisorGoalProjection","labAdvisorCalibrationStatus"];
 const nodes=new Map(ids.map(id=>[id,new Node()]));
 const roadmap=nodes.get("labAdvisorRoadmap");
 const list=new Node("ol","lab-advisor-purchase-list lab-advisor-view-list");
 list.id="labAdvisorPurchaseSteps";
 roadmap.append(list);
 nodes.set("labAdvisorPurchaseSteps",list);
 const make=(tag,klass="",value=null)=>new Node(tag,klass,value);
 const upgrade={id:8,shop:4,name:"Fastburn Fuel I",affordability:"affordable"};
 const planStep={number:1,id:8,name:"Fastburn Fuel I",fromLevel:2,toLevel:3,
  doubled:false,price:100,exactPrice:true,fundedByImport:true,missingBucks:0,
  nextLevelEffect:"+5% Fuel",goalResult:{label:"Fuel/hr",current:"100",projected:"105",changed:true}};
 const plan={requestedCount:5,steps:[planStep],initiallyFunded:1,totalEstimatedCost:100,
  additionalBucksNeeded:0,stopReason:"",
  initialGoal:{label:"Fuel per hour",display:"100",estimated:true},
  finalGoal:{label:"Fuel per hour",display:"105",estimated:true,note:"Partial estimate"}};
 let imported={sushi:[[],[],Array(46).fill(0),[],[0,0,0,1000]]};
 const deps={
  $:id=>nodes.get(id)??null,
  el:make,save:()=>imported,
  goal:"fuel",advisorSort:"recommended",advisorFilter:"all",advisorVisibleCount:"all",
  advisorMaxedInput:{checked:false},purchaseView:"list",
  purchasesInput:{value:"5"},customInput:{value:"5"},
  measuredInputs:{bucks:{value:""},fuel:{value:""},capacity:{value:""}},
  parseGameQuantity:()=>null,
  getProgressionAdvice:()=>({bucks:1000,affordableCount:1,count:1,
   partialPrices:false,best:upgrade,all:[upgrade],rows:[upgrade]}),
  buildProgressionPurchasePlan:()=>plan,
  advisorDetail:()=>make("article"),
  ensureAdvisorResultMount:id=>nodes.get(id),
  numberDisplay:value=>String(value),
  upgradeArtwork:()=>make("img"),
  fmt:value=>String(value)
 };
 const symbols=Object.keys(deps);
 const makeRender=new Function(...symbols,section+"\nreturn renderAdvisor;");
 const render=makeRender(...symbols.map(key=>deps[key]));
 render();
 assert.equal(list.children.length,1,"First render must show its planned purchase");
 assert.ok(roadmap.children.includes(list),"The ordered list must stay attached");
 render();
 assert.equal(list.children.length,1,"Re-render should replace rows, not delete the list");
 assert.ok(roadmap.children.includes(list),"The ordered list must survive refresh");
 imported=null;
 render();
 assert.equal(list.children.length,0,"Clearing a save clears old purchase rows");
 assert.ok(roadmap.children.includes(list),"The list is retained for the next import");
 imported={sushi:[[],[],[],[],[0,0,0,1000]]};
 render();
 assert.equal(list.children.length,1,"Importing again restores planned purchases");
});

test("Upgrade Center shares filter styles, semantic colors and aligned row tracks",()=>{
 assert.match(ui,/featured\?"★":String\(rank\?\?"—"\)/);
 assert.match(ui,/lab-advisor-badge-danger/);
 assert.match(css,/--up-rank-columns:30px/);
 assert.match(css,/--up-purchase-columns:30px/);
 const finalRules=css.slice(css.indexOf("/* Upgrade Center polish"));
 assert.ok(finalRules.includes("#lab-upgrades .lab-catalog-toolbar :is(select,input:not([type=\"checkbox\"]))"));
 assert.ok(finalRules.includes("#lab-upgrade-doubler .lab-doubler-sort-field select"));
 assert.ok(finalRules.includes("grid-template-columns:var(--up-rank-columns)"));
 assert.ok(finalRules.includes("grid-template-columns:var(--up-purchase-columns)"));
 assert.ok(finalRules.includes("background:var(--up-danger-bg)"));
 assert.ok(finalRules.includes("background:var(--up-warning-bg)"));
 assert.ok(finalRules.includes("background:var(--up-success-bg)"));
 assert.ok(finalRules.includes("background:var(--up-purple-bg)"));
 assert.ok(finalRules.includes("@media(max-width:850px)"));
 assert.ok(finalRules.includes('content:"MODELED GAIN"'));
 assert.ok(finalRules.includes('content:"NEXT COST"'));
 assert.ok(finalRules.includes('content:"STATUS"'));
});
