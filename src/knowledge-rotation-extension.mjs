// Join a newly simulated Knowledge chunk to its previous validated replay.
// Existing steps/board are retained, rather than restarting from the account.
const total=(values)=>values.reduce((a,b)=>a+b,0);
const safeNumber=n=>Number.isFinite(n)?n:0;
export function combineKnowledgeContinuation(previous,chunk,requestedWaves=6){
 if(!["balanced","focused"].includes(previous?.mode)||!previous.available||previous.completed||
  !chunk?.valid||!Array.isArray(chunk.frames)||chunk.frames.length<2||
  !Array.isArray(previous.steps)||!Array.isArray(previous.finalBoard)||
  !chunk.initialBoard?.every((tier,i)=>tier===previous.finalBoard[i])||
  (chunk.rounds<1&&!chunk.completed&&
   !chunk.frames.some(frame=>["cook","merge","move"].includes(frame.kind))))
  throw Error("The continued rotation does not match its prior board.");
 const first=previous.steps.at(-1);
 if(!first?.board?.every((tier,i)=>tier===chunk.initialBoard[i]))
  throw Error("The prior walkthrough and continuation boards differ.");
 const steps=previous.steps.slice(0,-1).concat(chunk.frames.slice(1));
 // The first action of the new chunk must start from the previous final board.
 const expByTier=Array.from({length:65},(_,tier)=>
  safeNumber(previous.expByTier[tier])+safeNumber(chunk.gains[tier]));
 const deltaActions=chunk.cooks*safeNumber(previous.options?.secondsPerCook||2)+
  (chunk.merges+chunk.moves)*safeNumber(previous.options?.secondsPerMerge||1.5)+
  chunk.windEvents*.25;
 const fuelRate=safeNumber(previous.estimatedFuelGeneration);
 const deltaFuelSeconds=fuelRate>0?chunk.fuel*3600/fuelRate:deltaActions;
 const duration=safeNumber(previous.cycleSeconds)+Math.max(deltaActions,deltaFuelSeconds);
 const totalExp=total(expByTier);
 const eligibleRange=previous.mode==="balanced"?
  previous.perTier.filter(row=>row.tier>=(previous.balancedStartTier??1)&&
   row.tier<=(previous.balancedEndTier??64)):
  previous.perTier;
 const coveredTiers=eligibleRange.filter(row=>expByTier[row.tier]>0).map(row=>row.tier);
 const uncoveredTiers=eligibleRange.filter(row=>expByTier[row.tier]<=0).map(row=>row.tier);
 const perTier=previous.perTier.map(row=>{
  const expPerCycle=expByTier[row.tier];
  const activeExpPerHour=duration>0?expPerCycle*3600/duration:0;
  const expPerHour=activeExpPerHour+safeNumber(row.passiveExpPerDay)/24;
  return {...row,expPerCycle,activeExpPerHour,expPerHour,
   etaHours:row.remaining===0?0:row.remaining!==null&&expPerHour>0?
    row.remaining/expPerHour:null};
 });
 const originalAnchors=new Set(previous.startingBoard.flatMap((tier,i)=>
  tier===64?[i]:[]));
 const highestNew=Math.max(safeNumber(previous.highestNewTier),
  ...chunk.frames.flatMap(frame=>(frame.events??[]).filter(event=>
   ["cook","merge","wind"].includes(event.kind)).map(event=>event.tier)),0);
 const highestWorking=Math.max(0,...chunk.finalBoard.flatMap((tier,i)=>
  !originalAnchors.has(i)&&tier>0?[tier]:[]));
 const targetExp=expByTier[previous.targetTier]??0;
 const previewExpPerHour=duration>0?totalExp*3600/duration:0;
 const targetPreviewExpPerHour=duration>0?targetExp*3600/duration:0;
 const additional=Math.max(1,Math.floor(Number(requestedWaves))||6);
 return {...previous,
  steps,finalBoard:chunk.finalBoard,
  protectedIndices:chunk.protectedIndices,
  roundsCompleted:previous.roundsCompleted+chunk.rounds,
  roundsRequested:chunk.completed?
   previous.roundsCompleted+chunk.rounds:previous.roundsCompleted+additional,
  haltReason:chunk.reason,
  completed:Boolean(chunk.completed),
  rotationTerminal:Boolean(chunk.completed),
  repeatable:false,initialBoardMatchesFinal:false,
  balancedCycles:safeNumber(previous.balancedCycles)+chunk.balancedCycles,
  targetCreated:previous.mode==="focused"?chunk.targetCreated:previous.targetCreated,
  targetMergedInHarvest:safeNumber(previous.targetMergedInHarvest)+
   safeNumber(chunk.targetMergedInHarvest),
  peakTargetCopies:Math.max(safeNumber(previous.peakTargetCopies),
   safeNumber(chunk.peakTargetCopies)),
  focusCopies:chunk.focusCopies,
  focusCompressed:safeNumber(previous.focusCompressed)+safeNumber(chunk.focusCompressed),
  harvestBatches:[...(previous.harvestBatches??[]),...(chunk.harvestBatches??[])],
  harvestCount:safeNumber(previous.harvestCount)+safeNumber(chunk.harvested),
  targetPreviewIncomplete:previous.mode==="focused"&&chunk.targetCreated===0,
  stranded:chunk.remaining.length,highestTier:chunk.highestTier,
  highestWorkingTier:highestWorking,highestNewTier:highestNew,
  cooks:previous.cooks+chunk.cooks,
  merges:previous.merges+chunk.merges,
  moves:previous.moves+chunk.moves,
  windEvents:previous.windEvents+chunk.windEvents,
  fuelPerCycle:previous.fuelPerCycle+chunk.fuel,
  activeSeconds:previous.activeSeconds+deltaActions,
  fuelWaitSeconds:previous.fuelWaitSeconds+deltaFuelSeconds,
  cycleSeconds:duration,
  totalExpPerCycle:totalExp,previewExpPerHour,
  totalExpPerHour:null,
  targetExp,targetPreviewExpPerHour,targetExpPerHour:null,
  targetHybridPreviewExpPerHour:targetPreviewExpPerHour+
   safeNumber(previous.targetPassiveExpPerDay)/24,
  hybridPreviewExpPerHour:previewExpPerHour+
   safeNumber(previous.passive?.averageTotalPerDay)/24,
  expByTier,perTier,coveredTiers,uncoveredTiers,
  coverageTotal:coveredTiers.length,
  coverageRequested:eligibleRange.length,
  // The first-fill fuel safety remains attached to the original preparation.
  // It does not claim that all later refills are fuel-wait-free.
 };
}

/**
 * Keep the user's place while reviewing old steps. When they press Continue
 * from the previous final step, jump straight to the NEXT refill so the button
 * visibly advances the walkthrough rather than leaving it on the old board.
 */
export function knowledgeContinuationResumeStep(oldSteps,newSteps,previousIndex,goToNext=false){
 if(!Array.isArray(oldSteps)||!Array.isArray(newSteps)||!newSteps.length)return 0;
 const index=Number.isInteger(previousIndex)?previousIndex:oldSteps.length-1;
 if(!goToNext&&index<oldSteps.length-2)
  return Math.max(0,Math.min(index,newSteps.length-1));
 const firstNew=Math.max(0,oldSteps.length-1);
 const refill=goToNext?newSteps.findIndex((frame,i)=>
  i>=firstNew&&frame.kind==="refill"):-1;
 if(refill>=0)return refill;
 const action=newSteps.findIndex((frame,i)=>i>=firstNew&&
  ["cook","merge","move","refill"].includes(frame.kind));
 return action>=0?action:newSteps.length-1;
}
