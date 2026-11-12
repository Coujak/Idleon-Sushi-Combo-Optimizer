// Sushi Station Lab: lightweight, accessible navigation and account-aware
// information panels. All imported JSON stays in memory on the user's device.
import {sushiUpgradeIconPath,sushiTierIconPath} from "./sushi-reference.mjs?v=1.16.6";
import {initializePerfectoUI} from "./perfecto-ui.mjs?v=1.34.1";
import {CATALOG_SORT_OPTIONS,CATALOG_STATUS_OPTIONS,upgradeSummary,readableUpgradeDescription,upgradeDescriptionSegments,catalogHasVariableValues,filterSortCatalog,upgradeCatalogDollarValue} from "./upgrade-catalog.mjs?v=1.16.7";
import {ADVISOR_GOALS,numberText,getSushiSnapshot,getUpgradeRows,
 getKnowledgeRows,advisorUpgrades,doublerUpgrades,getSushiDoublerCounts,sushiUpgradeExtraText,upgradeAffordability} from "./lab-model.mjs?v=1.19.10";
import {getProgressionAdvice,PROGRESSION_SORT_OPTIONS,PROGRESSION_FILTER_OPTIONS} from "./progression-advisor.mjs?v=1.16.6";
import {buildProgressionPurchasePlan} from "./progression-roadmap.mjs?v=1.16.7";
import {parseGameQuantity} from "./progression-calibration.mjs?v=1.16.3";
import {overviewTierProgress,importAgeText} from "./overview-helpers.mjs?v=1.19.9";

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
function doublerIcon(className="lab-catalog-doubler-icon"){
 const img=el("img",className);
 img.src="assets/upgrade_doubler.png?v=1.12.4";img.alt="";img.loading="lazy";
 img.width=24;img.height=17;return img;
}

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
 let advisorSort="recommended",advisorFilter="all",purchaseView="cards";
 let catalogSort="shop",catalogCategory="all",catalogStatus="all";
 let importedAt=null;
 const missingListExpanded={labMissingPerfectos:false,labMissingTiers:false};
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
 const advisorSortInput=$("labAdvisorSort"),advisorFilterInput=$("labAdvisorFilter");
 const advisorMaxedInput=$("labAdvisorShowMaxed");
 for(const item of PROGRESSION_SORT_OPTIONS)advisorSortInput.append(new Option(item.label,item.value));
 for(const item of PROGRESSION_FILTER_OPTIONS)advisorFilterInput.append(new Option(item.label,item.value));
 advisorSortInput.value=advisorSort;advisorFilterInput.value=advisorFilter;
 advisorSortInput.addEventListener("change",()=>{advisorSort=advisorSortInput.value;renderAdvisor();});
 advisorFilterInput.addEventListener("change",()=>{advisorFilter=advisorFilterInput.value;renderAdvisor();});
 advisorMaxedInput.addEventListener("change",renderAdvisor);
 const purchasesInput=$("labAdvisorPurchaseCount");
 const customInput=$("labAdvisorCustomPurchases");
 const customLabel=$("labAdvisorCustomCountLabel");
 const updatePurchaseOptions=()=>{
  customLabel.classList.toggle("hidden",purchasesInput.value!=="custom");
  renderAdvisor();
 };
 purchasesInput.addEventListener("change",updatePurchaseOptions);
 customInput.addEventListener("input",()=>{
  if(purchasesInput.value==="custom"&&customInput.value!=="")renderAdvisor();
 });
 customInput.addEventListener("change",()=>{
  const n=Math.max(1,Math.min(500,Math.trunc(Number(customInput.value)||1)));
  customInput.value=String(n);
  if(purchasesInput.value==="custom")renderAdvisor();
 });
 // An older cached HTML shell may not contain the newer result panel.
 // Restore optional advisor mounts instead of treating a valid import as bad JSON.
 function ensureAdvisorResultMount(id,className){
  const existing=$(id);
  if(existing)return existing;
  const panel=$("lab-upgrade-advisor");
  if(!panel)throw new Error("Progression Advisor panel is missing");
  const node=el("div",className);
  node.id=id;
  const before=$("labAdvisorRoadmap")||$("labAdvisorResults");
  panel.insertBefore(node,before||null);
  return node;
 }
 const viewCardsButton=$("labAdvisorViewCards"),viewListButton=$("labAdvisorViewList");
 function setPurchaseView(view){
  purchaseView=view;
  for(const [name,button] of [["cards",viewCardsButton],["list",viewListButton]]){
   const selected=name===view;
   button.classList.toggle("selected",selected);
   button.setAttribute("aria-pressed",String(selected));
  }
  const steps=$("labAdvisorPurchaseSteps");
  if(steps){
   steps.classList.toggle("lab-advisor-view-cards",view==="cards");
   steps.classList.toggle("lab-advisor-view-list",view==="list");
  }
 }
 viewCardsButton.addEventListener("click",()=>setPurchaseView("cards"));
 viewListButton.addEventListener("click",()=>setPurchaseView("list"));
 setPurchaseView("cards");
 const measuredInputs={
  bucks:$("labAdvisorMeasuredBucks"),fuel:$("labAdvisorMeasuredFuel"),
  capacity:$("labAdvisorMeasuredCapacity")
 };
 for(const input of Object.values(measuredInputs))
  input.addEventListener("change",renderAdvisor);

 const categoryInput=$("labUpgradeCategory");
 const statusInput=$("labUpgradeStatus");
 const sortInput=$("labUpgradeSort");
 const hideMaxedInput=$("labHideMaxed");
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
 hideMaxedInput.addEventListener("change",renderCatalog);
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
 const missingPreviewCount=6;
 for(const id of ["labMissingPerfectos","labMissingTiers"]){
  $(id+"Toggle").addEventListener("click",()=>{
   missingListExpanded[id]=!missingListExpanded[id];
   renderOverview();
  });
 }
 function renderMissingCards(id,list,empty,trackerAvailable=true){
  const host=$(id),toggle=$(id+"Toggle"),count=$(id+"Count");
  host.replaceChildren();
  const hasSave=!!save();
  count.textContent=hasSave&&trackerAvailable?"("+list.length+")":"";
  const canExpand=hasSave&&trackerAvailable&&list.length>missingPreviewCount;
  toggle.classList.toggle("hidden",!canExpand);
  toggle.setAttribute("aria-expanded",String(canExpand&&missingListExpanded[id]));
  toggle.textContent=missingListExpanded[id]?"Show fewer":"Show all ("+list.length+")";
  if(!hasSave){addText(host,"hint lab-empty-state","Import a save to see these tiers.");return;}
  if(!trackerAvailable){
   addText(host,"hint lab-empty-state","Sushi discovery tracker is unavailable in this save.");
   return;
  }
  if(list.length===0){addText(host,"hint lab-empty-state",empty);return;}
  const visible=missingListExpanded[id]?list:list.slice(0,missingPreviewCount);
  for(const k of visible){
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
   {name:"Salt Shaker",initial:"S",desc:"Tier-up shaker",upgradeId:17},
   {name:"Pepper Shaker",initial:"P",desc:"Perfecto shaker",upgradeId:18},
   {name:"Saffron Shaker",initial:"F",desc:"Bucks shaker",upgradeId:19}
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
   const count=el("div","lab-shaker-count");
   const useRow=el("div","lab-shaker-usage-row");
   const countValue=el("strong","lab-shaker-count-value",stats?fmt(stats.shakers[i]):"—");
   useRow.append(countValue);
   if(stats){
    const unlocked=Number(stats.levels?.[info.upgradeId]??0)>0;
    const daily=stats.shakerDaily;
    const rate=el("span","lab-shaker-daily",
     !unlocked?"Locked":daily?.known?"+"+daily.total+"/day":"+1/day base");
    if(!unlocked)rate.classList.add("is-locked");
    rate.title=!unlocked?"Unlock this shaker in Sushi Station upgrades":
     daily?.known?"Daily uses: 1 base + "+daily.bonus+
      " from Shakin' It Research (Lv "+daily.bonus+").":
      "Base +1 use/day. Import Research grid data to determine additional daily uses.";
    useRow.append(rate);
   }
   count.append(useRow,el("span","lab-shaker-count-caption",stats?"Available":"Import save"));
   card.append(icon,label,count);
   box.append(card);
  }
 }
 function renderOverview(){
  const data=save(),stats=data?getSushiSnapshot(data):null,host=$("labOverviewStats");
  const entries=getKnowledgeRows(data);
  // Do not mistake missing/incomplete Sushi[5] data for 64 undiscovered tiers.
  const hasTracker=!!stats&&Array.isArray(data.sushi?.[5])&&
   data.sushi[5].length>=entries.length;
  const progress=hasTracker?overviewTierProgress(entries):null;
  host.replaceChildren();
  const values=stats?[
   ["Unlocked slots",stats.unlocked+" / 100"],
   ["Sushi on board",stats.occupied],
   ["Highest on board",stats.highest?"T"+stats.highest+" ×"+stats.highestCopies:"—"],
   ["Highest Sushi Discovered",progress?.highestDiscovered?
    progress.highestDiscovered+" / "+progress.total:"—"],
   ["Total Perfectos",progress?progress.perfectos+" / "+progress.total:"—"],
   ["Knowledge levels",fmt(stats.totalKnowledge)],
   ["Upgrade levels",fmt(stats.totalUpgrades)],
   ["Best in-game combo",fmt(stats.bestCombo)]
  ]:[
   ["Unlocked slots","—"],["Sushi on board","—"],
   ["Highest on board","—"],["Highest Sushi Discovered","—"],
   ["Total Perfectos","—"],["Knowledge levels","—"],
   ["Upgrade levels","—"],["Best in-game combo","—"]
  ];
  for(const [label,value] of values){
   const card=el("div","lab-stat");
   card.append(el("span","lab-stat-label",label),el("strong","lab-stat-value",value));
   host.append(card);
  }
  renderShakerCards(stats);
  renderMissingCards("labMissingPerfectos",entries.filter(x=>x.discovered&&!x.perfecto),
   "All discovered sushi have Perfecto.",hasTracker);
  renderMissingCards("labMissingTiers",entries.filter(x=>!x.discovered),
   "Every sushi tier has been discovered.",hasTracker);
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
  const balance=hasSave?getSushiSnapshot(s).bucks:null;
  hideMaxedInput.disabled=!hasSave;
  for(const select of [statusInput,sortInput]){
   for(const option of select.options)option.disabled=option.dataset.requiresSave==="true"&&!hasSave;
  }
  if(!hasSave){
   if(CATALOG_STATUS_OPTIONS.some(x=>x.value===catalogStatus&&x.requiresSave))catalogStatus="all";
   if(CATALOG_SORT_OPTIONS.some(x=>x.value===catalogSort&&x.requiresSave))catalogSort="shop";
   statusInput.value=catalogStatus;sortInput.value=catalogSort;
  }
  const rows=filterSortCatalog(getUpgradeRows(s),{
   query:$("labUpgradeSearch").value,category:catalogCategory,status:catalogStatus,sort:catalogSort,hasSave,
   hideMaxed:hideMaxedInput.checked
  });
  const body=$("labUpgradeRows");body.replaceChildren();
  $("labUpgradeCount").textContent=rows.length+" / 46 upgrades";
  const doublerCounts=getSushiDoublerCounts(s);
  const doublerHost=$("labDoublerCount");
  doublerHost.replaceChildren();
  if(!s){
   doublerHost.textContent="Import a save to track your Sushi Doublers";
   doublerHost.title="";
  }else{
   const assigned=doublerCounts.used===null?"Unknown":fmt(doublerCounts.used);
   const available=doublerCounts.available===null?"Unknown":
    (doublerCounts.exact?fmt(doublerCounts.available):"≥"+fmt(doublerCounts.available));
   const countLabel=el("strong","","Sushi Doublers");
   const parts=el("span","","Assigned: "+assigned+" · Available: "+available);
   doublerHost.append(doublerIcon(),countLabel,parts);
   doublerHost.title=doublerCounts.exact?
    "Exact owned and available Sushi Doublers from imported account summary.":
    doublerCounts.baseOwned===null?
     "Assigned placements come from Spelunk[52]. Owned and free counts require Menagerie data.":
     "Available is a guaranteed minimum based on Menagerie boost levels only. Bundles or companions can add more.";
  }
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
   if(hasSave&&u.doubled)tr.classList.add("lab-catalog-doubled");
   const details=el("details","lab-catalog-detail");
   details.open=expandedUpgradeDetails.has(u.id);
   const summary=el("summary","lab-catalog-summary");
   summary.addEventListener("click",()=>{
    if(details.open)expandedUpgradeDetails.delete(u.id);
    else expandedUpgradeDetails.add(u.id);
   });
   const identity=el("span","lab-upgrade-identity");
   const copy=el("span","lab-upgrade-copy");
   copy.append(el("strong","lab-catalog-upgrade-title",upgradeLabel(u)),
    el("span","lab-upgrade-summary",upgradeSummary(u)),
    el("span","lab-catalog-more","Details"));
   identity.append(upgradeArtwork(u),copy);
   summary.append(identity);
   const full=el("p","lab-catalog-description");
   const extra=upgradeCatalogDollarValue(u,s);
   for(const part of upgradeDescriptionSegments(u.description,u,hasSave,extra)){
    if(part.kind==="text")full.append(document.createTextNode(part.text));
    else full.append(el("span",part.kind==="calculated"?"lab-catalog-known-value":
     part.kind==="estimated"?"lab-catalog-estimated-value":"lab-catalog-unknown-value",part.text));
   }
   details.append(summary,full);
   if(extra?.estimated)details.append(el("p","lab-catalog-variable-note",
    "Modeled from available game data; external bonuses can change the exact rate or capacity."));
   if(catalogHasVariableValues(u.description,u,hasSave,extra)){
    details.append(el("p","lab-catalog-variable-note",hasSave?
     "This effect could not be verified from the imported data. Other highlighted values come from your account levels.":
     "Import your save to calculate level-based bonuses; some in-game values may remain unavailable."));
   }
   name.append(details);
   const levelCell=el("td","lab-catalog-level");
   if(u.maxLevel===0)levelCell.textContent="Unavailable";
   else if(!hasSave)levelCell.textContent="Import save";
   else{
    const levelDisplay=el("span","lab-level-value");
    levelDisplay.append(el("strong","",fmt(u.level)),el("span",""," / "+fmt(u.maxLevel)));
    levelCell.append(levelDisplay);
   }
   const costCell=el("td","lab-catalog-cost");
   if(!hasSave||u.maxLevel===0||u.atMax){
    costCell.textContent=!hasSave?"Import save":u.maxLevel===0?"Unavailable":"Maxed";
   }else{
    const cost=u.estimatedNextCost;
    const status=upgradeAffordability(u,balance);
    const ratio=el("div","lab-catalog-cost-ratio");
    ratio.append(el("span","lab-catalog-wallet",numberDisplay(balance)),
      el("span","lab-catalog-slash","/"),
      el("strong","lab-catalog-next-price",numberDisplay(cost)));
    ratio.title="Current Sushi Bucks / Next upgrade cost";
    const label=status==="affordable"?"Enough Bucks":
      status==="unaffordable"?"Not enough Bucks":
      status==="uncertain"?"Price may be lower":"Price unavailable";
    costCell.classList.add("lab-cost-"+status);
    costCell.append(ratio);
    const detail=u.costBreakdown;
    const precise=value=>Number.isFinite(value)?value.toExponential(12).replace(/e\+?/i,"E"):"Unavailable";
    costCell.title="Current Sushi Bucks: "+precise(balance)+"\nNext cost: "+precise(cost)+"\n"+
      "Base cost: "+precise(u.baseNextCost)+"\n"+
      detail.sources.map(source=>source.name+": "+(source.known?
        numberDisplay(source.percent)+"% bonus ("+numberDisplay(source.factor)+"× cost)":"Not available in imported save")).join("\n")+
      (detail.complete?"\nAll four price factors included.":"\nMissing factors may reduce the price further.");
    costCell.setAttribute("aria-label","Current Bucks "+numberDisplay(balance)+
      ", next upgrade cost "+numberDisplay(cost)+", "+label);
   }
   const effect=u.maxLevel===0?"—":hasSave?effectText(u):"Per-level "+fmt(u.perLevel)+" (base)";
   const gainCell=el("td","lab-catalog-gain");
   gainCell.append(el("span","lab-catalog-gain-main",effect));
   // For percentage/flat boosts the current total is rawBonus. A one-time
   // unlock has no meaningful scalar total to show.
   const hasPct=u.description.includes("{%");
   const hasFlat=u.description.includes("{")&&!hasPct;
   const hasMultiplier=u.description.includes("}x");
   if(hasSave&&!u.atMax&&u.maxLevel>1&&Number.isFinite(u.rawBonus)&&Number.isFinite(u.increment)&&
      (hasPct||hasFlat||hasMultiplier)){
    const formatValue=value=>hasMultiplier?fmt(1+value/100)+"×":
      (hasPct?"+":"")+fmt(value)+(hasPct?"%":"");
    const hint=el("span","lab-catalog-gain-hint");
    hint.append(el("span","","Total: "+formatValue(u.rawBonus)+" → "),
      el("strong","",formatValue(u.rawBonus+u.increment)));
    hint.title="Current total upgrade effect compared with buying one more level. Unrelated game multipliers are not included.";
    gainCell.append(hint);
   }
   const doublerCell=el("td","lab-catalog-doubler-cell");
   const label=u.doubled?"×2 Active":u.doublerEligible?"Eligible":"—";
   const badge=el("span",u.doubled?"lab-doubler-on":u.doublerEligible?"lab-doubler-eligible":"",label);
   if(hasSave&&u.doubled)badge.prepend(doublerIcon());
   doublerCell.append(badge);
   for(const c of [name,levelCell,costCell,gainCell,doublerCell])tr.append(c);
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
 function advisorBadge(u){
  if(u.atMax)return ["Maxed","lab-advisor-badge-muted"];
  if(u.affordability==="affordable")return ["Can buy now","lab-advisor-badge-success"];
  if(u.affordability==="unaffordable")return ["Save more Bucks","lab-advisor-badge-secondary"];
  if(u.affordability==="uncertain")return ["Price uncertain","lab-advisor-badge-uncertain"];
  return ["Cost unknown","lab-advisor-badge-muted"];
 }
 function advisorPrice(u){
  return u.costKnown?numberDisplay(u.estimatedNextCost):"Unavailable";
 }
 function advisorShortfall(u){
  if(u.atMax)return "Already maxed";
  if(u.affordability==="affordable")return "Enough Bucks to purchase";
  if(u.missing===null)return "Price information incomplete";
  if(u.affordability==="uncertain")
   return "Up to "+numberDisplay(u.missing)+" more Bucks at this estimate";
  return numberDisplay(u.missing)+" more Bucks needed";
 }
 function advisorIdentity(u){
  const identity=el("div","lab-advisor-identity");
  identity.append(upgradeArtwork(u));
  const copy=el("div","lab-advisor-identity-copy");
  copy.append(el("strong","",upgradeLabel(u)),
   el("span","","Lv "+fmt(u.level)+" → "+fmt(u.level+(u.atMax?0:1))+
    (u.doubled?" · Doubled":"")));
  identity.append(copy);
  return identity;
 }
 function advisorDetail(u,featured=false){
  const item=el("article",featured?"lab-advisor-top":"lab-advisor-option");
  const header=el("div","lab-advisor-option-head");
  header.append(advisorIdentity(u));
  const [label,klass]=advisorBadge(u);
  header.append(el("span","lab-advisor-badge "+klass,label));
  item.append(header);
  item.append(el("p","lab-advisor-one-line",upgradeSummary(u)));
  const metrics=el("div","lab-advisor-metrics");
  function metric(caption,value,className=""){
   const cell=el("div","lab-advisor-metric "+className);
   cell.append(el("small","",caption),el("strong","",value));
   metrics.append(cell);
  }
  if(featured)metric("YOUR SUSHI BUCKS",numberDisplay(getSushiSnapshot(save()).bucks));
  metric(u.exactCost?"ESTIMATED DISCOUNTED PRICE":"UPPER PRICE ESTIMATE",
   u.atMax?"Maxed":advisorPrice(u));
  metric("BUYING POWER",advisorShortfall(u),u.affordability==="affordable"?
   "lab-advisor-good":"");
  item.append(metrics);
  const benefit=el("div","lab-advisor-benefit");
  benefit.append(el("span","","NEXT LEVEL BENEFIT"),el("strong","",u.effect.label));
  item.append(benefit);
  if(featured){
   item.append(el("p","lab-advisor-reason",u.reason+" "+u.budgetNote));
   if(!u.exactCost)item.append(el("p","lab-advisor-price-note",
    "The imported save may omit a discount. Your actual in-game price can be lower than shown."));
  }else if(!u.exactCost){
   item.append(el("p","lab-advisor-price-note","Price may be lower if discounts are missing."));
  }
  return item;
 }
 function renderAdvisor(){
  const root=$("labAdvisorResults"),feature=$("labAdvisorFeature"),
   roadmap=$("labAdvisorRoadmap"),summary=$("labAdvisorSummary"),
   count=$("labAdvisorResultsCount");
  root.replaceChildren();feature.replaceChildren();roadmap.replaceChildren();summary.replaceChildren();
  count.textContent="";
  if(!save()){
   summary.append(el("p","hint","Import your Sushi Station game save on Overview to receive a personalized buying recommendation."));
   return;
  }
  const advice=getProgressionAdvice(save(),goal,{
   sort:advisorSort,filter:advisorFilter,includeMaxed:advisorMaxedInput.checked
  });
  summary.append(el("strong","",advice.affordableCount+" affordable now · "+
   advice.count+" upgrades not maxed · "+numberDisplay(advice.bucks)+" Sushi Bucks available"));
  if(advice.partialPrices)summary.append(el("span","",
   "Some prices are upper estimates because the imported save lacks one or more discounts."));
  if(!advice.best){
   feature.append(el("p","hint","Every upgrade mapped to this goal is already maxed, or no applicable upgrades are available."));
  }else{
   const head=el("div","lab-advisor-feature-heading");
   head.append(el("span","lab-advisor-kicker",
    advice.best.affordability==="affordable"?"RECOMMENDED NEXT PURCHASE":"RECOMMENDED UPGRADE TO SAVE FOR"),
     el("span","lab-advisor-method","Account-aware priority"));
   feature.append(head,advisorDetail(advice.best,true));
   if(advice.best.affordability!=="affordable")
    feature.append(el("p","lab-advisor-feature-footnote",
     "No upgrades for this goal are currently confirmed affordable. The suggestion above is a savings target, not an instruction to buy immediately."));
  }
  const requested=purchasesInput.value==="custom"?
   (customInput.value===""?5:customInput.value):purchasesInput.value;
  const readings=Object.fromEntries(Object.entries(measuredInputs).map(([key,input])=>
   [key,input.value.trim()]));
  const invalid=Object.entries(readings).filter(([,value])=>value&&parseGameQuantity(value)===null)
   .map(([name])=>name);
  const active=Object.entries(readings).filter(([,value])=>parseGameQuantity(value)!==null)
   .map(([name])=>name);
  $("labAdvisorCalibrationStatus").textContent=invalid.length?
   "Invalid "+invalid.join(", ")+" reading(s). Use values such as 2.5T or 1.2E30.":
   active.length?"Using measured "+active.join(", ")+" baseline(s) for matching goals.":
   "No readings entered. Estimates use the imported save's modeled values.";
  const plan=buildProgressionPurchasePlan(save(),goal,requested,{readings});
  const planSummary=ensureAdvisorResultMount("labAdvisorPlanSummary","lab-advisor-plan-summary");
  const purchaseList=$("labAdvisorPurchaseSteps");
  planSummary.replaceChildren();
  if(!purchaseList){
   // A stale page shell may lack the newer list while the JSON is valid.
   const place=ensureAdvisorResultMount("labAdvisorRoadmap","lab-advisor-purchase-scroll");
   place.replaceChildren(el("p","hint",
    "Purchase list is unavailable in this cached page. Reload to view the latest layout."));
   return;
  }
  purchaseList.replaceChildren();
  const summaryParts=[
   [String(plan.steps.length)+" / "+plan.requestedCount,"PURCHASES PLANNED"],
   [String(plan.initiallyFunded),"COVERED BY CURRENT BUCKS"],
   [numberDisplay(plan.totalEstimatedCost),"ESTIMATED TOTAL COST"],
   [numberDisplay(plan.additionalBucksNeeded),
    plan.partialPrices?"FUTURE BUCKS TO SAVE (EST.)":"FUTURE BUCKS TO SAVE"]
  ];
  for(const [value,label] of summaryParts){
   const stat=el("div","lab-advisor-plan-stat");
   stat.append(el("strong","",value),el("small","",label));
   planSummary.append(stat);
  }
  const projection=ensureAdvisorResultMount("labAdvisorGoalProjection","lab-advisor-goal-projection");
  projection.replaceChildren();
  if(plan.initialGoal&&plan.finalGoal){
   const header=el("div","lab-advisor-goal-label");
   header.append(el("strong","",plan.initialGoal.label),
    el("span","",plan.initialGoal.estimated||plan.finalGoal.estimated?
     "ESTIMATED / PARTIAL":"MODELED"));
   projection.append(header);
   const compare=el("div","lab-advisor-goal-comparison");
   const initial=el("div","lab-advisor-goal-number");
   initial.append(el("small","","FROM YOUR IMPORTED ACCOUNT"),
    el("strong","",plan.initialGoal.display));
   const projected=el("div","lab-advisor-goal-number lab-advisor-goal-projected");
   projected.append(el("small","","AFTER "+plan.steps.length+" PLANNED PURCHASES"),
    el("strong","",plan.finalGoal.display));
   compare.append(initial,el("span","lab-advisor-goal-arrow","→"),projected);
   projection.append(compare,el("p","lab-advisor-goal-note",plan.finalGoal.note));
  }
  for(const step of plan.steps){
   const item=el("li","lab-advisor-purchase-step");
   const number=el("span","lab-advisor-purchase-number",String(step.number));
   const identity=el("div","lab-advisor-purchase-identity");
   const iconUpgrade=advice.all.find(u=>u.id===step.id);
   if(iconUpgrade)identity.append(upgradeArtwork(iconUpgrade));
   const copy=el("div","lab-advisor-purchase-copy");
   copy.append(el("strong","",step.name),
    el("small","","Level "+fmt(step.fromLevel)+" → "+fmt(step.toLevel)+
      (step.doubled?" · Doubled":"")));
   identity.append(copy);
   const price=el("div","lab-advisor-purchase-price");
   price.append(el("strong","",numberDisplay(step.price)+" Bucks"),
    el("small","",step.exactPrice?"Estimated discounted cost":"Upper price estimate"));
   const action=el("div","lab-advisor-purchase-status "+(step.fundedByImport?
    "lab-advisor-purchase-ready":"lab-advisor-purchase-save"));
   action.append(el("strong","",step.fundedByImport?"FROM CURRENT BUCKS":
    "SAVE "+numberDisplay(step.missingBucks)+" BUCKS"));
   if(!step.fundedByImport)action.append(el("small","",
    step.missingBucks>0?"Additional Bucks required before this step":
    "Projected after earlier savings"));
   const goalResult=el("div","lab-advisor-step-result");
   goalResult.append(el("span","lab-advisor-step-result-label",step.goalResult.label));
   const diff=el("div","lab-advisor-step-result-values");
   diff.append(el("span","",step.goalResult.current),
    el("span","lab-advisor-step-result-arrow","→"),
    el("strong","",step.goalResult.projected));
   goalResult.append(diff);
   if(!step.goalResult.changed)goalResult.append(el("small","",
    "No modeled change to this total; "+step.nextLevelEffect));
   item.append(number,identity,goalResult,price,action);
   item.title=step.goalResult.note;
   purchaseList.append(item);
  }
  if(plan.stopReason){
   roadmap.append(el("p","lab-advisor-plan-end",plan.stopReason));
  }
  if(!plan.steps.length&&save()){
   roadmap.append(el("p","hint","No valid future purchases are available for this goal."));
  }
  // The recommended purchase is already featured. List other candidates
  // under the requested filters without repeating the same upgrade.
  const alternatives=advice.rows.filter(u=>u.id!==advice.best?.id);
  count.textContent=alternatives.length+" alternatives"+(advisorFilter==="all"?"":" in this filter");
  for(const u of alternatives)root.append(advisorDetail(u,false));
  if(!alternatives.length)root.append(el("p","hint",
   "No other upgrades match these filters. Change the goal or filters to compare more options."));
 }
 function renderDoubler(){
  const root=$("labDoublerResults");root.replaceChildren();
  if(!save()){
   addText(root,"hint","Import a full game save JSON to see assigned Sushi doublers from Spelunk[52].");
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
 const perfectoUI=initializePerfectoUI(getSave);
 function updateImportTime(){
  const status=$("overviewImportTime");
  status.textContent=save()&&importedAt!==null?
   importAgeText(importedAt):"No save imported";
  status.title=save()&&importedAt!==null?
   "JSON imported locally: "+new Date(importedAt).toLocaleString():
   "Import a JSON save to see account progress.";
  $("labSaveStatus").textContent=save()?"Save loaded locally":"No save imported";
 }
 function refresh(){
  renderOverview();renderCatalog();renderAdvisor();renderDoubler();renderKnowledge();
  perfectoUI.refresh();
  updateImportTime();
 }
 function markImported(){
  importedAt=Date.now();
  for(const id of Object.keys(missingListExpanded))missingListExpanded[id]=false;
  refresh();
 }
 function clearImported(){
  importedAt=null;
  for(const id of Object.keys(missingListExpanded))missingListExpanded[id]=false;
  refresh();
 }
 // The displayed age changes even while the save remains unchanged.
 setInterval(()=>{if(importedAt!==null&&save())updateImportTime();},60000);
 setTab("overview");
 setUpgradeTab("catalog");
 refresh();
 return {refresh,markImported,clearImported,open:setTab};
}
