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

export function layoutOptions(sourceSlots){
  const current=Array.from({length:BOARD_CELLS},(_,i)=>{
    const type=Number(sourceSlots[i]??-1);
    return Number.isInteger(type)&&type>=0?type:-1;
  });
  const types=current.filter(type=>type>=0);
  if(types.length>MAX_UNLOCKED_SLOTS)throw Error("Cannot prepare more than 100 unlocked slots.");
  const layouts=[{name:"Current positions",slots:current}];
  const count=types.length;
  const options=[
    {name:"Left-packed",positions:Array.from({length:count},(_,i)=>i)},
    {name:"Right-packed",positions:Array.from({length:count},(_,i)=>BOARD_CELLS-count+i)},
    {name:"Centered",positions:Array.from({length:count},(_,i)=>Math.floor((BOARD_CELLS-count)/2)+i)}
  ];
  for(const option of options){
    const arranged=Array(BOARD_CELLS).fill(-1);
    option.positions.forEach((position,i)=>{arranged[position]=types[i];});
    if(!layouts.some(layout=>layout.slots.every((v,i)=>v===arranged[i]))){
      layouts.push({name:option.name,slots:arranged});
    }
  }
  return layouts;
}
