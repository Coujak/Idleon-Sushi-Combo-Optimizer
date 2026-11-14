// Continuous Sushi Knowledge rotations, sharing the Combo Meter merge and
// movement validator. The full imported board is the initial state.
// No Sushi is ever deleted or silently replaced between refills.
import {simulateMerge,simulateRelocation} from "./optimizer-core.mjs";
import {packSushiStaircase} from "./knowledge-staircase-packing.mjs?v=1.0.1";

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
 rounds=6,pattern="wind",recipeOffset=0,packingMode="simple",protectedIndices=[],
 protectFocusedMilktoast=true,startingContext="imported",maximumActions=1800
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
 const protectedSet=new Set(protectedIndices);
 for(const index of protectedSet){
  if(!Number.isInteger(index)||!playable.has(index)||board[index]<1)
   throw Error("Protected passive Sushi must occupy an unlocked, filled plate");
 }
 // Always retain the last original T64 as the permanent board anchor.
 // An extra T64 can legally merge INTO it, never consume this one as source.
 const permanentT64Index=initial.lastIndexOf(64);
 const gains=blank(),frames=[];
 let cooks=0,merges=0,windEvents=0,moves=0,fuel=0,roundsDone=0,
  focusCompressed=0,haltReason="",completed=false;
 let activePhase=mode==="focused"?"prepare":"balanced";
 let targetCreated=0,targetMergedInHarvest=0,peakTargetCopies=count(board,targetTier);
 const harvestBatches=[];
 const expDelta=events=>{
  const out=blank();
  for(const event of events){
   if(!Number.isInteger(event.tier)||event.tier<1||event.tier>MAX||event.at<0||event.at>=SIZE)
    throw Error("Invalid Sushi EXP event");
   const value=Number(expAt(event.tier,event.at));
   if(!(value>=0)||!Number.isFinite(value))throw Error("Knowledge EXP cannot be calculated");
   out[event.tier]+=value;gains[event.tier]+=value;
   if(mode==="focused"&&event.tier===targetTier)targetCreated++;
  }
  return out;
 };
 const record=(kind,title,detail,events=[],values=blank(),extras={})=>{
  if(mode==="focused")peakTargetCopies=Math.max(peakTargetCopies,count(board,targetTier));
  frames.push({kind,title,detail,board:board.slice(),events,gains:values,
   protectedIndices:[...protectedSet],phase:activePhase,
   targetCopies:mode==="focused"?count(board,targetTier):null,
   targetCreated:mode==="focused"?targetCreated:null,
   exp:values.reduce((a,b)=>a+b,0),...extras});
 };
 record("start",startingContext==="designed"?"Preparation design start":"Current Sushi board",
  startingContext==="designed"?
   "Designed preparation scenario, not the imported Sushi inventory. "+
   "Any needed cleanup of the current board must be done legally before this plan. "+
   "The original highest-tier anchor stays in its original position.":
   "This is the imported board; no Sushi were removed to make space.");
 const applyMerge=(src,dst,kind="merge")=>{
  const old=board;
  const action=simulateMerge(old,src,dst,windCap,chain,64);
  if(!action||protectedSet.has(src)||
   (protectedSet.has(dst)&&old[dst]!==64)||
   action.events.some(e=>!playable.has(e.at))||
   [...protectedSet].some(i=>action.board[i]!==old[i]))return false;
  board=action.board;
  if(mode==="focused"&&activePhase==="harvest"&&
   old[src]===targetTier&&old[dst]===targetTier)targetMergedInHarvest+=2;
  if(mode==="focused"&&protectFocusedMilktoast)
   for(const ev of action.events)
    if(ev.tier===targetTier&&slots[ev.at]===3)protectedSet.add(ev.at);
  const values=expDelta(action.events);
  merges++;windEvents+=action.events.length-1;
  record(kind,(activePhase==="harvest"?"Harvest · ":"")+"Merge T"+old[src]+" → T"+board[dst],
   location(src)+" → "+location(dst)+
   (action.events.length>1?" · "+(action.events.length-1)+" East Wind upgrades":""),
   action.events,values,{src,dst});
  return true;
 };
 const applyMove=(src,dst)=>{
  if(protectedSet.has(src)||protectedSet.has(dst))return false;
  const result=simulateRelocation(board,src,dst,slots,MAX);
  if(!result)return false;
  board=result.board;moves++;
  if(mode==="focused"&&protectFocusedMilktoast&&
    result.tier===targetTier&&slots[dst]===3)protectedSet.add(dst);
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
  if(mode==="focused"&&protectFocusedMilktoast&&
    result===targetTier&&slots[at]===3)protectedSet.add(at);
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
      if(src===permanentT64Index||protectedSet.has(src)||
       (protectedSet.has(dst)&&board[dst]!==64))continue;
      const action=simulateMerge(board,src,dst,windCap,chain,64);
      if(!action||action.events.some(e=>!playable.has(e.at))||
       [...protectedSet].some(i=>action.board[i]!==board[i]))continue;
      // Treat every stored target copy as banked during preparation.
      // Wind must not silently turn a banked T58 into a T59.
      if(mode==="focused"&&activePhase==="prepare"&&
       board.some((v,i)=>v===targetTier&&action.board[i]!==v))continue;
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
       createsTarget*10000+reach*32+wind*5+close*.3:
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
  let repositioned=0;
  // When possible, move a newly made T58 onto a vacant Milktoast Plate.
  // Once parked, that particular copy is protected for passive EXP.
  if(mode==="focused"&&protectFocusedMilktoast){
   const milkSlots=slotsFree.filter(i=>slots[i]===3&&board[i]===0);
   for(const dst of milkSlots){
    if(frames.length>=maxActions)break;
    const src=slotsFree.find(i=>board[i]===targetTier&&i!==dst&&
     !protectedSet.has(i)&&slots[i]!==3);
    if(src===undefined)break;
    if(applyMove(src,dst))repositioned++;
   }
  }
  if(packingMode==="ascending"||packingMode==="descending"){
   const packing=packSushiStaircase(board,slots,packingMode,MAX,[...protectedSet]);
   for(const action of packing.actions){
    if(frames.length>=maxActions)break;
    if(!applyMove(action.src,action.dst))
     throw Error("Knowledge staircase move could not be replayed");
    repositioned++;
   }
   return repositioned;
  }
  const usable=slotsFree.slice().sort((a,b)=>a-b);
  const top=usable.slice(0,Math.min(22,Math.max(4,Math.floor(usable.length*.25))));
  const sources=usable.filter(i=>board[i]>0&&!top.includes(i)&&!protectedSet.has(i))
   .sort((a,b)=>{
    if(mode==="focused"){
     const left=board[a]===targetTier,right=board[b]===targetTier;
     if(left!==right)return Number(right)-Number(left);
    }
    return board[b]-board[a]||a-b;
   });
  let parked=repositioned;
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
   const phase=segment+Math.max(0,Math.floor(Number(recipeOffset)||0));
   let tier=requestedTier;
   if(pattern==="wind"){
    const offsets=[0,0,1,2,3,4,5,6];
    tier=Math.max(1,requestedTier-offsets[phase%offsets.length]);
   }else if(pattern==="longWind"){
    // Two starting copies and a descending 25-tier staircase make a
    // legitimate full-length East Wind trigger when the tier is high enough.
    const step=phase%27;
    tier=Math.max(1,requestedTier-(step<2?0:step-1));
   }else if(pattern==="paired"){
    tier=Math.max(1,requestedTier-(Math.floor(phase/2)%5));
   }else if(pattern==="spread"){
    tier=Math.max(1,requestedTier-(Math.floor(phase/3)%9));
   }else if(pattern==="widePairs"){
    tier=Math.max(1,requestedTier-(Math.floor(phase/2)%10));
   }
   if(!performCook(i,tier))break;
   segment++;last=i;
  }
  return countBefore;
 }
 // Harvest is a distinct phase, not a greedily selected incidental merge.
 // Build the maximum available target stockpile before ever consuming T58
 // copies into T59. Merge only unprotected equal-tier pairs during harvest;
 // the source tier being consumed does NOT earn the target's EXP.
 function harvestFocus(reason){
  if(mode!=="focused"||count(board,targetTier)<2)return false;
  const before=count(board,targetTier);
  const filledBefore=occupied(board);
  activePhase="harvest";
  record("stage","Harvest prepared T"+targetTier+" Sushi",
   before+" T"+targetTier+" copies prepared · "+reason+
   ". Consolidate pairs into higher tiers to recover space. "+
   "Merging T"+targetTier+" into T"+(Math.min(MAX,targetTier+1))+
   (targetTier===64?" (capped)":"")+" awards EXP to the RESULT tier.");
  let merged=0;
  for(let tier=targetTier;tier<=MAX&&frames.length<maxActions;tier++){
   // Higher-tier products from lower-tier harvest merges can themselves pair.
   while(frames.length<maxActions){
    const indices=slotsFree.filter(i=>board[i]===tier);
    const sources=indices.filter(i=>i!==permanentT64Index&&!protectedSet.has(i));
    let picked=null;
    for(const src of [...sources].reverse()){
     for(const dst of indices){
      if(src===dst||protectedSet.has(dst)&&tier!==64)continue;
      const candidate=simulateMerge(board,src,dst,windCap,chain,MAX);
      if(!candidate||candidate.events.some(e=>!playable.has(e.at))||
       [...protectedSet].some(i=>candidate.board[i]!==board[i]))continue;
      // Prefer non-cascading harvest merges: a T58+T58 creates T59
      // without upgrading unconsumed T58 copies through Wind.
      if(!picked||src>dst&&picked.src<picked.dst)
       picked={src,dst};
     }
    }
    if(!picked)break;
    if(!applyMerge(picked.src,picked.dst))throw Error("Harvest replay diverged");
    merged++;
   }
  }
  const after=count(board,targetTier);
  const reclaimed=filledBefore-occupied(board);
  focusCompressed+=Math.max(0,before-after);
  harvestBatches.push({before,after,merged,reclaimed,reason});
  record("stage","Harvest finished · "+reclaimed+" slots recovered",
   merged+" legal merges · "+after+" T"+targetTier+
   " copies remain (protected copies can remain banked). "+
   "Refill freed slots to begin another preparation.");
  activePhase="prepare";
  return merged>0;
 }
 if(mode==="focused"){
  record("stage","Prepare T"+targetTier+" copies",
   "Fill and merge lower tiers to create as many T"+targetTier+
   " Sushi as possible. Every created T"+targetTier+
   " earns its own Knowledge EXP; saved copies are not merged yet.");
  for(let wave=1;wave<=Math.max(1,Math.min(16,Math.floor(rounds)||6));wave++){
   if(frames.length>=maxActions){haltReason="Replay action limit reached";break;}
   // Work on all non-target pairs first. A full target stockpile is harvested
   // only when no further cooking is possible in the current preparation.
   mergePass({compressFocus:false});
   parkLeftovers();
   if(slotsFree.length===occupied(board)){
    if(count(board,targetTier)>=2)harvestFocus("Board full: no empty cooking slots");
    else {haltReason="Board full without a legal target harvest pair";break;}
   }
   if(slotsFree.length===occupied(board)){
    haltReason="No unlocked empty positions remain after legal harvest";break;
   }
   fillRound(wave);
   mergePass({compressFocus:false});
   parkLeftovers();
   roundsDone++;
   // If the preparation has saturated, harvest only after all available
   // non-target merges and Wind cascades have finished.
   if(slotsFree.length===occupied(board)&&count(board,targetTier)>=2)
    harvestFocus("Prepared board saturated after refill "+wave);
  }
  if(!haltReason)haltReason=roundsDone>=rounds?
   "Preparation preview limit reached; banked Sushi carry forward":
   "Focused preparation stopped without an actionable refill";
 }else{
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
  mode,targetTier,requestedTier,rounds:roundsDone,completed,
  focusCopies:focusCount(),focusCompressed,
  targetCreated,targetMergedInHarvest,peakTargetCopies,
  harvestBatches,harvested:harvestBatches.length,
  targetExp:gains[targetTier],
  highestTier:highest(final),remaining:remaining(final,slots),
  active:occupied(final),cooks,merges,moves,windEvents,fuel,
  gains,totalExp,reason:haltReason,
  // This preview is a finite window; not all windows are steady-state.
  packingMode,recipeOffset,protectedIndices:[...protectedSet],
  repeatable:completed&&mode==="balanced"
 };
}
