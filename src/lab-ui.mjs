// Sushi Station Lab: lightweight, accessible navigation and account-aware
// information panels. All imported JSON stays in memory on the user's device.
import {SUSHI_REFERENCE_SOURCE} from "./sushi-reference.mjs";
import {ADVISOR_GOALS,numberText,getSushiSnapshot,getUpgradeRows,
 getKnowledgeRows,advisorUpgrades,doublerUpgrades} from "./lab-model.mjs";

const $=id=>document.getElementById(id);
const el=(tag,css="",value)=>{
 const node=document.createElement(tag);
 if(css)node.className=css;
 if(value!==undefined&&value!==null)node.textContent=String(value);
 return node;
};
const fmt=numberText;
const none="—";
function numberDisplay(value){
 return Number.isFinite(value)?fmt(value):"Unavailable";
}
function effectText(upgrade){
 if(upgrade.atMax)return "Maxed";
 if(upgrade.maxLevel===1)return "Unlock / one-time effect";
 const amount=upgrade.increment;
 if(!amount)return "See effect details";
 if(upgrade.description.includes("}x"))return "+"+fmt(amount/100)+"× factor";
 if(upgrade.description.includes("%"))return "+"+fmt(amount)+"% per level";
 return "+"+fmt(amount)+" per level (raw)";
}
function upgradeLabel(u){return "#"+u.shop+" · "+u.name;}
function addText(container,className,text){
 container.append(el("p",className,text));
}
function openButton(name,target){
 const button=el("button","lab-link-card",name);
 button.type="button";button.addEventListener("click",()=>setTab(target));
 return button;
}
let setTab=()=>{};
export function initializeSushiLab(getSave){
 let mainTab="overview",upgradeTab="catalog",goal="bucks",doublerGoal="all";
 const save=()=>getSave();
 const tabs=["overview","planners","upgrades","knowledge"];
 setTab=(target)=>{
  if(!tabs.includes(target))return;
  mainTab=target;
  for(const id of tabs){
   const page=$("lab-"+id);
   const button=document.querySelector('[data-lab-target="'+id+'"]');
   page.classList.toggle("hidden",id!==target);
   page.setAttribute("aria-hidden",String(id!==target));
   button.setAttribute("aria-selected",String(id===target));
   button.tabIndex=id===target?0:-1;
  }
  // Navigation doesn't reset the imported file or discard an optimizer replay.
  window.scrollTo({top:0,behavior:"auto"});
 };
 for(const button of document.querySelectorAll("[data-lab-target]")){
  button.addEventListener("click",()=>setTab(button.dataset.labTarget));
  button.addEventListener("keydown",event=>{
   if(event.key!=="ArrowLeft"&&event.key!=="ArrowRight")return;
   event.preventDefault();
   const i=tabs.indexOf(button.dataset.labTarget);
   const target=tabs[(i+(event.key==="ArrowRight"?1:tabs.length-1))%tabs.length];
   document.querySelector('[data-lab-target="'+target+'"]').focus();
   setTab(target);
  });
 }
 for(const button of document.querySelectorAll("[data-lab-open]")){
  button.addEventListener("click",()=>setTab(button.dataset.labOpen));
 }
 function setUpgradeTab(name){
  upgradeTab=name;
  for(const choice of ["catalog","advisor","doubler"]){
   const pane=$("lab-upgrade-"+choice);
   const nav=document.querySelector('[data-upgrade-target="'+choice+'"]');
   pane.classList.toggle("hidden",choice!==name);
   pane.setAttribute("aria-hidden",String(choice!==name));
   nav.setAttribute("aria-selected",String(choice===name));
  }
 }
 for(const nav of document.querySelectorAll("[data-upgrade-target]")){
  nav.addEventListener("click",()=>setUpgradeTab(nav.dataset.upgradeTarget));
 }
 const goalInput=$("labAdvisorGoal"),dblInput=$("labDoublerGoal");
 for(const entry of ADVISOR_GOALS){
  goalInput.append(new Option(entry.name,entry.id));
  dblInput.append(new Option(entry.name,entry.id));
 }
 goalInput.value=goal;
 goalInput.addEventListener("change",()=>{goal=goalInput.value;renderAdvisor();});
 dblInput.addEventListener("change",()=>{doublerGoal=dblInput.value;renderDoubler();});
 $("labUpgradeSearch").addEventListener("input",renderCatalog);
 $("labKnowledgeSearch").addEventListener("input",renderKnowledge);
 $("labKnowledgeStatus").addEventListener("change",renderKnowledge);
 $("labReferenceSource").href=SUSHI_REFERENCE_SOURCE;

 function renderOverview(){
  const s=save(),stats=$("labOverviewStats"),insights=$("labOverviewInsights");
  stats.replaceChildren();insights.replaceChildren();
  const rows=s?getSushiSnapshot(s):null;
  const values=rows?[
   ["Unlocked slots",rows.unlocked+" / 100"],
   ["Sushi on board",rows.occupied],
   ["Highest on board","T"+rows.highest],
   ["Perfectos",rows.perfectos+" / 64"],
   ["Knowledge levels",fmt(rows.totalKnowledge)],
   ["Upgrade levels",fmt(rows.totalUpgrades)],
   ["Best in-game combo",fmt(rows.bestCombo)],
   ["Pepper uses",fmt(Number(s.sushi?.[4]?.[6]??0))]
  ]:[
   ["Unlocked slots",none],["Sushi on board",none],["Highest on board",none],
   ["Perfectos",none],["Knowledge levels",none],["Upgrade levels",none],
   ["Best in-game combo",none],["Pepper uses",none]
  ];
  for(const [label,value] of values){
   const card=el("div","lab-stat"),v=el("strong","lab-stat-value",value);
   card.append(el("span","lab-stat-label",label),v);stats.append(card);
  }
  if(!rows){
   addText(insights,"hint","Import your Idleon Toolbox JSON above to see account-specific progress, upgrade levels and knowledge. You can still browse the other tabs without importing.");
  }else{
   const missing=getKnowledgeRows(s).filter(k=>k.discovered&&!k.perfecto);
   const pending=missing.slice(-4).map(k=>"T"+k.tier).join(", ");
   addText(insights,"","Perfecto progress: "+rows.perfectos+" of 64 complete."+
     (missing.length?" Unfinished discovered tiers include "+pending+".":" All discovered tiers are Perfecto!"));
   addText(insights,"hint","Sushi Station data is from this import. The 76,532-point Experimental 13 benchmark is a separate Tier 64 simulated result, not your account's score.");
  }
 }
 function renderCatalog(){
  const q=$("labUpgradeSearch").value.trim().toLowerCase(),s=save();
  const rows=getUpgradeRows(s).filter(u=>
   (u.name+" "+u.id+" "+u.shop+" "+u.description).toLowerCase().includes(q));
  const body=$("labUpgradeRows");body.replaceChildren();
  $("labUpgradeCount").textContent=rows.length+" / 46 upgrades";
  for(const u of rows){
   const tr=el("tr"),name=el("td","lab-upgrade-name");
   name.append(el("strong","",upgradeLabel(u)));
   const details=el("details","lab-row-detail");
   const summary=el("summary","", "Effect details");
   details.append(summary,el("p","",u.description||"No effect details available in the reference."));
   name.append(details);
   const level=s?fmt(u.level)+(u.maxLevel>0?" / "+fmt(u.maxLevel):""):"Import save";
   const price=s?(u.atMax?"Maxed":numberDisplay(u.baseNextCost)):"Import save";
   const effect=s?effectText(u):"Per-level "+fmt(u.perLevel)+" (base)";
   for(const c of [name,el("td","",level),el("td","",price),
      el("td","",effect),el("td","",u.doubled?"Active ×2":u.doublerEligible?"Eligible":"—")])tr.append(c);
   body.append(tr);
  }
 }
 function resultCard(u,mode){
  const item=el("article","lab-result-card");
  const header=el("div","lab-result-head");
  header.append(el("strong","",upgradeLabel(u)),
    el("span","lab-mini-badge",u.atMax?"Maxed":u.doubled?"Doubled":"Lv "+fmt(u.level)));
  item.append(header,el("p","lab-result-desc",u.description||"No effect details available."));
  if(mode==="advisor"){
   addText(item,"lab-result-meta",
    "Next change: "+effectText(u)+" · "+(u.atMax?"Max level": "Estimated base cost "+numberDisplay(u.baseNextCost)));
  }else{
   addText(item,"lab-result-meta",u.doubled?
    "Currently doubled · current raw effect "+fmt(u.rawBonus):
    "Doubler would add "+fmt(u.level*u.perLevel)+" raw effect units at your current level");
  }
  return item;
 }
 function renderAdvisor(){
  const root=$("labAdvisorResults");root.replaceChildren();
  if(!save()){
   addText(root,"hint","Import a save on Overview to compare your actual upgrade levels and possible next upgrades.");
   return;
  }
  const candidates=advisorUpgrades(save(),goal);
  addText(root,"hint",candidates.length+
   " relevant upgrades, sorted by estimated base purchase cost. This is goal-based guidance, not a full account-wide ROI calculation.");
  for(const u of candidates)root.append(resultCard(u,"advisor"));
  if(!candidates.length)addText(root,"hint","No upgrades currently mapped to this goal.");
 }
 function renderDoubler(){
  const root=$("labDoublerResults");root.replaceChildren();
  if(!save()){
   addText(root,"hint","Import a full Idleon Toolbox JSON to see assigned Sushi doublers from Spelunk[52].");
   return;
  }
  const chosen=doublerUpgrades(save(),doublerGoal);
  const assigned=getUpgradeRows(save()).filter(u=>u.doubled);
  addText(root,"lab-result-meta",
   "Current Sushi doubler assignments ("+assigned.length+"): "+
   (assigned.length?assigned.map(u=>u.name).join(", "):"none detected"));
  addText(root,"hint","Only eligible upgrade IDs appear below. A doubler doubles that upgrade's per-level effect; this list does not assume unrelated bonuses can be compared as one score.");
  for(const u of chosen)root.append(resultCard(u,"doubler"));
  if(!chosen.length)addText(root,"hint","No eligible upgrades found for this selected goal.");
 }
 function renderKnowledge(){
  const q=$("labKnowledgeSearch").value.trim().toLowerCase(),mode=$("labKnowledgeStatus").value;
  const s=save(),all=getKnowledgeRows(s);
  const rows=all.filter(k=>
   (k.name+" "+k.tier+" "+k.categoryName).toLowerCase().includes(q)&&
   (mode==="all"||mode==="unfinished"&&k.discovered&&!k.perfecto||
    mode==="perfecto"&&k.perfecto||mode==="undiscovered"&&!k.discovered));
  $("labKnowledgeCount").textContent=rows.length+" / 64 tiers";
  const body=$("labKnowledgeRows");body.replaceChildren();
  for(const k of rows){
   const tr=el("tr"),tier=el("td","lab-upgrade-name");
   tier.append(el("strong","","T"+k.tier+" · "+k.name),el("span","lab-row-subtitle",k.categoryName));
   const level=s?(k.discovered?fmt(k.level):"Undiscovered"):"Import save";
   const xp=s&&k.discovered?fmt(k.xp)+" / "+fmt(k.xpReq):none;
   const benefit=!k.mapped?"Reference unavailable":s&&k.discovered?numberDisplay(k.bonus):"Per level "+fmt(k.perLevel);
   const status=s?(k.perfecto?"Perfecto":k.discovered?"Not Perfecto":"Undiscovered"):"—";
   tr.append(tier,el("td","",level),el("td","",xp),el("td","",benefit),el("td","",status));
   body.append(tr);
  }
 }
 function refresh(){
  renderOverview();renderCatalog();renderAdvisor();renderDoubler();renderKnowledge();
  $("labSaveStatus").textContent=save()?"Save loaded locally":"No save imported";
 }
 setTab("overview");
 setUpgradeTab("catalog");
 refresh();
 return {refresh,open:setTab};
}
