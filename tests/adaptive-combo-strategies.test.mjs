import test from "node:test";
import assert from "node:assert/strict";
import {HISTORICAL_COMBO_STRATEGIES,buildAdaptiveComboCandidates}
 from "../src/adaptive-combo-strategies.mjs";
import {buildExperimental13Candidates} from "../src/experimental13-preparation.mjs";
import {searchCombos} from "../src/merge-search.mjs";
import {validateComboReplay} from "../src/optimizer-core.mjs";

const positions=(length,offset=0)=>Array.from({length},(_,i)=>i+offset);
test("All twelve historical preparations are classified, with truthful reference benchmarks",()=>{
 assert.equal(HISTORICAL_COMBO_STRATEGIES.length,12);
 assert.deepEqual(HISTORICAL_COMBO_STRATEGIES.map(x=>x.number),
  Array.from({length:12},(_,i)=>i+2));
 assert.deepEqual(HISTORICAL_COMBO_STRATEGIES.map(x=>x.boundary),
  [30,30,30,30,33,31,31,29,26,24,24,24]);
 assert.deepEqual(HISTORICAL_COMBO_STRATEGIES.map(x=>x.benchmark).slice(-3),
  [75047,75546,76532]);
 assert.ok(new Set(HISTORICAL_COMBO_STRATEGIES.map(x=>x.family)).size>=5);
});
test("Adaptive strategy carries historical layout exactly at T64/T58 only",()=>{
 const ps=positions(100);
 const candidates=buildAdaptiveComboCandidates(ps,64,58,25,0,true);
 const original=buildExperimental13Candidates(ps,64,58,25,true)[0].board;
 const from13=candidates.find(x=>x.referenceExperiment===13&&x.workingTier===64);
 assert.ok(from13,"Exp 13 structural reference must be included");
 assert.deepEqual(from13.board,original);
 assert.equal(from13.historicalBenchmark,null,"Do not assign historical score to new settings");
 assert.equal(from13.strategySections.enginePositions[0],24);
 assert.ok(candidates.some(x=>x.referenceExperiment===2));
 assert.ok(candidates.some(x=>!x.referenceExperiment));
 assert.ok(candidates.some(x=>x.workingTier<64),
  "Planner must compare lower working tiers instead of always preparing at the maximum");
 assert.equal(new Set(candidates.map(x=>x.board.join(","))).size,candidates.length);
});
test("Tier 80 and Tier 52 generate translated shapes without copying a false 76,532 claim",()=>{
 for(const top of [52,80,100]){
  const cap=top-6;
  const candidates=buildAdaptiveComboCandidates(positions(100),top,cap,25,0,true);
  assert.ok(candidates.length>=10,"No useful adaptive research layouts at tier "+top);
  assert.ok(candidates.some(x=>x.referenceExperiment!==undefined));
  assert.ok(candidates.some(x=>x.workingTier<top));
  for(const c of candidates){
   assert.equal(c.board.length,120);
   assert.equal(c.board[0],top);
   assert.equal(c.board.filter(x=>x>0).length,100);
   assert.ok(c.board.slice(1,100).every(x=>x>=1&&x<top),
    "Illegal ingredient at "+top+" "+c.name);
   assert.equal(c.historicalBenchmark??null,null);
   assert.ok(c.strategySections.enginePositions.every(pos=>Number.isInteger(pos)&&pos<100));
  }
 }
});
test("Low tiers, shorter Wind limits and smaller unlocked boards use procedural waves",()=>{
 for(const [count,top,chain] of [[12,16,5],[40,35,10],[64,45,25],[85,52,20]]){
  const ps=positions(count,20),cap=top-6;
  const candidates=buildAdaptiveComboCandidates(ps,top,cap,chain,0,false);
  assert.ok(candidates.length>0,"Expected adaptive strategies for "+count+" slots tier "+top);
  assert.ok(candidates.every(x=>!x.referenceExperiment),
   "Historic 100-slot shapes must not be copied into smaller boards");
  for(const c of candidates){
   assert.equal(c.board.filter(v=>v>0).length,count);
   assert.ok(c.board.filter(x=>x>0).every(x=>x>=1&&x<top));
   assert.ok(c.board.slice(0,20).every(x=>x===0));
   assert.ok(c.board.slice(count+20).every(x=>x===0));
  }
  const best=candidates[0];
  const greedy=searchCombos(best.board,cap,chain,4,count-1,"adjacent",top);
  const slots=Array.from({length:120},(_,i)=>ps.includes(i)?0:-1);
  assert.equal(validateComboReplay(best.board,greedy.moves,cap,chain,slots,top).score,
   greedy.score);
 }
});
test("Manual base tier and noncontiguous unlocks never fabricate invalid boards",()=>{
 const ps=positions(100);
 const selected=buildAdaptiveComboCandidates(ps,64,58,25,9,true);
 assert.ok(selected.length>0);
 assert.ok(selected.every(x=>x.base===9));
 const gapped=[0,1,3,4,5,10,20,21,22,23,35];
 assert.deepEqual(buildAdaptiveComboCandidates(gapped,42,36,25,0,false),[]);
 assert.deepEqual(buildAdaptiveComboCandidates(ps,64,60,25,0,true),[]);
 assert.deepEqual(buildAdaptiveComboCandidates(ps,64,58,26,0,true),[]);
});
test("Retain imported Tier 64 safely if the user prepares below it",()=>{
 const candidates=buildAdaptiveComboCandidates(positions(100),60,54,25,0,true);
 assert.ok(candidates.length>0);
 for(const candidate of candidates){
  assert.equal(candidate.board[0],64);
  assert.ok(candidate.board.slice(1,100).every(x=>x>0&&x<60));
 }
});
