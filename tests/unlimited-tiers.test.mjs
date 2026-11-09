import test from "node:test";
import assert from "node:assert/strict";
import {buildCandidates} from "../src/preparation-core.mjs";
import {searchCombos} from "../src/merge-search.mjs";
import {searchStaircaseCombos,validateComboReplay} from "../src/optimizer-core.mjs";
import {searchLookaheadCombos} from "../src/lookahead-search.mjs";
import {windTierMaximum} from "../src/wind-limit.mjs";
import {getModeCandidates} from "../src/optimizer-modes.mjs";

test("Tier 80 preparation and Wind cap 74 produce a replayable result",()=>{
  const positions=Array.from({length:12},(_,i)=>i),cap=windTierMaximum(80);
  assert.equal(cap,74);
  const candidates=buildCandidates(positions,80,cap,70);
  const uniform=candidates.find(c=>c.shape==="uniform");
  assert.ok(uniform);
  const greedy=searchCombos(uniform.board,cap,25,4,11,"adjacent",80);
  assert.ok(greedy.score>0);
  assert.equal(validateComboReplay(uniform.board,greedy.moves,cap,25,positions.map(()=>0),80).score,greedy.score);
  const staircase=searchStaircaseCombos(uniform.board,cap,25,positions.map(()=>0),greedy,{maximumTier:80});
  assert.ok(staircase.score>=greedy.score);
});
test("higher tiers generate candidates without applying historical Experimental 12.0 layouts",()=>{
  const positions=Array.from({length:100},(_,i)=>i);
  for(const mode of ["default","experimental","experimental12"]){
    const candidates=getModeCandidates(positions,80,74,0,25,true,mode);
    assert.ok(candidates.length>0);
    assert.ok(candidates.some(c=>c.board[0]===80));
    assert.ok(candidates.every(c=>!c.name.includes("Experimental 12.0 ·")));
  }
});
test("lookahead can replay a high-tier Wind merge",()=>{
  const board=[101,95,95,94,93],slots=board.map(()=>0);
  const base=searchCombos(board,95,25,4,4,"adjacent",101);
  const result=searchLookaheadCombos(board,95,25,base,{maximumTier:101,maxPasses:1,maxEvaluations:20});
  assert.ok(result.score>=base.score);
  assert.equal(validateComboReplay(board,result.moves,95,25,slots,101).score,result.score);
});
