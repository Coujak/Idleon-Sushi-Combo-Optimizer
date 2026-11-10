// Fuel-aware Sushi cooking estimates, based on IT/Corgan's world-7 Sushi parser.
// Account-unknown event shop / other external bonuses are explicitly excluded.
// The preparation optimizer must never claim more than normal merge-only math
// supports; Wind, Salt tier-ups and +1 cooked tier procs are excluded.
import {getKnowledgeRows,getSushiSnapshot,getUpgradeRows} from "./lab-model.mjs";

const numeric=n=>{const x=Number(n);return Number.isFinite(x)?x:0;};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function sushiDirectCookFuel(tier){
 const zero=Number(tier)-1;
 if(!Number.isInteger(zero)||zero<0||zero>=64)return null;
 return zero===5?176:Math.max(0,10*Math.pow(1.83,zero)-zero*zero);
}
export function estimateSushiFuelEconomy(save,{capacityOverride=null,generationOverride=null}={}){
 if(!save?.sushi)return null;
 const sushi=save.sushi,raw=sushi[4]??[],levels=sushi[2]??[],tiles=save.tiles??[];
 const knowledge=getKnowledgeRows(save);
 const category=Array(11).fill(0);
 for(const k of knowledge)if(k.discovered&&k.mapped&&k.bonus!==null)category[k.category]+=k.bonus;
 const upgrades=getUpgradeRows(save);
 const bonus=id=>upgrades.find(u=>u.id===id)?.rawBonus??0;
 const specific=id=>knowledge[id]?.discovered?knowledge[id].bonus??0:0;
 const bundleKnown=typeof save.bundleBonV==="boolean";
 const bundleMulti=save.bundleBonV===true?2:1;
 const capBase=(200+category[3])*bundleMulti*
   (1+[1,2,3,4,5].reduce((sum,id)=>sum+bonus(id),0)/100)*
   [2,3,4,5].reduce((mult,id)=>mult*(1+numeric(levels[id])/100),1);
 const sparks=numeric(raw[2]);
 const sparkMulti=sparks>0?.2*Math.log2(sparks)+Math.log10(sparks):0;
 const fireplaceBase=(1+category[9]/100)*(1+sparkMulti/100);
 let orangeSum=0;
 for(let i=0;i<Math.min(120,tiles.length);i++){
  if(Number(tiles[i])>=0&&save.fires?.[i%15]===0)orangeSum+=(Number(tiles[i])+1)*fireplaceBase;
 }
 const genBase=50*bundleMulti*
   (1+[8,9,10,11,12].reduce((sum,id)=>sum+bonus(id),0)/100)*
   (1+orangeSum/100)*(1+category[4]/100)*
   [27,36,45].reduce((mult,id)=>mult*(1+specific(id)/100),1)*
   [9,10,11,12].reduce((mult,id)=>mult*(1+numeric(levels[id])/100),1);
 const overrideNumber=x=>x!==null&&x!==""&&Number.isFinite(Number(x))&&Number(x)>0?Number(x):null;
 const capManual=overrideNumber(capacityOverride),genManual=overrideNumber(generationOverride);
 const currentFuel=Math.max(0,numeric(raw[0]));
 const capacity=capManual??capBase;
 const generationPerHour=genManual??genBase;
 const maxCookTier=clamp(1+Math.round(numeric(levels[6])),1,46);
 return {
  capacity,generationPerHour,currentFuel,maxCookTier,
  modeledCapacity:capBase,modeledGenerationPerHour:genBase,
  manualCapacity:capManual!==null,manualGeneration:genManual!==null,
  bundleKnown,bundleActive:save.bundleBonV===true,
  excludesEventCapacityBonus:capManual===null,
  orangeFireMultiplier:1+orangeSum/100,
  note:"Fuel capacity excludes unparsed Event Shop capacity bonuses; generation/capacity are estimates when external ownership data is missing. The planner accepts the displayed in-game figures as overrides."
 };
}
// Enumerate all affordable tiers, rather than enforcing a 50% cutoff.
// Half-capacity is a reference point only. A plan can benefit from more
// expensive tiers if they save sufficient merges and regeneration time.
export function affordableSushiCookingTiers(economy,targetTier){
 const cap=Number(economy?.capacity),maximum=Number(economy?.maxCookTier);
 const target=Number(targetTier);
 if(!(cap>0)||!Number.isFinite(maximum)||!Number.isInteger(target)||target<1)return [];
 const upper=Math.min(64,target,Math.floor(maximum)),result=[];
 for(let tier=1;tier<=upper;tier++){
  const cost=sushiDirectCookFuel(tier);
  if(cost!==null&&Number.isFinite(cost)&&cost<=cap)
   result.push({tier,cost,capacity:cap,share:cost/cap,nearHalfCapacity:Math.abs(cost/cap-0.5)});
 }
 return result;
}
export function chooseFuelCookingTier(economy,targetTier,{hours=24,secondsPerCook=20,mode="yield"}={}){
 if(!economy||!(hours>0)||!(secondsPerCook>0))return null;
 const duration=Math.max(1,Math.min(8760,Number(hours)));
 const seconds=Math.max(1,Math.min(3600,Number(secondsPerCook)));
 const steps=Math.min(1e8,Math.floor(duration*3600/seconds));
 const availableFuel=Math.max(0,economy.currentFuel+economy.generationPerHour*duration);
 const maxTier=Math.min(64,economy.maxCookTier,targetTier);
 let best=null;
 for(let tier=1;tier<=maxTier;tier++){
  const cost=sushiDirectCookFuel(tier);
  if(cost===null||cost>economy.capacity||!Number.isFinite(cost))continue;
  const byFuel=Math.max(0,Math.floor(availableFuel/cost));
  const possibleCooks=Math.min(steps,byFuel);
  const regenWaitSeconds=economy.generationPerHour>0?3600*cost/economy.generationPerHour:Infinity;
  // "Steady" uses an affordable tier at the chosen cooking pace; "yield"
  // maximizes the mass of sushi that can be prepared in the time window,
  // allowing some time waiting for fuel to regenerate.
  if(mode==="steady"&&regenWaitSeconds>seconds)continue;
  const mass=BigInt(possibleCooks)<<BigInt(tier-1);
  const candidate={tier,cost,possibleCooks,regenWaitSeconds,secondsPerCook:seconds,
   effectiveCookSeconds:Math.max(seconds,regenWaitSeconds),
   durationHours:duration,possibleMass:mass,
   sourceMode:mode,fullySustainable:regenWaitSeconds<=seconds};
  if(!best||candidate.possibleMass>best.possibleMass||
    candidate.possibleMass===best.possibleMass&&candidate.tier>best.tier)best=candidate;
 }
 // If no tier meets a fast requested pace, fall back to best achievable yield
 // with explicit waiting. The user can never conjure free fuel.
 if(!best&&mode==="steady"){
  const fallback=chooseFuelCookingTier(economy,targetTier,{hours:duration,secondsPerCook:seconds,mode:"yield"});
  return fallback?{...fallback,paceFallback:true}:null;
 }
 return best;
}
