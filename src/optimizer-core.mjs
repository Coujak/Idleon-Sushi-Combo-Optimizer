// Pure sushi-combo mechanics and a deterministic, multi-pass East Wind planner.
// Kept separate from the DOM so real gameplay sequences can be regression-tested.
export function simulateMerge(board,src,dst,cap,chainLimit){
  if(src===dst||board[src]<1||board[src]!==board[dst]||board[src]>=64)return null;
  const next=board.slice(),before=next[dst];
  next[src]=0;next[dst]=before+1;
  let score=next[dst];
  const events=[{at:dst,tier:next[dst],kind:"merge"}];
  if(src<dst&&before<=cap){
    let previous=before;
    for(let q=dst+1;q<next.length&&events.length-1<chainLimit;q++){
      const tier=next[q];
      if(tier<1||tier>=64||(q>dst+1&&tier!==previous-1))break;
      next[q]=tier+1;
      score+=next[q];
      events.push({at:q,tier:next[q],kind:"wind"});
      previous=tier;
    }
  }
  return {kind:"merge",board:next,score,events,src,dst};
}
export function simulateRelocation(board,src,dst,slots){
  if(!Number.isInteger(src)||!Number.isInteger(dst)||src===dst||
    src<0||dst<0||src>=board.length||dst>=board.length||
    board[src]<1||board[src]>=64||board[dst]!==0||
    (slots&&(slots[src]<0||slots[dst]<0)))return null;
  const next=board.slice(),tier=board[src];
  next[dst]=tier;next[src]=0;
  return {kind:"move",board:next,score:0,src,dst,tier,events:[]};
}
export function validateComboReplay(start,moves,cap,chainLimit,slots){
  let board=start.slice(),score=0,merges=0,repositions=0;
  for(let i=0;i<moves.length;i++){
    const expected=moves[i];
    const actual=expected.kind==="move"?
      simulateRelocation(board,expected.src,expected.dst,slots):
      simulateMerge(board,expected.src,expected.dst,cap,chainLimit);
    if(!actual||actual.score!==expected.score||
      actual.board.length!==expected.board.length||
      !actual.board.every((t,p)=>t===expected.board[p])){
      throw Error("Replay failed at action "+(i+1));
    }
    board=actual.board;score+=actual.score;
    if(expected.kind==="move")repositions++;else merges++;
  }
  return {board,score,merges,repositions};
}
function staircaseLength(board,start,base){
  let count=0;
  for(let tier=base+1;tier<64;tier++){
    if(!board.slice(0,start).includes(tier))break;
    count++;
  }
  return count;
}
function sweepFromSeed(initial,seed,cap,chainLimit,slots,maxCycles){
  let board=initial.slice(),score=0,moves=[],anchor=seed+1;
  const base=board[seed];
  function merge(src,dst){
    const event=simulateMerge(board,src,dst,cap,chainLimit);
    if(!event)return false;
    board=event.board;score+=event.score;moves.push(event);return true;
  }
  function shift(src,dst){
    const event=simulateRelocation(board,src,dst,slots);
    if(!event)return false;
    board=event.board;moves.push(event);return true;
  }
  function climb(){
    let progressed=false;
    for(let guard=0;guard<65;guard++){
      const tier=board[anchor];
      if(tier<1||tier>=64)break;
      // An existing staircase tier to the west can feed the growing pair.
      let src=-1;
      for(let i=anchor-1;i>=0;i--)if(board[i]===tier){src=i;break;}
      if(src<0||!merge(src,anchor))break;
      progressed=true;
    }
    // Once the western staircase is exhausted, merge the two tips.
    // Their new right-hand staircase becomes the seed for another pass.
    if(board[anchor]>0&&board[anchor]<64&&board[anchor+1]===board[anchor]&&
       merge(anchor,anchor+1)){
      anchor++;
      progressed=true;
    }
    return progressed;
  }
  if(!merge(seed,seed+1))return null;
  climb();
  for(let cycle=1;cycle<maxCycles;cycle++){
    // Locate the descending eastward chain and its lowest tier.
    let end=anchor,previous=board[end];
    while(end+1<board.length&&board[end+1]===previous-1&&previous>base+1){
      end++;previous=board[end];
    }
    if(previous!==base+1)break;
    const p=end+1,q=end+2;
    if(q+1>=board.length||board[p]!==base||board[q]!==base||board[q+1]!==base)break;
    // Merge spare base-tier sushi; Wind gives two (base+1) sushi.
    if(!merge(p,q))break;
    // Pack both next to the leftmost (base+1) sushi of the staircase.
    if(!shift(q,p)||!shift(q+1,q))break;
    // Key improvement observed in gameplay: feed an additional low-tier
    // sushi into Wind's path so it scores on every subsequent merge.
    if(q+2<board.length&&board[q+2]===base&&board[q+1]===0){
      shift(q+2,q+1);
    }
    anchor=p;
    climb();
  }
  return {board,score,moves,remaining:board.filter(t=>t>0).length,
    strategy:"Recycled East Wind staircase",strategiesTested:1};
}
export function searchStaircaseCombos(start,cap,chainLimit,slots,baseline=null,options={}){
  const maxSeeds=options.maxSeeds??12,maxCycles=options.maxCycles??5;
  let best=baseline;
  const seeds=[];
  for(let i=0;i+2<start.length;i++){
    const base=start[i];
    if(base<1||base>=64||start[i+1]!==base||start[i+2]!==base)continue;
    let run=0;
    while(i+run<start.length&&start[i+run]===base)run++;
    const ladder=staircaseLength(start,i,base);
    seeds.push({i,rank:ladder*1000+run*10-i*.01});
  }
  seeds.sort((a,b)=>b.rank-a.rank);
  for(const {i} of seeds.slice(0,maxSeeds)){
    const candidate=sweepFromSeed(start,i,cap,chainLimit,slots,maxCycles);
    if(candidate&&(!best||candidate.score>best.score||
       (candidate.score===best.score&&candidate.remaining<best.remaining))){
      best=candidate;
    }
  }
  return best;
}