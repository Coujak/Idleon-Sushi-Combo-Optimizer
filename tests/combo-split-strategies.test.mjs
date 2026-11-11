import test from "node:test";
import assert from "node:assert/strict";
import {COMBO_SPLIT_MODE_STEPS,comboSplitPercentages,isSplitOptimizerMode,
 buildSplitComboCandidates} from "../src/combo-split-strategies.mjs";
import {getModeCandidates} from "../src/optimizer-modes.mjs";
import {getPreparedBoardSections} from "../src/prepared-sections.mjs";
import {searchCombos} from "../src/merge-search.mjs";
import {validateComboReplay} from "../src/optimizer-core.mjs";

const positions=Array.from({length:100},(_,i)=>i);
const expected={
 simple:[],
 optimizer1:[50,70,90],
 optimizer2:[50,60,70,80,90],
 optimizer3:Array.from({length:10},(_,i)=>50+i*5),
 optimizer4:Array.from({length:50},(_,i)=>50+i)
};
for(const [mode,percentages] of Object.entries(expected)){
 test(mode+" evaluates exactly the requested split percentages",()=>{
  assert.ok(isSplitOptimizerMode(mode));
  assert.deepEqual(comboSplitPercentages(mode),percentages);
  const options=buildSplitComboCandidates(positions,64,58,25,0,true,mode);
  assert.equal(options.length,mode==="simple"?1:percentages.length*100);
  const supplies=[...new Set(options.filter(c=>c.splitDirection==="supply").map(c=>c.splitPercent))];
  const engines=[...new Set(options.filter(c=>c.splitDirection==="engine").map(c=>c.splitPercent))];
  assert.deepEqual(supplies,percentages);
  assert.deepEqual(engines,comboSplitPercentages(mode,"engine"));
  if(mode!=="simple"){
   assert.equal(options.filter(c=>c.splitDirection==="supply").length,percentages.length*50);
   assert.equal(options.filter(c=>c.splitDirection==="engine").length,percentages.length*50);
   assert.equal(options[0].splitDirection,"supply");
   assert.equal(options[50].splitDirection,"engine");
  }
  for(const option of options){
   assert.equal(option.board.length,120);
   assert.equal(option.board.filter(t=>t>0).length,100);
   assert.equal(option.board[0],64);
   assert.equal(option.board.filter(t=>t===64).length,1);
   assert.ok(option.board.slice(1,100).every(t=>t>=1&&t<=63));
   if(mode!=="simple"){
    assert.equal(option.supplyCount+option.engineCount,100);
    assert.equal(option.supplyCount,option.splitPercent);
    assert.equal(option.engineCount,100-option.splitPercent);
    assert.equal(option.strategySections.enginePositions[0],option.supplyCount);
   }
  }
 });
}
test("Finer modes include all coarser split boundaries, with identical strategies",()=>{
 for(const [a,b] of [["optimizer1","optimizer2"],["optimizer2","optimizer3"],["optimizer3","optimizer4"]]){
  const coarse=buildSplitComboCandidates(positions,64,58,25,0,true,a);
  const fine=buildSplitComboCandidates(positions,64,58,25,0,true,b);
  const fineKeys=new Set(fine.map(x=>x.board.join(",")));
  for(const x of coarse)assert.ok(fineKeys.has(x.board.join(",")),a+" not in "+b);
 }
});
test("Simple generates a contiguous descending Wind cascade at unlocked tiers",()=>{
 const p=Array.from({length:18},(_,i)=>i);
 const [candidate]=getModeCandidates(p,34,28,0,25,false,"simple");
 assert.equal(candidate.board[0],28);
 assert.equal(candidate.board[1],28);
 assert.equal(candidate.board[2],27);
 const result=searchCombos(candidate.board,28,25,4,17,"descending domino",34);
 const slots=Array(120).fill(-1);for(const i of p)slots[i]=0;
 assert.equal(validateComboReplay(candidate.board,result.moves,28,25,slots,34).score,
  result.score);
 assert.ok(result.score>0);
});
test("Modes respect future higher tiers, smaller accounts and locked slots",()=>{
 for(const [maxTier,cap,offset,count,protectedTop] of [[80,74,20,100,true],
    [45,39,12,40,false],[21,15,0,13,false],[6,0,0,10,false]]){
  const p=Array.from({length:count},(_,i)=>offset+i);
  const candidates=getModeCandidates(p,maxTier,cap,0,25,protectedTop,"optimizer1");
  assert.ok(candidates.length>0&&candidates.length<=300);
  for(const candidate of candidates){
   assert.equal(candidate.board.length,120);
   assert.equal(candidate.board.filter(t=>t>0).length,count);
   assert.equal(candidate.supplyCount+candidate.engineCount,count);
   assert.ok(candidate.board.slice(offset+(protectedTop?1:0),offset+count)
    .every(t=>t>=1&&t<maxTier));
   assert.deepEqual(candidate.board.slice(0,offset),Array(offset).fill(0));
   assert.equal(candidate.board.slice(offset+count).every(t=>t===0),true);
   if(protectedTop)assert.equal(candidate.board[offset],maxTier);
  }
 }
});
test("Chosen split explains the winning board supply and chain regions",()=>{
 const p=Array.from({length:100},(_,i)=>20+i);
 const slots=Array(120).fill(-1);for(const i of p)slots[i]=0;
 const candidates=getModeCandidates(p,64,58,0,25,true,"optimizer4");
 const last=candidates.find(x=>x.splitPercent===99);
 assert.equal(last.supplyCount,99);assert.equal(last.engineCount,1);
 const section=getPreparedBoardSections(last,slots);
 assert.ok(section);
 assert.equal(section.supplyCount,99);
 assert.equal(section.chainCount,1);
 assert.equal(section.firstEnginePosition,119);
 assert.equal(section.protectedPosition,20);
});
test("An imported protected T64 is retained when preparing lower tiers",()=>{
 const p=Array.from({length:20},(_,i)=>i);
 const candidates=buildSplitComboCandidates(p,50,44,25,0,true,"optimizer1");
 assert.ok(candidates.length>0&&candidates.length<=300);
 for(const x of candidates){
  assert.equal(x.board[0],64);
  assert.ok(x.board.slice(1,20).every(t=>t<50));
 }
});
test("Both research directions sweep opposing supply/engine ratios from 50/50",()=>{
 const grid=[
  ["optimizer1",[50,70,90],[50,30,10]],
  ["optimizer2",[50,60,70,80,90],[50,40,30,20,10]],
  ["optimizer3",[50,55,60,65,70,75,80,85,90,95],[50,45,40,35,30,25,20,15,10,5]],
  ["optimizer4",Array.from({length:50},(_,i)=>50+i),
   Array.from({length:50},(_,i)=>50-i)]
 ];
 for(const [mode,supply,engine] of grid){
  assert.deepEqual(comboSplitPercentages(mode,"supply"),supply);
  assert.deepEqual(comboSplitPercentages(mode,"engine"),engine);
  const options=buildSplitComboCandidates(positions,64,58,25,0,true,mode);
  assert.equal(options.length,100*supply.length);
  const directions=options.map(c=>c.splitDirection);
  assert.ok(directions.every((dir,i)=>dir===((Math.floor(i/50)%2===0)?"supply":"engine")));
  assert.ok(options.filter(c=>c.splitDirection==="supply")
   .every(c=>c.supplyCount>=c.engineCount));
  assert.ok(options.filter(c=>c.splitDirection==="engine")
   .every(c=>c.supplyCount<=c.engineCount));
  assert.ok(options.every(c=>c.splitStepIndex>=0));
 }
});
test("Wrong slot geometry, mode or limits never produce phantom splits",()=>{
 assert.deepEqual(buildSplitComboCandidates([0,2,3],64,58,25,0,true,"optimizer4"),[]);
 assert.deepEqual(buildSplitComboCandidates(positions,64,62,25,0,true,"optimizer4"),[]);
 assert.deepEqual(buildSplitComboCandidates(positions,64,58,26,0,true,"optimizer4"),[]);
 assert.deepEqual(buildSplitComboCandidates(positions,64,58,25,0,true,"other"),[]);
 assert.deepEqual(comboSplitPercentages("other"),[]);
});

test("Max visits the Experiment 13 24/76 boundary with 50 distinct profiles",()=>{
 const max=buildSplitComboCandidates(positions,64,58,25,0,true,"optimizer4");
 const at24=max.filter(c=>c.splitPercent===24&&c.splitDirection==="engine");
 assert.equal(at24.length,50);
 assert.ok(at24.every(c=>c.supplyCount===24&&c.engineCount===76));
 const at76=max.filter(c=>c.splitPercent===76&&c.splitDirection==="supply");
 assert.equal(at76.length,50);
 assert.equal(new Set(at24.map(c=>c.board.join(","))).size,50,
  "All 50 profiles at 24/76 must produce different prepared boards");
 assert.equal(new Set(at76.map(c=>c.board.join(","))).size,50,
  "All 50 profiles at 76/24 must produce different prepared boards");
});
