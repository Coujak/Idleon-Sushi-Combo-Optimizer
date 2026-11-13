// Account-aware, single-focus Sushi Doubler advice.
// Each focus shows exactly the upgrades eligible for that effect category.
// Owned Doubler counts affect assignment actions, never the number of options.
import {getUpgradeRows,getSushiDoublerCounts} from "./lab-model.mjs?v=1.19.10";

export const DOUBLER_FOCUS_OPTIONS=[
 {value:"knowledge",label:"Knowledge EXP"},
 {value:"perfecto",label:"Perfecto hunting"},
 {value:"discount",label:"Cheaper upgrades"},
 {value:"bucks",label:"Bucks generation"},
 {value:"fuel",label:"Fuel generation"},
 {value:"capacity",label:"Fuel capacity"}
];

// These upgrades have different underlying effects. The ordering is a
// hand-curated preference inside their own category, not a common score.
const focusPriority={knowledge:[38,37],perfecto:[21],discount:[36]};
const explanations={
 38:"Doubles 3rd Degree Searing's level-scaled Knowledge EXP bonus from all sources.",
 37:"Doubles 2nd Degree Searing's bonus EXP when creating Sushi.",
 21:"Doubles Bottomless Shakers' free-use chance, creating more chances to use Pepper.",
 36:"Doubles Wholesale Pricing's upgrade discount. This makes buying more upgrade levels easier, but does not grant levels."
};

export function getDoublerPlacementPlan(save,goal="knowledge"){
 if(!save)return null;
 if(!DOUBLER_FOCUS_OPTIONS.some(option=>option.value===goal))
  return {ready:false,reason:"Choose one Doubler category to view its eligible upgrades."};

 const counts=getSushiDoublerCounts(save);
 if(counts.used===null)return {ready:false,
  reason:"Doubler assignments are missing from this save. Import a full game save."};
 const focusIds=focusPriority[goal]??[];
 const focusOrder=id=>focusIds.indexOf(id);
 const upgrades=getUpgradeRows(save)
  .filter(u=>u.doublerEligible&&u.maxLevel>0&&u.goals.includes(goal))
  .sort((a,b)=>{
   // Ready-to-benefit upgrades first. Within that group, prefer the
   // specifically documented effect order, then placements and levels.
   const zeroDiff=Number(a.level<=0)-Number(b.level<=0);
   if(zeroDiff)return zeroDiff;
   const ar=focusOrder(a.id),br=focusOrder(b.id);
   if(ar>=0||br>=0){
    if(ar<0)return 1;if(br<0)return -1;
    if(ar!==br)return ar-br;
   }
   return Number(b.doubled)-Number(a.doubled)||b.level-a.level||a.shop-b.shop;
  });

 // An unknown total cannot be interpreted as zero free Doublers. Menagerie
 // totals that omit bundles/companions provide a guaranteed lower bound.
 let unusedGuaranteed=Number.isFinite(counts.available)?Math.max(0,counts.available):null;
 const recommendations=upgrades.map(u=>{
  let status;
  if(u.level<=0)status="Level first";
  else if(u.doubled)status="Keep";
  else if(unusedGuaranteed===null)status="Check availability";
  else if(unusedGuaranteed>0){status="Use available";unusedGuaranteed--;}
  else status=counts.exact?"Reassign needed":"Check / reassign";
  const reason=explanations[u.id]??(
   "Doubling this upgrade increases its level-scaled effect. Compare its benefit "+
   "with your other placements before moving a Doubler."
  );
  return {...u,status,reason};
 });
 return {ready:true,goal,counts,recommendations,
  totalOptions:recommendations.length,
  actionable:recommendations.filter(u=>u.level>0).length,
  changes:recommendations.filter(u=>u.status==="Use available").length,
  availabilityKnown:counts.available!==null};
}
