// Experimental 13.0 follow-up research: 76,645 replay-validated score.
// This is NOT Experiment 14.0. The 80,000 requirement remains unmet.
// A late pair swap adds two merges and 113 points without changing the
// 100-sushi preparation. Only the model is verified, not the in-game timer.
import {buildExperimental13Candidates,EXPERIMENTAL_13_BENCHMARK} from "./experimental13-preparation.mjs";
import {searchCombos} from "./merge-search.mjs";
import {simulateMerge,simulateRelocation,validateComboReplay} from "./optimizer-core.mjs";

export const EXPERIMENT13_REPOSITION_SCORE=76645;
export const EXPERIMENT13_REPOSITION_START_ACTION=75;
// Indexes are zero-based. Swap sushi at columns 81 and 85 using the
// empty column 2 as workspace. Every relocation is individually legal.
export const EXPERIMENT13_REPOSITION_ACTIONS=Object.freeze([
 [80,1],[84,80],[1,84]
]);
// These merges were found by the deterministic East Wind rollout after
// relocation and independently replay-verified against the core simulator.
// Preserve explicit steps so later heuristic changes cannot alter the score.
export const EXPERIMENT13_REPOSITION_SUFFIX=Object.freeze([
 [83,84],[79,84],[80,86],[85,86],
 [9,91],[90,91],[89,91],[88,91],[87,91],[86,91],
 [8,97],[96,97],[95,97],[94,97],[93,97],[92,97],
 [49,50],[97,91],[84,74],[91,74]
]);

export function buildExperiment13RepositionResearch(offset=0){
 if(!Number.isInteger(offset)||offset<0||offset>20)
  throw new RangeError("Experiment 13 research requires a 100-slot contiguous block");
 const positions=Array.from({length:100},(_,i)=>i+offset);
 const [candidate]=buildExperimental13Candidates(positions,64,58,25,true);
 const board=candidate.board;
 const slots=Array.from({length:120},(_,i)=>i>=offset&&i<offset+100?0:-1);
 const baseline=searchCombos(board,58,25,4,99,"descending domino",64);
 if(baseline.score!==EXPERIMENTAL_13_BENCHMARK)
  throw Error("Experiment 13 benchmark changed; research replay must be reviewed");
 const moves=baseline.moves.slice(0,EXPERIMENT13_REPOSITION_START_ACTION);
 let state=moves.at(-1).board;
 for(const [src,dst] of EXPERIMENT13_REPOSITION_ACTIONS){
  const relocation=simulateRelocation(state,src+offset,dst+offset,slots,64);
  if(!relocation)throw Error("Invalid research relocation "+(src+offset)+" → "+(dst+offset));
  moves.push(relocation);state=relocation.board;
 }
 for(const [src,dst] of EXPERIMENT13_REPOSITION_SUFFIX){
  const merge=simulateMerge(state,src+offset,dst+offset,58,25,64);
  if(!merge)throw Error("Invalid research merge "+(src+offset)+" → "+(dst+offset));
  moves.push(merge);state=merge.board;
 }
 const replay=validateComboReplay(board,moves,58,25,slots,64);
 if(replay.score!==EXPERIMENT13_REPOSITION_SCORE||
    replay.merges!==95||replay.repositions!==3)
  throw Error("Experiment 13 reposition score mismatch");
 const windUpgrades=moves.reduce((sum,move)=>
  sum+move.events.filter(e=>e.kind==="wind").length,0);
 if(windUpgrades!==1925)
  throw Error("Expected 1,925 Wind upgrades");
 return {name:"Experiment 13 follow-up · late relocation",
  researchOnly:true,board,moves,score:replay.score,
  merges:replay.merges,repositions:replay.repositions,windUpgrades,
  improvement:replay.score-EXPERIMENTAL_13_BENCHMARK,
  caveat:"Simulated replay only; not a published Experiment 14.0 or an in-game guaranteed score."};
}
