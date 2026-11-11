// Account-aware Combo Meter strategies. Search effort is determined by the
// supply/engine boundary resolution, NOT by a fixed historical tier-64 board.
// The same construction rules apply to newly released sushi tiers.
export const COMBO_SPLIT_MODE_STEPS=Object.freeze({
 simple:null,optimizer1:20,optimizer2:10,optimizer3:5,optimizer4:1
});
export function comboSplitPercentages(mode){
 if(!(mode in COMBO_SPLIT_MODE_STEPS))return [];
 const step=COMBO_SPLIT_MODE_STEPS[mode];
 if(step===null)return [];
 const result=[];
 for(let percentage=50;percentage<=99;percentage+=step)
  result.push(percentage);
 return result;
}
export function isSplitOptimizerMode(mode){
 return Object.hasOwn(COMBO_SPLIT_MODE_STEPS,mode);
}
function orderedContiguous(positions){
 if(!Array.isArray(positions))return [];
 const sorted=[...new Set(positions)].sort((a,b)=>a-b);
 if(sorted.length>100||sorted.length<2||
  sorted.some((p,i)=>!Number.isInteger(p)||p<0||p>=120||
   i>0&&p!==sorted[i-1]+1))return [];
 return sorted;
}
function safeSettings(maxTier,cap,chain,selectedBase){
 return Number.isSafeInteger(maxTier)&&maxTier>=2&&
  Number.isSafeInteger(cap)&&cap>=0&&cap<=Math.max(0,maxTier-6)&&
  Number.isSafeInteger(chain)&&chain>=0&&chain<=25&&
  Number.isSafeInteger(selectedBase)&&selectedBase>=0&&selectedBase<maxTier;
}
function pack(positions,tiers){
 const board=Array(120).fill(0);
 tiers.forEach((tier,i)=>{board[positions[i]]=tier;});
 return board;
}
// An existing protected T64 can be explicitly retained when the player has
// manually lowered the *new preparation* tier. Usually the protection is simply
// the account's current top tier, and lower-tier accounts have no such anchor.
function protectedAnchor(maxTier,protectHighest){
 return protectHighest?(maxTier>=64?maxTier:64):null;
}
function simpleCascade(positions,maxTier,cap,chain,selectedBase,protect){
 const maxIngredient=maxTier-1;
 const head=cap>0?Math.min(cap,maxIngredient):maxIngredient;
 const floor=Math.max(1,Math.min(head,selectedBase||1));
 const anchor=protectedAnchor(maxTier,protect);
 const count=positions.length-(anchor===null?0:1);
 const tiers=anchor===null?[]:[anchor];
 // One immediate pair, then straightforward descending targets, in board
 // order. After reaching the floor, start a new descending run.
 for(let i=0;i<count;i++){
  const run=i<2?0:i-1;
  const span=Math.max(1,head-floor+1);
  const tier=i<2?head:head-(run%span);
  tiers.push(Math.max(floor,Math.min(maxIngredient,tier)));
 }
 return [{
  name:"Simple · descending East Wind cascade",
  board:pack(positions,tiers),base:floor,
  shape:"simple descending cascade",
  adaptive:true,workingTier:head,
  cascadeStyle:"straight descent",splitPercent:null
 }];
}
// Each candidate uses its *own* split between reusable supplies and an
// ordered, descending multi-wave Wind engine. No historical tier arrays are
// copied or translated. More precise modes simply evaluate more boundaries.
function makeSplit(positions,maxTier,cap,chain,selectedBase,protect,pct,variant){
 const n=positions.length,anchor=protectedAnchor(maxTier,protect);
 const supplyCount=Math.max(anchor===null?1:2,
  Math.min(n-1,Math.round(n*pct/100)));
 const engineCount=n-supplyCount;
 const supplyIngredients=supplyCount-(anchor===null?0:1);
 const maxIngredient=maxTier-1;
 const floor=Math.max(1,selectedBase||1);
 const availableCap=Math.max(1,Math.min(cap,maxIngredient));
 // The peak is searched rather than assumed to be the highest unlocked tier.
 // Alternate variants change reserve reach and the staircase wave profile.
 const desiredPeak=cap>0?
  Math.max(floor,availableCap-Math.max(2,Math.round(variant===0?chain*.56:chain*.72))):
  maxIngredient;
 const peak=Math.max(1,Math.min(maxIngredient,desiredPeak));
 const unit=Math.max(2,Math.min(26,chain+1,Math.max(2,peak-floor+2)));
 // No stage can use more cells than its engine portion.
 const stages=cap>0&&chain>0?
  Math.max(1,Math.min(3,Math.ceil(engineCount/unit))):1;
 const stageSizes=Array.from({length:stages},(_,j)=>
  Math.floor(engineCount/stages)+(j<engineCount%stages?1:0));
 const stagePeaks=stageSizes.map((_,j)=>
  Math.max(floor,peak-(j===0?0:Math.max(1,Math.round(chain*(variant===0?.32:.4)))+(j-1))));
 const engine=[];
 for(let j=0;j<stages;j++){
  for(let k=0;k<stageSizes[j];k++){
   const step=j===0?Math.max(0,k-1):k;
   engine.push(Math.max(floor,stagePeaks[j]-step));
  }
 }
 // Supplies feed future merge anchors, not just the first cascade.
 // Descending order keeps this section straightforward to prepare.
 const upper=Math.min(maxIngredient,Math.max(peak,
  cap>0?cap-Math.max(1,variant===0?2:4):maxIngredient));
 const lower=Math.max(floor,Math.min(peak,stagePeaks.at(-1)-Math.max(0,variant)));
 const supply=[];
 for(let i=0;i<supplyIngredients;i++){
  const progress=supplyIngredients<=1?0:i/(supplyIngredients-1);
  supply.push(Math.max(1,Math.min(maxIngredient,
   upper-Math.floor((upper-lower)*progress))));
 }
 supply.sort((a,b)=>b-a);
 const tiers=[...(anchor===null?[]:[anchor]),...supply,...engine];
 if(tiers.length!==n||tiers.some((tier,i)=>!Number.isInteger(tier)||tier<1||
  (anchor!==null&&i===0?tier!==anchor:tier>maxIngredient)))return null;
 return {
  name:"Optimizer split "+pct+"/"+(100-pct)+" · "+(variant===0?"balanced":"deep")+" reserves",
  board:pack(positions,tiers),base:floor,shape:"adaptive split "+pct+"/"+(100-pct),
  splitPercent:pct,supplyCount,engineCount,
  variant:variant===0?"balanced":"deep",
  workingTier:peak,adaptive:true,
  strategySections:{
   protectedPosition:anchor===null?null:positions[0],
   enginePositions:positions.slice(supplyCount)
  }
 };
}
export function buildSplitComboCandidates(positions,maxTier,cap,chainLimit=25,
 selectedBase=0,protectHighest=maxTier>=64,mode="optimizer1"){
 const sorted=orderedContiguous(positions);
 if(!sorted.length||!safeSettings(maxTier,cap,chainLimit,selectedBase)||
    !isSplitOptimizerMode(mode))return [];
 if(mode==="simple")
  return simpleCascade(sorted,maxTier,cap,chainLimit,selectedBase,protectHighest);
 const candidates=[];
 for(const percentage of comboSplitPercentages(mode)){
  for(let variant=0;variant<2;variant++){
   const candidate=makeSplit(sorted,maxTier,cap,chainLimit,
    selectedBase,protectHighest,percentage,variant);
   if(candidate)candidates.push(candidate);
  }
 }
 return candidates;
}
