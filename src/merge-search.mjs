// Scoring-first merge policies, independent of the browser UI.
// Exported so candidate preparation scores can be regression-tested.
import {simulateMerge} from "./optimizer-core.mjs";

export function searchCombos(start,cap,chainLimit,beamWidth,depth,mode="adjacent"){
  // Multiple deterministic policies reduce the chance of one greedy dead-end.
  let best=null;
  const strategies=["East Wind chains","Low-tier setup","Immediate points","Preserve future pairs","Right-to-left staircase","Long-chain setup","High-tier merges","Compact merges"];
  for(let policy=0;policy<strategies.length;policy++){
    let board=start.slice(),score=0,moves=[];
    for(let step=0;step<depth;step++){
      const byTier=new Map();
      board.forEach((tier,i)=>{if(tier>0&&tier<64){if(!byTier.has(tier))byTier.set(tier,[]);byTier.get(tier).push(i);}});
      let chosen=null,rank=-Infinity;
      for(const [tier,indices] of byTier){
        if(indices.length<2)continue;
        for(const dst of indices){
          const east=dst+1;
          const sources=indices.filter(i=>i!==dst);
          sources.sort((a,b)=>Math.abs(a-dst)-Math.abs(b-dst));
          for(const src of sources.slice(0,Math.min(4,sources.length))){
            const move=simulateMerge(board,src,dst,cap,chainLimit);
            if(!move)continue;
            const wind=move.events.length-1;
            const continues=east<120&&move.board[east]===move.board[dst]&&move.board[dst]<64;
            const pairs=new Map();
            move.board.forEach(t=>{if(t>0&&t<64)pairs.set(t,(pairs.get(t)||0)+1);});
            const remainingPairs=[...pairs.values()].reduce((sum,n)=>sum+Math.floor(n/2),0);
            const rightToLeft=src>dst;
            const staircaseContinuation=rightToLeft&&tier<cap&&board.some((t,i)=>i<dst&&t===tier+1);
            const r=(policy===4?(rightToLeft?7000:-1000)+(staircaseContinuation?2500:0)-tier*75+move.score*.1:
              policy===5?wind*1000+(continues?2500:0)+(rightToLeft&&staircaseContinuation?2200:0)-tier*15:
              policy===6?move.score*8+tier*12+wind*90:
              policy===7?remainingPairs*75-Math.abs(src-dst)*25+wind*80:
              (continues?3000:0)+wind*(policy===0?350:policy===1?150:500)+
              (src===dst-1?400:0)+(policy===2?move.score*5:policy===3?remainingPairs*20:0)+
              (policy===1?-tier:0)-Math.abs(src-dst)*.1);
            if(r>rank){rank=r;chosen=move;}
          }
        }
      }
      if(!chosen)break;
      board=chosen.board;score+=chosen.score;moves.push(chosen);

    }
    const result={board,score,moves,remaining:board.filter(t=>t>0).length,strategy:strategies[policy],strategiesTested:strategies.length};
    if(!best||result.score>best.score||(result.score===best.score&&result.remaining<best.remaining))best=result;
  }
  return best;
}
