// Deeper search for a finalist's merge order. This preserves the original
// eight greedy policies and optimizes only the winning prepared board.
// Bounded to avoid exponential search; no repositioning is added.
import {simulateMerge} from "./optimizer-core.mjs";

export function rolloutEastWind(start,cap,chainLimit){
  let board=start.slice(),score=0,moves=[];
  const depth=start.filter(t=>t>0).length-1;
  for(let step=0;step<depth;step++){
    const byTier=new Map();
    board.forEach((tier,i)=>{if(tier>0&&tier<64){if(!byTier.has(tier))byTier.set(tier,[]);byTier.get(tier).push(i);}});
    let chosen=null,rank=-Infinity;
    for(const [,indices] of byTier){
      if(indices.length<2)continue;
      for(const dst of indices){
        const sources=indices.filter(i=>i!==dst);
        sources.sort((a,b)=>Math.abs(a-dst)-Math.abs(b-dst));
        for(const src of sources.slice(0,Math.min(4,sources.length))){
          const move=simulateMerge(board,src,dst,cap,chainLimit);
          const wind=move.events.length-1;
          const continues=dst+1<board.length&&move.board[dst+1]===move.board[dst]&&move.board[dst]<64;
          const priority=(continues?3000:0)+wind*350+(src===dst-1?400:0)-Math.abs(src-dst)*.1;
          if(priority>rank){rank=priority;chosen=move;}
        }
      }
    }
    if(!chosen)break;
    board=chosen.board;score+=chosen.score;moves.push(chosen);
  }
  return {board,score,moves,remaining:board.filter(x=>x>0).length,strategy:"East Wind rollout"};
}

function nextChoices(board,excluded,maxBranches,cap,chainLimit){
  const groups=new Map();
  board.forEach((tier,p)=>{if(tier>0&&tier<64){if(!groups.has(tier))groups.set(tier,[]);groups.get(tier).push(p);}});
  const choices=[];
  for(const positions of groups.values()){
    if(positions.length<2)continue;
    for(const dst of positions){
      for(const src of positions){
        if(src===dst)continue;
        const move=simulateMerge(board,src,dst,cap,chainLimit);
        const wind=move.events.length-1;
        const continues=dst+1<board.length&&move.board[dst+1]===move.board[dst]&&move.board[dst]<64;
        const priority=wind*1000+(continues?1300:0)+(src===dst-1?250:0)+move.score;
        choices.push({move,priority});
      }
    }
  }
  choices.sort((a,b)=>b.priority-a.priority);
  const selected=choices.slice(0,Math.min(12,maxBranches));
  for(const option of choices){
    if(option.move.src===excluded.src&&option.move.dst===excluded.dst)continue;
    if(option.move.events.length>=20&&!selected.includes(option))selected.push(option);
    if(selected.length>=maxBranches)break;
  }
  return selected.filter(({move})=>move.src!==excluded.src||move.dst!==excluded.dst).slice(0,maxBranches);
}

export function searchLookaheadCombos(start,cap,chainLimit,baseline=null,options={}){
  const maxPasses=Math.max(0,Math.min(5,options.maxPasses??3));
  const maxBranches=Math.max(1,Math.min(24,options.maxBranches??18));
  const maxEvaluations=Math.max(0,Math.min(10000,options.maxEvaluations??3500));
  let best=rolloutEastWind(start,cap,chainLimit),trials=0;
  for(let pass=0;pass<maxPasses;pass++){
    const original=best.moves;
    let score=0,improved=false;
    for(let step=0;step<original.length&&trials<maxEvaluations;step++){
      const board=step===0?start:original[step-1].board;
      for(const {move} of nextChoices(board,original[step],maxBranches,cap,chainLimit)){
        const suffix=rolloutEastWind(move.board,cap,chainLimit);
        const total=score+move.score+suffix.score;
        trials++;
        if(total>best.score){
          const moves=original.slice(0,step).concat(move,suffix.moves);
          const finalBoard=moves.length?moves.at(-1).board:start.slice();
          best={board:finalBoard,score:total,moves,
            remaining:finalBoard.filter(x=>x>0).length,strategy:"Deeper East Wind lookahead"};
          improved=true;
        }
        if(trials>=maxEvaluations)break;
      }
      score+=original[step].score;
    }
    if(!improved||trials>=maxEvaluations)break;
  }
  if(baseline&&(baseline.score>best.score||(baseline.score===best.score&&baseline.remaining<best.remaining)))return baseline;
  return {...best,strategiesTested:1,lookaheadEvaluations:trials};
}
