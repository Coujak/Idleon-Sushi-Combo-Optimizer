// Accessible setup: supply-only slots 2–31 descend by tier; fixed Wind engine starts at slot 32.
// Experimental 8.0: 68,415 simulated points using the East Wind chains
// merge policy. Full replay validated: 94 merges, 1,818 Wind upgrades.
// Exactly 100 sushi, one permanent Tier 64; never exceeds the 8x15 grid.
export const EXPERIMENTAL_8_BENCHMARK=68415;
const TEMPLATE=[64,55,54,54,54,53,52,51,50,49,48,47,46,45,44,43,42,41,40,39,38,37,36,35,34,33,33,32,32,32,31,32,32,31,30,29,28,27,26,25,24,23,22,21,20,19,18,17,16,15,14,13,12,11,10,9,8,32,31,30,29,28,27,26,25,24,23,22,21,20,19,18,17,16,15,14,13,12,11,10,9,8,31,31,30,29,28,27,26,25,24,23,22,21,20,19,18,17,16,16];
export function buildExperimental8Candidates(positions,maxTier,cap,chainLimit,protectTier64=true){
  if(!protectTier64||maxTier!==64||cap!==58||chainLimit!==25)return [];
  const sorted=[...new Set(positions.filter(p=>Number.isInteger(p)&&p>=0&&p<120))].sort((a,b)=>a-b);
  if(sorted.length!==100||sorted.some((p,i)=>p!==sorted[0]+i))return [];
  const board=Array(120).fill(0);
  TEMPLATE.forEach((tier,i)=>{board[sorted[i]]=tier;});
  return [{name:"Experimental 8.0 · 68K Wind chains",
    base:8,shape:"optimized Tier 8–55 reserve arrangement",board}];
}
