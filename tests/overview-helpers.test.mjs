import test from "node:test";
import assert from "node:assert/strict";
import {countOverviewPlates,overviewTierProgress,overviewTileInfo,importAgeText}
 from "../src/overview-helpers.mjs";

test("plate breakdown counts types across all 120 physical slots, not just the first row",()=>{
 const slots=Array(120).fill(-1);
 slots[0]=0;slots[1]=0;slots[34]=1;slots[84]=2;slots[115]=3;
 assert.deepEqual(countOverviewPlates(slots),[2,1,1,1]);
 assert.deepEqual(countOverviewPlates([]),[0,0,0,0]);
});
test("Overview progress distinguishes highest discovered from highest on the board",()=>{
 const rows=Array.from({length:64},(_,i)=>({
  tier:i+1,discovered:i<45||i===57,perfecto:i<30
 }));
 const p=overviewTierProgress(rows);
 assert.deepEqual(p,{
  total:64,discovered:46,perfectos:30,highestDiscovered:58,
  missingPerfectos:16,missingTiers:18
 });
 assert.equal(overviewTierProgress([]).total,0);
});
test("board inspection reports known sushi name, exact plate and Perfecto flag",()=>{
 const tiles=Array(120).fill(-1),slots=Array(120).fill(-1),perfecto=Array(64).fill(-1);
 tiles[87]=57;slots[87]=2;perfecto[57]=1;
 const found=overviewTileInfo({tiles,slots,perfecto},87);
 assert.deepEqual(found,{
  position:88,plate:"Cold",tier:58,name:"Leviathan Roll",status:"Perfecto"
 });
 perfecto[57]=0;
 assert.equal(overviewTileInfo({tiles,slots,perfecto},87).status,"Not Perfecto");
});
test("board inspection also reports empty and locked positions without inventing sushi",()=>{
 const tiles=Array(120).fill(-1),slots=Array(120).fill(-1);
 slots[0]=0;
 assert.deepEqual(overviewTileInfo({tiles,slots},0),
  {position:1,plate:"Regular",tier:null,name:null,status:"Empty"});
 assert.deepEqual(overviewTileInfo({tiles,slots},119),
  {position:120,plate:"Locked",tier:null,name:null,status:"Locked"});
 assert.equal(overviewTileInfo({tiles,slots},120),null);
});
test("import-age wording stays correct across minute, hour and day boundaries",()=>{
 const t=1700000000000;
 assert.equal(importAgeText(t,t),"Imported just now");
 assert.equal(importAgeText(t,t+60_000),"Imported 1 min ago");
 assert.equal(importAgeText(t,t+15*60_000),"Imported 15 min ago");
 assert.equal(importAgeText(t,t+120*60_000),"Imported 2 hr ago");
 assert.equal(importAgeText(t,t+24*60*60_000),"Imported 1 day ago");
 assert.equal(importAgeText(null,t),"No save imported");
});
