// Repeated East Wind sweeps need a progression of low-tier reserves,
// not a uniform tail. This family was discovered by benchmarking full
// merge replays on a 105-slot board, then generalized to contiguous boards.
// No game save or existing sushi board is modified by this generator.
export function buildLayeredCandidates(positions,maxTier,cap,chainLimit,protectTier64=true){
  if(!protectTier64||maxTier<64||chainLimit!==25||cap<36)return [];
  const sorted=[...new Set(positions.filter(p=>Number.isInteger(p)&&p>=0&&p<120))]
    .sort((a,b)=>a-b);
  // Wind moves in board order: a locked gap would break this layout.
  if(sorted.length<90||sorted.some((p,i)=>i&&p!==sorted[i-1]+1))return [];
  const base=cap-27,peak=cap-1;
  if(base<3||peak>63||peak<=base||peak>maxTier)return [];
  const board=Array(120).fill(0);
  board[sorted[0]]=64;
  let j=1;
  for(let tier=peak;tier>base&&j<sorted.length;tier--){
    board[sorted[j++]]=tier;
  }
  // Opening reserves create the first two rising merge anchors.
  const opening=[1,1,0,1,1,1,0,-1,1,1,1,0,-1];
  for(const relative of opening){
    if(j>=sorted.length)break;
    board[sorted[j++]]=base+relative;
  }
  // Repeated 27-slot modules: 3 base, 2 base-1, then base-2.
  // Tier 29s (when base=31) keep extending later Wind chains.
  const period=chainLimit+2;
  const openingTail=period-5;
  for(let i=0;i<openingTail&&j<sorted.length;i++)board[sorted[j++]]=base-2;
  while(j<sorted.length){
    for(let i=0;i<3&&j<sorted.length;i++)board[sorted[j++]]=base;
    for(let i=0;i<2&&j<sorted.length;i++)board[sorted[j++]]=base-1;
    for(let i=0;i<period-5&&j<sorted.length;i++)board[sorted[j++]]=base-2;
  }
  return [{
    name:"Layered Wind reserves",
    base,
    shape:"layered Wind reserves",
    board
  }];
}
