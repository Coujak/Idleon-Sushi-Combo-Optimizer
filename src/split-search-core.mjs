// Pure candidate evaluation shared by sequential and parallel split searches.
// Running the same routine in a Worker must not change search quality.
import {searchCombos} from "./merge-search.mjs";
import {searchStaircaseCombos} from "./optimizer-core.mjs";

export function betterSplitResult(candidate,best){
 return !best||candidate.search.score>best.search.score||
  (candidate.search.score===best.search.score&&
   candidate.search.remaining<best.search.remaining);
}
export function evaluateSplitCandidate(candidate,cap,chain,mode,maxTier){
 const depth=candidate.board.filter(tier=>tier>0).length-1;
 const greedy=searchCombos(candidate.board,cap,chain,4,depth,mode,maxTier);
 const search=searchStaircaseCombos(candidate.board,cap,chain,candidate.slots,
  greedy,{maximumTier:maxTier});
 return {...candidate,search};
}
