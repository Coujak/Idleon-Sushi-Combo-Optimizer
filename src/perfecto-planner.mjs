// Perfecto probability and automatic buildable-board plan.
// This planner does not depend on the user's time, pace, or desired copy count.
import {getKnowledgeRows,getSushiSnapshot,getUpgradeRows} from "./lab-model.mjs?v=1.16.6";
import {estimateSushiFuelEconomy,sushiDirectCookFuel} from "./perfecto-fuel.mjs?v=1.16.6";
import {searchPerfectoBoard} from "./perfecto-wind-search.mjs?v=1.21.1";
export {sushiDirectCookFuel} from "./perfecto-fuel.mjs?v=1.15.1";

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const finite=x=>Number.isFinite(Number(x))?Number(x):0;
const cache=new WeakMap();
export function perfectoSingleChance(tier,knowledgePct=0){
 const index=Number(tier)-1;
 if(!Number.isInteger(index)||index<0||index>=64)return 0;
 return clamp(.6*Math.pow(.81,index)/(1+index/8)*
   (1+Math.max(0,finite(knowledgePct))/100),0,1);
}
export function perfectoBoardChance(singleChance,copies){
 const p=clamp(finite(singleChance),0,1);
 const n=Math.max(0,Math.floor(finite(copies)));
 if(n===0||p===0)return 0;
 if(p===1)return 1;
 return clamp(-Math.expm1(n*Math.log1p(-p)),0,1);
}
export function perfectoAttemptsForConfidence(chance,confidence){
 const q=clamp(finite(chance),0,1),goal=Number(confidence);
 if(!(goal>0&&goal<1)||q===0)return null;
 if(q===1)return 1;
 const n=Math.ceil(Math.log1p(-goal)/Math.log1p(-q));
 return Number.isFinite(n)?Math.max(1,n):null;
}
// Compare the exact same per-activation Perfecto model before/after
// preparation. A free shaker refund changes charge consumption, not odds.
export function perfectoOddsImprovement(currentChance,optimizedChance){
 const before=clamp(finite(currentChance),0,1);
 const after=clamp(finite(optimizedChance),0,1);
 const currentAttempts=before>0?1/before:null;
 const optimizedAttempts=after>0?1/after:null;
 return {
  before,after,
  ratio:before>0?after/before:null,
  percentagePointGain:(after-before)*100,
  currentAttempts,optimizedAttempts,
  savedAttempts:currentAttempts!==null&&optimizedAttempts!==null?
   Math.max(0,currentAttempts-optimizedAttempts):null,
  improvement:after>before,
  fromZero:before===0&&after>0
 };
}

