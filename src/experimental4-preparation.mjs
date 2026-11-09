// Experimental 4.0: 58,684-point replay-validated preparation.
// 100 unlocked sushi including one protected Tier 64.
// Simulated score, not a guaranteed in-game result.
export const EXPERIMENTAL_4_BENCHMARK=58684;
const TEMPLATE=[64,57,56,55,54,53,52,51,50,49,48,47,46,45,44,43,42,41,40,39,38,37,36,35,34,33,32,34,33,33,32,32,31,30,29,32,32,32,31,30,29,28,27,26,25,24,23,22,21,20,19,19,19,18,18,20,20,21,20,20,19,18,32,31,31,31,30,29,28,27,26,25,24,23,22,21,20,20,19,20,19,19,18,18,19,18,18,18,20,20,31,31,30,29,28,28,27,26,25,24];

export function buildExperimental4Candidates(positions,maxTier,cap,chainLimit,protectTier64=true){
  if(!protectTier64||maxTier!==64||cap!==58||chainLimit!==25)return [];
  const sorted=[...new Set(positions.filter(p=>Number.isInteger(p)&&p>=0&&p<120))].sort((a,b)=>a-b);
  if(sorted.length!==100||sorted.some((p,i)=>p!==sorted[0]+i))return [];
  const board=Array(120).fill(0);
  TEMPLATE.forEach((tier,i)=>{board[sorted[i]]=tier;});
  return [{name:"Experimental 4.0 · Extended Wind reserves",
    base:18,shape:"extended Tier 18–34 reserves",board}];
}
