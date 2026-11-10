import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildExperimental13Candidates,EXPERIMENTAL_13_BENCHMARK}
 from "../src/experimental13-preparation.mjs";
import {searchCombos} from "../src/merge-search.mjs";
import {nextComboMilestone,targetForExperiment,certifyComboMilestone}
 from "../src/combo-score-milestones.mjs";
import {mutate,rng} from "../scripts/search-combo-milestones.mjs";

test("Each new experiment must clear a 5,000-point milestone",()=>{
 const expected=[[76532,14,80000],[79999,14,80000],[80000,15,85000],
  [84999,15,85000],[85000,16,90000],[89999,16,90000],
  [90000,17,95000],[105000,20,110000]];
 for(const [score,num,target] of expected){
  assert.deepEqual(nextComboMilestone(score),{number:num,target});
  assert.equal(targetForExperiment(num),target);
 }
 assert.throws(()=>targetForExperiment(13),/start at 14/);
});

test("Historical 76,532-point Exp 13 cannot be falsely certified as Exp 14",()=>{
 const board=buildExperimental13Candidates(
  Array.from({length:100},(_,i)=>i),64,58,25,true)[0].board;
 const result=searchCombos(board,58,25,4,99,"descending domino",64);
 assert.equal(result.score,EXPERIMENTAL_13_BENCHMARK);
 assert.throws(()=>certifyComboMilestone(board,result.moves,14),
  /requires 80000 points; valid replay scored 76532/);
 assert.throws(()=>certifyComboMilestone(board,result.moves,15),
  /requires 85000 points/);
});

test("Candidate certificates reject invalid protected tier, filled slots and step data",()=>{
 const board=buildExperimental13Candidates(
  Array.from({length:100},(_,i)=>i),64,58,25,true)[0].board;
 const result=searchCombos(board,58,25,4,99,"descending domino",64);
 const withoutProtected=board.slice();withoutProtected[0]=63;
 assert.throws(()=>certifyComboMilestone(withoutProtected,result.moves,14),/protected tier 64/);
 const tooFew=board.slice();tooFew[99]=0;
 assert.throws(()=>certifyComboMilestone(tooFew,result.moves,14),/100 contiguous/);
 const forged=result.moves.map(x=>x);
 forged[0]={...forged[0],score:forged[0].score+10000};
 assert.throws(()=>certifyComboMilestone(board,forged,14),/Replay failed at action 1/);
});

test("Offline searches keep the protected tier and cannot change benchmark board",()=>{
 const board=buildExperimental13Candidates(
  Array.from({length:100},(_,i)=>i),64,58,25,true)[0].board;
 const copy=board.slice();
 const next=mutate(board,rng(20261110));
 assert.deepEqual(board,copy);
 assert.equal(next[0],64);
 assert.equal(next.length,120);
 assert.ok(next.slice(1,100).every(t=>Number.isInteger(t)&&t>=1&&t<=63));
 assert.ok(next.slice(100).every(t=>t===0));
 assert.deepEqual(mutate(board,rng(421)),mutate(board,rng(421)));
 const runner=readFileSync(new URL("../scripts/search-combo-milestones.mjs",import.meta.url),"utf8");
 assert.match(runner,/certifyComboMilestone\(board,winner.moves,nextExp\)/);
 assert.match(runner,/if\(winner.score>=targetForExperiment\(nextExp\)/);
 assert.match(runner,/No new numbered Experiment: threshold not achieved/);
});

test("Research CLI reports honest results without publishing an unqualified experiment",async()=>{
 const {spawnSync}=await import("node:child_process");
 const runner=new URL("../scripts/search-combo-milestones.mjs",import.meta.url);
 const outcome=spawnSync(process.execPath,[runner.pathname,"--trials=2","--seed=421"],
  {encoding:"utf8",timeout:30000});
 assert.equal(outcome.status,0,outcome.stderr||outcome.stdout);
 assert.match(outcome.stdout,/Exp 13\.0 verified: 76532/);
 assert.match(outcome.stdout,/"nextTarget": 80000/);
 assert.match(outcome.stdout,/No new numbered Experiment: threshold not achieved/);
});
