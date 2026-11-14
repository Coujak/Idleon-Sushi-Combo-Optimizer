import test from "node:test";
import assert from "node:assert/strict";
import {
 projectPassiveKnowledge,recommendPassiveKnowledgeLayout,passiveProtectedIndices
} from "../src/knowledge-passive-layout.mjs";
import {simulateContinuousKnowledgeRotation} from "../src/knowledge-continuous-rotation.mjs";
import {simulateMerge,simulateRelocation} from "../src/optimizer-core.mjs";

const setup=()=>{
 const board=Array(120).fill(0),slots=Array(120).fill(-1);
 for(let i=0;i<100;i++)slots[i]=0;
 const fires=Array(15).fill(3);
 return {board,slots,fires};
};
test("Pink Cold T64 and Pink Milktoast T64 give passive EXP to all 64 Sushi tiers",()=>{
 const {board,slots,fires}=setup();
 board[0]=64;slots[0]=2;
 board[1]=64;slots[1]=3;
 board[2]=58;slots[2]=3;
 const projection=projectPassiveKnowledge(board,slots,fires,{
  lithiumUnlocked:true,globalMultiplier:1
 });
 assert.equal(projection.covered,64);
 assert.equal(projection.uncovered.length,0);
 assert.equal(projection.expPerDay[1],0.4);
 assert.equal(projection.expPerDay[57],0.4);
 assert.equal(projection.expPerDay[58],2.4);
 assert.equal(projection.expPerDay[64],2);
 assert.equal(projection.coldSources,1);
 assert.equal(projection.milktoastSources,2);
 assert.ok(Math.abs(projection.totalDaily-(63*0.4+2+2))<1e-9);
});

test("Cold T52 plus Milktoast T53-T64 leaves T52 uncovered",()=>{
 const {board,slots,fires}=setup();
 board[0]=52;slots[0]=2;
 for(let tier=53;tier<=64;tier++){
  const index=tier-52;board[index]=tier;slots[index]=3;
 }
 const projection=projectPassiveKnowledge(board,slots,fires,{lithiumUnlocked:true});
 assert.deepEqual(projection.uncovered,[52]);
 assert.equal(projection.covered,63);
 assert.equal(projection.expPerDay[51],0.4);
 assert.equal(projection.expPerDay[52],0);
 assert.equal(projection.expPerDay[58],2);
});

test("Proposed Focused T58 plates never invent extra T64 copies",()=>{
 const {board,slots,fires}=setup();
 for(let tier=25;tier<=64;tier++)board[tier-25]=tier;
 for(let i=0;i<8;i++)slots[i+20]=2;
 for(let i=0;i<12;i++)slots[i+28]=3;
 const inputBoard=board.slice(),inputSlots=slots.slice();
 const recommendation=recommendPassiveKnowledgeLayout(board,slots,fires,{
  targetTier:58,lithiumUnlocked:true
 });
 assert.equal(recommendation.needAnotherT64,true);
 assert.equal(recommendation.usesSecondT64,false);
 assert.ok(recommendation.coldPositions.some(i=>board[i]===64));
 assert.ok(recommendation.milktoastPositions.some(i=>board[i]===58));
 assert.equal(recommendation.recommended.expPerDay[58]>0,true);
 assert.equal(recommendation.recommended.covered,63);
 assert.deepEqual(board,inputBoard);
 assert.deepEqual(slots,inputSlots);
 assert.equal(recommendation.recommendedSlots.filter(x=>x===2).length,8);
 assert.equal(recommendation.recommendedSlots.filter(x=>x===3).length,12);
 assert.equal(recommendation.allTargetsCorrect,true);
});

test("Focused T58 hybrid farming protects parked Cold/Milktoast sources",()=>{
 const {board,slots}=setup();
 board[60]=64;slots[60]=2;
 board[61]=58;slots[61]=3;
 for(let i=0;i<58;i++)board[i]=2;
 const protect=passiveProtectedIndices(board,slots,{focused:true,targetTier:58});
 assert.deepEqual(protect,[60,61]);
 const plan=simulateContinuousKnowledgeRotation({
  startingBoard:board,slots,mode:"focused",targetTier:58,
  requestedTier:58,windCap:58,chain:25,
  expAt:()=>1,cookCost:()=>1,
  packingMode:"ascending",pattern:"uniform",
  protectedIndices:protect,rounds:2,maximumActions:1200
 });
 assert.equal(plan.valid,true);
 assert.ok(plan.cooks>0);
 assert.ok(plan.frames.every(frame=>frame.board[60]===64&&frame.board[61]===58));
 assert.ok(!plan.frames.some(frame=>frame.kind==="move"&&
  (protect.includes(frame.src)||protect.includes(frame.dst))));
 for(let j=1;j<plan.frames.length;j++){
  const old=plan.frames[j-1].board,frame=plan.frames[j];
  if(frame.kind==="merge"){
   const expected=simulateMerge(old,frame.src,frame.dst,58,25,64);
   assert.ok(expected);assert.deepEqual(frame.board,expected.board);
  }else if(frame.kind==="move"){
   const expected=simulateRelocation(old,frame.src,frame.dst,slots,64);
   assert.ok(expected);assert.deepEqual(frame.board,expected.board);
  }else if(frame.kind==="cook"){
   assert.equal(old[frame.at],0);
   assert.equal(frame.board[frame.at]>0,true);
  }else assert.deepEqual(frame.board,old);
 }
});
