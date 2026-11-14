import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {normalizeKnowledgeCycleOptions} from "../src/knowledge-cycle-optimizer.mjs";
import {simulateContinuousKnowledgeRotation}
 from "../src/knowledge-continuous-rotation.mjs";
import {combineKnowledgeContinuation}
 from "../src/knowledge-rotation-extension.mjs";
import {inspectKnowledgePinkFireplaces}
 from "../src/knowledge-pink-fireplaces.mjs";

const slots=Array.from({length:120},(_,i)=>i<40?0:-1);
const exampleBoard=()=>{const b=Array(120).fill(0);b[39]=64;return b;};
const run=(board,endTier,extra={})=>simulateContinuousKnowledgeRotation({
 startingBoard:board,slots,mode:"balanced",targetTier:endTier,
 balancedEndTier:endTier,requestedTier:1,guaranteedBonus:0,
 windCap:0,chain:0,rounds:2,pattern:"t1Climb",
 protectedIndices:[39],coverageTiers:[9,10,11,12],
 expAt:()=>1,cookCost:()=>1,maximumActions:1000,...extra
});
test("Balanced Start and End tiers normalize correctly",()=>{
 const normal=normalizeKnowledgeCycleOptions();
 assert.deepEqual([normal.balancedStartTier,normal.balancedEndTier],[1,64]);
 const custom=normalizeKnowledgeCycleOptions({
  mode:"balanced",balancedStartTier:20,balancedEndTier:50
 });
 assert.deepEqual([custom.balancedStartTier,custom.balancedEndTier],[20,50]);
 const crossed=normalizeKnowledgeCycleOptions({
  balancedStartTier:45,balancedEndTier:30
 });
 assert.deepEqual([crossed.balancedStartTier,crossed.balancedEndTier],[45,45]);
 assert.deepEqual([
  normalizeKnowledgeCycleOptions({balancedStartTier:0}).balancedStartTier,
  normalizeKnowledgeCycleOptions({balancedEndTier:65}).balancedEndTier
 ],[1,64]);
});
test("Balanced completes on newly created selected T10 without consuming original T64",()=>{
 const board=exampleBoard();
 board[0]=9;board[1]=9;
 const rotation=run(board,10);
 assert.equal(rotation.completed,true);
 assert.match(rotation.reason,/New T10 created/);
 assert.equal(rotation.frames.at(-1).kind,"merge");
 assert.ok(rotation.frames.at(-1).events.some(e=>e.tier===10));
 assert.equal(rotation.finalBoard[39],64);
 assert.equal(rotation.finalBoard.filter(t=>t===10).length,1);
 assert.equal(rotation.cooks,0);
});
test("Existing goal tier alone does not complete the rotation",()=>{
 const board=exampleBoard();board[0]=10;
 const rotation=run(board,10,{rounds:1,protectedIndices:[0,39]});
 assert.equal(rotation.completed,false);
 assert.equal(rotation.finalBoard[0],10);
 assert.equal(rotation.finalBoard[39],64);
});
test("Focused remains unchanged even when Balanced end tier is below 64",()=>{
 const board=exampleBoard();board[0]=9;board[1]=9;
 const focused=run(board,10,{mode:"focused",pattern:"uniform",rounds:1});
 assert.equal(focused.completed,false);
 assert.ok(focused.frames.some(f=>f.kind==="merge"&&
  f.events.some(e=>e.tier===10)));
});
test("Coverage after continuation respects only selected Balanced range",()=>{
 const board=exampleBoard();
 const gains=Array(65).fill(0);
 const prev={
  available:true,mode:"balanced",completed:false,
  balancedStartTier:20,balancedEndTier:22,targetTier:22,
  perTier:Array.from({length:64},(_,i)=>({
   tier:i+1,remaining:100,passiveExpPerDay:0
  })),steps:[{kind:"start",board},{kind:"partial",board}],
  finalBoard:board,startingBoard:board,
  expByTier:gains,options:{secondsPerCook:2,secondsPerMerge:1.5},
  estimatedFuelGeneration:3600,cycleSeconds:10,roundsCompleted:6,
  roundsRequested:6,cooks:0,merges:0,moves:0,windEvents:0,
  fuelPerCycle:0,activeSeconds:10,fuelWaitSeconds:10,
  totalExpPerCycle:0,balancedCycles:0,highestNewTier:0,
  highestWorkingTier:0,targetPassiveExpPerDay:0,
  passive:{averageTotalPerDay:0}
 };
 const chunkGains=Array(65).fill(0);
 chunkGains[5]=10;chunkGains[21]=20;chunkGains[40]=25;
 const chunk={
  valid:true,rounds:1,completed:false,initialBoard:board,finalBoard:board,
  protectedIndices:[39],frames:[
   {kind:"start",board},
   {kind:"cook",board,events:[{kind:"cook",at:1,tier:21}]},
   {kind:"partial",board}
  ],
  gains:chunkGains,cooks:1,merges:0,moves:0,windEvents:0,
  fuel:1,balancedCycles:0,highestTier:64,remaining:[39]
 };
 const continued=combineKnowledgeContinuation(prev,chunk,1);
 assert.equal(continued.coverageRequested,3);
 assert.deepEqual(continued.coveredTiers,[21]);
 assert.deepEqual(continued.uncoveredTiers,[20,22]);
 assert.equal(continued.expByTier[5],10);
 assert.equal(continued.expByTier[40],25);
});
test("Pink bonus is active only for imported selected Lithium columns",()=>{
 const imported=Array(15).fill(0),proposed=Array(15).fill(3);
 imported[0]=3;
 const status=inspectKnowledgePinkFireplaces({
  importedFires:imported,proposedFires:proposed,lithiumUnlocked:true
 });
 assert.equal(status.importedPinkCount,1);
 assert.equal(status.proposedPinkCount,15);
 assert.deepEqual(status.switchToPink,[1,2,3,4,5,6,7,8,9,10,11,12,13,14]);
 assert.equal(status.requiresPinkActivation,true);
 const locked=inspectKnowledgePinkFireplaces({
  importedFires:imported,proposedFires:proposed,lithiumUnlocked:false
 });
 assert.equal(locked.proposedPinkCount,0);
});
test("Balanced Start/End sliders and fireplace status are rendered",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../src/knowledge-leveling-ui.mjs",import.meta.url),"utf8");
 for(const id of [
  "knowledgePlanBalancedRange","knowledgePlanRangeStart","knowledgePlanRangeEnd",
  "knowledgePlanRangeValue","knowledgePlanRangeStartValue","knowledgePlanRangeEndValue"
 ])assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(ui,/renderRangeValues/);
 assert.match(ui,/balancedEndTier:state.balancedEndTier/);
 assert.match(ui,/p.pinkFireplaces/);
});
