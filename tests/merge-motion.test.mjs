import test from "node:test";
import assert from "node:assert/strict";
import {replayMotionTiming} from "../src/merge-motion.mjs";

const single={kind:"merge",events:[{kind:"merge"}]};
const wind={kind:"merge",events:[{kind:"merge"},...Array.from({length:25},()=>({kind:"wind"}))]};
const relocation={kind:"move",events:[]};

test("Each replay allows the picked sushi to land before the next move",()=>{
 for(const move of [single,wind,relocation]){
  for(const speed of [.5,.75,1,1.5,2,3]){
   const {travelMs,windMs,settleMs,delayMs}=replayMotionTiming(move,speed);
   assert.ok(travelMs>0);
   assert.ok(settleMs>0);
   assert.ok(delayMs>=travelMs+windMs+settleMs);
  }
 }
});
test("More Wind tiles increase the replay duration; higher speed shortens it",()=>{
 const slow=replayMotionTiming(wind,.5);
 const regular=replayMotionTiming(wind,1);
 const fast=replayMotionTiming(wind,3);
 assert.ok(slow.delayMs>regular.delayMs);
 assert.ok(regular.delayMs>fast.delayMs);
 assert.ok(regular.delayMs>replayMotionTiming(single,1).delayMs);
 assert.equal(replayMotionTiming(relocation,1).windMs,0);
});
test("Reduced motion bypasses travel and Wind animation without losing steps",()=>{
 const reduced=replayMotionTiming(wind,2,{reducedMotion:true});
 assert.equal(reduced.travelMs,0);
 assert.equal(reduced.windMs,0);
 assert.equal(reduced.windStaggerMs,0);
 assert.ok(reduced.delayMs>=300);
});
test("Invalid speed uses the safe default",()=>{
 assert.deepEqual(replayMotionTiming(wind,0),replayMotionTiming(wind,1));
 assert.deepEqual(replayMotionTiming(wind,Number.NaN),replayMotionTiming(wind,1));
});
