import test from "node:test";
import assert from "node:assert/strict";
import {
  simulateMerge,simulateRelocation,validateComboReplay,searchStaircaseCombos
} from "../src/optimizer-core.mjs";

// Reconstructed starting board for the user's 52-step gameplay description.
// 22 descending sushi (Tier 30..9), then 30 Tier-8 sushi.
// Of 52 numbered steps, 50 are merges; Step 26 is repositioning and
// Step 27 is the user's suggested improvement.
function benchmarkBoard(){
  const board=Array(120).fill(0),slots=Array(120).fill(-1);
  for(let i=0;i<22;i++)board[i]=30-i;
  for(let i=22;i<52;i++)board[i]=8;
  for(let i=0;i<52;i++)slots[i]=0;
  return {board,slots};
}
const reported=[18,47,88,142,210,293,392,508,642,795,968,1162,1378,
  1617,1880,2168,2482,2823,3192,3590,4018,4477,4968,5460,5478,
  5498,5520,5544,5570,5598,5628,5660,5694,5730,5768,5808,5850,
  5894,5940,5988,6038,6090,6144,6200,6258,6318,6380,6444,6510,6544];
test("reconstructed gameplay: all 50 manual merges reproduce the reported scores",()=>{
  const {board,slots}=benchmarkBoard();
  const result=searchStaircaseCombos(board,58,25,slots,null,{extraWindTarget:false});
  assert.equal(result.score,6544);
  const merges=result.moves.filter(x=>x.kind==="merge");
  assert.equal(merges.length,50);
  assert.equal(result.moves.filter(x=>x.kind==="move").length,2);
  let total=0;
  assert.deepEqual(merges.map(x=>(total+=x.score,total)),reported);
  assert.deepEqual(validateComboReplay(board,result.moves,58,25,slots).board,result.board);
});
test("placing the spare Tier 8 creates exactly 525 extra Wind points",()=>{
  const {board,slots}=benchmarkBoard();
  const normal=searchStaircaseCombos(board,58,25,slots,null,{extraWindTarget:false});
  const improved=searchStaircaseCombos(board,58,25,slots);
  assert.equal(improved.score,7069);
  assert.equal(improved.score-normal.score,525);
  assert.equal(improved.moves.filter(x=>x.kind==="merge").length,50);
  assert.equal(improved.moves.filter(x=>x.kind==="move").length,3);
  const before=normal.moves.filter(x=>x.kind==="merge");
  const after=improved.moves.filter(x=>x.kind==="merge");
  assert.deepEqual(after.slice(0,25).map(x=>x.score),before.slice(0,25).map(x=>x.score));
  assert.deepEqual(after.slice(25).map((x,i)=>x.score-before[i+25].score),
    Array.from({length:25},(_,i)=>i+9));
  const relocated=improved.moves.filter(x=>x.kind==="move");
  assert.equal(relocated.at(-1).tier,8);
  assert.equal(relocated.at(-1).score,0);
  const replay=validateComboReplay(board,improved.moves,58,25,slots);
  assert.equal(replay.score,7069);
  assert.equal(replay.merges,50);
  assert.equal(replay.repositions,3);
});
test("relocation cannot overwrite or move through locked slots",()=>{
  const board=[3,0,5,0],slots=[0,0,0,-1];
  assert.equal(simulateRelocation(board,0,2,slots),null);
  assert.equal(simulateRelocation(board,0,3,slots),null);
  assert.equal(simulateRelocation(board,0,0,slots),null);
  const relocated=simulateRelocation(board,0,1,slots);
  assert.equal(relocated.score,0);
  assert.deepEqual(relocated.board,[0,3,5,0]);
  assert.deepEqual(board,[3,0,5,0]);
});
test("non-matching sushi do not merge",()=>{
  assert.equal(simulateMerge([8,9],0,1,58,25),null);
});
