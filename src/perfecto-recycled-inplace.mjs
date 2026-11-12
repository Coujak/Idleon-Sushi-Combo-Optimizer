// Repeated fill -> highest-pair merge -> Wind -> reorganize, restricted
// to precisely the support staircase and final target on the SAME board.
// It is never permitted to borrow a completed T62 as scratch space.
// The final sushi is parked next to the workspace, and the exact support
// staircase is rebuilt using a separately verified cascading construction.
import {simulateMerge,simulateRelocation} from "./optimizer-core.mjs";
import {replayPerfectoSupportCascadeWithExtras} from "./perfecto-cascade-replay.mjs?v=1.36.0";

const SIZE=120;
const fail=reason=>({available:false,reason});
const values=board=>Array.from(board,Number);
const identical=(a,b)=>a.length===b.length&&a.every((tier,i)=>tier===b[i]);

export function createPerfectoRecycledInPlaceReplay(save,search,plan,target,
 {maxActions=14000}={}){
 const proof=search?.certificate;
 const supports=proof?.supportingSushi;
 if(!Array.isArray(supports)||!supports.length||!proof.supportingCascade)
  return fail("The plan does not contain a certified Wind support cascade.");
 const supportPositions=supports.map(item=>Number(item.position)-1);
 const first=supportPositions[0],length=supportPositions.length;
 const finalTarget=first+length,width=length+1;
 if(!Number.isInteger(first)||first<0||finalTarget>=SIZE||
    supportPositions.some((pos,i)=>pos!==first+i)||
    width!==Number(proof.workspaceSlots))
  return fail("The completed staircase does not have a matching contiguous workspace.");
 const source=Number(search.sourceTier),cap=Number(search.windCap);
 if(!Number.isInteger(source)||source<1||source>46||
    !Number.isInteger(cap)||cap<source||cap>58||
    !Number.isInteger(target)||target<cap+2||target>64)
  return fail("This recycled in-place method is not certified for the account's cooking and Wind limits.");
 const slots=Array.from({length:SIZE},(_,i)=>Number(save?.slots?.[i]??-1));
 const original=plan?.board;
 if(!Array.isArray(original)||original.length!==SIZE)
  return fail("The recommended board is unavailable.");
 const expected=original.map((cell,i)=>slots[i]<0?0:
  Math.max(0,Number(cell?.preparedTier??-1)+1));
 if(expected[finalTarget]!==target||!original[finalTarget]?.newCopy||
    supportPositions.some((pos,i)=>expected[pos]!==Number(supports[i].tier))||
    Array.from({length:width},(_,i)=>first+i).some(pos=>slots[pos]<0))
  return fail("The marked support and final target positions do not match the recommendation.");
 const initial=expected.slice();
 for(let i=first;i<=finalTarget;i++)initial[i]=0;
 const board=initial.slice(),steps=[],milestones=[];
 const hardLimit=Math.max(200,Math.min(50000,Math.floor(Number(maxActions)||14000)));
 let cooks=0,merges=0,moves=0,windCount=0,highest=source;
 const apply=result=>{
  if(!result)throw Error("The game simulator rejected a move.");
  for(let i=0;i<SIZE;i++)board[i]=result.board[i];
 };
 function record(kind,detail,description,phase="target"){
  if(steps.length>=hardLimit)throw Error("The construction exceeds the safe action limit.");
  steps.push({kind,...detail,description,phase,board:Uint8Array.from(board)});
 }
 function cook(local,tier=source,reason="Fill an empty construction cell"){
  const pos=first+local;
  if(pos<first||pos>finalTarget||board[pos]!==0||
     tier<1||tier>source)
   throw Error("Cannot directly cook T"+tier+" at position "+(pos+1)+".");
  board[pos]=tier;cooks++;
  record("cook",{at:pos,tier,events:[]},
   reason+": T"+tier+" at position "+(pos+1));
 }
 function relocate(src,dst,description="Reposition a recycled sushi"){
  const tier=board[src];
  apply(simulateRelocation(board,src,dst,slots,64));
  moves++;
  record("move",{src,dst,tier,events:[]},
   description+": T"+tier+" from "+(src+1)+" to "+(dst+1));
 }
 function merge(src,dst,description){
  const result=simulateMerge(board,src,dst,cap,25,64);
  if(!result)throw Error("Illegal Wind merge at position "+(src+1)+".");
  const tier=result.board[dst];
  windCount+=result.events.filter(e=>e.kind==="wind").length;
  apply(result);merges++;
  record("merge",{src,dst,tier,events:result.events},
   description+" ("+(src+1)+" → "+(dst+1)+")");
 }
 function sortDescending(){
  const goal=board.slice(first,first+width).sort((a,b)=>b-a);
  for(let guard=0;guard<width*width;guard++){
   if(goal.every((tier,i)=>tier===board[first+i]))return;
   const blank=board.findIndex((tier,i)=>i>=first&&i<=finalTarget&&tier===0);
   if(blank<first)throw Error("The recycled staircase has no free repositioning space.");
   const desired=goal[blank-first];
   const src=desired?
    board.findIndex((tier,i)=>i>=first&&i<=finalTarget&&
     tier===desired&&tier!==goal[i-first]):
    board.findIndex((tier,i)=>i>=first&&i<=finalTarget&&
     tier>0&&tier!==goal[i-first]);
   if(src<first)throw Error("Cannot sort the retained staircase.");
   relocate(src,blank,"Pack higher tiers before the next Wind merge");
  }
  throw Error("Staircase rearrangement exceeded its legal move budget.");
 }
 let finalFillIndex=0,lastMergesIndex=0,windCascadeIndex=null,largestWind=0;
 try{
  for(let i=0;i<width;i++)cook(i,source,"Prepare the T"+source+" starting board");
  let noMoreRefills=false;
  for(let cycle=0;cycle<2000&&board[first]!==target;cycle++){
   const current=board.slice(first,first+width);
   const count=new Map();
   for(const tier of current)if(tier>0)count.set(tier,(count.get(tier)??0)+1);
   const pair=[...count].filter(([,quantity])=>quantity>=2)
    .map(([tier])=>tier).sort((a,b)=>b-a)[0];
   if(pair===undefined){
    const blank=current.indexOf(0);
    if(blank<0)throw Error("No matching sushi to merge and no free cooking space.");
    cook(blank);
    sortDescending();continue;
   }
   if(current[0]===target-1&&pair>cap)noMoreRefills=true;
   const blank=current.indexOf(0);
   if(blank>=0&&!noMoreRefills){
    cook(blank);
    sortDescending();
   }
   const a=board.findIndex((tier,i)=>i>=first&&i<=finalTarget&&tier===pair);
   if(a<first||a+1>finalTarget||board[a+1]!==pair)
    throw Error("The matching Wind ingredients are not adjacent.");
   merge(a,a+1,"Combine highest matching sushi to promote the recycled staircase");
   sortDescending();
   const top=board[first];
   if(top>highest){
    highest=top;
    milestones.push({step:steps.length,tier:top});
   }
  }
  if(board[first]!==target)
   throw Error("The staircase could not produce T"+target+".");
  if(board.slice(first+1,finalTarget+1).some(x=>x!==0))
   throw Error("Excess sushi remain after completing T"+target+"; no automatic clearing is allowed.");
  relocate(first,finalTarget,"Park the completed target at its final position");
  finalFillIndex=steps.length;
  // Restore support T58→T42 in the original red-lined positions.
  const rebuilt=replayPerfectoSupportCascadeWithExtras(board,slots,search,
   supports,proof.supportingCascade);
  if(!rebuilt.available)
   throw Error("Supporting staircase could not be restored: "+rebuilt.reason);
  for(const group of rebuilt.groups){
   for(const action of group.steps){
    if(steps.length>=hardLimit)throw Error("The support build exceeds the safe action limit.");
    for(let i=0;i<SIZE;i++)board[i]=action.board[i];
    record(action.kind,{
     src:action.src,dst:action.dst,at:action.at,tier:action.tier,
     events:action.events??[]},group.description,"support");
    if(action.kind==="cook")cooks++;
    if(action.kind==="merge")merges++;
    if(action.kind==="move")moves++;
    const wind=action.events?.filter(e=>e.kind==="wind").length??0;
    windCount+=wind;
    if(wind>largestWind){largestWind=wind;windCascadeIndex=steps.length;}
   }
  }
  if(!identical(board,expected))
   throw Error("The final board differs from the Perfecto recommendation.");
  const editable=new Set(Array.from({length:width},(_,i)=>first+i));
  for(const [index,action] of steps.entries()){
   if(expected.some((v,i)=>!editable.has(i)&&action.board[i]!==v))
    throw Error("A completed sushi was disturbed at step "+(index+1)+".");
  }
  let count=0;
  for(let i=steps.length-1;i>=0;i--){
   if(steps[i].kind==="merge"&&++count===8){lastMergesIndex=i+1;break;}
  }
  // Include the highest-tier recycling milestones as well as the
  // final support chain's best Wind activation.
  const milestoneSteps=milestones;
  function getFrame(step){
   const index=Math.max(0,Math.min(steps.length,Math.floor(Number(step)||0)));
   if(index===0)return {board:Uint8Array.from(initial),event:null,
    phase:"staging",description:"The support staircase and one T"+target+
    " start empty. All other sushi stay in their recommended positions."};
   const item=steps[index-1];
   return {board:item.board,event:item,phase:index===steps.length?
    "complete":item.phase,description:item.description};
  }
  return {available:true,mode:"in-place",strategy:"recycled-wind",
   slots,initial:Uint8Array.from(initial),final:Uint8Array.from(board),
   supportPositions,workspacePositions:Array.from({length:width},(_,i)=>first+i),
   targetPosition:finalTarget,focusPosition:finalTarget,requiredSlots:width,
   originalTargetCopies:expected.filter(tier=>tier===target).length,
   totalSteps:steps.length,steps,getFrame,
   milestones:milestoneSteps,nextMilestone(step){
    return milestoneSteps.find(item=>item.step>step)?.step??finalFillIndex;
   },lastMergesIndex,windCascadeIndex,windUsed:windCount>0,
   finalFillIndex,sourceTier:source,targetTier:target,windCap:cap,
   totalCooks:cooks,totalMerges:merges,totalMoves:moves,totalWind:windCount,
   highestWind:largestWind,recyclingFits:true,recyclingNeeds:width,
   verifiedFinal:true};
 }catch(error){return fail(String(error.message??error));}
}
