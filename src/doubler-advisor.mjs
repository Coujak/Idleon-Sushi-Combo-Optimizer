// Account-aware Sushi Doubler placement advice. This models only the
// immediate effect of doubling an existing upgrade's level-scaled bonus.
// It does not grant levels, spend Doublers, or compare unrelated units.
import {getUpgradeRows,getSushiDoublerCounts} from "./lab-model.mjs?v=1.19.10";

export const DOUBLER_FOCUS_OPTIONS=[
 {value:"priorities",label:"Knowledge → Perfecto → More upgrades"},
 {value:"all",label:"Keep current assignments first"},
 {value:"knowledge",label:"Knowledge EXP"},
 {value:"perfecto",label:"Perfecto hunting"},
 {value:"discount",label:"Cheaper upgrades"},
 {value:"bucks",label:"Bucks generation"},
 {value:"fuel",label:"Fuel generation"},
 {value:"capacity",label:"Fuel capacity"}
];

// Relative ranking is intentional, not an invented common score.
// Knowledge EXP from all sources is generally broader than newly-created
// Sushi EXP; a free Shaker use supports Perfecto chances; cheaper upgrades
// support acquiring more levels (the Doubler itself adds no levels).
const priorityIds=[38,37,21,36];
const explanations={
 38:"Doubles 3rd Degree Searing's level-scaled bonus to Knowledge EXP from all sources.",
 37:"Doubles 2nd Degree Searing's extra EXP when Sushi are created.",
 21:"Doubles Bottomless Shakers' per-level free-use chance; more Pepper opportunities can help hunt Perfectos.",
 36:"Doubles Wholesale Pricing's per-level discount effect, helping buy more upgrade levels over time."
};
const goalPriority={
 knowledge:[38,37],perfecto:[21],discount:[36]
};
export function getDoublerPlacementPlan(save,goal="priorities"){
 if(!save)return null;
 const all=getUpgradeRows(save).filter(u=>u.doublerEligible&&u.maxLevel>0);
 const assignments=all.filter(u=>u.doubled);
 const count=getSushiDoublerCounts(save);
 if(count.used===null)return {ready:false,
  reason:"Assigned Doubler positions are missing from this save. Import a full game save to plan a reassignment."};
 const available=count.available;
 const supported=available!==null;
 const slots=Math.min(all.length,count.used+(supported?available:0));
 const eligible=all.filter(u=>u.level>0);
 const focus=goalPriority[goal]??[];
 const preferred=goal==="priorities"?priorityIds:
  goal==="all"?[]:[...focus,...all.filter(u=>u.goals.includes(goal)).map(u=>u.id)];
 const preferenceIndex=id=>preferred.indexOf(id);
 // Rank preferred effects first. For other effects, keep established
 // placements stable rather than pretending different game stats are equal.
 const ranked=eligible.slice().sort((a,b)=>{
  const ar=preferenceIndex(a.id),br=preferenceIndex(b.id);
  if(ar>=0||br>=0){
   if(ar<0)return 1;if(br<0)return -1;
   if(ar!==br)return ar-br;
  }
  return Number(b.doubled)-Number(a.doubled)||b.level-a.level||a.shop-b.shop;
 });
 const target=ranked.slice(0,slots);
 const selected=new Set(target.map(u=>u.id));
 const removed=assignments.filter(u=>!selected.has(u.id));
 const free=Math.max(0,available??0);
 let newlyAssigned=0;
 const recommendations=target.map(u=>{
  let status="Keep",from=null;
  if(!u.doubled){
   if(newlyAssigned<free)status="Use available";
   else{status="Move Doubler";from=removed.shift()?.name??null;}
   newlyAssigned++;
  }
  return {...u,status,from,
   reason:explanations[u.id]??(u.doubled?
    "Keep an existing Doubler here until a higher-priority benefit is available.":
    "Useful with current upgrade levels; this effect is not directly comparable to other categories.")};
 });
 return {ready:true,goal,counts:count,recommendations,
  assignments,availableKnown:supported,slotCount:slots,
  changes:recommendations.filter(u=>u.status!=="Keep").length,
  undecided:Math.max(0,slots-recommendations.length)};
}
