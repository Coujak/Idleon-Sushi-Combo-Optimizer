// Continuous Sushi Knowledge rotations, sharing the Combo Meter merge and
// movement validator. The full imported board is the initial state.
// No Sushi is ever deleted or silently replaced between refills.
import {simulateMerge,simulateRelocation} from "./optimizer-core.mjs";

const SIZE=120,COLS=15,MAX=64;
const blank=()=>Array(MAX+1).fill(0);
const count=(board,tier)=>board.reduce((n,t)=>n+(t===tier),0);
const occupied=(board)=>board.reduce((n,t)=>n+(t>0),0);
const unique=(arr)=>[...new Set(arr)];
const location=i=>"R"+(Math.floor(i/COLS)+1)+"C"+(i%COLS+1);
const remaining=(board,slots)=>board.flatMap((tier,i)=>slots[i]>=0&&tier>0?[{at:i,tier}]:[]);
const highest=board=>board.reduce((a,b)=>Math.max(a,b),0);

export function simulateContinuousKnowledgeRotation({
 startingBoard,slots,mode="balanced",targetTier=64,requestedTier=1,
 guaranteedBonus=0,windCap=0,chain=0,expAt=()=>1,cookCost=()=>1,
 rounds=6,pattern="wind",maximumActions=1800
}={}){
 if(!Array.isArray(startingBoard)||startingBoard.length!==SIZE||
   !Array.isArray(slots)||slots.length!==SIZE)throw Error("Knowledge rotation requires an 8×15 board");
 if(!Number.isInteger(requestedTier)||requestedTier<1||requestedTier>MAX)throw Error("Invalid starting Sushi tier");
 if(!Number.isInteger(targetTier)||targetTier<1||targetTier>MAX)throw Error("Invalid focused Sushi tier");
 const slotsFree=slots.flatMap((v,i)=>v>=0?[i]:[]);
 if(slotsFree.length<2)return {valid:false,reason:"At least two unlocked slots are required"};
 const playable=new Set(slotsFree);
 const maxActions=Math.max(100,Math.min(4000,Math.floor(maximumActions)||1800));
 let board=startingBoard.slice();
 if(board.some((tier,i)=>tier<0||tier>MAX||!Number.isInteger(tier)||tier>0&&!playable.has(i)))
  throw Error("Imported board contains an invalid Sushi tier or locked position");
 const initial=board.slice();
 const gains=blank(),frames=[];
 let cooks=0,merges=0,windEvents=0,moves=0,fuel=0,roundsDone=0,
  focusCompressed=0,haltReason="",completed=false;
 const expDelta=events=>{
  const out=blank();
  for(const event of events){
   if(!Number.isInteger(event.tier)||event.tier<1||event.tier>MAX||event.at<0||event.at>=SIZE)
    throw Error("Invalid Sushi EXP event");
   const value=Number(expAt(event.tier,event.at));
   if(!(value>=0)||!Number.isFinite(value))throw Error("Knowledge EXP cannot be calculated");
   out[event.tier]+=value;gains[event.tier]+=value;
  }
  return out;
 };
 const record=(kind,title,detail,events=[],values=blank(),extras={})=>{
  frames.push({kind,title,detail,board:board.slice(),events,gains:values,
   exp:values.reduce((a,b)=>a+b,0),...extras});
 };
 record("start","Current Sushi board","This is the imported board; no Sushi were removed to make space.");
 const applyMerge=(src,dst,kind="merge")=>{
  const old=board;
  const action=simulateMerge(old,src,dst,windCap,chain,64);
  if(!action||action.events.some(e=>!playable.has(e.at)))return false;
  board=action.board;
  const values=expDelta(action.events);
  merges++;windEvents+=action.events.length-1;
  record(kind,"Merge T"+old[src]+" → T"+board[dst],
   location(src)+" → "+location(dst)+
   (action.events.length>1?" · "+(action.events.length-1)+" East Wind upgrades":""),
   action.events,values,{src,dst});
  return true;
 };
 const applyMove=(src,dst)=>{
  const result=simulateRelocation(board,src,dst,slots,MAX);
  if(!result)return false;
  board=result.board;moves++;
  record("move","Park T"+result.tier+" at the top",
   location(src)+" → "+location(dst)+" · move Sushi into an empty slot",
   [{kind:"move",at:dst,tier:result.tier}],blank(),{src,dst});
  return true;
 };
 const performCook=(at,tier)=>{
  if(!playable.has(at)||board[at]!==0)return false;
  const result=Math.min(MAX,tier+guaranteedBonus);
  const cost=Number(cookCost(tier));
  if(!Number.isFinite(cost)||cost<0)return false;
  board[at]=result;fuel+=cost;cooks++;
  const event={kind:"cook",at,tier:result};
  record("cook","Cook T"+tier+(result===tier?"":" → T"+result),
   "Fill "+location(at)+" with a fresh Sushi", [event],expDelta([event]),{at,requestedTier:tier});
  return true;
 };
 // A balanced rotation ends only when the entire board is one T64.
 const balancedComplete=()=>occupied(board)===1&&count(board,64)===1;
 const focusCount=()=>count(board,targetTier);
 // Protect focused targets from consumption until the stockpile is full.
 const stashLimit=Math.max(2,slotsFree.length-2);
 const canConsolidateFocus=()=>slotsFree.length-occupied(board)<2||
  focusCount()>=stashLimit;
 function mergePass({compressFocus=false}={}){
  let performed=0;
  while(frames.length<maxActions){
   const groups=new Map();
   board.forEach((tier,i)=>{
    if(tier>0&&!groups.has(tier))groups.set(tier,[]);
    if(tier>0)groups.get(tier).push(i);
   });
   let best=null,bestScore=-Infinity;
   const allowTarget=mode!=="focused"||compressFocus;
   for(const [tier,positions] of groups){
    if(positions.length<2)continue;
    if(mode==="focused"&&tier===targetTier&&!allowTarget)continue;
    const destinations=positions.length<=10?positions:
     unique([...positions.slice(0,5),...positions.slice(-5)]);
    for(const dst of destinations){
     const srcs=positions.filter(x=>x!==dst)
      .sort((a,b)=>Math.abs(a-dst)-Math.abs(b-dst));
     const srcList=unique([
      ...srcs.slice(0,2),
      ...srcs.filter(x=>x<dst).slice(0,1),
      ...srcs.filter(x=>x>dst).slice(0,1)
     ]);
     for(const src of srcList){
      const action=simulateMerge(board,src,dst,windCap,chain,64);
      if(!action||action.events.some(e=>!playable.has(e.at)))continue;
      const events=action.events;
      const createsTarget=events.reduce((sum,e)=>sum+(e.tier===targetTier?1:0),0);
      const reach=events.reduce((sum,e)=>sum+
       (e.tier===targetTier?5:
       Math.min(e.tier,targetTier)/targetTier),0);
      const wind=events.length-1;
      const creates64=events.filter(x=>x.tier===64).length;
      const pairs=new Map();
      for(const t of action.board)if(t>0&&t<64)pairs.set(t,(pairs.get(t)??0)+1);
      const close=[...pairs.values()].reduce((sum,n)=>sum+Math.floor(n/2),0);
      let score=mode==="focused"?
       createsTarget*180+reach*8+wind*6+close*.1:
       wind*23+creates64*18+events.length*5+close*.1;
      if(mode==="focused"&&compressFocus&&tier===targetTier)
       score+=200+focusCount();
      if(mode==="balanced"&&tier===64)score+=500;
      if(mode==="focused"&&tier>targetTier)score-=100;
      score-=Math.abs(src-dst)*.005;
      if(score>bestScore){bestScore=score;best={src,dst};}
     }
    }
   }
   if(!best)break;
   if(!applyMerge(best.src,best.dst))break;
   performed++;
   if(mode==="balanced"&&roundsDone>0&&balancedComplete()){completed=true;break;}
   if(compressFocus&&slotsFree.length-occupied(board)>=
    Math.min(10,Math.ceil(slotsFree.length*.15)))break;
  }
  return performed;
 }
 function parkLeftovers(){
  const usable=slotsFree.slice().sort((a,b)=>a-b);
  const top=usable.slice(0,Math.min(22,Math.max(4,Math.floor(usable.length*.25))));
  const sources=usable.filter(i=>board[i]>0&&!top.includes(i))
   .sort((a,b)=>{
    if(mode==="focused"){
     const left=board[a]===targetTier,right=board[b]===targetTier;
     if(left!==right)return Number(right)-Number(left);
    }
    return board[b]-board[a]||a-b;
   });
  let parked=0;
  for(const src of sources){
   if(frames.length>=maxActions)break;
   const target=top.find(i=>board[i]===0);
   if(target===undefined)break;
   if(applyMove(src,target))parked++;
  }
  return parked;
 }
 function fillRound(round){
  const available=slotsFree.filter(i=>board[i]===0).sort((a,b)=>a-b);
  if(available.length<1)return 0;
  const countBefore=available.length;
  record("refill","Refill "+round,
   "Carry forward "+occupied(board)+" existing Sushi; fill "+available.length+
   " empty slots without overwriting any.");
  let last=-2,segment=0;
  for(const i of available){
   if(frames.length>=maxActions)break;
   if(i!==last+1)segment=0;
   let tier=requestedTier;
   if(pattern==="wind"){
    const offsets=[0,0,1,2,3,4,5,6];
    tier=Math.max(1,requestedTier-offsets[segment%offsets.length]);
   }else if(pattern==="paired"){
    tier=Math.max(1,requestedTier-(Math.floor(segment/2)%5));
   }else if(pattern==="spread"){
    tier=Math.max(1,requestedTier-(Math.floor(segment/3)%9));
   }
   if(!performCook(i,tier))break;
   segment++;last=i;
  }
  return countBefore;
 }
 // The imported board may already be full; first create room only by merging.
 for(let wave=1;wave<=Math.max(1,Math.min(16,Math.floor(rounds)||6));wave++){
  if(frames.length>=maxActions){haltReason="Replay step limit reached";break;}
  if(wave>1&&mode==="balanced"&&balancedComplete()){completed=true;haltReason="One T64 remains";break;}
  record("wave","Merge and refill wave "+wave,
   "Merge matching tiers and East Wind cascades, park survivors, and refill only empty slots.");
  mergePass({compressFocus:false});
  if(mode==="balanced"&&roundsDone>0&&balancedComplete()){completed=true;haltReason="One T64 remains";break;}
  if(mode==="focused"&&canConsolidateFocus()&&focusCount()>=2){
   const was=focusCount();
   mergePass({compressFocus:true});
   if(focusCount()<was)focusCompressed+=was-focusCount();
  }
  parkLeftovers();
  const empty=slotsFree.length-occupied(board);
  if(empty<1){
   // At saturation, allow target-to-target merges to free the board.
   if(mode==="focused"&&focusCount()>=2){
    const was=focusCount();
    mergePass({compressFocus:true});
    if(focusCount()<was)focusCompressed+=was-focusCount();
   }else{
    haltReason="No empty slots or legal pair merges remain";break;
   }
  }
  if(slotsFree.length===occupied(board)){
   haltReason="Board cannot be refilled without illegal deletion";break;
  }
  fillRound(wave);
  mergePass({compressFocus:false});
  roundsDone++;
  if(mode==="balanced"&&balancedComplete()){
   completed=true;haltReason="One T64 remains";break;
  }
  if(mode==="focused"&&canConsolidateFocus()&&focusCount()>=2){
   const before=focusCount();
   mergePass({compressFocus:true});
   if(focusCount()<before)focusCompressed+=before-focusCount();
  }
  parkLeftovers();
 }
 if(!haltReason)haltReason=completed?"Rotation completed":
  roundsDone>=rounds?"Reached the preview refill limit":"No further legal progress";
 const final=board.slice();
 record(completed?"repeat":"partial",
  completed?"Balanced terminal reached":"Current rotation progress",
  completed?"The entire board has consolidated to one T64; future refills can start here.":
  haltReason+". All surviving Sushi remain on the board for the next refill.");
 const totalExp=gains.reduce((a,b)=>a+b,0);
 return {
  valid:true,frames,initialBoard:initial,finalBoard:final,
  rounds:roundsDone,completed,
  focusCopies:focusCount(),focusCompressed,
  highestTier:highest(final),remaining:remaining(final,slots),
  active:occupied(final),cooks,merges,moves,windEvents,fuel,
  gains,totalExp,reason:haltReason,
  // This preview is a finite window; not all windows are steady-state.
  repeatable:completed&&mode==="balanced"
 };
}
