import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {simulateMerge,simulateRelocation} from "../src/optimizer-core.mjs";
import {
 recycledWindWorkspace,createPerfectoRecycledTargetReplay
} from "../src/perfecto-recycled-target.mjs";

function fixture({source=45,target=62,cap=58,protectedPos=99,
 unlocked=100,specials=[]}={}){
 const slots=Array.from({length:120},(_,i)=>i<unlocked?0:-1);
 const tiles=Array(120).fill(-1);
 if(protectedPos!==null)tiles[protectedPos]=63;
 for(const i of specials)slots[i]=1;
 const save={slots,tiles};
 const plan={board:Array.from({length:120},(_,i)=>({
  preparedTier:i>=unlocked?-1:i===protectedPos?63:target-1
 }))};
 const search={sourceTier:source,windCap:cap};
 return {save,plan,search,target};
}

test("User's exact six-merge T45-to-T49 sequence is reproduced",()=>{
 const args=fixture();
 const replay=createPerfectoRecycledTargetReplay(args.save,args.search,
  args.plan,args.target);
 assert.equal(replay.available,true,replay.reason);
 const first=replay.steps.filter(s=>s.kind==="merge").slice(0,6);
 assert.deepEqual(first.map(e=>[e.src,e.dst,e.tier,
  e.events.filter(x=>x.kind==="wind").length]),[
  [0,1,46,1],[1,2,47,1],[4,5,46,1],
  [3,5,47,2],[2,5,48,3],[5,6,49,3]
 ]);
 // After the six merges, T49/T48/T47/T46 are moved to positions 1-4.
 const packed=replay.steps.findIndex((step,i)=>
  i>0&&step.kind==="move"&&step.dst===3&&step.tier===46);
 assert.ok(packed>0);
 assert.deepEqual(Array.from(replay.steps[packed].board.slice(0,4)),[49,48,47,46]);
});

test("Recycled T45-to-T62 construction repeatedly refills and legally advances to the target",()=>{
 const {save,search,plan,target}=fixture();
 const replay=createPerfectoRecycledTargetReplay(save,search,plan,target);
 assert.equal(replay.available,true,replay.reason);
 assert.ok(replay.cycles.length>=7);
 assert.deepEqual(replay.cycles.slice(0,6).map(c=>[c.from,c.to]),[
  [45,49],[49,51],[51,53],[53,55],[55,57],[57,58]
 ]);
 assert.equal(replay.requiredSlots,38);
 assert.equal(replay.final[replay.focusPosition],62);
 assert.equal(replay.final[99],64);
 assert.ok(replay.totalCooks<250,"recycling must reuse intermediate sushi");
 assert.ok(replay.totalWind>=100);
 assert.ok(replay.totalMoves>50);
 assert.ok(replay.windCascadeIndex>0);
 assert.ok(replay.nextCycle(0)>0);
 assert.equal(replay.getFrame(replay.totalSteps).event.kind,"merge");
 let board=Array.from(replay.initial),winds=0,cooks=0;
 for(const [i,action] of replay.steps.entries()){
  let next;
  if(action.kind==="cook"){
   assert.equal(board[action.at],0,"cannot cook over an existing sushi at step "+i);
   next=board.slice();next[action.at]=action.tier;cooks++;
  }else if(action.kind==="merge"){
   const outcome=simulateMerge(board,action.src,action.dst,58,25,64);
   assert.ok(outcome,"illegal merge at step "+i);
   assert.deepEqual(outcome.events,action.events);
   winds+=action.events.filter(e=>e.kind==="wind").length;
   assert.ok(action.events.filter(e=>e.kind==="wind").length<=25);
   next=outcome.board;
  }else{
   const outcome=simulateRelocation(board,action.src,action.dst,save.slots,64);
   assert.ok(outcome,"illegal move at step "+i);
   next=outcome.board;
  }
  assert.deepEqual(next,Array.from(action.board),"incorrect board snapshot at step "+i);
  assert.equal(next[99],64,"protected T64 must never move");
  board=next;
 }
 assert.equal(cooks,replay.totalCooks);
 assert.equal(winds,replay.totalWind);
 assert.deepEqual(board,Array.from(replay.final));
});

test("T46 and T45 both reach T62 and final ordinary merges respect Wind cap",()=>{
 for(const source of [45,46]){
  const options=fixture({source});
  const replay=createPerfectoRecycledTargetReplay(options.save,
   options.search,options.plan,options.target);
  assert.equal(replay.available,true,replay.reason);
  assert.equal(replay.final[replay.focusPosition],62);
  assert.ok(replay.totalCooks<500);
  assert.ok(replay.steps.some(step=>step.description.includes("above the Wind limit")));
  assert.ok(replay.cycles.filter(c=>c.to===59).length>=3);
 }
});

test("Construction supports T59, T63 and T64 without moving a protected T64",()=>{
 for(const target of [59,63,64]){
  const a=fixture({target});
  const replay=createPerfectoRecycledTargetReplay(a.save,a.search,a.plan,target);
  assert.equal(replay.available,true,replay.reason);
  assert.equal(replay.final[replay.focusPosition],target);
  assert.equal(replay.final[99],64);
  assert.ok(replay.totalSteps<3500);
 }
});

test("Recycling cannot silently overwrite locked, split or protected cells",()=>{
 const a=fixture({protectedPos:30});
 const good=createPerfectoRecycledTargetReplay(a.save,a.search,a.plan,a.target);
 assert.equal(good.available,true,good.reason);
 assert.ok(good.stagingStart>30);
 assert.equal(good.final[30],64);
 const short=fixture({unlocked:28,protectedPos:null});
 const bad=createPerfectoRecycledTargetReplay(short.save,short.search,
  short.plan,short.target);
 assert.equal(bad.available,false);
 assert.match(bad.reason,/contiguous unlocked cells/);
 assert.equal(recycledWindWorkspace(45,62,45),null);
});

test("Perfecto UI offers a true reusable Wind ladder and refill cycle navigation",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../src/perfecto-ui.mjs",import.meta.url),"utf8");
 for(const prefix of ["perfecto","perfectoMax"])
  assert.equal(html.split('id="'+prefix+'ReplayCycle"').length-1,1);
 assert.match(ui,/createPerfectoRecycledTargetReplay\(saved,search,plan,target\)/);
 assert.match(ui,/state\.replay\.nextCycle\(state\.step\)/);
 assert.ok(ui.includes('replay.mode==="recycling"'));
 assert.ok(ui.includes("This is a separate teaching board"));
});
