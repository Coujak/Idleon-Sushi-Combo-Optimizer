// Account-aware, single-focus Sushi Doubler advice.
// Each focus shows exactly the upgrades eligible for that effect category.
// Owned Doubler counts affect assignment actions, never the number of options.
import {getUpgradeRows,getSushiDoublerCounts,numberText} from "./lab-model.mjs?v=1.19.10";

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

// Compare an upgrade's level-scaled effect without and with a Doubler.
// Most upgrades also have independent multipliers or special effects: these
// figures show only the directly doubled component, not an estimated total.
export function getDoublerValueComparison(upgrade){
 const level=Math.max(0,Number(upgrade?.level)||0);
 const perLevel=Math.max(0,Number(upgrade?.perLevel)||0);
 const base=level*perLevel;
 const boosted=base*2;
 const format=numberText;
 if(upgrade?.id===36){
  // Wholesale Pricing reduces prices by 1/(1+bonus/100), not by
  // subtracting the displayed bonus directly from the price.
  const reduction=value=>100*(1-1/(1+value/100));
  return {
   normal:format(reduction(base))+"%",
   doubled:format(reduction(boosted))+"%",
   label:"Cost reduction from Wholesale Pricing",
   note:"Actual reduction from this upgrade alone. Other discounts stack separately."
  };
 }
 if(upgrade?.id===40){
  // No Tax on Tips uses an additional factor, not a raw percent label.
  return {normal:"+"+format(base/100)+"×",doubled:"+"+format(boosted/100)+"×",
   label:"Extra Bucks multiplier factor",
   note:"This is the added multiplier component before other bonuses."};
 }
 const percent=String(upgrade?.description??"").includes("{%");
 const suffix=percent?"%":upgrade?.id===37?" EXP":"";
 const label=upgrade?.id===37?"Extra EXP per created Sushi":
  upgrade?.id===38?"Knowledge EXP bonus":
  upgrade?.id===21?"Free Shaker-use chance":
  percent?"Level-scaled percentage bonus":"Level-scaled bonus";
 return {normal:"+"+format(base)+suffix,doubled:"+"+format(boosted)+suffix,
  label,note:"Level-scaled effect only; other game modifiers are not included."};
}

export function getDoublerPlacementPlan(save,goal="knowledge"){
 if(!save)return null;
 // Each tag filters an independent category. Combine only the matching
 // upgrade lists; never turn this into a mixed-effect scoring category.
 const selected=Array.isArray(goal)?goal:[goal];
 const valid=DOUBLER_FOCUS_OPTIONS.map(option=>option.value);
 const goals=[...new Set(selected.filter(id=>valid.includes(id)))];
 if(!goals.length)return {ready:false,reason:"Add a category to see Doubler-eligible upgrades."};

 const counts=getSushiDoublerCounts(save);
 if(counts.used===null)return {ready:false,
  reason:"Doubler assignments are missing from this save. Import a full game save."};
 const categoryRank=u=>goals.findIndex(id=>u.goals.includes(id));
 const focusOrder=(u)=>{
  const category=goals[categoryRank(u)];
  return (focusPriority[category]??[]).indexOf(u.id);
 };
 const upgrades=getUpgradeRows(save)
  .filter(u=>u.doublerEligible&&u.maxLevel>0&&goals.some(id=>u.goals.includes(id)))
  .sort((a,b)=>{
   // Group each explicitly selected category together in tag order.
   // Within each category, keep the known effect preferences, then
   // active Doubler assignments. Never compare unlike raw effect units.
   const groupDiff=categoryRank(a)-categoryRank(b);
   if(groupDiff)return groupDiff;
   const zeroDiff=Number(a.level<=0)-Number(b.level<=0);
   if(zeroDiff)return zeroDiff;
   const ar=focusOrder(a),br=focusOrder(b);
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
 return {ready:true,goal,goals,counts,recommendations,
  totalOptions:recommendations.length,
  actionable:recommendations.filter(u=>u.level>0).length,
  changes:recommendations.filter(u=>u.status==="Use available").length,
  availabilityKnown:counts.available!==null};
}
