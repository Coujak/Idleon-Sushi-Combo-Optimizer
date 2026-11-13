// Repeatable Knowledge EXP cycle search, based on the exact Combo Meter merge
// simulator. Estimates are conditional on manually preparing the starting board,
// deterministic non-proc cooking, account-derived fuel and user-entered pace.
// Never treats target layouts as the user's existing board.
import {simulateMerge,validateComboReplay} from "./optimizer-core.mjs";
import {finishSushiBoard} from "./knowledge-cycle-cleanup.mjs?v=1.0.0";
import {estimateSushiFuelEconomy,sushiDirectCookFuel} from "./perfecto-fuel.mjs?v=1.16.8";
import {getSushiDashboardMetrics} from "./dashboard-metrics.mjs?v=1.0.2";
import {getKnowledgeRows,getUpgradeRows} from "./lab-model.mjs?v=1.19.13";

const CELLS=120,COLS=15,MAX_TIER=64;
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const validPositive=x=>Number.isFinite(Number(x))&&Number(x)>0;
const unique=arr=>[...new Set(arr)];
const number=x=>Number.isFinite(Number(x))?Number(x):0;
const safeSeconds=(x,defaultValue)=>validPositive(x)?clamp(Number(x),0.2,60):defaultValue;
export const KNOWLEDGE_CYCLE_MODES=[
 {value:"balanced",label:"Balanced · spread EXP across tiers"},
 {value:"focused",label:"Focused · maximize one tier"}
];
export function normalizeKnowledgeCycleOptions(raw={}){
 const x=raw&&typeof raw==="object"?raw:{};
 const target=Number(x.targetTier);
 return {
  mode:x.mode==="focused"?"focused":"balanced",
  targetTier:Number.isInteger(target)&&target>=1&&target<=64?target:null,
  secondsPerCook:safeSeconds(x.secondsPerCook,2),
  secondsPerMerge:safeSeconds(x.secondsPerMerge,1.5),
  fuelGeneration:validPositive(x.fuelGeneration)?Number(x.fuelGeneration):null,
  fuelCapacity:validPositive(x.fuelCapacity)?Number(x.fuelCapacity):null,
  lithiumMultiplier:validPositive(x.lithiumMultiplier)?clamp(Number(x.lithiumMultiplier),1,100):null,
  expPerCreation:validPositive(x.expPerCreation)?clamp(Number(x.expPerCreation),0.001,1e12):null
 };
}
const upgradeRaw=(rows,id)=>rows.find(x=>x.id===id)?.rawBonus??0;
function expContext(save,options,rows,metrics,layoutFires){
 const upgrades=getUpgradeRows(save);
 const unlocked=Number(save?.sushi?.[2]?.[13])>0;
 const searing=Number(upgradeRaw(upgrades,37));
 const third=Number(upgradeRaw(upgrades,38));
 const knowledge=rows.filter(x=>x.discovered&&x.category===1&&Number.isFinite(x.bonus))
  .reduce((a,x)=>a+x.bonus,0);
 const multiplier=(1+Math.max(0,third)/100)*(1+Math.max(0,knowledge)/100);
 // 2nd Degree Searing starts at 1.1 EXP (Lv 1), increasing by 0.1 per
 // effective level. The optional in-game EXP input takes precedence.
 const raw=options.expPerCreation??(1+Math.max(0,searing)/10);
 const lithiumUnlocked=Number(save?.sushi?.[2]?.[26])>0;
 // Lithium Firelighter is a 2× Knowledge EXP multiplier on Sushi above pink
 // fireplaces, including creation and passive sources (passive is not yet
 // included in this active-only cycle). Allow explicit calibration override.
 const lithiumMultiplier=lithiumUnlocked?(options.lithiumMultiplier??2):1;
 const fires=layoutFires.slice();
 const expAt=(tier,index)=>!unlocked?0:
  raw*multiplier*(fires[index%COLS]===3?lithiumMultiplier:1);
 return {unlocked,fires,lithiumUnlocked,lithiumMultiplier,raw,multiplier,knowledge,third,
  pinkCalibrated:lithiumUnlocked,
  expAt,
  knownCooks:metrics?.cookBonusComplete===true,
  guaranteedCookBonus:metrics?.cookBonusComplete?
   clamp(Math.floor(number(metrics.guaranteedCookTiers)),0,63):0,
  cookRemainder:metrics?.cookBonusComplete?number(metrics.fractionalCookChance):null};
}
function normalizeLayout(save){
 const slots=Array.from({length:CELLS},(_,i)=>{
  const x=Number(save?.slots?.[i]);
  return Number.isInteger(x)&&x>=0&&x<=3?x:-1;
 });
 const tiles=Array.from({length:CELLS},(_,i)=>{
  const x=Number(save?.tiles?.[i]);
  return slots[i]>=0&&Number.isInteger(x)&&x>=0&&x<=63?x+1:0;
 });
 const fires=Array.from({length:COLS},(_,i)=>{
  const x=save?.fires?.[i],n=Number(x);
  return x!==undefined&&x!==null&&Number.isInteger(n)&&n>=0&&n<=4?n:-1;
 });
 return {slots,tiles,fires,unlocked:slots.filter(x=>x>=0).length};
}
function candidateBases(economy,guaranteed,options){
 const cap=number(economy?.capacity),maxCook=number(economy?.maxCookTier);
 const max=Math.min(MAX_TIER-guaranteed,Math.floor(maxCook));
 if(!max||cap<=0)return [];
 const affordable=[];
 for(let tier=1;tier<=max;tier++){
  const cost=sushiDirectCookFuel(tier);
  if(Number.isFinite(cost)&&cost>0&&cost<=cap)
   affordable.push(tier);
 }
 if(!affordable.length)return [];
 const focus=options.targetTier??1;
 const choices=options.mode==="focused"?
  [1,focus-guaranteed,focus-guaranteed-1,focus-guaranteed-2,
   focus-guaranteed-3,focus-guaranteed-5,focus-guaranteed-8,
   max,max-1,Math.round(max/2),Math.round(max*.7)]:
  [1,Math.round(max*.15),Math.round(max*.3),Math.round(max*.5),
   Math.round(max*.7),Math.round(max*.9),max,max-1];
 return unique(choices).filter(t=>affordable.includes(t))
  .concat(affordable.length<=4?affordable:[]).filter((t,i,a)=>a.indexOf(t)===i);
}
function fillPattern(layout,protectedIndices,cookTier,guaranteed,pattern){
 const board=Array(CELLS).fill(0),cooks=[],keep=new Set(protectedIndices);
 for(const i of protectedIndices)board[i]=layout.tiles[i];
 const spaces=layout.slots.map((x,i)=>x>=0&&!keep.has(i)?i:-1).filter(x=>x>=0);
 let segment=0,last=-2;
 const maxUpper=cookTier+guaranteed;
 for(let k=0;k<spaces.length;k++){
  const i=spaces[k];
  if(i!==last+1)segment=0;
  let requested=cookTier;
  if(pattern==="wind"&&guaranteed===0){
   const positions=[0,0,1,2,3,4,5,6];
   requested=Math.max(1,cookTier-positions[segment%positions.length]);
  }else if(pattern==="bands"&&guaranteed===0){
   const offset=Math.floor((segment%12)/2)%6;
   requested=Math.max(1,cookTier-offset);
  }else if(pattern==="spread"&&guaranteed===0){
   const low=Math.max(1,cookTier-18);
   const steps=5,step=Math.max(1,Math.floor((cookTier-low)/steps));
   requested=Math.max(1,cookTier-step*(Math.floor((segment%12)/2)%6));
  }
  const output=Math.min(MAX_TIER,requested+guaranteed);
  board[i]=output;
  cooks.push({at:i,requestedTier:requested,tier:output,
   fuel:sushiDirectCookFuel(requested)});
  segment++;last=i;
 }
 return {board,cooks,pattern,maxUpper};
}
function gainEvents(events,expAt){
 const byTier=Array(MAX_TIER+1).fill(0);
 for(const event of events)if(event.tier>=1&&event.tier<=MAX_TIER)
  byTier[event.tier]+=expAt(event.tier,event.at);
 return byTier;
}
function addGains(into,from){
 for(let t=1;t<=MAX_TIER;t++)into[t]+=from[t];
}
function totalGains(a){return a.reduce((sum,x)=>sum+x,0);}
function candidateDestinations(indices){
 if(indices.length<=20)return indices;
 const out=[...indices.slice(0,7),...indices.slice(-7)];
 for(let k=1;k<=6;k++)out.push(indices[Math.floor(indices.length*k/7)]);
 return unique(out);
}
function mergeChoices(board,slots,anchorTier,cap,chain,protectedIndices=[]){
 const keep=new Set(protectedIndices);
 const byTier=new Map();
 for(let i=0;i<board.length;i++){
  const tier=board[i];
  if(slots[i]<0||tier<1||tier>MAX_TIER)continue;
  if(!byTier.has(tier))byTier.set(tier,[]);
  byTier.get(tier).push(i);
 }
 const actions=[];
 for(const [tier,positions] of byTier){
  if(positions.length<2)continue;
  for(const dst of candidateDestinations(positions)){
   // The imported highest-tier Sushi can remain at their positions;
   // original T64 copies may only absorb another T64, never move.
   if(keep.has(dst)&&tier!==64)continue;
   const sources=positions.filter(x=>x!==dst&&!keep.has(x))
    .sort((a,b)=>Math.abs(a-dst)-Math.abs(b-dst));
   // Include a left source to permit Wind and right sources for normal merging.
   const left=[...sources].filter(x=>x<dst).slice(0,2);
   const right=[...sources].filter(x=>x>dst).slice(0,2);
   for(const src of unique([...left,...right]).slice(0,4)){
    const action=simulateMerge(board,src,dst,cap,chain,MAX_TIER);
    if(!action||action.events.some(e=>slots[e.at]<0)||
       protectedIndices.some(i=>action.board[i]!==board[i]))continue;
    actions.push(action);
   }
  }
 }
 return actions;
}
function greedyMerge(initial,slots,anchorTier,cap,chain,expAt,mode,targetTier,policy,baseGains,protectedIndices){
 const board=initial.slice(),gains=baseGains.slice(),moves=[];
 let current=board;
 for(let step=0;step<120;step++){
  const options=mergeChoices(current,slots,anchorTier,cap,chain,protectedIndices);
  if(!options.length)break;
  let best=null,bestScore=-Infinity;
  for(const move of options){
   const incoming=gainEvents(move.events,expAt);
   const primary=mode==="focused"?incoming[targetTier]||0:
    incoming.reduce((sum,v,t)=>sum+Math.log1p(v/Math.max(1,gains[t])),0);
   const total=totalGains(incoming);
   let score=primary*(mode==="focused"?100:15)+total*.06;
   const wind=move.events.filter(x=>x.kind==="wind").length;
   const followup=move.board.filter(t=>t===move.events[0].tier).length;
   if(policy===0)score+=wind*.9+followup*.1;
   if(policy===1)score+=followup*.7;
   if(policy===2)score+=wind*3;
   if(policy===3)score+=move.events[0].tier*.04;
   if(policy===4)score-=Math.abs(move.src-move.dst)*.04;
   if(score>bestScore){bestScore=score;best={move,incoming};}
  }
  if(!best)break;
  addGains(gains,best.incoming);
  moves.push(best.move);
  current=best.move.board;
 }
 // validateComboReplay replays every merge/cascade with the existing core.
 const verified=validateComboReplay(initial,moves,cap,chain,slots,MAX_TIER);
 if(!verified.board.every((tier,i)=>tier===current[i]))
  throw Error("Knowledge replay diverged from the verified Combo Meter rules");
 return {finalBoard:current,gains,moves,verified};
}
function scoreRotation(gains,seconds,mode,targetTier,eligibleTiers){
 if(!(seconds>0))return -Infinity;
 const rate=3600/seconds;
 if(mode==="focused")return gains[targetTier]*rate;
 // Proportional fairness: spreading EXP across tiers increases logarithmic utility,
 // while rewarding real EXP/hour (rather than merely counting scheduled tiers).
 return eligibleTiers.reduce((sum,t)=>sum+Math.log1p(gains[t]*rate),0);
}
function buildFrames(candidate,slots,protectedIndices,expAt){
 const frames=[],protectedSet=new Set(protectedIndices);
 let board=Array(CELLS).fill(0);
 for(const i of protectedIndices)board[i]=candidate.startBoard[i];
 const append=(kind,title,detail,events,delta)=>{
  frames.push({kind,title,detail,board:board.slice(),events,
   exp:delta.reduce((a,b)=>a+b,0),gains:delta});
 };
 append("start","Prepared working area",
  "Proposed layout. Existing Sushi must first be merged legally into the reusable highest-tier anchors, not deleted.",
  [],Array(65).fill(0));
 for(const cook of candidate.cooks){
  if(board[cook.at]!==0)throw Error("Refill attempted on an occupied slot");
  board[cook.at]=cook.tier;
  append("cook","Cook T"+cook.requestedTier+" → T"+cook.tier,
   "Fill "+positionName(cook.at)+" · expected output from guaranteed cooking bonuses",
   [{kind:"cook",at:cook.at,tier:cook.tier}],gainEvents([{at:cook.at,tier:cook.tier}],expAt));
  frames.at(-1).at=cook.at;
 }
 if(!board.every((tier,i)=>tier===candidate.startBoard[i]))
  throw Error("Starting board cannot be constructed from the planned direct cooks");
 for(const [index,move] of candidate.moves.entries()){
  const inputTier=board[move.src];
  const actual=simulateMerge(board,move.src,move.dst,candidate.windCap,candidate.chain,MAX_TIER);
  if(!actual||actual.events.length!==move.events.length||
    !actual.board.every((tier,i)=>tier===move.board[i]))
   throw Error("Invalid Knowledge merge replay");
  board=actual.board;
  const cleaning=index>=candidate.optimizingMerges;
  append("merge",(cleaning?"Cleanup merge · ":"Merge ")+"T"+inputTier+
    " → T"+move.events[0].tier,
   positionName(move.src)+" → "+positionName(move.dst)+
   (move.events.length>1?" · "+(move.events.length-1)+" East Wind upgrades":""),
   move.events,gainEvents(move.events,expAt));
  // Expose the source and destination for an independently verifiable replay.
  frames.at(-1).src=move.src;
  frames.at(-1).dst=move.dst;
 }
 if(!board.every((tier,i)=>tier===candidate.finalBoard[i]))
  throw Error("Knowledge cleanup must preserve the exact simulated board");
 if(!candidate.repeatable){
  const stranded=board.filter((tier,i)=>tier>0&&!protectedSet.has(i));
  append("blocked","Unmerged Sushi remain",
   stranded.length+" Sushi cannot be cleared by any legal planned merge. No delete button exists: only equal-tier merges (including T64 + T64 → T64) reduce occupied slots. This is not yet a repeatable EXP rotation.",
   [],Array(65).fill(0));
  return frames;
 }
 if(board.some((tier,i)=>tier>0&&!protectedSet.has(i)))
  throw Error("Never mark a cycle repeatable while Sushi remain");
 append("repeat","Working board cleared by merging",
  "All remaining ingredients were consumed through legal merges. Refill these exact empty positions and repeat.",
  [],Array(65).fill(0));
 return frames;
}
const positionName=i=>"R"+(Math.floor(i/COLS)+1)+"C"+(i%COLS+1);
export function optimizeKnowledgeCycle(save,rawOptions={}){
 const options=normalizeKnowledgeCycleOptions(rawOptions);
 const fail=(reason)=>({available:false,reason,mode:options.mode,options});
 if(!save?.sushi)return fail("Import a Sushi Station save before running the optimizer.");
 const layout=normalizeLayout(save);
 if(layout.unlocked<2)return fail("At least two unlocked plates are required to plan a full merge cycle.");
 const rows=getKnowledgeRows(save);
 const eligible=rows.filter(r=>r.discovered).map(r=>r.tier);
 if(!eligible.length)return fail("No discovered Sushi tiers found in the account data.");
 const targetTier=eligible.includes(options.targetTier)?options.targetTier:eligible[0];
 const economy=estimateSushiFuelEconomy(save,{
  capacityOverride:options.fuelCapacity,generationOverride:options.fuelGeneration
 });
 if(!economy||!(economy.capacity>0)||!(economy.generationPerHour>0))
  return fail("Fuel capacity and generation are unavailable. Enter valid in-game values.");
 const metrics=getSushiDashboardMetrics(save);
 const baseCtx=expContext(save,options,rows,metrics,layout.fires);
 if(!baseCtx.unlocked)return fail("Unlock Seared Knowledge to gain EXP from cooking, merging and Wind creations.");
 // Compare real fireplace choices: pink gives 2× EXP on the column, while
 // replacing an orange fuel fireplace can lower the sustainable refill rate.
 const fireChoices=[{name:"Current fireplaces",fires:layout.fires}];
 if(baseCtx.lithiumUnlocked&&layout.fires.some(x=>x>=0&&x!==3)){
  const variant=which=>layout.fires.map((fire,i)=>fire>=0&&which(i,fire)?3:fire);
  fireChoices.push({name:"All Lithium pink",fires:variant(()=>true)});
  fireChoices.push({name:"Lithium pink on left columns",fires:variant(i=>i%2===0)});
  fireChoices.push({name:"Lithium pink on right columns",fires:variant(i=>i%2===1)});
 }
 const uniqueFires=fireChoices.filter((choice,i,all)=>all.findIndex(
  item=>item.fires.every((fire,j)=>fire===choice.fires[j]))===i);
 const baseline=estimateSushiFuelEconomy(save,{
  capacityOverride:options.fuelCapacity
 });
 const baselineRate=baseline?.modeledGenerationPerHour??0;
 const rateFor=(board,fires)=>{
  const estimate=estimateSushiFuelEconomy({...save,
   tiles:board.map(t=>t>0?t-1:-1),fires},{
   capacityOverride:options.fuelCapacity
  });
  const modeled=estimate?.modeledGenerationPerHour??0;
  // A manually entered live rate refers to the imported fireplace setup.
  // Scale it by modeled orange-fire changes rather than treating it as a
  // constant after switching to Lithium pink.
  return options.fuelGeneration!==null&&baselineRate>0?
   options.fuelGeneration*(modeled/baselineRate):modeled;
 };
 const anchorTier=Math.max(...layout.tiles);
 const protectedIndices=layout.tiles.flatMap((v,i)=>v===anchorTier&&v>0?[i]:[]);
 const highestDiscovered=rows.filter(r=>r.discovered).reduce((a,r)=>Math.max(a,r.tier),0);
 const windCap=Number(save?.sushi?.[2]?.[29])>0?
  Math.max(0,Math.min(58,highestDiscovered-6)):0;
 // Level mechanics of Heat of East Wind depend on the highest discovered tier.
 const chain=windCap>0?25:0;
 const bases=candidateBases(economy,baseCtx.guaranteedCookBonus,{...options,targetTier});
 if(!bases.length)return fail("No directly cookable Sushi tier fits the modeled fuel capacity.");
 let best=null,considered=0;
 for(const requestedTier of bases){
  for(const pattern of baseCtx.guaranteedCookBonus>0?["uniform"]:["uniform","wind","bands","spread"]){
   const prepared=fillPattern(layout,protectedIndices,requestedTier,
    baseCtx.guaranteedCookBonus,pattern);
   if(prepared.cooks.length<2)continue;
   if(anchorTier>0&&prepared.cooks.some(c=>c.tier>=anchorTier))continue;
   const fuel=prepared.cooks.reduce((sum,c)=>sum+c.fuel,0);
   if(!Number.isFinite(fuel)||fuel<=0)continue;
   for(const choice of uniqueFires){
    const ctx=expContext(save,options,rows,metrics,choice.fires);
    const cookGains=Array(65).fill(0);
    for(const c of prepared.cooks)cookGains[c.tier]+=ctx.expAt(c.tier,c.at);
    const protectedBoard=Array(CELLS).fill(0);
    for(const i of protectedIndices)protectedBoard[i]=layout.tiles[i];
    const fuelRateWhilePreparing=rateFor(protectedBoard,choice.fires);
    const fuelRateWithFullBoard=rateFor(prepared.board,choice.fires);
    for(let policy=0;policy<5;policy++){
     const sequence=greedyMerge(prepared.board,layout.slots,anchorTier,windCap,chain,
      ctx.expAt,options.mode,targetTier,policy,cookGains,protectedIndices);
     // A board is not clear until real, replay-validated same-tier merges
     // consume every ingredient outside the original protected anchors.
     const cleanup=finishSushiBoard(sequence.finalBoard,layout.slots,windCap,chain,protectedIndices);
     const moves=[...sequence.moves,...cleanup.moves];
     const gains=sequence.gains.slice();
     for(const move of cleanup.moves)addGains(gains,gainEvents(move.events,ctx.expAt));
     const leftover=cleanup.leftover.length;
     const repeatable=cleanup.repeatable;
     const tCook=prepared.cooks.length*options.secondsPerCook;
     const tMerge=moves.length*options.secondsPerMerge;
     const activeSeconds=tCook+tMerge;
     const fuelRateBeforeClearing=rateFor(cleanup.board,choice.fires);
     // Account for changing fuel output as the board empties by legal merges.
     const fuelRate=(fuelRateWhilePreparing*tCook+fuelRateWithFullBoard*tMerge+
      fuelRateBeforeClearing*options.secondsPerMerge)/Math.max(1,activeSeconds+options.secondsPerMerge);
     if(!(fuelRate>0))continue;
     const fuelWaitSeconds=fuel*3600/fuelRate;
     const cycleSeconds=Math.max(activeSeconds,fuelWaitSeconds);
     const score=scoreRotation(gains,cycleSeconds,options.mode,targetTier,eligible);
     considered++;
     // Prefer a board that actually resets. Among incomplete plans, minimize
     // stranded Sushi before comparing EXP, never pretend they disappeared.
     const isBetter=!best||
      repeatable&&!best.repeatable||
      repeatable===best.repeatable&&
       (repeatable?score>best.score:
        leftover<best.leftover||leftover===best.leftover&&score>best.score);
     if(isBetter){
      best={...prepared,finalBoard:cleanup.board,gains,moves,
       optimizingMerges:sequence.moves.length,cleanupMerges:cleanup.mergeCount,
       startBoard:prepared.board,score,policy,windCap,chain,anchorTier,
       protectedIndices,repeatable,layout,ctx,eligible,targetTier,economy,
       fireChoice:choice.name,fires:choice.fires,fuelRate,
       fuel,activeSeconds,fuelWaitSeconds,cycleSeconds,leftover};
     }
    }
   }
  }
 }
 if(!best)return fail("No legal prepared board was found within the available fuel and space.");
 const ctx=best.ctx;
 const frames=buildFrames(best,layout.slots,protectedIndices,ctx.expAt);
 const actual=frames.reduce((out,f)=>{addGains(out,f.gains);return out;},Array(65).fill(0));
 if(!actual.every((v,i)=>Math.abs(v-best.gains[i])<=1e-8*Math.max(1,v)))
  throw Error("Knowledge EXP replay did not match candidate totals");
 const perTier=rows.filter(r=>r.discovered).map(r=>{
  const expPerCycle=best.gains[r.tier],expPerHour=best.repeatable?
   expPerCycle*3600/best.cycleSeconds:null;
  const remaining=Number.isFinite(r.xpRemaining)?r.xpRemaining:null;
  return {tier:r.tier,name:r.name,level:r.level,remaining,expPerCycle,
   expPerHour,etaHours:expPerHour>0&&remaining!==null?remaining/expPerHour:
    remaining===0?0:null};
 });
 const totalEXP=totalGains(best.gains);
 return {
  available:true,mode:options.mode,targetTier,options,
  layout:best.layout,startingBoard:best.startBoard,
  finalBoard:best.finalBoard,protectedIndices:best.protectedIndices,
  anchorTier,repeatable:best.repeatable,startCookTier:best.cooks[0].requestedTier,
  startingPattern:best.pattern,guaranteedCookBonus:ctx.guaranteedCookBonus,
  cookRemainder:ctx.cookRemainder,bonusXpPerCreation:ctx.raw*ctx.multiplier,
  pinkMultiplier:ctx.pinkCalibrated?ctx.lithiumMultiplier:null,
  proposedFires:ctx.fires,fireChoice:best.fireChoice,windCap:best.windCap,
  steps:frames,merges:best.moves.length,cooks:best.cooks.length,
  windEvents:best.moves.reduce((a,m)=>a+m.events.filter(e=>e.kind==="wind").length,0),
  cleanup:best.cleanupMerges,stranded:best.leftover,
  optimizingMerges:best.optimizingMerges,expByTier:best.gains,perTier,considered,
  fuelPerCycle:best.fuel,estimatedFuelCapacity:economy.capacity,
  estimatedFuelGeneration:best.fuelRate,
  capacityManual:economy.manualCapacity,generationManual:economy.manualGeneration,
  activeSeconds:best.activeSeconds,fuelWaitSeconds:best.fuelWaitSeconds,
  cycleSeconds:best.cycleSeconds,
  totalExpPerCycle:totalEXP,totalExpPerHour:best.repeatable?
   totalEXP*3600/best.cycleSeconds:null,
  targetExpPerHour:best.repeatable?
   best.gains[targetTier]*3600/best.cycleSeconds:null,
  note:"Every merge and cleanup action is verified using the Combo Meter engine; no Sushi can be deleted. EXP/hr and time-to-level appear only if the board can be restored by legal merges. Lithium doubles EXP in pink columns. Passive Milktoast/Cold EXP and uncertain procs are not included; fuel regeneration remains approximate."
 };
}
