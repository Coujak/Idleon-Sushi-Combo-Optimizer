// Goal-specific result previews for planned Sushi upgrade purchases.
// Only model totals supported by the existing save and known formulas.
// A partial multiplier is never mislabeled as the full hourly production.
import {getKnowledgeRows,getUpgradeRows,sushiUpgradeDiscounts} from "./lab-model.mjs";
import {estimateSushiFuelEconomy} from "./perfecto-fuel.mjs";

const finite=value=>typeof value==="number"&&Number.isFinite(value);
const format=(n,digits=3)=>{
 if(!finite(n))return "Unavailable";
 if(n===0)return "0";
 if(Math.abs(n)>=1e9||Math.abs(n)<.001)return n.toExponential(3);
 return n.toLocaleString("en-US",{maximumFractionDigits:digits});
};
const levels=save=>save?.sushi?.[2]??[];
const leveled=(save,id)=>Math.max(0,Number(levels(save)[id])||0);
const bonuses=save=>{
 const values=Array(11).fill(0);
 for(const k of getKnowledgeRows(save))if(k.discovered&&k.mapped&&finite(k.bonus))
  values[k.category]+=k.bonus;
 return values;
};
const upgradeBonuses=save=>{
 const values=new Map();
 for(const u of getUpgradeRows(save))values.set(u.id,u.rawBonus);
 return id=>values.get(id)??0;
};
const make=(goal,label,value,display,note,estimated=true)=>({
 goal,label,value,display,note,estimated
});
export function progressionGoalMetric(save,goal){
 if(!save?.sushi)return make(goal,"Goal result",null,"Unavailable","Import a save first.");
 if(goal==="fuel"||goal==="capacity"){
  const economy=estimateSushiFuelEconomy(save);
  if(!economy)return make(goal,"Goal result",null,"Unavailable","Fuel data is missing.");
  const value=goal==="fuel"?economy.generationPerHour:economy.capacity;
  const label=goal==="fuel"?"Estimated passive Fuel / hour":"Estimated maximum Fuel capacity";
  const suffix=goal==="fuel"?" Fuel/hr":" Fuel";
  return make(goal,label,value,format(value)+suffix,
   "Modeled from known upgrades, Knowledge and the existing Sushi board. External bonuses can change the in-game total.");
 }
 if(goal==="discount"){
  const discount=sushiUpgradeDiscounts(save);
  const value=(1-discount.factor)*100;
  return make(goal,"Modeled upgrade price discount",value,format(value,2)+"%",
   discount.complete?
    "Includes all four discount categories available in the imported data.":
    "Only known discounts are included. Missing account bonuses can make actual prices lower.",
   !discount.complete);
 }
 if(goal==="bucks"){
  const bonus=upgradeBonuses(save),knowledge=bonuses(save);
  // Partial *passive* multiplier only: board sushi base Bucks/hr, Hot
  // plate contributions, Combo, and conditional shaker bonuses are omitted.
  const additive=knowledge[0]+[41,43,30,31,32,33,34].reduce((s,id)=>s+bonus(id),0);
  const global=(1+Math.max(0,additive)/100)*(1+Math.max(0,bonus(40))/100);
  return make(goal,"Modeled passive Bucks multiplier",global,format(global,3)+"×",
   "Partial model of known global upgrade and Knowledge bonuses. Full Bucks/hr needs base Sushi/plate, Combo, fire and other multiplier rules.");
 }
 if(goal==="knowledge"){
  const bonus=upgradeBonuses(save),knowledge=bonuses(save);
  const multiplier=(1+Math.max(0,knowledge[1]+bonus(38))/100);
  return make(goal,"Modeled global Knowledge EXP multiplier",multiplier,format(multiplier,3)+"×",
   "Partial global EXP multiplier. Plate EXP/day, EXP per cooked Sushi and fire-specific bonuses are separate effects.");
 }
 if(goal==="perfecto"){
  const peppersUnlocked=leveled(save,18)>0;
  const freeChance=Math.max(0,Math.min(100,leveled(save,21)));
  return make(goal,"Pepper access and free Shaker chance",
   peppersUnlocked?100+freeChance:freeChance,
   (peppersUnlocked?"Pepper unlocked":"Pepper locked")+" · "+format(freeChance,1)+"% free Shaker use",
   "Shows the upgrade-controlled unlock and free Shaker chance, not the probability a Sushi becomes Perfecto.");
 }
 return make(goal,"Goal result",null,"Unavailable","This goal has no reliable total model.");
}
export function compareProgressionGoal(before,after,goal){
 const previous=progressionGoalMetric(before,goal);
 const next=progressionGoalMetric(after,goal);
 const changed=previous.display!==next.display;
 let improvement=null;
 if(finite(previous.value)&&finite(next.value)&&previous.value!==0)
  improvement=(next.value/previous.value-1)*100;
 return {goal,label:next.label,current:previous.display,projected:next.display,
  changed,improvement,estimated:previous.estimated||next.estimated,note:next.note};
}
