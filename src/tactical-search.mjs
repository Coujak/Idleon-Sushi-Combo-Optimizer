import {simulateMerge,simulateRelocation} from "./optimizer-core.mjs";

// Bounded tactical beam search: considers ordinary merges and repositioning
// a single sushi into an East Wind chain before a merge. Unlike the staircase
// planner, this works on irregular, user-edited boards as well.
function samplePositions(positions,max=24){
  if(positions.length<=max)return positions;
  const picked=new Set();
  for(let i=0;i<max;i++)picked.add(positions[Math.round(i*(positions.length-1)/(max-1))]);
  return [...picked];
}
function tacticalPairs(board,cap,chainLimit,branchLimit,maximumTier){
  const byTier=new Map();
  for(let i=0;i<board.length;i++){
    const tier=board[i];
    if(tier<1||tier>=maximumTier)continue;
    if(!byTier.has(tier))byTier.set(tier,[]);
    byTier.get(tier).push(i);
  }
  const choices=[];
  for(const group of byTier.values()){
    const positions=samplePositions(group);
    for(const dst of positions){
      for(const src of positions){
        if(src===dst)continue;
        const move=simulateMerge(board,src,dst,cap,chainLimit,maximumTier);
        const wind=move.events.length-1;
        // Immediate points plus an incentive to preserve a useful pair.
        const canContinue=board.some((t,i)=>i!==src&&i!==dst&&t===board[dst]+1);
        choices.push({move,priority:move.score+wind*2+(canContinue?16:0)-Math.abs(src-dst)*.02});
      }
    }
  }
  choices.sort((a,b)=>b.priority-a.priority);
  return choices.slice(0,branchLimit).map(c=>c.move);
}
function tacticalTransitions(board,direct,cap,chainLimit,slots,branchLimit,allowDelayedPrep,maximumTier){
  const candidates=[{board:direct.board,score:direct.score,moves:[direct]}];
  if(direct.src>=direct.dst||direct.events.length-1>=chainLimit)return candidates;
  const gap=direct.dst+direct.events.length;
  if(gap>=board.length||board[gap]!==0||(slots&&!(slots[gap]>=0)))return candidates;
  const last=direct.events.at(-1);
  const needed=last.kind==="merge"?board[direct.dst]:board[last.at]-1;
  // First target: any tier below the merged sushi. Later targets: one
  // lower than the preceding pre-upgrade tier (or equal, for delayed prep).
  const possible=[];
  for(let src=0;src<board.length;src++){
    const tier=board[src];
    if(src===direct.src||src===direct.dst||src===gap||tier<1||tier>=maximumTier||
      (last.kind==="merge"?tier>needed:(tier!==needed-1&&(!allowDelayedPrep||tier!==needed))))continue;
    const relocation=simulateRelocation(board,src,gap,slots,maximumTier);
    if(!relocation)continue;
    const merge=simulateMerge(relocation.board,direct.src,direct.dst,cap,chainLimit,maximumTier);
    if(merge){
      const gain=merge.score-direct.score;
      const canRepeat=merge.board.some((t,i)=>i!==direct.dst&&t===merge.board[direct.dst]);
      if(gain>0||(gain===0&&allowDelayedPrep&&canRepeat)){
        possible.push({board:merge.board,score:merge.score,
          moves:[relocation,merge],gain});
      }
    }
  }
  possible.sort((a,b)=>b.gain-a.gain);
  return candidates.concat(possible.slice(0,Math.min(3,branchLimit)));
}
export function searchTacticalCombos(start,cap,chainLimit,slots,baseline=null,options={}){
  const maximumTier=options.maximumTier??64;
  const width=Math.max(1,Math.min(32,options.width??10));
  const allowRelocations=options.allowRelocations!==false;
  const allowDelayedPrep=options.allowDelayedPrep!==false;
  const branchLimit=Math.max(1,Math.min(32,options.branchLimit??14));
  const depth=Math.max(0,Math.min(start.filter(t=>t>0).length-1,options.depth??12));
  const key=b=>b.join(",");
  const pairs=b=>{
    const counts=new Map();
    for(const tier of b)if(tier>0&&tier<maximumTier)counts.set(tier,(counts.get(tier)||0)+1);
    let count=0;for(const n of counts.values())count+=Math.floor(n/2);
    return count;
  };
  let best=baseline;
  let frontier=[{board:start.slice(),score:0,moves:[],remaining:start.filter(t=>t>0).length}];
  for(let step=0;step<depth&&frontier.length;step++){
    const next=new Map();
    for(const state of frontier){
      const directChoices=tacticalPairs(state.board,cap,chainLimit,branchLimit,maximumTier);
      for(const merge of directChoices){
        for(const transition of (allowRelocations?
          tacticalTransitions(state.board,merge,cap,chainLimit,slots,branchLimit,allowDelayedPrep,maximumTier):
          [{board:merge.board,score:merge.score,moves:[merge]}])){
          const score=state.score+transition.score;
          const moves=state.moves.concat(transition.moves);
          const candidate={board:transition.board,score,moves,
            remaining:state.remaining-1};
          if(!best||candidate.score>best.score||
            (candidate.score===best.score&&candidate.remaining<best.remaining)){
            best={...candidate,strategy:"Tactical Wind setup search",strategiesTested:1};
          }
          const id=key(candidate.board);
          const previous=next.get(id);
          if(!previous||candidate.score>previous.score||
            (candidate.score===previous.score&&candidate.moves.length<previous.moves.length)){
            next.set(id,candidate);
          }
        }
      }
    }
    frontier=[...next.values()]
      .sort((a,b)=>(b.score+pairs(b.board)*8)-(a.score+pairs(a.board)*8))
      .slice(0,width);
  }
  return best;
}
