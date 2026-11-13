// Read-only dashboard metrics. Never present an incomplete formula as an
// exact in-game rate or a per-fireplace effect as a global proc chance.
import {getKnowledgeRows,getUpgradeRows} from "./lab-model.mjs?v=1.19.11";
import {progressionGoalMetric} from "./progression-goal-impact.mjs?v=1.17.0";
import {estimateSushiFuelEconomy} from "./perfecto-fuel.mjs?v=1.16.6";

const finite=n=>typeof n==="number"&&Number.isFinite(n)&&n>=0;
export function getSushiDashboardMetrics(save){
 if(!save?.sushi)return null;
 const bucks=progressionGoalMetric(save,"bucks");
 const economy=estimateSushiFuelEconomy(save);
 const upgrades=new Map(getUpgradeRows(save).map(u=>[u.id,u]));
 const quality=upgrades.get(7)?.rawBonus;
 const trackingComplete=Array.isArray(save.sushi?.[5])&&save.sushi[5].length>=64;
 const levelsComplete=Array.isArray(save.sushi?.[7])&&save.sushi[7].length>=64;
 const knownKnowledge=trackingComplete&&levelsComplete;
 const cookedKnowledge=knownKnowledge?getKnowledgeRows(save)
  .filter(k=>k.discovered&&k.mapped&&k.category===2)
  .reduce((sum,k)=>sum+(finite(k.bonus)?k.bonus:0),0):null;
 const freshChance=finite(quality)?quality:null;
 const cookTierBonus=freshChance===null?null:
  freshChance+(cookedKnowledge??0);
 const tiles=Array.isArray(save.tiles)?save.tiles:null;
 const fires=Array.isArray(save.fires)?save.fires:null;
 const copperLevel=save.sushi?.[2]?.[24];
 const copperKnown=copperLevel!==undefined&&copperLevel!==null&&
  Number.isFinite(Number(copperLevel));
 const copperUnlocked=copperKnown&&Number(copperLevel)>0;
 const blueColumns=fires?.flatMap((type,index)=>Number(type)===2?[index]:[])??[];
 const highestTier=trackingComplete?
  save.sushi[5].reduce((last,flag,index)=>Number(flag)>=0?index+1:last,0):null;
 let eligibleBlueSushi=null;
 if(copperKnown&&trackingComplete&&fires&&tiles){
  eligibleBlueSushi=0;
  for(let i=0;i<Math.min(120,tiles.length);i++){
   const tier=Number(tiles[i]);
   if(Number.isInteger(tier)&&tier>=0&&tier+1<highestTier&&Number(fires[i%15])===2)
    eligibleBlueSushi++;
  }
 }
 const bucksRate=bucks.label==="Modeled Sushi Bucks generation / hour"&&finite(bucks.value)?
  bucks.value:null;
 return {
  bucksRate,
  fuelRate:finite(economy?.generationPerHour)?economy.generationPerHour:null,
  fuelCapacity:finite(economy?.capacity)?economy.capacity:null,
  cookTierBonus,
  cookBonusComplete:knownKnowledge,
  qualityFreshness:freshChance,
  knowledgeCookBonus:cookedKnowledge,
  blueProcChance:copperUnlocked?1:0,
  copperKnown,
  copperUnlocked,
  blueColumns:blueColumns.length,
  eligibleBlueSushi,
  rateEstimated:true
 };
}
