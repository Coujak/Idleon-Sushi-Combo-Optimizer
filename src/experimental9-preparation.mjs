// Accessible setup: supply-only slots 2–29 descend by tier; fixed Wind engine starts at slot 30.
// Experimental 9.0: 70,071 simulated Combo Meter points.
// Exactly 100 sushi, including one permanent Tier 64, with 91 merges,
// 1,851 Wind upgrades, zero relocations. Full replay verified.
// Not a proven maximum or an independently confirmed in-game score.
export const EXPERIMENTAL_9_BENCHMARK=70071;
const TEMPLATE=[64,55,54,53,52,51,51,50,49,48,47,46,45,44,43,42,41,40,39,38,37,36,35,34,34,33,32,32,31,32,32,31,30,29,28,27,26,25,24,23,22,21,20,19,18,17,16,15,14,13,12,11,10,34,33,32,31,30,29,28,27,26,25,24,23,22,21,20,19,18,17,16,15,14,13,12,11,10,31,31,30,29,28,27,26,25,24,23,22,21,20,19,18,17,16,15,14,13,12,11];
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
