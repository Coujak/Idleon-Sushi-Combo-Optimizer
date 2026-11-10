// Accessible setup: supply-only slots 2–24 descend by tier; fixed Wind engine starts at slot 25.
// Experimental 11.0: replay-validated 75,047-point simulated Combo Meter.
// 94 merges, 1,875 Heat of the East Wind upgrades, no relocations.
// Exactly 100 unlocked sushi including one permanent Tier 64.
// This result is a game-mechanics simulation, not an in-game confirmed record.
export const EXPERIMENTAL_11_BENCHMARK=75047;
const TEMPLATE=[64,57,56,55,55,54,54,54,53,53,52,51,50,49,48,47,46,45,44,43,42,34,34,33,42,42,41,40,39,38,37,36,35,34,33,32,31,30,29,28,27,26,25,24,23,22,21,20,19,18,34,33,32,31,30,29,28,27,26,25,24,23,22,21,20,19,18,17,16,15,14,13,12,11,36,34,32,31,30,29,28,27,26,25,24,23,22,21,20,19,18,17,16,15,14,13,12,11,10,9];

export function buildExperimental11Candidates(positions,maxTier,cap,chainLimit,protectTier64=true){
  if(!protectTier64||maxTier!==64||cap!==58||chainLimit!==25)return [];
  const sorted=[...new Set(positions.filter(p=>Number.isInteger(p)&&p>=0&&p<120))].sort((a,b)=>a-b);
  if(sorted.length!==100||sorted.some((p,i)=>p!==sorted[0]+i))return [];
  const board=Array(120).fill(0);
  TEMPLATE.forEach((tier,i)=>{board[sorted[i]]=tier;});
  return [{name:"Experimental 11.0 · 75K Wind chains",
    base:9,shape:"rebalanced three-stage Wind reserves",board}];
}
