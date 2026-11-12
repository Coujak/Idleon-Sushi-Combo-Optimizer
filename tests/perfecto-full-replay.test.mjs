import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {searchPerfectoBoard} from "../src/perfecto-wind-search.mjs";
import {sushiDirectCookFuel} from "../src/perfecto-fuel.mjs";
import {createPerfectoFullBoardReplay} from "../src/perfecto-full-replay.mjs";

function fixture({protectedPosition=99,specials=[],lower=[91,92],existingTarget=null}={}){
 const sushi=Array.from({length:8},()=>[]);
 sushi[2]=Array(46).fill(0);
 sushi[2][29]=1; // Heat of the East Wind
 sushi[5]=Array(64).fill(0);
 const slots=Array.from({length:120},(_,i)=>i<100?0:-1);
 for(const pos of specials)slots[pos]=pos%3+1;
 const tiles=Array(120).fill(-1);
 if(protectedPosition!==null)tiles[protectedPosition]=63;
 for(const [i,pos] of lower.entries())tiles[pos]=41+i; // T42/T43 on row 7
 if(existingTarget!==null)tiles[existingTarget]=61; // already has T62
 const save={sushi,slots,tiles};
 const economy={
  capacity:sushiDirectCookFuel(46)*1.1,
  generationPerHour:1e13,
  maxCookTier:46
 };
 const search=searchPerfectoBoard(save,62,economy,{certifiedOnly:true,supportMode:"staircase"});
 const plan={board:search.board.map(tier=>({preparedTier:tier>0?tier-1:-1}))};
 return {save,search,plan};
}
function exactFinal(replay,plan){
 const final=plan.board.map(x=>Math.max(0,x.preparedTier+1));
 assert.deepEqual(Array.from(replay.final),final);
 assert.deepEqual(Array.from(replay.getFrame(replay.totalSteps).board),final);
 assert.equal(final.filter(x=>x>0).length,replay.slots.filter(slot=>slot>=0).length);
}

test("Full-board replay keeps both row-seven sushi until an explicit manual preparation checkpoint",()=>{
 const {save,search,plan}=fixture();
 const replay=createPerfectoFullBoardReplay(save,search,plan,62);
 assert.equal(replay.available,true,replay.reason);
 assert.equal(replay.requiresSetup,true);
 assert.deepEqual(replay.setupPositions.map(x=>x.position),[91,92]);
 assert.equal(replay.getFrame(0).board[91],42);
 assert.equal(replay.getFrame(0).board[92],43);
 assert.equal(replay.getFrame(1).board[91],42);
 assert.equal(replay.getFrame(1).board[92],43);
 assert.equal(replay.getFrame(1).event.kind,"setup-required");
 assert.equal(replay.getFrame(2).event.kind,"setup-confirmed");
 assert.equal(replay.getFrame(2).board[91],0);
 assert.equal(replay.getFrame(2).board[92],0);
 assert.ok(replay.windUsed);
 assert.ok(replay.totalSteps>replay.templateSteps*search.certificate.finalCopies);
 assert.ok(replay.supports>0);
 assert.ok(replay.finalFillIndex<replay.totalSteps);
 assert.ok(replay.lastMergesIndex<replay.finalFillIndex);
 exactFinal(replay,plan);
});

