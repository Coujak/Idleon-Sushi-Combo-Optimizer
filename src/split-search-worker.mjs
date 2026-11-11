// Independent scoring thread for one supply/engine search direction.
// Browser Workers are terminated by the host on cancellation; no polling
// or cooperative cancellation is required inside expensive synchronous scans.
import {evaluateSplitCandidate,betterSplitResult} from "./split-search-core.mjs";

let best=null,processed=0;
self.onmessage=({data})=>{
 if(data?.type!=="evaluate")return;
 try{
  const {candidates,cap,chain,mode,maxTier}=data;
  let improved=null;
  const checked=[];
  for(const candidate of candidates){
   const result=evaluateSplitCandidate(candidate,cap,chain,mode,maxTier);
   if(betterSplitResult(result,best)){
    best=result;
    improved=result;
   }
   processed++;
   if(candidate.researchContext)
    checked.push({context:candidate.researchContext,key:candidate.board.join(",")});
  }
  self.postMessage({
   type:"progress",processed:candidates.length,
   splitPercent:candidates.at(-1)?.splitPercent??null,
   bestScore:best?.search?.score??null,
   // Only copy complete action sequences if there is a new best.
   improved,checked
  });
 }catch(error){
  self.postMessage({type:"error",message:String(error?.message??error)});
 }
};
