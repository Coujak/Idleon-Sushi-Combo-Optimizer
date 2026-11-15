import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {installKnowledgeContinueHold} from "../src/knowledge-continue-hold.mjs";
import {knowledgeContinueButtonLabel,knowledgeContinueWaveCount}
 from "../src/knowledge-refill-scale.mjs";
import {knowledgeContinuationResumeStep}
 from "../src/knowledge-rotation-extension.mjs";

const source=readFileSync(new URL("../src/knowledge-leveling-ui.mjs",import.meta.url),"utf8");
const begin=source.indexOf(' continueButton.addEventListener("click",event=>{');
const finish=source.indexOf('\n\n $("knowledgePlanReset")',begin);
assert.ok(begin>=0&&finish>begin,"Knowledge Continue and hold handlers exist");
const handlers=source.slice(begin,finish);

function harness(mode="focused"){
 let nextId=1,time=0;
 const tasks=new Map(),workers=[];
 const schedule=(fn,ms)=>{const id=nextId++;tasks.set(id,{at:time+ms,fn});return id;};
 const cancel=id=>tasks.delete(id);
 const tick=ms=>{
  const final=time+ms;
  for(let guard=0;guard<100;guard++){
   const due=[...tasks.entries()].filter(([id,task])=>task.at<=final)
    .sort((a,b)=>a[1].at-b[1].at)[0];
   if(!due)break;
   tasks.delete(due[0]);time=due[1].at;due[1].fn();
  }
  time=final;
 };
 class Target{
  constructor(){this.events=new Map();this.disabled=false;
   this.classList={toggle(){},add(){},remove(){}};}
  addEventListener(name,fn){
   if(!this.events.has(name))this.events.set(name,new Set());
   this.events.get(name).add(fn);
  }
  removeEventListener(name,fn){this.events.get(name)?.delete(fn);}
  dispatch(name,extra={}){
   const event={button:0,pointerId:1,isPrimary:true,key:" ",
    isTrusted:false,preventDefault(){},...extra};
   for(const fn of this.events.get(name)??[])fn(event);
  }
  click(){if(!this.disabled)this.dispatch("click");}
 }
 const button=new Target(),doc=new Target(),win=new Target();
 const board=Array(120).fill(0),slots=Array(120).fill(0);
 board[99]=64;
 const previous={
  available:true,mode,completed:false,rotationTerminal:false,
  roundsCompleted:100,roundsRequested:100,
  steps:[{kind:"start"},{kind:"partial"}],
  startingBoard:board,finalBoard:board,layout:{slots},
  protectedIndices:[99],proposedFires:Array(15).fill(0),
  guaranteedCookBonus:21,windCap:58,options:{},
  targetTier:23,targetCreated:30,harvestCount:1,
  startCookTier:1,startingPattern:"uniform",recipeOffset:0,packingMode:"simple"
 };
 const context={
  continueButton:button,continueHold:null,worker:null,
  result:previous,jumpToNextRefill:false,jumpToNextHarvest:false,
  canExtendBalancedRotation:p=>!p.completed,
  knowledgeContinueWaveCount,knowledgeContinueButtonLabel,
  getSave:()=>({sushi:[[],[],[]]}),
  announceContinuation:message=>{context.message=message;},
  status:{textContent:""},cancelButton:{classList:{remove(){}}},
  build:{disabled:false},
  installKnowledgeContinueHold:(opts)=>installKnowledgeContinueHold({
   ...opts,releaseTarget:doc,blurTarget:win,schedule,cancel
  }),
  createKnowledgeWorker(){
   const worker={postMessage(payload){this.payload=payload;},terminate(){}};
   workers.push(worker);return worker;
  },
  stopSearch(){context.worker=null;context.build.disabled=false;},
  combineKnowledgeContinuation:(prior,chunk)=>{
   const steps=prior.steps.slice(0,-1).concat([
    {kind:"wave"},{kind:"refill"},{kind:"cook"},{kind:"partial"}]);
   return {...prior,steps,roundsCompleted:prior.roundsCompleted+chunk.rounds,
    roundsRequested:prior.roundsCompleted+chunk.rounds,
    targetCreated:prior.targetCreated+3,harvestCount:prior.harvestCount+1,
    highestNewTier:53};
  },
  knowledgeContinuationResumeStep,
  beginProgress(){},updateProgress(){},hideProgress(){},
  renderSummary(){},renderPassive(){},showProgress(){},
  createReplay(plan,step){
   context.result=plan;context.resumed=step;button.disabled=false;
  }
 };
 runInNewContext(handlers,context,{timeout:1000});
 const finishWorker=(index,completed=false)=>{
  const worker=workers[index];
  assert.ok(worker,"Expected worker "+index);
  worker.onmessage({data:{ok:true,result:{
   available:true,rotations:[{rounds:5}],
   completedWaves:5,completed,
   haltReason:""
  }}});
 };
 return {context,button,doc,win,tick,workers,finishWorker};
}
test("Focused long press repeats validated workers while held; release prevents third run",()=>{
 const h=harness("focused");
 h.button.dispatch("pointerdown");h.tick(320);
 assert.equal(h.workers.length,1);
 assert.equal(h.workers[0].payload.continuation.mode,"focused");
 assert.equal(h.workers[0].payload.waves,5);
 assert.equal(h.button.disabled,false,"Pointer release must remain detectable");
 h.finishWorker(0);
 h.tick(80);
 assert.equal(h.workers.length,2,"Holding starts another worker after first is committed");
 assert.equal(h.workers[1].payload.continuation.roundsCompleted,105);
 h.doc.dispatch("pointerup");
 h.button.dispatch("click",{isTrusted:true});
 h.finishWorker(1);
 h.tick(500);
 assert.equal(h.workers.length,2,"No additional worker after releasing");
 assert.equal(h.context.result.roundsCompleted,110);
 assert.equal(h.context.result.targetCreated,36);
 assert.equal(h.context.result.harvestCount,3);
});
test("A quick normal click still requests exactly one 5% increment",()=>{
 const h=harness("balanced");
 h.button.dispatch("pointerdown");h.tick(120);
 h.doc.dispatch("pointerup");
 h.button.dispatch("click",{isTrusted:true});
 assert.equal(h.workers.length,1);
 assert.equal(h.button.disabled,true);
 h.finishWorker(0);
 h.tick(500);
 assert.equal(h.workers.length,1);
 assert.equal(h.context.result.roundsCompleted,105);
});
test("Releasing during a held worker lets it finish but doesn't queue another",()=>{
 const h=harness("focused");
 h.button.dispatch("pointerdown");h.tick(320);
 assert.equal(h.workers.length,1);
 h.doc.dispatch("pointerup");
 h.finishWorker(0);
 h.tick(500);
 assert.equal(h.workers.length,1);
});
