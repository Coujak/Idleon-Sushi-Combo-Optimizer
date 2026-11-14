import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {knowledgeContinuationResumeStep}
 from "../src/knowledge-rotation-extension.mjs";

const ui=readFileSync(new URL("../src/knowledge-leveling-ui.mjs",import.meta.url),"utf8");
const start=ui.indexOf(' continueButton.addEventListener("click",()=>{');
const stop=ui.indexOf('\n\n $("knowledgePlanReset")',start);
assert.ok(start>=0&&stop>start,"Continue handler must exist");
const handlerSource=ui.slice(start,stop);
function makeHarness(){
 const board=Array(120).fill(0),slots=Array(120).fill(0);
 board[99]=64;
 const previous={
  available:true,mode:"balanced",completed:false,rotationTerminal:false,
  steps:[{kind:"start"},{kind:"cook"},{kind:"partial"}],
  finalBoard:board,layout:{slots},protectedIndices:[99],
  options:{},proposedFires:Array(15).fill(0),
  guaranteedCookBonus:21,windCap:58,startCookTier:1,
  startingPattern:"t1Climb",recipeOffset:0,packingMode:"simple",
  roundsCompleted:64,roundsRequested:64,targetTier:64
 };
 const extended={...previous,
  steps:[{kind:"start"},{kind:"cook"},{kind:"wave"},
   {kind:"merge"},{kind:"refill"},{kind:"cook"},{kind:"partial"}],
  roundsCompleted:70,roundsRequested:70,highestNewTier:53
 };
 const button={disabled:false,textContent:"Continue rotation +6 refills",
  addEventListener(event,callback){this.handler=callback;}};
 let inline="",resumeIndex=null;
 const context={
  continueButton:button,worker:null,jumpToNextRefill:false,
  result:previous,canExtendBalancedRotation:()=>true,
  getSave:()=>({sushi:[[],[],[]]}),
  announceContinuation:message=>{inline=message;},
  status:{textContent:""},cancelButton:{classList:{remove(){}}},
  build:{disabled:false},search:null,
  createKnowledgeWorker(){
   context.search={postMessage(payload){this.payload=payload;},terminate(){}};
   return context.search;
  },
  stopSearch(){context.worker=null;context.build.disabled=false;},
  combineKnowledgeContinuation:()=>extended,
  renderSummary(){},renderDesignedBoard(){},renderPassive(){},showProgress(){},
  knowledgeContinuationResumeStep,
  createReplay(plan,step){resumeIndex=step;context.result=plan;}
 };
 runInNewContext(handlerSource,context,{timeout:1000});
 return {context,button,get inline(){return inline;},get resumeIndex(){return resumeIndex;}};
}

test("Direct Continue visibly simulates and opens first NEW action even from old Step 0",()=>{
 const h=makeHarness();
 h.button.handler();
 assert.equal(h.button.disabled,true);
 assert.match(h.button.textContent,/Simulating/);
 assert.match(h.inline,/Simulating from/);
 assert.equal(h.context.search.payload.waves,6);
 assert.equal(h.context.search.payload.continuation.roundsCompleted,64);
 h.context.search.onmessage({data:{ok:true,result:{available:true,rotation:{}}}});
 assert.equal(h.resumeIndex,3,
  "Continue must advance into the first new merge instead of staying on an old step");
 assert.equal(h.button.disabled,false);
 assert.match(h.inline,/Extended to refill 70/);
 assert.match(h.inline,/T53/);
});
test("Next refill jumps into NEW refill, not first merge",()=>{
 const h=makeHarness();
 h.context.jumpToNextRefill=true;
 h.button.handler();
 h.context.search.onmessage({data:{ok:true,result:{available:true,rotation:{}}}});
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
 h.context.search.onmessage({data:{ok:true,result:{available:true,rotation:{}}}});
 assert.equal(h.button.disabled,false);
 assert.match(h.inline,/Synthetic render error/);
});
