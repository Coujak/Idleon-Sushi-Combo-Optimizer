// Accessible setup: supply-only slots 2–26 descend by tier; fixed Wind engine starts at slot 27.
// Experimental 10.0: 73,367-point simulated preparation.
// Fully replay-verified against the canonical merge simulator with
// 92 merges, 1,871 East Wind upgrades, and no mid-combo relocations.
// Exactly 100 unlocked sushi including one permanent Tier 64.
// The 75,000-point research target has not yet been achieved.
export const EXPERIMENTAL_10_BENCHMARK=73367;
const TEMPLATE=[64,56,55,54,54,54,54,53,52,51,50,49,48,47,46,45,44,43,42,41,40,39,38,34,33,32,38,38,37,36,35,34,33,32,31,30,29,28,27,26,25,24,23,22,21,20,19,18,17,16,15,34,33,32,31,30,29,28,27,26,25,24,23,22,21,20,19,18,17,16,15,14,13,12,11,10,32,32,31,30,29,28,27,26,25,24,23,22,21,20,19,18,17,16,15,14,13,12,11,10];

export function buildExperimental10Candidates(positions,maxTier,cap,chainLimit,protectTier64=true){
  if(!protectTier64||maxTier!==64||cap!==58||chainLimit!==25)return [];
  const sorted=[...new Set(positions.filter(p=>Number.isInteger(p)&&p>=0&&p<120))].sort((a,b)=>a-b);
  if(sorted.length!==100||sorted.some((p,i)=>p!==sorted[0]+i))return [];
  const board=Array(120).fill(0);
  TEMPLATE.forEach((tier,i)=>{board[sorted[i]]=tier;});
  return [{name:"Experimental 10.0 · Extended high-tier Wind waves",
    base:10,shape:"three-stage Tier 10–56 Wind reserve arrangement",board}];
}
