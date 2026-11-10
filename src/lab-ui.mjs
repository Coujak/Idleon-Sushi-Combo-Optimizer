// Sushi Station Lab: lightweight, accessible navigation and account-aware
// information panels. All imported JSON stays in memory on the user's device.
import {sushiUpgradeIconPath,sushiTierIconPath} from "./sushi-reference.mjs?v=1.10.2";
import {CATALOG_SORT_OPTIONS,CATALOG_STATUS_OPTIONS,upgradeSummary,readableUpgradeDescription,catalogHasVariableValues,filterSortCatalog} from "./upgrade-catalog.mjs?v=1.11.0";
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
 let catalogSort="shop",catalogCategory="all",catalogStatus="all";
 const expandedUpgradeDetails=new Set();
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
 const categoryInput=$("labUpgradeCategory");
 const statusInput=$("labUpgradeStatus");
 const sortInput=$("labUpgradeSort");
 for(const entry of [...ADVISOR_GOALS,{id:"other",name:"Other / utility"}]){
  categoryInput.append(new Option(entry.name,entry.id));
 }
 for(const entry of CATALOG_STATUS_OPTIONS){
  const option=new Option(entry.label,entry.value);
  option.dataset.requiresSave=String(!!entry.requiresSave);
  statusInput.append(option);
 }
 for(const entry of CATALOG_SORT_OPTIONS){
  const option=new Option(entry.label,entry.value);
  option.dataset.requiresSave=String(!!entry.requiresSave);
  sortInput.append(option);
 }
 $("labUpgradeSearch").addEventListener("input",renderCatalog);
 categoryInput.addEventListener("change",()=>{catalogCategory=categoryInput.value;renderCatalog();});
 statusInput.addEventListener("change",()=>{catalogStatus=statusInput.value;renderCatalog();});
 sortInput.addEventListener("change",()=>{catalogSort=sortInput.value;renderCatalog();});
 for(const button of document.querySelectorAll("[data-catalog-sort]")){
  button.addEventListener("click",()=>{
   const first=button.dataset.catalogSort,second=button.dataset.catalogSortReverse||"shop";
   catalogSort=catalogSort===first?second:first;
   sortInput.value=catalogSort;
   renderCatalog();
  });
 }
 $("labKnowledgeSearch").addEventListener("input",renderKnowledge);
 $("labKnowledgeStatus").addEventListener("change",renderKnowledge);

 function sushiArtwork(tier){
  const frame=el("span","lab-sushi-art-frame");
  frame.append(el("span","lab-sushi-fallback","T"+tier));
  if(Number.isInteger(tier)&&tier>=1&&tier<=64){
   const img=el("img","lab-sushi-icon");
   img.src=sushiTierIconPath(tier);
   img.alt="";
   img.loading="lazy";
   img.onerror=()=>img.remove();
   frame.append(img);
  }
  return frame;
 }
 function renderMissingCards(id,list,empty){
  const host=$(id);host.replaceChildren();
  if(!save()){addText(host,"hint lab-empty-state","Import a save to see these tiers.");return;}
  if(list.length===0){addText(host,"hint lab-empty-state",empty);return;}
  for(const k of list){
   const tile=el("div","lab-sushi-card"),caption=el("span","lab-sushi-card-copy");
   caption.append(el("strong","","T"+k.tier),el("span","",k.name));
   tile.append(sushiArtwork(k.tier),caption);
   tile.title="Tier "+k.tier+" · "+k.name;
   host.append(tile);
  }
 }
 function renderShakerCards(stats){
  const box=$("labShakerCards");box.replaceChildren();
  const list=[
   {name:"Salt Shaker",initial:"S",desc:"Tier-up shaker"},
   {name:"Pepper Shaker",initial:"P",desc:"Perfecto shaker"},
   {name:"Saffron Shaker",initial:"F",desc:"Bucks shaker"}
  ];
  for(let i=0;i<list.length;i++){
   const info=list[i],card=el("div","lab-shaker-card");
   const icon=el("span","lab-shaker-icon");
   icon.setAttribute("aria-hidden","true");
   const art=el("img","lab-shaker-image");
   art.src="assets/shakers/"+encodeURIComponent(info.name+".png");
   art.alt="";
   art.loading="lazy";
   art.onerror=()=>{art.remove();icon.textContent=info.initial;};
   icon.append(art);
   const label=el("span","lab-shaker-copy");
   label.append(el("strong","",info.name),el("span","",info.desc));
   const count=el("span","lab-shaker-count");
   count.append(el("strong","",stats?fmt(stats.shakers[i]):"—"),
    el("span","",stats?"uses available":"Import save"));
   card.append(icon,label,count);
   box.append(card);
  }
 }
 function renderOverview(){
  const data=save(),stats=data?getSushiSnapshot(data):null,host=$("labOverviewStats");
  host.replaceChildren();
  const values=stats?[
   ["Unlocked slots",stats.unlocked+" / 100"],
   ["Sushi on board",stats.occupied],
   ["Highest on board","T"+stats.highest],
   ["Knowledge levels",fmt(stats.totalKnowledge)],
   ["Upgrade levels",fmt(stats.totalUpgrades)],
   ["Best in-game combo",fmt(stats.bestCombo)]
  ]:[
   ["Unlocked slots","—"],["Sushi on board","—"],["Highest on board","—"],
   ["Knowledge levels","—"],["Upgrade levels","—"],["Best in-game combo","—"]
  ];
  for(const [label,value] of values){
   const card=el("div","lab-stat");
   card.append(el("span","lab-stat-label",label),el("strong","lab-stat-value",value));
   host.append(card);
  }
  renderShakerCards(stats);
  const entries=getKnowledgeRows(data);
  renderMissingCards("labMissingPerfectos",entries.filter(x=>x.discovered&&!x.perfecto),
   "All discovered sushi have Perfecto.");
  renderMissingCards("labMissingTiers",entries.filter(x=>!x.discovered),
   "Every sushi tier has been discovered.");
 }
 function upgradeArtwork(u){
  const img=el("img","lab-upgrade-icon");
  img.alt="";
  img.loading="lazy";
  img.decoding="async";
  const path=sushiUpgradeIconPath(u.id);
  if(path)img.src=path;
  img.onerror=()=>img.remove();
  return img;
 }
 function renderCatalog(){
  const s=save(),hasSave=!!s;
  for(const select of [statusInput,sortInput]){
   for(const option of select.options)option.disabled=option.dataset.requiresSave==="true"&&!hasSave;
  }
  if(!hasSave){
   if(CATALOG_STATUS_OPTIONS.some(x=>x.value===catalogStatus&&x.requiresSave))catalogStatus="all";
   if(CATALOG_SORT_OPTIONS.some(x=>x.value===catalogSort&&x.requiresSave))catalogSort="shop";
   statusInput.value=catalogStatus;sortInput.value=catalogSort;
  }
  const rows=filterSortCatalog(getUpgradeRows(s),{
   query:$("labUpgradeSearch").value,category:catalogCategory,status:catalogStatus,sort:catalogSort,hasSave
  });
  const body=$("labUpgradeRows");body.replaceChildren();
  $("labUpgradeCount").textContent=rows.length+" / 46 upgrades";
  for(const header of [
   {key:"name",sorts:["name-asc","name-desc"]},
   {key:"level",sorts:["level-asc","level-desc"]},
   {key:"cost",sorts:["cost-asc","cost-desc"]},
   {key:"doubler",sorts:["doubled-first"]}
  ]){
   const th=document.querySelector('[data-catalog-column="'+header.key+'"]');
   const active=header.sorts.includes(catalogSort);
   const descending=catalogSort.endsWith("-desc")||catalogSort==="doubled-first";
   th.setAttribute("aria-sort",active?(descending?"descending":"ascending"):"none");
   th.querySelector(".lab-sort-indicator").textContent=active?(descending?" ↓":" ↑"):" ↕";
   th.querySelector(".lab-sort-header").disabled=!hasSave&&header.key!=="name";
  }
  $("labUpgradeEmpty").classList.toggle("hidden",rows.length!==0);
  for(const u of rows){
   const tr=el("tr"),name=el("td","lab-upgrade-name");
   const details=el("details","lab-catalog-detail");
   details.open=expandedUpgradeDetails.has(u.id);
   const summary=el("summary","lab-catalog-summary");
   summary.addEventListener("click",()=>{
    if(details.open)expandedUpgradeDetails.delete(u.id);
    else expandedUpgradeDetails.add(u.id);
   });
   const identity=el("span","lab-upgrade-identity");
   const copy=el("span","lab-upgrade-copy");
   copy.append(el("strong","",upgradeLabel(u)),
    el("span","lab-upgrade-summary",upgradeSummary(u)));
   identity.append(upgradeArtwork(u),copy);
   summary.append(identity,el("span","lab-catalog-more","Details"));
   details.append(summary,el("p","lab-catalog-description",readableUpgradeDescription(u.description)));
   if(catalogHasVariableValues(u.description)){
    details.append(el("p","lab-catalog-variable-note",
     "[variable] and [in-game value] indicate amounts calculated by the game, not confirmed account-specific values."));
   }
   name.append(details);
   const level=u.maxLevel===0?"Unavailable":hasSave?fmt(u.level)+(u.maxLevel>0?" / "+fmt(u.maxLevel):""):"Import save";
   const price=u.maxLevel===0?"Unavailable":hasSave?(u.atMax?"Maxed":numberDisplay(u.baseNextCost)):"Import save";
   const effect=u.maxLevel===0?"—":hasSave?effectText(u):"Per-level "+fmt(u.perLevel)+" (base)";
   for(const c of [name,el("td","",level),el("td","",price),
      el("td","",effect),el("td","",u.doubled?"Active ×2":u.doublerEligible?"Eligible":"—")])tr.append(c);
   body.append(tr);
  }
 }

 function resultCard(u,mode){
  const item=el("article","lab-result-card");
  const header=el("div","lab-result-head");
  const identity=el("span","lab-upgrade-identity");
  identity.append(upgradeArtwork(u),el("strong","",upgradeLabel(u)));
  header.append(identity,
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
