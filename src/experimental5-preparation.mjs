// Accessible setup: supply-only slots 2–30 descend by tier; fixed Wind engine starts at slot 31.
// Experimental 5.0: 60,572-point replay-verified Wind reserve setup.
// Exactly 100 sushi, one permanent Tier 64; no mid-combo repositioning.
// Simulated result only, not an independently verified in-game record.
export const EXPERIMENTAL_5_BENCHMARK=60572;
const TEMPLATE=[64,57,56,55,54,53,52,51,50,49,48,47,46,45,44,43,42,41,40,39,38,37,36,35,34,34,33,33,33,32,32,32,31,30,29,32,32,32,31,30,29,28,27,26,25,24,23,22,21,20,19,18,17,16,15,14,13,12,13,12,15,14,32,31,31,31,30,29,28,27,26,25,24,23,22,21,20,19,18,17,16,15,14,13,13,12,13,13,12,12,31,31,30,29,28,28,27,26,25,24];

export function buildExperimental5Candidates(positions,maxTier,cap,chainLimit,protectTier64=true){
  if(!protectTier64||maxTier!==64||cap!==58||chainLimit!==25)return [];
  const sorted=[...new Set(positions.filter(p=>Number.isInteger(p)&&p>=0&&p<120))].sort((a,b)=>a-b);
  if(sorted.length!==100||sorted.some((p,i)=>p!==sorted[0]+i))return [];
  const board=Array(120).fill(0);
  TEMPLATE.forEach((tier,i)=>{board[sorted[i]]=tier;});
  return [{name:"Experimental 5.0 · Extended Tier 12–34 Wind reserves",
    base:12,shape:"multi-wave Tier 12–34 reserve staircase",board}];
}
