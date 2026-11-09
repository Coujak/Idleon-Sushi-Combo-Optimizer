// Experimental 7.0: 65,542 simulated points (goal: 65,000).
// This prepared board has exactly 100 sushi, one permanent Tier 64.
// Fully replay-validated: 85 merges, 1,759 East Wind upgrades, no relocations.
// Scores are model predictions, not game-confirmed or globally optimal.
export const EXPERIMENTAL_7_BENCHMARK=65542;
const TEMPLATE=[64,57,56,33,37,52,51,50,49,41,40,39,32,38,53,46,35,34,33,54,34,48,47,36,45,44,43,42,32,32,31,32,32,31,30,29,28,27,26,25,24,23,22,21,20,19,18,17,16,15,14,13,12,11,10,9,8,32,31,30,29,28,27,26,25,24,23,22,21,20,19,18,17,16,15,14,13,12,11,10,9,11,31,31,30,29,28,27,26,25,24,23,22,21,20,19,18,24,25,25];
export function buildExperimental7Candidates(positions,maxTier,cap,chainLimit,protectTier64=true){
  if(!protectTier64||maxTier!==64||cap!==58||chainLimit!==25)return [];
  const sorted=[...new Set(positions.filter(p=>Number.isInteger(p)&&p>=0&&p<120))].sort((a,b)=>a-b);
  if(sorted.length!==100||sorted.some((p,i)=>p!==sorted[0]+i))return [];
  const board=Array(120).fill(0);
  TEMPLATE.forEach((tier,i)=>{board[sorted[i]]=tier;});
  return [{name:"Experimental 7.0 · 65K Wind chains",
    base:8,shape:"multi-wave Tier 8–54 reserve arrangement",board}];
}