// The game caps free Shaker refund chance at 60%. The imported Sushi and
// Knowledge sources are known; other research-grid sources may increase it.
// Hence the estimate below is an upper bound, not a guaranteed cost.
export function perfectoKnownFreeUseEstimate(chance,knownRefundChance){
 const p=clamp(finite(chance),0,1);
 const free=clamp(finite(knownRefundChance),0,.6);
 return {
  knownChance:free,
  atCap:free>=.6,
  expectedConsumedUpperBound:p>0?(1-free)/p:null
 };
}
export function availablePerfectoTargets(save){
 if(!save)return [];
 return getKnowledgeRows(save).filter(k=>k.discovered&&!k.perfecto);
}
export function chooseNextPerfectoTier(save){
 return availablePerfectoTargets(save)[0]?.tier??null;
}
function getSearch(save,target,cookTierOverride=null){
 let byTarget=cache.get(save);
 if(!byTarget){byTarget=new Map();cache.set(save,byTarget);}
 const selected=Number(cookTierOverride);
 const hasOverride=cookTierOverride!==null&&cookTierOverride!==""&&
  Number.isInteger(selected)&&selected>=1&&selected<=46;
 const key=String(target)+":"+(hasOverride?selected:"auto");
 if(byTarget.has(key))return byTarget.get(key);
 // Fuel cap estimates can miss account-specific bonuses. When the player
 // explicitly confirms they can cook Tn, trust that direct-cook capability,
 // but never extrapolate to higher tiers.
 const modeled=estimateSushiFuelEconomy(save);
 const effective=hasOverride&&modeled?Math.min(selected,modeled.maxCookTier):null;
 const economy=effective!==null?{
  ...modeled,maxCookTier:effective,
  capacity:Math.max(modeled.capacity,sushiDirectCookFuel(effective)),
  observedCookTier:effective,modeledCapacity:modeled.capacity
 }:modeled;
 const run=searchPerfectoBoard(save,target,economy);
 const result={economy,run,observedCookTier:effective,
  suggestedCookTier:modeled?.maxCookTier??null};
 byTarget.set(key,result);
 if(byTarget.size>30)byTarget.delete(byTarget.keys().next().value);
 return result;
}
function visualBoard(save,tier,run){
 if(!run)return null;
 const oldTiles=save.tiles??[],oldSlots=save.slots??[];
 let copies=0,replaced=0;
 const board=run.board.map((value,i)=>{
  const slot=Number(oldSlots[i]??-1);
  const tile=Number(oldTiles[i]??-1);
  if(slot<0)return {index:i,slot,tile,role:"locked",preparedTier:null};
  const preparedTier=value>0?value-1:-1;
  let role="empty";
  if(value===tier){
   role="target";copies++;
  }else if(value>tier)role="protected";
  else if(value>0)role="ingredient";
  if(preparedTier!==tile&&tile>=0)replaced++;
  return {index:i,slot,tile,role,preparedTier,
   newCopy:role==="target"&&tile!==tier-1};
 });
 return {
  board,unlocked:board.filter(x=>x.slot>=0).length,
  eligible:board.filter(x=>x.slot>=0&&x.role!=="protected").length,
  protected:board.filter(x=>x.role==="protected").length,
  currentCopies:run.currentCopies??0,copies,
  maxCopies:copies,minCopies:run.currentCopies??0,
  // A protected existing copy may be relocated to a bonus plate. Only
  // actual increases in target inventory are newly produced sushi.
  additionalCopies:Math.max(0,copies-(run.currentCopies??0)),replaced,
  purchasedCopies:run.purchased??0,estimatedManualMerges:run.mergers??0,
  windUpgrades:run.windUpgrades??0,
  scenario:run.recipe??null,searchAttempts:run.attempted??0,
  sourceTier:run.sourceTier??null,
  targetTier:tier,searchLimitReached:!!run.heuristic,
  changedPositions:board.filter(x=>x.newCopy).map(x=>x.index),
  positions:board.filter(x=>x.role==="target").map(x=>x.index)
 };
}
export function perfectoBoardPlan(save,tier,options={}){
 return getPerfectoPlanner(save,{...options,tier}).plan??null;
}
export function getPerfectoPlanner(save,{tier=null,cookTier=null}={}){
 const knowledge=getKnowledgeRows(save);
 const next=chooseNextPerfectoTier(save);
 const requested=Number(tier);
 const target=Number.isInteger(requested)&&requested>=1&&requested<=64?requested:next;
 const rows=knowledge.filter(k=>k.tier===50||k.tier===54);
 const knownBonus=rows.reduce((sum,k)=>sum+(k.bonus??0),0);
 const bonus={rows,knowledgeBonus:knownBonus,knowledgeMultiplier:1+knownBonus/100};
 if(!save||!target)return {target:null,next,bonus,reason:save?"complete":"import"};
 const current=knowledge[target-1];
 if(!current?.discovered)return {target:null,next,bonus,reason:"undiscovered"};
 const {economy,run,observedCookTier,suggestedCookTier}=getSearch(save,target,cookTier);
 const plan=visualBoard(save,target,run);
 const snapshot=getSushiSnapshot(save);
 const singleChance=perfectoSingleChance(target,knownBonus);
 const currentChance=perfectoBoardChance(singleChance,plan?.currentCopies??0);
 const planChance=perfectoBoardChance(singleChance,plan?.copies??0);
 const expectedActivations=planChance>0?1/planChance:null;
 const improvement=perfectoOddsImprovement(currentChance,planChance);
 const upgrades=getUpgradeRows(save);
 const bottomless=upgrades.find(x=>x.id===21)?.rawBonus??0;
 const freeKnowledge=knowledge.filter(k=>k.category===5&&k.discovered)
   .reduce((a,k)=>a+(k.bonus??0),0);
 const freeKnown=clamp((bottomless+freeKnowledge)/100,0,.6);
 const freeUseEstimate=perfectoKnownFreeUseEstimate(planChance,freeKnown);
 const pepperAvailable=Math.max(0,Math.floor(snapshot.shakers[1]??0));
 // Holding more Pepper enables more attempts; it never increases the odds
 // of a single activation. For best per-use efficiency, prepare the board
 // before spending any Pepper whenever the target-copy count can improve.
 const pepperStackChance=perfectoBoardChance(planChance,pepperAvailable);
 let recommendation;
 if(current.perfecto)recommendation={state:"completed",title:"ALREADY PERFECTO — STOP",
  text:"This tier is already Perfecto. Save your Pepper for a different unfinished tier."};
 else if(!plan?.eligible)recommendation={state:"blocked",title:"NO AVAILABLE SLOTS — REVIEW YOUR BOARD",
  text:"All positions are protected. Change the higher-tier protection setting or choose another unfinished tier."};
 else if(!plan?.copies)recommendation={state:"prepare",title:"SAVE PEPPER — BUILD TARGET SUSHI FIRST",
  text:"The planner could not construct a target copy. Do not use Pepper for this tier until at least one target sushi is placed."};
 else if(plan.currentCopies<plan.copies)recommendation={state:"save",title:"SAVE PEPPER — PREPARE THE BOARD FIRST",
  text:"You have "+plan.currentCopies+" target copies now. The recommended board has "+plan.copies+
   ". Build the recommended copies before spending Pepper to improve the chance per use."};
 else if(pepperAvailable===0)recommendation={state:"empty",title:"BOARD READY — COLLECT PEPPER",
  text:"The current board already has the recommended number of target copies. Collect Pepper and use it one activation at a time."};
 else recommendation={state:"ready",title:"USE PEPPER NOW — ONE AT A TIME",
  text:"Your current board already has "+plan.currentCopies+" target copies, as many as the recommendation. Use Pepper now and stop as soon as this tier becomes Perfecto."};
 return {
  target,current,bonus,next,plan,snapshot,economy,search:run,
  observedCookTier,suggestedCookTier,
  singleChance,currentChance,planChance,expectedActivations,pepperStackChance,
  improvement,
  milestones:[.5,.9,.99].map(confidence=>({
   confidence,attempts:perfectoAttemptsForConfidence(planChance,confidence)})),
  freeUse:{...freeUseEstimate,knownFrom:["Bottomless Shakers","Sushi Knowledge"],
   researchNotIncluded:true},
  preparation:{pepperAvailable},
  recommendation,independenceAssumption:true,simulatedWind:true,
  ignoresSaltAndCookTierProcs:true
 };
}
