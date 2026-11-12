import test from "node:test";
import assert from "node:assert/strict";
import {simulateMerge,simulateRelocation} from "../src/optimizer-core.mjs";
import {searchPerfectoBoard} from "../src/perfecto-wind-search.mjs";
import {sushiDirectCookFuel} from "../src/perfecto-fuel.mjs";
import {createPerfectoInPlaceReplay} from "../src/perfecto-in-place-replay.mjs";

function fixture(source=45,protectedPosition=99){
 const slots=Array.from({length:120},(_,i)=>i<100?0:-1);
 const tiles=Array(120).fill(-1);tiles[protectedPosition]=63;
 const sushi=Array.from({length:8},()=>[]);
 sushi[2]=Array(46).fill(0);sushi[2][29]=1;
 sushi[5]=Array(64).fill(0);
 const save={slots,tiles,sushi};
 const economy={capacity:sushiDirectCookFuel(source)*1.1,
  generationPerHour:1e14,maxCookTier:source};
 const search=searchPerfectoBoard(save,62,economy,{
  certifiedOnly:true,supportMode:"staircase"
 });
 const plan={board:search.board.map((tier,index)=>({
  index,slot:slots[index],preparedTier:tier>0?tier-1:-1,
  role:tier===62?"target":tier>62?"protected":"ingredient",
  newCopy:tier===62&&tiles[index]!==61
 }))};
 return {save,search,plan};
}

test("T45 can build final T62 and restore merge-ready T58-T45 inside exactly 18 slots",()=>{
 const {save,search,plan}=fixture();
 const replay=createPerfectoInPlaceReplay(save,search,plan,62);
 assert.equal(replay.available,true,replay.reason);
 assert.equal(replay.strategy,"recycled-wind");
 assert.equal(replay.requiredSlots,18);
 assert.deepEqual(replay.supportPositions,
  Array.from({length:17},(_,i)=>i));
 assert.equal(replay.targetPosition,17);
 assert.deepEqual(Array.from(replay.getFrame(0).board.slice(0,18)),
  Array(18).fill(0));
 assert.deepEqual(Array.from(replay.getFrame(replay.totalSteps).board),
  search.board);
 assert.deepEqual(Array.from(replay.final.slice(0,18)),
  [58,57,56,55,54,53,52,51,50,49,48,47,46,45,45,45,45,62]);
 assert.ok(replay.totalCooks>=120&&replay.totalCooks<5000);
 assert.ok(replay.totalMerges>=100);
 assert.ok(replay.totalWind>=600);
 assert.ok(replay.totalSteps>replay.totalMerges);
 assert.ok(replay.windCascadeIndex>0);
 assert.ok(replay.nextMilestone(0)>0);
 assert.equal(replay.finalFillIndex<replay.totalSteps,true);
 const parked=replay.getFrame(replay.finalFillIndex).board;
 assert.ok(Array.from(parked.slice(0,17)).every(tier=>tier===0));
 assert.equal(parked[17],62);
});

test("Every recycling action is a legal cook, merge, or reposition and protects all other sushi",()=>{
 const {save,search,plan}=fixture();
 const replay=createPerfectoInPlaceReplay(save,search,plan,62);
 assert.equal(replay.available,true,replay.reason);
 let board=Array.from(replay.getFrame(0).board);
 let cooked=0,merged=0,moved=0,winds=0;
 for(let i=1;i<=replay.totalSteps;i++){
  const action=replay.getFrame(i).event;
  let next;
  if(action.kind==="cook"){
   assert.equal(board[action.at],0,"overlapping cook at action "+i);
   assert.ok(action.tier<=search.sourceTier,
    "a sushi above the direct-cooking limit was cooked at action "+i);
   next=board.slice();next[action.at]=action.tier;cooked++;
  }else if(action.kind==="merge"){
   const outcome=simulateMerge(board,action.src,action.dst,
    search.windCap,25,64);
   assert.ok(outcome,"illegal merge at action "+i);
   assert.deepEqual(action.events,outcome.events);
   next=outcome.board;merged++;
   winds+=action.events.filter(e=>e.kind==="wind").length;
  }else{
   assert.equal(action.kind,"move","invalid action "+i);
   const outcome=simulateRelocation(board,action.src,action.dst,
    save.slots,64);
   assert.ok(outcome,"illegal move at action "+i);
   next=outcome.board;moved++;
  }
  assert.deepEqual(next,Array.from(replay.getFrame(i).board),
   "action "+i+" produces an inaccurate board state");
  assert.deepEqual(next.slice(18,100),search.board.slice(18,100),
   "action "+i+" touched a completed target or protected T64");
  board=next;
 }
 assert.equal(cooked,replay.totalCooks);
 assert.equal(merged,replay.totalMerges);
 assert.equal(moved,replay.totalMoves);
 assert.equal(winds,replay.totalWind);
 assert.deepEqual(board,search.board);
});

test("A protected T64 at the beginning remains fixed while the 18-slot method shifts",()=>{
 const {save,search,plan}=fixture(45,0);
 const replay=createPerfectoInPlaceReplay(save,search,plan,62);
 assert.equal(replay.available,true,replay.reason);
 assert.equal(replay.strategy,"recycled-wind");
 assert.equal(replay.workspacePositions[0],1);
 assert.equal(replay.workspacePositions.at(-1),18);
 assert.equal(replay.getFrame(0).board[0],64);
 assert.equal(replay.getFrame(replay.totalSteps).board[0],64);
 assert.deepEqual(Array.from(replay.final),search.board);
});

test("When recycling cannot be verified for T46, use the compact legal fallback",()=>{
 const {save,search,plan}=fixture(46);
 const replay=createPerfectoInPlaceReplay(save,search,plan,62);
 assert.equal(replay.available,true,replay.reason);
 assert.notEqual(replay.strategy,"recycled-wind");
 assert.equal(replay.requiredSlots,17);
 assert.deepEqual(Array.from(replay.getFrame(replay.totalSteps).board),search.board);
});
