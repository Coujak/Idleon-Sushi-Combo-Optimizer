// Goal-based purchase guidance. All calculations are advisory heuristics:
// game-wide upgrades with different units cannot be compared as true ROI.
// Keep the ranking deterministic, budget-aware, and honest about missing data.
import {getSushiSnapshot,getUpgradeRows,upgradeAffordability} from "./lab-model.mjs?v=1.16.6";

export const PROGRESSION_SORT_OPTIONS=[
 {value:"recommended",label:"Recommended priority"},
 {value:"value",label:"Value for estimated cost"},
 {value:"impact",label:"Largest next-level improvement"},
 {value:"cost",label:"Lowest estimated cost"}
];
export const PROGRESSION_FILTER_OPTIONS=[
 {value:"all",label:"All options"},
 {value:"affordable",label:"Affordable now"},
 {value:"saving",label:"Needs more Bucks"},
 {value:"maxed",label:"Already maxed"}
];
const finite=n=>typeof n==="number"&&Number.isFinite(n);
const bounded=(x,min=0,max=1)=>Math.max(min,Math.min(max,x));

export function progressionEffect(upgrade){
 if(upgrade.atMax)return {label:"Max level reached",current:null,next:null,delta:0,unlock:false};
 if(upgrade.maxLevel===1)return {
  label:"Unlock this upgrade",current:"Not unlocked",next:"Unlocked",
  delta:1,unlock:true
 };
 // Only compare per-level raw upgrade contribution, never infer total game effect.
 const current=upgrade.rawBonus,next=current+upgrade.increment;
 const isPercentage=upgrade.description.includes("%")&&!upgrade.description.includes("}x");
 const unit=isPercentage?" percentage points":" raw effect units";
 return {
  label:"Raw upgrade effect: "+formatEffectNumber(current)+" → "+formatEffectNumber(next)+
    " (+"+formatEffectNumber(upgrade.increment)+unit+")",
  current,next,delta:upgrade.increment,unlock:false
 };
}
function formatEffectNumber(n){
 if(!finite(n))return "Unknown";
 return n.toLocaleString("en-US",{maximumFractionDigits:3});
}
function compareCost(a,b){
 const ac=a.estimatedNextCost,bc=b.estimatedNextCost;
 if(!finite(ac))return finite(bc)?1:0;
 if(!finite(bc))return -1;
 return ac-bc;
}
function deriveUpgrade(upgrade,bucks){
 const affordability=upgradeAffordability(upgrade,bucks);
 const effect=progressionEffect(upgrade);
 const cost=upgrade.estimatedNextCost;
 const costKnown=finite(cost)&&cost>=0;
 const missing=costKnown&&finite(bucks)?Math.max(0,cost-bucks):null;
 const exactCost=upgrade.costBreakdown?.complete===true;
 // Relative marginal raw contribution. Capped because other effects of
 // different upgrade types are not directly comparable.
 const relativeGain=effect.unlock?1:
  finite(effect.delta)&&effect.delta>0
   ?bounded(Math.log1p(effect.delta/(100+Math.max(0,Math.abs(upgrade.rawBonus)))*5)/Math.log(6))
   :0;
 const costBurden=costKnown&&finite(bucks)?
  bounded(Math.log10(1+cost)/Math.max(1,Math.log10(2+bucks))):1;
 const lowCostFactor=1-costBurden;
 const unlockFactor=effect.unlock?1:0;
 const affordable=affordability==="affordable";
 const score=Number((
  40*relativeGain+22*lowCostFactor+28*(affordable?1:0)+
  10*unlockFactor-(affordability==="unknown"?12:0)
 ).toFixed(5));
 const valueScore=(relativeGain*.85+.15*unlockFactor)/
  (costKnown?Math.max(1,Math.log10(10+cost)):100);
 const reason=effect.unlock
  ? "Unlocks an additional "+upgrade.goals.join("/")+" progression option."
  : "Adds "+formatEffectNumber(upgrade.increment)+
    " raw effect units at the next level; evaluated against your current level and estimated price.";
 const budgetNote=affordable?"Affordable with your imported Sushi Bucks.":
  affordability==="uncertain"?"The displayed cost is an upper estimate; missing discounts may lower it.":
  affordability==="unaffordable"?"Not affordable from your last imported balance.":
  affordability==="unavailable"?"Already at its maximum level.":
  "Price or balance could not be verified.";
 return {...upgrade,effect,affordability,missing,
  exactCost,costKnown,score,valueScore,relativeGain,reason,budgetNote};
}
function sortRecommended(a,b){
 return Number(b.affordability==="affordable")-Number(a.affordability==="affordable")||
  b.score-a.score||compareCost(a,b)||a.shop-b.shop;
}
export function getProgressionAdvice(save,goal,{
 sort="recommended",filter="all",includeMaxed=false
}={}){
 if(!save)return {goal,bucks:null,all:[],rows:[],best:null,roadmap:[],count:0,affordableCount:0};
 const bucks=getSushiSnapshot(save).bucks;
 const all=getUpgradeRows(save).filter(u=>u.goals.includes(goal)&&u.maxLevel>0)
  .map(u=>deriveUpgrade(u,bucks));
 const buyable=all.filter(u=>!u.atMax);
 const priority=buyable.slice().sort(sortRecommended);
 const best=priority[0]??null;
 // A roadmap is a snapshot of independent next-level choices, not a
 // hypothetical multi-purchase forecast that assumes new Bucks or discounts.
 const roadmap=priority.slice(0,3);
 let rows=all.filter(u=>includeMaxed||!u.atMax);
 if(filter==="affordable")rows=rows.filter(u=>u.affordability==="affordable");
 else if(filter==="saving")rows=rows.filter(u=>["unaffordable","uncertain","unknown"].includes(u.affordability));
 else if(filter==="maxed")rows=all.filter(u=>u.atMax);
 switch(sort){
  case "cost":rows.sort((a,b)=>Number(a.atMax)-Number(b.atMax)||compareCost(a,b)||a.shop-b.shop);break;
  case "impact":rows.sort((a,b)=>Number(a.atMax)-Number(b.atMax)||b.relativeGain-a.relativeGain||compareCost(a,b)||a.shop-b.shop);break;
  case "value":rows.sort((a,b)=>Number(a.atMax)-Number(b.atMax)||b.valueScore-a.valueScore||compareCost(a,b)||a.shop-b.shop);break;
  default:rows.sort((a,b)=>Number(a.atMax)-Number(b.atMax)||sortRecommended(a,b));
 }
 return {goal,bucks,all,rows,best,roadmap,count:buyable.length,
  affordableCount:buyable.filter(u=>u.affordability==="affordable").length,
  partialPrices:buyable.some(u=>!u.exactCost)};
}
