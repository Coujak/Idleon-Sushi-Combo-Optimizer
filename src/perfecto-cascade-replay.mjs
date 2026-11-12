// Physically replay a long-chain East Wind staircase, using the same
// simulator as Combo Meter. Input ingredients are made highest-to-lowest,
// protecting all prepared sushi at every subsequent stage.
import {simulateMerge,simulateRelocation} from "./optimizer-core.mjs";
import {certifiedWindTierRecipe} from "./perfecto-wind-certificate.mjs?v=1.21.1";
import {createPerfectoConstructionReplay} from "./perfecto-construction-replay.mjs?v=1.25.1";

const same=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
const zeroTiles=board=>Array.from(board,t=>t>0?t-1:-1);
export function replayPerfectoSupportCascade(initial,slots,search,support,cascade){
 const fail=reason=>({available:false,reason});
 const positions=support.map(item=>Number(item.position)-1);
 const count=positions.length,first=positions[0];
 if(!Number.isInteger(first)||count<3||count>27||
    positions.some((pos,i)=>pos!==first+i)||
    cascade.ingredientTiers?.length!==count||
    cascade.windChainLength!==count-2||
    cascade.ingredientTiers[0]!==cascade.ingredientTiers[1])
  return fail("Cascade staircase geometry does not match the certificate.");
 const source=Number(search.sourceTier),cap=Number(search.windCap)||0;
 let board=initial.slice();
 const groups=[];
 for(let i=0;i<count;i++){
  const tier=Number(cascade.ingredientTiers[i]),dest=positions[i];
  if(board[dest]!==0)return fail("Cascade ingredient slot is occupied.");
  const before=board.slice();
  let steps=[];
  if(tier<=source){
   board[dest]=tier;
   steps=[{kind:"cook",at:dest,tier,events:[],board:Uint8Array.from(board)}];
  }else{
   const recipe=certifiedWindTierRecipe(source,tier,cap);
   const existing=board.filter(value=>value===tier).length;
   const local={windCap:cap,targetCount:existing+1,
    certificate:{...recipe,startingTier:source,targetTier:tier,finalCopies:1}};
   const part=createPerfectoConstructionReplay({slots,tiles:zeroTiles(board)},
    local,tier,{maxIngredients:50000,maxActions:180000});
   if(!part.available)return fail("T"+tier+" ingredient cannot be built: "+part.reason);
   if(part.partial)return fail("T"+tier+" requires a higher-tier checkpoint.");
   if(!same(Array.from(part.initial),board))
    return fail("T"+tier+" ingredient would overwrite existing sushi.");
   steps=part.steps;
   board=Array.from(part.final);
   const made=board.flatMap((value,pos)=>value===tier&&before[pos]!==tier?[pos]:[]);
   if(made.length!==1)return fail("T"+tier+" ingredient position is ambiguous.");
   if(made[0]!==dest){
    const relocated=simulateRelocation(board,made[0],dest,slots,64);
    if(!relocated)return fail("Cannot place T"+tier+" into its trigger position.");
    board=relocated.board;
    steps=[...steps,{kind:"move",src:made[0],dst:dest,tier,
     events:[],board:Uint8Array.from(board)}];
   }
  }
  groups.push({tier,dest,description:i<2?
   "Prepare T"+tier+" Wind trigger "+(i+1)+" of 2":
   "Prepare T"+tier+" descending cascade ingredient",steps});
 }
 const merged=simulateMerge(board,first,first+1,cap,25,64);
 if(!merged)return fail("The cascade triggering merge is illegal.");
 const wind=merged.events.filter(event=>event.kind==="wind");
 if(wind.length!==count-2||
    wind.some((event,i)=>event.at!==first+2+i))
  return fail("Expected "+(count-2)+" Wind upgrades, got "+wind.length+".");
 board=merged.board;
 groups.push({tier:cascade.triggerTier,dest:first+1,
  description:"Trigger "+wind.length+" simultaneous Heat of the East Wind upgrades",
  steps:[{kind:"merge",src:first,dst:first+1,
   tier:board[first+1],events:merged.events,board:Uint8Array.from(board)}]});
 for(let i=1;i<count;i++){
  const src=first+i,dst=src-1;
  const moved=simulateRelocation(board,src,dst,slots,64);
  if(!moved)return fail("Cannot shift upgraded sushi to position "+(dst+1)+".");
  board=moved.board;
  groups.push({tier:board[dst],dest:dst,
   description:"Move the Wind-upgraded sushi to its final position",
   steps:[{kind:"move",src,dst,tier:board[dst],
    events:[],board:Uint8Array.from(board)}]});
 }
 const low=Number(cascade.finalCookTier),last=positions.at(-1);
 if(low>source||low<1||board[last]!==0)
  return fail("The last low-tier sushi cannot be cooked directly.");
 board[last]=low;
 groups.push({tier:low,dest:last,
  description:"Directly cook the final T"+low+" into the last support cell",
  steps:[{kind:"cook",at:last,tier:low,events:[],board:Uint8Array.from(board)}]});
 for(let i=0;i<count;i++)if(board[positions[i]]!==Number(support[i].tier))
  return fail("The cascade does not match the recommended staircase.");
 return {available:true,board,groups,windCount:wind.length};
}
