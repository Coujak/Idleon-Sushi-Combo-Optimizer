import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {searchPerfectoBoard} from "../src/perfecto-wind-search.mjs";
import {sushiDirectCookFuel} from "../src/perfecto-fuel.mjs";
import {createPerfectoInPlaceReplay,validatePerfectoReplayCooking} from "../src/perfecto-in-place-replay.mjs";

function fixture(source=45){
 const sushi=Array.from({length:8},()=>[]);
 sushi[2]=Array(46).fill(0);sushi[2][29]=1;
 sushi[5]=Array(64).fill(0);
 const slots=Array.from({length:120},(_,i)=>i<100?0:-1);
 const tiles=Array(120).fill(-1);tiles[99]=63;
 const save={sushi,slots,tiles};
 const economy={capacity:sushiDirectCookFuel(source)*1.1,
  generationPerHour:1e14,maxCookTier:source};
 const search=searchPerfectoBoard(save,62,economy,
  {certifiedOnly:true,supportMode:"staircase"});
 const plan={unlocked:100,board:search.board.map((tier,index)=>({
  index,slot:slots[index],tile:tiles[index],
  preparedTier:tier>0?tier-1:-1,
  role:tier===62?"target":tier>62?"protected":tier>0?"ingredient":"empty",
  newCopy:tier===62&&tiles[index]!==61
 }))};
 return {save,search,plan};
}

test("T45 final T62 construction empties exactly the 17 marked supports and position 18",()=>{
 const {save,search,plan}=fixture(45);
 const replay=createPerfectoInPlaceReplay(save,search,plan,62);
 assert.equal(replay.available,true,replay.reason);
 assert.equal(replay.mode,"in-place");
 assert.deepEqual(replay.supportPositions,Array.from({length:17},(_,i)=>i));
 assert.equal(replay.targetPosition,17);
 assert.equal(replay.requiredSlots,18);
 assert.equal(replay.strategy,"recycled-wind");
 assert.equal(replay.recyclingFits,true);
 assert.equal(replay.recyclingNeeds,18);
 assert.ok(replay.totalCooks>=120);
 assert.ok(replay.totalWind>600);
 assert.ok(replay.totalSteps>1000);
 const afterTarget=replay.getFrame(replay.finalFillIndex).board;
 assert.equal(afterTarget[17],62);
 assert.ok(Array.from(afterTarget.slice(0,17)).every(tier=>tier===0),
  "T62 must be parked before the final supporting staircase is rebuilt");
 assert.equal(replay.originalTargetCopies,82);
 const start=Array.from(replay.getFrame(0).board);
 const end=Array.from(replay.getFrame(replay.totalSteps).board);
 assert.ok(start.slice(0,18).every(x=>x===0));
 assert.deepEqual(start.slice(18,100),search.board.slice(18,100));
 assert.equal(start.filter(x=>x===62).length,81);
 assert.equal(start[99],64);
 assert.equal(start.filter(x=>x>0).length,82);
 assert.deepEqual(end.slice(0,18),[
  58,57,56,55,54,53,52,51,50,49,48,47,46,45,44,43,42,62
 ]);
 assert.deepEqual(end,search.board);
 assert.equal(end.filter(x=>x>0).length,100);
 assert.equal(end.filter(x=>x===62).length,82);
 assert.equal(replay.getFrame(1).board[17],0);
 assert.ok(replay.milestones.length>=5);
 assert.ok(Number.isInteger(replay.windCascadeIndex));
 const windActivation=replay.getFrame(replay.windCascadeIndex);
 assert.equal(windActivation.event.kind,"merge");
 assert.equal(windActivation.event.events.filter(e=>e.kind==="wind").length,15);
 assert.deepEqual(Array.from(windActivation.board.slice(18,100)),
  search.board.slice(18,100),
  "Even the biggest Wind cascade must preserve every other T62");
 const first=replay.nextMilestone(0);
 assert.ok(first>0&&first<replay.finalFillIndex);
 assert.equal(replay.getFrame(first).board[99],64);
});

test("T46 benchmark keeps its contiguous supporting sushi and neighboring last target",()=>{
 const {save,search,plan}=fixture(46);
 const replay=createPerfectoInPlaceReplay(save,search,plan,62);
 assert.equal(replay.available,true,replay.reason);
 assert.notEqual(replay.strategy,"recycled-wind");
 assert.equal(replay.requiredSlots,17);
 assert.deepEqual(replay.supportPositions,Array.from({length:16},(_,i)=>i));
 assert.equal(replay.targetPosition,16);
 const frame=replay.getFrame(0).board;
 assert.ok(Array.from(frame.slice(0,17)).every(x=>x===0));
 assert.deepEqual(Array.from(frame.slice(17,100)),search.board.slice(17,100));
 assert.deepEqual(Array.from(replay.getFrame(replay.totalSteps).board),search.board);
});

