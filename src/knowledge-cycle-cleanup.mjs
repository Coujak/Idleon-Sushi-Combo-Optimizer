// Legal cleanup: repeatedly merge equal-tier Sushi, preserving the exact
// permanent board anchors. Never delete, overwrite or teleport a Sushi.
// A T64+T64 merge leaves one T64, as implemented in optimizer-core.
import {simulateMerge,validateComboReplay} from "./optimizer-core.mjs";

export function finishSushiBoard(start,slots,windCap,chainLimit,protectedIndices=[]){
 const board=start.slice();
 const keep=new Set(protectedIndices);
 const expected=protectedIndices.map(i=>board[i]);
 const moves=[];
 let current=board;
 for(let step=0;step<start.length;step++){
  const byTier=new Map();
  current.forEach((tier,i)=>{
   if(slots[i]<0||tier<=0)return;
   if(!byTier.has(tier))byTier.set(tier,[]);
   byTier.get(tier).push(i);
  });
  let winner=null,rank=-Infinity;
  // Merge low tiers first to carry them upward; T64 self-merges can fold
  // extra highest-tier copies into an existing protected T64.
  const tiers=[...byTier.keys()].sort((a,b)=>a-b);
  for(const tier of tiers){
   const positions=byTier.get(tier);
   if(positions.length<2)continue;
   const destinations=positions.filter(i=>!keep.has(i)||
    tier===64&&expected[protectedIndices.indexOf(i)]===64);
   for(const dst of destinations){
    const sources=positions.filter(src=>src!==dst&&!keep.has(src));
    for(const src of sources){
     const action=simulateMerge(current,src,dst,windCap,chainLimit,64);
     if(!action)continue;
     if(protectedIndices.some((pos,index)=>action.board[pos]!==expected[index]))continue;
     if(action.events.some(event=>slots[event.at]<0))continue;
     const wind=action.events.length-1;
     // Lowest tier pairing promotes carry chains; Wind upgrades help when
     // they create extra legal matching pairs in the resulting board.
     const score=(64-tier)*100+wind*8+
      (tier===64&&keep.has(dst)?5000:0)-
      Math.abs(src-dst)*.01;
     if(score>rank){rank=score;winner=action;}
    }
   }
  }
  if(!winner)break;
  moves.push(winner);
  current=winner.board;
 }
 const replay=validateComboReplay(start,moves,windCap,chainLimit,slots,64);
 if(!replay.board.every((tier,i)=>tier===current[i]))
  throw Error("Sushi cleanup replay diverged");
 const leftover=current.flatMap((tier,i)=>tier>0&&!keep.has(i)?
  [{position:i,tier}]:[]);
 const repeatable=leftover.length===0&&protectedIndices.every((i,j)=>
  current[i]===expected[j]);
 return {moves,board:current,leftover,repeatable,mergeCount:moves.length};
}
