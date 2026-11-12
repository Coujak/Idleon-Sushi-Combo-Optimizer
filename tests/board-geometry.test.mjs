import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {BOARD_CELLS,BOARD_COLUMNS,BOARD_ROWS,MAX_UNLOCKED_SLOTS,
  normalizeBoardData,layoutOptions} from "../src/board-geometry.mjs";

function mockSave(positions){
  const slots=Array(BOARD_CELLS).fill(-1);
  const tiles=Array(BOARD_CELLS).fill(-1);
  positions.forEach((p,i)=>{slots[p]=i%4;tiles[p]=i===0?63:30;});
  return {tiles,slots};
}
test("8×15 board preserves unlocked slots on rows 1 and 8",()=>{
  assert.equal(BOARD_COLUMNS,15);
  assert.equal(BOARD_ROWS,8);
  assert.equal(BOARD_CELLS,120);
  assert.equal(MAX_UNLOCKED_SLOTS,100);
  const {tiles,slots}=normalizeBoardData(...Object.values(mockSave([0,105,119])));
  assert.equal(slots.length,120);
  assert.equal(tiles.length,120);
  assert.equal(slots[0],0);
  assert.equal(slots[105],1);
  assert.equal(slots[119],2);
  assert.equal(tiles[105],30);
  assert.equal(tiles[119],30);
});
test("top row can be entirely empty while bottom rows are occupied",()=>{
  const positions=Array.from({length:100},(_,i)=>i+20);
  const save=mockSave(positions);
  const normalized=normalizeBoardData(save.tiles,save.slots);
  assert.equal(normalized.unlocked,100);
  assert.ok(normalized.slots.slice(0,20).every(t=>t<0));
  assert.ok(normalized.slots.slice(105,120).every(t=>t>=0));
  assert.equal(normalized.tiles[20],63);
  const layouts=layoutOptions(normalized.slots,{movementMittens:true});
  assert.equal(layouts.length,1);
  const arranged=layouts[0].slots;
  assert.match(layouts[0].name,/Top-down/);
  assert.ok(arranged.slice(0,100).every(type=>type>=0));
  assert.ok(arranged.slice(100).every(type=>type===-1));
  assert.deepEqual(arranged.filter(type=>type>=0).sort(),
   normalized.slots.filter(type=>type>=0).sort());
});
test("mixed top and bottom sections are kept in their exact imported positions",()=>{
  const positions=[...Array.from({length:40},(_,i)=>i),
    ...Array.from({length:60},(_,i)=>i+60)];
  const {tiles,slots}=mockSave(positions);
  const decoded=normalizeBoardData(tiles,slots);
  const current=layoutOptions(decoded.slots)[0].slots;
  assert.equal(current.filter(v=>v>=0).length,100);
  assert.ok(current.slice(40,60).every(v=>v<0));
  assert.ok(current.slice(105).every(v=>v>=0));
  assert.equal(current[119],slots[119]);
});
test("more than 100 unlocked slots is rejected rather than truncating the bottom row",()=>{
  const {tiles,slots}=mockSave(Array.from({length:101},(_,i)=>i+19));
  assert.throws(()=>normalizeBoardData(tiles,slots),/at most 100/);
  assert.throws(()=>layoutOptions(slots),/more than 100/);
});


test("Early Sushi saves without Movement Mittens cannot receive relocated plate layouts",()=>{
 const save=mockSave(Array.from({length:34},(_,i)=>i));
 const normalized=normalizeBoardData(save.tiles,save.slots);
 const without=layoutOptions(normalized.slots);
 const disabled=layoutOptions(normalized.slots,{movementMittens:false});
 assert.equal(without.length,1);
 assert.equal(disabled.length,1);
 assert.equal(without[0].name,"Current positions");
 assert.deepEqual(without[0].slots,normalized.slots);
 const unlocked=layoutOptions(normalized.slots,{movementMittens:true});
 assert.equal(unlocked.length,1,"The recommended layout always packs top-down");
 assert.match(unlocked[0].name,/Top-down/);
 const arranged=unlocked[0].slots;
 assert.equal(arranged.filter(type=>type>=0).length,34);
 assert.deepEqual(arranged.filter(x=>x>=0).sort(),
  normalized.slots.filter(x=>x>=0).sort());
 assert.deepEqual(arranged.slice(0,34),
  [...Array(9).fill(0),...Array(9).fill(1),
   ...Array(8).fill(2),...Array(8).fill(3)]);
 assert.ok(arranged.slice(34).every(type=>type===-1));
});

test("Combo Meter reads the Movement Mittens upgrade from the imported save",()=>{
 const js=readFileSync(new URL("../src/app.js",import.meta.url),"utf8");
 assert.match(js,/imported\.sushi\?\.\[2\]\?\.\[42\]/);
 assert.match(js,/layoutOptions\(slots,\{movementMittens\}\)/);
});

test("Beginner 34-slot boards group Hot, Cold and Milktoast beneath regular slots",()=>{
 const slots=Array(BOARD_CELLS).fill(-1);
 for(let i=0;i<34;i++)slots[i]=0;
 // Reproduce the screenshot's dispersed red slots, plus blue/yellow plates.
 for(const pos of [0,1,10,11,20])slots[pos]=1;
 for(const pos of [5,22])slots[pos]=2;
 for(const pos of [2,16])slots[pos]=3;
 const [layout]=layoutOptions(slots,{movementMittens:true});
 assert.match(layout.name,/grouped special plates/);
 assert.deepEqual(layout.slots.slice(0,34),[
  ...Array(25).fill(0),...Array(5).fill(1),
  ...Array(2).fill(2),...Array(2).fill(3)
 ]);
 assert.ok(layout.slots.slice(34).every(type=>type===-1));
 // The recommendation never creates, removes, or upgrades a plate.
 for(const type of [0,1,2,3]){
  assert.equal(layout.slots.filter(x=>x===type).length,
   slots.filter(x=>x===type).length);
 }
 // Without Mittens, the same save is kept exactly as imported.
 assert.deepEqual(layoutOptions(slots)[0].slots,slots);
});

test("Already top-packed grouped plates do not trigger redundant layout moves",()=>{
 const source=Array(BOARD_CELLS).fill(-1);
 for(let i=0;i<30;i++)source[i]=i<20?0:i<26?1:i<28?2:3;
 const options=layoutOptions(source,{movementMittens:true});
 assert.equal(options.length,1);
 assert.equal(options[0].name,"Current positions");
 assert.deepEqual(options[0].slots,source);
});
