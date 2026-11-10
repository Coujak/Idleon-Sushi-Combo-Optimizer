// Perfecto Planner presentation. Only actionable target/protection controls remain.
// The optimizer chooses its own final copy count and prepared arrangement.
import {sushiTierIconPath} from "./sushi-reference.mjs";
import {numberText} from "./lab-model.mjs";
import {availablePerfectoTargets,getPerfectoPlanner} from "./perfecto-planner.mjs?v=1.15.1";

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
export function initializePerfectoUI(getSave){
 let plannerTab="combo",tierChoice="auto";
 const targetSelect=$("perfectoTarget");
 const protect=$("perfectoProtectHigher");
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
 protect.addEventListener("change",render);
 $("perfectoResetTarget").addEventListener("click",()=>{tierChoice="auto";render();});
 function text(id,value){$(id).textContent=value;}
 function sushiIcon(tier,css){
  const img=node("img",css);
  img.src=sushiTierIconPath(tier);
  img.alt="";img.loading="lazy";img.onerror=()=>img.remove();
  return img;
 }
 function renderBoard(result){
  const box=$("perfectoBoard");
  box.replaceChildren();
  if(!result.plan){
   box.append(node("p","hint","Import an account save to see a recommended board."));
   return;
  }
  for(const cell of result.plan.board){
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
   div.title="Position "+(cell.index+1)+" · "+before+" → "+after+" · "+cell.role;
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
  const result=getPerfectoPlanner(saved,{tier:tierChoice,protectHigher:protect.checked});
  renderBonuses(result);
  const ready=!!result.target&&!!result.plan;
  $("perfectoCalculator").classList.toggle("hidden",!ready);
  $("perfectoNoData").classList.toggle("hidden",ready);
  if(!ready){
   text("perfectoNoData",result.reason==="complete"?
    "All discovered sushi are Perfecto. Import an updated save after discovering more.":
    "Import an Idleon Toolbox JSON on Overview to plan your Perfecto board.");
   return;
  }
  const p=result.plan;
  summary.replaceChildren(sushiIcon(result.target,"perfecto-target-icon"),
   node("span","","T"+result.target+" · "+result.current.name+
    (result.current.perfecto?" · Perfecto":" · Not Perfecto")));
  text("perfectoSingleChance",percent(result.singleChance));
  text("perfectoCurrentChance",percent(result.currentChance));
  text("perfectoPlanChance",percent(result.planChance));
  text("perfectoPlanOddsRatio",result.planChance>0?
   "1 in "+display(1/result.planChance):"No target copies yet");
  text("perfectoCurrentCopies",p.currentCopies+" on board");
  text("perfectoPlanCopies",p.copies+" copies");
  text("perfectoExpectedActivations",numAttempts(result.expectedActivations));
  text("perfectoCopyCount",p.copies+" target copies found");
  text("perfectoPreparationSummary",
   p.copies+" target copies · "+p.additionalCopies+" newly produced in the simulation · "+
   p.protected+" protected higher-tier sushi · "+p.unlocked+" unlocked slots");
  text("perfectoProtectedCount",p.protected+" higher-tier sushi preserved");
  const proof=result.search?.certificate;
  text("perfectoModelNote",proof?
   "Constructive merge-only recipe: cook T"+proof.startingTier+" (each costs "+
   display(result.search.sourceCost)+" fuel, "+percent(proof.capacityShare)+" of fuel capacity), "+
   "then repeatedly merge equal tiers westwards up to T"+proof.targetTier+
   ". Reserve "+proof.workspaceSlots+" empty positions while producing each target. "+
   "The recipe needs "+proof.cooksExact+" cooked source sushi and "+
   proof.mergesExact+" merges total, with no Salt or Wind luck required. "+
   "This proves the shown target copies can be built, but not that the board is globally optimal.":
   "Best result from "+p.searchAttempts+" starting recipes and search variants, using "+
   display(p.estimatedManualMerges)+" simulated merges and "+
   display(p.windUpgrades)+" Wind upgrades. This bounded Wind recipe is a heuristic candidate, "+
   "not proof of a global optimum. Higher prepared sushi are charged merge ingredient costs.");
  for(const milestone of result.milestones)
   text("perfectoConfidence"+Math.round(milestone.confidence*100),
    numAttempts(milestone.attempts));
  text("perfectoPepperUses",display(result.preparation.pepperAvailable));
  text("perfectoSaltUses",display(result.preparation.saltAvailable));
  text("perfectoSaltEstimate","0 in this simulation");
  text("perfectoFreeShaker",percent(result.freeUse.knownChance)+
   " known free-use chance (excludes Research bonuses)");
  text("perfectoExpectedConsumed",result.freeUse.expectedConsumedUpperBound===null?"—":
   "≤ "+display(result.freeUse.expectedConsumedUpperBound)+" expected consumed Pepper uses");
  const tip=$("perfectoRecommendation");
  tip.className="perfecto-recommendation perfecto-status-"+result.recommendation.state;
  tip.textContent=result.recommendation.text;
  text("perfectoSaltAdvice",
   "The modeled final board does not require Salt Shaker triggers. Salt and bonus cooking procs may improve your actual preparation, but their random effects aren't counted as guaranteed sushi.");
  renderBoard(result);
 }
 setPlannerTab("combo");
 return {refresh:render,activateTab:setPlannerTab};
}
