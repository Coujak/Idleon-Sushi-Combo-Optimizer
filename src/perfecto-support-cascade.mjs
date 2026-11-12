// Verified long-cascade option for the supporting Perfecto staircase.
// Before: [T(H-1),T(H-1),T(H-2),...,T(L)] on W support slots.
// Wind merge of the first two upgrades the entire descending tail:
// [empty,T(H),T(H-1),...,T(L+1)].
// Move each upgraded sushi one slot west and directly cook T(L) at the end.
// This consumes no Salt, respects the 25-step Wind cap, and permits the
// target in the adjacent construction cell to remain untouched.
import {certifiedWindTierRecipe} from "./perfecto-wind-certificate.mjs?v=1.21.1";
import {sushiDirectCookFuel} from "./perfecto-fuel.mjs?v=1.16.6";

export function certifiedPerfectoSupportCascade(sourceTier,finalTiers,windCap){
 const source=Number(sourceTier),cap=Number(windCap);
 const tiers=Array.from(finalTiers??[],Number),count=tiers.length;
 if(!Number.isInteger(source)||source<1||source>46||
    !Number.isInteger(cap)||cap<1||cap>58||
    count<3||count>27)return null; // tail length <=25
 const high=tiers[0],low=tiers.at(-1);
 if(high-1>cap||low>source||
    tiers.some((tier,i)=>!Number.isInteger(tier)||tier!==high-i||
     tier<1||tier>=64))return null;
 const inputTiers=[high-1,high-1,
  ...Array.from({length:count-2},(_,i)=>high-2-i)];
 if(inputTiers.some(tier=>tier<1||tier>63))return null;
 const ingredients=[];
 let fuel=0,cooks=0n,merges=0n,winds=0n;
 for(let i=0;i<inputTiers.length;i++){
  const tier=inputTiers[i],direct=tier<=source;
  let recipe=null;
  if(!direct){
   recipe=certifiedWindTierRecipe(source,tier,cap);
   // Already positioned higher-tier ingredients cannot be disturbed while
   // constructing this one. This is a hard, physical workspace bound.
   if(recipe.workspaceSlots>count-i)return null;
  }
  const ingredientCost=sushiDirectCookFuel(direct?tier:source);
  if(!Number.isFinite(ingredientCost))return null;
  const units=recipe?BigInt(recipe.cooksExact):1n;
  cooks+=units;merges+=recipe?BigInt(recipe.mergesExact):0n;
  winds+=recipe?BigInt(recipe.windEventsExact):0n;
  fuel+=Number(units)*ingredientCost;
  ingredients.push({tier,direct,workspaceSlots:recipe?.workspaceSlots??1});
 }
 const finalCookCost=sushiDirectCookFuel(low);
 if(!Number.isFinite(finalCookCost))return null;
 fuel+=finalCookCost;cooks++;
 merges++; // Wind-triggering merge consumes one of the two trigger sushi.
 winds+=BigInt(count-2); // Exact descending eastward cascade length.
 if(!Number.isFinite(fuel))return null;
 return {
  triggerTier:high-1,windChainLength:count-2,
  ingredientTiers:inputTiers,ingredients,finalCookTier:low,
  totalFuel:fuel,cooksExact:cooks.toString(),
  mergesExact:merges.toString(),windEventsExact:winds.toString(),
  rearrangementMoves:count-1,
  description:"Prepare two T"+(high-1)+" triggers and a descending tail, "+
   "trigger "+(count-2)+" Wind upgrades at once, shift the result west, "+
   "then cook the bottom T"+low+" into the last free cell."
 };
}
