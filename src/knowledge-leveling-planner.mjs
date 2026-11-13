// Goal-focused Sushi Knowledge recommendations. This models next-level bonuses and
// EXP gaps already known from the imported account; it does not infer EXP/hour.
export const KNOWLEDGE_LEVELING_GOALS=[
 {category:1,label:"Knowledge EXP"},
 {category:10,label:"Perfecto chance"},
 {category:0,label:"Sushi Bucks"},
 {category:4,label:"Fuel generation (%)"},
 {category:7,label:"Fuel generation multiplier"},
 {category:3,label:"Fuel capacity"},
 {category:2,label:"Cooking tier-up chance"},
 {category:6,label:"Upgrade discounts"},
 {category:5,label:"Free Shaker uses"},
 {category:8,label:"Slot effects"},
 {category:9,label:"Fireplace effects"}
];
export const KNOWLEDGE_LEVELING_ORDERS=[
 {value:"efficiency",label:"Most bonus per remaining EXP"},
 {value:"closest",label:"Closest to next level"},
 {value:"gain",label:"Largest next-level bonus"}
];
export function normalizeKnowledgeLevelingOptions(raw={}){
 const state=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw:{};
 const category=Number(state.category);
 const order=KNOWLEDGE_LEVELING_ORDERS.some(x=>x.value===state.order)?
  state.order:"efficiency";
 return {
  category:KNOWLEDGE_LEVELING_GOALS.some(x=>x.category===category)?
   category:1,
  order
 };
}
export function planKnowledgeLeveling(rows,options={}){
 const {category,order}=normalizeKnowledgeLevelingOptions(options);
 if(!Array.isArray(rows))return [];
 const result=rows.filter(r=>
  r&&r.category===category&&r.discovered&&r.levelKnown&&r.xpKnown&&
  r.mapped&&Number.isFinite(r.level)&&Number.isFinite(r.xp)&&
  Number.isFinite(r.xpReq)&&r.xpReq>0&&
  Number.isFinite(r.xpRemaining)&&r.xpRemaining>=0&&
  Number.isFinite(r.bonus)&&Number.isFinite(r.nextLevelGain)&&r.nextLevelGain>0)
 .map(r=>({
  ...r,
  targetLevel:r.level+1,
  nextBonus:r.bonus+r.nextLevelGain,
  remainingExp:r.xpRemaining,
  gainPerRemainingExp:r.nextLevelGain/Math.max(1,r.xpRemaining),
  ready:!!r.readyToLevel
 }));
 const compare=(a,b)=>{
  // A level that is already ready can be claimed now, without EXP farming.
  const readyDiff=Number(b.ready)-Number(a.ready);
  if(readyDiff)return readyDiff;
  let sort=0;
  if(order==="closest")sort=a.remainingExp-b.remainingExp;
  else if(order==="gain")sort=b.nextLevelGain-a.nextLevelGain;
  else sort=b.gainPerRemainingExp-a.gainPerRemainingExp;
  // Tie-break by nearest EXP then Sushi tier; do not confuse different bonus units.
  return sort||a.remainingExp-b.remainingExp||a.tier-b.tier;
 };
 return result.sort(compare);
}
