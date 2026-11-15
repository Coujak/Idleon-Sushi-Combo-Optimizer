// Browser-local, cancelable optimizer search. The imported account JSON never
// leaves the user's device; no network requests are made by this worker.
import {optimizeKnowledgeRotation,continueKnowledgeRotation} from "./knowledge-rotation-optimizer.mjs?v=1.0.22";

function extendKnowledgeInBatches(save,snapshot,requestedWaves,seekTargetTier=0){
 // A target seek runs for much longer than a normal 5% refill increment.
 // Safety bounds prevent a missing or impossible target from consuming
 // unlimited memory. The user can terminate this browser-local worker.
 const targetSeek=Number.isInteger(seekTargetTier)&&seekTargetTier>=1&&seekTargetTier<=64;
 const MAX_TARGET_REFILLS=2400,MAX_TARGET_FRAMES=60000;
 const requested=Math.max(1,Math.floor(Number(requestedWaves))||1);
 const total=targetSeek?Math.min(requested,MAX_TARGET_REFILLS):requested;
 const rotations=[];
 let current={...snapshot};
 let remaining=total,completedWaves=0,haltReason="",targetCreationFound=false,
  framesSearched=0,searchLimitReached=false;
 // At most 6 refill waves per simulation keeps either 5% control responsive
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
  const matched=seekTargetTier>0&&rotation.frames.slice(1).some(frame=>
   (frame.events??[]).some(event=>event.tier===seekTargetTier&&
    ["cook","merge","wind"].includes(event.kind)));
  completedWaves+=rotation.rounds;
  remaining-=rotation.rounds;
  framesSearched+=rotation.frames.length;
  current={...current,finalBoard:rotation.finalBoard,
   protectedIndices:rotation.protectedIndices,
   targetCreated:rotation.targetCreated,
   roundsCompleted:current.roundsCompleted+rotation.rounds,
   completed:rotation.completed};
  self.postMessage({progress:true,completedWaves,requestedWaves:total,
   totalRefills:current.roundsCompleted,completed:rotation.completed,
   targetCreationFound:matched,seekTargetTier,framesSearched});
  // Only a verified creation counts as success, never a harvest label.
  if(matched){
   targetCreationFound=true;
   break;
  }
  // Protect long T64 searches from excessive replay allocations. This is
  // not a successful target discovery and must be identified to the user.
  if(targetSeek&&framesSearched>=MAX_TARGET_FRAMES){
   searchLimitReached=true;
   haltReason="Target search action safety limit reached (no T"+
    seekTargetTier+" creation found yet)";
   break;
  }
  // A stop inside a wave must not silently repeat the same refill number.
  // Return the verified partial result and explain why fewer refills ran.
  if(rotation.rounds<batch&&!rotation.completed){
   haltReason=rotation.reason??"Simulation stopped before the requested refill";
   break;
  }
 }
 if(targetSeek&&!targetCreationFound&&remaining===0&&!haltReason){
  searchLimitReached=true;
  haltReason="Target search refill safety limit reached (no T"+
   seekTargetTier+" creation found yet)";
 }
 return {available:true,rotations,requestedWaves:total,
  completedWaves,completed:current.completed,haltReason,
  targetCreationFound,seekTargetTier,framesSearched,searchLimitReached};
}

self.onmessage=event=>{
 try{
  const {save,options,continuation,waves,seekTargetTier=0}=event.data??{};
  const result=continuation?
   extendKnowledgeInBatches(save,continuation,waves,seekTargetTier):
   optimizeKnowledgeRotation(save,options,progress=>
    self.postMessage({progress:true,...progress}));
  self.postMessage({ok:true,result});
 }catch(error){
  self.postMessage({ok:false,error:error?.message??String(error)});
 }
};
