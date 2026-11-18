// The Knowledge planner designs a preparation, rather than optimizing
// the arbitrary Sushi currently occupying the account's working plates.
// An original highest-tier Sushi is retained at its REAL location, because
// neither T64 relocation nor deleting unwanted Sushi is a legal game action.
// Other current ingredients are not assumed to disappear in-game: the
// difference is explicitly reported as manual preparation requirements.

const SIZE=120;
const eligible=(slots,i)=>Number.isInteger(slots[i])&&slots[i]>=0&&slots[i]<=3;

export function designKnowledgeStartingBoard(layout,{preservePassive=false}={}){
 const {tiles,slots}=layout??{};
 if(!Array.isArray(tiles)||!Array.isArray(slots)||
    tiles.length!==SIZE||slots.length!==SIZE)
  throw Error("Knowledge board design requires a 120-cell account layout");
 const occupied=tiles.flatMap((tier,i)=>eligible(slots,i)&&tier>0?[i]:[]);
 const highest=occupied.reduce((v,i)=>Math.max(v,tiles[i]),0);
 // Existing highest-tier sushi cannot simply be deleted or teleported.
 // The last one is chosen as a stable anchor, retaining its exact position.
 const anchor=occupied.filter(i=>tiles[i]===highest).at(-1)??null;
 const board=Array(SIZE).fill(0),keep=new Set();
 if(anchor!==null){board[anchor]=tiles[anchor];keep.add(anchor);}
 if(preservePassive)for(const i of occupied)
  if((slots[i]===2||slots[i]===3)&&!keep.has(i)){
   board[i]=tiles[i];keep.add(i);
  }
 const displaced=occupied.filter(i=>!keep.has(i));
 const unlocked=slots.flatMap((slot,i)=>eligible(slots,i)?[i]:[]);
 return {
  board,anchor,anchorTier:anchor===null?null:highest,
  preservedIndices:[...keep].sort((a,b)=>a-b),
  protectedIndices:[...keep].sort((a,b)=>a-b),
  omittedImportedPositions:displaced,
  omittedCount:displaced.length,
  requiresManualCleanup:displaced.length>0,
  availableWorkingSlots:unlocked.length-keep.size,
  unlockedCount:unlocked.length,
  goalOnly:true,
  preparationNote:displaced.length?
   "This proposed preparation starts after "+displaced.length+
   " imported Sushi have been legally consolidated or cleared by other " +
   "gameplay. The optimizer has NOT solved the transition from the imported " +
   "board, and it cannot delete Sushi. The original highest-tier Sushi " +
   (anchor===null?"is absent.":"stays in its current plate at index "+anchor+"."):
   "This clean preparation is constructible using cooks and verified " +
   "merges from the specified anchor state."
 };
}

// Alternate Knowledge starting state: every Sushi stays exactly where the
// imported save says it is. No invented cleanup, teleport or deletion.
export function importKnowledgeStartingBoard(layout,{preservePassive=false}={}){
 const {tiles,slots}=layout??{};
 if(!Array.isArray(tiles)||!Array.isArray(slots)||
    tiles.length!==SIZE||slots.length!==SIZE)
  throw Error("Current Sushi board requires 120 tiles and 120 plate slots");
 if(tiles.some((tier,i)=>!Number.isInteger(tier)||tier<0||tier>64||
    (tier>0&&!eligible(slots,i))))
  throw Error("Current Sushi board has an invalid or locked Sushi position");
 const occupied=tiles.flatMap((tier,i)=>tier>0?[i]:[]);
 const highest=occupied.reduce((value,i)=>Math.max(value,tiles[i]),0);
 const anchor=highest>0?occupied.filter(i=>tiles[i]===highest).at(-1):null;
 const keep=new Set(anchor===null?[]:[anchor]);
 if(preservePassive)for(const i of occupied)
  if(slots[i]===2||slots[i]===3)keep.add(i);
 const unlocked=slots.flatMap((slot,i)=>eligible(slots,i)?[i]:[]);
 const empty=unlocked.filter(i=>tiles[i]===0);
 return {
  board:tiles.slice(),anchor,anchorTier:anchor===null?null:highest,
  preservedIndices:[...keep].sort((a,b)=>a-b),
  protectedIndices:[...keep].sort((a,b)=>a-b),
  omittedImportedPositions:[],omittedCount:0,
  requiresManualCleanup:false,
  availableWorkingSlots:Math.max(1,empty.length),
  unlockedCount:unlocked.length,
  initialOccupied:occupied.length,initialEmpty:empty.length,
  goalOnly:false,
  usesImportedBoard:true,
  preparationNote:"Starting directly from all "+occupied.length+
   " Sushi on the imported board. Their exact tiers and positions are retained. "+
   (anchor===null?"No original highest-tier anchor exists. ":
    "The original T"+highest+" at position "+anchor+" is protected. ")+
   (preservePassive?"Existing Cold/Milktoast Sushi are protected. ":"")+
   "Only replayed legal cooks, merges, and relocations can change the board."
 };
}

export function captureKnowledgePreparedBoard(frames,initialBoard){
 if(!Array.isArray(frames)||!Array.isArray(initialBoard))
  throw Error("Missing validated Sushi preparation replay");
 let first=-1,last=-1;
 for(let i=0;i<frames.length;i++)if(frames[i].kind==="refill"){
  first=i;break;
 }
 if(first<0)return {board:initialBoard.slice(),step:0,cooks:0,ready:false};
 last=first;
 let cooks=0;
 for(let i=first+1;i<frames.length&&frames[i].kind==="cook";i++){
  cooks++;last=i;
 }
 return {
  board:frames[last].board.slice(),step:last,cooks,ready:cooks>0,
  tiers:frames[last].board.reduce((map,tier)=>{
   if(tier>0)map[tier]=(map[tier]??0)+1;
   return map;
  },{})
 };
}
