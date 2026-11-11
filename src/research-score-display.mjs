// The running score is the best score DISCOVERED in this invocation.
// The saved record is tracked separately and may be much higher.
export function currentRunScore({splitResearch=false,runBest=null,solution=null}={}){
 if(splitResearch)return Number.isFinite(runBest)?runBest:null;
 const score=solution?.search?.score;
 return Number.isFinite(score)?score:null;
}
export function reachedCurrentRunGoal(goal,runBest){
 return Number.isSafeInteger(goal)&&goal>0&&
  Number.isFinite(runBest)&&runBest>=goal;
}

// Compare two fully evaluated search results without considering saved history.
export function betterRunCandidate(candidate,previous){
 if(!candidate?.search||!Number.isFinite(candidate.search.score))return false;
 if(!previous?.search)return true;
 return candidate.search.score>previous.search.score||
  (candidate.search.score===previous.search.score&&
   candidate.search.remaining<previous.search.remaining);
}
// The running optimizer (completed normally OR stopped early) shows its own
// strongest evaluated candidate. Only View saved best and a search with no
// new candidates should display the historical record.
export function selectDisplayedSearchResult(overallBest,currentRunBest,preferCurrentRun){
 if(!preferCurrentRun)return overallBest;
 if(!currentRunBest?.search)
  throw Error("No completed result from this run is available yet.");
 return currentRunBest;
}
