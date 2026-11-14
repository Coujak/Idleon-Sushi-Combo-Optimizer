// Join a newly simulated Balanced chunk to its previous validated replay.
// Existing steps/board are retained, rather than restarting from the account.
const total=(values)=>values.reduce((a,b)=>a+b,0);
const safeNumber=n=>Number.isFinite(n)?n:0;
export function combineKnowledgeContinuation(previous,chunk,requestedWaves=6){
 if(previous?.mode!=="balanced"||!previous.available||previous.completed||
  !chunk?.valid||!Array.isArray(chunk.frames)||chunk.frames.length<2||
  !Array.isArray(previous.steps)||!Array.isArray(previous.finalBoard)||
  !chunk.initialBoard?.every((tier,i)=>tier===previous.finalBoard[i])||
  chunk.rounds<1&&!chunk.completed)
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
 const coveredTiers=previous.perTier.filter(row=>expByTier[row.tier]>0).map(row=>row.tier);
 const uncoveredTiers=previous.perTier.filter(row=>expByTier[row.tier]<=0).map(row=>row.tier);
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
  roundsCompleted:previous.roundsCompleted+chunk.rounds,
  roundsRequested:chunk.completed?
   previous.roundsCompleted+chunk.rounds:previous.roundsRequested+additional,
  haltReason:chunk.reason,
  completed:Boolean(chunk.completed),
  rotationTerminal:Boolean(chunk.completed),
  repeatable:false,initialBoardMatchesFinal:false,
  balancedCycles:safeNumber(previous.balancedCycles)+chunk.balancedCycles,
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
  coverageRequested:perTier.length,
  // The first-fill fuel safety remains attached to the original preparation.
  // It does not claim that all later refills are fuel-wait-free.
 };
}
