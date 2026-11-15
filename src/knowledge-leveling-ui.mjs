// Knowledge EXP cycle optimizer UI. The imported save is never mutated.
// The account-dependent search only runs on an explicit Build button click.
import {getKnowledgeRows,numberText,projectKnowledgeLevelProgress} from "./lab-model.mjs?v=1.19.14";
import {sushiTierIconPath} from "./sushi-reference.mjs?v=1.16.6";
import {parseGameQuantity} from "./progression-calibration.mjs?v=1.17.1";
import {normalizeKnowledgeCycleOptions}
 from "./knowledge-cycle-optimizer.mjs?v=1.0.3";
import {createReplayController} from "./replay-controller.mjs";
import {
 combineKnowledgeContinuation,knowledgeContinuationResumeStep,
 nextKnowledgeHarvestStep,nextKnowledgeTargetCreationStep
} from "./knowledge-rotation-extension.mjs?v=1.0.7";
import {canExtendBalancedRotation} from "./knowledge-rotation-continuation-eligibility.mjs?v=1.0.1";
import {knowledgeContinueWaveCount,knowledgeContinueButtonLabel} from "./knowledge-refill-scale.mjs?v=1.0.0";
import {installKnowledgeContinueHold} from "./knowledge-continue-hold.mjs?v=1.0.0";
import {buildKnowledgeActiveExpHistory} from "./knowledge-active-exp-history.mjs?v=1.0.1";

const $=id=>document.getElementById(id);
const createKnowledgeWorker=()=>new Worker(new URL("./knowledge-cycle-worker.mjs?v=1.0.30",
 import.meta.url),{type:"module"});
