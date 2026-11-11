import test from "node:test";
import assert from "node:assert/strict";
import {comparePreparedBoard,scoreBreakdown,preparationGroups,
 compareResearchBest,chooseCandidatesByBudget} from "../src/combo-qol.mjs";
import {buildExperimental13Candidates} from "../src/experimental13-preparation.mjs";
import {searchCombos} from "../src/merge-search.mjs";
import {validateComboReplay} from "../src/optimizer-core.mjs";

test("Correct sushi checks require matching zero-based tier, plate and position",()=>{
 const currentTiles=[4,6,-1,-1,0];
 const currentSlots=[0,1,2,-1,0];
 const preparedBoard=[5,4,9,0,2];
 const preparedSlots=[0,1,2,-1,1];
 const comparison=comparePreparedBoard(currentTiles,currentSlots,preparedBoard,preparedSlots);
 assert.deepEqual(comparison.statuses,
  ["correct","misplaced","missing","locked","wrongSlot"]);
 assert.equal(comparison.needed,4);
 assert.equal(comparison.matching,1);
 assert.equal(comparison.counts.misplaced,1);
 assert.equal(comparison.counts.missing,1);
 assert.equal(comparison.counts.wrongSlot,1);
});
test("Preparation groups retain exact positions and quantities",()=>{
 const groups=preparationGroups([64,58,58,42],[0,1,2,3],
  {roles:["supply","chain","chain","supply"]});
 assert.equal(groups.length,3);
 const chain58=groups.find(group=>group.tier===58);
 assert.deepEqual(chain58.positions,[2,3]);
 assert.equal(chain58.count,2);
});
test("Research comparison shows actual score improvement and changed positions",()=>{
 const older={board:[64,12,11],splitPercent:50,search:{score:100,remaining:2}};
 const newer={board:[64,13,11],splitPercent:70,search:{score:120,remaining:2}};
 assert.deepEqual(compareResearchBest(older,newer),{
  oldScore:100,newScore:120,delta:20,changedPositions:[2],oldSplit:50,newSplit:70
 });
});
test("Configuration budgets alternate supply and engine candidates",()=>{
 const candidates=[
  {splitDirection:"supply",id:"s1"},{splitDirection:"supply",id:"s2"},
  {splitDirection:"engine",id:"e1"},{splitDirection:"engine",id:"e2"}
 ];
 assert.deepEqual(chooseCandidatesByBudget(candidates,3).map(c=>c.id),
  ["s1","e1","s2"]);
});
test("Detailed Wind and merge points equal replay-verified Experiment 13 score",()=>{
 const positions=Array.from({length:100},(_,i)=>i);
 const slots=Array.from({length:120},(_,i)=>i<100?0:-1);
 const [found]=buildExperimental13Candidates(positions,64,58,25,true);
 const search=searchCombos(found.board,58,25,4,99,"descending domino",64);
 const breakdown=scoreBreakdown(search.moves);
 const verified=validateComboReplay(found.board,search.moves,58,25,slots,64);
 assert.equal(verified.score,76532);
 assert.equal(breakdown.total,verified.score);
 assert.equal(breakdown.mergePoints+breakdown.windPoints,verified.score);
 assert.equal(breakdown.windUpgrades,1925);
 assert.equal(breakdown.manualMerges,93);
 assert.ok(breakdown.peakChain<=25);
});
