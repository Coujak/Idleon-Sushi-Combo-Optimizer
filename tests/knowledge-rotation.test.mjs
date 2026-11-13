import test from "node:test";
import assert from "node:assert/strict";
import {getKnowledgeRows} from "../src/lab-model.mjs";
import {buildKnowledgeRotation,normalizeKnowledgeRotationOptions,positionLabel,
 KNOWLEDGE_ROTATION_MODES} from "../src/knowledge-rotation.mjs";

function fixture(){
 const slots=Array(120).fill(-1),tiles=Array(120).fill(-1);
 slots[0]=0;tiles[0]=39; // T40 regular
 slots[1]=3;tiles[1]=0;  // T1 Milktoast
 slots[2]=2;tiles[2]=39; // T40 Cold
 slots[3]=3;tiles[3]=1;  // T2 Milktoast
 slots[4]=0;tiles[4]=2;  // T3 regular
 slots[15]=0;tiles[15]=11; // T12 regular
 const upgrades=Array(46).fill(0);
 upgrades[13]=1;upgrades[42]=1;upgrades[26]=1;upgrades[29]=1;
 const tracking=Array(64).fill(-1),xp=Array(64).fill(0),levels=Array(64).fill(5);
 for(const tier of [1,2,3,40])tracking[tier-1]=0;
 const fires=Array(15).fill(0);fires[1]=3;
 return {slots,tiles,fires,sushi:[[],[],upgrades,[],[],tracking,xp,levels]};
}

test("Balanced covers every discovered Sushi exactly once per complete Milktoast rotation",()=>{
 const save=fixture();
 const rows=getKnowledgeRows(save);
 const plan=buildKnowledgeRotation(save,rows,{mode:"balanced"});
 assert.equal(plan.mode,"balanced");
 assert.equal(plan.available.length,4);
 assert.equal(plan.counts.milktoast,2);
 assert.equal(plan.counts.cold,1);
 assert.equal(plan.phases.length,2);
 assert.deepEqual(plan.phases.map(p=>p.targets.map(t=>t.tier)),[[1,2],[3,40]]);
 assert.deepEqual(plan.phases[0].slotPairs.map(p=>p.platePosition),[1,3]);
 assert.equal(plan.phases[0].slotPairs[0].alreadyOnPlate,true);
 assert.equal(plan.phases[0].slotPairs[1].alreadyOnPlate,true);
 assert.equal(plan.phases[0].readyCount,2);
 assert.equal(plan.phases[1].targets[0].needsMilktoastPreparation,true);
 assert.equal(plan.highestOnBoard,40);
 assert.deepEqual(plan.positions.coldHighest,[2]);
 assert.deepEqual(plan.phases[0].columns,[1,3]);
 assert.equal(plan.hasMittens,true);
 assert.equal(plan.hasSeared,true);
 assert.equal(plan.hasLithium,true);
 assert.equal(plan.hasWind,true);
});

test("Focused repeats the chosen target and assigns all owned Milktoast plates",()=>{
 const save=fixture(),rows=getKnowledgeRows(save);
 const plan=buildKnowledgeRotation(save,rows,{mode:"focused",targetTier:2});
 assert.equal(plan.mode,"focused");
 assert.equal(plan.selectedTier,2);
 assert.equal(plan.phases.length,3);
 assert.deepEqual(plan.phases.map(x=>x.kind),[
  "Prepare the target","Create the target repeatedly","Maintain passive EXP"]);
 assert.ok(plan.phases.every(x=>x.targets.length===1&&x.targets[0].tier===2));
 assert.ok(plan.phases.every(x=>x.slotPairs.length===2));
 assert.equal(plan.phases[0].slotPairs[0].platePosition,1);
 assert.equal(plan.phases[0].slotPairs[1].platePosition,3);
 assert.equal(plan.phases[0].targets[0].milktoastPositions[0],3);
 assert.equal(plan.guidance.coldBenefitsFocus,true); // Cold T40 benefits T2.
});

test("No Mittens never implies instant swaps, no Milktoast gives active 4-tier waves",()=>{
 const save=fixture();save.sushi[2][42]=0;
 save.slots[1]=0;save.slots[3]=0;
 const rows=getKnowledgeRows(save);
 const p=buildKnowledgeRotation(save,rows,{mode:"balanced"});
 assert.equal(p.hasMittens,false);
 assert.equal(p.counts.milktoast,0);
 assert.deepEqual(p.phases.map(x=>x.targets.map(y=>y.tier)),[[1,2,3,40]]);
 assert.ok(p.phases[0].slotPairs.every(x=>x.platePosition===null));
 assert.equal(p.phases[0].columns.length,0);
 const focus=buildKnowledgeRotation(save,rows,{mode:"focused",targetTier:40});
 assert.equal(focus.guidance.coldBenefitsFocus,false); // A Cold T40 does not benefit itself.
});

test("Invalid or missing save data returns safe empty plans",()=>{
 assert.deepEqual(normalizeKnowledgeRotationOptions({mode:"unknown",targetTier:200}),
  {mode:"balanced",targetTier:null});
 assert.deepEqual(normalizeKnowledgeRotationOptions({mode:"focused",targetTier:"2"}),
  {mode:"focused",targetTier:2});
 assert.ok(KNOWLEDGE_ROTATION_MODES.some(x=>x.value==="focused"));
 assert.equal(positionLabel(0),"R1C1");
 assert.equal(positionLabel(119),"R8C15");
 const empty=buildKnowledgeRotation(null,[],{mode:"balanced"});
 assert.equal(empty.phases.length,0);
 assert.equal(empty.counts.unlocked,0);
 const save=fixture();
 save.sushi[2][13]=0;
 const plan=buildKnowledgeRotation(save,getKnowledgeRows(save),{mode:"focused",targetTier:200});
 assert.equal(plan.selectedTier,1);
 assert.equal(plan.hasSeared,false);
});
