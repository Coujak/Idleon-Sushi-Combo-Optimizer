// Score milestones are certification thresholds, not algorithm versions.
// A new numbered showcase is earned only by replaying every move legally.
import {validateComboReplay} from "./optimizer-core.mjs";

export const COMBO_FIRST_NEW_MILESTONE=80000;
export const COMBO_MILESTONE_INCREMENT=5000;
export const COMBO_FIRST_NEW_EXPERIMENT=14;
export const COMBO_MILESTONE_RULES=Object.freeze({
 maximumTier:64,windCap:58,chainLimit:25,boardLength:120,unlockedSlots:100
});

export function targetForExperiment(number){
 if(!Number.isSafeInteger(number)||number<COMBO_FIRST_NEW_EXPERIMENT)
  throw new RangeError("Milestone experiment numbers start at 14");
 return COMBO_FIRST_NEW_MILESTONE+(number-COMBO_FIRST_NEW_EXPERIMENT)*COMBO_MILESTONE_INCREMENT;
}
export function nextComboMilestone(score){
 if(!Number.isFinite(score)||score<COMBO_FIRST_NEW_MILESTONE)
  return {number:14,target:COMBO_FIRST_NEW_MILESTONE};
 const number=14+Math.floor((score-COMBO_FIRST_NEW_MILESTONE)/COMBO_MILESTONE_INCREMENT)+1;
 return {number,target:targetForExperiment(number)};
}
export function certifyComboMilestone(board,moves,experimentNumber,{offset=0}={}){
 const target=targetForExperiment(experimentNumber);
 if(!Array.isArray(board)||board.length!==120||
   !Number.isInteger(offset)||offset<0||offset>20||
   board.some((tier,i)=>(i>=offset&&i<offset+100)?
    !Number.isInteger(tier)||tier<1||tier>64:tier!==0))
  throw new Error("Candidate must have exactly 100 contiguous filled cells");
 if(board[offset]!==64||board.filter(x=>x===64).length!==1)
  throw new Error("The protected tier 64 must be present exactly once in the first slot");
 if(!Array.isArray(moves)||moves.length<1)
  throw new Error("A complete merge sequence is required");
 const slots=Array.from({length:120},(_,i)=>i>=offset&&i<offset+100?0:-1);
 const actual=validateComboReplay(board,moves,58,25,slots,64);
 const illegalWind=moves.some(move=>
  move.events?.filter(e=>e.kind==="wind").length>25);
 if(illegalWind)throw new Error("Wind chain exceeded the 25-upgrade limit");
 if(actual.score<target)
  throw new Error("Experiment "+experimentNumber+" requires "+target+
    " points; valid replay scored "+actual.score);
 return {number:experimentNumber,target,score:actual.score,
  merges:actual.merges,repositions:actual.repositions,
  windUpgrades:moves.reduce((sum,move)=>
   sum+(move.events?.filter(e=>e.kind==="wind").length??0),0),
  board:board.slice(),moves,validated:true,
  caution:"Simulation-validated score; real-game timer and unexpected tier-up effects are not guaranteed."};
}
