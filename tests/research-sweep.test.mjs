import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const script=fileURLToPath(new URL('../research/sweep-30-to-10.mjs',import.meta.url));
function withCheckpoint(check){
 const folder=mkdtempSync(join(tmpdir(),'idleon-sushi-sweep-'));
 const checkpoint=join(folder,'result.json');
 try{check(checkpoint);}
 finally{rmSync(folder,{recursive:true,force:true});}
}
function run(checkpoint,...args){
 const result=spawnSync(process.execPath,[script,'--checkpoint='+checkpoint,...args],
  {encoding:'utf8',timeout:120000,maxBuffer:2_000_000});
 assert.equal(result.status,0,
  'Sweep process failed:\n'+result.stdout+'\n'+result.stderr);
 return JSON.parse(readFileSync(checkpoint,'utf8'));
}
test('Focused 24/76 guided run recovers the replay-verified Experiment 13 floor',()=>{
 withCheckpoint(checkpoint=>{
  const state=run(checkpoint,'--mode=guided','--start=24','--end=24',
   '--per-split=1','--scoring=full','--report-every=100');
  const entry=state.splitResults[24];
  assert.equal(entry.tested,'1');
  assert.equal(entry.best.score,76532);
  assert.equal(entry.best.merges,93);
  assert.equal(entry.best.origin,'Exp 13 benchmark seed');
  assert.equal(entry.best.board.length,100);
  assert.equal(entry.best.actions.length,93);
 });
});
test('Exact mode completes a one-tier domain across all 21 splits',()=>{
 withCheckpoint(checkpoint=>{
  const state=run(checkpoint,'--mode=exact','--min-tier=1','--max-tier=1',
   '--per-split=2','--scoring=quick','--report-every=1000');
  const keys=Object.keys(state.splitResults);
  assert.equal(keys.length,21);
  for(let split=10;split<=30;split++){
   const entry=state.splitResults[split];
   assert.equal(entry.tested,'1');
   assert.equal(entry.best.board[0],64);
   assert.ok(entry.best.board.slice(1).every(tier=>tier===1));
  }
 });
});
test('Increasing the exact budget resumes without resetting counters',()=>{
 withCheckpoint(checkpoint=>{
  const args=['--mode=exact','--min-tier=1','--max-tier=2',
   '--engine-order=sorted','--scoring=quick','--report-every=1000'];
  const first=run(checkpoint,...args,'--per-split=1');
  const second=run(checkpoint,...args,'--per-split=2');
  assert.equal(first.splitResults[24].tested,'1');
  assert.equal(second.splitResults[24].tested,'2');
  assert.equal(second.splitResults[30].tested,'2');
  assert.equal(second.splitResults[10].tested,'2');
 });
});
