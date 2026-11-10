// Interactive Perfecto Planner. The imported save never leaves the browser.
// Per-copy odds are grounded in the IT/Corgan formula. Multi-copy success is
// explicitly labelled as an independent-roll projection, not game-confirmed.
import {sushiTierIconPath} from "./sushi-reference.mjs";
import {numberText} from "./lab-model.mjs";
import {availablePerfectoTargets,getPerfectoPlanner} from "./perfecto-planner.mjs";
const $=id=>document.getElementById(id);
const elem=(tag,cls="",value)=>{
 const e=document.createElement(tag);if(cls)e.className=cls;
 if(value!==undefined&&value!==null)e.textContent=String(value);
 return e;
};
const display=n=>Number.isFinite(n)?numberText(n):"—";
const pct=n=>{
 if(!Number.isFinite(n))return "—";
 if(n<=0)return "0%";
 const value=n*100;
 return (value>=.01?value.toFixed(2):Number(value.toPrecision(3)).toString())+"%";
};
const confidenceValue=n=>Number.isFinite(n)&&n!==null?display(n):"—";
export function initializePerfectoUI(getSave){
 let plannerTab="combo",tierChoice="auto",requestedCopies=null;
 const targetSelect=$("perfectoTarget");
 const slider=$("perfectoCopies");
 const protect=$("perfectoProtectHigher");
 const summary=$("perfectoTargetSummary");
 const horizon=$("perfectoPlanHours"),pace=$("perfectoCookingPace"),fuelMode=$("perfectoFuelMode");
 const capOverride=$("perfectoCapOverride"),genOverride=$("perfectoGenOverride");
 const planningOptions=()=>({
  protectHigher:protect.checked,
  copies:requestedCopies,
  hours:Number(horizon.value),
  secondsPerCook:Number(pace.value),
  mode:fuelMode.value,
  capacityOverride:capOverride.value||null,
  generationOverride:genOverride.value||null
 });
 function activateTab(tab){
  plannerTab=tab==="perfecto"?"perfecto":"combo";
  $("solver").classList.toggle("hidden",plannerTab!=="combo");
  $("perfectoPlanner").classList.toggle("hidden",plannerTab!=="perfecto");
  $("perfectoPlanner").setAttribute("aria-hidden",String(plannerTab!=="perfecto"));
  for(const choice of document.querySelectorAll("[data-planner-target]")){
   const active=choice.dataset.plannerTarget===plannerTab;
   choice.setAttribute("aria-selected",String(active));choice.tabIndex=active?0:-1;
  }
  if(plannerTab==="perfecto")render();
 }
 for(const button of document.querySelectorAll("[data-planner-target]")){
  button.addEventListener("click",()=>{activateTab(button.dataset.plannerTarget);});
  button.addEventListener("keydown",e=>{
   if(e.key!=="ArrowRight"&&e.key!=="ArrowLeft")return;
   e.preventDefault();
   const target=plannerTab==="combo"?"perfecto":"combo";
   const next=document.querySelector('[data-planner-target="'+target+'"]');
   next.focus();activateTab(target);
  });
 }
 targetSelect.addEventListener("change",()=>{tierChoice=targetSelect.value;requestedCopies=null;render();});
 protect.addEventListener("change",()=>{requestedCopies=null;render();});
 slider.addEventListener("input",()=>{requestedCopies=Number(slider.value);render();});
 for(const input of [horizon,pace,fuelMode,capOverride,genOverride]){
  input.addEventListener("change",()=>{requestedCopies=null;render();});
 }
 $("perfectoResetTarget").addEventListener("click",()=>{
  tierChoice="auto";requestedCopies=null;render();
 });
 function text(id,val){$(id).textContent=val;}
 function makeIcon(tier,css){
  const img=elem("img",css);img.src=sushiTierIconPath(tier);img.alt="";
  img.loading="lazy";img.onerror=()=>img.remove();return img;
 }
 function renderBoard(result){
  const container=$("perfectoBoard");container.replaceChildren();
  if(!result.plan){container.append(elem("p","hint","Import your Sushi board to see recommended placements."));return;}
  for(const cell of result.plan.board){
   const node=elem("div","perfecto-tile perfecto-"+cell.role);
   if(cell.slot>=0)node.classList.add("slot-"+cell.slot);
   else node.classList.add("locked");
   if(cell.preparedTier!==null&&cell.preparedTier>=0){
    const tier=cell.preparedTier+1;
    node.append(makeIcon(tier,"perfecto-tile-icon"),
     elem("span","perfecto-tile-tier","T"+tier));
   }else if(cell.slot>=0)node.append(elem("span","perfecto-tile-empty","·"));
   const old=cell.tile>=0?"T"+(cell.tile+1):"Empty";
   const next=cell.preparedTier!==null&&cell.preparedTier>=0?"T"+(cell.preparedTier+1):"Empty";
   node.title="Position "+(cell.index+1)+" · "+old+" → "+next+" · "+cell.role;
   if(cell.role==="target"&&cell.tile!==cell.preparedTier)node.classList.add("perfecto-new-copy");
   container.append(node);
  }
 }
 function renderBonus(result){
  const host=$("perfectoBonusCards");host.replaceChildren();
  for(const k of result.bonus.rows){
   const box=elem("div","perfecto-bonus-item");
   box.append(makeIcon(k.tier,"perfecto-bonus-icon"));
   const info=elem("div","perfecto-bonus-copy");
   info.append(elem("strong","","T"+k.tier+" · "+k.name));
   info.append(elem("span","",k.discovered?"Knowledge Lv "+display(k.level)+(k.perfecto?" · Perfecto":" · Not Perfecto"):"Not discovered"));
   info.append(elem("span","perfecto-bonus-value",k.discovered?
    "+"+display(k.bonus)+"% to Perfecto chance":"No active bonus"));
   box.append(info);host.append(box);
  }
  text("perfectoBonusTotal",display(result.bonus.knowledgeMultiplier)+"×");
 }
 function render(){
  // Avoid expensive bounded simulations until Perfecto is selected.
  if(plannerTab!=="perfecto")return;
  const saved=getSave(),available=availablePerfectoTargets(saved);
  const next=available[0]?.tier??null;
  const autoOption=targetSelect.querySelector('option[value="auto"]');
  autoOption.textContent=next?"Auto · next missing tier (T"+next+")":"Auto · no missing discovered tiers";
  for(const option of [...targetSelect.options].slice(1))option.remove();
  // Show only actionable targets; completed and undiscovered tiers are hidden.
  for(const item of available){
   const option=document.createElement("option");
   option.value=String(item.tier);
   option.textContent="T"+item.tier+" · "+item.name;
   targetSelect.append(option);
  }
  if(tierChoice!=="auto"&&!available.some(item=>item.tier===Number(tierChoice))){
   tierChoice="auto";
   requestedCopies=null;
  }
  targetSelect.value=tierChoice;
  const result=getPerfectoPlanner(saved,{tier:tierChoice,...planningOptions()});
  renderBonus(result);
  const ready=!!result.target&&!!result.plan;
  $("perfectoCalculator").classList.toggle("hidden",!ready);
  $("perfectoNoData").classList.toggle("hidden",ready);
  if(!ready){
   text("perfectoNoData",result.reason==="complete"?
    "All your discovered sushi tiers are already Perfecto. Pick a new target after discovering more sushi.":
    "Import an Idleon Toolbox JSON on Overview to calculate your Perfecto odds and recommended board.");
   return;
  }
  const p=result.plan;
  slider.disabled=p.maxCopies<=p.minCopies;
  slider.min=String(p.minCopies);slider.max=String(Math.max(p.minCopies,p.maxCopies));
  slider.value=String(p.copies);
  text("perfectoCopyCount",p.copies+" / "+p.maxCopies+" best simulated");
  text("perfectoFuelCapacity",result.economy?display(result.economy.capacity):"—");
  text("perfectoFuelGeneration",result.economy?display(result.economy.generationPerHour)+"/hr":"—");
  text("perfectoSourceTier",result.cooking?"Tier "+result.cooking.tier:"No affordable tier");
  text("perfectoSourceCost",result.cooking?display(result.cooking.cost)+" Fuel":"—");
  const state=result.current.perfecto?" · Already Perfecto":" · Not Perfecto";
  summary.replaceChildren(makeIcon(result.target,"perfecto-target-icon"),
   elem("span","","T"+result.target+" · "+result.current.name+state));
  text("perfectoSingleChance",pct(result.singleChance));
  text("perfectoCurrentChance",pct(result.currentChance));
  text("perfectoPlanChance",pct(result.planChance));
  text("perfectoPlanOddsRatio",result.planChance>0?
   "1 in "+display(1/result.planChance):"No target copies yet");
  text("perfectoCurrentCopies",String(p.currentCopies)+" on board");
  text("perfectoPlanCopies",String(p.copies)+" copies");
  text("perfectoExpectedActivations",result.expectedActivations===null?"—":
   display(result.expectedActivations));
  text("perfectoProtectedCount",String(p.protected)+" higher-tier sushi protected");
  const timespan=Number(horizon.value)>=24?display(Number(horizon.value)/24)+" day(s)":horizon.value+" hours";
  text("perfectoPreparationSummary",p.copies+" confirmed target copies ("+p.currentCopies+
   " already present) · "+p.protected+" protected · "+p.unlocked+" unlocked slots · "+
   timespan+" modeled budget · "+p.searchAttempts+" candidate scenarios");
  text("perfectoModelNote",p.copies===0?
   "The bounded simulation found no new target copies using ordinary merges, Heat of the East Wind and the modeled cooking budget. It does not claim the target is impossible: a longer preparation, Salt or bonus cooking procs may produce better results.":
   "This is a final-board recommendation produced through valid ordinary merges and Heat of the East Wind cascades. The search modeled up to "+
   display(p.purchasedCopies)+" cooked Tier "+(p.sourceTier??"—")+" sushi, finding "+
   display(p.windUpgrades)+" Wind upgrades. The search is bounded, so this is the best found—not a mathematical proof of the global optimum.");
  for(const m of result.milestones)text("perfectoConfidence"+Math.round(m.confidence*100),
   confidenceValue(m.attempts));
  text("perfectoPepperUses",display(result.preparation.pepperAvailable));
  text("perfectoSaltUses",display(result.preparation.saltAvailable));
  text("perfectoSaltEstimate","0 used in the simulated board");
  text("perfectoFuelEstimate",result.cooking?
   "~"+display(result.preparation.minDirectCookFuel)+" Fuel over the modeled budget":
   "No sustainable affordable cooking tier found");
  text("perfectoFreeShaker",pct(result.freeUse.knownChance)+
   " known refund chance (excludes Research bonuses)");
  text("perfectoExpectedConsumed",result.freeUse.expectedConsumedUpperBound===null?"—":
   "≤ "+display(result.freeUse.expectedConsumedUpperBound)+" expected consumed Pepper uses");
  const tip=$("perfectoRecommendation");
  tip.className="perfecto-recommendation perfecto-status-"+result.recommendation.state;
  tip.textContent=result.recommendation.text;
  text("perfectoSaltAdvice","The simulated board does not rely on Salt triggers, so you may save them. Salt might improve the real preparation, but its random tier-up effects are not yet included in this deterministic optimization.");
  renderBoard(result);
 }
 activateTab("combo");
 render();
 return {refresh:render,activateTab};
}
