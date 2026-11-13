// Goal-specific result previews for planned Sushi upgrade purchases.
// Only model totals supported by the existing save and known formulas.
// A partial multiplier is never mislabeled as the full hourly production.
import {getKnowledgeRows,getUpgradeRows,sushiUpgradeDiscounts} from "./lab-model.mjs?v=1.19.13";
import {estimateSushiFuelEconomy} from "./perfecto-fuel.mjs?v=1.16.7";
import {formatCompactNumber} from "./number-format.mjs?v=1.0.1";

const finite=value=>typeof value==="number"&&Number.isFinite(value);
const format=(n,digits=3)=>formatCompactNumber(n,{digits});
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
  const external=save.sushiCurrencyExternal??{};
  const priorGrid189=grid&&Number.isFinite(grid.level)?
   Math.max(0,grid.level)*25*(1+gridObsPct/100):0;
  // Full Research grid189 when inputs are available: includes Pirate Deckhand,
  // Equinox clouds, King Doot, and the Rest-of-Game Sushi research bonus.
  const grid189Bonus=Number.isFinite(external.researchGrid189)?
   external.researchGrid189:priorGrid189;
  const artifact39=Number.isFinite(save.sailingArtifact39)?
   Math.max(0,save.sailingArtifact39):0;
  const knownExternal={
   BonV:save.bundleBonV===true?2:1,
   BanJ:save.bundleBanJ===true?2:1,
   event45:save.eventShop45===true?2:1,
   sailing39:1+artifact39,
   grid189:1+grid189Bonus/100,
   arcade:1+Math.max(0,external.arcadeSushi??0)/100,
   minehead:Math.max(1,Math.min(1.25,1+Math.max(0,external.mineheadSushi??0)/100)),
   atom:1+Math.max(0,external.atomSushi??0)/100,
   button:1+Math.max(0,external.buttonSushi??0)/100
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
    "Includes board, green fires, Combo, Knowledge, bundle, Event Shop, Sailing, Arcade, Atom, Minehead, Button and Research Grid multipliers supported by your IT save. Exactness depends on available pet/Research data and the active-character context; measured in-game rates remain available for calibration.");
  }
  return make(goal,"Modeled passive Bucks multiplier",global,format(global,3)+"×",
   "Board earnings could not be reconstructed. Shows known upgrade, Combo, Knowledge and available Arcade/Atom/Research/Button modifiers; other account sources may still be missing.");
 }
 if(goal==="knowledge"){
  const bonus=upgradeBonuses(save),knowledge=bonuses(save);
  // Both Searing upgrades change newly created Sushi EXP: 2nd Degree
  // increases the base EXP per creation, 3rd Degree scales all EXP.
  // A global-only multiplier would rank 2nd Degree as having no benefit.
  const multiplier=(1+Math.max(0,bonus(37))/10)*
   (1+Math.max(0,knowledge[1]+bonus(38))/100);
  return make(goal,"Modeled Knowledge EXP multiplier (created Sushi)",multiplier,
   format(multiplier,3)+"×",
   "Partial global EXP model for newly created Sushi. Includes 2nd and 3rd Degree Searing; plate EXP/day, Fireplace effects and other external modifiers are not a complete total.");
 }
 if(goal==="perfecto"){
  const peppersUnlocked=leveled(save,18)>0;
  // Use the effective level-scaled bonus: Bottomless Shakers can be doubled.
// Read the same modeled upgrade contribution used by the catalog and advisor.
  const freeChance=Math.max(0,Math.min(100,upgradeBonuses(save)(21)));
  // Pepper access is a separate yes/no unlock, not a fictional +100 percentage
  // points. Keep the numeric metric strictly the known free-use chance.
  return make(goal,"Pepper access and free Shaker chance",freeChance,
   (peppersUnlocked?"Pepper unlocked":"Pepper locked")+" · "+format(freeChance,1)+"% free Shaker use",
   "The numeric metric is the known free Shaker-use chance; Pepper access is a separate unlock. This is not the chance that Sushi becomes Perfecto.");
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
