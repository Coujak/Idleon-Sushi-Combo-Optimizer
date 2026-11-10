// Sequential Sushi Station upgrade plan.
// Recomputes levels, costs and priority after each simulated purchase.
// Future income is NOT predicted: when Bucks run out we simulate saving
// only the extra Bucks required for the next suggested purchase.
import {getProgressionAdvice} from "./progression-advisor.mjs?v=1.16.6";
import {progressionGoalMetric} from "./progression-goal-impact.mjs?v=1.16.6";
import {calibratedProgressionMetric} from "./progression-calibration.mjs";

export const PURCHASE_PRESETS=[5,10,25,50,100];
export const MAX_CUSTOM_PURCHASES=500;
export function normalizePurchaseCount(value){
 const n=Number(value);
 if(!Number.isFinite(n))return 5;
 return Math.max(1,Math.min(MAX_CUSTOM_PURCHASES,Math.trunc(n)));
}
const finite=n=>typeof n==="number"&&Number.isFinite(n);

export function buildProgressionPurchasePlan(save,goal,requestedCount=5,{readings={}}={}){
 const count=normalizePurchaseCount(requestedCount);
 const blank={goal,requestedCount:count,steps:[],initialBucks:null,
  finalProjectedBucks:null,initiallyFunded:0,additionalBucksNeeded:0,
  totalEstimatedCost:0,partialPrices:false,stopReason:"",
  initialGoal:null,finalGoal:null};
 if(!save?.sushi||!Array.isArray(save.sushi[2]))return {...blank,stopReason:"Import a game save first."};
 // Never alter imported account state. Projected level changes update the
 // original cost model (including discounted Wholesale Pricing).
 const projected={...save,sushi:save.sushi.map((entry,index)=>
  index===2||index===4?Array.isArray(entry)?entry.slice():[]:entry)};
 if(!Array.isArray(projected.sushi[4]))projected.sushi[4]=[];
 const initial=Number(projected.sushi[4][3]??0);
 if(!finite(initial)||initial<0)return {...blank,stopReason:"Sushi Bucks balance is unavailable."};
 let balance=initial,totalEstimatedCost=0,additionalBucksNeeded=0,initiallyFunded=0;
 const steps=[];
 const referenceMetric=progressionGoalMetric(projected,goal);
 const metricFor=state=>calibratedProgressionMetric(
  progressionGoalMetric(state,goal),referenceMetric,readings[goal],goal);
 const initialGoal=metricFor(projected);
 let goalBefore=initialGoal;
 let stopReason="";
 for(let i=0;i<count;i++){
  projected.sushi[4][3]=balance;
  // Use the same ranking as the featured recommendation. Filtering out
  // unsupported costs prevents fabricating a numeric purchase forecast.
  const advice=getProgressionAdvice(projected,goal);
  const candidate=advice.rows.find(item=>!item.atMax&&item.costKnown);
  if(!candidate){
   stopReason=advice.count===0?
    "All upgrades for this goal are maxed.":
    "No remaining upgrade has a usable cost estimate.";
   break;
  }
  const price=candidate.estimatedNextCost;
  if(!finite(price)||price<0){stopReason="Projected cost is not finite.";break;}
  const previousLevel=projected.sushi[2][candidate.id]??0;
  const extra=Math.max(0,price-balance);
  if(!finite(extra)){stopReason="Future Bucks requirement is too large to estimate.";break;}
  const fundedByImport=additionalBucksNeeded===0&&extra===0;
  // These are not claimed game earnings: this is a planning assumption
  // ("earn enough to buy the next priority"), not an income forecast.
  balance=Math.max(0,balance+extra-price);
  totalEstimatedCost+=price;
  additionalBucksNeeded+=extra;
  if(fundedByImport)initiallyFunded++;
  const nextLevel=Number(previousLevel)+1;
  projected.sushi[2][candidate.id]=nextLevel;
  const goalAfter=metricFor(projected);
  const goalResult={
   label:goalBefore.label,current:goalBefore.display,
   projected:goalAfter.display,changed:goalBefore.display!==goalAfter.display,
   note:goalAfter.note,estimated:goalBefore.estimated||goalAfter.estimated
  };
  steps.push({
   number:i+1,id:candidate.id,shop:candidate.shop,name:candidate.name,
   fromLevel:Number(previousLevel),toLevel:nextLevel,
   price,exactPrice:candidate.exactCost,missingBucks:extra,
   fundedByImport,remainingProjectedBucks:balance,
   cumulativeExtraBucks:additionalBucksNeeded,
   nextLevelEffect:candidate.effect.label,
   goalResult,doubled:candidate.doubled
  });
  goalBefore=goalAfter;
 }
 return {
  goal,requestedCount:count,steps,initialBucks:initial,
  finalProjectedBucks:balance,initiallyFunded,
  additionalBucksNeeded,totalEstimatedCost,
  partialPrices:steps.some(x=>!x.exactPrice),
  initialGoal,finalGoal:goalBefore,
  stopReason
 };
}
