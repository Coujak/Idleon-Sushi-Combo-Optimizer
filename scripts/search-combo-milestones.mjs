#!/usr/bin/env node
// Offline-only research: discover boards, certify a complete replay and
// write a score showcase only once its threshold has actually been reached.
// Usage: node scripts/search-combo-milestones.mjs --trials=2000 --seed=421
// No background jobs, no silent publishing, no fabricated benchmark scores.
import {existsSync,mkdirSync,readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {searchCombos} from "../src/merge-search.mjs";
import {searchLookaheadCombos} from "../src/lookahead-search.mjs";
import {buildExperimental13Candidates,EXPERIMENTAL_13_BENCHMARK} from "../src/experimental13-preparation.mjs";
import {certifyComboMilestone,targetForExperiment} from "../src/combo-score-milestones.mjs";

const config={maxTier:64,cap:58,chainLimit:25,positions:Array.from({length:100},(_,i)=>i)};
const template=buildExperimental13Candidates(config.positions,64,58,25,true)[0].board;

function options(){
 const parse=(key,fallback)=>{
  const token=process.argv.find(arg=>arg.startsWith("--"+key+"="));
  return token===undefined?fallback:Number(token.split("=")[1]);
 };
 const trials=parse("trials",300);
 const seed=parse("seed",421);
 if(!Number.isSafeInteger(trials)||trials<1||trials>1e7)throw Error("trials must be 1..10000000");
 if(!Number.isSafeInteger(seed)||seed<0)throw Error("seed must be a nonnegative integer");
 return {trials,seed};
}
function rng(seed){
 let state=(seed>>>0)||0x9e3779b9;
 return ()=>{
  state^=state<<13;state^=state>>>17;state^=state<<5;
  return (state>>>0)/4294967296;
 };
}
function sample(r,a,b){return a+Math.floor(r()*(b-a+1));}
function mutate(parent,r){
 const next=parent.slice();
 const type=sample(r,0,10);
 const pickSupply=()=>sample(r,1,23);
 const pickEngine=()=>sample(r,24,99);
 const clamp=n=>Math.max(1,Math.min(63,n));
 const change=(index,amount)=>{next[index]=clamp(next[index]+amount);};
 if(type<=2){change(pickSupply(),sample(r,-4,4));}
 else if(type===3){next[pickSupply()]=sample(r,25,60);}
 else if(type===4){const a=pickSupply(),b=pickSupply();[next[a],next[b]]=[next[b],next[a]];}
 else if(type===5){for(let i=0;i<3;i++)change(pickSupply(),sample(r,-3,3));}
 else if(type===6){
  const part=sample(r,0,2),start=[24,50,75][part],end=[50,75,100][part];
  const delta=sample(r,-2,2);
  for(let i=start;i<end;i++)change(i,delta);
 }else if(type===7){
  const part=sample(r,0,2),start=[24,50,75][part],end=[50,75,100][part];
  for(let i=start;i<end;i++)change(i,sample(r,-1,1));
 }else if(type===8){change(pickEngine(),sample(r,-2,2));}
 else if(type===9){
  for(let i=0;i<4;i++)change(pickSupply(),sample(r,-5,5));
 }else{
  const a=pickSupply(),b=pickEngine();
  [next[a],next[b]]=[next[b],next[a]];
 }
 next[0]=64;
 return next;
}
function evaluate(board,deep=false){
 const result=searchCombos(board,58,25,4,99,"descending domino",64);
 return deep?searchLookaheadCombos(board,58,25,result,{
  maximumTier:64,maxPasses:3,maxBranches:18,maxEvaluations:3500
 }):result;
}
function run(){
 const {trials,seed}=options();
 const random=rng(seed);
 let nextExp=14,lastPublishedScore=0,found=0;
 let best={board:template,result:evaluate(template)};
 if(best.result.score!==EXPERIMENTAL_13_BENCHMARK)
  throw Error("Historical Experiment 13.0 benchmark no longer replays correctly");
 const archive=[best];
 let attempted=0;
 const outDir=resolve("research","verified-milestones");
 // Resume a prior verified series. Never overwrite or skip a milestone, and
 // never accept a cached candidate merely because its JSON says validated.
 while(true){
  const file=resolve(outDir,"experiment-"+nextExp+"-candidate.json");
  if(!existsSync(file))break;
  const archived=JSON.parse(readFileSync(file,"utf8"));
  const verified=certifyComboMilestone(archived.board,archived.moves,nextExp);
  if(verified.score<=lastPublishedScore)
   throw Error("Saved Experiment "+nextExp+" does not improve the prior score");
  lastPublishedScore=verified.score;
  nextExp++;
 }
 console.log("Exp 13.0 verified:",best.result.score,
  "| next goal: Exp "+nextExp+".0 ≥"+targetForExperiment(nextExp));
 for(let i=0;i<trials;i++){
  const ancestor=i%9===0?best:i%13===0?{board:template}:
   archive[sample(random,0,Math.min(archive.length-1,11))];
  const board=mutate(ancestor.board,random);
  const result=evaluate(board);
  attempted++;
  const entry={board,result};
  archive.push(entry);
  archive.sort((a,b)=>b.result.score-a.result.score);
  if(archive.length>28)archive.length=28;
  if(result.score>best.result.score){
   best=entry;
   console.log("New merge-only candidate:",result.score,"at trial",i+1);
  }
  // Lookahead is costly; reserve it for promising candidates that might
  // pass a milestone. Never accept a raw heuristic score as a certificate.
  if(result.score>=targetForExperiment(nextExp)-250){
   const deep=evaluate(board,true);
   const winner=deep.score>result.score?deep:result;
   if(winner.score>best.result.score)best={board,result:winner};
   if(winner.score>=targetForExperiment(nextExp)&&winner.score>lastPublishedScore){
    const verified=certifyComboMilestone(board,winner.moves,nextExp);
    mkdirSync(outDir,{recursive:true});
    const output=resolve(outDir,"experiment-"+nextExp+"-candidate.json");
    writeFileSync(output,JSON.stringify({
     experimental:true,gameConfirmed:false,seed,trial:i+1,
     verified,...verified
    },null,2)+"\n");
    console.log("CERTIFIED Exp "+nextExp+".0:",verified.score,"saved to",output);
    lastPublishedScore=verified.score;nextExp++;found++;
   }
  }
  if((i+1)%Math.min(500,trials)===0){
   console.log("Progress",i+1+"/"+trials,"best",best.result.score,
    "next",targetForExperiment(nextExp));
  }
 }
 console.log(JSON.stringify({trials:attempted,seed,startingScore:EXPERIMENTAL_13_BENCHMARK,
  bestCandidate:best.result.score,verifiedNewMilestones:found,
  nextExperiment:nextExp,nextTarget:targetForExperiment(nextExp),
  note:found===0?"No new numbered Experiment: threshold not achieved":"Review output JSON before integrating it into the website."},null,2));
}
const self=process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]);
if(self)run();
export {mutate,rng};
