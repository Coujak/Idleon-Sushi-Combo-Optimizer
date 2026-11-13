// Goal metrics used consistently by Progression Advisor ranking and roadmap.
// Keep partial estimates separate from verified whole-account totals.
import {progressionGoalMetric} from "./progression-goal-impact.mjs?v=1.16.9";
import {getKnowledgeRows,getUpgradeRows} from "./lab-model.mjs?v=1.19.10";

const finite=n=>typeof n==="number"&&Number.isFinite(n);
const format=n=>!finite(n)?"Unavailable":n.toLocaleString("en-US",{maximumFractionDigits:3});
export function progressionComparableMetric(save,goal){
 if(!save?.sushi)return progressionGoalMetric(save,goal);
 if(goal!=="knowledge"&&goal!=="perfecto")return progressionGoalMetric(save,goal);
 const upgrades=new Map(getUpgradeRows(save).map(u=>[u.id,u.rawBonus]));
 const bonus=id=>Math.max(0,upgrades.get(id)??0);
 if(goal==="knowledge"){
  const knowledge=getKnowledgeRows(save).filter(k=>k.discovered&&k.category===1)
   .reduce((sum,k)=>sum+(finite(k.bonus)?k.bonus:0),0);
  // 2nd Degree Searing increases the base EXP per newly cooked Sushi;
  // 3rd Degree Searing scales the global EXP multiplier.
  const value=(1+bonus(37)/10)*(1+(knowledge+bonus(38))/100);
  return {goal,value,label:"Modeled Knowledge EXP multiplier (created Sushi)",
   display:format(value)+"×",estimated:true,
   note:"Partial per-created-Sushi EXP model including both Searing upgrades and known Knowledge bonuses. Plate, Fireplace and other EXP sources are separate."};
 }
 const unlocked=(save.sushi?.[2]?.[18]??0)>0;
 const value=Math.max(0,Math.min(100,bonus(21)));
 return {goal,value,label:"Pepper access and free Shaker chance",
  display:(unlocked?"Pepper unlocked":"Pepper locked")+" · "+format(value)+"% free Shaker use",
  estimated:false,
  note:"Pepper access is a separate unlock, not +100% free Shaker chance. This is free-use chance, not a Sushi's Perfecto probability."};
}
