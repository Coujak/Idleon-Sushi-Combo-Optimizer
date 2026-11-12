// Sushi Station has 8 rows of 15 positions. Players may unlock
// at most 100 slots, in any of those 120 positions.
export const BOARD_COLUMNS=15;
export const BOARD_ROWS=8;
export const BOARD_CELLS=BOARD_COLUMNS*BOARD_ROWS;
export const MAX_UNLOCKED_SLOTS=100;

export function normalizeBoardData(rawTiles,rawSlots){
  if(!Array.isArray(rawTiles))throw Error("Sushi tile data must be an array.");
  const slots=Array(BOARD_CELLS).fill(-1);
  const tiles=Array(BOARD_CELLS).fill(-1);
  if(Array.isArray(rawSlots)){
    for(let i=0;i<Math.min(rawSlots.length,BOARD_CELLS);i++){
      const type=Number(rawSlots[i]);
      if(!Number.isInteger(type))throw Error("Invalid sushi slot type at position "+(i+1));
      slots[i]=type>=0?type:-1;
    }
  }
  const unlocked=slots.filter(type=>type>=0).length;
  if(unlocked>MAX_UNLOCKED_SLOTS){
    throw Error("Save reports "+unlocked+" unlocked slots; Sushi Station supports at most 100. Please check the imported data.");
  }
  for(let i=0;i<Math.min(rawTiles.length,BOARD_CELLS);i++){
    const tier=Number(rawTiles[i]);
    if(!Number.isInteger(tier))throw Error("Invalid sushi tier data at position "+(i+1));
    if(slots[i]>=0)tiles[i]=tier;
  }
  return {tiles,slots,unlocked};
}

export function layoutOptions(sourceSlots,{movementMittens=false}={}){
  const current=Array.from({length:BOARD_CELLS},(_,i)=>{
    const type=Number(sourceSlots[i]??-1);
    return Number.isInteger(type)&&type>=0?type:-1;
  });
  const types=current.filter(type=>type>=0);
  if(types.length>MAX_UNLOCKED_SLOTS)throw Error("Cannot prepare more than 100 unlocked slots.");
  // Without Movement Mittens (Sushi upgrade #15, save index 42), players
  // cannot relocate the plates themselves: the imported layout is mandatory.
  const currentLayout={name:"Current positions",slots:current};
  if(!movementMittens)return [currentLayout];

  // Group by plate type, not by their original positions. Regular (green)
  // comes first, then Hot (red), Cold (blue), and Milktoast (yellow).
  // Fill unlocked positions row-major, top-left to bottom-right. This keeps
  // colored plates together at the bottom of the unlocked region, including
  // for an early-game board with fewer than 100 total plates.
  const sorted=types.slice().sort((a,b)=>a-b);
  const arranged=Array(BOARD_CELLS).fill(-1);
  sorted.forEach((type,i)=>{arranged[i]=type;});
  if(current.every((type,i)=>type===arranged[i]))return [currentLayout];
  return [{name:"Top-down · grouped special plates",slots:arranged}];
}
