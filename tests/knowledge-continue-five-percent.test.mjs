import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {knowledgeContinueWaveCount,knowledgeContinueButtonLabel}
 from "../src/knowledge-refill-scale.mjs";

test("Continue advances by five percent of total completed refills",()=>{
 for(const [completed,waves] of [
  [0,1],[6,1],[20,1],[100,5],[500,25],
  [510,26],[1000,50],[1050,53],[2000,100]
 ])assert.equal(knowledgeContinueWaveCount(completed),waves,
  "Completed refills: "+completed);
 assert.equal(knowledgeContinueButtonLabel(100),
  "Continue rotation +5 refills");
 assert.equal(knowledgeContinueButtonLabel(1000),
  "Continue rotation +50 refills");
 assert.equal(knowledgeContinueButtonLabel(6),
  "Continue rotation +1 refill");
});

function workerHarness(){
 const file=readFileSync(new URL("../src/knowledge-cycle-worker.mjs",import.meta.url),"utf8");
 const source=file.replace(/^import .*;\s*$/gm,"");
 const posted=[],calls=[];
 const self={postMessage(message){posted.push(message);}};
 const continueKnowledgeRotation=(save,snapshot,waves)=>{
  calls.push({from:snapshot.roundsCompleted,waves});
  return {available:true,rotation:{
   valid:true,rounds:waves,completed:false,protectedIndices:[99],
   finalBoard:snapshot.finalBoard.slice(),frames:[
    {kind:"start"},{kind:"refill"},{kind:"cook"},{kind:"partial"}
   ]
  }};
 };
 runInNewContext(source,{
  self,optimizeKnowledgeRotation:()=>({available:true}),
  continueKnowledgeRotation
 },{timeout:1000});
 return {self,posted,calls};
}
function request(total,refills){
 const harness=workerHarness();
 harness.self.onmessage({data:{
  save:{},waves:refills,
  continuation:{mode:"balanced",completed:false,
   roundsCompleted:total,finalBoard:Array(120).fill(0),
   protectedIndices:[99]}
 }});
 return harness;
}
test("A +5-refill click is one worker batch",()=>{
 const h=request(100,knowledgeContinueWaveCount(100));
 assert.deepEqual(h.calls,[{from:100,waves:5}]);
 assert.equal(h.posted.filter(item=>item.progress).length,1);
 assert.equal(h.posted.at(-1).result.completedWaves,5);
});
test("The recording's 510-refill case advances by 26 waves in one click",()=>{
 const h=request(510,knowledgeContinueWaveCount(510));
 assert.deepEqual(h.calls.map(call=>call.waves),[6,6,6,6,2]);
 assert.equal(h.posted.at(-1).result.completedWaves,26);
 assert.equal(h.posted.at(-2).totalRefills,536);
});

test("A +50-refill click runs nine safe batches without overshooting",()=>{
 const h=request(1000,knowledgeContinueWaveCount(1000));
 assert.deepEqual(h.calls.map(call=>call.waves),
  [6,6,6,6,6,6,6,6,2]);
 assert.equal(h.calls.at(-1).from,1048);
 assert.equal(h.posted.filter(message=>message.progress).length,9);
 const result=h.posted.at(-1);
 assert.equal(result.ok,true);
 assert.equal(result.result.completedWaves,50);
 assert.equal(result.result.requestedWaves,50);
 assert.equal(result.result.rotations.length,9);
 assert.equal(h.posted.at(-2).totalRefills,1050);
});
test("A full rotation stops batching as soon as a new T64 is created",()=>{
 const source=readFileSync(new URL("../src/knowledge-cycle-worker.mjs",import.meta.url),"utf8")
  .replace(/^import .*;\s*$/gm,"");
 const posted=[],self={postMessage(msg){posted.push(msg);}};
 let calls=0;
 runInNewContext(source,{self,optimizeKnowledgeRotation:()=>({available:true}),
  continueKnowledgeRotation(_save,snapshot,waves){
   calls++;
   return {available:true,rotation:{
    valid:true,rounds:waves,completed:calls===2,
    finalBoard:snapshot.finalBoard.slice(),
    protectedIndices:[99],frames:[{kind:"start"},{kind:"merge"}]
   }};
  }
 });
 self.onmessage({data:{save:{},waves:50,
  continuation:{mode:"balanced",completed:false,roundsCompleted:1000,
   finalBoard:Array(120).fill(0),protectedIndices:[99]}}});
 assert.equal(calls,2);
 assert.equal(posted.at(-1).result.completed,true);
 assert.equal(posted.at(-1).result.completedWaves,12);
});
