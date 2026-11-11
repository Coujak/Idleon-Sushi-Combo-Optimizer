import test from "node:test";
import assert from "node:assert/strict";
import {currentRunScore,reachedCurrentRunGoal,
 betterRunCandidate,selectDisplayedSearchResult} from "../src/research-score-display.mjs";

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

test("Stop & Continue selects the best result from this run even below saved best",()=>{
 const saved={board:["cached"],search:{score:76532,remaining:7}};
 const current={board:["new"],search:{score:61000,remaining:4}};
 assert.equal(selectDisplayedSearchResult(saved,current,true),current);
 assert.equal(selectDisplayedSearchResult(saved,current,false),saved);
 assert.equal(selectDisplayedSearchResult(saved,null,false),saved);
 assert.throws(()=>selectDisplayedSearchResult(saved,null,true),/No completed result from this run/);
});
test("Current-run comparison is independent of cached historical best",()=>{
 const first={board:["first"],search:{score:61000,remaining:8}};
 const better={board:["better"],search:{score:62000,remaining:7}};
 const tieImprovement={board:["tie"],search:{score:62000,remaining:6}};
 const worse={board:["worse"],search:{score:61000,remaining:9}};
 assert.equal(betterRunCandidate(first,null),true);
 assert.equal(betterRunCandidate(better,first),true);
 assert.equal(betterRunCandidate(tieImprovement,better),true);
 assert.equal(betterRunCandidate(worse,better),false);
 assert.equal(betterRunCandidate(null,first),false);
});
test("An old saved record alone cannot enable Stop & Continue",()=>{
 const saved={search:{score:76532}};
 const current=null;
 assert.equal(Boolean(current?.search),false);
 assert.equal(currentRunScore({splitResearch:true,runBest:null,solution:saved}),null);
});

test("Normal Custom completion shows this run's 64,946 rather than saved 68,396",()=>{
 const saved={board:["saved"],search:{score:68396,remaining:8}};
 const current={board:["current"],search:{score:64946,remaining:9}};
 // The completed search deliberately shows the new search's winner.
 const selected=selectDisplayedSearchResult(saved,current,true);
 assert.equal(selected.search.score,64946);
 assert.equal(selected.board[0],"current");
 assert.equal(saved.search.score,68396);
 // View saved best remains a separate explicit action.
 assert.equal(selectDisplayedSearchResult(saved,current,false),saved);
});
test("A completed split search without new boards can display its saved fallback",()=>{
 const saved={search:{score:68396,remaining:8}};
 const newRun=null;
 assert.equal(selectDisplayedSearchResult(saved,newRun,false),saved);
 assert.throws(()=>selectDisplayedSearchResult(saved,newRun,true),
  /No completed result from this run/);
});
test("A current-run improvement above saved best wins on regular completion",()=>{
 const saved={search:{score:68396,remaining:8}};
 const current={search:{score:70100,remaining:7}};
 assert.equal(selectDisplayedSearchResult(saved,current,true).search.score,70100);
 assert.equal(betterRunCandidate(current,saved),true);
});
