// Repeated runs explore genuinely unseen prepared boards. Their exact
// fingerprints are checked against local research memory, not just filenames
// or profile labels. Historical fixed experiments are not injected.
import {randomSource,mutateCandidate} from "./custom-split-search.mjs";
import {researchBoardKey} from "./research-memory.mjs";
function mixString(str){
 let hash=2166136261;
 for(let i=0;i<str.length;i++){
  hash^=str.charCodeAt(i);
  hash=Math.imul(hash,16777619);
 }
 return hash>>>0;
}
export function buildNovelSplitCandidates(candidates,positions,maxTier,
 selectedBase,perSplit,history){
 if(!candidates.length||!Number.isSafeInteger(perSplit)||perSplit<1)return [];
 const grouped=new Map();
 for(const candidate of candidates){
  const ratio=candidate.splitPercent;
  if(!grouped.has(ratio))grouped.set(ratio,[]);
  grouped.get(ratio).push(candidate);
 }
 const seen=new Set(history?.seen??[]);
 const result=[];
 for(const [ratio,group] of grouped){
  const uniqueBase=[],baseKeys=new Set();
  for(const candidate of group){
   const key=researchBoardKey(candidate.board);
   if(baseKeys.has(key))continue;
   baseKeys.add(key);uniqueBase.push(candidate);
  }
  if(!uniqueBase.length)continue;
  let accepted=0;
  const add=(candidate)=>{
   const key=researchBoardKey(candidate.board);
   if(seen.has(key))return false;
   seen.add(key);
   // A 50/50 preparation is one configuration, not one per direction.
   const direction=ratio===50?(accepted%2===0?"supply":"engine"):
    ratio>50?"supply":"engine";
   result.push({...candidate,splitDirection:direction,
    configurationIndex:accepted+1});
   accepted++;
   return true;
  };
  // Evaluate all original structural profiles during the first run, then
  // diversify from the successful ones in later runs.
  for(const candidate of uniqueBase){
   if(accepted>=perSplit)break;
   add(candidate);
  }
  const seed=(
   mixString(researchBoardKey(uniqueBase[0].board))^
   Math.imul(ratio+1,2654435761)^
   Math.imul(seen.size+1,2246822519)^
   Math.imul(maxTier+1,3266489917)
  )>>>0;
  const random=randomSource(seed);
  const pool=uniqueBase.slice();
  const incumbent=history?.best;
  if(incumbent?.splitPercent===ratio&&
     incumbent.board?.length===uniqueBase[0].board.length)
   pool.push(incumbent);
  let attempts=0;
  const maxAttempts=Math.max(300,perSplit*60);
  while(accepted<perSplit&&attempts++<maxAttempts){
   const parent=random()<.35&&incumbent?.splitPercent===ratio?
     incumbent:pool[Math.floor(random()*pool.length)];
   const {search:discarded,...template}=parent;
   const board=mutateCandidate(parent,positions,selectedBase,maxTier,random);
   add({...template,board,
    name:"Research · "+ratio+"/"+(100-ratio)+" · new variation",
    variant:"incremental search"});
  }
 }
 return result;
}
