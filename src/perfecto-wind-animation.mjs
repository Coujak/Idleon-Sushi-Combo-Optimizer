// Derive purely visual intermediate frames from one already-validated merge.
// A Heat of the East Wind cascade remains ONE user action in the step count.
// Each upgraded sushi is animated automatically, without mutating the recipe
// or inventing extra cooks/merges.
export function perfectoWindAnimationFrames(previous,action){
 if(action?.kind!=="merge"||!previous||!action?.board||
    !Number.isInteger(action.src)||!Number.isInteger(action.dst))
  return [];
 const wind=action.events?.filter(e=>e.kind==="wind")??[];
 if(!wind.length)return [];
 const merge=action.events?.[0];
 if(merge?.kind!=="merge"||merge.at!==action.dst||
    !Number.isInteger(merge.tier)||wind.length>25)return [];
 const before=Array.from(previous),final=Array.from(action.board);
 if(before.length!==final.length||before[action.src]<1||
    before[action.src]!==before[action.dst]||
    merge.tier!==before[action.dst]+1)return [];
 const board=before.slice();
 board[action.src]=0;
 board[action.dst]=merge.tier;
 const frames=[{board:Uint8Array.from(board),at:action.dst,
  windIndex:0,windTotal:wind.length,phase:"merge",tier:merge.tier}];
 let prevAt=action.dst;
 for(const [index,effect] of wind.entries()){
  if(!Number.isInteger(effect.at)||effect.at!==prevAt+1||
     effect.at>=board.length||!Number.isInteger(effect.tier)||
     effect.tier!==board[effect.at]+1||board[effect.at]<1)
   return [];
  board[effect.at]=effect.tier;
  frames.push({board:Uint8Array.from(board),at:effect.at,
   windIndex:index+1,windTotal:wind.length,phase:"wind",
   tier:effect.tier});
  prevAt=effect.at;
 }
 if(!board.every((tier,i)=>tier===final[i]))return [];
 return frames;
}
