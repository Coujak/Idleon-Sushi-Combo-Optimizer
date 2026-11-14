import test from "node:test";
import assert from "node:assert/strict";
import {simulateContinuousKnowledgeRotation} from "../src/knowledge-continuous-rotation.mjs";
import {simulateMerge,simulateRelocation} from "../src/optimizer-core.mjs";
import {optimizeKnowledgeRotation} from "../src/knowledge-rotation-optimizer.mjs";
import {readFileSync} from "node:fs";

const blank=()=>Array(120).fill(0);
const setup=(size=15)=>{
 const slots=Array(120).fill(-1);
 for(let i=0;i<size;i++)slots[i]=0;
 return slots;
};
const simulate=(startingBoard,slots,options={})=>
 simulateContinuousKnowledgeRotation({
  startingBoard,slots,mode:"balanced",targetTier:10,
  requestedTier:3,guaranteedBonus:0,windCap:0,chain:0,
  expAt:()=>1,cookCost:()=>1,rounds:4,pattern:"paired",
  ...options
 });
function verifyFrames(plan,slots,cap=0,chain=0){
 assert.equal(plan.valid,true,plan.reason);
 assert.deepEqual(plan.frames[0].board,plan.initialBoard);
 for(let i=1;i<plan.frames.length;i++){
  const before=plan.frames[i-1].board,f=plan.frames[i];
  assert.equal(f.board.length,120);
  if(f.kind==="cook"){
   assert.ok(Number.isInteger(f.at));
   assert.equal(before[f.at],0,"A cook cannot overwrite Sushi");
   assert.ok(f.board[f.at]>0);
   assert.equal(f.board.filter(x=>x>0).length,before.filter(x=>x>0).length+1);
   for(let j=0;j<120;j++)if(j!==f.at)assert.equal(f.board[j],before[j]);
  }else if(f.kind==="move"){
   const legal=simulateRelocation(before,f.src,f.dst,slots,64);
   assert.ok(legal,"Movement must be into an unlocked empty slot");
   assert.deepEqual(f.board,legal.board);
  }else if(f.kind==="merge"){
   const legal=simulateMerge(before,f.src,f.dst,cap,chain,64);
   assert.ok(legal,"Merges must be equal tier matches");
   assert.deepEqual(f.board,legal.board);
  }else{
   assert.deepEqual(f.board,before,"No Sushi may vanish between waves");
  }
 }
 assert.deepEqual(plan.finalBoard,plan.frames.at(-1).board);
 const total=plan.frames.reduce((n,x)=>n+x.exp,0);
 assert.equal(plan.totalExp,total);
 assert.equal(plan.cooks,plan.frames.filter(f=>f.kind==="cook").length);
 assert.equal(plan.merges,plan.frames.filter(f=>f.kind==="merge").length);
 assert.equal(plan.moves,plan.frames.filter(f=>f.kind==="move").length);
}

test("Balanced retains imported Sushi and moves stragglers to the top before refill",()=>{
 const board=blank(),slots=setup(15);
 board[13]=9;board[14]=10;
 const plan=simulate(board,slots,{requestedTier:3,rounds:3});
 assert.deepEqual(plan.initialBoard,board);
 assert.ok(plan.frames.some(x=>x.kind==="move"),"Expected legal top parking");
 const firstMove=plan.frames.find(f=>f.kind==="move");
 assert.ok(firstMove.dst<firstMove.src);
 assert.ok(plan.frames.some(x=>x.kind==="refill"));
 assert.ok(plan.cooks>0&&plan.merges>0);
 verifyFrames(plan,slots);
});

test("Balanced can consolidate T63 Sushi into one T64 and then restart",()=>{
 const board=blank(),slots=setup(15);
 board[0]=64;
 const plan=simulate(board,slots,{
  requestedTier:63,mode:"balanced",pattern:"uniform",rounds:3
 });
 assert.equal(plan.completed,true);
 assert.equal(plan.repeatable,true);
 assert.equal(plan.finalBoard.filter(t=>t>0).length,1);
 assert.equal(plan.finalBoard.filter(t=>t===64).length,1);
 assert.ok(plan.frames.some(x=>x.kind==="merge"&&
  x.events.some(ev=>ev.tier===64)));
 assert.equal(plan.frames.at(-1).kind,"repeat");
 verifyFrames(plan,slots);
});

test("Focused banks target-tier copies and merges them only to make room",()=>{
 const board=blank(),slots=setup(18);
 board[0]=64;
 const plan=simulate(board,slots,{
  mode:"focused",targetTier:5,requestedTier:5,pattern:"uniform",rounds:4
 });
 assert.equal(plan.completed,false);
 assert.ok(plan.rounds>=2);
 assert.ok(plan.gains[5]>0);
 assert.ok(plan.frames.some(f=>f.kind==="refill"));
 assert.ok(plan.frames.some(f=>f.kind==="merge"&&f.events[0].tier===6),
  "Targets should be merged when the board fills");
 assert.ok(plan.focusCopies>=0);
 verifyFrames(plan,slots);
});

test("No locked cell can be filled or affected by a merge",()=>{
 const board=blank(),slots=setup(8);
 board[6]=4;board[7]=4;
 const plan=simulate(board,slots,{rounds:4,windCap:58,chain:25,requestedTier:4});
 verifyFrames(plan,slots,58,25);
 assert.ok(plan.frames.every(f=>f.board.slice(8).every(x=>x===0)));
});
test("Knowledge worker uses the continuous account-based optimizer and UI exposes refill navigation",()=>{
 const worker=readFileSync(new URL("../src/knowledge-cycle-worker.mjs",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../src/knowledge-leveling-ui.mjs",import.meta.url),"utf8");
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 assert.match(worker,/optimizeKnowledgeRotation\(save,options\)/);
 assert.match(ui,/knowledgePlanNextRefill/);
 assert.match(ui,/targetCreated/);
 assert.match(ui,/peakTargetCopies/);
 assert.match(ui,/knowledgePlanNextHarvest/);
 assert.match(ui,/previewExpPerHour/);
 assert.match(html,/id="knowledgePlanRounds"/);
 assert.match(html,/id="knowledgePlanNextRefill"/);
 assert.match(html,/id="knowledgePlanNextHarvest"/);
 assert.match(html,/id="knowledgePlanFocusProgress"/);
 assert.match(ui,/new Worker\(new URL\(/);
 assert.equal(typeof optimizeKnowledgeRotation,"function");
});
