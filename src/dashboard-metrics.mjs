// Read-only dashboard metrics. Never present an incomplete formula as an
// exact in-game rate or a per-fireplace effect as a global proc chance.
import {getKnowledgeRows,getUpgradeRows} from "./lab-model.mjs?v=1.19.11";
import {progressionGoalMetric} from "./progression-goal-impact.mjs?v=1.17.0";
import {estimateSushiFuelEconomy} from "./perfecto-fuel.mjs?v=1.16.7";

const finite=n=>typeof n==="number"&&Number.isFinite(n)&&n>=0;
/** The rollover model is informed by observed in-game behavior, not yet verified game code. */
export function cookingTierOverflow(chance){
 if(!finite(chance))return {guaranteed:null,remainder:null,atLeastOne:null,atLeastTwo:null};
 const guaranteed=Math.floor(chance/100);
 const remainder=Math.max(0,Math.min(100,chance-guaranteed*100));
 return {guaranteed,remainder,
  atLeastOne:guaranteed>=1?100:remainder,
  atLeastTwo:guaranteed>=2?100:guaranteed===1?remainder:0};
}
export function getSushiDashboardMetrics(save){
 if(!save?.sushi)return null;
 const bucks=progressionGoalMetric(save,"bucks");
 const economy=estimateSushiFuelEconomy(save);
 const upgrades=new Map(getUpgradeRows(save).map(u=>[u.id,u]));
 const qualityLevel=save.sushi?.[2]?.[7];
 const hasQuality=qualityLevel!==undefined&&qualityLevel!==null&&
  Number.isFinite(Number(qualityLevel))&&Number(qualityLevel)>=0;
 const quality=hasQuality?upgrades.get(7)?.rawBonus:null;
 const trackingComplete=Array.isArray(save.sushi?.[5])&&save.sushi[5].length>=64;
 const levelsComplete=Array.isArray(save.sushi?.[7])&&save.sushi[7].length>=64;
 const knownKnowledge=trackingComplete&&levelsComplete;
 const cookedKnowledge=knownKnowledge?getKnowledgeRows(save)
  .filter(k=>k.discovered&&k.mapped&&k.category===2)
  .reduce((sum,k)=>sum+(finite(k.bonus)?k.bonus:0),0):null;
 const freshChance=finite(quality)?quality:null;
 const cookTierBonus=freshChance!==null&&finite(cookedKnowledge)?
  freshChance+cookedKnowledge:null;
 // Tier-up overflow is modeled from the player's observed 100%+ behavior.
 // This is separate from blue fire's chance to replace a +1 tier event.
 const rollover=cookingTierOverflow(cookTierBonus);
 const guaranteedCookTiers=rollover.guaranteed;
 const fractionalCookChance=rollover.remainder;
 const chanceAtLeastOne=rollover.atLeastOne;
 const chanceAtLeastTwo=rollover.atLeastTwo;
 const copperLevel=save.sushi?.[2]?.[24];
 const copperKnown=copperLevel!==undefined&&copperLevel!==null&&
  Number.isFinite(Number(copperLevel))&&Number(copperLevel)>=0;
 const copperUnlocked=copperKnown&&Number(copperLevel)>0;
 const fires=Array.isArray(save.fires)?save.fires:null;
 const blueColumns=fires?.filter(type=>Number(type)===2).length??0;
 const bucksRate=bucks.label==="Modeled Sushi Bucks generation / hour"&&finite(bucks.value)?
  bucks.value:null;
 return {
  bucksRate,
  fuelRate:finite(economy?.generationPerHour)?economy.generationPerHour:null,
  fuelCapacity:finite(economy?.capacity)?economy.capacity:null,
  cookTierBonus,guaranteedCookTiers,fractionalCookChance,
  chanceAtLeastOne,chanceAtLeastTwo,
  cookBonusComplete:knownKnowledge,
  qualityFreshness:freshChance,
  knowledgeCookBonus:cookedKnowledge,
  blueProcChance:copperKnown?(copperUnlocked?1:0):null,
  copperKnown,copperUnlocked,blueColumns,
  rateEstimated:true
 };
}
