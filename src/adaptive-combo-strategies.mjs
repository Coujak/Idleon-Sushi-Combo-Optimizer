// Progression-aware Combo Meter preparation families.
// The historic Experiments are reference *shapes*, never score promises at
// different tier/slot/Wind settings. Every generated layout must be replayed.
import {buildExperimental2Candidates} from "./experimental2-preparation.mjs";
import {buildExperimental3Candidates} from "./experimental3-preparation.mjs";
import {buildExperimental4Candidates} from "./experimental4-preparation.mjs";
import {buildExperimental5Candidates} from "./experimental5-preparation.mjs";
import {buildExperimental6Candidates} from "./experimental6-preparation.mjs";
import {buildExperimental7Candidates} from "./experimental7-preparation.mjs";
import {buildExperimental8Candidates} from "./experimental8-preparation.mjs";
import {buildExperimental9Candidates} from "./experimental9-preparation.mjs";
import {buildExperimental10Candidates} from "./experimental10-preparation.mjs";
import {buildExperimental11Candidates} from "./experimental11-preparation.mjs";
import {buildExperimental12Candidates} from "./experimental12-preparation.mjs";
import {buildExperimental13Candidates} from "./experimental13-preparation.mjs";

// A reference profile describes the arrangement and its strategic insight.
// The benchmarks belong ONLY to the historic T64/T58/100-slot configuration.
export const HISTORICAL_COMBO_STRATEGIES=Object.freeze([
 {number:2,family:"Reserve depth",boundary:30,base:23,benchmark:56315,build:buildExperimental2Candidates},
 {number:3,family:"Reserve depth",boundary:30,base:21,benchmark:57328,build:buildExperimental3Candidates},
 {number:4,family:"Reserve depth",boundary:30,base:18,benchmark:58684,build:buildExperimental4Candidates},
 {number:5,family:"Reserve depth",boundary:30,base:12,benchmark:60572,build:buildExperimental5Candidates},
 {number:6,family:"Third-wave extension",boundary:33,base:11,benchmark:64017,build:buildExperimental6Candidates},
 {number:7,family:"Third-wave extension",boundary:31,base:8,benchmark:65542,build:buildExperimental7Candidates},
 {number:8,family:"Third-wave extension",boundary:31,base:8,benchmark:68415,build:buildExperimental8Candidates},
 {number:9,family:"Three-stage timing",boundary:29,base:10,benchmark:70071,build:buildExperimental9Candidates},
 {number:10,family:"High-tier reserves",boundary:26,base:10,benchmark:73367,build:buildExperimental10Candidates},
 {number:11,family:"High-tier reserves",boundary:24,base:9,benchmark:75047,build:buildExperimental11Candidates},
 {number:12,family:"Merge-order lookahead",boundary:24,base:10,benchmark:75546,build:buildExperimental12Candidates},
 {number:13,family:"Cascade resonance",boundary:24,base:9,benchmark:76532,build:buildExperimental13Candidates}
]);
const referencePositions=Array.from({length:100},(_,i)=>i);
const referenceProfiles=HISTORICAL_COMBO_STRATEGIES.map(def=>{
 const [candidate]=def.build(referencePositions,64,58,25,true);
 if(!candidate||candidate.board.length!==120)throw Error("Invalid historical strategy "+def.number);
 return {def,tiers:candidate.board.slice(0,100)};
});
const uniqSorted=positions=>[...new Set(positions)].sort((a,b)=>a-b);
function available(positions,maxTier,cap,chain){
 return Array.isArray(positions)&&positions.length>=2&&positions.length<=100&&
  positions.every(p=>Number.isInteger(p)&&p>=0&&p<120)&&
  Number.isSafeInteger(maxTier)&&maxTier>=2&&
  Number.isSafeInteger(cap)&&cap>=0&&cap<=Math.max(0,maxTier-6)&&
  Number.isSafeInteger(chain)&&chain>=0&&chain<=25;
}
function workingTops(maxTier,cap){
 // A lower working ceiling can beat blindly filling the highest unlocked tier.
 // The cap is an actual Wind setting, not recalculated from this candidate.
 return [...new Set([maxTier,Math.min(maxTier,cap+6),
   Math.min(maxTier,cap+4),Math.min(maxTier,cap+2)])].filter(t=>t>=2);
}
function protectedTier(maxTier,protectHighest){
 if(!protectHighest)return null;
 // An imported Tier 64 may need preservation even if the *prepared*
 // ingredient ceiling has been deliberately lowered below 64.
 return maxTier>=64?maxTier:64;
}
function makeBoard(positions,tiers){
 const board=Array(120).fill(0);
 for(let i=0;i<positions.length;i++)board[positions[i]]=tiers[i];
 return board;
}
function sections(positions,boundary){
 return {protectedPosition:positions[0],enginePositions:positions.slice(boundary)};
}
function scaledHistorical(positions,maxTier,cap,chain,baseChoice,protectHighest){
 if(positions.length!==100||chain!==25||
  positions.some((p,i)=>i>0&&p!==positions[i-1]+1))return [];
 const protect=protectedTier(maxTier,protectHighest);
 const results=[];
 for(const workingTop of workingTops(maxTier,cap)){
  const shift=workingTop-64;
  for(const {def,tiers} of referenceProfiles){
   const shiftedBase=def.base+shift;
   if(baseChoice&&shiftedBase!==baseChoice)continue;
   const mapped=tiers.map((tier,index)=>index===0?
    protect??Math.min(workingTop,maxTier-1):tier+shift);
   if(mapped.some((tier,index)=>!Number.isInteger(tier)||tier<1||
    (index===0&&protect!==null?tier!==protect:tier>=maxTier)))continue;
   const board=makeBoard(positions,mapped);
   results.push({
    name:"Adaptive · Exp "+def.number+" "+def.family+" at working T"+workingTop,
    board,base:shiftedBase,
    shape:"adaptive "+def.family.toLowerCase(),
    workingTier:workingTop,
    referenceExperiment:def.number,
    historicalBenchmark:null,
    strategySections:sections(positions,def.boundary),
    adaptive:true
   });
  }
 }
 return results;
}
function procedural(positions,maxTier,cap,chain,baseChoice,protectHighest){
 if(positions.some((p,i)=>i>0&&p!==positions[i-1]+1))return [];
 const n=positions.length;
 if(n<8)return [];
 const protect=protectedTier(maxTier,protectHighest);
 const tops=workingTops(maxTier,cap).slice(0,3);
 const baseOptions=baseChoice?[baseChoice]:
  [...new Set([Math.max(1,cap-49),Math.max(1,cap-39),
    Math.max(1,cap-Math.max(14,chain+12))])];
 const result=[];
 for(const workingTop of tops){
  for(const base of baseOptions){
   if(base<1||base>=maxTier)continue;
   for(const fraction of [0.22,0.30]){
    const protectedSlots=protect===null?0:1;
    const supplyCount=Math.max(protectedSlots+2,Math.min(n-5,Math.round(n*fraction)));
    const engineLen=n-supplyCount;
    const waves=engineLen>=54?3:engineLen>=25?2:1;
    const lengths=Array.from({length:waves},(_,i)=>
     Math.floor(engineLen/waves)+(i<engineLen%waves?1:0));
    const peaks=lengths.map((length,j)=>{
     const intended=base+(j===0?Math.min(33,length+Math.ceil(chain/3)):
      Math.min(25,length-1+(j===1?1:0)));
     return Math.max(1,Math.min(intended,workingTop-1,Math.max(1,cap)));
    });
    const engine=[];
    for(let stage=0;stage<waves;stage++)
     for(let k=0;k<lengths[stage];k++){
      const decrease=k-(stage===0&&k>0?1:0);
      engine.push(Math.max(1,peaks[stage]-decrease));
     }
    const supplyNeeded=supplyCount-protectedSlots;
    const high=Math.max(peaks[0],Math.min(workingTop-8,Math.max(1,cap-1),maxTier-1));
    const low=Math.min(peaks[0],high);
    const supply=[];
    for(let i=0;i<supplyNeeded;i++){
     const span=Math.max(0,high-low);
     const t=high-Math.floor(span*i/Math.max(1,supplyNeeded-1));
     supply.push(Math.max(1,Math.min(maxTier-1,t)));
    }
    // Use some of the supply as triggers for later waves too.
    for(let stage=1;stage<Math.min(peaks.length,3);stage++){
     const at=supply.length-stage;
     if(at>=0)supply[at]=Math.max(1,Math.min(maxTier-1,peaks[stage]));
    }
    supply.sort((a,b)=>b-a);
    const tiers=[...(protect!==null?[protect]:[]),...supply,...engine];
    if(tiers.length!==n||tiers.some((t,index)=>
       !Number.isInteger(t)||t<1||
       (index===0&&protect!==null?t!==protect:t>=maxTier)))continue;
    result.push({
     name:"Adaptive · "+waves+"-wave reserve engine · T"+workingTop+" / base T"+base,
     base,shape:"adaptive "+waves+"-wave reserve engine",
     board:makeBoard(positions,tiers),
     workingTier:workingTop,
     strategySections:sections(positions,supplyCount),
     adaptive:true
    });
   }
  }
 }
 return result;
}
/**
 * Generate several distinct *strategies* for the player's unlocked slots,
 * prepared ceiling and actual Wind cap. Historical scores do not transfer.
 * The caller must simulate and replay-validate all returned candidates.
 */
export function buildAdaptiveComboCandidates(positions,maxTier,cap,chainLimit=25,
 selectedBase=0,protectHighest=maxTier>=64){
 const ordered=uniqSorted(Array.isArray(positions)?positions:[]);
 if(!available(ordered,maxTier,cap,chainLimit)||
    !Number.isInteger(selectedBase)||selectedBase<0||selectedBase>=maxTier)return [];
 const proposals=[
  ...scaledHistorical(ordered,maxTier,cap,chainLimit,selectedBase,protectHighest),
  ...procedural(ordered,maxTier,cap,chainLimit,selectedBase,protectHighest)
 ];
 const seen=new Set();
 return proposals.filter(proposal=>{
  const key=proposal.board.join(",");
  if(seen.has(key))return false;
  seen.add(key);
  return true;
 });
}
