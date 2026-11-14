// Browser-local, cancelable optimizer search. The imported account JSON never
// leaves the user's device; no network requests are made by this worker.
import {optimizeKnowledgeRotation,continueKnowledgeRotation} from "./knowledge-rotation-optimizer.mjs?v=1.0.16";

function extendBalancedInBatches(save,snapshot,requestedWaves){
 const total=Math.max(1,Math.floor(Number(requestedWaves))||1);
 const rotations=[];
 let current={...snapshot};
 let remaining=total,completedWaves=0,haltReason="";
 // At most 6 refill waves per simulation keeps the 5% control responsive
 // without hitting the 5000-action preview ceiling for normal board sizes.
 while(remaining>0&&!current.completed){
  const batch=Math.min(6,remaining);
  const result=continueKnowledgeRotation(save,current,batch);
  if(!result.available){
   if(!rotations.length)return result;
   haltReason=result.reason??"No further legal progress";
   break;
  }
  const rotation=result.rotation;
  rotations.push(rotation);
  completedWaves+=rotation.rounds;
  remaining-=rotation.rounds;
  current={...current,finalBoard:rotation.finalBoard,
   protectedIndices:rotation.protectedIndices,
   roundsCompleted:current.roundsCompleted+rotation.rounds,
   completed:rotation.completed};
  self.postMessage({progress:true,completedWaves,requestedWaves:total,
   totalRefills:current.roundsCompleted,completed:rotation.completed});
  // A stop inside a wave must not silently repeat the same refill number.
  // Return the verified partial result and explain why fewer refills ran.
  if(rotation.rounds<batch&&!rotation.completed){
   haltReason=rotation.reason??"Simulation stopped before the requested refill";
   break;
  }
 }
 return {available:true,rotations,requestedWaves:total,
  completedWaves,completed:current.completed,haltReason};
}

self.onmessage=event=>{
 try{
  const {save,options,continuation,waves}=event.data??{};
  const result=continuation?
   extendBalancedInBatches(save,continuation,waves):
   optimizeKnowledgeRotation(save,options);
  self.postMessage({ok:true,result});
 }catch(error){
  self.postMessage({ok:false,error:error?.message??String(error)});
 }
};
