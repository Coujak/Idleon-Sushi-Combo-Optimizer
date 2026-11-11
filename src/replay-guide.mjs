// Pure, one-based instructions for preparing and following Sushi Station merges.
// Step N shows the state AFTER action N; the next actionable move is N + 1.
export function replayPosition(index,columns=15){
 if(!Number.isInteger(index)||index<0||!Number.isInteger(columns)||columns<1)
  throw Error("Invalid replay position");
 return {position:index+1,row:Math.floor(index/columns)+1,column:index%columns+1};
}
export function summarizeReplayMove(move,before,columns=15){
 if(!move||!Array.isArray(before))throw Error("A replay move and its pre-move board are required");
 const source=replayPosition(move.src,columns);
 const destination=replayPosition(move.dst,columns);
 const fromTier=move.kind==="move"?(move.tier??before[move.src]):before[move.src];
 const windEvents=(move.events??[]).filter(event=>event.kind==="wind");
 const windPoints=windEvents.reduce((total,event)=>total+event.tier,0);
 const mergePoints=move.kind==="move"?0:move.score-windPoints;
 return {
  kind:move.kind==="move"?"move":"merge",
  source,destination,fromTier,
  toTier:move.kind==="move"?fromTier:fromTier+1,
  windUpgrades:windEvents.length,windPoints,
  mergePoints,score:move.score,
  action:move.kind==="move"?"Relocate":"Merge",
  short:"T"+fromTier+" · "+source.position+" → "+destination.position,
  instruction:move.kind==="move"?
   "Move Tier "+fromTier+" from position "+source.position+
    " (R"+source.row+" C"+source.column+") to the empty position "+
    destination.position+" (R"+destination.row+" C"+destination.column+").":
   "Merge Tier "+fromTier+" at position "+source.position+
    " (R"+source.row+" C"+source.column+") into the matching Tier "+
    fromTier+" at position "+destination.position+" (R"+
    destination.row+" C"+destination.column+").",
  outcome:move.kind==="move"?
   "The sushi changes position; no combo points are earned.":
   "Creates Tier "+(fromTier+1)+" · +"+move.score.toLocaleString()+
    " points"+(windEvents.length?" · "+windEvents.length+
    " Wind upgrades (+"+windPoints.toLocaleString()+" points)":" · no Wind upgrades")
 };
}
export function buildReplayGuide(initial,moves,columns=15){
 if(!Array.isArray(initial)||!Array.isArray(moves))throw Error("Invalid replay input");
 let before=initial;
 return moves.map((move,i)=>{
  const info=summarizeReplayMove(move,before,columns);
  before=move.board;
  return {...info,step:i+1};
 });
}
export function nextWindReplayStep(moves,selectedStep){
 for(let index=Math.max(0,selectedStep);index<moves.length;index++){
  if((moves[index].events??[]).some(event=>event.kind==="wind"))return index+1;
 }
 return null;
}
