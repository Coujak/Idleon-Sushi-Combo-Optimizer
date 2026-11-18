import test from "node:test";
import assert from "node:assert/strict";
import {simulateContinuousKnowledgeRotation} from "../src/knowledge-continuous-rotation.mjs";
import {buildKnowledgeActiveExpHistory} from "../src/knowledge-active-exp-history.mjs";
import {inspectKnowledgePinkFireplaces} from "../src/knowledge-pink-fireplaces.mjs";

const base={
 startingBoard:Array(120).fill(0),
 slots:[...Array(10).fill(0),...Array(110).fill(-1)],
 mode:"balanced",targetTier:2,balancedEndTier:2,
 requestedTier:1,guaranteedBonus:1,
 windCap:0,chain:0,expAt:()=>1,cookCost:()=>1,
 rounds:3,pattern:"rangeClimb",maximumActions:2000
};
test("one-shot Balanced ends at its first newly cooked End tier",()=>{
 const result=simulateContinuousKnowledgeRotation({...base,stackEndTier:false});
 assert.equal(result.completed,true);
 assert.equal(result.cooks,1);
});
test("Stack End tier can create many end-tier copies, then harvest to free space",()=>{
 const result=simulateContinuousKnowledgeRotation({...base,stackEndTier:true});
 assert.equal(result.valid,true);
 assert.equal(result.completed,false);
 assert.ok(result.targetCreated>1);
 assert.ok(result.peakTargetCopies>1);
 assert.ok(result.harvestBatches.length>=1);
 const events=result.frames.flatMap(frame=>frame.events??[])
  .filter(e=>e.tier===2&&["cook","merge","wind"].includes(e.kind));
 assert.equal(result.targetCreated,events.length);
 assert.equal(result.gains[2],events.length); // expAt returns 1 for every creation
});
test("moving existing Sushi does not count as a newly created tier or earn EXP",()=>{
 const values=amount=>{const v=Array(65).fill(0);v[2]=amount;return v};
 const history=buildKnowledgeActiveExpHistory([
  {events:[{kind:"cook",tier:2}],gains:values(10)},
  {events:[{kind:"move",tier:2}],gains:values(0)},
  {events:[{kind:"merge",tier:2}],gains:values(10)}
 ]);
 assert.deepEqual(history.atStep(2,1),{exp:10,creations:1});
 assert.deepEqual(history.atStep(2,2),{exp:20,creations:2});
});
test("all-pink Knowledge preparation warns if the imported fireplaces differ",()=>{
 const details=inspectKnowledgePinkFireplaces({
  importedFires:Array(15).fill(1),proposedFires:Array(15).fill(3),lithiumUnlocked:true
 });
 assert.equal(details.requiresPinkActivation,true);
 assert.equal(details.switchToPink.length,15);
 assert.equal(details.proposedPinkCount,15);
});
