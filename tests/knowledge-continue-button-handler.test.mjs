import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {knowledgeContinuationResumeStep}
 from "../src/knowledge-rotation-extension.mjs";
import {knowledgeContinueWaveCount,knowledgeContinueButtonLabel}
 from "../src/knowledge-refill-scale.mjs";

const ui=readFileSync(new URL("../src/knowledge-leveling-ui.mjs",import.meta.url),"utf8");
const start=ui.indexOf(' continueButton.addEventListener("click",event=>{');
const stop=ui.indexOf('\n\n continueHold=installKnowledgeContinueHold',start);
assert.ok(start>=0&&stop>start,"Continue handler must exist");
const handlerSource=ui.slice(start,stop);
function makeHarness(refills=100){
 const board=Array(120).fill(0),slots=Array(120).fill(0);
 board[99]=64;
 const previous={
  available:true,mode:"balanced",completed:false,rotationTerminal:false,
  steps:[{kind:"start"},{kind:"cook"},{kind:"partial"}],
  finalBoard:board,layout:{slots},protectedIndices:[99],
  options:{},proposedFires:Array(15).fill(0),
  guaranteedCookBonus:21,windCap:58,startCookTier:1,
  startingPattern:"t1Climb",recipeOffset:0,packingMode:"simple",
  roundsCompleted:refills,roundsRequested:refills,targetTier:64
 };
 const button={disabled:false,textContent:knowledgeContinueButtonLabel(refills),
  addEventListener(event,callback){this.handler=callback;}};
 let inline="",resumeIndex=null,combined=0;
 const context={
  continueButton:button,continueHold:null,worker:null,jumpToNextRefill:false,
   jumpToNextHarvest:false,
  result:previous,canExtendBalancedRotation:()=>true,
  knowledgeContinueWaveCount,knowledgeContinueButtonLabel,
  getSave:()=>({sushi:[[],[],[]]}),
  announceContinuation:message=>{inline=message;},
  status:{textContent:""},cancelButton:{classList:{remove(){}}},
  build:{disabled:false},search:null,
  createKnowledgeWorker(){
   context.search={postMessage(payload){this.payload=payload;},terminate(){}};
   return context.search;
  },
  stopSearch(){context.worker=null;context.build.disabled=false;},
  combineKnowledgeContinuation(plan,chunk){
   combined++;
   return {...plan,
    steps:plan.steps.slice(0,-1).concat([
     {kind:"wave"},{kind:"merge"},{kind:"refill"},{kind:"cook"},{kind:"partial"}]),
    roundsCompleted:plan.roundsCompleted+chunk.rounds,
    roundsRequested:plan.roundsCompleted+chunk.rounds,
    highestNewTier:53
   };
  },
  beginProgress(){},updateProgress(){},hideProgress(){},
  renderSummary(){},renderPassive(){},showProgress(){},
  knowledgeContinuationResumeStep,
  createReplay(plan,step){resumeIndex=step;context.result=plan;}
 };
 runInNewContext(handlerSource,context,{timeout:1000});
 return {context,button,get inline(){return inline;},get resumeIndex(){return resumeIndex;},
  get combined(){return combined;}};
}
test("Scaled Continue adds five waves when the board has 100 completed refills",()=>{
 const h=makeHarness(100);
 h.button.handler();
 assert.equal(h.button.disabled,true);
 assert.match(h.button.textContent,/Simulating \+5 refills/);
 assert.match(h.inline,/5 refills \(5%\)/);
 assert.equal(h.context.search.payload.waves,5);
 assert.equal(h.context.search.payload.continuation.roundsCompleted,100);
 h.context.search.onmessage({data:{progress:true,completedWaves:3,
  requestedWaves:5,totalRefills:103,completed:false}});
 assert.equal(h.button.disabled,true,"Progress must not terminate worker");
 assert.match(h.inline,/3 \/ 5 refills/);
 assert.ok(h.context.worker);
 h.context.search.onmessage({data:{ok:true,result:{
  available:true,rotations:[{rounds:5}],requestedWaves:5,completedWaves:5
 }}});
 assert.equal(h.resumeIndex,3,
  "Continue must advance to new action instead of staying on old board");
 assert.equal(h.button.disabled,false);
 assert.equal(h.context.result.roundsCompleted,105);
 assert.match(h.inline,/Advanced 5 \/ 5 requested refills/);
 assert.equal(h.button.textContent,"Continue rotation +5 refills");
});
test("At 1,000 refills, one click requests 50 waves batched into one replay",()=>{
 const h=makeHarness(1000);
 h.button.handler();
 assert.equal(h.context.search.payload.waves,50);
 assert.match(h.button.textContent,/\+50 refills/);
 h.context.search.onmessage({data:{progress:true,
  completedWaves:24,requestedWaves:50,totalRefills:1024}});
 assert.match(h.inline,/24 \/ 50 refills/);
 h.context.search.onmessage({data:{ok:true,result:{
  available:true,rotations:[{rounds:6},{rounds:6},{rounds:6},
   {rounds:6},{rounds:6},{rounds:6},{rounds:6},{rounds:6},{rounds:2}],
  completedWaves:50,requestedWaves:50
 }}});
 assert.equal(h.combined,9);
 assert.equal(h.context.result.roundsCompleted,1050);
 assert.equal(h.button.textContent,"Continue rotation +53 refills",
  "The label must update to 5% of the new total");
 assert.equal(h.button.disabled,false);
});
test("Next refill jumps to the next new refill rather than first merge",()=>{
 const h=makeHarness(100);
 h.context.jumpToNextRefill=true;
 h.button.handler();
 h.context.search.onmessage({data:{ok:true,result:{
  available:true,rotations:[{rounds:5}]
 }}});
 assert.equal(h.resumeIndex,4);
});
test("A failed worker response displays an inline error and re-enables Continue",()=>{
 const h=makeHarness();
 h.button.handler();
 h.context.search.onmessage({data:{ok:false,error:"Synthetic worker error"}});
 assert.equal(h.button.disabled,false);
 assert.match(h.inline,/Synthetic worker error/);
 assert.match(h.context.status.textContent,/Synthetic worker error/);
});
test("Render failures cannot leave Continue permanently disabled",()=>{
 const h=makeHarness();
 h.context.renderSummary=()=>{throw Error("Synthetic render error");};
 h.button.handler();
 h.context.search.onmessage({data:{ok:true,result:{
  available:true,rotations:[{rounds:5}]
 }}});
 assert.equal(h.button.disabled,false);
 assert.match(h.inline,/Synthetic render error/);
});
