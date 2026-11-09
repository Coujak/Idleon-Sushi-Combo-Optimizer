// Experimental 2.0: replay-tested full-upgrade preparation.
// This is a simulated benchmark, not a guaranteed in-game maximum.
export const EXPERIMENTAL_2_BENCHMARK=56315;
const TEMPLATE=[64,57,56,55,54,53,52,51,50,49,48,47,46,45,44,43,42,41,40,39,38,37,36,35,34,33,32,33,34,33,32,32,31,30,29,32,32,32,31,30,29,28,27,26,25,24,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,32,31,31,31,30,29,28,27,26,25,24,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,31,31,30,29,28,28,27,26,25,24];

export function buildExperimental2Candidates(positions,maxTier,cap,chainLimit,protectTier64=true){
  if(!protectTier64||maxTier!==64||cap!==58||chainLimit!==25)return [];
  const sorted=[...new Set(positions.filter(p=>Number.isInteger(p)&&p>=0&&p<120))].sort((a,b)=>a-b);
  // The 100 sushi must be continuous for the recorded Wind chains to work.
  // The entire sequence may be offset across any of the eight board rows.
  if(sorted.length!==100||sorted.some((p,i)=>p!==sorted[0]+i))return [];
  const board=Array(120).fill(0);
  TEMPLATE.forEach((tier,i)=>{board[sorted[i]]=tier;});
  return [{
    name:"Experimental 2.0 · Multi-wave Wind",
    base:23,
    shape:"Tier 23–34 Wind reserves",
    board
  }];
}
