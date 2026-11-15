import test from "node:test";
import assert from "node:assert/strict";
import {installKnowledgeContinueHold} from "../src/knowledge-continue-hold.mjs";

function harness(){
 let time=0,nextId=1,requests=0;
 const tasks=new Map();
 const schedule=(fn,delay)=>{const id=nextId++;tasks.set(id,{at:time+delay,fn});return id;};
 const cancel=id=>tasks.delete(id);
 const tick=ms=>{
  const stop=time+ms;
  for(let guard=0;guard<100;guard++){
   const due=[...tasks.entries()].filter(([_,task])=>task.at<=stop)
    .sort((a,b)=>a[1].at-b[1].at)[0];
   if(!due)break;
   tasks.delete(due[0]);time=due[1].at;due[1].fn();
  }
  time=stop;
 };
 class Target{
  constructor(){this.handlers=new Map();}
  addEventListener(name,handler){
   if(!this.handlers.has(name))this.handlers.set(name,new Set());
   this.handlers.get(name).add(handler);
  }
  removeEventListener(name,handler){this.handlers.get(name)?.delete(handler);}
  dispatch(name,options={}){
   const event={type:name,button:0,pointerId:1,isPrimary:true,
    key:" ",isTrusted:false,preventDefault(){this.prevented=true;},
    stopImmediatePropagation(){this.stopped=true;},...options};
   for(const handler of this.handlers.get(name)??[])handler(event);
   return event;
  }
 }
 const button=new Target(),doc=new Target(),win=new Target();
 button.disabled=false;
 button.click=()=>button.dispatch("click",{isTrusted:false});
 let hold=null,enabled=true,holds=[];
 const trigger=()=>button.click();
 hold=installKnowledgeContinueHold({
  button,releaseTarget:doc,blurTarget:win,schedule,cancel,
  canStart:()=>enabled&&!button.disabled,
  trigger,onHoldingChange:active=>holds.push(active),
  delayMs:320,repeatDelayMs:80
 });
 button.addEventListener("click",event=>{
  if(hold.shouldIgnoreClick(event))return;
  requests++;
 });
 return {button,doc,win,hold,tick,
  get requests(){return requests;},get holds(){return holds;},
  disable(){enabled=false;}
 };
}
test("A short click runs once and does not start a held rotation",()=>{
 const h=harness();
 h.button.dispatch("pointerdown");
 h.tick(150);
 h.doc.dispatch("pointerup");
 h.button.dispatch("click",{isTrusted:true});
 h.tick(500);
 assert.equal(h.requests,1);
 assert.equal(h.hold.holding,false);
});
test("Holding mouse runs multiple increments, releasing stops new ones",()=>{
 const h=harness();
 h.button.dispatch("pointerdown");
 h.tick(319);
 assert.equal(h.requests,0);
 h.tick(1);
 assert.equal(h.requests,1);
 assert.equal(h.hold.holding,true);
 h.hold.afterCompletion();
 h.tick(80);
 assert.equal(h.requests,2);
 h.hold.afterCompletion();
 h.doc.dispatch("pointerup");
 // Browser may dispatch a physical click after pointerup.
 h.button.dispatch("click",{isTrusted:true});
 h.tick(1000);
 assert.equal(h.requests,2,"Release must stop future automatic increments");
 assert.equal(h.hold.holding,false);
 assert.deepEqual(h.holds,[true,false]);
});
test("Releasing while a worker is running prevents the next increment",()=>{
 const h=harness();
 h.button.dispatch("pointerdown");
 h.tick(320);
 assert.equal(h.requests,1);
 h.doc.dispatch("pointerup");
 assert.equal(h.hold.afterCompletion(),false);
 h.tick(500);
 assert.equal(h.requests,1);
});
test("Pending repeat is canceled on pointer cancel, blur or tab hiding",()=>{
 for(const reason of ["pointercancel","blur","visibilitychange"]){
  const h=harness();
  h.button.dispatch("pointerdown");h.tick(320);
  h.hold.afterCompletion();
  if(reason==="pointercancel")h.doc.dispatch("pointercancel");
  else if(reason==="blur")h.win.dispatch("blur");
  else{h.doc.hidden=true;h.doc.dispatch("visibilitychange");}
  h.tick(150);
  assert.equal(h.requests,1,reason);
  h.hold.dispose();
 }
});
test("Keyboard Space hold repeats and quick Space press acts like one click",()=>{
 const h=harness();
 h.button.dispatch("keydown",{key:" "});
 h.tick(400);
 assert.equal(h.requests,1);
 h.hold.afterCompletion();h.tick(80);
 assert.equal(h.requests,2);
 h.doc.dispatch("keyup",{key:" "});
 h.tick(500);
 assert.equal(h.requests,2);
 const quick=harness();
 quick.button.dispatch("keydown",{key:" "});
 quick.tick(100);quick.doc.dispatch("keyup",{key:" "});
 assert.equal(quick.requests,1);
});
test("Holding stops when a new continuation is no longer legal",()=>{
 const h=harness();
 h.button.dispatch("pointerdown");h.tick(320);
 h.disable();
 assert.equal(h.hold.afterCompletion(),false);
 h.tick(500);
 assert.equal(h.requests,1);
});
