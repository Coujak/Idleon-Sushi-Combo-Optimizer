// Pure Combo Meter reporting helpers, independent of browser DOM.
export function comparePreparedBoard(currentTiles,currentSlots,preparedBoard,preparedSlots){
 if(!Array.isArray(currentTiles)||!Array.isArray(currentSlots)||
  !Array.isArray(preparedBoard)||!Array.isArray(preparedSlots)||
  preparedBoard.length!==preparedSlots.length)throw Error("Incompatible sushi board arrays");
 const statuses=[];
 const counts={correct:0,misplaced:0,missing:0,wrongSlot:0,extra:0,locked:0,required:0};
 for(let i=0;i<preparedBoard.length;i++){
  const required=preparedSlots[i]>=0&&preparedBoard[i]>0;
  const unlocked=currentSlots[i]>=0,existing=currentTiles[i]>=0?currentTiles[i]+1:0;
  let status="locked";
  if(required){
   counts.required++;
   if(!unlocked||currentSlots[i]!==preparedSlots[i])status="wrongSlot";
   else if(existing===preparedBoard[i])status="correct";
   else if(existing===0)status="missing";
   else status="misplaced";
  }else if(unlocked&&existing>0)status="extra";
  if(Object.hasOwn(counts,status))counts[status]++;
  statuses.push(status);
 }
 return {statuses,counts,matching:counts.correct,needed:counts.required};
}
export function scoreBreakdown(moves){
 const summary={mergePoints:0,windPoints:0,manualMerges:0,windUpgrades:0,
  repositionCount:0,peakChain:0,chains:[],total:0};
 for(const move of moves??[]){
  if(move.kind==="move"){summary.repositionCount++;continue;}
  summary.manualMerges++;
  let wind=0,upgrades=0;
  for(const event of move.events??[]){
   if(event.kind==="wind"){wind+=event.tier;upgrades++;}
   else if(event.kind==="merge")summary.mergePoints+=event.tier;
  }
  summary.windPoints+=wind;
  summary.windUpgrades+=upgrades;
  summary.peakChain=Math.max(summary.peakChain,upgrades);
  if(upgrades)summary.chains.push({step:summary.manualMerges,windPoints:wind,upgrades});
 }
 summary.total=summary.mergePoints+summary.windPoints;
 summary.chains.sort((a,b)=>b.windPoints-a.windPoints||a.step-b.step);
 return summary;
}
export function preparationGroups(board,slots,sectionInfo){
 const groups=new Map();
 for(let i=0;i<board.length;i++){
  if(!(slots[i]>=0)||!(board[i]>0))continue;
  const section=sectionInfo?.roles?.[i]==="supply"?"Supply / tools":
   sectionInfo?.roles?.[i]==="chain"?"Wind engine":"All sushi";
  const key=section+"|"+board[i];
  if(!groups.has(key))groups.set(key,{section,tier:board[i],positions:[],count:0});
  const group=groups.get(key);
  group.positions.push(i+1);group.count++;
 }
 return [...groups.values()].sort((a,b)=>a.section.localeCompare(b.section)||
  b.tier-a.tier);
}
export function compareResearchBest(previous,current){
 if(!previous?.board||!current?.board)return null;
 const positions=[];
 for(let i=0;i<current.board.length;i++){
  if(current.board[i]!==previous.board[i])positions.push(i+1);
 }
 return {oldScore:previous.search.score,newScore:current.search.score,
  delta:current.search.score-previous.search.score,
  changedPositions:positions,
  oldSplit:previous.splitPercent??null,newSplit:current.splitPercent??null};
}
export function chooseCandidatesByBudget(candidates,budget){
 if(!Number.isSafeInteger(budget)||budget<1||candidates.length<=budget)return candidates;
 // Round-robin both directions so a short budget doesn't exclude one side.
 const supply=candidates.filter(c=>c.splitDirection==="supply");
 const engine=candidates.filter(c=>c.splitDirection==="engine");
 const result=[];
 let a=0,b=0;
 while(result.length<budget&&(a<supply.length||b<engine.length)){
  if(a<supply.length&&result.length<budget)result.push(supply[a++]);
  if(b<engine.length&&result.length<budget)result.push(engine[b++]);
 }
 return result;
}
