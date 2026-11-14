// Passive Sushi Knowledge: Cold -> every lower tier; Milktoast -> occupant.
// A pink fireplace multiplies EXP at the source plate, not at the recipients.
// All output is a conceptual board recommendation; importing or moving plates
// requires user action and is never silently applied to the replay board.
const TIERS=64;
const VALID=120;
const finite=x=>Number.isFinite(x);
const positive=(x,defaultValue)=>finite(Number(x))&&Number(x)>0?Number(x):defaultValue;
const occupied=(board,i)=>Number.isInteger(board[i])&&board[i]>0&&board[i]<=TIERS;
const enabled=(slots,i)=>Number.isInteger(slots[i])&&slots[i]>=0&&slots[i]<=3;
const count=(arr,value)=>arr.filter(x=>x===value).length;

export function projectPassiveKnowledge(board,slots,fires,options={}){
 if(!Array.isArray(board)||!Array.isArray(slots)||!Array.isArray(fires)||
  board.length!==VALID||slots.length!==VALID||fires.length!==15)
  throw Error("Passive Sushi Knowledge expects 120 cells and 15 fireplaces");
 const multiplier=positive(options.globalMultiplier,1);
 const lithium=options.lithiumUnlocked===true?positive(options.lithiumMultiplier,2):1;
 const coldBase=positive(options.coldBase,0.2);
 const milkBase=positive(options.milktoastBase,1);
 const expPerDay=Array(TIERS+1).fill(0),sources=[];
 for(let i=0;i<VALID;i++){
  if(!enabled(slots,i)||!occupied(board,i))continue;
  const tier=board[i],plate=slots[i];
  if(plate!==2&&plate!==3)continue;
  const pink=fires[i%15]===3&&options.lithiumUnlocked===true;
  const factor=multiplier*(pink?lithium:1);
  const amount=(plate===2?coldBase:milkBase)*factor;
  if(plate===2){
   for(let t=1;t<tier;t++)expPerDay[t]+=amount;
  }else expPerDay[tier]+=amount;
  sources.push({at:i,tier,plate,kind:plate===2?"cold":"milktoast",pink,
   dailyAmount:amount,affected:plate===2?tier-1:1});
 }
 const covered=expPerDay.slice(1).filter(n=>n>0).length;
 return {expPerDay,sources,covered,uncovered:expPerDay.flatMap((n,t)=>
  t>=1&&t<=TIERS&&n<=0?[t]:[]),
  totalDaily:expPerDay.slice(1).reduce((a,n)=>a+n,0),
  coldSources:sources.filter(x=>x.plate===2).length,
  milktoastSources:sources.filter(x=>x.plate===3).length,
  lithiumMultiplier:lithium,globalMultiplier:multiplier};
}

// Construct an *aspirational* passive placement, using only Sushi already
// on the board and the exact existing counts of special plates. Recommended
// placement is NOT assumed possible without manually moving the plate types.
// The final selected cold/milktoast positions are a recommendation, not a
// change to the imported board or the optimizer's simulation state.
export function recommendPassiveKnowledgeLayout(board,slots,fires,{targetTier=null,...options}={}){
 const current=projectPassiveKnowledge(board,slots,fires,options);
 const coldCount=count(slots,2),milkCount=count(slots,3);
 const occupiedPositions=board.flatMap((tier,i)=>enabled(slots,i)&&occupied(board,i)?[i]:[]);
 const pinkBonus=i=>fires[i%15]===3&&options.lithiumUnlocked===true?2:1;
 const tierOrder=(a,b)=>board[b]-board[a]||pinkBonus(b)-pinkBonus(a)||a-b;
 const ranked=occupiedPositions.slice().sort(tierOrder);
 const chosenCold=ranked.slice(0,Math.min(coldCount,ranked.length));
 const used=new Set(chosenCold);
 const available=occupiedPositions.filter(i=>!used.has(i));
 const prioritized=available.slice().sort((a,b)=>{
  const tierA=board[a],tierB=board[b];
  // A second T64 makes all 64 tiers passively reachable. Above that,
  // keep the selected Focused tier on Milktoast for its own +1 EXP/day.
  const rating=t=>(t===64?1e6:0)+(t===targetTier?5e5:0)+t*100;
  return rating(tierB)-rating(tierA)||pinkBonus(b)-pinkBonus(a)||a-b;
 });
 const chosenMilk=prioritized.slice(0,Math.min(milkCount,prioritized.length));
 // Place unused special slots on the other positions without changing counts.
 const recommended=slots.slice();
 const targets=new Map([...chosenCold.map(i=>[i,2]),...chosenMilk.map(i=>[i,3])]);
 const swaps=[];
 for(const [at,type] of targets){
  if(recommended[at]===type)continue;
  // Borrow from an unassigned plate first; if both desired plate pools
  // overlap, exchange with a target requesting our current plate type.
  const old=recommended[at];
  let spare=recommended.findIndex((v,i)=>v===type&&!targets.has(i));
  if(spare<0)spare=recommended.findIndex((v,i)=>
   v===type&&targets.has(i)&&targets.get(i)!==type&&
   targets.get(i)===old);
  if(spare<0)spare=recommended.findIndex((v,i)=>
   v===type&&targets.has(i)&&targets.get(i)!==type);
  if(spare<0)continue;
  recommended[at]=type;recommended[spare]=old;
  swaps.push({from:spare,to:at,plate:type,replaced:old});
 }
 const estimated=projectPassiveKnowledge(board,recommended,fires,options);
 const allTargetsCorrect=[...targets].every(([at,type])=>recommended[at]===type);
 return {
  current,recommended:estimated,
  recommendedSlots:recommended,
  plateSwaps:swaps,allTargetsCorrect,
  coldPositions:chosenCold,milktoastPositions:chosenMilk,
  usesSecondT64:chosenCold.some(i=>board[i]===64)&&chosenMilk.some(i=>board[i]===64),
  needAnotherT64:chosenCold.some(i=>board[i]===64)&&!chosenMilk.some(i=>board[i]===64),
  // Advisory only. No plate rearrangement is part of the legal Sushi replay.
  note:"Suggested special-plate placements require manual Movement Mittens setup. EXP/day is based on the listed base Plate effects, known global Knowledge bonuses and Lithium; other unknown modifiers are excluded."
 };
}

export function passiveProtectedIndices(board,slots,{focused=false,targetTier=null}={}){
 const t=Number(targetTier);
 // In a hybrid rotation, never consume occupied Cold/Milktoast Sushi;
 // the existing passive income remains stable while the workspace merges.
 // This also protects a T58 stored on Milktoast in focused mode.
 return board.flatMap((tier,i)=>enabled(slots,i)&&occupied(board,i)&&
  (slots[i]===2||slots[i]===3)?[i]:[]);
}
