import test from 'node:test';
import assert from 'node:assert/strict';
import {createSplitProgressDashboard,formatSplitProgress,
 colorizeSplitProgress,stripTerminalColors} from '../research/terminal-progress.mjs';

function makeDashboard(columns=120){
 const splits=Array.from({length:21},(_,index)=>30-index);
 const state={splitResults:Object.fromEntries(splits.map(split=>
  [split,{tested:'10000',best:{score:split===24?76532:45000}}]))};
 const limits=new Map(splits.map(split=>[split,100000n]));
 const writes=[];
 const stream={isTTY:true,columns,write(text){writes.push(text);}};
 const dashboard=createSplitProgressDashboard({splits,state,limits,stream,color:false});
 return {dashboard,splits,state,writes};
}
test('All 21 splits start as fixed rows with cumulative checkpoint progress',()=>{
 const {dashboard,writes}=makeDashboard();
 dashboard.drawAll();
 assert.equal(writes.length,1);
 const rows=writes[0].trimEnd().split('\n');
 assert.equal(rows.length,21);
 assert.match(rows[0],/^Evaluating \| 30\/70 \| \[/);
 assert.match(rows[20],/^Evaluating \| 10\/90 \| \[/);
 assert.match(rows[6],/10\.0% - Split best: 76,532$/);
 assert.equal(rows.filter(line=>line.includes('10.0%')).length,21);
});
test('A single split can update in place without adding terminal lines',()=>{
 const {dashboard,state,writes}=makeDashboard();
 dashboard.drawAll();
 state.splitResults[24].tested='50000';
 dashboard.update(24);
 assert.equal(writes.length,2);
 assert.ok(writes[1].startsWith('\x1b[15A\r\x1b[2K'));
 assert.match(writes[1],/50\.0% - Split best: 76,532/);
 assert.ok(writes[1].endsWith('\x1b[15B\r'));
 assert.equal(writes[1].includes('\n'),false);
});
test('New-best announcement preserves the fixed dashboard below the message',()=>{
 const {dashboard,writes,state}=makeDashboard();
 dashboard.drawAll();
 state.splitResults[24].best.score=77000;
 dashboard.announce('NEW BEST 24/76 : 77,000 points');
 assert.equal(writes.length,4);
 assert.equal(writes[1],'\x1b[21A\r\x1b[0J');
 assert.match(writes[2],/^NEW BEST 24\/76 : 77,000 points\n/);
 assert.equal(writes[3].split('Evaluating |').length-1,21);
});
test('Progress formatting fits narrow terminals and handles large exact domains',()=>{
 for(const columns of [60,70,80,120]){
  const line=formatSplitProgress(30,10000n,100000n,76532,columns);
  assert.ok(line.length<columns,'line wraps at '+columns);
  assert.match(line,/Evaluating \| 30\/70 \| \[/);
 }
 assert.match(formatSplitProgress(10,100000n,100000n,0,120),/100\.0%/);
 assert.match(formatSplitProgress(10,1n,10n**70n,0,120),/0\.0%/);
});

test('Color highlights split ratios, progress, score and completed runs without changing width',()=>{
 for(const completed of [0,25,100]){
  const plain=formatSplitProgress(24,BigInt(completed),100n,76532,120);
  const colorized=colorizeSplitProgress(plain);
  assert.equal(stripTerminalColors(colorized),plain);
  assert.ok(colorized.includes('\x1b[1;36m24/76\x1b[0m'),'cyan split');
  assert.ok(colorized.includes('\x1b[1;33m76,532\x1b[0m'),'yellow best score');
  if(completed===100)assert.ok(colorized.includes('\x1b[1;32m] 100.0%'),'green completed progress');
 }
});
test('TTY uses colored lines and record notices when enabled',()=>{
 const {dashboard,writes}=makeDashboard();
 // The default harness disables color so use a second explicitly colored UI.
 const splits=Array.from({length:21},(_,i)=>30-i);
 const state={splitResults:Object.fromEntries(splits.map(s=>
  [s,{tested:'10000',best:{score:76532}}]))};
 const limits=new Map(splits.map(s=>[s,100000n]));
 const output=[];
 const stream={isTTY:true,columns:120,write(text){output.push(text);}};
 const colorful=createSplitProgressDashboard({splits,state,limits,stream,color:true});
 colorful.drawAll();
 assert.equal(stripTerminalColors(output[0]).trimEnd().split('\n').length,21);
 assert.ok(output[0].includes('\x1b[1;36m30/70'));
 colorful.announce('NEW BEST 24/76 : 77,000 points');
 assert.ok(output[2].startsWith('\x1b[1;32mNEW BEST '));
 assert.equal(stripTerminalColors(output[3]).split('Evaluating |').length-1,21);
 assert.equal(writes.length,0);
 dashboard.drawAll();
});
test('Explicitly disabled color and redirected output contain no styling codes',()=>{
 const {dashboard,writes}=makeDashboard();
 dashboard.drawAll();
 assert.ok(!writes[0].includes('\x1b[1;'));
 assert.equal(stripTerminalColors(writes[0]),writes[0]);
});
