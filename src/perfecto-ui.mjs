// Perfecto Planner presentation. Only actionable target/protection controls remain.
// The optimizer chooses its own final copy count and prepared arrangement.
import {sushiTierIconPath} from "./sushi-reference.mjs?v=1.16.6";
import {numberText} from "./lab-model.mjs?v=1.16.6";
import {availablePerfectoTargets,getPerfectoPlanner} from "./perfecto-planner.mjs?v=1.22.2";

const $=id=>document.getElementById(id);
const node=(tag,css="",value)=>{
 const element=document.createElement(tag);
 if(css)element.className=css;
 if(value!==undefined&&value!==null)element.textContent=String(value);
 return element;
};
const display=value=>Number.isFinite(value)?numberText(value):"—";
const percent=value=>{
 if(!Number.isFinite(value))return "—";
 if(value<=0)return "0%";
 const p=value*100;
 return (p>=.01?p.toFixed(2):Number(p.toPrecision(3)).toString())+"%";
};
const numAttempts=value=>Number.isFinite(value)&&value!==null?display(value):"—";
function perfectoPreparationSteps(result){
 const {plan,search,target}=result;
 const proof=search?.certificate;
 const steps=[];
 if(plan.protected){
  steps.push("Keep all "+plan.protected+" existing sushi above T"+target+
   ". The target preparation must not consume them.");
 }
 if(proof){
  steps.push("Keep at least "+proof.workspaceSlots+
   " unlocked cells available while building each target copy. "+
   "Completed target sushi can then be parked outside the working area.");
  steps.push("Cook T"+proof.startingTier+" (each cook costs "+
   display(search.sourceCost)+" Fuel). Producing "+
   proof.finalCopies+" new T"+target+" sushi requires "+proof.cooksExact+
   " cooks and "+proof.mergesExact+" merges; existing target sushi are preserved.");
  if(proof.startingTier<target){
   if(proof.windStages?.length){
    steps.push("This certified recipe uses Heat of the East Wind. Prepare three equal-tier sushi in a contiguous workspace for each Wind stage. Merge left into middle (Wind upgrades the right), then right into middle. Other stages use ordinary two-to-one merges. Repeat for each target copy; no Salt luck is assumed.");
   }else{
    steps.push("Combine equal-tier sushi using regular two-to-one merges, working up from T"+
     proof.startingTier+" to T"+target+
     ". Repeat for each copy. This recipe does not rely on Wind or Salt luck.");
   }
  }
  if(proof.supportingCount){
   if(proof.supportingMode==="direct-source"){
    steps.push("Once all target copies are complete, you can directly cook T"+
     proof.startingTier+" into the "+proof.supportingCount+
     " leftover cells. These are optional filler, not ingredients required for Perfecto.");
   }else{
    steps.push("After building the targets, use the released workspace to make "+
     proof.supportingCount+" supporting sushi, highest tier first (T"+
     proof.supportingHighest+" down to T"+proof.supportingLowest+
     "). These do not improve your immediate Pepper odds.");
   }
  }
 }else if(search?.reason==="direct-cooking"){
  steps.push("Cook T1 directly in the available unlocked spaces. No merges are necessary.");
 }else{
  steps.push("Prepare the non-protected sushi shown in the final board. "+
   "This is a simulated candidate using valid merge/Wind actions, "+
   "but an exact step-by-step construction sequence is not available.");
 }
 steps.push("Arrange the final sushi to match the board above. Put the "+
  "highest tiers on available Hot, Cold or Milktoast plates where possible.");
 steps.push("Once the target copies are ready, activate Pepper one use at a time. "+
  "Stop as soon as T"+target+" becomes Perfecto.");
 return steps;
}
export function initializePerfectoUI(getSave){
 let plannerTab="combo",tierChoice="auto";
 const targetSelect=$("perfectoTarget");
 const cookTierInput=$("perfectoCookTier");
 const summary=$("perfectoTargetSummary");
 function setPlannerTab(target){
  plannerTab=target==="perfecto"?"perfecto":"combo";
  $("solver").classList.toggle("hidden",plannerTab!=="combo");
  $("perfectoPlanner").classList.toggle("hidden",plannerTab!=="perfecto");
  $("perfectoPlanner").setAttribute("aria-hidden",String(plannerTab!=="perfecto"));
  for(const choice of document.querySelectorAll("[data-planner-target]")){
   const selected=choice.dataset.plannerTarget===plannerTab;
   choice.setAttribute("aria-selected",String(selected));
   choice.tabIndex=selected?0:-1;
  }
  if(plannerTab==="perfecto")render();
 }
 for(const button of document.querySelectorAll("[data-planner-target]")){
  button.addEventListener("click",()=>setPlannerTab(button.dataset.plannerTarget));
  button.addEventListener("keydown",event=>{
   if(event.key!=="ArrowLeft"&&event.key!=="ArrowRight")return;
   event.preventDefault();
   const target=plannerTab==="combo"?"perfecto":"combo";
   document.querySelector('[data-planner-target="'+target+'"]').focus();
   setPlannerTab(target);
  });
 }
 targetSelect.addEventListener("change",()=>{tierChoice=targetSelect.value;render();});
 cookTierInput?.addEventListener("change",render);
 $("perfectoResetTarget").addEventListener("click",()=>{tierChoice="auto";render();});
 function text(id,value){$(id).textContent=value;}
 function sushiIcon(tier,css){
  const img=node("img",css);
  img.src=sushiTierIconPath(tier);
  img.alt="";img.loading="lazy";img.onerror=()=>img.remove();
  return img;
 }
 function renderBoard(result,plan=result.plan,hostId="perfectoBoard"){
  const box=$(hostId);
  box.replaceChildren();
  if(!plan){
   box.append(node("p","hint","Import an account save to see a recommended board."));
   return;
  }
  for(const cell of plan.board){
   const div=node("div","perfecto-tile perfecto-"+cell.role);
   if(cell.slot>=0)div.classList.add("slot-"+cell.slot);
   else div.classList.add("locked");
   if(cell.preparedTier!==null&&cell.preparedTier>=0){
    const tier=cell.preparedTier+1;
    div.append(sushiIcon(tier,"perfecto-tile-icon"),
     node("span","perfecto-tile-tier","T"+tier));
   }else if(cell.slot>=0)div.append(node("span","perfecto-tile-empty","·"));
   const before=cell.tile>=0?"T"+(cell.tile+1):"Empty";
   const after=cell.preparedTier>=0?"T"+(cell.preparedTier+1):"Empty";
   const slotLabel=["Regular","Hot","Cold","Milktoast"][cell.slot]??"Locked";
   div.title="Position "+(cell.index+1)+" · "+slotLabel+" slot · "+
    before+" → "+after+" · "+cell.role;
   if(cell.newCopy)div.classList.add("perfecto-new-copy");
   box.append(div);
  }
 }
 function renderBonuses(result){
  const host=$("perfectoBonusCards");host.replaceChildren();
  for(const k of result.bonus.rows){
   const item=node("div","perfecto-bonus-item");
   item.append(sushiIcon(k.tier,"perfecto-bonus-icon"));
   const info=node("div","perfecto-bonus-copy");
   info.append(node("strong","","T"+k.tier+" · "+k.name),
    node("span","",k.discovered?
     "Knowledge Lv "+display(k.level)+(k.perfecto?" · Perfecto":" · Not Perfecto"):
     "Not discovered"),
    node("span","perfecto-bonus-value",
     k.discovered?"+"+display(k.bonus)+"% to Perfecto chance":"No active bonus"));
   item.append(info);host.append(item);
  }
  text("perfectoBonusTotal",display(result.bonus.knowledgeMultiplier)+"×");
 }
 function render(){
  if(plannerTab!=="perfecto")return;
  const saved=getSave();
  const available=availablePerfectoTargets(saved);
  const auto=targetSelect.querySelector('option[value="auto"]');
  const next=available[0]?.tier??null;
  auto.textContent=next?"Auto · next missing tier (T"+next+")":
   "Auto · no missing discovered tiers";
  for(const option of [...targetSelect.options].slice(1))option.remove();
  for(const k of available){
   const option=document.createElement("option");
   option.value=String(k.tier);option.textContent="T"+k.tier+" · "+k.name;
   targetSelect.append(option);
  }
  if(tierChoice!=="auto"&&!available.some(k=>k.tier===Number(tierChoice))){
   tierChoice="auto";
  }
  targetSelect.value=tierChoice;
  const cookTierValue=cookTierInput?.value.trim()??"";
  const parsedCookTier=Number(cookTierValue);
  const cookTier=cookTierValue!==""&&Number.isInteger(parsedCookTier)&&
   parsedCookTier>=1&&parsedCookTier<=46?parsedCookTier:null;
  const result=getPerfectoPlanner(saved,{tier:tierChoice,cookTier});
  renderBonuses(result);
  const ready=!!result.target&&!!result.plan;
  $("perfectoCalculator").classList.toggle("hidden",!ready);
  $("perfectoNoData").classList.toggle("hidden",ready);
  if(!ready){
   text("perfectoNoData",result.reason==="complete"?
    "All discovered sushi are Perfecto. Import an updated save after discovering more.":
    "Import your game save JSON on Overview to plan your Perfecto board.");
   return;
  }
  const p=result.plan;
  const account=result.comparisons.account;
  const maximum=result.comparisons.maximum;
  text("perfectoAccountScenario",p.copies+" target copies · "+percent(account.chance)+" per Pepper");
  text("perfectoMaximumScenario",(maximum.plan?.copies??0)+
   " target copies · "+percent(maximum.chance)+" per Pepper");
  function scenarioFuel(comparison){
   const econ=comparison.economy;
   const source=comparison.search?.sourceTier;
   const optionalFuel=Number(econ?.totalFuel)-Number(econ?.targetFuel);
   return "Cook from "+(source?"T"+source:"unknown tier")+
    " · Target recipe Fuel: "+display(econ?.targetFuel)+
    (Number.isFinite(optionalFuel)&&optionalFuel>0?
     " · Optional filler: "+display(optionalFuel)+" Fuel":"");
  }
  text("perfectoAccountFuel",scenarioFuel(account));
  text("perfectoMaximumFuel",scenarioFuel(maximum));
  text("perfectoScenarioDifference",
   "Benchmark difference: "+result.comparisons.copyDifference+
   " target copies · "+result.comparisons.percentagePointGain.toFixed(4)+
   " percentage points per Pepper. The benchmark assumes T46 direct cooking and is not your current account.");
  text("perfectoAccountBoardTag",
   cookTier!==null?"Confirmed T"+cookTier+" cooking tier":"Estimated from imported JSON");
  text("perfectoMaximumBoardTag","T46 directly cookable · hypothetical");
  const maxP=maximum.plan;
  text("perfectoMaximumSummary",maxP?
   maxP.copies+" target copies · "+maxP.protected+" protected higher-tier sushi · "+
   maxP.unlocked+" unlocked slots":"No constructible benchmark board");
  const maximumGuide=$("perfectoMaxPreparationSteps");
  maximumGuide.replaceChildren(...(maxP?
   perfectoPreparationSteps({...result,plan:maxP,search:maximum.search}):
   ["No benchmark preparation available."]).map(step=>node("li","",step)));
  renderBoard(result,maxP,"perfectoMaxBoard");
  summary.replaceChildren(sushiIcon(result.target,"perfecto-target-icon"),
   node("span","","T"+result.target+" · "+result.current.name+
    (result.current.perfecto?" · Perfecto":" · Not Perfecto")));
  text("perfectoSingleChance",percent(result.singleChance));
  text("perfectoCurrentChance",percent(result.currentChance));
  text("perfectoCurrentOddsRatio",result.currentChance>0?
   "1 in "+display(1/result.currentChance):"No target copies yet");
  text("perfectoPlanChance",percent(result.planChance));
  text("perfectoPlanOddsRatio",result.planChance>0?
   "1 in "+display(1/result.planChance):"No target copies yet");
  text("perfectoCurrentCopies",p.currentCopies+" on board");
  text("perfectoPlanCopies",p.copies+" copies");
  text("perfectoExpectedActivations",numAttempts(result.expectedActivations));
  const delta=result.improvement;
  text("perfectoImprovement",delta.fromZero?"From no chance to "+percent(result.planChance):
   !delta.improvement?"Already at recommended target-copy odds":
   (delta.ratio??1).toLocaleString("en-US",{maximumFractionDigits:2})+
   "× chance per Pepper use");
  text("perfectoImprovementDetail",delta.fromZero?
   "You currently have no T"+result.target+" sushi on the board. "+
   "Preparing "+p.copies+" copies makes a Pepper attempt possible.":
   !delta.improvement?
   "The recommended board does not improve your per-activation Perfecto odds. "+
   "It may still be useful for arranging your sushi.":
   "Current "+percent(result.currentChance)+" → optimized "+
   percent(result.planChance)+" (+"+
   delta.percentagePointGain.toLocaleString("en-US",{maximumFractionDigits:4})+
   " percentage points). Estimated attempts until success: "+
   numAttempts(delta.currentAttempts)+" → "+
   numAttempts(delta.optimizedAttempts)+".");
  text("perfectoCopyCount",p.copies+" target copies found");
  const proof=result.search?.certificate;
  const bonusSlots=p.board.filter(cell=>cell.slot>=1&&cell.slot<=3);
  const bonusTargets=bonusSlots.filter(cell=>cell.role==="target").length;
  const bonusProtected=bonusSlots.filter(cell=>cell.role==="protected").length;
  text("perfectoPreparationSummary",
   p.copies+" target copies · "+p.additionalCopies+" newly produced in the simulation · "+
   (proof?.supportingCount?proof.supportingCount+" supporting sushi · ":"")+
   p.protected+" protected higher-tier sushi · "+p.unlocked+" unlocked slots"+
   (bonusSlots.length?" · Special plates: "+bonusProtected+
    " protected high-tier, "+bonusTargets+" target sushi":""));
  text("perfectoProtectedCount",p.protected+" higher-tier sushi preserved");
  const list=$("perfectoPreparationSteps");
  list.replaceChildren(...perfectoPreparationSteps(result).map(step=>node("li","",step)));
  text("perfectoModelNote",proof?
   "Reproducible merge-only recipe. The required cooking totals may be very large; "+
   "the planner does not estimate preparation time and does not claim a global optimum.":
   result.search?.reason==="direct-cooking"?
   "Direct cooking layout. The slot arrangement can be changed as needed.":
   "Heuristic recipe from "+p.searchAttempts+" evaluated search variants, with "+
   display(p.estimatedManualMerges)+" simulated merges and "+
   display(p.windUpgrades)+" Wind upgrades. This is not an exact move-by-move "+
   "build guide or a proven global maximum.");
  for(const milestone of result.milestones)
   text("perfectoConfidence"+Math.round(milestone.confidence*100),
    numAttempts(milestone.attempts));
  const pepper=result.preparation.pepperAvailable;
  text("perfectoPepperUses",display(pepper));
  text("perfectoKnownFreeChance",(result.freeUse.atCap?"":"≥ ")+
   percent(result.freeUse.knownChance));
  text("perfectoExpectedSpentUpper",numAttempts(result.freeUse.expectedConsumedUpperBound));
  text("perfectoStoredChance",percent(result.pepperStackChance));
  text("perfectoStoredChanceHint",
   pepper===0?"No Pepper available yet.":
   "Estimated chance across up to "+display(pepper)+
   " activation"+(pepper===1?"":"s")+
   " on the optimized board; stop as soon as you succeed.");
  const tip=$("perfectoRecommendation");
  tip.className="perfecto-recommendation perfecto-status-"+result.recommendation.state;
  text("perfectoActionTitle",result.recommendation.title);
  text("perfectoActionText",result.recommendation.text);
  const currentCopies=result.plan?.currentCopies??0;
  const targetCopies=result.plan?.copies??0;
  const state=result.recommendation.state;
  text("perfectoActionProgress",
    state==="completed"?"Perfecto achieved":
    "BOARD PROGRESS · "+display(currentCopies)+" / "+display(targetCopies)+" target copies");
  text("perfectoActionNext",
    state==="ready"?"NEXT: ACTIVATE PEPPER":
    state==="empty"?"NEXT: COLLECT PEPPER":
    state==="completed"?"NEXT: CHOOSE ANOTHER TARGET":
    state==="blocked"?"NEXT: REVIEW AVAILABLE SLOTS":
    "NEXT: BUILD THE OPTIMIZED BOARD");
  renderBoard(result,p,"perfectoBoard");
 }
 setPlannerTab("combo");
 return {refresh:render,activateTab:setPlannerTab};
}
