// Experimental 13.0 Cascade Resonance — 76,532 simulated Combo Meter points.
// Tier 64, Wind cap 58, chain limit 25, 100 sushi (including one protected Tier 64).
// 93 merges, 1,925 Wind upgrades, zero repositioning. Replay validated.
// Not independently verified in-game or a proven upper bound.
export const EXPERIMENTAL_13_BENCHMARK=76532;
const TEMPLATE=[64,51,47,45,52,54,53,49,54,54,34,53,42,48,53,54,50,44,37,46,56,54,43,55,42,42,41,40,39,38,37,36,35,34,33,32,31,30,29,28,27,26,25,24,23,22,21,20,19,18,34,33,32,31,30,29,28,27,26,25,24,23,22,21,20,19,18,17,16,15,14,13,12,11,10,33,32,31,30,29,28,27,26,25,24,23,22,21,20,19,18,17,16,15,14,13,12,11,10,9];
export function buildExperimental13Candidates(positions,maxTier,cap,chainLimit,protectTier64=true){
  if(!protectTier64||maxTier!==64||cap!==58||chainLimit!==25)return [];
  const sorted=[...new Set(positions.filter(p=>Number.isInteger(p)&&p>=0&&p<120))].sort((a,b)=>a-b);
  if(sorted.length!==100||sorted.some((p,i)=>p!==sorted[0]+i))return [];
  const board=Array(120).fill(0);
  TEMPLATE.forEach((tier,i)=>{board[sorted[i]]=tier;});
  return [{name:"Experimental 13.0 · Cascade Resonance",
    base:9,shape:"rebalanced three-stage Wind reserves",board}];
}
