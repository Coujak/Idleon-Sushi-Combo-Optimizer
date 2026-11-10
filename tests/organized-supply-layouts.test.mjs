import test from "node:test";
import assert from "node:assert/strict";
import {buildLayeredCandidates} from "../src/layered-preparation.mjs";
import {buildTuned100Candidates} from "../src/tuned-preparation.mjs";
import {buildExperimental2Candidates} from "../src/experimental2-preparation.mjs";
import {buildExperimental3Candidates} from "../src/experimental3-preparation.mjs";
import {buildExperimental4Candidates} from "../src/experimental4-preparation.mjs";
import {buildExperimental5Candidates} from "../src/experimental5-preparation.mjs";
import {buildExperimental6Candidates} from "../src/experimental6-preparation.mjs";
import {buildExperimental7Candidates} from "../src/experimental7-preparation.mjs";
import {buildExperimental8Candidates} from "../src/experimental8-preparation.mjs";
import {buildExperimental9Candidates} from "../src/experimental9-preparation.mjs";
import {buildExperimental10Candidates} from "../src/experimental10-preparation.mjs";
import {buildExperimental11Candidates} from "../src/experimental11-preparation.mjs";
import {buildExperimental12Candidates} from "../src/experimental12-preparation.mjs";
import {buildExperimental13Candidates} from "../src/experimental13-preparation.mjs";
const layouts=[
 {exp:2,end:30,build:buildExperimental2Candidates},
 {exp:3,end:30,build:buildExperimental3Candidates},
 {exp:4,end:30,build:buildExperimental4Candidates},
 {exp:5,end:30,build:buildExperimental5Candidates},
 {exp:6,end:33,build:buildExperimental6Candidates},
 {exp:7,end:31,build:buildExperimental7Candidates},
 {exp:8,end:31,build:buildExperimental8Candidates},
 {exp:9,end:29,build:buildExperimental9Candidates},
 {exp:10,end:26,build:buildExperimental10Candidates},
 {exp:11,end:24,build:buildExperimental11Candidates},
 {exp:12,end:24,build:buildExperimental12Candidates},
 {exp:13,end:24,build:buildExperimental13Candidates},
];
for(const offset of [0,20]){
 test("Exp 2–13 have descending supply and fixed Wind anchor at offset "+offset,()=>{
  const positions=Array.from({length:100},(_,i)=>i+offset);
  for(const {exp,end,build} of layouts){
   const candidates=build(positions,64,58,25,true);
   assert.equal(candidates.length,1,"Exp "+exp+" count");
   const board=candidates[0].board.slice(offset,offset+100);
   assert.equal(board.length,100);
   assert.equal(board[0],64);
   const supply=board.slice(1,end);
   assert.ok(supply.every((t,i)=>i===0||t<=supply[i-1]),"Exp "+exp+" supply unsorted");
   assert.ok(board[end]>0,"Exp "+exp+" anchor missing");
  }
 });
}
test("Exp 1 tuned and layered layouts are already descending",()=>{
 const positions=Array.from({length:100},(_,i)=>i);
 const candidates=[buildLayeredCandidates(positions,64,58,25,true),
                   buildTuned100Candidates(positions,64,58,25,true)];
 for(const group of candidates){
  assert.ok(group.length>0);
  const board=group[0].board;
  assert.equal(board[0],64);
  const supply=board.slice(1,27);
  assert.ok(supply.every((t,i)=>i===0||t<=supply[i-1]));
 }
});
