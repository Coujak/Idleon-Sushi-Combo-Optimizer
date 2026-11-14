// Repack surviving Sushi into a repeatable staircase using legal moves only.
// A vacant slot is required to relocate Sushi; nothing is swapped, deleted,
// overwritten, or moved through a locked plate. T64 never moves.
import {simulateRelocation} from "./optimizer-core.mjs";

export function packSushiStaircase(startingBoard,slots,direction="ascending",maximumTier=64,protectedIndices=[]){
 if(!Array.isArray(startingBoard)||!Array.isArray(slots)||
    startingBoard.length!==slots.length)throw Error("Invalid Sushi staircase board");
 const board=startingBoard.slice(),actions=[],locked=new Set();
 const protectedSet=new Set(protectedIndices);
 const playable=board.flatMap((tier,i)=>slots[i]>=0&&tier!==maximumTier&&!protectedSet.has(i)?[i]:[]);
 const survivors=playable.map(i=>board[i]).filter(tier=>tier>0)
  .sort((a,b)=>direction==="descending"?b-a:a-b);
 if(!survivors.length||survivors.length===playable.length)
  return {board,actions,complete:survivors.length===0};
 const destinations=playable.slice(0,survivors.length);
 for(let j=0;j<destinations.length;j++){
  const target=destinations[j],tier=survivors[j];
  if(board[target]===tier){locked.add(target);continue;}
  const source=playable.find(i=>!locked.has(i)&&board[i]===tier&&i!==target);
  if(source===undefined)break;
  if(board[target]!==0){
   // First free cell outside the sorted prefix is used as a temporary buffer.
   const buffer=playable.findLast(i=>board[i]===0&&!locked.has(i)&&i!==source);
   if(buffer===undefined)break;
   const displaced=simulateRelocation(board,target,buffer,slots,maximumTier);
   if(!displaced)break;
   board.splice(0,board.length,...displaced.board);
   actions.push(displaced);
  }
  const placed=simulateRelocation(board,source,target,slots,maximumTier);
  if(!placed)break;
  board.splice(0,board.length,...placed.board);
  actions.push(placed);
  locked.add(target);
 }
 const complete=destinations.every((pos,j)=>board[pos]===survivors[j]);
 return {board,actions,complete,direction};
}
