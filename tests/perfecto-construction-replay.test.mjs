import test from "node:test";
import assert from "node:assert/strict";
import {certifiedWindTierRecipe} from "../src/perfecto-wind-certificate.mjs";
import {simulateMerge,simulateRelocation} from "../src/optimizer-core.mjs";
import {createPerfectoConstructionReplay} from "../src/perfecto-construction-replay.mjs";

function setup(source,target,windCap=58){
 const recipe=certifiedWindTierRecipe(source,target,windCap);
 const save={slots:Array.from({length:120},(_,i)=>i<100?0:-1),
  tiles:Array(120).fill(-1)};
 save.tiles[0]=63;
 const existing=target===64?1:0;
 const finalCopies=99-(recipe.workspaceSlots-1);
 const search={windCap,targetCount:existing+finalCopies,
  certificate:{...recipe,startingTier:source,targetTier:target,
   finalCopies,cooksPerCopyExact:recipe.cooksExact}};
 return {save,search,finalCopies};
}

test("Perfecto replay executes legal physical sushi merges, Wind events and moves",()=>{
 const {save,search}=setup(46,62,58);
 const replay=createPerfectoConstructionReplay(save,search,62);
 assert.equal(replay.available,true,replay.reason);
 assert.equal(replay.partial,false);
 assert.ok(replay.steps.length>1000);
 assert.ok(replay.lastMergesIndex>0);
 assert.equal(replay.initial[0],64);
 assert.equal(replay.final[0],64);
 assert.equal(Array.from(replay.final).filter(t=>t===62).length,search.targetCount);
 assert.ok(replay.steps.some(x=>x.events.some(e=>e.kind==="wind")));
 assert.ok(replay.steps.some(x=>x.kind==="move"));
 let previous=Array.from(replay.initial);
 for(const step of replay.steps){
  const expected=step.kind==="merge"?
   simulateMerge(previous,step.src,step.dst,58,25,64):
   step.kind==="move"?
   simulateRelocation(previous,step.src,step.dst,save.slots,64):null;
  if(expected){
   assert.deepEqual(Array.from(step.board),expected.board);
   assert.deepEqual(step.events,expected.events);
  }else{
   assert.equal(previous[step.at],0);
   assert.equal(step.board[step.at],46);
  }
  previous=Array.from(step.board);
 }
 assert.deepEqual(previous,Array.from(replay.final));
});

test("Oversized recipes replay the final stage with previously prepared ingredients",()=>{
 const {save,search}=setup(45,62,58);
 const replay=createPerfectoConstructionReplay(save,search,62);
 assert.equal(replay.available,true,replay.reason);
 assert.equal(replay.partial,true);
 assert.ok(replay.skippedStages>0);
 assert.ok(replay.sourceTier>45);
 assert.ok(replay.steps.some(s=>s.kind==="prepared"));
 assert.equal(Array.from(replay.final).filter(t=>t===62).length,search.targetCount);
});

test("No invented replay for missing certificate or insufficient workspace",()=>{
 const {save,search}=setup(46,62,58);
 assert.equal(createPerfectoConstructionReplay(save,{},62).available,false);
 const crowded={...save,slots:save.slots.map((slot,i)=>i===12?-1:slot)};
 // If the only valid workspace is blocked, a certified Wind recipe is not replayed.
 const isolated={...crowded,slots:save.slots.map((slot,i)=>i<100?(i%3===0?-1:0):-1)};
 assert.equal(createPerfectoConstructionReplay(isolated,search,62).available,false);
});

