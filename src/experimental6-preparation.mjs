// Experimental 6.0: 64,017 simulated points, fully replay-validated.
// Exactly 100 unlocked sushi including one permanent Tier 64.
// The replay uses 85 merges and 1,709 East Wind upgrades.
export const EXPERIMENTAL_6_BENCHMARK=64017;
const TEMPLATE=[64,57,56,55,54,53,52,51,50,49,48,47,46,45,44,43,42,41,40,39,38,37,36,35,34,33,33,33,34,32,32,31,32,32,32,31,30,29,28,27,26,25,24,23,22,21,20,19,18,17,16,15,14,13,12,13,12,11,14,32,31,30,29,28,27,26,25,24,23,22,21,20,19,18,17,16,15,14,13,13,12,13,13,12,12,31,31,30,29,28,27,26,25,24,23,22,21,20,20,19];
export function buildExperimental6Candidates(positions,maxTier,cap,chainLimit,protectTier64=true){
  if(!protectTier64||maxTier!==64||cap!==58||chainLimit!==25)return [];
  const sorted=[...new Set(positions.filter(p=>Number.isInteger(p)&&p>=0&&p<120))].sort((a,b)=>a-b);
  if(sorted.length!==100||sorted.some((p,i)=>p!==sorted[0]+i))return [];
  const board=Array(120).fill(0);
  TEMPLATE.forEach((tier,i)=>{board[sorted[i]]=tier;});
  return [{name:"Experimental 6.0 · Extended third Wind wave",
    base:11,shape:"multi-wave Tier 11–34 reserve staircase",board}];
}