test("Full-board replay preserves imported target and protected sushi and physically fills special plates",()=>{
 for(const options of [
  {protectedPosition:99,specials:[0,5,17,30,55,81],lower:[]},
  {protectedPosition:0,specials:[],lower:[]},
  {protectedPosition:null,specials:[2,10,70],lower:[]},
  {protectedPosition:99,specials:[],lower:[],existingTarget:91}
 ]){
  const {save,search,plan}=fixture(options);
  const replay=createPerfectoFullBoardReplay(save,search,plan,62);
  assert.equal(replay.available,true,replay.reason);
  assert.equal(replay.requiresSetup,false);
  assert.deepEqual(Array.from(replay.getFrame(0).board),
   save.tiles.map((tile,i)=>save.slots[i]>=0?Math.max(0,tile+1):0));
  if(options.protectedPosition!==null)
   assert.equal(replay.final[options.protectedPosition],64);
  if(options.existingTarget!==undefined&&options.existingTarget!==null)
   assert.equal(replay.getFrame(0).board[options.existingTarget],62);
  const midpoint=replay.nextCopyIndex(0);
  assert.ok(midpoint>0&&midpoint<replay.totalSteps);
  assert.ok(replay.getFrame(replay.finalFillIndex).board.filter(t=>t===62).length
   ===search.targetCount);
  assert.ok(replay.getFrame(replay.finalFillIndex).board.some(t=>t===0));
  exactFinal(replay,plan);
 }
});

test("Replay rejects layouts that silently move protected sushi",()=>{
 const {save,search,plan}=fixture({lower:[]});
 const changed={board:plan.board.map(x=>({...x}))};
 changed.board[99].preparedTier=61;
 changed.board[98].preparedTier=63;
 const replay=createPerfectoFullBoardReplay(save,search,changed,62);
 assert.equal(replay.available,false);
 assert.match(replay.reason,/protected/i);
});

test("Full-board replay exposes next-copy, final merges, and final-fill navigation",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../src/perfecto-ui.mjs",import.meta.url),"utf8");
 for(const prefix of ["perfecto","perfectoMax"]){
  for(const name of ["ReplayStart","ReplayPrev","ReplayNext","ReplayNextCopy",
   "ReplayFinal","ReplayFill","ReplayDone","ReplayConfirmSetup"]){
   assert.equal(html.split('id="'+prefix+name+'"').length-1,1,
    prefix+name+" must be unique");
  }
 }
 assert.ok(ui.includes("createPerfectoFullBoardReplay(saved,search,plan,target)"));
 assert.ok(ui.includes("state.replay?.nextCopyIndex(state.step)"));
 assert.ok(ui.includes("state.replay?.finalFillIndex"));
 assert.ok(ui.includes("replay.getFrame(step)"));
 assert.ok(ui.includes('confirm.addEventListener("click"'));
 assert.ok(ui.includes("const blocked=!!(replay.requiresSetup&&!state.setupConfirmed)"));
 assert.ok(ui.includes('btn("Next").disabled=step<0||step>=replay.totalSteps||(blocked&&step>=1)'));
 assert.ok(ui.includes('btn("NextCopy").disabled=step<0||step>=replay.finalFillIndex||blocked'));
 assert.ok(ui.includes('btn("Final").disabled=step<0||step>=replay.lastMergesIndex||blocked'));
 assert.ok(ui.includes('btn("Fill").disabled=step<0||step>=replay.finalFillIndex||blocked'));
 assert.ok(ui.includes('extra.kind==="wind"'));
});

test("Directly cookable targets replay every unlocked position without relocating protected sushi",()=>{
 const slots=Array.from({length:120},(_,i)=>i<12?0:-1);
 const tiles=Array(120).fill(-1);tiles[0]=63;tiles[8]=1;
 const save={slots,tiles};
 const search={certificate:{startingTier:4,finalCopies:11,stages:[]},targetCount:11};
 const plan={board:Array.from({length:120},(_,i)=>({
  preparedTier:i>=12?-1:i===0?63:3
 }))};
 const replay=createPerfectoFullBoardReplay(save,search,plan,4);
 assert.equal(replay.available,true,replay.reason);
 assert.equal(replay.requiresSetup,true);
 assert.equal(replay.getFrame(0).board[8],2);
 assert.equal(replay.getFrame(1).board[8],2);
 assert.equal(replay.getFrame(2).board[8],0);
 assert.equal(replay.getFrame(replay.totalSteps).board[0],64);
 assert.equal(replay.getFrame(replay.totalSteps).board.slice(1,12).every(tier=>tier===4),true);
 exactFinal(replay,plan);
});
