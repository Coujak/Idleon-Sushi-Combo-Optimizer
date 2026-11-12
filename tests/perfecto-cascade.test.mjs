import test from "node:test";
import assert from "node:assert/strict";
import {searchPerfectoBoard} from "../src/perfecto-wind-search.mjs";
import {sushiDirectCookFuel} from "../src/perfecto-fuel.mjs";
import {certifiedPerfectoSupportCascade} from "../src/perfecto-support-cascade.mjs";
import {createPerfectoFinalTargetReplay} from "../src/perfecto-full-replay.mjs";
import {simulateMerge} from "../src/optimizer-core.mjs";
import {readFileSync} from "node:fs";

function fixture(source=46,target=62,withWind=true){
 const slots=Array.from({length:120},(_,i)=>i<100?0:-1);
 const tiles=Array(120).fill(-1);tiles[99]=63;
 const sushi=Array.from({length:8},()=>[]);
 sushi[2]=Array(46).fill(0);sushi[2][29]=withWind?1:0;
 sushi[5]=Array(64).fill(0);
 const save={slots,tiles,sushi};
 const economy={capacity:sushiDirectCookFuel(source)*1.1,
  generationPerHour:1e13,maxCookTier:source};
 const search=searchPerfectoBoard(save,target,economy,
  {certifiedOnly:true,supportMode:"staircase"});
 const plan={board:search.board.map(tier=>({
  preparedTier:tier>0?tier-1:-1
 }))};
 return {save,search,plan};
}

test("Long cascade beats independent support cooks for T46→T62 and remains constructible",()=>{
 const {save,search,plan}=fixture();
 const cert=search.certificate;
 assert.equal(cert.supportingMode,"cascade");
 assert.equal(cert.supportingCascade.windChainLength,11);
 assert.ok(cert.supportingCascade.fuelSavingPercent>10);
 assert.ok(cert.supportingCascade.totalFuel<cert.supportingCascade.individualFuel);
 assert.equal(cert.supportingCascade.ingredientTiers.length,
  cert.supportingCascade.supportingCount);
 assert.equal(cert.supportingCascade.directFillerCount,3);
 assert.equal(BigInt(cert.supportingCooksExact),
  BigInt(cert.supportingCascade.cooksExact)+3n);
 assert.equal(BigInt(cert.supportingMergesExact),
  BigInt(cert.supportingCascade.mergesExact));
 assert.equal(BigInt(cert.supportingWindEventsExact),
  BigInt(cert.supportingCascade.windEventsExact));
 const replay=createPerfectoFinalTargetReplay(save,search,plan,62);
 assert.equal(replay.available,true,replay.reason);
 assert.ok(replay.windCascadeIndex>replay.finalFillIndex);
 assert.ok(replay.windCascadeIndex<replay.totalSteps);
 const before=replay.getFrame(replay.windCascadeIndex-1);
 const trigger=replay.getFrame(replay.windCascadeIndex);
 assert.equal(trigger.event.kind,"merge");
 assert.equal(trigger.event.events.filter(e=>e.kind==="wind").length,11);
 const expected=simulateMerge(Array.from(before.board),
  trigger.event.src,trigger.event.dst,search.windCap,25,64);
 assert.ok(expected);
 assert.deepEqual(Array.from(trigger.board),expected.board);
 const last=replay.getFrame(replay.totalSteps);
 assert.deepEqual(Array.from(last.board),search.board);
 assert.equal(last.board[99],64);
});

test("T45 supports a descending Wind prefix and three spare T45 cooks",()=>{
 const lower=fixture(45,62);
 assert.equal(lower.search.certificate.supportingMode,"cascade");
 assert.equal(lower.search.certificate.supportingCascade.windChainLength,12);
 assert.equal(lower.search.certificate.supportingCascade.directFillerCount,3);
 const replay=createPerfectoFinalTargetReplay(lower.save,lower.search,lower.plan,62);
 assert.equal(replay.available,true,replay.reason);
 assert.equal(replay.getFrame(replay.windCascadeIndex).event.events
  .filter(e=>e.kind==="wind").length,12);
 const plain=fixture(46,62,false);
 assert.notEqual(plain.search.certificate.supportingMode,"cascade");
 assert.equal(plain.search.certificate.supportingCascade,undefined);
 const plainReplay=createPerfectoFinalTargetReplay(plain.save,plain.search,
  plain.plan,62);
 assert.equal(plainReplay.available,true,plainReplay.reason);
 assert.equal(plainReplay.windCascadeIndex,null);
 assert.deepEqual(Array.from(plainReplay.getFrame(plainReplay.totalSteps).board),
  plain.search.board);
});

test("Cascade certification rejects unsupported geometry and Wind chain limits",()=>{
 assert.equal(certifiedPerfectoSupportCascade(46,
  Array.from({length:28},(_,i)=>58-i),58),null);
 assert.equal(certifiedPerfectoSupportCascade(46,
  Array.from({length:16},(_,i)=>58-i),0),null);
 assert.equal(certifiedPerfectoSupportCascade(46,
  [58,56,55,54,53],58),null);
 assert.equal(certifiedPerfectoSupportCascade(46,
  [58,57,56,55,54],55),null);
});

test("Both Perfecto boards offer a jump to the real Wind activation",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../src/perfecto-ui.mjs",import.meta.url),"utf8");
 for(const prefix of ["perfecto","perfectoMax"])
  assert.equal(html.split('id="'+prefix+'ReplayCascade"').length-1,1);
 assert.match(ui,/btn\("Cascade"\)\.addEventListener\("click"/);
 assert.ok(ui.includes("replay.windCascadeIndex"));
 assert.ok(ui.includes('const wind=search?.certificate?.supportingCascade'));
 assert.ok(ui.includes('createPerfectoInPlaceReplay(saved,search,plan,target)'));
});
