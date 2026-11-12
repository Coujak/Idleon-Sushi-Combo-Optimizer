// Display helpers for Perfecto's final-copy walkthrough. The copy-maximized
// recommendation and the recycled-Wind construction workspace are two distinct
// views. Never erase multiple recommended target sushi merely to display the
// temporary 38-slot building space.
export function perfectoReplayPreview(plan,target,replay,step){
 if(!plan||!Array.isArray(plan.board)||!replay?.available)
  return {available:false,reason:"Missing recommended board or replay"};
 const candidates=plan.board.filter(cell=>
  cell.slot>=0&&cell.role==="target"&&
  cell.preparedTier+1===target&&cell.newCopy===true);
 if(!candidates.length)
  return {available:false,reason:"No newly produced target copy can be isolated"};
 // Use the final newly planned target in display order. All other sushi and
 // special plates remain identical to the recommendation throughout replay.
 const missingPosition=candidates.at(-1).index;
 const built=step>=0&&(replay.mode==="recycling"?
  step>=replay.totalSteps:
  step>=replay.finalFillIndex);
 const board=plan.board.map(cell=>
  cell.index!==missingPosition||built?{...cell}:{
   ...cell,role:"empty",preparedTier:-1,newCopy:false
  });
 const originalCount=plan.board.filter(cell=>cell.slot>=0&&cell.preparedTier>=0).length;
 const filled=board.filter(cell=>cell.slot>=0&&cell.preparedTier>=0).length;
 return {available:true,plan:{...plan,board},missingPosition,built,
  filled,unlocked:plan.board.filter(cell=>cell.slot>=0).length,
  originalCount};
}

// Show only the explicitly temporary build space, never a second 120-cell
// "recommended board". Workspace positions are local to the construction
// trace and are NOT extra unlocked plates in the player's game.
export function perfectoReplayWorkspacePositions(replay){
 if(!replay?.available)return [];
 if(replay.mode==="recycling"){
  const start=Number(replay.stagingStart),length=Number(replay.requiredSlots);
  if(!Number.isInteger(start)||!Number.isInteger(length)||start<0||
    length<1||start+length>120)return [];
  return Array.from({length},(_,i)=>start+i);
 }
 const positions=[...(replay.workspacePositions??[]),
  replay.focusPosition].filter(pos=>Number.isInteger(pos)&&pos>=0&&pos<120);
 if(!positions.length)return [];
 const start=Math.min(...positions),end=Math.max(...positions);
 return Array.from({length:end-start+1},(_,i)=>start+i);
}
