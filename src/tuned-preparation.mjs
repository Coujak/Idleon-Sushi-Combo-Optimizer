// Replay-tested 100-unlocked-slot Wind-reserve layout. The full grid
// has 120 positions, so this preparation can be offset to other rows.
// This is a heuristic candidate, not a proof of a global optimum.
export function buildTuned100Candidates(positions,maxTier,cap,chainLimit,protectTier64=true){
  if(!protectTier64||maxTier!==64||cap!==58||chainLimit!==25)return [];
  const sorted=[...new Set(positions.filter(p=>Number.isInteger(p)&&p>=0&&p<120))].sort((a,b)=>a-b);
  if(sorted.length!==100||sorted.some((p,i)=>p!==sorted[0]+i))return [];

  const opening=[32,32,31,32,32,32,31,30,32,32,32,31,30];
  const template=[
    64,
    ...Array.from({length:26},(_,i)=>57-i),
    ...opening,29,29,28,
    ...Array(19).fill(27),
    31,31,31,30,30,29,...Array(21).fill(28),
    31,31,31,30,30,29,29,...Array(4).fill(28)
  ];
  if(template.length!==100)throw Error("Invalid tuned preparation size");
  const board=Array(120).fill(0);
  template.forEach((tier,i)=>{board[sorted[i]]=tier;});
  return [{name:"Tuned 100-slot Wind reserves",base:31,
    shape:"tuned Wind reserves",board}];
}
