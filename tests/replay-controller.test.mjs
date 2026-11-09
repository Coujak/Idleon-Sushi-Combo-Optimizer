import test from "node:test";
import assert from "node:assert/strict";
import {createReplayController} from "../src/replay-controller.mjs";

function makePlayer(totalSteps){
  const steps=[],playStates=[],timers=new Map(),delays=[];
  let id=0;
  const controller=createReplayController({
    totalSteps,
    onStep:step=>steps.push(step),
    onPlayStateChange:state=>playStates.push(state),
    getDelay:step=>900+step*100,
    schedule:(fn,delay)=>{
      const token=++id;
      timers.set(token,fn);
      delays.push(delay);
      return token;
    },
    cancel:token=>timers.delete(token)
  });
  return {controller,steps,playStates,timers,delays,
    tick(){
      assert.equal(timers.size,1,"exactly one timer should be scheduled");
      const [token,fn]=timers.entries().next().value;
      timers.delete(token);
      fn();
    }};
}
test("Play starts from Step 0, advances, and stops at the final step",()=>{
  const p=makePlayer(3);
  assert.equal(p.controller.step,0);
  p.controller.play();
  assert.equal(p.controller.step,1);
  assert.equal(p.controller.playing,true);
  assert.equal(p.timers.size,1);
  p.tick();
  assert.equal(p.controller.step,2);
  p.tick();
  assert.equal(p.controller.step,3);
  assert.equal(p.controller.playing,false);
  assert.equal(p.timers.size,0);
  assert.deepEqual(p.steps,[1,2,3]);
});
test("Pause, resume, previous, next, first and last steps do not leak timers",()=>{
  const p=makePlayer(5);
  p.controller.play();
  p.controller.pause();
  assert.equal(p.timers.size,0);
  p.controller.play();
  assert.equal(p.controller.step,1);
  p.tick();
  assert.equal(p.controller.step,2);
  p.controller.goTo(1);
  assert.equal(p.controller.playing,false);
  assert.equal(p.timers.size,0);
  p.controller.goTo(0);
  p.controller.goTo(5);
  assert.equal(p.controller.step,5);
  p.controller.play();
  assert.equal(p.controller.step,1,"replay restarts from the beginning at the end");
  assert.equal(p.timers.size,1);
  p.controller.dispose();
  assert.equal(p.timers.size,0);
  p.controller.play();
  assert.equal(p.timers.size,0);
});
test("Speed changes reschedule instead of creating overlapping timers",()=>{
  const p=makePlayer(4);
  p.controller.play();
  p.controller.reschedule();
  p.controller.reschedule();
  assert.equal(p.timers.size,1);
  assert.equal(p.delays.at(-1),1000);
  p.tick();
  assert.equal(p.delays.at(-1),1100);
  p.controller.goTo(99);
  assert.equal(p.controller.step,4);
  assert.equal(p.timers.size,0);
  p.controller.goTo(-100);
  assert.equal(p.controller.step,0);
});
test("Empty replays cannot play",()=>{
  const p=makePlayer(0);
  p.controller.play();
  assert.equal(p.controller.playing,false);
  assert.equal(p.timers.size,0);
});
