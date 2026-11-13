// Goal-based purchase guidance. All calculations are advisory heuristics:
// game-wide upgrades with different units cannot be compared as true ROI.
// Keep the ranking deterministic, budget-aware, and honest about missing data.
import {getUpgradeRows,upgradeAffordability} from "./lab-model.mjs?v=1.19.11";
import {progressionComparableMetric} from "./progression-impact.mjs?v=1.0.1";

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
// Do not treat an absent or malformed Sushi Bucks balance as zero.
// A real zero balance is valid; a partial import is not a savings forecast.
export function readSushiBucks(save){
 const raw=save?.sushi?.[4]?.[3];
 if(typeof raw!=="number"&&typeof raw!=="string"||typeof raw==="string"&&!raw.trim())return null;
 const value=Number(raw);
 return finite(value)&&value>=0?value:null;
}
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
// Compare each next-level purchase with the same account, changing only its
// upgrade level. The metric is explicitly partial when not all effects are known.
function projectedMetric(save,upgrade,goal){
 if(upgrade.atMax||!Array.isArray(save?.sushi?.[2]))return null;
 const sushi=save.sushi.slice();
 sushi[2]=sushi[2].slice();
 sushi[2][upgrade.id]=upgrade.level+1;
 return progressionComparableMetric({...save,sushi},goal);
}
function deriveUpgrade(save,upgrade,bucks,goal,baseline){
 const affordability=upgradeAffordability(upgrade,bucks);
 const effect=progressionEffect(upgrade);
 const cost=upgrade.estimatedNextCost;
 const costKnown=finite(cost)&&cost>=0;
 const missing=costKnown&&finite(bucks)?Math.max(0,cost-bucks):null;
 const exactCost=upgrade.costBreakdown?.complete===true;
 const future=projectedMetric(save,upgrade,goal);
 const hasNumbers=finite(baseline?.value)&&finite(future?.value);
 const increased=hasNumbers&&future.value>baseline.value;
 // Pepper Shaker is a prerequisite for Perfecto attempts. Do not
 // misinterpret buying it as +100 percentage points of free Shaker uses.
 const importantUnlock=goal==="perfecto"&&upgrade.id===18&&!upgrade.atMax&&upgrade.level===0;
 const points=hasNumbers?Math.max(0,future.value-baseline.value):0;
 const relativeGain=upgrade.atMax?0:importantUnlock?1:
  !increased?0:goal==="perfecto"?points/100:
  baseline.value>0?Math.max(0,future.value/baseline.value-1):0;
 const impactRankable=!upgrade.atMax&&(importantUnlock||increased&&relativeGain>0);
 // Cost is a diminishing weight rather than a false unit-for-unit ROI:
 // passive rates, discounts, free chances and one-time unlocks have
 // different units and cannot be reduced to one universal cost ratio.
 const valueScore=impactRankable&&costKnown?
  relativeGain/(1+Math.log10(1+cost)):0;
 const score=Number((valueScore*100).toFixed(6));
 const improvementPct=increased&&baseline.value>0?
  (future.value/baseline.value-1)*100:null;
 const formatPct=value=>value.toLocaleString("en-US",{maximumFractionDigits:2});
 const impactText=importantUnlock?"Unlocks Pepper Shaker for Perfecto attempts":
  increased?goal==="perfecto"?
  "+"+formatPct(points)+" percentage points free Shaker-use chance":
  improvementPct!==null?"≈+"+formatPct(improvementPct)+"% "+goal+" improvement":
  "Enables a modeled "+goal+" effect":
  "No quantified gain in the current goal model";
 const impactNote=importantUnlock?
  "Prerequisite unlock. Does not increase the chance per Pepper use.":
  !hasNumbers?
  "The imported save cannot provide a comparable before/after goal value.":
  !increased?
  "This upgrade has no measurable change to this goal's current partial model; per-use or non-passive benefits may remain.":
  "From "+baseline.display+" to "+future.display+"; "+
   (baseline.estimated||future.estimated?"partial model, not verified total.":"modeled from known effects.");
 const reason=importantUnlock?
  "Unlocking Pepper makes Perfecto hunting possible.":
  increased?impactText+". "+(costKnown?"Weighted against discounted cost.":"Discounted price is unavailable."):
  effect.unlock?"Unlocks a new effect, but this goal model cannot quantify its value yet.":
  "Adds "+formatEffectNumber(upgrade.increment)+
   " raw upgrade units, but a reliable account-wide gain for this goal is not available.";
 const budgetNote=affordability==="affordable"?"Affordable with your imported Sushi Bucks.":
  affordability==="uncertain"?"The displayed cost is an upper estimate; missing discounts may lower it.":
  affordability==="unaffordable"?"Not affordable from your last imported balance.":
  affordability==="unavailable"?"Already at its maximum level.":
  "Price or balance could not be verified.";
 return {...upgrade,bucks,effect,affordability,missing,
  exactCost,costKnown,score,valueScore,relativeGain,reason,budgetNote,
  impactRankable,importantUnlock,impactText,impactNote,impactBefore:baseline?.display??null,
  impactAfter:future?.display??null,impactEstimated:!!(baseline?.estimated||future?.estimated)};
}
function sortRecommended(a,b){
 // A cheap upgrade with no measurable effect on the selected goal must
 // not displace a genuine goal improvement just because it is affordable.
 // Among comparable effects, affordability still decides the next action.
 return Number(b.importantUnlock)-Number(a.importantUnlock)||
  Number(b.impactRankable)-Number(a.impactRankable)||
  Number(b.affordability==="affordable")-Number(a.affordability==="affordable")||
  b.valueScore-a.valueScore||b.relativeGain-a.relativeGain||compareCost(a,b)||a.shop-b.shop;
}
export function getProgressionAdvice(save,goal,{
 sort="recommended",filter="all",includeMaxed=false
}={}){
 if(!save)return {goal,bucks:null,all:[],rows:[],best:null,roadmap:[],count:0,affordableCount:0};
 const bucks=readSushiBucks(save);
 const baseline=progressionComparableMetric(save,goal);
 const all=getUpgradeRows(save).filter(u=>u.goals.includes(goal)&&u.maxLevel>0)
  .map(u=>deriveUpgrade(save,u,bucks,goal,baseline));
 const buyable=all.filter(u=>!u.atMax);
 const priority=buyable.slice().sort(sortRecommended);
 const best=priority[0]??null;
 // A roadmap is a snapshot of independent next-level choices, not a
 // hypothetical multi-purchase forecast that assumes new Bucks or discounts.
 const roadmap=priority.slice(0,3);
 let rows=all.filter(u=>includeMaxed||!u.atMax);
 if(filter==="affordable")rows=rows.filter(u=>u.affordability==="affordable");
 else if(filter==="saving")rows=rows.filter(u=>["unaffordable","uncertain"].includes(u.affordability));
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