test("A shifted or protected staircase must not be silently cleared",()=>{
 const {save,search,plan}=fixture();
 const shifted={board:plan.board.map(x=>({...x}))};
 shifted.board[17].preparedTier=45;
 const noTarget=createPerfectoInPlaceReplay(save,search,shifted,62);
 assert.equal(noTarget.available,false);
 const broken={...search,certificate:{
  ...search.certificate,
  supportingSushi:search.certificate.supportingSushi.map(x=>({...x}))
 }};
 broken.certificate.supportingSushi[1].position+=2;
 assert.equal(createPerfectoInPlaceReplay(save,broken,plan,62).available,false);
});

test("The walkthrough uses the main board, not a second fictional workspace",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../src/perfecto-ui.mjs",import.meta.url),"utf8");
 for(const prefix of ["perfecto","perfectoMax"]){
  assert.equal(html.split('id="'+prefix+'ReplayWorkspacePanel"').length-1,0);
  assert.equal(html.split('id="'+prefix+'ReplayCycle"').length-1,1);
 }
 assert.ok(ui.includes("createPerfectoInPlaceReplay(saved,search,plan,target)"));
 assert.ok(ui.includes('renderBoard(result,{...plan,board:plan.board.map'));
 assert.ok(ui.includes('for(const pos of replay.supportPositions)'));
 assert.ok(ui.includes('state.replay.nextMilestone(state.step)'));
 assert.ok(ui.includes('btn("Fill").textContent="Finish board"'));
 assert.ok(!ui.includes("renderWorkspace(replay,frame,event)"));
});

test("The configured highest cookable tier is honored through every replay cook",()=>{
 for(const tier of [44,45,46]){
  const {save,search,plan}=fixture(tier);
  assert.equal(search.sourceTier,tier,
   "the account recipe should begin at the highest tier it can cook");
  assert.equal(search.cookedSourceTier,tier);
  const replay=createPerfectoInPlaceReplay(save,search,plan,62);
  if(tier===44&&!replay.available){
   // A lower cooking cap can imply more than 50,000 actions. Reject that
   // unvalidated walkthrough rather than silently cook higher-tier sushi.
   assert.match(replay.reason,/action count cannot be validated/);
   continue;
  }
  assert.equal(replay.available,true,replay.reason);
  assert.equal(replay.maxCookTier,tier);
  const actions=Array.isArray(replay.steps)?replay.steps:
   Array.from({length:replay.totalSteps},(_,i)=>replay.getFrame(i+1).event);
  assert.ok(actions.some(step=>step.kind==="cook"&&step.tier===tier),
   "a directly cooked base sushi must use the confirmed tier");
  assert.ok(actions.filter(step=>step.kind==="cook")
   .every(step=>step.tier<=tier));
  assert.equal(validatePerfectoReplayCooking(replay,tier).ok,true);
  assert.equal(validatePerfectoReplayCooking(replay,tier-1).ok,false,
   "a stale walkthrough must not display cooks above the newly selected limit");
 }
});

test("An invalid cook tier never silently authorizes higher-tier cooks",()=>{
 const {save,search,plan}=fixture(45);
 const replay=createPerfectoInPlaceReplay(save,search,plan,62);
 assert.equal(replay.available,true,replay.reason);
 for(const cap of [0,47,NaN,null])
  assert.equal(validatePerfectoReplayCooking(replay,cap).ok,false);
});


test("Manual cooking ceilings accept prepared checkpoints but never higher direct cooks",()=>{
 const checkpoint={available:true,partial:true,sourceTier:46,actualCookTier:44,
  totalSteps:2,steps:[{kind:"prepared",tier:46},{kind:"cook",tier:44}]};
 assert.equal(validatePerfectoReplayCooking(checkpoint,44).ok,true);
 assert.equal(validatePerfectoReplayCooking(checkpoint,43).ok,false);
 assert.equal(validatePerfectoReplayCooking({...checkpoint,partial:false},44).ok,false);
 assert.equal(validatePerfectoReplayCooking({...checkpoint,steps:[
  {kind:"prepared",tier:46},{kind:"cook",tier:45}]},44).ok,false);
});

test("A long verified manual-tier replay is not rejected by the former 50k ceiling",()=>{
 const streamed={available:true,sourceTier:44,actualCookTier:44,
  totalSteps:50001,getFrame:()=>({event:{kind:"cook",tier:44}})};
 assert.equal(validatePerfectoReplayCooking(streamed,44).ok,true);
});
