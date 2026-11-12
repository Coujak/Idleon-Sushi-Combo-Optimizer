// Full-board Perfecto replay from a clearly disclosed prepared-workspace state.
// The repeated target-copy construction reuses one simulator-validated trace:
// the viewer can seek through millions of logical steps without materializing
// a copy of every 120-cell board for every repeated target.
import {simulateRelocation} from "./optimizer-core.mjs";
import {certifiedWindTierRecipe} from "./perfecto-wind-certificate.mjs";
import {createPerfectoConstructionReplay} from "./perfecto-construction-replay.mjs";

const N=120;
const fail=reason=>({available:false,reason});
const boardOf=tiles=>Array.from({length:N},(_,i)=>Math.max(0,Number(tiles?.[i]??-1)+1));
const zeroTiles=board=>Array.from(board,t=>t>0?t-1:-1);
const same=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);

export function createPerfectoFullBoardReplay(save,search,plan,target){
 const proof=search?.certificate,finalBoard=plan?.board;
 if(!proof||!Array.isArray(proof.stages)||!Array.isArray(finalBoard))
  return fail("The planner has no certified full-board recipe.");
 if(!proof.stages.length&&Number(proof.startingTier)===target)
  return directCookFullReplay(save,search,plan,target);
 const slots=Array.from({length:N},(_,i)=>Number(save?.slots?.[i]??-1));
 const imported=boardOf(save?.tiles);
 for(let i=0;i<N;i++)if(slots[i]<0)imported[i]=0;
 const desired=finalBoard.map((cell,i)=>slots[i]<0?0:
  Math.max(0,Number(cell?.preparedTier??-1)+1));
 const originals=[],initial=Array(N).fill(0),originalTargets=[];
 const flexible=[];
 for(let i=0;i<N;i++){
  if(slots[i]<0)continue;
  if(imported[i]>=target){
   if(desired[i]!==imported[i])
    return fail("The recommended board relocates a protected T"+imported[i]+
     " at position "+(i+1)+". A complete legal replay cannot move it automatically.");
   initial[i]=imported[i];
   if(imported[i]===target)originalTargets.push(i);
  }else{
   flexible.push(i);
   if(imported[i]>0)originals.push({position:i,tier:imported[i]});
  }
 }
 const requiredCopies=Number(proof.finalCopies);
 const newPositions=desired.flatMap((tier,i)=>
  tier===target&&initial[i]!==target?[i]:[]);
 const supporting=Array.isArray(proof.supportingSushi)?proof.supportingSushi:[];
 const supportPositions=supporting.map(item=>Number(item.position)-1);
 const workspace=Number(proof.workspaceSlots);
 if(!Number.isInteger(workspace)||workspace<1||workspace>N||
    !Number.isInteger(requiredCopies)||newPositions.length!==requiredCopies)
  return fail("The planned target count cannot be reconstructed from the saved board.");
 if(supporting.length!==workspace-1)
  return fail("The final staircase does not have the required construction workspace.");
 if(new Set(supportPositions).size!==supportPositions.length)
  return fail("The final staircase contains duplicate destinations.");
 const isFlexible=new Set(flexible),supportSet=new Set(supportPositions);
 // The final layout must hold the staircase in a contiguous build workspace,
 // leaving exactly one slot for the last newly made target copy.
 let start=-1,insideTarget=-1;
 for(let pos=0;pos+workspace<=N;pos++){
  const range=Array.from({length:workspace},(_,i)=>pos+i);
  if(!range.every(i=>isFlexible.has(i)))continue;
  if(!supportPositions.every(i=>range.includes(i)))continue;
  const targets=range.filter(i=>desired[i]===target);
  if(targets.length!==1||range.some(i=>desired[i]!==target&&!supportSet.has(i)))continue;
  start=pos;insideTarget=targets[0];break;
 }
 if(start<0)return fail("This recommended layout has no continuous workspace covering the final staircase. It needs a different construction layout.");
 if(target===64&&requiredCopies>1)
  return fail("A full T64 replay needs separate in-place workspaces because T64 cannot be relocated.");
 const outsideTargets=newPositions.filter(i=>i<start||i>=start+workspace);
 if(outsideTargets.length!==requiredCopies-1||!newPositions.includes(insideTarget))
  return fail("The certified recipe and final target placements do not match.");

 const buildSave={slots,tiles:zeroTiles(initial)};
 const singleProof={...proof,finalCopies:1};
 const subSearch={...search,targetCount:originalTargets.length+1,certificate:singleProof};
 const template=createPerfectoConstructionReplay(buildSave,subSearch,target,
  {workspaceStart:start,maxIngredients:50000,maxActions:180000});
 if(!template.available)
  return fail("Target construction cannot be replayed: "+template.reason);
 const activeSource=template.sourceTier;
 const sourcePos=template.final.findIndex((v,i)=>i>=start&&i<start+workspace&&
  v===target);
 if(sourcePos<0)return fail("The target replay did not leave a completed target in the workspace.");
 const copyLen=template.steps.length+1;
 const clearNeeded=originals.length>0;
 const baseOffset=clearNeeded?2:0;
 const targetActionCount=requiredCopies*copyLen;
 const finalAfterCopies=initial.slice();
 for(const pos of outsideTargets)finalAfterCopies[pos]=target;
 finalAfterCopies[insideTarget]=target;
 // Every support ingredient is built after all targets. Each support recipe
 // must be legal on the newly shrinking workspace and must finish at its exact
 // recommended board position; no magic post-construction rearrangement.
 const supports=[];
 let current=finalAfterCopies.slice();
 for(const item of supporting){
  const tier=Number(item.tier),dest=Number(item.position)-1;
  if(!Number.isInteger(tier)||tier<1||tier>=target||
     !Number.isInteger(dest)||dest<0||dest>=N||current[dest]!==0)
   return fail("Invalid staircase placement at position "+(dest+1)+".");
  let steps=[],startBoard=current.slice();
  if(tier<=Number(item.sourceTier)&&tier<=46){
   // The certificate says this ingredient may be cooked directly.
   startBoard=current.slice();
   current[dest]=tier;
   steps=[{kind:"cook",at:dest,tier,events:[],board:Uint8Array.from(current)}];
  }else{
   let recipe;
   try{recipe=certifiedWindTierRecipe(Number(item.sourceTier),tier,Number(search.windCap)||0);}
   catch(error){return fail("Invalid staircase recipe: "+error.message);}
   const searchPiece={windCap:search.windCap,targetCount:1,
    certificate:{...recipe,startingTier:Number(item.sourceTier),targetTier:tier,finalCopies:1}};
   const part=createPerfectoConstructionReplay({slots,tiles:zeroTiles(current)},searchPiece,tier,
    {maxIngredients:50000,maxActions:180000});
   if(!part.available)return fail("Staircase T"+tier+" cannot be replayed: "+part.reason);
   if(part.partial)return fail("Staircase T"+tier+" needs an unverified prepared-tier checkpoint.");
   if(!same(Array.from(part.initial),current))
    return fail("Staircase T"+tier+" would silently replace sushi already on the board.");
   steps=part.steps;
   current=Array.from(part.final);
   const builtPositions=current.flatMap((v,i)=>v===tier&&startBoard[i]!==tier?[i]:[]);
   if(builtPositions.length!==1)return fail("T"+tier+" construction has no unique final position.");
   const built=builtPositions[0];
   if(built!==dest){
    const relocated=simulateRelocation(current,built,dest,slots,64);
    if(!relocated)return fail("T"+tier+" cannot be moved to final position "+(dest+1)+".");
    current=relocated.board;
    steps=[...steps,{kind:"move",src:built,dst:dest,tier,events:[],board:Uint8Array.from(current)}];
   }
  }
  supports.push({tier,dest,firstIndex:0,initial:Uint8Array.from(startBoard),steps});
 }
 if(!same(current,desired))
  return fail("The constructed board does not match the final recommended layout. Replay would be misleading.");
 let supportStart=baseOffset+targetActionCount+1;
 for(const group of supports){
  group.firstIndex=supportStart;
  supportStart+=group.steps.length;
 }
 const totalSteps=baseOffset+targetActionCount+
  supports.reduce((n,x)=>n+x.steps.length,0);
 const lastFinalCopy=baseOffset+(requiredCopies-1)*copyLen;
 const lastMergesIndex=lastFinalCopy+Math.max(0,template.lastMergesIndex);
 const finalFillIndex=baseOffset+targetActionCount;
 function snapshotBase(completed){
  const board=initial.slice();
  for(let i=0;i<Math.min(completed,outsideTargets.length);i++)
   board[outsideTargets[i]]=target;
  return board;
 }
 const templateFrame=(index,completed)=>{
  const board=snapshotBase(completed);
  if(index>=0){
   const at=index>=template.steps.length?
    template.final:template.steps[index].board;
   for(let j=start;j<start+workspace;j++)board[j]=at[j];
  }
  return board;
 };
 function getFrame(n){
  const step=Math.max(0,Math.min(totalSteps,Math.floor(Number(n)||0)));
  if(step===0)return {board:Uint8Array.from(imported),
   event:null,phase:"imported",description:"Your imported board, unchanged."};
  if(clearNeeded&&step===1)return {board:Uint8Array.from(imported),
   event:{kind:"setup-required",positions:originals.map(x=>x.position)},
   phase:"manual",description:"Manual preparation required: clear "+originals.length+
    " existing lower-tier sushi from positions "+
    originals.map(x=>x.position+1).join(", ")+
    " using legal game actions. The replay does not invent how to remove them."};
  if(clearNeeded&&step===2)return {board:Uint8Array.from(initial),
   event:{kind:"setup-confirmed"},phase:"staging",
   description:"Preparation checkpoint confirmed. Only protected and existing target sushi remain."};
  const action=step-baseOffset-1;
  if(action<targetActionCount){
   const completed=Math.floor(action/copyLen);
   const local=action%copyLen;
   let board,event,description;
   if(local<template.steps.length){
    const item=template.steps[local];
    board=templateFrame(local,completed);
    event=item;
    description="Target copy "+(completed+1)+" of "+requiredCopies;
   }else{
    const dest=completed===requiredCopies-1?insideTarget:outsideTargets[completed];
    board=templateFrame(template.steps.length,completed);
    if(sourcePos!==dest){
     const moved=simulateRelocation(board,sourcePos,dest,slots,64);
     if(!moved)return {board:Uint8Array.from(board),event:{kind:"error"},
      phase:"error",description:"Target cannot be relocated to position "+(dest+1)};
     board=moved.board;event={kind:"move",src:sourcePos,dst:dest,tier:target,events:[]};
    }else event={kind:"complete",at:dest,tier:target,events:[]};
    description="Store completed target copy "+(completed+1)+
     " of "+requiredCopies+" at position "+(dest+1);
   }
   return {board:Uint8Array.from(board),event,phase:"targets",
    completedTargets:completed+(local===template.steps.length?1:0),
    targetTotal:requiredCopies,description};
  }
  const supportAction=action-targetActionCount;
  let cursor=0;
  for(const group of supports){
   if(supportAction<cursor+group.steps.length){
    const local=supportAction-cursor;
    return {board:group.steps[local].board,event:group.steps[local],
     phase:"support",description:"Fill remaining cells: build T"+group.tier+
      " at position "+(group.dest+1)};
   }
   cursor+=group.steps.length;
  }
  return {board:Uint8Array.from(current),event:null,
   phase:"complete",description:"Board is completely filled and matches the recommendation."};
 }
 // The first action of every new target copy is accessible as a jump, while
 // individual legal merge/Wind actions remain available with Previous/Next.
 function nextCopyIndex(step){
  const base=baseOffset;
  if(step>=finalFillIndex)return finalFillIndex;
  const copy=Math.floor(Math.max(0,step-base)/copyLen);
  return Math.min(finalFillIndex,base+(copy+1)*copyLen);
 }
 return {available:true,initial:Uint8Array.from(imported),slots,
  final:Uint8Array.from(current),totalSteps,getFrame,lastMergesIndex,
  finalFillIndex,nextCopyIndex,baseOffset,requiresSetup:clearNeeded,
  setupPositions:originals,templateSteps:template.steps.length,
  copies:requiredCopies,partial:template.partial,sourceTier:activeSource,
  actualCookTier:Number(proof.startingTier),supports:supports.length,
  windUsed:template.steps.some(x=>x.events?.some(e=>e.kind==="wind"))||
   supports.some(x=>x.steps.some(s=>s.events?.some(e=>e.kind==="wind")))};
}

