// Perfecto board search: resource-bounded *recipes*, not time- or pace-bounded.
// The user sees only the best final board. All new target sushi come from
// actual 2-to-1 merges (including verified Heat of the East Wind events).
// Starting sushi > cooked tier must be prepared normally; their exponentially
// larger ingredient cost is charged against the shared recipe budget.
import {simulateMerge} from "./optimizer-core.mjs";
import {sushiDirectCookFuel,affordableSushiCookingTiers} from "./perfecto-fuel.mjs?v=1.16.6";
import {certifiedWindTierRecipe} from "./perfecto-wind-certificate.mjs?v=1.21.1";
import {certifiedPerfectoSupportCascade} from "./perfecto-support-cascade.mjs?v=1.27.0";

const N=120;
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const read=(arr,i,fallback=-1)=>Number.isInteger(Number(arr?.[i]))?Number(arr[i]):fallback;
const sourceWeight=(tier,reference)=>Math.pow(2,tier-reference);
export function getSushiWindCap(save){
 const upgrades=save?.sushi?.[2]??[];
 if(read(upgrades,29,0)<1)return 0;
 const tracking=save?.sushi?.[5]??[];
 let discovered=0;
 for(const v of tracking){if(Number(v)<0)break;discovered++;}
 return clamp(discovered-6,0,58);
}
function geometry(save,target){
 const slots=Array.from({length:N},(_,i)=>read(save?.slots,i,-1));
 const tiles=Array.from({length:N},(_,i)=>slots[i]<0?0:read(save?.tiles,i,-1)+1);
 const frozen=new Set(),flex=[];
 for(let i=0;i<N;i++){
  if(slots[i]<0)continue;
  if(tiles[i]>=target)frozen.add(i);
  else flex.push(i);
 }
 const fixedTargets=tiles.filter((t,i)=>slots[i]>=0&&t===target).length;
 const protectedCount=[...frozen].filter(i=>tiles[i]>target).length;
 let longestRun=0,currentRun=0,previous=-2;
 for(const pos of flex){
  currentRun=pos===previous+1?currentRun+1:1;
  longestRun=Math.max(longestRun,currentRun);
  previous=pos;
 }
 let bestChain=0;
 for(const dst of flex){
  if(!flex.some(i=>i<dst))continue;
  let k=0;while(k<25&&flex.includes(dst+1+k))k++;
  bestChain=Math.max(bestChain,k);
 }
 return {slots,tiles,flex,frozen,fixedTargets,protectedCount,bestChain,longestRun};
}
function maxCookableTier(economy,target){
 if(!economy)return 1;
 let best=1;
 const upper=Math.min(target,Math.max(1,Math.round(economy.maxCookTier??1)));
 for(let t=1;t<=upper;t++){
  const cost=sushiDirectCookFuel(t);
  if(cost!==null&&cost<=economy.capacity&&economy.generationPerHour>0)best=t;
 }
 return best;
}
function countFlex(geom,board){
 const c=new Int32Array(65);
 for(const i of geom.flex)if(board[i]>0&&board[i]<=64)c[board[i]]++;
 return c;
}
function recipeBoard(geom,target,ref,seed,recipe,budget,windCap){
 const board=geom.tiles.slice(),positions=geom.flex;
 // In this planner, original lower sushi can be rearranged or replaced.
 // Preserve only target and higher-tier sushi. Existing input also provides
 // an alternative recipe with no need to recreate the owned low sushi.
 let spent=0;
 if(recipe==="existing"){
  for(const i of positions)if(board[i]<0||board[i]>target)board[i]=0;
  for(const i of positions){
   if(board[i]>0)continue;
   const cost=sourceWeight(seed,ref);
   if(spent+cost>budget)break;
   board[i]=seed;spent+=cost;
  }
  return {board,spent};
 }
 for(const i of positions)board[i]=0;
 const entries=[];
 if(recipe==="ladder"||recipe==="double-ladder"){
  const top=Math.min(windCap,target-1,seed+7);
  const reps=recipe==="double-ladder"?2:1;
  if(top>seed)for(let cycle=0;cycle<reps;cycle++){
   entries.push(top,top,top);
   for(let t=top-1;t>=seed;t--)entries.push(t);
  }
 }else if(recipe==="high-pair"){
  const top=Math.min(target-1,seed+7);
  if(top>seed)entries.push(top,top,Math.max(seed,top-1),Math.max(seed,top-1));
 }else if(recipe==="apex"){
  // A single buildable high-tier anchor can accelerate progress.
  const high=Math.min(target-1,seed+8);
  if(high>seed)entries.push(high);
 }
 // Only commit advanced ingredients if the *entire* proposed setup fits.
 const minCost=positions.length*sourceWeight(seed,ref);
 const recipeCost=entries.reduce((sum,t)=>sum+sourceWeight(t,ref)-sourceWeight(seed,ref),0);
 if(minCost+recipeCost>budget)entries.length=0;
 for(let j=0;j<positions.length;j++){
  const tier=entries[j]??seed;
  board[positions[j]]=tier;
  spent+=sourceWeight(tier,ref);
 }
 return {board,spent};
}
function availableActionPositions(geom,chainLen){
 if(chainLen===0&&geom.flex.length>=2)return {src:geom.flex[0],dst:geom.flex[geom.flex.length-1]};
 let candidates=null;
 for(const dst of geom.flex){
  let source=-1;
  for(const i of geom.flex){if(i<dst){source=i;break;}}
  if(source<0)continue;
  let valid=true;
  for(let j=1;j<=chainLen;j++)if(!geom.flex.includes(dst+j)){valid=false;break;}
  if(!valid)continue;
  candidates={src:source,dst};break;
 }
 if(candidates)return candidates;
 if(chainLen>0)return null;
 if(geom.flex.length<2)return null;
 return {src:geom.flex[1],dst:geom.flex[0]}; // non-Wind merge
}
function possibleMoves(counts,geom,target,windCap,reference,mode){
 const moves=[];
 const maxChain=geom.bestChain;
 for(let tier=1;tier<target;tier++){
  if(counts[tier]<2)continue;
  const firsts=[-1];
  if(tier<=windCap&&maxChain>0){
   // The first Wind target may share the trigger's tier. Every subsequent
   // target must descend exactly one tier, as in the canonical simulator.
   for(let first=tier;first>=Math.max(1,tier-3);first--){
    if(counts[first]-(first===tier?2:0)>0)firsts.push(first);
   }
  }
  for(const first of firsts){
   const chain=[];
   if(first>0){
    for(let k=first;k>=1&&chain.length<maxChain;k--){
     if(counts[k]-(k===tier?2:0)<1)break;
     chain.push(k);
    }
   }
   const windGain=chain.reduce((sum,t)=>sum+sourceWeight(t,reference),0);
   const climb=sourceWeight(tier,reference);
   const hit=tier+1===target;
   let score=(hit?1e9:0);
   if(mode===0)score+=windGain*2+climb*.3+chain.length*.01;
   else if(mode===1)score+=windGain*.8+climb*1.1+chain.length*.1;
   else if(mode===2)score+=windGain*4+climb*.07+chain.length*.2;
   else score+=windGain*1.4+climb*.7+chain.length*.4;
   if(first===-1&&tier<=windCap)score-=climb*.2;
   moves.push({tier,chain,score,hit,windGain});
  }
 }
 return moves.sort((a,b)=>b.score-a.score||b.tier-a.tier||b.chain.length-a.chain.length);
}
function arrangeAndMerge(state,geom,move,windCap,target){
 const {tier,chain}=move;
 const loc=availableActionPositions(geom,chain.length);
 if(!loc)return null;
 const source=loc.src,dest=loc.dst;
 const rest=state.counts.slice();
 rest[tier]-=2;
 for(const t of chain)rest[t]--;
 if(rest.some(c=>c<0))return null;
 const board=geom.tiles.slice();
 for(const i of geom.flex)board[i]=0;
 board[source]=tier;board[dest]=tier;
 chain.forEach((t,j)=>{board[dest+j+1]=t;});
 const reserved=new Set([source,dest,...chain.map((_,j)=>dest+j+1)]);
 const others=geom.flex.filter(i=>!reserved.has(i));
 // Keep remaining sushi, including remainders, in descending order.
 let k=0;
 for(let t=target;t>=1;t--)for(let n=0;n<rest[t];n++){
  if(k>=others.length)return null;
  board[others[k++]]=t;
 }
 const trial=simulateMerge(board,source,dest,windCap,25,target);
 if(!trial)return null;
 for(const i of geom.frozen)if(trial.board[i]!==geom.tiles[i])return null;
 return {
  counts:countFlex(geom,trial.board),
  wind:trial.events.filter(x=>x.kind==="wind").length,
  target:trial.board.filter((v,i)=>v===target&&geom.flex.includes(i)).length,
  merges:state.merges+1,
  spent:state.spent,
  board:trial.board
 };
}
function addSeedCopies(state,geom,seed,reference,budget){
 const available=Math.floor((budget-state.spent)/sourceWeight(seed,reference)+1e-9);
 if(available<=0)return state;
 const c=state.counts;
 let occupied=0;
 for(let t=1;t<c.length;t++)occupied+=c[t];
 const free=Math.max(0,geom.flex.length-occupied);
 const count=Math.min(free,available);
 if(count<=0)return state;
 c[seed]+=count;
 state.spent+=count*sourceWeight(seed,reference);
 return state;
}
function finalBoard(state,geom,target){
 const board=geom.tiles.slice();
 for(const i of geom.flex)board[i]=0;
 const rest=state.counts.slice();
 let p=0;
 // Place created targets together, then the remaining high-tier inventory
 // in descending order for an easier final board to replicate.
 for(let t=target;t>=1;t--)for(let j=0;j<rest[t];j++){
  if(p>=geom.flex.length)throw Error("Simulation exceeds unlocked slots");
  board[geom.flex[p++]]=t;
 }
 return board;
}
function scoreState(state,geom){
 return {target:state.target+geom.fixedTargets,
  merges:state.merges,wind:state.wind,spent:state.spent};
}
function better(a,b){
 if(!a)return true;
 if(b.target!==a.target)return b.target>a.target;
 if(b.spent!==a.spent)return b.spent<a.spent;
 if(b.merges!==a.merges)return b.merges<a.merges;
 return b.wind>a.wind;
}
function runRecipe(geom,target,reference,seed,recipe,mode,windCap,budget,stepLimit){
 const setup=recipeBoard(geom,target,reference,seed,recipe,budget,windCap);
 let state={
  counts:countFlex(geom,setup.board),
  spent:setup.spent,
  merges:0,wind:0,target:0
 };
 const initialSpent=state.spent;
 let best=null;
 // One cycle costs a bounded number of prepared sushi, not a user's time.
 // This prevents the meaningless "infinite fuel => 99 target copies" answer.
 for(let step=0;step<stepLimit;step++){
  const possibilities=possibleMoves(state.counts,geom,target,windCap,reference,mode);
  let result=null;
  for(const choice of possibilities.slice(0,4)){
   result=arrangeAndMerge(state,geom,choice,windCap,target);
   if(result)break;
  }
  if(!result)break;
  result.wind=state.wind+result.wind;
  state=addSeedCopies(result,geom,seed,reference,budget);
  const metric=scoreState(state,geom);
  if(better(best?.metric,metric)){
   best={metric,counts:state.counts.slice(),spent:state.spent,
    merges:state.merges,wind:state.wind,target:state.target};
  }
  if(metric.target>=geom.flex.length+geom.fixedTargets)break;
 }
 if(!best){
  const metric=scoreState(state,geom);
  best={metric,counts:state.counts.slice(),spent:state.spent,
   merges:state.merges,wind:state.wind,target:state.target};
 }
 return {
  ...best,sourceTier:seed,referenceTier:reference,recipe,mode,
  initialSpent,budget,seedEquivalentUsed:best.spent,
  board:finalBoard(best,geom,target)
 };
}
// Exact constructive lower bound, not a painted/invented board:
// Cook source-tier sushi into free positions, recursively merge pairs
// westwards (to avoid unintended Wind), and retain each completed target.
// One active construction requires only (target-source+1) free slots.
// The recursion is a compact certificate, not an infeasible 2^depth replay.
export function certifiedCarryBoard(geom,target,economy,windCap=0){
 let best=null;
 const fuelPerHour=Number(economy?.generationPerHour)||0;
 for(const source of affordableSushiCookingTiers(economy,target)){
  const proposed=certifiedWindTierRecipe(source.tier,target,windCap);
  // The recursive Wind proof requires a contiguous working area. If this
  // account has scattered locked/protected cells, use ordinary merges instead.
  const recipe=proposed.usesWind&&geom.longestRun<proposed.workspaceSlots?
   certifiedWindTierRecipe(source.tier,target,0):proposed;
  const workspace=recipe.workspaceSlots;
  const copies=source.tier===target?geom.flex.length:
   Math.max(0,geom.flex.length-(workspace-1));
  if(copies<1)continue;
  const cooks=BigInt(copies)*BigInt(recipe.cooksExact);
  const merges=BigInt(copies)*BigInt(recipe.mergesExact);
  const wind=BigInt(copies)*BigInt(recipe.windEventsExact);
  const estimatedFuel=Number(cooks)*source.cost;
  const fuelHours=fuelPerHour>0?estimatedFuel/fuelPerHour:Infinity;
  const candidate={
   metric:{target:geom.fixedTargets+copies,spent:estimatedFuel,merges:Number(merges),wind:Number(wind)},
   target:copies,sourceTier:source.tier,recipe:recipe.usesWind?"certified-wind-carry":"certified-carry",mode:"exact",
   board:geom.tiles.map((value,i)=>geom.frozen.has(i)?value:geom.slots[i]>=0?0:value),
   spent:estimatedFuel,merges:Number(merges),wind:Number(wind),
   certificate:{type:recipe.usesWind?"recursive-east-wind-carry":"recursive-westward-carry",
    startingTier:source.tier,targetTier:target,
    finalCopies:copies,workspaceSlots:workspace,cooksExact:cooks.toString(),
    mergesExact:merges.toString(),windEventsExact:wind.toString(),
    cooksPerCopyExact:recipe.cooksExact,stages:recipe.stages,
     windStages:recipe.stages.filter(stage=>stage.wind),
    normalStages:recipe.stages.filter(stage=>!stage.wind),
    estimatedFuel,generationHours:fuelHours,capacityShare:source.share,
    proof:recipe.usesWind?
     "For each +2 tier stage eligible for Wind, build three equal-tier sushi in adjacent cells. Merge left to middle to trigger one Wind upgrade of the right sushi; merge right to middle and move the new result to the free left cell. For remaining tiers, merge right to left normally. Recursively repeat, storing completed targets outside the working area.":
     "Use the free workspace to cook two equal-tier sushi recursively, merge east to west, and repeat until the target is made. Store completed targets outside the workspace; no Wind or Salt trigger is required."}
  };
  for(let i=0;i<copies;i++)candidate.board[geom.flex[i]]=target;
  if(!best||better(best.metric,candidate.metric))best=candidate;
 }
 return best;
}
// The empty cells left by the certified carry construction are temporary
// working space. Once the target copies have been completed, fill those cells
// from highest to lowest with a buildable staircase. Build each ingredient
// before the next one, so the available workspace shrinks in step with the
// required merge depth. Prefer starting at the Wind cap when it exists.
export function finishCertifiedCarryBoard(best,geom,target,windCap,{supportMode="staircase"}={}){
 // The hypothetical T46 benchmark should not imply that low-tier staircase
 // ingredients are needed. Its spare cells can be filled by direct cooking,
 // after all target copies are finished and the workspace has been released.
 if(!best?.certificate)return best;
 const slots=geom.flex.filter(pos=>best.board[pos]===0);
 const sourceTier=best.sourceTier;
 if(supportMode==="direct-source"){
  const proof=best.certificate;
  const cost=sushiDirectCookFuel(sourceTier);
  const extraCooks=BigInt(slots.length);
  const extraFuel=slots.length*cost;
  for(const pos of slots)best.board[pos]=sourceTier;
  proof.supportingMode="direct-source";
  proof.supportingSushi=slots.map(pos=>({position:pos+1,tier:sourceTier,
   requiredWorkspace:1,sourceTier,cooksExact:"1",mergesExact:"0",windEventsExact:"0"}));
  proof.supportingCount=slots.length;
  proof.supportingHighest=slots.length?sourceTier:null;
  proof.supportingLowest=slots.length?sourceTier:null;
  proof.supportingFuel=extraFuel;
  proof.supportingCooksExact=extraCooks.toString();
  proof.supportingMergesExact="0";
  proof.supportingWindEventsExact="0";
  proof.totalWindEventsExact=proof.windEventsExact;
  proof.totalCooksExact=(BigInt(proof.cooksExact)+extraCooks).toString();
  proof.totalMergesExact=proof.mergesExact;
  proof.proof+=" After all target sushi have been constructed, optionally cook T"+
   sourceTier+" directly in the remaining workspaces. These are not needed for Pepper odds.";
  best.spent+=extraFuel;
  return best;
 }
 const supportWindCap=geom.longestRun<2?0:windCap;
 const highest=Math.min(target-1,windCap>0?windCap:target-1,
  sourceTier+slots.length-1);
 const supporting=[];
 let extraCooks=0n,extraMerges=0n,extraWind=0n,extraFuel=0;
 for(let i=0;i<slots.length;i++){
  const tier=Math.max(1,highest-i);
  const free=slots.length-i;
  const aboveSource=Math.max(0,tier-sourceTier);
  const requiredWorkspace=aboveSource+1;
  if(requiredWorkspace>free)throw Error("Unbuildable Perfecto staircase ingredient");
  const direct=tier<=sourceTier;
  const proposed=direct?null:certifiedWindTierRecipe(sourceTier,tier,supportWindCap);
  const recipe=proposed?.usesWind&&geom.longestRun<proposed.workspaceSlots?
   certifiedWindTierRecipe(sourceTier,tier,0):proposed;
  const cooks=direct?1n:BigInt(recipe.cooksExact);
  const merges=direct?0n:BigInt(recipe.mergesExact);
  const wind=direct?0n:BigInt(recipe.windEventsExact);
  const cost=sushiDirectCookFuel(direct?tier:sourceTier);
  const fuel=Number(cooks)*cost;
  if(!Number.isFinite(fuel))throw Error("Non-finite Perfecto staircase fuel cost");
  best.board[slots[i]]=tier;
  extraCooks+=cooks;
  extraMerges+=merges;
  extraWind+=wind;
  extraFuel+=fuel;
  supporting.push({position:slots[i]+1,tier,requiredWorkspace,
   sourceTier:direct?tier:sourceTier,cooksExact:cooks.toString(),
   mergesExact:merges.toString(),windEventsExact:wind.toString()});
 }
 const proof=best.certificate;
 // Prefer a multi-sushi Wind cascade when it is cheaper and the inputs can
 // all be physically constructed in the shrinking contiguous workspace.
 const cascade=certifiedPerfectoSupportCascade(sourceTier,
  supporting.map(sushi=>sushi.tier),windCap);
 if(cascade&&cascade.totalFuel<extraFuel*(1-1e-10)){
  extraFuel=cascade.totalFuel;
  extraCooks=BigInt(cascade.cooksExact);
  extraMerges=BigInt(cascade.mergesExact);
  extraWind=BigInt(cascade.windEventsExact);
  proof.supportingMode="cascade";
  proof.supportingCascade=cascade;
 }
 proof.supportingSushi=supporting;
 proof.supportingCount=supporting.length;
 proof.supportingHighest=supporting[0]?.tier??null;
 proof.supportingLowest=supporting.at(-1)?.tier??null;
 proof.supportingFuel=extraFuel;
 proof.supportingCooksExact=extraCooks.toString();
 proof.supportingMergesExact=extraMerges.toString();
 proof.supportingWindEventsExact=extraWind.toString();
 proof.totalWindEventsExact=(BigInt(proof.windEventsExact)+extraWind).toString();
 proof.totalCooksExact=(BigInt(proof.cooksExact)+extraCooks).toString();
 proof.totalMergesExact=(BigInt(proof.mergesExact)+extraMerges).toString();
 proof.proof+=proof.supportingMode==="cascade"?
  " After producing the targets, recursively prepare a descending chain and two top trigger sushi, fire a multi-sushi East Wind cascade, shift the upgraded results west, and cook the final low tier. Every merge must pass replay validation.":
  " After producing all target copies, use the released workspace to build supporting sushi one at a time, highest first, preserving previous copies. Each next ingredient requires no more than the remaining free cells.";
 best.spent+=extraFuel;
 best.merges+=Number(extraMerges);
 best.wind+=Number(extraWind);
 return best;
}
// Rearrangement is cosmetic: it does not create, destroy or upgrade sushi.
// Highest tiers always get the Hot/Cold/Milktoast plates first. Then place
// remaining lower-tier support sushi in descending order at the beginning of
// the regular slots, the target sushi as a block, and protected higher tiers
// at the end (bottom-right when that position is an available regular plate).
// When the last unlocked position is itself special, reserve that special
// plate for the highest tier, matching the visual bottom-right preference.
const isBonusSushiSlot=slot=>slot===1||slot===2||slot===3;
export function prioritizePerfectoBonusSlots(board,geom,target,certificate=null){
 if(!Array.isArray(board))return board;
 // Prefer a physically constructible final arrangement over a cosmetic
 // reordering that moves protected sushi or splits the construction workspace.
 // The workspace holds W-1 staircase pieces, plus one completed target at the
 // right edge. Its special-plate penalty keeps target sushi on bonus plates
 // whenever a different contiguous workspace can be used.
 if(certificate&&Array.isArray(certificate.supportingSushi)){
  const flex=geom.flex.filter(pos=>geom.slots[pos]>=0);
  const flexible=new Set(flex);
  const W=Number(certificate.workspaceSlots);
  const supports=certificate.supportingSushi;
  if(supports.length===W-1&&Number.isInteger(W)&&W>=1){
   let candidate=null;
   for(let start=0;start+W<=board.length;start++){
    const cells=Array.from({length:W},(_,i)=>start+i);
    if(!cells.every(pos=>flexible.has(pos)))continue;
    const penalty=cells.slice(0,W-1).filter(pos=>isBonusSushiSlot(geom.slots[pos])).length;
    if(!candidate||penalty<candidate.penalty||
       penalty===candidate.penalty&&start<candidate.start)
     candidate={start,penalty};
   }
   if(candidate){
    const arranged=geom.tiles.map((value,pos)=>
     geom.slots[pos]<0?value:geom.frozen.has(pos)?value:0);
    for(const pos of flex)arranged[pos]=target;
    for(let i=0;i<supports.length;i++){
     const pos=candidate.start+i;
     arranged[pos]=supports[i].tier;
     supports[i].position=pos+1;
    }
    // The remaining workspace cell is the final target copy.
    arranged[candidate.start+W-1]=target;
    return arranged;
   }
  }
 }

 const unlocked=geom.slots.map((slot,pos)=>slot>=0?pos:-1).filter(pos=>pos>=0);
 const specials=unlocked.filter(pos=>isBonusSushiSlot(geom.slots[pos]));
 const regular=unlocked.filter(pos=>!isBonusSushiSlot(geom.slots[pos]));
 const bottomRight=unlocked.at(-1);
 // Special plate types are treated equally; their locations are not interchangeable.
 // Assign the last unlocked special first only if it is also the last unlocked cell.
 if(specials.at(-1)===bottomRight)specials.unshift(specials.pop());
 const ranked=unlocked.map(pos=>board[pos]).filter(tier=>tier>0)
  .sort((a,b)=>b-a);
 const result=board.slice();
 for(const pos of unlocked)result[pos]=0;
 for(const pos of specials)result[pos]=ranked.shift()??0;
 // The regular section is optimized for manual setup: an uninterrupted
 // highest-to-lowest support ladder where plate geometry allows it.
 const support=ranked.filter(tier=>tier<target).sort((a,b)=>b-a);
 const targets=ranked.filter(tier=>tier===target);
 const protectedHigher=ranked.filter(tier=>tier>target).sort((a,b)=>a-b);
 const ordered=[...support,...targets,...protectedHigher];
 for(let i=0;i<regular.length;i++)result[regular[i]]=ordered[i]??0;
 if(certificate?.supportingSushi){
  // A physical rearrangement changes where the prepared lower sushi sit.
  // Update each supporting recipe step's final position accordingly.
  const byTier=new Map();
  for(const pos of unlocked){
   const tier=result[pos];
   if(!byTier.has(tier))byTier.set(tier,[]);
   byTier.get(tier).push(pos+1);
  }
  for(const item of certificate.supportingSushi){
   const positions=byTier.get(item.tier);
   if(!positions?.length)throw Error("Perfecto placement lost a supporting ingredient");
   item.position=positions.shift();
  }
 }
 return result;
}
export function searchPerfectoBoard(save,target,economy,{effortMultiplier=16,certifiedOnly=false,supportMode="staircase"}={}){
 if(!save||!Number.isInteger(target)||target<1||target>64)return null;
 const geom=geometry(save,target);
 const currentCopies=geom.fixedTargets;
 const windCap=getSushiWindCap(save);
 const cookTier=maxCookableTier(economy,target);
 // Tier 1 is directly cookable and needs no merges.
 if(target===1){
  const board=geom.tiles.slice();
  for(const pos of geom.flex)board[pos]=1;
  return {board,slots:geom.slots,targetCount:currentCopies+geom.flex.length,
   currentCopies,protectedCount:geom.protectedCount,windCap,sourceTier:1,
   sourceCost:sushiDirectCookFuel(1),purchased:geom.flex.length,
   mergers:0,windUpgrades:0,attempted:1,reason:"direct-cooking",
   effortBudget:geom.flex.length,effortBasisTier:1,heuristic:true};
 }
 if(!geom.flex.length){
  return {board:geom.tiles,slots:geom.slots,targetCount:currentCopies,
   currentCopies,protectedCount:geom.protectedCount,windCap,
   sourceTier:cookTier,sourceCost:sushiDirectCookFuel(cookTier),
   purchased:0,mergers:0,windUpgrades:0,attempted:0,
   reason:"no-spare-slots",heuristic:true};
 }
 // "Target - 10" is only a search center. Direct-cooking capability
 // limits how far above cookable tiers the starting recipe may go, while
 // intermediate sushi can be produced by merging as the player prefers.
 const reference=clamp(Math.min(target-10,cookTier+9),1,Math.max(1,target-1));
 const sources=[reference,reference-1,reference+1,reference-2].filter((t,i,arr)=>
  t>=1&&t<target&&t<=cookTier+10&&arr.indexOf(t)===i);
 if(!sources.length)sources.push(1);
 const budget=Math.max(geom.flex.length*effortMultiplier,geom.flex.length*3);
 const stepLimit=Math.min(3000,Math.max(120,Math.ceil(budget*4)));
 const recipes=["uniform","ladder","double-ladder","high-pair","apex","existing"];
 let best=certifiedCarryBoard(geom,target,economy,windCap),attempted=0;
 // A certified recipe is also one evaluated construction candidate.
 if(best)attempted++;
 let bestUnverified=null;
 // The user-facing dual-board comparison needs only constructive recipes.
 // The bounded exploratory search remains available to research/tests but is
 // intentionally skipped for both live boards to avoid UI stalls.
 if(!certifiedOnly)for(const seed of sources){
  for(const recipe of recipes){
   for(let mode=0;mode<3;mode++){
    const candidate=runRecipe(geom,target,reference,seed,recipe,mode,windCap,budget,stepLimit);
    attempted++;
    // A static count-state is not a replay of the entire cooking sequence.
    // Do not replace a physically certified recipe with an unverified board.
    if(better(bestUnverified?.metric,candidate.metric))bestUnverified=candidate;
   }
  }
 }
 if(best?.certificate)finishCertifiedCarryBoard(best,geom,target,windCap,{supportMode});
 if(best)best.board=prioritizePerfectoBonusSlots(best.board,geom,target,best.certificate);
 const targetCount=best?.metric.target??currentCopies;
 return {
  board:best?.board??geom.tiles,
  slots:geom.slots,
  targetCount,currentCopies,protectedCount:geom.protectedCount,windCap,
  sourceTier:best?.sourceTier??cookTier,
  sourceCost:sushiDirectCookFuel(best?.sourceTier??cookTier),
  cookedSourceTier:cookTier,
  purchased:best?.certificate?Number(best.certificate.cooksExact):best?.seedEquivalentUsed??0,
  mergers:best?.merges??0,windUpgrades:best?.wind??0,
  attempted,recipe:best?.recipe??null,
  certificate:best?.certificate??null,
  cookingTiersCompared:affordableSushiCookingTiers(economy,target).length,
  effortBudget:best?.certificate?null:budget,effortBasisTier:reference,
  reason:targetCount>currentCopies?"certified":"no-improvement",
  unverifiedTargetCount:bestUnverified?.metric?.target??null,
  heuristic:false,searchLimitReached:false
 };
}
