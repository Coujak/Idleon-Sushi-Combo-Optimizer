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
