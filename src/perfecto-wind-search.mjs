// Bounded search for buildable Perfecto boards.
// Every newly created target tile must be produced by a replayable merge /
// Heat of the East Wind event from optimizer-core.mjs. No target tiles are
// conjured from a fixed board layout or a simplistic material division.
import {simulateMerge} from "./optimizer-core.mjs";
import {sushiDirectCookFuel,chooseFuelCookingTier} from "./perfecto-fuel.mjs";

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const number=x=>Number.isFinite(Number(x))?Number(x):0;
const BOARD_SIZE=120;

export function getSushiWindCap(save){
 const upgrades=save?.sushi?.[2]??[];
 if(!(Number(upgrades[29])>=1))return 0;
 const tracking=save?.sushi?.[5]??[];
 let discovered=0;
 for(const value of tracking){
  if(Number(value)<0)break;
  discovered++;
 }
 return Math.max(0,Math.min(58,discovered-6));
}
function importedBoard(save){
 const slots=Array.from({length:BOARD_SIZE},(_,i)=>Number(save?.slots?.[i]??-1));
 const board=Array.from({length:BOARD_SIZE},(_,i)=>slots[i]>=0?
   Math.max(0,number(save?.tiles?.[i])+1):0);
 return {slots,board};
}
function candidatesForSource(economy,target,hours,secondsPerCook,mode){
 const choices=[];
 const best=chooseFuelCookingTier(economy,target,{hours,secondsPerCook,mode});
 if(!best)return choices;
 const tiers=new Set([best.tier]);
 for(let d=1;d<=4;d++)if(best.tier-d>=1)tiers.add(best.tier-d);
 for(const tier of tiers){
  const cost=sushiDirectCookFuel(tier);
  if(cost===null||cost>economy.capacity)continue;
  const availableFuel=Math.max(0,economy.currentFuel+economy.generationPerHour*hours);
  const timeLimit=Math.floor(hours*3600/secondsPerCook);
  const possibleCooks=Math.max(0,Math.min(1e8,Math.floor(availableFuel/cost),timeLimit));
  if(mode==="steady"&&
    cost>economy.generationPerHour*secondsPerCook/3600&&tier!==best.tier)continue;
  choices.push({tier,cost,possibleCooks,fullySustainable:
   cost<=economy.generationPerHour*secondsPerCook/3600,
   sourceMode:mode,durationHours:hours,secondsPerCook});
 }
 return choices;
}
function layoutFromSave(save,target,source,scenario,cookLimit,protectHigher){
 const {slots,board:original}=importedBoard(save);
 const protectedPositions=[];
 const targetPositions=[];
 const flexible=[];
 for(let i=0;i<BOARD_SIZE;i++){
  if(slots[i]<0)continue;
  if(protectHigher&&original[i]>target)protectedPositions.push(i);
  else if(original[i]===target)targetPositions.push(i);
  else flexible.push(i);
 }
 const board=original.slice();
 const initial=flexible.map(i=>original[i]).filter(t=>t>0);
 if(scenario==="descending"||scenario==="descending-replace")
  initial.sort((a,b)=>b-a);
 else if(scenario==="ascending")initial.sort((a,b)=>a-b);
 else if(scenario==="alternating"){
  initial.sort((a,b)=>b-a);
  const tmp=[],half=Math.ceil(initial.length/2);
  for(let i=0;i<half;i++){
   tmp.push(initial[i]);
   if(i+half<initial.length)tmp.push(initial[i+half]);
  }
  initial.splice(0,initial.length,...tmp);
 }
 // Sorting changes *positions*, never sushi tier counts.
 if(scenario!=="original"){
  for(let j=0;j<flexible.length;j++)board[flexible[j]]=initial[j]??0;
 }
 let remaining=Math.min(cookLimit,1e8),purchased=0;
 // Take empty slots before replacing inferior tiles.
 const holes=flexible.filter(i=>board[i]===0).sort((a,b)=>a-b);
 for(const i of holes){
  if(remaining<=0)break;
  board[i]=source;purchased++;remaining--;
 }
 if(scenario.includes("replace")){
  const inferior=flexible.filter(i=>board[i]>0&&
   (board[i]<source||!protectHigher&&board[i]>target))
    .sort((a,b)=>board[a]-board[b]||a-b);
  for(const i of inferior){
   if(remaining<=0)break;
   board[i]=source;purchased++;remaining--;
  }
 }
 return {board,slots,purchased,budgetRemaining:remaining,
  original,protectedPositions,targetPositions,scenario};
}
function chooseMerge(board,slots,source,target,windCap,chainLimit,variation){
 let best=null;
 const weight=t=>Math.pow(2.12,Math.max(0,Math.min(60,t-source)));
 for(let dst=0;dst<BOARD_SIZE;dst++){
  if(slots[dst]<0)continue;
  const tier=board[dst];
  if(tier<=0||tier>=target)continue;
  let nearestLeft=-1,farthestLeft=-1,nearestRight=-1,farthestRight=-1;
  for(let i=0;i<BOARD_SIZE;i++){
   if(i===dst||slots[i]<0||board[i]!==tier)continue;
   if(i<dst){nearestLeft=i; if(farthestLeft<0)farthestLeft=i;}
   else{if(nearestRight<0)nearestRight=i;farthestRight=i;}
  }
  const sources=new Set([nearestLeft,farthestLeft,nearestRight,farthestRight]);
  for(const src of sources){
   if(src<0)continue;
   // Score projected changes without copying the 120-cell board for every
   // possible pair. The ONE selected action is then executed and checked
   // through the existing canonical simulateMerge function.
   let windGrowth=0,windCount=0;
   if(src<dst&&tier<=windCap){
    let previous=tier;
    for(let q=dst+1;q<board.length&&windCount<chainLimit;q++){
     const v=board[q];
     if(v<1||v>=target||(q===dst+1?v>tier:v!==previous-1))break;
     windGrowth+=weight(v+1)-weight(v);windCount++;previous=v;
    }
   }
   const ordinaryGain=weight(tier+1)-2*weight(tier);
   const createsTarget=tier+1===target?1:0;
   const score=(createsTarget?1e18:0)+ordinaryGain+windGrowth+
    windCount*(variation%2===0?2:6)+
    (variation%3===1?(dst/BOARD_SIZE)*.0001:0)+
    (variation%3===2?(BOARD_SIZE-dst)/BOARD_SIZE*.0001:0);
   if(!best||score>best.score||
     score===best.score&&(variation%2===0?src<best.src:src>best.src)){
    best={src,dst,score};
   }
  }
 }
 if(!best)return null;
 const executed=simulateMerge(board,best.src,best.dst,windCap,chainLimit,target);
 return executed?{...best,next:executed.board,events:executed.events}:null;
}
function refill(board,slots,source,remaining,style){
 let used=0;
 const empties=[];
 for(let i=0;i<board.length;i++)if(slots[i]>=0&&board[i]===0)empties.push(i);
 if(style%2===1)empties.reverse();
 for(const i of empties){
  if(used>=remaining)break;
  board[i]=source;used++;
 }
 return used;
}
function runScenario(save,target,cooking,windCap,{protectHigher=true,maxActions=320,variation=0,scenario="original"}={}){
 const actualBudget=Math.max(0,Math.floor(cooking.possibleCooks));
 const searchCookLimit=Math.min(actualBudget,2000);
 const prepared=layoutFromSave(save,target,cooking.tier,scenario,searchCookLimit,protectHigher);
 let board=prepared.board;
 const startBoard=board.slice(),events=[];
 let purchased=prepared.purchased;
 let totalWind=0,merges=0;
 const headCount=()=>board.filter(v=>v===target).length;
 let bestCount=headCount(),bestBoard=board.slice(),bestEventCount=0,bestPurchased=purchased;
 const initialPurchased=purchased;
 for(let step=0;step<maxActions;step++){
  let chosen=chooseMerge(board,prepared.slots,cooking.tier,target,windCap,25,variation);
  if(!chosen){
   if(purchased>=searchCookLimit)break;
   const before=board.slice();
   const added=refill(board,prepared.slots,cooking.tier,searchCookLimit-purchased,variation);
   if(!added)break;
   const positions=[];
   for(let i=0;i<board.length;i++)if(before[i]===0&&board[i]===cooking.tier)positions.push(i);
   events.push({kind:"cook",positions});
   purchased+=added;
   chosen=chooseMerge(board,prepared.slots,cooking.tier,target,windCap,25,variation);
   if(!chosen)break;
  }
  const from=board[chosen.src];
  board=chosen.next;
  const countWind=chosen.events.filter(e=>e.kind==="wind").length;
  merges++;totalWind+=countWind;
  events.push({kind:"merge",src:chosen.src,dst:chosen.dst,from,wind:countWind});
  const count=headCount();
  if(count>bestCount||(count===bestCount&&count>0&&purchased<bestPurchased)){
   bestCount=count;bestBoard=board.slice();bestEventCount=events.length;bestPurchased=purchased;
  }
  if(purchased<searchCookLimit){
   const next=board.slice();
   const used=refill(next,prepared.slots,cooking.tier,searchCookLimit-purchased,variation);
   if(used){
    const positions=[];
    for(let i=0;i<next.length;i++)if(board[i]===0&&next[i]===cooking.tier)positions.push(i);
    events.push({kind:"cook",positions});
    purchased+=used;board=next;
   }
  }
 }
 const chosenBoard=bestCount>0?bestBoard:board;
 const taken=bestCount>0?bestPurchased:purchased;
 const usedEvents=bestCount>0?events.slice(0,bestEventCount):events;
 const protectedValid=prepared.protectedPositions.every(i=>chosenBoard[i]===prepared.original[i]);
 const existingTargetValid=prepared.targetPositions.every(i=>chosenBoard[i]===target);
 if(!protectedValid||!existingTargetValid)throw Error("Perfecto search altered protected or existing target sushi");
 return {board:chosenBoard,startBoard,slots:prepared.slots,
  targetCount:chosenBoard.filter(v=>v===target).length,
  purchased:taken,initialPurchased,searchCookLimit,
  mergers:merges,windUpgrades:totalWind,
  sourceTier:cooking.tier,sourceCost:cooking.cost,
  protectedPositions:prepared.protectedPositions,scenario,variation,
  eventCount:usedEvents.length,events:usedEvents};
}
function rank(a,b){
 if(!a)return b;
 if(b.targetCount!==a.targetCount)return b.targetCount>a.targetCount?b:a;
 if(b.windUpgrades!==a.windUpgrades)return b.windUpgrades>a.windUpgrades?b:a;
 if(b.purchased!==a.purchased)return b.purchased<a.purchased?b:a;
 return a;
}
export function searchPerfectoBoard(save,target,economy,{
 protectHigher=true,hours=168,secondsPerCook=20,mode="yield",maxActions=550
}={}){
 if(!save||!economy||!Number.isInteger(target)||target<1||target>64)return null;
 const sources=candidatesForSource(economy,target,hours,secondsPerCook,mode);
 const windCap=getSushiWindCap(save);
 const original=importedBoard(save);
 const currentCopies=original.board.filter((t,i)=>original.slots[i]>=0&&t===target).length;
 const protectedCount=original.board.filter((t,i)=>original.slots[i]>=0&&protectHigher&&t>target).length;
 let best=null,trials=0;
 if(!sources.length){
  const board=original.board.slice();
  return {board,slots:original.slots,targetCount:currentCopies,currentCopies,
   purchased:0,protectedCount,windCap,sourceTier:null,sourceCost:null,
   maxCopies:currentCopies,attempted:0,searchLimitReached:false,reason:"no-affordable-cook"};
 }
 const variants=["original","descending-replace","descending","alternating"];
 // Search two near-optimal cooking tiers with several physical arrangements.
 // Deterministic bounded heuristic; not an assertion of global optimality.
 for(const cooking of sources.slice(0,3)){
  for(let variant=0;variant<variants.length;variant++){
   const candidate=runScenario(save,target,cooking,windCap,{
    protectHigher,maxActions,scenario:variants[variant],
    variation:variant
   });
   best=rank(best,candidate);trials++;
  }
 }
 return {...best,currentCopies,protectedCount,windCap,maxCopies:best?.targetCount??currentCopies,
  attempted:trials,searchLimitReached:best?.searchCookLimit===2000||best?.mergers>=maxActions,
  reason:best?.targetCount>currentCopies?"simulated":"no-improvement",
  heuristic:true};
}
export function verifyPerfectoSearch(save,target,run,windCap){
 if(!run||!Array.isArray(run.startBoard)||!Array.isArray(run.events))return false;
 const orig=importedBoard(save),slots=orig.slots;
 const protectedPositions=run.protectedPositions??[];
 let board=run.startBoard.slice(),purchased=run.initialPurchased;
 for(const event of run.events){
  if(event.kind==="cook"){
   for(const i of event.positions){
    if(slots[i]<0||board[i]!==0)return false;
    board[i]=run.sourceTier;purchased++;
   }
   continue;
  }
  if(event.kind!=="merge")return false;
  const next=simulateMerge(board,event.src,event.dst,windCap,25,target);
  if(!next||next.events.filter(x=>x.kind==="wind").length!==event.wind)return false;
  board=next.board;
 }
 return protectedPositions.every(i=>board[i]===orig.board[i])&&
  purchased<=run.searchCookLimit&&
  board.every((tile,i)=>tile===run.board[i]);
}
