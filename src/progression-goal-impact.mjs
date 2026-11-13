// Goal-specific result previews for planned Sushi upgrade purchases.
// Only model totals supported by the existing save and known formulas.
// A partial multiplier is never mislabeled as the full hourly production.
import {getKnowledgeRows,getUpgradeRows,sushiUpgradeDiscounts} from "./lab-model.mjs?v=1.16.6";
import {estimateSushiFuelEconomy} from "./perfecto-fuel.mjs?v=1.16.6";

const finite=value=>typeof value==="number"&&Number.isFinite(value);
const format=(n,digits=3)=>{
 if(!finite(n))return "Unavailable";
 if(n===0)return "0";
 if(Math.abs(n)>=1e9||Math.abs(n)<.001)return n.toExponential(3).replace(/e\+?/i,"E");
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
  // Mirror the *known* part of the Sushi CurrencyMulti groups from the
  // game parser. These are separate multiplicative groups: combining them
  // in one additive percent would distort the next-purchase projection.
  // Toolbox SushiStuff.CurrencyMulti: one of the surcharge group's terms
  // is a flat +100% when Gaming Superbit 67 is owned.
  const surcharge=[30,31,32,33,34].reduce((sum,id)=>sum+bonus(id),0)+
   (save.superbit67===true?100:0);
  const wage=bonus(41)+bonus(43);
  const bestCombo=Math.max(0,Number(save.sushi?.[4]?.[8])||0);
  const over=Math.max(0,bestCombo-1500);
  const comboMulti=1+Math.min(10,Math.pow(bestCombo,.3))+
    (over/(20000+over))*90;
  const uniqueTracker=save.sushi?.[5]??[];
  let unique=0;
  for(const t of uniqueTracker){if(Number(t)<0)break;unique++;}
  const rawOvertuned=Number(save.sushi?.[4]?.[1])||0;
  const overtuned=rawOvertuned>1e6?
   5*Math.log2(rawOvertuned/1e6)+10*Math.log10(rawOvertuned/1e6):0;
  // Verified separate Toolbox CurrencyMulti factors from the raw save.
  // Sailing[3][39] holds the acquired artifact grade, not a boolean.
  // Research grid189: baseBonus 25 per level with a known observation
  // multiplier. The global Research Grid_Bonus_Allmulti is not yet parsed,
  // so this remains a lower-bound component, not the complete game factor.
  const observationPcts=[25,15,50,20,20,35,25,30,35,60];
  const grid=save.research189;
  const observation=grid?.observation;
  const gridObsPct=Number.isInteger(observation)&&observation>=0?
   (observationPcts[observation]??0):0;
  const grid189Bonus=grid&&Number.isFinite(grid.level)?
   Math.max(0,grid.level)*25*(1+gridObsPct/100):0;
  const artifact39=Number.isFinite(save.sailingArtifact39)?
   Math.max(0,save.sailingArtifact39):0;
  const knownExternal={
   BonV:save.bundleBonV===true?2:1,
   BanJ:save.bundleBanJ===true?2:1,
   event45:save.eventShop45===true?2:1,
   sailing39:1+artifact39,
   grid189:1+grid189Bonus/100
  };
  const global=Math.pow(1.1,unique)*comboMulti*
   (1+surcharge/100)*(1+knowledge[0]/100)*
   (1+bonus(40)/100)*(1+wage/100)*(1+overtuned/100)*
   Object.values(knownExternal).reduce((total,mult)=>total*mult,1);
  const tiers=save.tiles??save.sushi?.[0];
  const slotTypes=save.slots??save.sushi?.[1]??[];
  const fires=save.fires??save.sushi?.[3]??[];
  const spark=Number(save.sushi?.[4]?.[2])||0;
  const fireplaceSpark=spark>0?.2*Math.log2(spark)+Math.log10(spark):0;
  const slotEffectBase=1+knowledge[8]/100;
  const fireEffectBase=(1+knowledge[9]/100)*(1+fireplaceSpark/100);
  const early=[1,3,8,20,50,115,250,560,1220,2650];
  let base=0;
  if(Array.isArray(tiers)){
   for(let i=0;i<Math.min(120,tiers.length);i++){
    const tier=Number(tiers[i]);
    if(!Number.isInteger(tier)||tier<0)continue;
    const tierBucks=tier<10?early[tier]:
     tier<16?Math.pow(2.46-tier/100,tier)+5*tier+tier*tier:
     Math.pow(2.31,tier);
    const slotMulti=Number(slotTypes[i])===1?1+.5*slotEffectBase:1;
    const fireMulti=Number(fires[i%15])===1?1+1.5*fireEffectBase:1;
    base+=tierBucks*slotMulti*fireMulti;
   }
  }
  if(base>0&&finite(base*global)){
   const value=base*global;
   return make(goal,"Modeled Sushi Bucks generation / hour",
    value,format(value)+" Bucks/hr",
    "Includes board tiers, plates, fireplaces, Combo, Knowledge and verified bundle, Event Shop, Sailing and Research multipliers when available. Arcade, Atom, Minehead, Button, other Research and companion bonuses may still be missing; enter a measured in-game rate to anchor the projection.");
  }
  return make(goal,"Modeled passive Bucks multiplier",global,format(global,3)+"×",
   "Board earnings could not be reconstructed. Shows known upgrade, discovery, Combo, Knowledge and verified extra modifiers; other account bonuses may still be missing.");
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
