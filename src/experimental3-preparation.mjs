// Accessible setup: supply-only slots 2–30 descend by tier; fixed Wind engine starts at slot 31.
// Experimental 3.0: 57,328 simulated points, verified by a complete replay.
// One permanent Tier 64, 99 additional sushi. Maximum 100 unlocked plates.
// This is a heuristic benchmark, not an in-game score or proven global optimum.
export const EXPERIMENTAL_3_BENCHMARK=57328;
const TEMPLATE=[64,57,56,55,54,53,52,51,50,49,48,47,46,45,44,43,42,41,40,39,38,37,36,35,34,34,33,33,33,32,32,32,31,30,29,32,32,32,31,30,29,28,27,26,25,24,23,22,21,21,24,23,22,23,22,21,21,21,21,21,21,22,32,31,31,31,30,29,28,27,26,25,24,23,22,21,21,21,21,21,21,22,21,21,21,21,21,22,21,24,31,31,30,29,28,28,27,26,25,24];

export function buildExperimental3Candidates(positions,maxTier,cap,chainLimit,protectTier64=true){
  if(!protectTier64||maxTier!==64||cap!==58||chainLimit!==25)return [];
  const sorted=[...new Set(positions.filter(p=>Number.isInteger(p)&&p>=0&&p<120))].sort((a,b)=>a-b);
  if(sorted.length!==100||sorted.some((p,i)=>p!==sorted[0]+i))return [];
  const board=Array(120).fill(0);
  TEMPLATE.forEach((tier,i)=>{board[sorted[i]]=tier;});
  return [{name:"Experimental 3.0 · Layered multi-wave Wind",
    base:21,shape:"layered Tier 21–34 reserves",board}];
}
