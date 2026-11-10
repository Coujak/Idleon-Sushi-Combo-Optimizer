// Interactive Perfecto Planner. The imported save never leaves the browser.
// Per-copy odds are grounded in the IT/Corgan formula. Multi-copy success is
// explicitly labelled as an independent-roll projection, not game-confirmed.
import {SUSHI_KNOWLEDGE,sushiTierIconPath} from "./sushi-reference.mjs";
import {numberText} from "./lab-model.mjs";
import {getPerfectoPlanner} from "./perfecto-planner.mjs";
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
 function activateTab(tab){
  plannerTab=tab==="perfecto"?"perfecto":"combo";
  $("solver").classList.toggle("hidden",plannerTab!=="combo");
  $("perfectoPlanner").classList.toggle("hidden",plannerTab!=="perfecto");
  $("perfectoPlanner").setAttribute("aria-hidden",String(plannerTab!=="perfecto"));
  for(const choice of document.querySelectorAll("[data-planner-target]")){
   const active=choice.dataset.plannerTarget===plannerTab;
   choice.setAttribute("aria-selected",String(active));choice.tabIndex=active?0:-1;
  }
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
  const saved=getSave(),current=getPerfectoPlanner(saved,{tier:tierChoice,copies:requestedCopies,
   protectHigher:protect.checked});
  const autoOption=targetSelect.querySelector('option[value="auto"]');
  autoOption.textContent=current.next?"Auto · next missing tier (T"+current.next+")":"Auto · no missing discovered tiers";
  const earlier=targetSelect.value;
  for(const o of [...targetSelect.options].slice(1))o.remove();
  const knowledge= current.target?null:getPerfectoPlanner(saved,{tier:current.next}).bonus;
  // All tiers stay visible for reference; undiscovered tiers cannot be targeted.
  const discovered=new Set(saved?(saved.sushi?.[5]??[]).map((x,i)=>Number(x)>=0?i+1:null).filter(Boolean):[]);
  const perfected=new Set(saved?(saved.sushi?.[5]??[]).map((x,i)=>Number(x)>=1?i+1:null).filter(Boolean):[]);
  for(const item of SUSHI_KNOWLEDGE){
   const option=document.createElement("option");
   option.value=String(item.tier);
   option.textContent="T"+item.tier+" · "+item.name+(perfected.has(item.tier)?" · Perfecto":!discovered.has(item.tier)?" · Undiscovered":"");
   option.disabled=!saved||!discovered.has(item.tier);
   targetSelect.append(option);
  }
  if(tierChoice!=="auto"&&!discovered.has(Number(tierChoice)))tierChoice="auto";
  targetSelect.value=tierChoice;
  const result=tierChoice==="auto"?current:
   getPerfectoPlanner(saved,{tier:tierChoice,copies:requestedCopies,protectHigher:protect.checked});
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
  slider.disabled=p.eligible<=0;
  slider.min=String(p.minCopies);slider.max=String(Math.max(p.minCopies,p.eligible));
  slider.value=String(p.copies);
  text("perfectoCopyCount",p.copies+" / "+p.eligible+" available slots");
  const state=result.current.perfecto?" · Already Perfecto":" · Not Perfecto";
  summary.replaceChildren(makeIcon(result.target,"perfecto-target-icon"),
   elem("span","","T"+result.target+" · "+result.current.name+state));
  text("perfectoSingleChance",pct(result.singleChance));
  text("perfectoCurrentChance",pct(result.currentChance));
  text("perfectoPlanChance",pct(result.planChance));
  text("perfectoCurrentCopies",String(p.currentCopies)+" on board");
  text("perfectoPlanCopies",String(p.copies)+" copies");
  text("perfectoExpectedActivations",result.expectedActivations===null?"—":
   display(result.expectedActivations));
  text("perfectoProtectedCount",String(p.protected)+" higher-tier sushi protected");
  text("perfectoPreparationSummary",p.additionalCopies+" new copies · "+
   p.replaced+" occupied positions replaced · "+p.unlocked+" unlocked slots");
  for(const m of result.milestones)text("perfectoConfidence"+Math.round(m.confidence*100),
   confidenceValue(m.attempts));
  text("perfectoPepperUses",display(result.preparation.pepperAvailable));
  text("perfectoSaltUses",display(result.preparation.saltAvailable));
  text("perfectoSaltEstimate",result.preparation.directCook?
   "0 Salt needed for direct cooking":"Not reliably estimable");
  text("perfectoFuelEstimate",result.preparation.directCook?
   "~"+display(result.preparation.minDirectCookFuel)+" Fuel for "+p.additionalCopies+" new direct cooks":
   "Above direct-cook T"+result.preparation.maxDirectCookTier+
    ": merge / Wind preparation required");
  text("perfectoFreeShaker",pct(result.freeUse.knownChance)+
   " known refund chance (excludes Research bonuses)");
  text("perfectoExpectedConsumed",result.freeUse.expectedConsumedUpperBound===null?"—":
   "≤ "+display(result.freeUse.expectedConsumedUpperBound)+" expected consumed Pepper uses");
  const tip=$("perfectoRecommendation");
  tip.className="perfecto-recommendation perfecto-status-"+result.recommendation.state;
  tip.textContent=result.recommendation.text;
  text("perfectoSaltAdvice",result.preparation.directCook?
   "Salt is not needed for this target. Directly cook copies instead; save Salt for future preparation.":
   "Save Salt for preparing high tiers if useful. Salt tiers sushi up and can overshoot the target; do not use it on your completed Perfecto board.");
  renderBoard(result);
 }
 activateTab("combo");
 render();
 return {refresh:render,activateTab};
}