function directCookFullReplay(save,search,plan,target){
 if(target>46)return fail("This sushi tier cannot be cooked directly.");
 const slots=Array.from({length:N},(_,i)=>Number(save?.slots?.[i]??-1));
 const imported=boardOf(save?.tiles);
 for(let i=0;i<N;i++)if(slots[i]<0)imported[i]=0;
 const final=plan.board.map((cell,i)=>slots[i]<0?0:
  Math.max(0,Number(cell?.preparedTier??-1)+1));
 const protectedTiles=imported.map((tier,i)=>slots[i]>=0&&tier>=target?tier:0);
 const lower=imported.flatMap((tier,i)=>slots[i]>=0&&tier>0&&tier<target?
  [{position:i,tier}]:[]);
 const newPositions=[];
 for(let i=0;i<N;i++){
  if(slots[i]<0)continue;
  if(imported[i]>=target&&final[i]!==imported[i])
   return fail("A protected sushi would need to be moved at position "+(i+1)+".");
  if(protectedTiles[i]===0&&final[i]===target)newPositions.push(i);
  if(final[i]!==target&&final[i]!==protectedTiles[i])
   return fail("Direct-cook board contains an unmodeled supporting sushi.");
 }
 if(newPositions.length!==Number(search.certificate?.finalCopies))
  return fail("Direct-cook count does not match the final plan.");
 const initial=protectedTiles.slice();
 const manual=lower.length>0,baseOffset=manual?2:0;
 const totalSteps=baseOffset+newPositions.length;
 function getFrame(value){
  const step=Math.max(0,Math.min(totalSteps,Math.floor(Number(value)||0)));
  if(step===0)return {board:Uint8Array.from(imported),phase:"imported",
   event:null,description:"Your imported board, unchanged."};
  if(manual&&step===1)return {board:Uint8Array.from(imported),
   phase:"manual",event:{kind:"setup-required",positions:lower.map(x=>x.position)},
   description:"Clear existing lower-tier sushi from positions "+
    lower.map(x=>x.position+1).join(", ")+" before continuing."};
  if(manual&&step===2)return {board:Uint8Array.from(initial),
   phase:"staging",event:{kind:"setup-confirmed"},
   description:"Preparation checkpoint confirmed. Protected sushi are unchanged."};
  const count=Math.max(0,step-baseOffset);
  const board=initial.slice();
  for(let i=0;i<count;i++)board[newPositions[i]]=target;
  const at=newPositions[count-1];
  return {board:Uint8Array.from(board),phase:"targets",
   event:Number.isInteger(at)?{kind:"cook",at,tier:target,events:[]}:null,
   completedTargets:count,targetTotal:newPositions.length,
   description:"Directly cook target sushi "+count+" of "+newPositions.length};
 }
 if(!same(final,initial.map((t,i)=>t>0?t:newPositions.includes(i)?target:0)))
  return fail("Direct cooking cannot construct the exact final board.");
 return {available:true,slots,initial:Uint8Array.from(imported),
  final:Uint8Array.from(final),totalSteps,getFrame,
  lastMergesIndex:baseOffset,finalFillIndex:totalSteps,
  nextCopyIndex:step=>Math.min(totalSteps,Math.max(baseOffset,step)+1),
  baseOffset,requiresSetup:manual,setupPositions:lower,
  templateSteps:1,copies:newPositions.length,partial:false,
  sourceTier:target,actualCookTier:target,supports:0,windUsed:false};
}
