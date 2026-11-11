import test from "node:test";
import assert from "node:assert/strict";
import {FOUND_CONFIGURATIONS,buildFoundConfiguration} from "../src/found-configurations.mjs";
import {searchCombos} from "../src/merge-search.mjs";
import {validateComboReplay} from "../src/optimizer-core.mjs";

const positions=Array.from({length:100},(_,i)=>i);
test("Found Configurations list contains separately selectable historical boards",()=>{
 assert.equal(FOUND_CONFIGURATIONS.length,12);
 assert.deepEqual(FOUND_CONFIGURATIONS.map(x=>x.number),
  Array.from({length:12},(_,i)=>i+2));
 assert.equal(new Set(FOUND_CONFIGURATIONS.map(x=>x.id)).size,12);
});
test("Found Experiment 13 is one exact reproducible board and replay",()=>{
 const found=buildFoundConfiguration("experimental13",positions,64,58,25,true);
 assert.ok(found);
 assert.equal(found.foundExperiment,13);
 assert.equal(found.foundBenchmark,76532);
 assert.equal(found.supplyCount,24);
 assert.equal(found.engineCount,76);
 assert.equal(found.board.length,120);
 assert.equal(found.board.filter(tier=>tier>0).length,100);
 const greedy=searchCombos(found.board,58,25,4,99,"descending domino",64);
 const slots=Array.from({length:120},(_,i)=>i<100?0:-1);
 const replay=validateComboReplay(found.board,greedy.moves,58,25,slots,64);
 assert.equal(greedy.score,76532);
 assert.equal(replay.score,greedy.score);
 assert.equal(replay.merges,93);
 assert.equal(replay.repositions,0);
});
test("Found layouts are not reused at incompatible progression settings",()=>{
 assert.equal(buildFoundConfiguration("experimental13",positions,80,74,25,true),null);
 assert.equal(buildFoundConfiguration("experimental13",positions,64,57,25,true),null);
 assert.equal(buildFoundConfiguration("experimental13",positions,64,58,24,true),null);
 assert.equal(buildFoundConfiguration("experimental13",positions.slice(0,90),64,58,25,true),null);
 assert.equal(buildFoundConfiguration("experimental99",positions,64,58,25,true),null);
});
