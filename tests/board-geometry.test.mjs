import test from "node:test";
import assert from "node:assert/strict";
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
  const layouts=layoutOptions(normalized.slots);
  assert.deepEqual(layouts[0].slots,normalized.slots);
  assert.ok(layouts.some(l=>l.name==="Left-packed"&&l.slots[0]>=0&&l.slots[119]<0));
  assert.ok(layouts.some(l=>l.name==="Centered"&&l.slots[10]>=0&&l.slots[109]>=0));
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
