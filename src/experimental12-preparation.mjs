// Experimental 12.0: 75,546 simulated points using bounded merge lookahead.
// Initial board: 100 sushi, one permanent Tier 64. Score uses 96 merges,
// 1,881 Wind upgrades, and no repositioning actions. Independently replay-validated.
// Does not claim that the 80,000-point target is achieved or impossible.
export const EXPERIMENTAL_12_BENCHMARK=75546;
export const EXPERIMENTAL_12_GREEDY=75318;
const TEMPLATE=[64,51,47,45,52,54,56,49,55,34,55,53,42,48,33,34,50,44,54,46,56,54,43,55,42,42,41,40,39,38,37,36,35,34,33,32,31,30,29,28,27,26,25,24,23,22,21,20,19,18,34,33,32,31,30,29,28,27,26,25,24,23,22,21,20,19,18,17,16,15,14,13,12,11,36,34,32,31,30,29,28,27,26,25,24,23,22,21,20,19,18,17,16,15,14,13,12,11,10,10];
export function buildExperimental12Candidates(positions,maxTier,cap,chainLimit,protectTier64=true){
  if(!protectTier64||maxTier!==64||cap!==58||chainLimit!==25)return [];
  const sorted=[...new Set(positions.filter(p=>Number.isInteger(p)&&p>=0&&p<120))].sort((a,b)=>a-b);
  if(sorted.length!==100||sorted.some((p,i)=>p!==sorted[0]+i))return [];
  const board=Array(120).fill(0);
  TEMPLATE.forEach((tier,i)=>{board[sorted[i]]=tier;});
  return [{name:"Experimental 12.0 · Lookahead Wind chains",
    base:9,shape:"three-stage reserve with deeper merge selection",board}];
}
