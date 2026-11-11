import test from "node:test";
import assert from "node:assert/strict";
import {currentRunScore,reachedCurrentRunGoal} from "../src/research-score-display.mjs";

test("Running split search is blank before its first result, even with cached record",()=>{
 const saved={search:{score:76532}};
 assert.equal(currentRunScore({splitResearch:true,runBest:null,solution:saved}),null);
 assert.equal(currentRunScore({splitResearch:true,runBest:undefined,solution:saved}),null);
});
test("Running split search displays this run's actual best, not stronger saved best",()=>{
 const saved={search:{score:76532}};
 assert.equal(currentRunScore({splitResearch:true,runBest:52000,solution:saved}),52000);
 assert.equal(currentRunScore({splitResearch:true,runBest:70000,solution:saved}),70000);
 assert.equal(currentRunScore({splitResearch:true,runBest:78000,
  solution:{search:{score:78000}}}),78000);
});
test("Non-split searches can still display their current solution",()=>{
 assert.equal(currentRunScore({splitResearch:false,
  solution:{search:{score:12345}}}),12345);
 assert.equal(currentRunScore({splitResearch:false}),null);
});
test("Custom stop target uses only the current run and never cached winner",()=>{
 assert.equal(reachedCurrentRunGoal(70000,null),false);
 assert.equal(reachedCurrentRunGoal(70000,65000),false);
 assert.equal(reachedCurrentRunGoal(70000,70000),true);
 assert.equal(reachedCurrentRunGoal(70000,80000),true);
 assert.equal(reachedCurrentRunGoal(0,100000),false);
});
