// Search over continuous refill/merge/park rotations rather than independent
// one-shot boards. Every candidate starts with the actual imported Sushi board.
import {simulateContinuousKnowledgeRotation} from "./knowledge-continuous-rotation.mjs?v=1.0.2";
import {estimateSushiFuelEconomy,sushiDirectCookFuel} from "./perfecto-fuel.mjs?v=1.16.8";
import {getKnowledgeRows,getUpgradeRows} from "./lab-model.mjs?v=1.19.13";
import {getSushiDashboardMetrics} from "./dashboard-metrics.mjs?v=1.0.2";
import {normalizeKnowledgeCycleOptions} from "./knowledge-cycle-optimizer.mjs?v=1.0.2";

export {normalizeKnowledgeCycleOptions};
const SIZE=120,COLS=15;
const num=x=>Number.isFinite(Number(x))?Number(x):0;
const clip=(n,min,max)=>Math.max(min,Math.min(max,n));
const unique=a=>[...new Set(a)];
const sum=a=>a.reduce((x,y)=>x+y,0);
function layoutFromSave(save){
 const slots=Array.from({length:SIZE},(_,i)=>{
  const t=save?.slots?.[i],n=Number(t);
  return t!==undefined&&t!==null&&Number.isInteger(n)&&n>=0&&n<=3?n:-1;
 });
 const tiles=Array.from({length:SIZE},(_,i)=>{
  const t=save?.tiles?.[i],n=Number(t);
  return slots[i]>=0&&t!==undefined&&t!==null&&Number.isInteger(n)&&n>=0&&n<64?n+1:0;
 });
 const fires=Array.from({length:COLS},(_,i)=>{
  const t=save?.fires?.[i],n=Number(t);
  return t!==undefined&&t!==null&&Number.isInteger(n)&&n>=0&&n<=4?n:-1;
 });
 return {slots,tiles,fires};
}
function startingTiers(economy,guaranteed,options,targetTier){
 const upper=Math.min(64-guaranteed,Math.floor(num(economy.maxCookTier)));
 const cap=num(economy.capacity);
 const valid=[];
 for(let tier=1;tier<=upper;tier++){
  const cost=sushiDirectCookFuel(tier);
  if(cost>0&&Number.isFinite(cost)&&cost<=cap)valid.push(tier);
 }
 if(!valid.length)return [];
 const max=valid.at(-1);
 const requests=options.mode==="focused"?
  [targetTier-guaranteed,max,max-1,targetTier-guaranteed-2,Math.floor(max*.65),1]:
  [max,max-1,Math.floor(max*.75),Math.floor(max*.5),1];
 return unique(requests.filter(x=>valid.includes(x))).slice(0,5);
}
function expProfile(save,rows,options,fires,metrics){
 const upgrade=getUpgradeRows(save);
 const bonus=id=>upgrade.find(x=>x.id===id)?.rawBonus??0;
 const searing=bonus(37),third=bonus(38);
 const knowledge=rows.filter(x=>x.discovered&&x.category===1&&Number.isFinite(x.bonus))
  .reduce((a,x)=>a+x.bonus,0);
 const base=options.expPerCreation??(1+Math.max(0,searing)/10);
 const global=(1+Math.max(0,third)/100)*(1+Math.max(0,knowledge)/100);
 const lithiumEnabled=num(save?.sushi?.[2]?.[26])>0;
 const lithium=lithiumEnabled?(options.lithiumMultiplier??2):1;
 return {
  lithiumEnabled,lithium,
  expAt:(tier,at)=>base*global*(fires[at%COLS]===3?lithium:1),
  guaranteed:metrics?.cookBonusComplete?
   clip(Math.floor(num(metrics.guaranteedCookTiers)),0,63):0,
  fractional:metrics?.cookBonusComplete?num(metrics.fractionalCookChance):null
 };
}
function fireAlternatives(save,fires){
 const options=[{name:"Imported fireplaces",fires:fires.slice()}];
 if(num(save?.sushi?.[2]?.[26])>0&&fires.some(x=>x>=0&&x!==3)){
  options.push({name:"Lithium in all columns",
   fires:fires.map(x=>x>=0?3:x)});
  options.push({name:"Alternate Lithium columns",
   fires:fires.map((x,i)=>x>=0&&i%2===0?3:x)});
 }
 return options.filter((choice,i,arr)=>arr.findIndex(x=>
  x.fires.every((v,j)=>v===choice.fires[j]))===i);
}
function expFairness(gains,seconds,tiers){
 const rate=3600/seconds;
 return tiers.reduce((total,t)=>total+Math.log1p(gains[t]*rate),0);
}
export function optimizeKnowledgeRotation(save,rawOptions={}){
 const options=normalizeKnowledgeCycleOptions(rawOptions);
 const fail=reason=>({available:false,reason,mode:options.mode,options});
 if(!save?.sushi||!Array.isArray(save?.tiles)||!Array.isArray(save?.slots))
  return fail("Import a Sushi Station board with slot and Sushi data.");
 const layout=layoutFromSave(save);
 const unlocked=layout.slots.filter(x=>x>=0).length;
 if(unlocked<2)return fail("At least two unlocked Sushi slots are required.");
 const rows=getKnowledgeRows(save),eligible=rows.filter(x=>x.discovered);
 if(!eligible.length)return fail("No discovered Sushi tiers are available.");
 if(num(save?.sushi?.[2]?.[13])<1)
  return fail("Unlock Seared Knowledge before estimating active Knowledge EXP.");
 const targetTier=eligible.some(x=>x.tier===options.targetTier)?
  options.targetTier:eligible[0].tier;
 const economy=estimateSushiFuelEconomy(save,{
  capacityOverride:options.fuelCapacity,generationOverride:options.fuelGeneration
 });
 if(!economy?.capacity||!economy?.generationPerHour)
  return fail("Fuel capacity or generation is unavailable. Calibrate those readings in the options.");
 const metrics=getSushiDashboardMetrics(save);
 const originalProfile=expProfile(save,eligible,options,layout.fires,metrics);
 const bases=startingTiers(economy,originalProfile.guaranteed,options,targetTier);
 if(!bases.length)return fail("No directly cookable Sushi tier fits your estimated fuel capacity.");
 const highestDiscovered=eligible.reduce((n,row)=>Math.max(n,row.tier),0);
 const windCap=num(save?.sushi?.[2]?.[29])>0?Math.max(0,Math.min(58,highestDiscovered-6)):0;
 const chain=windCap>0?25:0;
 const fires=fireAlternatives(save,layout.fires);
 const baseline=estimateSushiFuelEconomy(save,{capacityOverride:options.fuelCapacity});
 const baselineRate=baseline?.modeledGenerationPerHour??0;
 const adjustedRate=(tiles,selectedFires)=>{
  const e=estimateSushiFuelEconomy({...save,tiles:tiles.map(t=>t>0?t-1:-1),
   fires:selectedFires},{capacityOverride:options.fuelCapacity});
  const modeled=e?.modeledGenerationPerHour??0;
  return options.fuelGeneration!==null&&baselineRate>0?
   modeled/baselineRate*options.fuelGeneration:modeled;
 };
 const rounds=Math.max(1,Math.min(12,Math.floor(num(rawOptions?.rounds))||6));
 // Continuous Balanced refills benefit from keeping the leftover tiers in a
 // stable staircase rather than scattering them through the refill area.
 // Keep the original strategy as a comparison; Focused retains target parking.
 const packingModes=options.mode==="balanced"?["simple","ascending","descending"]:["simple"];
 let best=null,candidates=0;
 for(const cookTier of bases){
  for(const pattern of ["wind","paired"]){
   for(const fire of fires){
    const xp=expProfile(save,eligible,options,fire.fires,metrics);
    for(const packingMode of packingModes){
    const rotation=simulateContinuousKnowledgeRotation({
     startingBoard:layout.tiles,slots:layout.slots,mode:options.mode,targetTier,
     requestedTier:cookTier,guaranteedBonus:xp.guaranteed,
     windCap,chain,expAt:xp.expAt,cookCost:sushiDirectCookFuel,rounds,pattern,
     packingMode,maximumActions:1800
    });
    if(!rotation.valid||rotation.cooks<1)continue;
    const rateA=adjustedRate(layout.tiles,fire.fires);
    const rateB=adjustedRate(rotation.finalBoard,fire.fires);
    const fuelRate=(rateA+rateB)/2;
    if(!(fuelRate>0))continue;
    const activeSeconds=rotation.cooks*options.secondsPerCook+
     (rotation.merges+rotation.moves)*options.secondsPerMerge+
     rotation.windEvents*.25;
    const fuelWaitSeconds=rotation.fuel*3600/fuelRate;
    const durationSeconds=Math.max(activeSeconds,fuelWaitSeconds);
    if(!(durationSeconds>0))continue;
    const focus=rotation.gains[targetTier]||0;
    const score=options.mode==="focused"?
     focus*3600/durationSeconds*100+
      rotation.gains.reduce((n,x,i)=>n+
       (i<targetTier?x*i/targetTier:x)*.0001,0)*3600/durationSeconds+
       rotation.focusCopies*.01:
     expFairness(rotation.gains,durationSeconds,eligible.map(x=>x.tier))+
      (rotation.completed?100:0)+rotation.highestTier*.01;
    candidates++;
    if(!best||score>best.score){
     best={rotation,score,cookTier,pattern,packingMode,fire,xp,fuelRate,
      activeSeconds,fuelWaitSeconds,durationSeconds};
    }
    }
   }
  }
 }
 if(!best)return fail("No feasible legal refill/merge rotation was found with this board and fuel budget.");
 const rotation=best.rotation;
 const windowExpPerHour=rotation.totalExp*3600/best.durationSeconds;
 const focusExpPerHour=rotation.gains[targetTier]*3600/best.durationSeconds;
 const perTier=eligible.map(row=>{
  const expPerCycle=rotation.gains[row.tier];
  const expPerHour=expPerCycle*3600/best.durationSeconds;
  const remaining=Number.isFinite(row.xpRemaining)?row.xpRemaining:null;
  return {tier:row.tier,name:row.name,level:row.level,remaining,expPerCycle,
   expPerHour,etaHours:remaining===0?0:expPerHour>0&&remaining!==null?
    remaining/expPerHour:null};
 });
 const firstFill=rotation.frames.findIndex(x=>x.kind==="refill");
 let preparedStep=firstFill>=0?firstFill:0;
 for(let i=firstFill+1;i<rotation.frames.length;i++){
  if(rotation.frames[i].kind!=="cook")break;
  preparedStep=i;
 }
 const sustained=rotation.repeatable&&rotation.initialBoard.every(
  (t,i)=>t===rotation.finalBoard[i]);
 return {
  available:true,mode:options.mode,targetTier,options,layout,
  startingBoard:rotation.initialBoard,finalBoard:rotation.finalBoard,
  proposedFires:best.fire.fires,fireChoice:best.fire.name,
  pinkMultiplier:best.xp.lithiumEnabled?best.xp.lithium:null,
  windCap,steps:rotation.frames,preparedStep,
  startCookTier:best.cookTier,startingPattern:best.pattern,packingMode:best.packingMode,
  totalExpPerCycle:rotation.totalExp,totalExpPerHour:sustained?windowExpPerHour:null,
  previewExpPerHour:windowExpPerHour,targetExpPerHour:sustained?focusExpPerHour:null,
  targetPreviewExpPerHour:focusExpPerHour,
  expByTier:rotation.gains,perTier,cooks:rotation.cooks,merges:rotation.merges,
  windEvents:rotation.windEvents,moves:rotation.moves,
  fuelPerCycle:rotation.fuel,cycleSeconds:best.durationSeconds,
  activeSeconds:best.activeSeconds,fuelWaitSeconds:best.fuelWaitSeconds,
  estimatedFuelGeneration:best.fuelRate,estimatedFuelCapacity:economy.capacity,
  roundsCompleted:rotation.rounds,roundsRequested:rounds,
  focusCopies:rotation.focusCopies,focusCompressed:rotation.focusCompressed,
  highestTier:rotation.highestTier,
  completed:rotation.completed,repeatable:sustained,rotationTerminal:rotation.repeatable,
  initialBoardMatchesFinal:sustained,
  stranded:rotation.remaining.length,
  considered:candidates,haltReason:rotation.reason,
  note:"EXP/hr and leveling ETA are projections from this finite refill/merge preview, not verified sustained rates. All moves, cooks, Wind effects and same-tier merges are simulated. Passive Milktoast/Cold EXP, random tier procs, and exact interaction timing remain excluded."
 };
}
