// Account-aware Perfecto odds and a buildable, bounded Wind-based board search.
// Prepared target sushi are never invented: they must occur in a simulated
// valid merge or Heat of the East Wind action from the starting inventory.
import {getKnowledgeRows,getSushiSnapshot,getUpgradeRows} from "./lab-model.mjs";
import {sushiDirectCookFuel,estimateSushiFuelEconomy} from "./perfecto-fuel.mjs";
import {searchPerfectoBoard} from "./perfecto-wind-search.mjs";
export {sushiDirectCookFuel} from "./perfecto-fuel.mjs";

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const finite=x=>Number.isFinite(Number(x))?Number(x):0;
const boardCache=new WeakMap();
export function perfectoSingleChance(tier,knowledgePct=0){
 const id=Number(tier)-1;
 if(!Number.isInteger(id)||id<0||id>=64)return 0;
 return clamp(.6*Math.pow(.81,id)/(1+id/8)*
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
export function availablePerfectoTargets(save){
 if(!save)return [];
 return getKnowledgeRows(save).filter(x=>x.discovered&&!x.perfecto);
}
export function chooseNextPerfectoTier(save){
 return availablePerfectoTargets(save)[0]?.tier??null;
}
function getBoundedSearch(save,tier,options){
 let cached=boardCache.get(save);
 if(!cached){cached=new Map();boardCache.set(save,cached);}
 const key=JSON.stringify([tier,options.protectHigher,options.hours,options.secondsPerCook,
  options.mode,options.capacityOverride,options.generationOverride,options.maxActions]);
 if(cached.has(key))return cached.get(key);
 const economy=estimateSushiFuelEconomy(save,{
  capacityOverride:options.capacityOverride,
  generationOverride:options.generationOverride
 });
 const search=searchPerfectoBoard(save,tier,economy,{
  protectHigher:options.protectHigher,hours:options.hours,
  secondsPerCook:options.secondsPerCook,mode:options.mode,
  maxActions:options.maxActions??320
 });
 const result={economy,search};
 cached.set(key,result);
 // Bound memory: an import can have many manual target/settings combinations.
 if(cached.size>32)cached.delete(cached.keys().next().value);
 return result;
}
function visualBoard(save,tier,run,{protectHigher=true,copies=null}={}){
 if(!run)return null;
 const original=save.tiles??[],slots=save.slots??[];
 const existing=run.currentCopies??0;
 const allowed=copies===null||copies===undefined?
  run.targetCount:clamp(Math.floor(finite(copies)),existing,run.targetCount);
 const targetPositions=run.board.map((t,i)=>t===tier?i:null).filter(i=>i!==null);
 const originalTargets=new Set(targetPositions.filter(i=>Number(original[i])===tier-1));
 const newPositions=targetPositions.filter(i=>!originalTargets.has(i));
 const keepNew=new Set(newPositions.slice(0,Math.max(0,allowed-existing)));
 let newCount=0,replaced=0,kept=0;
 const board=run.board.map((t,i)=>{
  const slot=Number(slots[i]??-1);
  const old=Number(original[i]??-1);
  if(slot<0)return {index:i,slot,role:"locked",tile:old,preparedTier:null};
  if(t===tier&&!originalTargets.has(i)&&!keepNew.has(i)){
   t=0; // Optional slider hides surplus simulated copies.
  }
  const preparedTier=t>0?t-1:-1;
  let role="empty";
  if(t===tier){
   role="target";
   if(!originalTargets.has(i))newCount++;
  }else if(t>tier&&protectHigher)role="protected";
  else if(t>0)role="ingredient";
  if(preparedTier!==old&&old>=0)replaced++;
  if(t===tier)kept++;
  return {index:i,slot,role,tile:old,preparedTier,
   newCopy:role==="target"&&old!==tier-1};
 });
 return {
  board,unlocked:board.filter(x=>x.slot>=0).length,
  eligible:board.filter(x=>x.slot>=0&&x.role!=="protected").length,
  protected:board.filter(x=>x.role==="protected").length,
  currentCopies:existing,copies:kept,maxCopies:run.targetCount,minCopies:existing,
  additionalCopies:newCount,replaced,
  purchasedCopies:run.purchased??0,estimatedManualMerges:run.mergers??0,
  windUpgrades:run.windUpgrades??0,sourceTier:run.sourceTier,
  scenario:run.scenario??null,searchAttempts:run.attempted??0,
  searchLimitReached:!!run.searchLimitReached,
  targetTier:tier,
  changedPositions:board.filter(x=>x.newCopy).map(x=>x.index),
  positions:board.filter(x=>x.role==="target").map(x=>x.index)
 };
}
export function perfectoBoardPlan(save,tier,options={}){
 return getPerfectoPlanner(save,{...options,tier}).plan??null;
}
export function getPerfectoPlanner(save,{
 tier=null,copies=null,protectHigher=true,hours=168,secondsPerCook=20,mode="yield",
 capacityOverride=null,generationOverride=null,maxActions=320
}={}){
 const knowledge=getKnowledgeRows(save);
 const next=chooseNextPerfectoTier(save);
 const requested=Number(tier);
 const target=Number.isInteger(requested)&&requested>=1&&requested<=64?requested:next;
 const rows=knowledge.filter(x=>x.tier===50||x.tier===54);
 const knownBonus=rows.reduce((sum,row)=>sum+(row.bonus??0),0);
 const bonus={rows,knowledgeBonus:knownBonus,knowledgeMultiplier:1+knownBonus/100};
 if(!save||!target)return {target:null,next,bonus,reason:save?"complete":"import"};
 const current=knowledge[target-1];
 if(!current?.discovered)return {target:null,next,bonus,reason:"undiscovered"};
 const opts={protectHigher,hours:Number(hours),secondsPerCook:Number(secondsPerCook),
  mode,capacityOverride,generationOverride,maxActions};
 const {economy,search}=getBoundedSearch(save,target,opts);
 const plan=visualBoard(save,target,search,{protectHigher,copies});
 const snapshot=getSushiSnapshot(save);
 const p=perfectoSingleChance(target,knownBonus);
 const currentChance=perfectoBoardChance(p,plan?.currentCopies??0);
 const planChance=perfectoBoardChance(p,plan?.copies??0);
 const avg=planChance>0?1/planChance:null;
 const upgrades=getUpgradeRows(save);
 const freeBottomless=upgrades.find(x=>x.id===21)?.rawBonus??0;
 const freeKnowledge=knowledge.filter(x=>x.category===5&&x.discovered).reduce((a,x)=>a+(x.bonus||0),0);
 const freeKnown=Math.min(.6,Math.max(0,(freeBottomless+freeKnowledge)/100));
 const sourceCost=search?.sourceCost??null;
 const purchased=plan?.purchasedCopies??0;
 const sourceCooks=sourceCost===null?null:purchased*sourceCost;
 let recommendation;
 if(current.perfecto)recommendation={state:"completed",text:"This sushi is already Perfecto. Select another tier."};
 else if(!plan?.eligible)recommendation={state:"blocked",text:"No usable positions. Unprotect higher-tier sushi or expand the board."};
 else if(plan.copies===0)recommendation={state:"prepare",
  text:"The bounded Wind search has not produced this target tier within the selected cooking budget. Increase the preparation window or improve the fuel economy; no fake target copies are shown."};
 else if(snapshot.shakers[1]<=0)recommendation={state:"save",
  text:"No Pepper Shakers are available. Aim for the best simulated final board before attempting Perfecto."};
 else if(plan.currentCopies===0||currentChance<planChance*.9)
  recommendation={state:"prepare",
   text:"Prepare the simulated target copies first. Using Pepper on the recommended board gives better estimated odds."};
 else recommendation={state:"ready",text:"Your current copies are close to the best simulated board. Using Pepper now is reasonable."};
 return {target,current,bonus,next,plan,snapshot,economy,search,cooking:sourceCost===null?null:{
  tier:search.sourceTier,cost:sourceCost,possibleCooks:search.searchCookLimit
 },singleChance:p,currentChance,planChance,expectedActivations:avg,
  milestones:[.5,.9,.99].map(c=>({confidence:c,attempts:perfectoAttemptsForConfidence(planChance,c)})),
  freeUse:{knownChance:freeKnown,knownFrom:["Bottomless Shakers","Sushi Knowledge"],
   researchNotIncluded:true,expectedConsumedUpperBound:avg===null?null:avg*(1-freeKnown)},
  preparation:{maxDirectCookTier:economy?.maxCookTier??1,
   directCook:target<=(economy?.maxCookTier??1),
   fuelPerCopy:sourceCost,minDirectCookFuel:sourceCooks,
   saltEstimate:0,saltVerified:false,
   saltAvailable:snapshot.shakers[0]??0,pepperAvailable:snapshot.shakers[1]??0},
  recommendation,independenceAssumption:true,simulatedWind:true,
  ignoresSaltAndCookTierProcs:true
 };
}
