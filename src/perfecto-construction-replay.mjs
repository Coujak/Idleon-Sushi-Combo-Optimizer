// Simulator-validated replay of building the LAST target copy on a staging
// board. Earlier completed targets are parked; this is deliberately not a
// fabricated full account-to-final-board action sequence.
import {simulateMerge,simulateRelocation} from "./optimizer-core.mjs";

const LENGTH=120;
export function createPerfectoConstructionReplay(save,search,target,
 {maxIngredients=15000,maxActions=45000}={}){
 const proof=search?.certificate;
 if(!proof||!Array.isArray(proof.stages)||!proof.stages.length)
  return {available:false,reason:"No merge recipe is available for this target."};
 const cap=Math.max(0,Math.min(58,Number(search.windCap)||0));
 const trueSource=Number(proof.startingTier);
 const finalCopies=Number(proof.finalCopies);
 if(!Number.isInteger(target)||target<1||target>64||
    !Number.isInteger(finalCopies)||finalCopies<1)
  return {available:false,reason:"Invalid target or construction recipe."};
 const stageList=proof.stages;
 const ingredientLimit=BigInt(Math.max(20,Math.floor(maxIngredients)));
 let total=1n,begin=stageList.length;
 // Include as many terminal stages as we can replay without generating
 // thousands of unnecessary early-tier repetitions.
 for(let i=stageList.length-1;i>=0;i--){
  const factor=stageList[i].wind?3n:2n;
  if(total*factor>ingredientLimit)break;
  total*=factor;begin=i;
 }
 if(begin===stageList.length)
  return {available:false,reason:"Replay budget is too small for even the final merge."};
 const active=stageList.slice(begin);
 const source=Number(active[0].from);
 const partial=begin>0;
 const workspace=1+active.reduce((n,stage)=>n+(stage.wind?2:1),0);
 const slots=Array.from({length:LENGTH},(_,i)=>Number(save?.slots?.[i]??-1));
 const tiles=Array.from({length:LENGTH},(_,i)=>
  slots[i]<0?0:Math.max(0,Number(save?.tiles?.[i]??-1)+1));
 const initial=Array(LENGTH).fill(0),flex=[];
 for(let i=0;i<LENGTH;i++){
  if(slots[i]<0)continue;
  if(tiles[i]>=target)initial[i]=tiles[i];
  else flex.push(i);
 }
 let run=0,previous=-2,benchStart=null;
 for(const pos of flex){
  run=pos===previous+1?run+1:1;
  previous=pos;
  if(run>=workspace){benchStart=pos-workspace+1;break;}
 }
 if(benchStart===null)
  return {available:false,reason:"No contiguous workspace for the replay."};
 const start=benchStart,end=start+workspace;
 // Park hypothetical copies built before the final copy; existing targets
 // and all existing higher-tier sushi retain their original locations.
 let parked=0;
 for(const pos of flex){
  if(pos>=start&&pos<end)continue;
  if(parked>=finalCopies-1)break;
  initial[pos]=target;parked++;
 }
 if(parked<finalCopies-1)
  return {available:false,reason:"Not enough room to park the earlier target copies."};
 const board=initial.slice(),steps=[];
 const limit=Math.max(100,Math.floor(maxActions));
 const add=(kind,more)=>{
  if(steps.length>=limit)throw Error("Construction replay action limit reached");
  steps.push({kind,...more,board:Uint8Array.from(board)});
 };
 const ingredient=(pos)=>{
  if(slots[pos]<0||board[pos]!==0)throw Error("Ingredient cell is not empty");
  board[pos]=source;
  add(partial?"prepared":"cook",{at:pos,tier:source,events:[]});
 };
 const merge=(src,dst,shouldWind)=>{
  const outcome=simulateMerge(board,src,dst,cap,25,64);
  if(!outcome)throw Error("Illegal merge");
  const winds=outcome.events.filter(e=>e.kind==="wind");
  if(winds.length!==(shouldWind?1:0))
   throw Error("Unexpected Wind effect");
  for(let i=0;i<LENGTH;i++)board[i]=outcome.board[i];
  add("merge",{src,dst,tier:board[dst],events:outcome.events});
 };
 const relocate=(src,dst)=>{
  const outcome=simulateRelocation(board,src,dst,slots,64);
  if(!outcome)throw Error("Unreplayable reposition");
  for(let i=0;i<LENGTH;i++)board[i]=outcome.board[i];
  add("move",{src,dst,tier:board[dst],events:[]});
 };
 function construct(level,pos){
  if(level<0){ingredient(pos);return pos;}
  const stage=active[level],from=Number(stage.from),to=Number(stage.to);
  if(stage.wind){
   const a=construct(level-1,pos);
   const b=construct(level-1,pos+1);
   const c=construct(level-1,pos+2);
   if(a!==pos||b!==pos+1||c!==pos+2||
      board[a]!==from||board[b]!==from||board[c]!==from)
    throw Error("Wind ingredients are not correctly staged");
   merge(a,b,true);merge(c,b,false);
   if(board[b]!==to)throw Error("Wind result tier mismatch");
   if(to<64){relocate(b,pos);return pos;}
   return b;
  }
  const a=construct(level-1,pos),b=construct(level-1,pos+1);
  if(a!==pos||b!==pos+1||board[a]!==from||board[b]!==from)
   throw Error("Ordinary merge ingredients are not correctly staged");
  merge(b,a,false);
  if(board[a]!==to)throw Error("Ordinary merge result mismatch");
  return a;
 }
 let destination;
 try{
  destination=construct(active.length-1,start);
  if(board[destination]!==target)
   throw Error("Target sushi was not constructed");
  if(board.filter(t=>t===target).length!==Number(search.targetCount))
   throw Error("Replay produced the wrong final target count");
  for(let i=0;i<LENGTH;i++)if(tiles[i]>target&&board[i]!==tiles[i])
   throw Error("Protected sushi was changed");
 }catch(error){
  return {available:false,reason:String(error.message||error)};
 }
 let lastMerge=0,merges=0;
 for(let i=steps.length-1;i>=0;i--){
  if(steps[i].kind!=="merge")continue;
  merges++;
  if(merges===8){lastMerge=i+1;break;}
 }
 return {available:true,initial:Uint8Array.from(initial),
  final:Uint8Array.from(board),steps,slots,sourceTier:source,
  actualCookTier:trueSource,targetTier:target,workspaceStart:start,
  workspaceSlots:workspace,parked,partial,skippedStages:begin,
  lastMergesIndex:lastMerge};
}
