// Custom split optimizer: one budget per UNIQUE supply/engine boundary.
// The base 50 profiles share the same search generator as Fast/Mid/Slow/Max.
// Additional candidates are reproducible variations, not exhaustive enumeration.
import {buildSplitComboCandidates} from "./combo-split-strategies.mjs";

function randomSource(seed){
 let state=(seed>>>0)||1;
 return ()=>{state^=state<<13;state^=state>>>17;state^=state<<5;
  return (state>>>0)/4294967296;};
}
function mutateCandidate(parent,positions,selectedBase,maxTier,random){
 const tiers=positions.map(p=>parent.board[p]);
 const supply=parent.supplyCount;
 const protectedSlot=parent.strategySections?.protectedPosition===positions[0];
 const ingredientStart=protectedSlot?1:0;
 const floor=Math.max(1,selectedBase||1);
 const ceiling=Math.max(floor,maxTier-1);
 const rand=(min,max)=>min+Math.floor(random()*(max-min+1));
 const clamp=t=>Math.max(floor,Math.min(ceiling,t));
 const modifications=rand(1,5);
 for(let n=0;n<modifications;n++){
  const action=rand(0,4);
  const segmentStart=action===0&&supply>ingredientStart?
   ingredientStart:supply;
  const segmentEnd=action===0&&supply>ingredientStart?supply:tiers.length;
  if(segmentEnd<=segmentStart)continue;
  const at=rand(segmentStart,segmentEnd-1);
  if(action===0||action===1){
   tiers[at]=clamp(tiers[at]+(random()<.5?-1:1)*rand(1,4));
  }else if(action===2){
   tiers[at]=clamp(tiers[at]+(random()<.5?-1:1)*rand(5,12));
  }else if(action===3){
   const other=rand(segmentStart,segmentEnd-1);
   [tiers[at],tiers[other]]=[tiers[other],tiers[at]];
  }else{
   const length=Math.min(rand(2,8),segmentEnd-at);
   const delta=random()<.5?-1:1;
   for(let k=at;k<at+length;k++)tiers[k]=clamp(tiers[k]+delta);
  }
 }
 // Reserves remain descending so the preparation is human-replicable.
 const sorted=tiers.slice(ingredientStart,supply).sort((a,b)=>b-a);
 tiers.splice(ingredientStart,supply-ingredientStart,...sorted);
 const board=parent.board.slice();
 positions.forEach((position,i)=>{board[position]=tiers[i];});
 return board;
}
export function buildCustomSplitCandidates(positions,maxTier,cap,chainLimit=25,
 selectedBase=0,protectHighest=maxTier>=64,stepMode="optimizer1",perSplit=50){
 if(!Number.isSafeInteger(perSplit)||perSplit<1||perSplit>1000||
  !["optimizer1","optimizer2","optimizer3","optimizer4"].includes(stepMode))return [];
 const base=buildSplitComboCandidates(positions,maxTier,cap,chainLimit,
  selectedBase,protectHighest,stepMode);
 if(!base.length)return [];
 const grouped=new Map();
 for(const candidate of base){
  const key=candidate.splitPercent;
  if(!grouped.has(key))grouped.set(key,[]);
  grouped.get(key).push(candidate);
 }
 const candidates=[];
 for(const [split,group] of grouped){
  const selected=[],seen=new Set();
  function add(candidate){
   const key=candidate.board.join(",");
   if(seen.has(key))return false;
   seen.add(key);selected.push(candidate);return true;
  }
  for(const candidate of group){
   if(selected.length>=perSplit)break;
   add({...candidate,name:"Custom · "+candidate.name});
  }
  if(selected.length<perSplit){
   const seed=((split*2654435761)^(maxTier*7919)^(cap*104729)^
    (chainLimit*13007)^(positions.length*251))>>>0;
   const random=randomSource(seed);
   const parents=selected.slice();
   let attempts=0;
   const maxAttempts=Math.max(100,perSplit*30);
   while(selected.length<perSplit&&attempts++<maxAttempts){
    const parent=parents[Math.floor(random()*parents.length)];
    const board=mutateCandidate(parent,positions,selectedBase,maxTier,random);
    add({...parent,board,name:"Custom · "+split+"/"+(100-split)+
      " variation "+(selected.length+1),variant:"custom refinement"});
   }
  }
  selected.forEach((candidate,i)=>{candidate.configurationIndex=i+1;});
  candidates.push(...selected);
 }
 return candidates;
}
