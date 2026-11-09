// Experimental 9.0: 70,071 simulated Combo Meter points.
// Exactly 100 sushi, including one permanent Tier 64, with 91 merges,
// 1,851 Wind upgrades, zero relocations. Full replay verified.
// Not a proven maximum or an independently confirmed in-game score.
export const EXPERIMENTAL_9_BENCHMARK=70071;
const TEMPLATE=[64,38,55,34,42,39,50,34,32,51,35,46,44,37,32,40,43,47,52,54,36,51,41,53,48,31,33,49,45,32,32,31,30,29,28,27,26,25,24,23,22,21,20,19,18,17,16,15,14,13,12,11,10,34,33,32,31,30,29,28,27,26,25,24,23,22,21,20,19,18,17,16,15,14,13,12,11,10,31,31,30,29,28,27,26,25,24,23,22,21,20,19,18,17,16,15,14,13,12,11];
export function buildExperimental9Candidates(positions,maxTier,cap,chainLimit,protectTier64=true){
  if(!protectTier64||maxTier!==64||cap!==58||chainLimit!==25)return [];
  const sorted=[...new Set(positions.filter(p=>Number.isInteger(p)&&p>=0&&p<120))].sort((a,b)=>a-b);
  if(sorted.length!==100||sorted.some((p,i)=>p!==sorted[0]+i))return [];
  const board=Array(120).fill(0);
  TEMPLATE.forEach((tier,i)=>{board[sorted[i]]=tier;});
  return [{
    name:"Experimental 9.0 · 70K Wind chains",
    base:10,
    shape:"Three-stage extended Wind staircase",
    board
  }];
}
