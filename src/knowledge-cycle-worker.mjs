// Browser-local, cancelable optimizer search. The imported account JSON never
// leaves the user's device; no network requests are made by this worker.
import {optimizeKnowledgeRotation,continueKnowledgeRotation} from "./knowledge-rotation-optimizer.mjs?v=1.0.22";

function extendKnowledgeInBatches(save,snapshot,requestedWaves,seekTargetTier=0){
 const targetSeek=Number.isInteger(seekTargetTier)&&seekTargetTier>=1&&seekTargetTier<=64;
 const total=targetSeek?null:Math.max(1,Math.floor(Number(requestedWaves))||1);
 const MAX_RECENT_CHUNKS=3,MAX_SEEN_STATES=2048;
 const rotations=[];
 let current={...snapshot},completedWaves=0,haltReason="",
  targetCreationFound=false,framesSearched=0;
 let remaining=total,checkpoint=null;
 // The source board and protected cells fully determine subsequent
 // Focused simulation behavior. Repeating this state without creating
 // the target means the deterministic recipe will repeat indefinitely.
 const stateKey=state=>state.finalBoard.join(",")+"|"+
  [...(state.protectedIndices??[])].sort((a,b)=>a-b).join(",");
 const seen=new Set(),seenOrder=[];
 const remember=state=>{
  const key=stateKey(state);
  if(seen.has(key))return false;
  seen.add(key);seenOrder.push(key);
  if(seenOrder.length>MAX_SEEN_STATES)seen.delete(seenOrder.shift());
  return true;
 };
 if(targetSeek)remember(current);
 // Old search batches are reduced to one transparent checkpoint rather than
 // keeping hundreds of copies of every 120-slot board in worker memory.
 function foldIntoCheckpoint(rotation){
  if(!checkpoint){
   checkpoint={
    initialBoard:snapshot.finalBoard.slice(),
    finalBoard:snapshot.finalBoard.slice(),
    protectedIndices:[...(snapshot.protectedIndices??[])],
    rounds:0,cooks:0,merges:0,moves:0,windEvents:0,fuel:0,
    gains:Array(65).fill(0),creationCounts:Array(65).fill(0),
    targetCreated:snapshot.targetCreated??0,
    targetMergedInHarvest:0,peakTargetCopies:0,focusCopies:0,
    focusCompressed:0,harvested:0,balancedCycles:0,highestNewTier:0
   };
  }
  checkpoint.rounds+=rotation.rounds;
  checkpoint.cooks+=rotation.cooks??0;
  checkpoint.merges+=rotation.merges??0;
  checkpoint.moves+=rotation.moves??0;
  checkpoint.windEvents+=rotation.windEvents??0;
  checkpoint.fuel+=rotation.fuel??0;
  checkpoint.targetCreated=rotation.targetCreated;
  checkpoint.targetMergedInHarvest+=rotation.targetMergedInHarvest??0;
  checkpoint.peakTargetCopies=Math.max(checkpoint.peakTargetCopies,
   rotation.peakTargetCopies??0);
  checkpoint.focusCopies=rotation.focusCopies;
  checkpoint.focusCompressed+=rotation.focusCompressed??0;
  checkpoint.harvested+=rotation.harvested??0;
  checkpoint.balancedCycles+=rotation.balancedCycles??0;
  for(let tier=1;tier<=64;tier++)
   checkpoint.gains[tier]+=rotation.gains?.[tier]??0;
  for(const frame of rotation.frames.slice(1))
   for(const event of frame.events??[])
    if(["cook","merge","wind"].includes(event.kind)){
     checkpoint.creationCounts[event.tier]++;
     checkpoint.highestNewTier=Math.max(checkpoint.highestNewTier,event.tier);
    }
  checkpoint.finalBoard=rotation.finalBoard.slice();
  checkpoint.protectedIndices=[...rotation.protectedIndices];
 }
 function checkpointChunk(){
  if(!checkpoint||checkpoint.rounds<=0)return null;
  const cp=checkpoint;
  // The checkpoint marks a genuine, verified state, not an executable merge
  // or cook action. The omitted actions are clearly identified in its label.
  const note="Search checkpoint: "+cp.rounds+
   " refills were legally simulated without a T"+seekTargetTier+
   " creation. Individual earlier actions are summarized to save memory; "+
   "the board shown is the verified result of those refills.";
  const start={kind:"start",board:cp.initialBoard.slice(),events:[],gains:Array(65).fill(0),exp:0};
  const stage={
   kind:"checkpoint",title:"Search checkpoint · "+cp.rounds+" refills",
   detail:note,board:cp.finalBoard.slice(),phase:"prepare",
   protectedIndices:cp.protectedIndices.slice(),
   targetCreated:cp.targetCreated,
   targetCopies:cp.focusCopies,
   // A summary event records the ACTUAL count from every discarded action;
   // it is not a new sushi creation at this checkpoint step.
   events:cp.creationCounts.flatMap((count,tier)=>
    tier>0&&count>0?[{kind:"search-summary",tier,creations:count}]:[]),
   gains:cp.gains.slice(),exp:cp.gains.reduce((a,b)=>a+b,0)
  };
  const lastBoard=cp.finalBoard;
  return {
   valid:true,frames:[start,stage],
   initialBoard:cp.initialBoard,finalBoard:lastBoard,
   protectedIndices:cp.protectedIndices,rounds:cp.rounds,
   completed:false,gains:cp.gains,totalExp:stage.exp,
   cooks:cp.cooks,merges:cp.merges,moves:cp.moves,
   windEvents:cp.windEvents,fuel:cp.fuel,
   targetCreated:cp.targetCreated,
   targetMergedInHarvest:cp.targetMergedInHarvest,
   peakTargetCopies:cp.peakTargetCopies,focusCopies:cp.focusCopies,
   focusCompressed:cp.focusCompressed,
   harvested:cp.harvested,harvestBatches:[],
   balancedCycles:cp.balancedCycles,
   highestNewTier:cp.highestNewTier,
   highestTier:Math.max(...lastBoard),
   remaining:lastBoard.flatMap((tier,i)=>
    snapshot.slots?.[i]>=0&&tier>0?[{at:i,tier}]:[]),
   reason:"Earlier search refills summarized at a verified checkpoint"
  };
 }
 while((targetSeek||remaining>0)&&!current.completed){
  const batch=targetSeek?6:Math.min(6,remaining);
  const result=continueKnowledgeRotation(save,current,batch);
  if(!result.available){
   if(!rotations.length&&!checkpoint)return result;
   haltReason=result.reason??"No further legal progress";
   break;
  }
  const rotation=result.rotation;
  const matched=targetSeek&&rotation.frames.slice(1).some(frame=>
   (frame.events??[]).some(event=>event.tier===seekTargetTier&&
    ["cook","merge","wind"].includes(event.kind)));
  rotations.push(rotation);
  if(targetSeek&&rotations.length>MAX_RECENT_CHUNKS)
   foldIntoCheckpoint(rotations.shift());
  completedWaves+=rotation.rounds;
  if(!targetSeek)remaining-=rotation.rounds;
  framesSearched+=rotation.frames.length;
  current={...current,finalBoard:rotation.finalBoard,
   protectedIndices:rotation.protectedIndices,
   targetCreated:rotation.targetCreated,
   roundsCompleted:current.roundsCompleted+rotation.rounds,
   completed:rotation.completed};
  if(!targetSeek||completedWaves%24===0||matched)
   self.postMessage({progress:true,completedWaves,
    requestedWaves:total,totalRefills:current.roundsCompleted,
    completed:rotation.completed,targetCreationFound:matched,
    seekTargetTier,framesSearched});
  if(matched){targetCreationFound=true;break;}
  if(rotation.rounds<batch&&!rotation.completed){
   haltReason=rotation.reason??"No further legal refill could be completed";
   break;
  }
  if(rotation.rounds<=0){
   haltReason="The rotation could not complete another refill";
   break;
  }
  if(targetSeek&&!remember(current)){
   haltReason="The board and protected Sushi entered a repeating cycle "+
    "without producing T"+seekTargetTier;
   break;
  }
  if(!Number.isSafeInteger(current.roundsCompleted)){
   haltReason="The simulated refill counter exceeded safe numerical precision";
   break;
  }
 }
 return {available:true,rotations,checkpoint:checkpointChunk(),
  requestedWaves:total,completedWaves,completed:current.completed,
  haltReason,targetCreationFound,seekTargetTier,framesSearched,
  searchLimitReached:false};
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
