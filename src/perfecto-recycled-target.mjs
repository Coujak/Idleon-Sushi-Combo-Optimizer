// Progressive East Wind staircase target construction.
// Reproduces the T45 -> T49 six-merge example, then repeatedly refills T45,
// feeds the west-to-east staircase into a two-sushi carrier, and moves the
// promoted staircase back west. Unlike recursive three-to-one recipes, these
// same higher tiers are recycled across successive cycles.
//
// Above the account's Wind tier limit, this builds many (WindCap+1) sushi
// and combines them with ordinary legal merges. All steps are simulated;
// no Salt, fictional ingredients, or invisible tile deletion is assumed.
import {simulateMerge,simulateRelocation} from "./optimizer-core.mjs";

const SIZE=120;
const unavailable=reason=>({available:false,reason,mode:"recycling"});
const allowedTier=(n)=>Number.isInteger(n)&&n>=1&&n<=64;

export function recycledWindWorkspace(sourceTier,targetTier,windCap){
 const base=Number(sourceTier),target=Number(targetTier),cap=Number(windCap);
 if(!allowedTier(base)||base>46||!allowedTier(target)||target<=base+4||
    !Number.isInteger(cap)||cap<base+4||cap>58)
  return null;
 // A complete staircase requires at most 25 successive Wind upgrades.
 // An overly long staircase would be cut short by the simulator.
 const plateau=Math.min(target-1,cap);
 if(plateau-base>24)return null;
 const bootstrap=base+4;
 let highest=bootstrap,maxWidth=12;
 if(target<=cap){
  while(highest+2<=target){
   maxWidth=Math.max(maxWidth,2*(highest-base)+4);
   highest+=2;
  }
  if(highest<target)maxWidth=Math.max(maxWidth,2*(highest-base)+3);
  return {sourceTier:base,targetTier:target,windCap:cap,
   workspaceSlots:maxWidth,parkingSlots:2,
   requiredSlots:maxWidth+2,highTargetTier:target};
 }
 // Build a reusable plateau at exactly WindCap.
 while(highest+2<=plateau){
  maxWidth=Math.max(maxWidth,2*(highest-base)+4);
  highest+=2;
 }
 if(highest<plateau){
  maxWidth=Math.max(maxWidth,2*(highest-base)+3);
  highest++;
 }
 const gap=target-(cap+1);
 const copies=2**gap;
 if(!Number.isSafeInteger(copies)||copies>48)return null;
 maxWidth=Math.max(maxWidth,2*(cap-base)+3);
 const extra=(plateau-bootstrap)%2===1?1:0;
 const parkingSlots=Math.max(2,copies)+extra;
 return {sourceTier:base,targetTier:target,windCap:cap,
  workspaceSlots:maxWidth,parkingSlots,
  requiredSlots:maxWidth+parkingSlots,
  highTargetTier:cap+1,highCopies:copies,
  extraPlateau:extra};
}

