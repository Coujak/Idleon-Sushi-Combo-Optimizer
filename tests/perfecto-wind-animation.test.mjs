import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {simulateMerge} from "../src/optimizer-core.mjs";
import {perfectoWindAnimationFrames} from "../src/perfecto-wind-animation.mjs";

test("A merge with three Wind upgrades animates automatically in ONE replay action",()=>{
 const before=[45,45,44,43,42,0];
 const result=simulateMerge(before,0,1,58,25,64);
 assert.ok(result);
 assert.equal(result.events.filter(e=>e.kind==="wind").length,3);
 const action={kind:"merge",src:0,dst:1,events:result.events,
  board:Uint8Array.from(result.board)};
 const frames=perfectoWindAnimationFrames(before,action);
 assert.equal(frames.length,4);
 assert.deepEqual(Array.from(frames[0].board),[0,46,44,43,42,0]);
 assert.deepEqual(Array.from(frames[1].board),[0,46,45,43,42,0]);
 assert.deepEqual(Array.from(frames[2].board),[0,46,45,44,42,0]);
 assert.deepEqual(Array.from(frames[3].board),result.board);
 assert.deepEqual(frames.map(f=>f.windIndex),[0,1,2,3]);
 assert.ok(frames.every(f=>f.windTotal===3));
 assert.deepEqual(frames.map(f=>f.phase),["merge","wind","wind","wind"]);
});

test("Full 15-sushi East Wind chain has 16 visual frames, not 16 new steps",()=>{
 const before=Array.from({length:120},()=>0);
 before[0]=58;before[1]=58;
 for(let i=0;i<15;i++)before[2+i]=57-i;
 before[17]=62;before[18]=62;before[99]=64;
 const result=simulateMerge(before,0,1,58,25,64);
 assert.equal(result.events.filter(x=>x.kind==="wind").length,15);
 const frames=perfectoWindAnimationFrames(before,{
  kind:"merge",src:0,dst:1,board:Uint8Array.from(result.board),
  events:result.events
 });
 assert.equal(frames.length,16);
 assert.deepEqual(Array.from(frames.at(-1).board),result.board);
 for(const frame of frames){
  assert.equal(frame.board[17],62);
  assert.equal(frame.board[18],62);
  assert.equal(frame.board[99],64);
 }
 for(let n=1;n<frames.length;n++){
  const prev=frames[n-1].board,next=frames[n].board;
  assert.equal(Array.from(next).filter((tier,i)=>tier!==prev[i]).length,1,
   "each automatic animation frame only upgrades one additional sushi");
 }
});

test("Do not invent automatic cascades for ordinary merges or invalid events",()=>{
 const before=[45,45,44,43];
 const normal=simulateMerge(before,1,0,58,25,64);
 assert.deepEqual(perfectoWindAnimationFrames(before,{
  kind:"merge",src:1,dst:0,events:normal.events,board:normal.board
 }),[]);
 const wind=simulateMerge(before,0,1,58,25,64);
 const base={kind:"merge",src:0,dst:1,events:wind.events,board:wind.board};
 assert.deepEqual(perfectoWindAnimationFrames(before,{...base,kind:"move"}),[]);
 assert.deepEqual(perfectoWindAnimationFrames(before,{
  ...base,events:[...wind.events.slice(0,1),{...wind.events[1],at:3}]
 }),[]);
 assert.deepEqual(perfectoWindAnimationFrames(before,{
  ...base,board:[0,46,44,43]
 }),[]);
 assert.deepEqual(perfectoWindAnimationFrames(before,{
  ...base,events:[wind.events[0],...Array(26).fill(wind.events[1])]
 }),[]);
});

test("Perfecto UI automatically sequences Wind frames without incrementing merge step",()=>{
 const ui=readFileSync(new URL("../src/perfecto-ui.mjs",import.meta.url),"utf8");
 const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
 assert.match(ui,/perfectoWindAnimationFrames\(previous\.board,current\.event\)/);
 assert.match(ui,/const play=\(\)=>\{/);
 assert.match(ui,/cascadeTimer=setTimeout\(play,/);
 assert.match(ui,/cascadeFrame=frames\[cursor\+\+\]/);
 assert.match(ui,/const frame=cascadeFrame&&actualFrame/);
 assert.match(ui,/cascadeToken\+\+/);
 assert.match(ui,/if\(cascadeTimer!==null\)clearTimeout\(cascadeTimer\)/);
 assert.match(ui,/btn\("Next"\)\.disabled=step<0\|\|done\|\|!!cascadeFrame/);
 assert.match(ui,/goToStep\(state\.step\+1,\{animate:true\}\)/);
 assert.match(ui,/goToStep\(state\.step-1\)/);
 assert.match(css,/perfecto-wind-impact/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});
