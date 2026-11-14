// Whether a Knowledge walkthrough can make another legal move or refill.
// Refills and action budgets are preview boundaries, not game completion.
import {simulateMerge} from "./optimizer-core.mjs";

export function canExtendKnowledgeRotation(plan){
 if(!["balanced","focused"].includes(plan?.mode)||plan?.completed||plan?.rotationTerminal||
   !Array.isArray(plan.finalBoard)||!Array.isArray(plan.layout?.slots)||
   plan.finalBoard.length!==120||plan.layout.slots.length!==120)return false;
 const slots=plan.layout.slots;
 const board=plan.finalBoard;
 const guarded=new Set(plan.protectedIndices??[]);
 // An empty unlocked plate can always receive another sushi (provided
 // the saved recipe still has a cookable tier, validated by the worker).
 if(board.some((tier,i)=>slots[i]>=0&&tier===0&&!guarded.has(i)))return true;
 const pairs=new Map();
 board.forEach((tier,i)=>{
  if(tier>0&&slots[i]>=0){
   if(!pairs.has(tier))pairs.set(tier,[]);
   pairs.get(tier).push(i);
  }
 });
 // A full board can also be continued if any legal equal-tier merge frees
 // a plate without consuming a protected or original T64 as the source.
 for(const [tier,positions] of pairs){
  if(positions.length<2)continue;
  for(const src of positions){
   if(guarded.has(src)||tier===64&&board[src]===64&&
      (plan.protectedIndices??[]).includes(src))continue;
   for(const dst of positions){
    if(dst===src||(guarded.has(dst)&&tier!==64))continue;
    const move=simulateMerge(board,src,dst,plan.windCap??0,
     (plan.windCap??0)>0?25:0,64);
    if(move&&move.events.every(event=>slots[event.at]>=0)&&
      [...guarded].every(i=>move.board[i]===board[i]))return true;
   }
  }
 }
 return false;
}

// Preserve compatibility with the existing Balanced usage and tests.
export const canExtendBalancedRotation=canExtendKnowledgeRotation;
