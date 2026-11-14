// Knowledge EXP cycle optimizer UI. The imported save is never mutated.
// The account-dependent search only runs on an explicit Build button click.
import {getKnowledgeRows,numberText} from "./lab-model.mjs?v=1.19.13";
import {sushiTierIconPath} from "./sushi-reference.mjs?v=1.16.6";
import {parseGameQuantity} from "./progression-calibration.mjs?v=1.17.1";
import {normalizeKnowledgeCycleOptions}
 from "./knowledge-cycle-optimizer.mjs?v=1.0.3";
import {createReplayController} from "./replay-controller.mjs";
import {combineKnowledgeContinuation,knowledgeContinuationResumeStep} from "./knowledge-rotation-extension.mjs?v=1.0.5";
import {canExtendBalancedRotation} from "./knowledge-rotation-continuation-eligibility.mjs?v=1.0.1";
import {knowledgeContinueWaveCount,knowledgeContinueButtonLabel} from "./knowledge-refill-scale.mjs?v=1.0.0";
import {installKnowledgeContinueHold} from "./knowledge-continue-hold.mjs?v=1.0.0";
import {buildKnowledgeActiveExpHistory} from "./knowledge-active-exp-history.mjs?v=1.0.0";

const $=id=>document.getElementById(id);
const createKnowledgeWorker=()=>new Worker(new URL("./knowledge-cycle-worker.mjs?v=1.0.22",
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
 const summary=$("knowledgePlanFeatured"),replay=$("knowledgePlanRotation");
 const recommendedBoard=$("knowledgePlanDesign");
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
 let activeExpHistory=null,activeExpDisplays=new Map();
 let jumpToNextRefill=false,jumpToNextHarvest=false;
 let continueHold=null;
 try{
  const old=JSON.parse(window.localStorage.getItem(preferenceKey)||"null");
  state={...normalizeKnowledgeCycleOptions(old),preservePassive:old?.preservePassive===true};
 }catch{state={...normalizeKnowledgeCycleOptions(),preservePassive:false};}
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
 const stopSearch=()=>{
  worker?.terminate();worker=null;
  cancelButton.classList.add("hidden");
  build.disabled=!getSave();
 };
 const release=()=>{
  continueHold?.stop();
  stopSearch();
  controller?.dispose();controller=null;
  result=null;activeExpHistory=null;activeExpDisplays.clear();
  jumpToNextRefill=false;jumpToNextHarvest=false;
  announceContinuation("");
  continueButton.classList.add("hidden");continueButton.disabled=false;
  continueButton.textContent="Continue rotation";
  summary.replaceChildren();board.replaceChildren();
  recommendedBoard.replaceChildren();recommendedBoard.classList.add("hidden");
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
   detail.textContent="Balanced · prioritize active EXP from T"+
    state.balancedStartTier+" through T"+state.balancedEndTier+
    ". A full rotation ends when a NEW T"+state.balancedEndTier+
    " is created. The original protected Sushi never counts.";
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
  const maxTier=candidates.length?Math.max(...candidates.map(x=>x.tier)):64;
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
   strategyDetail.textContent="Focused · build and bank copies of the selected Sushi tier, then harvest when space runs out. Continue as long as legal preparation is possible.";
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
  summary.replaceChildren();summary.classList.remove("hidden");
  const heading=elem("div","lab-kp-headline");
  heading.append(elem("h3","",p.mode==="focused"?
   "Focused target-building rotation · T"+p.targetTier:
   "Balanced · T"+(p.balancedStartTier??1)+" → T"+(p.balancedEndTier??64)),
   elem("p","",p.roundsCompleted+" refill waves · designed preparation · "+
    "starting T"+p.startCookTier+" · "+p.cooks+" cooks · "+p.merges+" merges · "+p.moves+" Sushi moves · "+
    p.windEvents+" Wind upgrades"));
  summary.append(heading);
  // Match Perfecto's result hierarchy: four primary KPIs, with the
  // supporting diagnostics still available but out of the main visual flow.
  const primary=p.mode==="focused"?[
   ["T"+p.targetTier+" created",compact(p.targetCreated)],
   ["T"+p.targetTier+" EXP · full preview",compact(p.targetExp)],
   ["Peak copies on board",compact(p.peakTargetCopies)],
   ["Batch harvests",compact(p.harvestCount)]
  ]:[
   ["Range EXP coverage",p.coverageTotal+" / "+p.coverageRequested],
   ["Active EXP / preview",compact(p.totalExpPerCycle)],
   ["Highest newly created","T"+p.highestNewTier],
   ["Refills simulated",compact(p.roundsCompleted)]
  ];
  const primaryGrid=elem("div","lab-kp-stats lab-kp-primary-stats");
  primary.forEach(([label,value],i)=>{
   const card=metric(label,value);
   if(i===0)card.classList.add("is-primary");
   primaryGrid.append(card);
  });
  summary.append(primaryGrid);
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
  if(p.mode==="balanced"){
   addNote(summary,"Balanced target range: T"+(p.balancedStartTier??1)+
    " → T"+(p.balancedEndTier??64)+
    ". EXP outside this range is still tracked in the progression table, but is not part of the Balanced scoring priority.","lab-kp-note");
   if(p.startingPattern==="t1Climb"){
    const actual=p.firstCookResultTier??p.startCookTier;
    addNote(summary,actual===1?
     "Balanced cooks T1 (the lowest Sushi tier) on every refill, then merges upward. Lower tiers are prioritized for the EXP staircase.":
     "Balanced requests T1, but your guaranteed cooking tier bonus makes the lowest possible resulting Sushi T"+actual+". The walkthrough starts at that actual tier; lower tiers cannot be directly cooked with the present guaranteed bonus.",
     actual===1?"lab-kp-note":"lab-kp-warning");
   }else if(p.balancedT1Feasible===false)
    addNote(summary,"T1 could not be cooked within the modeled Fuel capacity. Balanced used an alternative recipe.","lab-kp-warning");
  }
  if(!p.fuelSafePreparation)
   addNote(summary,"Fuel warning: preparing this full board is estimated "+
    "to require "+formatHours(p.refillFuelSafety.estimatedWaitSeconds/3600)+
    " of extra regeneration beyond the initial Fuel buffer. "+
    "The selected cooking tier was the least-waiting tested candidate, "+
    "not an instant full-board recipe.","lab-kp-warning");
  else addNote(summary,"Fuel-safe first fill: the chosen recipe fits within "+
   "the imported Fuel balance (up to half of max capacity reserved for the "+
   "first fill) plus regeneration during cooking. Later refills may "+
   "require additional waiting.","lab-kp-note");
  if(p.mode==="balanced"){
   if(p.uncoveredTiers.length)
    addNote(summary,p.uncoveredTiers.length+" discovered tiers still "+
     "lack ACTIVE Knowledge EXP in the modeled preview: "+
     p.uncoveredTiers.map(t=>"T"+t).join(", ")+
     ". Tiers above the safe cooking range need additional merges/Wind "+
     "or further refills; no EXP is claimed until a legal creation occurs.",
     "lab-kp-warning");
   else addNote(summary,"All "+p.coverageRequested+
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
    addNote(summary,"Pink Lithium fireplaces are not unlocked in the imported save. The planner cannot apply their EXP multiplier.","lab-kp-warning");
   else if(pink.requiresPinkActivation)
    addNote(summary,"FIREPLACE SETUP REQUIRED: your imported save has "+
     pink.importedPinkCount+" active pink fireplaces, but this plan ASSUMES "+
     pink.proposedPinkCount+" pink fireplaces. Manually switch columns "+
     pink.switchToPink.map(col=>col+1).join(", ")+" to pink before following the plan. "+
     "The displayed EXP projections are conditional on those changes.","lab-kp-warning");
   else if(pink.requiresFireplaceChanges)
    addNote(summary,"This proposal changes the imported fireplace layout. "+
     "Check the prepared-board fireplace row and apply the proposed setup "+
     "manually; the displayed EXP and Fuel estimates assume that setup.","lab-kp-warning");
   else
    addNote(summary,pink.importedPinkCount+" pink Lithium fireplaces are "+
     "already selected in the imported save. No fireplace changes are "+
     "required for this proposed layout.","lab-kp-lithium");
  }
  if(p.mode==="focused"&&p.targetPreviewIncomplete)
   addNote(summary,"No NEW T"+p.targetTier+" was created within "+
    p.roundsCompleted+" preview refill waves. "+
    (p.harvestCount?
     "Only copies already on the board could be consolidated; "+
      "harvesting them awards higher-tier EXP, not T"+p.targetTier+" EXP.":
     "This is precursor preparation only, not a target-tier harvest."),
    "lab-kp-warning");
  else if(p.mode==="focused"&&!p.harvestCount)
   addNote(summary,"T"+p.targetTier+" copies are banked; the board has "+
    "not yet reached a harvest point. Continue preparation rather than "+
    "merging them prematurely.","lab-kp-note");
  else if(p.mode==="focused")
   addNote(summary,p.harvestCount+" batch harvest(s) recover space "+
    "only after preparing T"+p.targetTier+" copies. Harvest merges "+
    "create higher tiers and do not award additional T"+p.targetTier+
    " EXP (except capped T64).","lab-kp-note");
  if(p.scenarioRequiresCleanup)
   addNote(summary,"PREPARATION REQUIRED: "+p.design.omittedCount+
    " Sushi from your current board are not part of this designed "+
    "starting scenario. They must be dealt with using legal gameplay. "+
    "The optimizer has NOT verified a route from your current inventory "+
    "to this setup, and cannot delete Sushi.","lab-kp-warning");
  addNote(summary,p.note);
  addNote(summary,"Final board: "+p.stranded+" Sushi · highest working tier T"+p.highestWorkingTier+
   (p.mode==="focused"?" · T"+p.targetTier+" copies: "+p.focusCopies:"")+
   ". "+p.haltReason,"lab-kp-note");
  if(p.rotationTerminal)addNote(summary,
   "Full Balanced rotation complete: a NEW T"+(p.balancedEndTier??64)+
   " was created by a legal cook, merge, or East Wind cascade. The original protected Sushi was not counted.",
   "lab-kp-lithium");
  else addNote(summary,
   "This is a continuing rotation preview. Leftover Sushi stay on the board for the next refill. EXP/hr is a projection over this finite window, not a verified long-term rate.",
   "lab-kp-warning");
 }
 function renderDesignedBoard(p){
  recommendedBoard.replaceChildren();
  recommendedBoard.classList.remove("hidden");
  const sectionHead=elem("div","lab-kp-section-head");
  sectionHead.append(elem("h3","","2 · Prepared Sushi board"),
   elem("span","lab-kp-section-tag","Account-specific candidate"));
  recommendedBoard.append(sectionHead);
  if(p.pinkFireplaces){
   const fireStatus=elem("div","lab-kp-fireplace-status");
   const pink=p.pinkFireplaces;
   const current=elem("div","lab-kp-fireplace-status-item");
   current.append(elem("span","","Currently selected · imported JSON"),
    elem("strong","",pink.importedPinkCount+" / "+pink.availableCount+" pink"));
   const planned=elem("div","lab-kp-fireplace-status-item"+
    (pink.requiresPinkActivation?" requires-switch":""));
   planned.append(elem("span","","Recommended · proposed plan"),
    elem("strong","",pink.proposedPinkCount+" / "+
     pink.proposedAvailableCount+" pink"));
   fireStatus.append(current,planned);
   const text=pink.requiresPinkActivation?
    "Switch fireplaces in columns "+pink.switchToPink.map(col=>col+1).join(", ")+
    " to PINK before following this plan. Proposed EXP values are NOT your current in-game rates.":
    pink.requiresFireplaceChanges?
    "The proposed fireplace layout differs from your imported setup; apply the displayed changes manually.":
    "The proposed fireplace arrangement matches your imported setup.";
   const note=elem("p",pink.requiresFireplaceChanges?
    "lab-kp-fireplace-alert":"lab-kp-fireplace-confirm",text);
   fireStatus.append(note);
   recommendedBoard.append(fireStatus);
  }
  const area=elem("section","lab-kp-design-panel");
  area.append(elem("h3","","Recommended preparation"),
   elem("p","hint","This is the strongest candidate recipe found by the bounded "+
    "search, NOT your current inventory. Sushi ingredients are cooked into "+
    "empty cells in the walkthrough; the highest-tier existing Sushi stays "+
    "at its original position. The solver tested "+compact(p.considered)+
    " candidate rotations using your account's unlocked slots, cooking "+
    "limits and East Wind. This is a best-found candidate, not a proof "+
    "of global optimality."));
  const stats=elem("div","lab-kp-design-details");
  stats.append(
   metric("Starting cook tier","T"+p.startCookTier),
   metric("Maximum cookable","T"+p.maximumCookTier),
   metric("Ingredient layout",p.startingPattern+
    (p.recipeOffset?" · offset "+p.recipeOffset:"")),
   metric("Prepared ingredients",compact(p.preparedBoardCooks)),
   metric("Unlocked board slots",compact(p.design.unlockedCount)));
  area.append(stats);
  if(p.scenarioRequiresCleanup)
   addNote(area,"This candidate assumes a clean working board after legal "+
    "cleanup of "+p.design.omittedCount+" existing Sushi. "+
    "The cleanup transition from your current board is NOT included or "+
    "claimed possible automatically. No Sushi can be deleted to obtain "+
    "the design.","lab-kp-warning");
  if(p.design.anchor!==null)
   addNote(area,"Required highest-tier anchor: T"+p.design.anchorTier+
    " at R"+(Math.floor(p.design.anchor/15)+1)+"C"+
    (p.design.anchor%15+1)+" (unchanged from your import).");
  const outer=elem("div","lab-kp-board-wrap");
  const grid=elem("div","lab-kp-board");
  grid.setAttribute("role","img");
  grid.setAttribute("aria-label","Designed Sushi ingredient preparation board");
  for(let i=0;i<120;i++){
   const slot=p.layout.slots[i],tier=p.preparedBoard[i];
   const tile=elem("div","lab-kp-tile slot-"+slot);
   if(slot<0)tile.classList.add("locked");
   if(i===p.design.anchor)tile.classList.add("is-protected");
   if(tier===p.targetTier&&p.mode==="focused")
    tile.classList.add("is-focus-target");
   tile.title="Row "+(Math.floor(i/15)+1)+" column "+(i%15+1)+
    " · "+(tier?"T"+tier:"Empty");
   if(tier>0){
    const img=elem("img","lab-kp-tile-icon");
    img.src=sushiTierIconPath(tier);img.alt="";img.loading="lazy";
    img.onerror=()=>img.remove();
    tile.append(img,elem("strong","",String(tier)));
   }
   grid.append(tile);
  }
  const fireRow=elem("div","lab-kp-fire-row");
  for(let col=0;col<15;col++){
   const type=p.proposedFires[col]??-1;
   const fire=elem("span","lab-kp-fire fire-"+type);
   fire.title="Column "+(col+1)+" · "+
    (FIREPLACE_NAMES[type]??"Locked")+" fireplace";
   if(type>=0&&FIREPLACE_IMAGES[type]){
    const img=elem("img","lab-kp-fire-art");
    img.src="assets/campfires/"+encodeURIComponent(FIREPLACE_IMAGES[type]);
    img.alt=FIREPLACE_NAMES[type]+" fireplace";img.loading="lazy";
    img.onerror=()=>img.remove();fire.append(img);
   }
   fireRow.append(fire);
  }
  grid.append(fireRow);
  outer.append(grid);area.append(outer);
  addNote(area,"See Prepared board in the replay for the exact legal "+
   "cooks that produce this recipe from the designed anchor-only start. "+
   "Those steps do not clear your original account inventory.");
  recommendedBoard.append(area);
 }
  function renderPassive(p){
  const model=p.passive;
  passiveBox.replaceChildren();
  passiveBox.classList.remove("hidden");
  const block=elem("details","lab-kp-passive-panel");
  block.append(elem("summary","","Optional · Passive Knowledge and suggested Plate setup"),
   elem("p","hint","Imported EXP/day uses your actual Sushi, Plates and fireplaces. "+
    "The suggested EXP/day assumes "+p.fireChoice+" fireplaces and the proposed Plate placement. "+
    "Only Sushi and Plates already on the board are used; the layout is a manual guide, never an automatic replay step."));
  const cards=elem("div","lab-kp-passive-stats");
  for(const [label,value] of [
   ["Imported passive coverage",model.imported.covered+" / 64 tiers"],
   ["Suggested passive coverage",model.recommended.covered+" / 64 tiers"],
   ["Imported passive EXP/day",compact(model.imported.totalDaily)],
   ["Suggested passive EXP/day",compact(model.recommended.totalDaily)]
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
  for(const entry of ordered){
   const tr=elem("tr");
   if(p.mode==="focused"&&entry.tier===p.targetTier)
    tr.classList.add("is-target");
   if(p.mode==="balanced")
    tr.classList.add(inRange(entry.tier)?"is-balanced-range":"is-outside-range");
   const name=elem("td","lab-kp-tier");
   const img=elem("img");
   img.src=sushiTierIconPath(entry.tier);img.alt="";img.loading="lazy";
   img.onerror=()=>img.remove();
   name.append(img,elem("span","","T"+entry.tier+" · "+entry.name));
   const active=elem("td","lab-kp-active-gain-cell");
   const gained=elem("span","lab-kp-exp-value is-empty","0");
   const created=elem("small","lab-kp-creation-count","0 creations");
   active.append(gained,created);
   active.title="Simulated gain to the selected walkthrough step. "+
    "Full-preview T"+entry.tier+" EXP: "+compact(entry.expPerCycle)+
    ". Actual in-game EXP must be measured separately.";
   activeExpDisplays.set(entry.tier,{gained,created});
   tr.append(name,active,
    elem("td","",compact(entry.passiveExpPerDay)),
    elem("td","",rate(entry.expPerHour)),
    elem("td","",formatHours(entry.etaHours)));
   rows.append(tr);
  }
 }
 function renderVisibleActiveExp(step){
  if(!activeExpHistory)return;
  for(const [tier,display] of activeExpDisplays){
   const {exp,creations}=activeExpHistory.atStep(tier,step);
   display.gained.textContent=compact(exp);
   display.gained.classList.toggle("is-empty",exp===0);
   display.created.textContent=creations+" creation"+(creations===1?"":"s");
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
  $("knowledgePlanNextHarvest").disabled=!result.steps.some((f,i)=>
   i>index&&f.kind==="stage"&&f.phase==="harvest"&&f.title.startsWith("Harvest prepared"))&&
   !(result.mode==="focused"&&canExtendBalancedRotation(result));
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
   "Balanced requests the lowest cookable tier (normally T1), but guaranteed +tier bonuses raise the actual Sushi tier produced. Its selected End tier is the completion goal; an existing protected Sushi does not count. Click Continue to advance by 5%, or press and hold to repeat until release (the in-flight increment finishes).",
   "Focused: produce and bank the selected tier, then harvest pairs only when necessary to recover space. Click Continue to extend by 5%, or hold it down to repeat until release (an in-flight increment finishes). Focused does not stop when a T64 is created; its goal is continued target EXP.",
   "Moving Sushi into a vacant slot is a separate action. Movement Mittens toggles dragging to plates; disable it for Sushi repositioning.",
   "The first full-board fill is screened using the imported Fuel balance, Fuel capacity, estimated generation and actual tier costs. A separate warning appears if no tested recipe avoids regeneration waits. Milktoast/Cold provide passive EXP/day and can be optionally protected.",
   "The optimizer compares bounded candidate patterns and counts only verified active creation EXP. The replay's final state and stop reason are always shown; the walkthrough never claims to continue beyond its simulated actions."
  ];
  for(const note of bullets)tips.append(elem("li","",note));
 }
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
  status.textContent="Simulating multi-refill Sushi rotations, East Wind merges and Lithium/Fuel trade-offs…";
  try{
   const search=createKnowledgeWorker();
   worker=search;
   search.onmessage=event=>{
    if(worker!==search)return; // A new search replaced this one.
    stopSearch();
    const msg=event.data;
    if(!msg?.ok){
     status.textContent="Unable to complete this cycle: "+(msg?.error??"Unknown search error");
     return;
    }
    const plan=msg.result;
    if(!plan.available){status.textContent=plan.reason;return;}
    renderSummary(plan);renderDesignedBoard(plan);
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
  const nextRounds=previous.roundsCompleted+additionalWaves;
  const skipToRefill=jumpToNextRefill;
  const skipToHarvest=jumpToNextHarvest;
  const failContinuation=reason=>{
   continueHold?.stop();
   const message="Unable to continue: "+reason;
   announceContinuation(message);
   status.textContent=message;
   continueButton.textContent=knowledgeContinueButtonLabel(previous.roundsCompleted);
   continueButton.disabled=false;
   jumpToNextRefill=false;jumpToNextHarvest=false;
  };
  // Keep the physical button enabled during an active hold so browsers
  // continue delivering pointer release events. The worker guard prevents
  // overlapping requests; ordinary clicks still disable the control.
  continueButton.disabled=!continueHold?.holding;
  continueButton.textContent="Simulating +"+additionalWaves+" refills…";
  cancelButton.classList.remove("hidden");
  build.disabled=true;
  announceContinuation("Simulating +"+additionalWaves+" refills (5%) from the current board, through refill "+nextRounds+"…");
  status.textContent="Simulating "+additionalWaves+" "+
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
     const message="Simulating "+msg.completedWaves+" / "+
      msg.requestedWaves+" refills · current total "+
      msg.totalRefills+(msg.completed?
       " · T"+(previous.balancedEndTier??64)+" created!":"");
     continueButton.textContent="Simulating "+msg.completedWaves+
      "/"+msg.requestedWaves+"…";
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
     for(const chunk of rotations)
      plan=combineKnowledgeContinuation(plan,chunk,chunk.rounds);
     if(plan.steps.length<=previous.steps.length)
      throw Error("No new replay steps were generated");
     renderSummary(plan);
     renderDesignedBoard(plan);
     renderPassive(plan);
     showProgress(plan);
     // Continue always enters the first newly generated action.
     let resume=knowledgeContinuationResumeStep(
      previous.steps,plan.steps,previous.steps.length-1,skipToRefill);
     if(skipToHarvest){
      const harvest=plan.steps.findIndex((frame,i)=>
       i>=previous.steps.length-1&&frame.kind==="stage"&&
       frame.phase==="harvest"&&frame.title.startsWith("Harvest prepared"));
      if(harvest>=0)resume=harvest;
     }
     createReplay(plan,resume);
     jumpToNextRefill=false;jumpToNextHarvest=false;
     continueButton.disabled=false;
     continueButton.textContent=knowledgeContinueButtonLabel(plan.roundsCompleted);
     const progressed=plan.roundsCompleted-previous.roundsCompleted;
     const message=plan.rotationTerminal?
      "Full Balanced rotation complete! A NEW T"+(plan.balancedEndTier??64)+
      " was created after "+progressed+" additional refills.":
      (plan.mode==="focused"?
       "Focused T"+plan.targetTier+" · "+plan.targetCreated+
       " target creations · "+plan.harvestCount+" harvests · ":"")+
      "Advanced "+progressed+" / "+additionalWaves+
      " requested refills (5%) · total "+plan.roundsCompleted+
      " · highest newly created T"+plan.highestNewTier+
      " · showing step "+resume+" / "+(plan.steps.length-1)+
      (msg.result.haltReason?
       " · Stopped early: "+msg.result.haltReason:
       " · next increment "+knowledgeContinueWaveCount(plan.roundsCompleted));
     announceContinuation(message);
     status.textContent=message;
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
   search.postMessage({save,waves:additionalWaves,continuation:{
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

 $("knowledgePlanReset").addEventListener("click",()=>controller?.goTo(0));
 $("knowledgePlanPrepared").addEventListener("click",()=>{
  if(result)controller?.goTo(Math.min(result.preparedStep??0,result.steps.length-1));
 });
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
  const next=result.steps.findIndex((f,i)=>i>controller.step&&
   f.kind==="stage"&&f.phase==="harvest"&&f.title.startsWith("Harvest prepared"));
  if(next>=0)controller.goTo(next);
  else if(result.mode==="focused"&&canExtendBalancedRotation(result)&&
   !continueButton.disabled){
   jumpToNextHarvest=true;
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