const elem=(tag,cls="",value)=>{
 const node=document.createElement(tag);
 if(cls)node.className=cls;
 if(value!==null&&value!==undefined)node.textContent=String(value);
 return node;
};
const compact=n=>Number.isFinite(n)?numberText(n):"—";
const rate=n=>n===null||n===undefined?"—":compact(n);
const finite=x=>typeof x==="number"&&Number.isFinite(x);
const formatHours=n=>{
 if(n===null||n===undefined||!finite(n)||n<0)return "Unavailable";
 if(n===0)return "Ready";
 if(n<1)return Math.max(1,Math.round(n*60))+" min";
 if(n<48)return compact(n)+" hr";
 return compact(n/24)+" days";
};
const preferenceKey="idleon-sushi-knowledge-cycle-v1";
const FIREPLACE_IMAGES=[
 "Charcoal Fireplace (Upgrade 17).png",
 "Barium Firelighter (Upgrade 26).png",
 "Copper Firelighter (Upgrade 33).png",
 "Lithium Firelighter (Upgrade 40).png",
 "Potassium Firelighter (Upgrade 42).png"
];
const FIREPLACE_NAMES=["Charcoal","Barium","Copper","Lithium","Potassium"];
const showNames=[{key:"knowledgePlanCookSeconds",field:"secondsPerCook"},
 {key:"knowledgePlanMergeSeconds",field:"secondsPerMerge"},
];
const quantityInput=id=>{
 const raw=$(id).value.trim();
 if(!raw)return null;
 try{
  const value=parseGameQuantity(raw);
  return finite(value)&&value>0?value:null;
 }catch{return null;}
};
export function initializeKnowledgeLevelingUI(getSave){
 const mode=$("knowledgePlanMode"),target=$("knowledgePlanTarget");
 const targetLabel=$("knowledgePlanTargetLabel");
 const rangeBox=$("knowledgePlanBalancedRange");
 const rangeStart=$("knowledgePlanRangeStart"),rangeEnd=$("knowledgePlanRangeEnd");
 const build=$("knowledgePlanRun"),cancelButton=$("knowledgePlanCancel");
 const status=$("knowledgePlanStatus");
 const loadBox=$("knowledgePlanLoading"),loadBar=$("knowledgePlanLoadingBar");
 const loadText=$("knowledgePlanLoadingText"),showZero=$("knowledgePlanShowZero");
 const summary=$("knowledgePlanFeatured"),replay=$("knowledgePlanRotation");
 const passiveBox=$("knowledgePlanPassive"),passiveToggle=$("knowledgePlanProtectPassive");
 const board=$("knowledgePlanBoard"),tips=$("knowledgePlanTips");
 const continueButton=$("knowledgePlanContinue");
 const continueStatus=$("knowledgePlanContinueStatus");
 const announceContinuation=message=>{
  // A cached older index.html might not yet contain this optional status
  // element. Never allow a missing status label to break the action.
  if(!continueStatus)return;
  continueStatus.textContent=message;
  continueStatus.classList.toggle("hidden",!message);
 };
 const speed=$("knowledgePlanSpeed");
 let state={mode:"balanced",targetTier:null};
 let result=null,controller=null,worker=null;
 let initialFocusedPlan=null; // The first validated simulation, before extensions
 let activeExpHistory=null,activeExpDisplays=new Map();
 let jumpToNextRefill=false,jumpToNextHarvest=false,jumpToNextTargetCreation=false;
 let continueHold=null;
 try{
  const old=JSON.parse(window.localStorage.getItem(preferenceKey)||"null");
  state={...normalizeKnowledgeCycleOptions(old),preservePassive:old?.preservePassive===true};
 }catch{state={...normalizeKnowledgeCycleOptions(),preservePassive:false};}
 // Open at the complete range, regardless of the previous local selection.
 state.balancedStartTier=1;state.balancedEndTier=64;
 mode.value=state.mode;
 passiveToggle.checked=state.preservePassive;
 const persist=()=>{
  try{window.localStorage.setItem(preferenceKey,JSON.stringify({
   mode:mode.value,targetTier:state.targetTier,
   balancedStartTier:state.balancedStartTier,
   balancedEndTier:state.balancedEndTier,
   preservePassive:passiveToggle.checked
  }));}catch{/* Browser-local settings are optional. */}
 };
 const hideProgress=()=>{
  loadBox?.classList.add("hidden");
  if(loadBar){loadBar.max=100;loadBar.value=0;}
 };
 const beginProgress=message=>{
  if(!loadBox||!loadBar||!loadText)return;
  loadBox.classList.remove("hidden");
  loadBar.removeAttribute("value"); // Indeterminate until worker sends total
  loadText.textContent=message;
 };
 const updateProgress=(completed,total,unit="candidates")=>{
  if(!loadBar||!loadText||!loadBox||!Number.isFinite(total)||total<=0)return;
  const done=Math.max(0,Math.min(total,Number(completed)||0));
  loadBox.classList.remove("hidden");
  loadBar.max=total;loadBar.value=done;
  loadText.textContent=done+" / "+total+" "+unit+" · "+
   Math.round(done/total*100)+"%";
 };
 const stopSearch=()=>{
  worker?.terminate();worker=null;
  cancelButton.classList.add("hidden");
  hideProgress();
  build.disabled=!getSave();
 };
 const release=()=>{
  continueHold?.stop();
  stopSearch();
  controller?.dispose();controller=null;
  result=null;initialFocusedPlan=null;
  activeExpHistory=null;activeExpDisplays.clear();
  jumpToNextRefill=false;jumpToNextHarvest=false;jumpToNextTargetCreation=false;
  announceContinuation("");
  continueButton.classList.add("hidden");continueButton.disabled=false;
  continueButton.textContent="Continue rotation";
  summary.replaceChildren();board.replaceChildren();
  passiveBox.replaceChildren();
  $("knowledgePlanLevelRows").replaceChildren();
  summary.classList.add("hidden");passiveBox.classList.add("hidden");
  replay.classList.add("hidden");
 };
 function renderRangeValues(){
  $("knowledgePlanRangeStartValue").textContent="T"+state.balancedStartTier;
  $("knowledgePlanRangeEndValue").textContent="T"+state.balancedEndTier;
  $("knowledgePlanRangeValue").textContent="T"+state.balancedStartTier+
   " → T"+state.balancedEndTier;
  const detail=$("knowledgePlanStrategyDetail");
  if(detail&&mode.value==="balanced")
   detail.textContent="Earn EXP across T"+state.balancedStartTier+"–T"+
    state.balancedEndTier+" · start with T"+state.balancedStartTier+
    " Sushi and finish by creating a new T"+state.balancedEndTier+".";
  const slider=$("knowledgePlanDualRange");
  if(slider){
   const max=Number(rangeStart.max)||64;
   slider.style.setProperty("--kp-start",((state.balancedStartTier-1)/(max-1)*100)+"%");
   slider.style.setProperty("--kp-end",((state.balancedEndTier-1)/(max-1)*100)+"%");
   rangeStart.style.zIndex=state.balancedStartTier===state.balancedEndTier?"3":"2";
  }
 }
 function updateTargets(){
  const candidates=getKnowledgeRows(getSave()).filter(x=>x.discovered);
  const old=Number(state.targetTier);
  target.replaceChildren();
  for(const tier of candidates)target.append(new Option(
   "T"+tier.tier+" · "+tier.name,String(tier.tier)));
  state.targetTier=candidates.some(x=>x.tier===old)?old:candidates[0]?.tier??null;
  if(state.targetTier!==null)target.value=String(state.targetTier);
  targetLabel.classList.toggle("hidden",mode.value!=="focused");
  rangeBox.classList.toggle("hidden",mode.value!=="balanced");
  $("knowledgePlanNextHarvest").classList.toggle("hidden",mode.value!=="focused");
  $("knowledgePlanNextTargetCreation").classList.toggle("hidden",mode.value!=="focused");
  const maxTier=64;
  rangeStart.max=rangeEnd.max=String(maxTier);
  state.balancedStartTier=Math.max(1,Math.min(maxTier,
   Math.floor(Number(state.balancedStartTier))||1));
  state.balancedEndTier=Math.max(state.balancedStartTier,
   Math.min(maxTier,Math.floor(Number(state.balancedEndTier))||64));
  rangeStart.value=String(state.balancedStartTier);
  rangeEnd.value=String(state.balancedEndTier);
  renderRangeValues();
  const strategyDetail=$("knowledgePlanStrategyDetail");
  if(strategyDetail&&mode.value==="focused")
   strategyDetail.textContent="Create T"+state.targetTier+" repeatedly · harvest copies to free space.";
 }
 function calibration(){
  const options={
   mode:mode.value,
   targetTier:state.targetTier,
   balancedStartTier:state.balancedStartTier,
   balancedEndTier:state.balancedEndTier,
   preservePassive:passiveToggle.checked,
   fuelGeneration:quantityInput("knowledgePlanFuelRate"),
   fuelCapacity:quantityInput("knowledgePlanFuelCap"),
   expPerCreation:quantityInput("knowledgePlanXpPerCreation"),
   rounds:Number($("knowledgePlanRounds").value)
  };
  for(const {key,field} of showNames)options[field]=Number($(key).value);
  return options;
 }
 function metric(label,value){
  const card=elem("div","lab-kp-stat");
  card.append(elem("small","",label),elem("strong","",value));return card;
 }
 function addNote(parent,text,cls="hint"){
  parent.append(elem("p",cls,text));
 }
 function renderSummary(p){
  const metricsOpen=summary.querySelector(".lab-kp-more-metrics")?.open??false;
  const notesOpen=summary.querySelector(".lab-kp-plan-notes")?.open??false;
  summary.replaceChildren();summary.classList.remove("hidden");
  const heading=elem("div","lab-kp-headline");
  heading.append(elem("h3","",p.mode==="focused"?
   "Focused target-building rotation · T"+p.targetTier:
   "Balanced · T"+(p.balancedStartTier??1)+" → T"+(p.balancedEndTier??64)),
   elem("p","",p.roundsCompleted+" refills · start T"+
    (p.mode==="balanced"?p.firstCookResultTier:p.startCookTier)+
    " · "+p.cooks+" cooks · "+p.windEvents+" Wind upgrades"));
  summary.append(heading);
  // Match Perfecto's result hierarchy: four primary KPIs, with the
  // supporting diagnostics still available but out of the main visual flow.
  const primary=p.mode==="focused"?[
   ["T"+p.targetTier+" creations",compact(p.targetCreated)],
   ["T"+p.targetTier+" active EXP",compact(p.targetExp)],
   ["Peak copies on board",compact(p.peakTargetCopies)],
   ["Batch harvests",compact(p.harvestCount)]
  ]:[
   ["Range EXP coverage",p.coverageTotal+" / "+p.coverageRequested],
   ["Active EXP",compact(p.totalExpPerCycle)],
   ["Highest newly created","T"+p.highestNewTier],
   ["Refills",compact(p.roundsCompleted)]
  ];
  const primaryGrid=elem("div","lab-kp-stats lab-kp-primary-stats");
  primary.forEach(([label,value],i)=>{
   const card=metric(label,value);
   if(i===0)card.classList.add("is-primary");
   primaryGrid.append(card);
  });
  summary.append(primaryGrid);
  if(p.creationXp){
   const xp=p.creationXp,section=elem("section","lab-kp-creation-xp");
   const header=elem("div","lab-kp-creation-xp-header");
   header.append(elem("h4","","EXP per creation"),
    elem("span","lab-kp-formula-tag",
     xp.manuallyCalibrated?"Manual override":"Account-calculated"));
   section.append(header);
   const values=elem("div","lab-kp-creation-xp-values");
   values.append(metric("Normal fireplace",compact(xp.regular)),
    metric("Pink Lithium fireplace",
     xp.lithiumEnabled?compact(xp.pink):"Not unlocked"));
   section.append(values);
   const formula=elem("details","lab-kp-formula-details");
   formula.append(elem("summary","","Formula and assumptions"));
   addNote(formula,"Base "+compact(xp.base)+
    " × 3rd Degree Searing "+compact(xp.thirdMultiplier)+
    " × Knowledge bonuses "+compact(xp.knowledgeMultiplier)+
    (xp.lithiumEnabled?
     " × Lithium "+compact(xp.pinkMultiplier)+" (base 2×, "+
     "Fireplace Strength bonus +"+compact(xp.fireplaceKnowledgeBonus)+"%, "+
     "Sparks bonus +"+compact(xp.fireplaceSparkBonus)+"%)":"")+
    ". The result depends on the column where each sushi is CREATED, "+
    "not where it is moved later. The pink amount assumes a pink fireplace "+
    "is selected in that column."+
    (xp.lithiumEnabled&&!xp.sparksKnown&&!xp.manualLithium?
     " WARNING: Sparks were missing from the imported JSON; "+
     "the pink fireplace estimate may be too low.":"")+
    " Calculated from imported stats; verify against the in-game EXP value.",
    "lab-kp-creation-xp-explanation");
   section.append(formula);
   if(xp.lithiumEnabled&&!xp.sparksKnown&&!xp.manualLithium)
    addNote(section,"Sparks missing from import · pink EXP may be underestimated.","lab-kp-warning");
   summary.append(section);
  }
  const secondary=[
   ...(p.mode==="focused"?[
    ["T"+p.targetTier+" consumed in harvest",compact(p.targetMergedInHarvest)],
    ["T"+p.targetTier+" still on board",compact(p.focusCopies)],
    ["Highest newly created tier","T"+p.highestNewTier]
   ]:[
    ["Tiers missing active EXP",String(p.uncoveredTiers.length)],
    ["Completed goal-tier rotations",String(p.balancedCycles)],
    ["Survivor parking",p.packingMode==="ascending"?"Staircase low → high":
     p.packingMode==="descending"?"Staircase high → low":"Simple parking"]
   ]),
   ...(p.mode==="focused"?[["Refills simulated",p.roundsCompleted+" / "+p.roundsRequested]]:[]),
   ["Starting cook tier","T"+p.startCookTier+
    (p.firstCookResultTier!==undefined&&p.firstCookResultTier!==p.startCookTier?
     " → T"+p.firstCookResultTier:"")],
   ["Full refill Fuel",compact(p.refillFuelSafety.fuel)+" / "+
    compact(p.refillFuelSafety.budget)],
   ["Projected active EXP / hr",rate(p.previewExpPerHour)],
   ["Estimated fuel / preview",compact(p.fuelPerCycle)],
   ["Fireplace scenario",p.fireChoice],
   ["Sushi cooked",compact(p.cooks)],
   ["Legal merges",compact(p.merges)],
   ["Sushi moves",compact(p.moves)],
   ["East Wind upgrades",compact(p.windEvents)]
  ];
  const more=elem("details","lab-kp-more-metrics");
  more.open=metricsOpen;
  more.append(elem("summary","","All plan metrics · cooking, Fuel, and EXP estimates"));
  const grid=elem("div","lab-kp-stats lab-kp-secondary-stats");
  secondary.forEach(([label,value])=>grid.append(metric(label,value)));
  more.append(grid);
  summary.append(more);
  const extra=elem("details","lab-kp-plan-notes");
  extra.open=notesOpen;
  const extraBody=elem("div","lab-kp-plan-notes-body");
  extra.append(elem("summary","","Plan notes and assumptions"),extraBody);
  const planNote=(text,cls="lab-kp-note")=>
   addNote(cls==="lab-kp-warning"?summary:extraBody,text,cls);
  if(p.mode==="balanced"){
   planNote("Prepare and refill T"+(p.firstCookResultTier??p.actualBalancedStartTier)+
    " Sushi, then merge upward to create T"+p.balancedEndTier+
    ". Active EXP for T"+p.balancedStartTier+"–T"+p.balancedEndTier+
    " is the scoring priority. The game cook request is T"+p.startCookTier+
    (p.guaranteedCookBonus?
     ", plus "+p.guaranteedCookBonus+" guaranteed cooking tiers.":"."),
    "lab-kp-note");
   if(p.actualBalancedStartTier>p.balancedStartTier)
    planNote("Requested Start T"+p.balancedStartTier+
     " cannot be cooked with your guaranteed +tier bonus. This plan starts "+
     "at the lowest obtainable T"+p.actualBalancedStartTier+".",
     "lab-kp-warning");
  }
  if(!p.fuelSafePreparation)
   planNote("Fuel warning: preparing this full board is estimated "+
    "to require "+formatHours(p.refillFuelSafety.estimatedWaitSeconds/3600)+
    " of extra regeneration beyond the initial Fuel buffer. "+
    (p.mode==="balanced"?
     "Your selected Start tier is kept; the optimizer does not lower it to skip Fuel waits.":
     "The selected cooking tier was the least-waiting tested candidate, not an instant full-board recipe."),
    "lab-kp-warning");
  else planNote("Fuel-safe first fill: the chosen recipe fits within "+
   "the imported Fuel balance (up to half of max capacity reserved for the "+
   "first fill) plus regeneration during cooking. Later refills may "+
   "require additional waiting.","lab-kp-note");
  if(p.mode==="balanced"){
   if(p.uncoveredTiers.length)
    planNote(p.uncoveredTiers.length+" discovered tiers still "+
     "lack ACTIVE Knowledge EXP in the modeled preview: "+
     p.uncoveredTiers.map(t=>"T"+t).join(", ")+
     ". Tiers above the safe cooking range need additional merges/Wind "+
     "or further refills; no EXP is claimed until a legal creation occurs.",
     "lab-kp-warning");
   else planNote("All "+p.coverageRequested+
    " discovered Sushi tiers gained active EXP within this preview.",
    "lab-kp-lithium");
  }
  if(p.mode==="focused"){
   const focus=p.perTier.find(x=>x.tier===p.targetTier);
   if(focus){
    const box=elem("div","lab-kp-focus-summary");
    box.append(elem("strong","","T"+focus.tier+" · "+focus.name),
     elem("span","","Active "+rate(focus.activeExpPerHour)+" EXP/hr + "+
      "Passive "+compact(focus.passiveExpPerDay)+" EXP/day = "+
      rate(focus.expPerHour)+" hybrid EXP/hr · "+
      "Next level: "+formatHours(focus.etaHours)+
      " · "+p.focusCopies+" copies remain on board"));
    summary.append(box);
   }
  }
  const pink=p.pinkFireplaces;
  if(pink){
   if(!pink.lithiumUnlocked)
    planNote("Pink Lithium fireplaces are not unlocked in the imported save. The planner cannot apply their EXP multiplier.","lab-kp-warning");
   else if(pink.requiresPinkActivation)
    planNote("FIREPLACE SETUP REQUIRED: your imported save has "+
     pink.importedPinkCount+" active pink fireplaces, but this plan ASSUMES "+
     pink.proposedPinkCount+" pink fireplaces. Manually switch columns "+
     pink.switchToPink.map(col=>col+1).join(", ")+" to pink before following the plan. "+
     "The displayed EXP projections are conditional on those changes.","lab-kp-warning");
   else if(pink.requiresFireplaceChanges)
    planNote("This proposal changes the imported fireplace layout. "+
     "Check the prepared-board fireplace row and apply the proposed setup "+
     "manually; the displayed EXP and Fuel estimates assume that setup.","lab-kp-warning");
   else
    planNote(pink.importedPinkCount+" pink Lithium fireplaces are "+
     "already selected in the imported save. No fireplace changes are "+
     "required for this proposed layout.","lab-kp-lithium");
  }
  if(p.mode==="focused"&&p.targetPreviewIncomplete)
   planNote("No NEW T"+p.targetTier+" was created within "+
    p.roundsCompleted+" preview refill waves. "+
    (p.harvestCount?
     "Only copies already on the board could be consolidated; "+
      "harvesting them awards higher-tier EXP, not T"+p.targetTier+" EXP.":
     "This is precursor preparation only, not a target-tier harvest."),
    "lab-kp-warning");
  else if(p.mode==="focused"&&!p.harvestCount)
   planNote("T"+p.targetTier+" copies are banked; the board has "+
    "not yet reached a harvest point. Continue preparation rather than "+
    "merging them prematurely.","lab-kp-note");
  else if(p.mode==="focused")
   planNote(p.harvestCount+" batch harvest(s) recover space "+
    "only after preparing T"+p.targetTier+" copies. Harvest merges "+
    "create higher tiers and do not award additional T"+p.targetTier+
    " EXP (except capped T64).","lab-kp-note");
  if(p.scenarioRequiresCleanup)
   planNote("PREPARATION REQUIRED: "+p.design.omittedCount+
    " Sushi from your current board are not part of this designed "+
    "starting scenario. They must be dealt with using legal gameplay. "+
    "The optimizer has NOT verified a route from your current inventory "+
    "to this setup, and cannot delete Sushi.","lab-kp-warning");
  planNote(p.note);
  planNote("Final board: "+p.stranded+" Sushi · highest working tier T"+p.highestWorkingTier+
   (p.mode==="focused"?" · T"+p.targetTier+" copies: "+p.focusCopies:"")+
   ". "+p.haltReason,"lab-kp-note");
  if(p.rotationTerminal)planNote(
   "Full Balanced rotation complete: a NEW T"+(p.balancedEndTier??64)+
   " was created by a legal cook, merge, or East Wind cascade. The original protected Sushi was not counted.",
   "lab-kp-lithium");
  else planNote(
   "Continuing preview · EXP/hr is modeled over the visible rotation, not a verified long-term rate.",
   "lab-kp-note");
  summary.append(extra);
 }
  function renderPassive(p){
  const model=p.passive;
  passiveBox.replaceChildren();
  passiveBox.classList.remove("hidden");
  const block=elem("details","lab-kp-passive-panel");
  block.append(elem("summary","","Passive EXP · Plate setup"),
   elem("p","hint","Imported EXP/day uses your actual Sushi, Plates and fireplaces. "+
    "The suggested EXP/day assumes "+p.fireChoice+" fireplaces and the proposed Plate placement. "+
    "Only Sushi and Plates already on the board are used; the layout is a manual guide, never an automatic replay step."));
  const cards=elem("div","lab-kp-passive-stats");
  for(const [label,value] of [
   ["Imported passive coverage",model.imported.covered+" / 64 tiers"],
   ["Suggested passive coverage",model.recommended.covered+" / 64 tiers"],
   ["Current EXP/day",compact(model.imported.totalDaily)],
   ["Suggested EXP/day",compact(model.recommended.totalDaily)]
  ])cards.append(metric(label,value));
  if(p.mode==="focused"){
   cards.append(metric("T"+p.targetTier+" · imported passive/day",
    compact(model.imported.expPerDay[p.targetTier])),
   metric("T"+p.targetTier+" · suggested passive/day",
    compact(model.recommended.expPerDay[p.targetTier])));
  }
  block.append(cards);
  const occupancy=elem("div","lab-kp-passive-assignments");
  const formatAssignments=(indices)=>indices.length?
   indices.map(i=>"T"+p.importedBoard[i]+
    " (R"+(Math.floor(i/15)+1)+"C"+(i%15+1)+")").join(" · "):
   "No occupied sources available";
  occupancy.append(
   elem("p","","Cold Plates: "+formatAssignments(model.coldPositions)),
   elem("p","","Milktoast Plates: "+formatAssignments(model.milktoastPositions)));
  block.append(occupancy);
  if(model.needAnotherT64)addNote(block,
   "A single T64 on Cold covers T1–T63, but T64 itself still needs Milktoast. "+
   "A second T64 is required to cover all 64 tiers this way. No extra T64 has been assumed.",
   "lab-kp-warning");
  if(!model.allTargetsCorrect)addNote(block,
   "Some suggested plate positions could not be assigned by pairwise swaps. "+
   "Treat the preview as a partial setup, not a confirmed arrangement.",
   "lab-kp-warning");
  if(p.mode==="focused"&&!p.importedBoard.includes(p.targetTier))addNote(block,
   "T"+p.targetTier+" is discovered but not currently on the board. "+
   "The Focused rotation must create a copy before it can be parked on a Milktoast Plate.",
   "lab-kp-note");
  const boardTitle=elem("div","lab-kp-passive-board-heading");
  boardTitle.append(elem("strong","","Suggested plate positions · after manual setup"),
   elem("span","",model.plateSwaps.length+" plate swaps suggested"));
  block.append(boardTitle);
  const grid=elem("div","lab-kp-passive-board");
  const slots=model.recommendedSlots;
  for(let i=0;i<120;i++){
   const type=slots[i]??-1,tier=p.importedBoard[i]??0;
   const tile=elem("div","lab-kp-passive-tile slot-"+type);
   if(type<0)tile.classList.add("locked");
   if(type!==p.layout.slots[i])tile.classList.add("changed");
   tile.title="R"+(Math.floor(i/15)+1)+"C"+(i%15+1)+
    " · "+(tier?"T"+tier:"Empty")+" · "+
    (type===2?"Cold":type===3?"Milktoast":type===1?"Hot":
     type===0?"Regular":"Locked")+
    (type!==p.layout.slots[i]?" · plate position suggested":"");
   if(tier){
    const icon=elem("img");
    icon.src=sushiTierIconPath(tier);icon.alt="";icon.loading="lazy";
    icon.onerror=()=>icon.remove();
    tile.append(icon,elem("strong","",String(tier)));
   }
   grid.append(tile);
  }
  const wrap=elem("div","lab-kp-passive-board-wrap");
  wrap.append(grid);block.append(wrap);
  addNote(block,"Use Movement Mittens to rearrange plates before following this "+
   "suggested setup. The active walkthrough below still starts from your "+
   "IMPORTED plate/Sushi layout and does not assume these plate changes "+
   "have happened. Estimated EXP/day excludes unknown modifiers.");
  passiveBox.append(block);
 }
 function showProgress(p){
  const rows=$("knowledgePlanLevelRows");
  rows.replaceChildren();
  activeExpDisplays.clear();
  const inRange=t=>t>=(p.balancedStartTier??1)&&
   t<=(p.balancedEndTier??64);
  let ordered=p.perTier.slice().sort((a,b)=>
   p.mode==="focused"&&a.tier===p.targetTier?-1:
   p.mode==="focused"&&b.tier===p.targetTier?1:
   p.mode==="balanced"&&inRange(a.tier)!==inRange(b.tier)?
    (inRange(a.tier)?-1:1):
   (b.expPerHour??-1)-(a.expPerHour??-1)||a.tier-b.tier);
  const visible=ordered.filter(entry=>
   showZero?.checked||entry.expPerCycle>0||entry.passiveExpPerDay>0);
  const counter=$("knowledgePlanLevelCount");
  if(counter)counter.textContent=visible.length+" / "+ordered.length+" tiers";
  $("knowledgePlanLevelEmpty")?.classList.toggle("hidden",visible.length>0);
  for(const entry of visible){
   const tr=elem("tr");
   if(p.mode==="focused"&&entry.tier===p.targetTier)
    tr.classList.add("is-target");
   if(p.mode==="balanced")
    tr.classList.add(inRange(entry.tier)?"is-balanced-range":"is-outside-range");
   const name=elem("td","lab-kp-tier");
   const nameContent=elem("div","lab-kp-tier-content");
   const img=elem("img");
   img.src=sushiTierIconPath(entry.tier);img.alt="";img.loading="lazy";
   img.onerror=()=>img.remove();
   nameContent.append(img,elem("span","","T"+entry.tier+" · "+entry.name));
   name.append(nameContent);
   const active=elem("td","lab-kp-active-gain-cell");
   const activeContent=elem("div","lab-kp-active-content");
   const activeHeading=elem("div","lab-kp-active-heading");
   const gained=elem("span","lab-kp-exp-value is-empty","0");
   const levelStatus=elem("small","lab-kp-tier-level-status hidden");
   const expBadges=elem("span","lab-kp-exp-badges");
   expBadges.append(gained,levelStatus);
   const created=elem("small","lab-kp-creation-count","0 creations");
   activeHeading.append(expBadges,created);
   activeContent.append(activeHeading);
   // Green is saved Knowledge EXP; blue is active EXP earned by this step.
   let expBar=null,projected=null,initialPct=0;
   if(Number.isFinite(entry.xp)&&Number.isFinite(entry.xpReq)&&entry.xpReq>0){
    initialPct=Math.max(0,Math.min(100,entry.xp/entry.xpReq*100));
    const progressWrap=elem("div","lab-kp-tier-exp");

    const label=elem("small","lab-kp-tier-exp-current",
     "Current Lv "+entry.level+" · "+compact(entry.xp)+
     " / "+compact(entry.xpReq)+" EXP");
    expBar=elem("div","lab-kp-tier-exp-bar");
    expBar.setAttribute("role","progressbar");
    expBar.setAttribute("aria-label","Imported Knowledge EXP for T"+entry.tier);
    expBar.setAttribute("aria-valuemin","0");
    expBar.setAttribute("aria-valuemax","100");
    expBar.setAttribute("aria-valuenow",String(Math.round(initialPct*10)/10));
    const saved=elem("span","lab-kp-tier-exp-saved");
    saved.style.width=initialPct+"%";
    projected=elem("span","lab-kp-tier-exp-new");
    projected.style.width="0%";
    expBar.append(saved,projected);
    progressWrap.append(label,expBar);
    activeContent.append(progressWrap);
   }
   active.append(activeContent);
   active.title="Simulated gain to the selected walkthrough step. "+
    "Full-preview T"+entry.tier+" EXP: "+compact(entry.expPerCycle)+
    ". Actual in-game EXP must be measured separately.";
   activeExpDisplays.set(entry.tier,{gained,created,expBar,projected,
    levelStatus,
    initialPct,xpReq:entry.xpReq,xp:entry.xp,level:entry.level});
   const totalRate=elem("td","",rate(entry.expPerHour));
   totalRate.title="Estimated active EXP/hr plus modeled passive EXP/hr";
   const nextLevel=elem("td","",formatHours(entry.etaHours));
   nextLevel.title="Estimated using active and passive EXP rates";
   tr.append(name,active,totalRate,nextLevel);
   rows.append(tr);
  }
 }
 function renderVisibleActiveExp(step){
  if(!activeExpHistory)return;
  for(const [tier,display] of activeExpDisplays){
   const {exp,creations}=activeExpHistory.atStep(tier,step);
   display.gained.textContent=compact(exp);
   display.gained.classList.toggle("is-empty",exp===0);
   display.created.textContent=creations?creations+" creation"+(creations===1?"":"s"):"";
   if(display.expBar&&display.projected){
    const projection=projectKnowledgeLevelProgress(display.level,display.xp,exp);
    if(!projection)continue;
    const leveled=projection.levelUps>0;
    // Keep exactly one bar: after crossing the next-level threshold it
    // remains at 100% while the +X Lv. badge shows total levels earned.
    const additional=leveled?100-display.initialPct:
     Math.max(0,Math.min(100-display.initialPct,
      (projection.projectedPercent??display.initialPct)-display.initialPct));
    display.projected.style.width=additional+"%";
    display.expBar.setAttribute("aria-valuenow",
     String(Math.round((display.initialPct+additional)*10)/10));
    display.levelStatus.classList.toggle("hidden",!leveled);
    if(leveled){
     display.levelStatus.textContent="+"+projection.levelUps+" Lv.";
     display.levelStatus.title="Imported Lv "+display.level+
      " → projected Lv "+projection.projectedLevel+
      " · "+compact(projection.projectedXp)+" / "+
      (projection.projectedRequired===null?"unknown":
       compact(projection.projectedRequired))+" EXP carried into the projected level";
    }
    display.expBar.title="Imported Lv "+display.level+": "+
     compact(display.xp)+" / "+compact(display.xpReq)+" EXP · "+
     "active gain +"+compact(exp)+" EXP"+
     (leveled?" · projected Lv "+projection.projectedLevel+
      " with "+compact(projection.projectedXp)+" overflow EXP":"");
   }
  }
 }
 function renderFrame(index){
  if(!result)return;
  const frame=result.steps[index];if(!frame)return;
  const slots=result.layout.slots;
  const passiveProtected=new Set(frame.protectedIndices??result.protectedIndices??[]);
  const changed=new Set((frame.events??[]).map(e=>e.at));
  if(frame.src!==undefined)changed.add(frame.src);
  if(frame.dst!==undefined)changed.add(frame.dst);
  board.replaceChildren();
  board.setAttribute("aria-label","Sushi Knowledge board, step "+index+
   " of "+(result.steps.length-1));
  for(let i=0;i<120;i++){
   const slot=slots[i]??-1,tier=frame.board[i]??0;
   const box=elem("div","lab-kp-tile slot-"+slot);
   box.title="Row "+(Math.floor(i/15)+1)+", column "+(i%15+1)+
    " · "+(slot<0?"Locked":tier?"T"+tier:"Empty");
   if(slot<0)box.classList.add("locked");
   if(tier===64)box.classList.add("is-protected");
   if(tier&&passiveProtected.has(i))box.classList.add("is-passive-protected");
   if(result.mode==="focused"&&tier===result.targetTier)
    box.classList.add("is-focus-target");
   if(changed.has(i))box.classList.add("is-affected");
   if(tier>0){
    const img=elem("img","lab-kp-tile-icon");
    img.src=sushiTierIconPath(tier);img.alt="";img.loading="lazy";
    img.onerror=()=>img.remove();
    box.append(img,elem("strong","",String(tier)));
   }
   board.append(box);
  }
  // Fireplace columns appear below the 8×15 Sushi grid.
  const fireRow=elem("div","lab-kp-fire-row");
  for(let c=0;c<15;c++){
   const type=result.proposedFires[c]??-1;
   const fire=elem("span","lab-kp-fire fire-"+type);
   fire.title="Column "+(c+1)+" · "+(type===3?"Lithium pink (2× Knowledge EXP)":
    type===0?"Orange · Fuel production":type>=0?FIREPLACE_NAMES[type]+" fireplace":"Locked");
   if(type>=0&&FIREPLACE_IMAGES[type]){
    const img=elem("img","lab-kp-fire-art");
    img.src="assets/campfires/"+encodeURIComponent(FIREPLACE_IMAGES[type]);
    img.alt=FIREPLACE_NAMES[type]+" fireplace";
    img.loading="lazy";
    img.onerror=()=>{img.remove();fire.textContent="♨";};
    fire.append(img);
   }
   fireRow.append(fire);
  }
  board.append(fireRow);
  $("knowledgePlanStepTitle").textContent="Step "+index+" · "+frame.title;
  const kind=$("knowledgePlanStepKind");
  if(kind){
   const event=frame.kind==="merge"&&frame.events?.some(e=>e.kind==="wind")?
    "wind":frame.kind;
   const captions={start:"START",wave:"WAVE",refill:"REFILL",cook:"COOK",
    merge:"MERGE",move:"MOVE",stage:frame.phase==="harvest"?"HARVEST":"PREPARE",
    wind:"WIND CASCADE",partial:"PREVIEW LIMIT",repeat:"COMPLETE"};
   kind.textContent=captions[event]??String(event??"STEP").toUpperCase();
   kind.className="lab-kp-step-kind kind-"+event;
  }
  const replayProgress=$("knowledgePlanReplayProgress");
  if(replayProgress){
   replayProgress.max=Math.max(1,result.steps.length-1);
   replayProgress.value=index;
  }
  $("knowledgePlanStepDetail").textContent=frame.detail;
  const createdXp=$("knowledgePlanCreatedXp");
  if(createdXp){
   createdXp.replaceChildren();
   const created=(frame.events??[]).filter(e=>
    ["cook","merge","wind"].includes(e.kind)&&
    Number.isFinite(e.knowledgeExp));
   createdXp.classList.toggle("hidden",created.length===0);
   if(created.length){
    createdXp.append(elem("span","lab-kp-created-exp-label",
     "Created · predicted EXP"));
    for(const event of created){
     const pink=result.proposedFires[event.at%15]===3;
     const chip=elem("span","lab-kp-created-exp-chip"+
      (pink?" is-pink":""));
     chip.append(elem("strong","","T"+event.tier+" +"+
      compact(event.knowledgeExp)),
      elem("small","",(event.kind==="wind"?"Wind":event.kind)+
       " · C"+(event.at%15+1)+(pink?" · pink":"")));
     chip.title="Calculated EXP for this individual T"+event.tier+
      " creation: "+event.knowledgeExp;
     createdXp.append(chip);
    }
   }
  }
  renderVisibleActiveExp(index);
  $("knowledgePlanStepCount").textContent=index+" / "+(result.steps.length-1);
  $("knowledgePlanStepXp").textContent="EXP in step: "+compact(frame.exp);
  const earned=result.cumulativeExp?.[index]??result.steps.slice(0,index+1).
   reduce((s,x)=>s+x.exp,0);
  $("knowledgePlanFrameXp").textContent="Preview EXP so far: "+compact(earned);
  const progress=$("knowledgePlanFocusProgress");
  progress.classList.toggle("hidden",result.mode!=="focused");
  if(result.mode==="focused")progress.textContent=
   (frame.phase==="harvest"?"HARVEST":"PREPARE")+" T"+result.targetTier+
   " · "+frame.targetCreated+" created · "+frame.targetCopies+" banked";
  $("knowledgePlanNextRefill").title=result.steps.some((f,i)=>
   i>index&&f.kind==="refill")?
   "Jump to the next simulated refill":
   canExtendBalancedRotation(result)?
    "Continue from this board by "+knowledgeContinueWaveCount(result.roundsCompleted)+" refill waves (5%)":
    "No further legal refill; "+result.haltReason;
  const focused=result.mode==="focused";
  const canContinue=focused&&canExtendBalancedRotation(result);
  $("knowledgePlanNextHarvest").disabled=
   nextKnowledgeHarvestStep(result.steps,index)<0&&!canContinue;
  const nextTarget=$("knowledgePlanNextTargetCreation");
  nextTarget.classList.toggle("hidden",!focused);
  if(focused){
   nextTarget.textContent="Next T"+result.targetTier+" creation";
   nextTarget.title="Jump to the next T"+result.targetTier+
    " creation from cooking, merging or Wind";
  }
  nextTarget.disabled=!focused||
   nextKnowledgeTargetCreationStep(result.steps,index,result.targetTier)<0&&!canContinue;
  $("knowledgePlanPrev").disabled=index===0;
  $("knowledgePlanNext").disabled=index===result.steps.length-1&&
   !canExtendBalancedRotation(result);
 }
 function createReplay(p,resumeIndex=null){
  controller?.dispose();
  result=p;replay.classList.remove("hidden");
  activeExpHistory=buildKnowledgeActiveExpHistory(p.steps);
  p.cumulativeExp=[];
  let running=0;
  for(const frame of p.steps)p.cumulativeExp.push(running+=frame.exp);
  controller=createReplayController({
   totalSteps:p.steps.length-1,
   onStep:renderFrame,
   onPlayStateChange:playing=>{
    $("knowledgePlanPlay").textContent=playing?"Pause":"Play";
   },
   getDelay:()=>Number(speed.value)
  });
  // Balanced ends on the selected new End tier; Focused keeps building and
  // harvesting its selected target while legal progress is possible.
  continueButton.classList.toggle("hidden",!canExtendBalancedRotation(p));
  continueButton.textContent=knowledgeContinueButtonLabel(p.roundsCompleted);
  continueButton.title="Click for +5% of current refills. Hold to repeat; release to stop after the current validated increment.";
  continueButton.disabled=false;
  const initial=Math.min(resumeIndex??p.preparedStep??0,p.steps.length-1);
  if(initial>0)controller.goTo(initial);
  else renderFrame(0);
 }
 function renderNotes(){
  tips.replaceChildren();
  const bullets=[
   "The optimizer uses the Combo Meter legal merge engine, including up to 25 East Wind upgrades when unlocked. Each verified creation event awards EXP to the created Sushi tier.",
   "Lithium Firelighter is 2× Knowledge EXP for Sushi above pink fireplaces; the solver also models reduced Fuel regeneration when orange fireplaces are changed to pink.",
   "The optimizer chooses a NEW prepared Sushi board rather than copying the imported inventory. It retains your highest-tier Sushi at its original location. Clearing other current Sushi to reach this preparation is a separate, unsolved task.",
   "Balanced prepares and refills the selected Start tier (after guaranteed +tier cooking bonuses), then merges toward the End tier. An existing protected Sushi does not count as a newly created End tier. An unobtainable custom Start is reported rather than replaced. Click Continue for another 5% of refills, or hold to repeat.",
   "Focused: produce and bank the selected tier, then harvest pairs only when necessary to recover space. Click Continue to extend by 5%, or hold it down to repeat until release (an in-flight increment finishes). Focused does not stop when a T64 is created; its goal is continued target EXP.",
   "Moving Sushi into a vacant slot is a separate action. Movement Mittens toggles dragging to plates; disable it for Sushi repositioning.",
   "The first full-board fill is screened using the imported Fuel balance, Fuel capacity, estimated generation and actual tier costs. A separate warning appears if no tested recipe avoids regeneration waits. Milktoast/Cold provide passive EXP/day and can be optionally protected.",
   "The optimizer compares bounded candidate patterns and counts only verified active creation EXP. The replay's final state and stop reason are always shown; the walkthrough never claims to continue beyond its simulated actions."
  ];
  for(const note of bullets)tips.append(elem("li","",note));
 }
 // Step 0 and Prepared are true restarts for Focused, discarding the
 // extra replay and finalBoard produced by later Next Harvest searches.
 function rewindKnowledgeReplay(prepared=false){
  if(!result||!controller)return;
  continueHold?.stop();
  if(worker){
   stopSearch(); // Discard an in-flight continuation before rewinding.
   continueButton.disabled=false;
   continueButton.textContent=knowledgeContinueButtonLabel(result.roundsCompleted);
  }
  jumpToNextRefill=false;jumpToNextHarvest=false;
  jumpToNextTargetCreation=false;
  if(result.mode==="focused"&&initialFocusedPlan&&
   result!==initialFocusedPlan){
   const original=initialFocusedPlan;
   renderSummary(original);
   renderPassive(original);
   showProgress(original);
   createReplay(original,prepared?original.preparedStep??0:0);
   const message="Focused T"+original.targetTier+
    " restarted from the original preparation. Additional simulated refills were reset.";
   status.textContent=message;
   announceContinuation(message);
  }else{
   const index=prepared?Math.min(result.preparedStep??0,
    result.steps.length-1):0;
   controller.goTo(index);
  }
 }
 showZero?.addEventListener("change",()=>{
  if(!result)return;
  showProgress(result);
  renderVisibleActiveExp(controller?.step??0);
 });
 const clearAndPrompt=()=>{
  release();updateTargets();
  build.disabled=!getSave();
  status.textContent=getSave()?
   "Choose Balanced or Focused and simulate continuous refills. Timing and Fuel are estimated unless calibrated.":
   "Import a Sushi Station save in Overview before optimizing.";
  renderNotes();
 };
 mode.addEventListener("change",()=>{
  state.mode=mode.value;persist();clearAndPrompt();
 });
 for(const [slider,key,other] of [
  [rangeStart,"balancedStartTier",rangeEnd],
  [rangeEnd,"balancedEndTier",rangeStart]
 ]){
  slider.addEventListener("input",()=>{
   state[key]=Number(slider.value);
   if(key==="balancedStartTier"&&state.balancedStartTier>state.balancedEndTier){
    state.balancedEndTier=state.balancedStartTier;
    other.value=String(state.balancedEndTier);
   }else if(key==="balancedEndTier"&&state.balancedEndTier<state.balancedStartTier){
    state.balancedStartTier=state.balancedEndTier;
    other.value=String(state.balancedStartTier);
   }
   renderRangeValues();
  });
  slider.addEventListener("change",()=>{persist();release();});
 }
 passiveToggle.addEventListener("change",()=>{
  state.preservePassive=passiveToggle.checked;persist();clearAndPrompt();
 });
 target.addEventListener("change",()=>{
  state.targetTier=Number(target.value);persist();release();
 });
 build.addEventListener("click",()=>{
  release();
  const save=getSave();
  if(!save)return;
  build.disabled=true;cancelButton.classList.remove("hidden");
  beginProgress("Evaluating Knowledge preparations…");
  status.textContent="Comparing Knowledge strategies…";
  try{
   const search=createKnowledgeWorker();
   worker=search;
   search.onmessage=event=>{
    if(worker!==search)return; // A new search replaced this one.
    const msg=event.data;
    if(msg?.progress){
     if(msg.phase==="search")updateProgress(msg.completed,msg.total);
     return;
    }
    stopSearch();
    if(!msg?.ok){
     status.textContent="Unable to complete this cycle: "+(msg?.error??"Unknown search error");
     return;
    }
    const plan=msg.result;
    if(!plan.available){status.textContent=plan.reason;return;}
    if(plan.mode==="focused")initialFocusedPlan=plan;
    renderSummary(plan);
    renderPassive(plan);showProgress(plan);createReplay(plan);
    status.textContent=(plan.mode==="focused"?
     "Focused T"+plan.targetTier+" · "+compact(plan.targetCreated)+
      " target creations · peak batch "+compact(plan.peakTargetCopies)+
      " copies · "+plan.harvestCount+" harvests":
     "Balanced · "+plan.coverageTotal+"/"+plan.coverageRequested+
      " tiers with active EXP · "+compact(plan.totalExpPerCycle)+" EXP")+
     " · "+plan.roundsCompleted+"/"+plan.roundsRequested+" refills"+
     (plan.rotationTerminal?
      " · Full rotation complete: a new T"+(plan.balancedEndTier??64)+" was created":
      plan.roundsCompleted<plan.roundsRequested?
      " · stopped early: "+plan.haltReason:" · preview limit reached");
   };
   search.onerror=event=>{
    if(worker!==search)return;
    stopSearch();
    status.textContent="The Knowledge search worker failed. Refresh and retry the optimization.";
   };
   search.postMessage({save,options:calibration()});
  }catch(error){
   stopSearch();
   status.textContent="Knowledge optimizer unavailable in this browser: "+
    (error?.message??String(error));
  }
 });
 cancelButton.addEventListener("click",()=>{
  continueHold?.stop();
  if(worker){
   stopSearch();jumpToNextRefill=false;jumpToNextHarvest=false;
   jumpToNextTargetCreation=false;
   continueButton.disabled=false;
   continueButton.textContent=result?knowledgeContinueButtonLabel(result.roundsCompleted):"Continue rotation";
   announceContinuation("Continuation canceled. Your previous walkthrough remains available.");
   status.textContent="Knowledge optimization canceled. The previous walkthrough is retained.";
  }
 });
 continueButton.addEventListener("click",event=>{
  if(continueHold?.shouldIgnoreClick(event))return;
  if(worker){
   announceContinuation("A Knowledge calculation is already running.");
   return;
  }
  if(!canExtendBalancedRotation(result)){
   announceContinuation(result?.rotationTerminal?
    "Full rotation complete: a new T"+(result.balancedEndTier??64)+" has already been created.":
    "No legal continuation is available from this board.");
   return;
  }
  const previous=result;
  const save=getSave();
  if(!save){
   announceContinuation("Import your game data to extend the walkthrough.");
   return;
  }
  const additionalWaves=knowledgeContinueWaveCount(previous.roundsCompleted);
  const skipToRefill=jumpToNextRefill;
  const skipToHarvest=jumpToNextHarvest;
  const skipToTarget=jumpToNextTargetCreation;
  // No arbitrary refill ceiling for Next target creation. A deterministic
  // repeated state or lack of legal progress ends the search instead.
  const requestedWaves=skipToTarget?null:additionalWaves;
  const nextRounds=previous.roundsCompleted+requestedWaves;
  const failContinuation=reason=>{
   continueHold?.stop();hideProgress();
   const message="Unable to continue: "+reason;
   announceContinuation(message);
   status.textContent=message;
   continueButton.textContent=knowledgeContinueButtonLabel(previous.roundsCompleted);
   continueButton.disabled=false;
   jumpToNextRefill=false;jumpToNextHarvest=false;
   jumpToNextTargetCreation=false;
  };
  // Keep the physical button enabled during an active hold so browsers
  // continue delivering pointer release events. The worker guard prevents
  // overlapping requests; ordinary clicks still disable the control.
  continueButton.disabled=!continueHold?.holding;
  continueButton.textContent=skipToTarget?
   "Finding next T"+previous.targetTier+" creation…":
   "Simulating +"+additionalWaves+" refills…";
  cancelButton.classList.remove("hidden");
  beginProgress(skipToTarget?
   "Searching for the next T"+previous.targetTier+" creation…":
   "Simulating additional refills…");
  build.disabled=true;
  announceContinuation(skipToTarget?
   "Searching consecutive refills for the next actual T"+
    previous.targetTier+" creation, without a fixed refill limit. "+
    "Cancel search to stop.":
   "Simulating +"+additionalWaves+" refills (5%) from the current board, through refill "+nextRounds+"…");
  status.textContent=skipToTarget?
   "Searching for the next T"+previous.targetTier+" creation…":
   "Simulating "+additionalWaves+" "+
    (previous.mode==="focused"?"Focused":"Balanced")+
    " refill waves (5% of "+previous.roundsCompleted+")…";
  try{
   const search=createKnowledgeWorker();
   worker=search;
   search.onmessage=event=>{
    if(worker!==search)return;
    const msg=event.data;
    // Progress messages do not end the worker. A single +5% click can
    // contain many short, validated refill batches.
    if(msg?.progress){
     if(skipToTarget){
      // No fixed total means the search progress is intentionally
      // indeterminate; display actual completed refills instead of %.
      if(loadText)loadText.textContent=msg.completedWaves+
       " refills checked · searching for T"+previous.targetTier+
       (msg.targetCreationFound?" · creation found":" · cancel anytime");
     }else updateProgress(msg.completedWaves,msg.requestedWaves,"refills");
     const message=skipToTarget?
      "Searching for T"+previous.targetTier+" creation · "+
       msg.completedWaves+" refills checked"+
       (msg.targetCreationFound?" · Target created!":" · Cancel to stop"):
      "Simulating "+msg.completedWaves+" / "+
       msg.requestedWaves+" refills · current total "+
       msg.totalRefills+(msg.completed?
        " · T"+(previous.balancedEndTier??64)+" created!":"");
     continueButton.textContent=skipToTarget?
      "Searching T"+previous.targetTier+" · "+msg.completedWaves+" refills…":
      "Simulating "+msg.completedWaves+"/"+msg.requestedWaves+"…";
     announceContinuation(message);
     status.textContent=message;
     return;
    }
    stopSearch();
    try{
     if(!msg?.ok||!msg.result?.available)
      throw Error(msg?.error??msg?.result?.reason??"No validated continuation returned");
     const rotations=Array.isArray(msg.result.rotations)?
      msg.result.rotations:msg.result.rotation?[msg.result.rotation]:[];
     if(!rotations.length)throw Error("No valid refill batches were generated");
     let plan=previous;
     if(msg.result.checkpoint)
      plan=combineKnowledgeContinuation(plan,msg.result.checkpoint,
       msg.result.checkpoint.rounds);
     for(const chunk of rotations)
      plan=combineKnowledgeContinuation(plan,chunk,chunk.rounds);
     if(plan.steps.length<=previous.steps.length)
      throw Error("No new replay steps were generated");
     renderSummary(plan);
     renderPassive(plan);
     showProgress(plan);
     // Continue always enters the first newly generated action.
     let resume=knowledgeContinuationResumeStep(
      previous.steps,plan.steps,previous.steps.length-1,skipToRefill);
     if(skipToHarvest){
      const harvest=nextKnowledgeHarvestStep(
       plan.steps,previous.steps.length-2);
      if(harvest>=0)resume=harvest;
     }
     const targetCreation=skipToTarget?nextKnowledgeTargetCreationStep(
      plan.steps,previous.steps.length-2,plan.targetTier):-1;
     if(skipToTarget){
      // The chosen creation is the ONLY acceptable automatic destination.
      resume=targetCreation>=0?targetCreation:
       Math.min(controller?.step??previous.steps.length-1,plan.steps.length-1);
     }
     createReplay(plan,resume);
     jumpToNextRefill=false;jumpToNextHarvest=false;
     jumpToNextTargetCreation=false;
     continueButton.disabled=false;
     continueButton.textContent=knowledgeContinueButtonLabel(plan.roundsCompleted);
     const progressed=plan.roundsCompleted-previous.roundsCompleted;
     const message=plan.rotationTerminal?
      "Full Balanced rotation complete! A NEW T"+(plan.balancedEndTier??64)+
      " was created after "+progressed+" additional refills.":
      (plan.mode==="focused"?
       "Focused T"+plan.targetTier+" · "+plan.targetCreated+
       " target creations · "+plan.harvestCount+" harvests · ":"")+
      "Advanced "+progressed+" / "+requestedWaves+
      " requested refills"+(skipToTarget?" (target search)":" (5%)")+
      " · total "+plan.roundsCompleted+
      " · highest newly created T"+plan.highestNewTier+
      " · showing step "+resume+" / "+(plan.steps.length-1)+
      (msg.result.haltReason?
       " · Stopped early: "+msg.result.haltReason:
       " · next increment "+knowledgeContinueWaveCount(plan.roundsCompleted));
     const finalMessage=skipToTarget?
      targetCreation>=0?
       "Next T"+plan.targetTier+" creation at step "+targetCreation+
        " after "+progressed+" extra refills.":
       "No T"+plan.targetTier+" creation after "+progressed+
        " simulated refills. The replay position has been preserved. "+
        (msg.result.searchLimitReached?
         "Search was stopped for resource safety; you may continue searching.":
         "The simulation stopped: "+(msg.result.haltReason??plan.haltReason??"no further legal actions.")):
      message;
     announceContinuation(finalMessage);
     status.textContent=finalMessage;
     // While still physically held, schedule another +5% only AFTER
     // this validated worker result and replay state were committed.
     if(progressed>0&&!msg.result.haltReason)continueHold?.afterCompletion();
     else continueHold?.stop();
    }catch(error){
     failContinuation(String(error?.message??error));
    }
   };
   search.onerror=event=>{
    if(worker!==search)return;
    stopSearch();
    failContinuation("the simulation worker failed. "+(event?.message??"Check the browser console."));
   };
   search.onmessageerror=()=>{
    if(worker!==search)return;
    stopSearch();
    failContinuation("the browser could not receive the continued replay.");
   };
   search.postMessage({save,waves:requestedWaves,
    seekTargetTier:skipToTarget?previous.targetTier:0,continuation:{
    mode:previous.mode,completed:previous.completed,
    options:previous.options,finalBoard:previous.finalBoard,
    slots:previous.layout.slots,protectedIndices:previous.protectedIndices,
    proposedFires:previous.proposedFires,
    pinkFireplaces:previous.pinkFireplaces,
    guaranteedCookBonus:previous.guaranteedCookBonus,windCap:previous.windCap,
    startCookTier:previous.startCookTier,startingPattern:previous.startingPattern,
    recipeOffset:previous.recipeOffset,packingMode:previous.packingMode,
    roundsCompleted:previous.roundsCompleted,targetTier:previous.targetTier,
    balancedStartTier:previous.balancedStartTier,
    balancedEndTier:previous.balancedEndTier,
    targetCreated:previous.targetCreated
   }});
  }catch(error){
   stopSearch();
   failContinuation(String(error?.message??error));
  }
 });

 continueHold=installKnowledgeContinueHold({
  button:continueButton,
  canStart:()=>!worker&&!continueButton.disabled&&
   canExtendBalancedRotation(result),
  trigger:()=>continueButton.click(),
  onHoldingChange:holding=>{
   continueButton.classList.toggle("is-holding",holding);
   if(holding)announceContinuation(
    "Holding Continue: simulating repeated +5% increments. Release to stop after the active increment.");
  }
 });

 $("knowledgePlanReset").addEventListener("click",()=>rewindKnowledgeReplay(false));
 $("knowledgePlanPrepared").addEventListener("click",()=>rewindKnowledgeReplay(true));
 $("knowledgePlanNextRefill").addEventListener("click",()=>{
  if(!result||!controller)return;
  const next=result.steps.findIndex((frame,i)=>i>controller.step&&frame.kind==="refill");
  if(next>=0)controller.goTo(next);
  else if(canExtendBalancedRotation(result)&&!continueButton.disabled){
   jumpToNextRefill=true;continueButton.click();
  }else{
   controller.goTo(result.steps.length-1);
   status.textContent="No further simulated refill: "+result.haltReason+
    " ("+result.roundsCompleted+"/"+result.roundsRequested+
    " requested refill waves).";
  }
 });
 $("knowledgePlanNextHarvest").addEventListener("click",()=>{
  if(!result||!controller)return;
  const next=nextKnowledgeHarvestStep(result.steps,controller.step);
  if(next>=0)controller.goTo(next);
  else if(result.mode==="focused"&&canExtendBalancedRotation(result)&&
   !continueButton.disabled){
   jumpToNextHarvest=true;
   continueButton.click();
  }
 });
 $("knowledgePlanNextTargetCreation").addEventListener("click",()=>{
  if(!result||!controller||result.mode!=="focused")return;
  const next=nextKnowledgeTargetCreationStep(
   result.steps,controller.step,result.targetTier);
  if(next>=0)controller.goTo(next);
  else if(canExtendBalancedRotation(result)&&!continueButton.disabled){
   jumpToNextTargetCreation=true;
   continueButton.click();
  }
 });
 $("knowledgePlanPrev").addEventListener("click",()=>controller?.goTo(
  Math.max(0,(controller?.step??0)-1)));
 $("knowledgePlanPlay").addEventListener("click",()=>controller?.toggle());
 $("knowledgePlanNext").addEventListener("click",()=>{
  if(!controller||!result)return;
  if(controller.step>=result.steps.length-1&&canExtendBalancedRotation(result)){
   jumpToNextRefill=true;
   continueButton.click();
  }else controller.goTo(Math.min(result.steps.length-1,controller.step+1));
 });
 $("knowledgePlanEnd").addEventListener("click",()=>{
  if(result&&controller){
   controller.goTo(result.steps.length-1);
   status.textContent="End of the simulated walkthrough: "+result.haltReason+
    " ("+result.roundsCompleted+"/"+result.roundsRequested+" refills).";
  }
 });
 speed.addEventListener("change",()=>controller?.reschedule());
 clearAndPrompt();
 return {refresh:clearAndPrompt};
}