export function createPerfectoRecycledTargetReplay(save,search,plan,target,
 {maxSteps=3500}={}){
 const source=Number(search?.sourceTier),cap=Number(search?.windCap);
 const spec=recycledWindWorkspace(source,target,cap);
 if(!spec)return unavailable("The account's Wind limit or free space does not support the recycled staircase for this target.");
 const slots=Array.from({length:SIZE},(_,i)=>Number(save?.slots?.[i]??-1));
 const finalPlan=plan?.board;
 if(!Array.isArray(finalPlan)||finalPlan.length!==SIZE)
  return unavailable("No recommended board is available as a staging reference.");
 const protectedPositions=new Set();
 for(let pos=0;pos<SIZE;pos++){
  const original=Number(save?.tiles?.[pos]??-1)+1;
  if(slots[pos]>=0&&original>=target)protectedPositions.add(pos);
 }
 // A dedicated contiguous workspace plus enough parking slots is essential.
 // Protected sushi never move; the display is explicitly a *teaching* board.
 let begin=-1;
 for(let pos=0;pos+spec.requiredSlots<=SIZE;pos++){
  if(Array.from({length:spec.requiredSlots},(_,i)=>pos+i).every(
   i=>slots[i]>=0&&!protectedPositions.has(i))){
   begin=pos;break;
  }
 }
 if(begin<0)return unavailable("This recursive Wind demonstration needs "+
  spec.requiredSlots+" contiguous unlocked cells, excluding protected sushi.");
 const width=spec.workspaceSlots,parking=Array.from(
  {length:spec.parkingSlots},(_,i)=>begin+width+i);
 const initial=Array.from({length:SIZE},(_,i)=>{
  if(slots[i]<0)return 0;
  if(i>=begin&&i<begin+spec.requiredSlots)return 0;
  const original=Number(save?.tiles?.[i]??-1)+1;
  return protectedPositions.has(i)?original:
   Math.max(0,Number(finalPlan[i]?.preparedTier??-1)+1);
 });
 const board=initial.slice();
 const steps=[],cycles=[],harvested=[];
 const sourceCost=Number(search?.sourceCost);
 let totalCooks=0,totalMerges=0,totalWind=0,totalMoves=0;
 let high=source+4;
 const maxActions=Math.max(50,Math.floor(Number(maxSteps)||3500));
 function append(kind,attrs,description){
  if(steps.length>=maxActions)throw Error("Recycling replay exceeded the action budget.");
  steps.push({kind,...attrs,description,board:Uint8Array.from(board)});
 }
 function cook(local,description){
  const i=begin+local;
  if(local<0||local>=spec.requiredSlots||board[i]!==0)
   throw Error("Cooking location is unavailable at position "+(i+1));
  board[i]=source;totalCooks++;
  append("cook",{at:i,tier:source,events:[]},description||
   "Cook T"+source+" at position "+(i+1));
 }
 function merge(left,right,description){
  const src=begin+left,dst=begin+right;
  const result=simulateMerge(board,src,dst,cap,25,64);
  if(!result)throw Error("Illegal merge "+(src+1)+" → "+(dst+1));
  for(let i=0;i<SIZE;i++)board[i]=result.board[i];
  totalMerges++;
  const winds=result.events.filter(e=>e.kind==="wind");
  totalWind+=winds.length;
  append("merge",{src,dst,tier:board[dst],events:result.events},
   (description??"Merge")+" position "+(src+1)+" into "+(dst+1)+
   " → T"+board[dst]+(winds.length?
    "; Wind upgrades "+winds.length+" sushi":""));
 }
 function move(localSrc,localDst,description){
  const src=begin+localSrc,dst=begin+localDst;
  const result=simulateRelocation(board,src,dst,slots,64);
  if(!result)throw Error("Illegal relocation "+(src+1)+" → "+(dst+1));
  for(let i=0;i<SIZE;i++)board[i]=result.board[i];
  totalMoves++;
  append("move",{src,dst,tier:board[dst],events:[]},
   (description??"Move")+" T"+board[dst]+" from "+(src+1)+" to "+(dst+1));
 }
 function fill(first,last,description){
  for(let i=first;i<=last;i++){
   const tier=board[begin+i];
   if(tier===0)cook(i,description);
   else if(tier!==source)throw Error("Non-base sushi blocks the refill workspace.");
  }
 }
 function checkLadder(){
  const k=high-source;
  for(let i=0;i<k;i++)if(board[begin+i]!==high-i)
   throw Error("The recycled staircase lost T"+(high-i)+" at "+(begin+i+1));
 }
 function cycle(complete,mode,description){
  const k=high-source;
  const end=2*k+(complete?3:2);
  if(end>=width)throw Error("Insufficient contiguous Wind construction space.");
  checkLadder();
  const at=steps.length;
  cycles.push({step:at+1,from:high,to:high+(complete?2:1),
   description:description??"Refill and promote the retained staircase"});
  fill(k,end,"Refill the staircase with T"+source);
  merge(k,k+1,"Seed a new two-sushi Wind carrier:");
  for(let i=k-1;i>=0;i--){
   const n=merge;
   n(i,k+1,"Feed the existing T"+(high-i)+" staircase into the carrier:");
  }
  if(complete){
   merge(k+1,k+2,"Combine the promoted pair and upgrade its descending tail:");
   for(let i=0;i<k+2;i++)move(k+2+i,i,"Recycle the upgraded staircase:");
   high+=2;checkLadder();
   return;
  }
  if(mode==="grow"){
   move(k+1,0,"Keep the promoted apex:");
   const extra=parking.at(-1)-begin;
   if(board[begin+extra]!==0)throw Error("No room to park the extra apex.");
   move(k+2,extra,"Store the second apex for later:");
   for(let i=0;i<k;i++)move(k+3+i,i+1,"Recycle the upgraded staircase:");
   high++;checkLadder();
   return;
  }
  // Harvest both newly promoted sushi. Keep the original descending tail,
  // now one tier higher, so it can produce the next pair after another refill.
  for(let j=0;j<2;j++){
   const dst=parking[harvested.length]-begin;
   if(!Number.isInteger(dst)||board[begin+dst]!==0)
    throw Error("The storage positions for high-tier sushi are exhausted.");
   move(k+1+j,dst,"Park a Wind-built T"+(high+1)+" for the final merges:");
   harvested.push(dst);
  }
  for(let i=0;i<k;i++)move(k+3+i,i,"Recycle the remaining staircase:");
  checkLadder();
 }
 function directHighCombines(){
  if(!harvested.length)throw Error("No high-tier sushi were produced.");
  let active=harvested.slice(),tier=cap+1;
  while(tier<target){
   if(active.length%2!==0)throw Error("High-tier parking count is not even.");
   const next=[];
   for(let i=0;i<active.length;i+=2){
    // Right-to-left merge never invokes Wind, regardless of tier.
    merge(active[i+1],active[i],"Merge two T"+tier+" sushi above the Wind limit:");
    next.push(active[i]);
   }
   active=next;tier++;
  }
  if(!active.length||board[begin+active[0]]!==target||
     (target>cap+1&&active.length!==1))
   throw Error("The fallback merges did not produce the target tier.");
  return begin+active[0];
 }
 let resultingTargetPosition=null;
 try{
  cycles.push({step:1,from:source,to:source+4,
   description:"Reproduce the six-merge T"+source+" → T"+(source+4)+" staircase"});
  fill(0,11,"Fill the initial workspace with directly cookable T"+source);
  merge(0,1,"Start the first Wind pair:");
  merge(1,2,"Promote the first pair:");
  merge(4,5,"Prepare the next Wind pair:");
  merge(3,5,"Connect the recycled lower tier:");
  merge(2,5,"Feed the higher sushi into the Wind carrier:");
  merge(5,6,"Build the first four-tier staircase:");
  for(let i=0;i<4;i++)move(6+i,i,"Pack the descending staircase to the west:");
  checkLadder();
  if(target<=cap){
   while(high+2<=target)cycle(true,"","Repeat the refill/merge/relocate cycle:");
   if(high<target)cycle(false,"grow","Produce the next target tier via Wind:");
   resultingTargetPosition=begin;
  }else{
   while(high+2<=cap)cycle(true,"","Grow the reusable staircase:");
   if(high<cap)cycle(false,"grow","Extend the staircase to the Wind limit:");
   if(high!==cap)throw Error("Could not construct the Wind-limit staircase.");
   while(harvested.length<spec.highCopies)
    cycle(false,"harvest","Refill and harvest two reusable T"+(cap+1)+" sushi:");
   resultingTargetPosition=directHighCombines();
  }
  if(board[resultingTargetPosition]!==target)
   throw Error("The final sushi tier does not match the target.");
  if(steps.length>=maxActions)
   throw Error("The replay is too large for the available action budget.");
 }catch(error){return unavailable(String(error.message||error));}
 const final=Uint8Array.from(board);
 let lastMergesIndex=0,seen=0,windCascadeIndex=null,longestWind=0;
 for(let i=steps.length-1;i>=0;i--){
  if(steps[i].kind==="merge"&&++seen===8){lastMergesIndex=i+1;break;}
 }
 for(let i=0;i<steps.length;i++){
  const count=steps[i].events?.filter(e=>e.kind==="wind").length??0;
  if(count>longestWind){longestWind=count;windCascadeIndex=i+1;}
 }
 return {
  available:true,mode:"recycling",preparedScenario:true,
  initial:Uint8Array.from(initial),final,slots,steps,cycles,
  totalSteps:steps.length,sourceTier:source,targetTier:target,
  requiredSlots:spec.requiredSlots,workspaceSlots:width,
  workspacePositions:Array.from({length:width},(_,i)=>begin+i),
  stagingStart:begin,focusPosition:resultingTargetPosition,
  windCap:cap,windUsed:totalWind>0,windCascadeIndex,
  longestWind,
  lastMergesIndex,finalFillIndex:steps.length,
  totalCooks,totalMerges,totalWind,totalMoves,
  getFrame(step){
   const n=Math.max(0,Math.min(steps.length,Math.floor(Number(step)||0)));
   if(n===0)return {board:Uint8Array.from(initial),event:null,
    phase:"staging",description:"Prepared T"+source+
     " construction workspace; all other displayed sushi stay in place."};
   const event=steps[n-1];
   return {board:event.board,event,phase:n===steps.length?"complete":"recycling",
    description:event.description};
  },
  nextCycle(step){
   return cycles.find(x=>x.step>step)?.step??steps.length;
  }
 };
}
