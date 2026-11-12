// Strictly in-place Perfecto construction on the recommended board.
// Only the certified supporting sushi and the ONE adjacent new target may
// begin empty. All other copies retain their actual recommended positions.
// Refuse sequences that require a separate or larger temporary workspace.
import {createPerfectoFinalTargetReplay} from "./perfecto-full-replay.mjs?v=1.27.0";
import {recycledWindWorkspace} from "./perfecto-recycled-target.mjs?v=1.28.0";

const fail=reason=>({available:false,reason});
export function createPerfectoInPlaceReplay(save,search,plan,target){
 const proof=search?.certificate,board=plan?.board;
 if(!proof||!Array.isArray(board)||board.length!==120)
  return fail("No certified recommendation available.");
 const support=proof.supportingSushi??[];
 const supportPositions=support.map(entry=>Number(entry.position)-1);
 let targetPosition;
 if(supportPositions.length){
  const beginning=supportPositions[0];
  if(!Number.isInteger(beginning)||supportPositions.some(
   (position,index)=>position!==beginning+index))
   return fail("The supporting sushi are not in a contiguous construction area.");
  targetPosition=beginning+supportPositions.length;
 }else{
  const candidates=board.filter(cell=>cell.slot>=0&&
   cell.preparedTier+1===target&&cell.newCopy);
  targetPosition=candidates.at(-1)?.index;
 }
 const workspace=[...supportPositions,targetPosition];
 if(!Number.isInteger(targetPosition)||targetPosition<0||
    targetPosition>=board.length||
    board[targetPosition]?.preparedTier+1!==target||
    !board[targetPosition]?.newCopy)
  return fail("No new target sushi immediately follows the supporting staircase.");
 if(workspace.some(pos=>board[pos]?.slot<0||!Number.isInteger(pos)))
  return fail("The required construction positions are locked.");
 const compact=createPerfectoFinalTargetReplay(save,search,plan,target);
 if(!compact.available)return fail(compact.reason??"Cannot verify the construction.");
 if(compact.focusPosition!==targetPosition)
  return fail("The recipe constructs a target outside the marked workspace.");
 const final=board.map(cell=>cell.slot<0?0:
  cell.preparedTier>=0?cell.preparedTier+1:0);
 const start=Array.from(compact.getFrame(0).board);
 const end=Array.from(compact.getFrame(compact.totalSteps).board);
 if(start.length!==final.length||end.some((tier,i)=>tier!==final[i]))
  return fail("The recipe does not restore the recommended board exactly.");
 const clearing=new Set(workspace);
 if(start.some((tier,i)=>clearing.has(i)?tier!==0:tier!==final[i]))
  return fail("The recipe clears sushi outside the supporting staircase and final target.");
 if(workspace.length!==Number(proof.workspaceSlots)||
    compact.workspacePositions.length!==supportPositions.length||
    compact.workspacePositions.some((p,i)=>p!==supportPositions[i]))
  return fail("The merge recipe needs more room than the marked workspace.");
 const source=Number(search.sourceTier),cap=Number(search.windCap);
 const recycled=recycledWindWorkspace(source,target,cap);
 // A larger recycled cascade cannot legally run on this almost-final board.
 const recyclingNeeds=recycled?.requiredSlots??null;
 const milestones=[];
 let maxTier=source;
 // Validate every intermediate frame too, not only the initial/final board.
 // No move, cook or Wind effect may alter the finished sushi elsewhere.
 const outside=final.flatMap((_,i)=>clearing.has(i)?[]:[i]);
 for(let step=1;step<=compact.totalSteps;step++){
  const frame=compact.getFrame(step);
  if(outside.some(i=>frame.board[i]!==final[i]))
   return fail("Construction step "+step+
    " unexpectedly changes an already completed sushi outside the workspace.");
  if(step>compact.finalFillIndex)continue;
  const event=frame.event;
  if(event?.kind!=="merge")continue;
  const reached=Math.max(event.tier??0,
   ...(event.events??[]).map(e=>e.tier??0));
  if(reached>maxTier&&reached<=target){
   maxTier=reached;
   milestones.push({step,tier:reached});
  }
 }
 function nextMilestone(step){
  return milestones.find(item=>item.step>step)?.step??
   compact.finalFillIndex;
 }
 return {...compact,mode:"in-place",workspacePositions:workspace,
  supportPositions,targetPosition,focusPosition:targetPosition,
  originalTargetCopies:board.filter(cell=>cell.slot>=0&&
   cell.preparedTier+1===target).length,
  requiredSlots:workspace.length,
  recyclingNeeds,recyclingFits:recyclingNeeds!==null&&
   recyclingNeeds<=workspace.length,
  milestones,nextMilestone,
  verifiedFinal:true};
}
