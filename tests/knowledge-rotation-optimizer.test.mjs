import test from "node:test";
import assert from "node:assert/strict";
import {optimizeKnowledgeRotation} from "../src/knowledge-rotation-optimizer.mjs";
import {simulateMerge,simulateRelocation} from "../src/optimizer-core.mjs";
function account(){
 const slots=Array(120).fill(-1),tiles=Array(120).fill(-1),
  fires=Array(15).fill(0);
 for(let i=0;i<12;i++)slots[i]=i===2?3:0;
 tiles[10]=10;tiles[11]=11;
 const upgrades=Array(46).fill(0);
 for(const [id,value] of [[6,5],[13,1],[26,1],[29,1],[37,2]])upgrades[id]=value;
 const flags=Array(64).fill(-1),xp=Array(64).fill(0),levels=Array(64).fill(5);
 for(let i=0;i<12;i++)flags[i]=0;
 return {slots,tiles,fires,sushi:[[],[],upgrades,[],[100,0,0,0],flags,xp,levels]};
}
const options={mode:"balanced",targetTier:2,rounds:2,
 fuelGeneration:1e9,fuelCapacity:10000,secondsPerCook:2,secondsPerMerge:1.5};
test("Integrated Knowledge optimizer designs its own preparation without copying the imported board",()=>{
 const save=account(),p=optimizeKnowledgeRotation(save,options);
 assert.equal(p.available,true,p.reason);
 assert.equal(p.boardDesigned,true);
 assert.deepEqual(p.importedBoard.slice(0,12),
  save.tiles.slice(0,12).map(n=>n<0?0:n+1));
 assert.equal(p.startingBoard[11],12,"Real highest-tier anchor remains in place");
 assert.equal(p.startingBoard[10],0,"Unrelated imported Sushi is NOT the seed");
 assert.deepEqual(p.startingBoard,p.steps[0].board);
 assert.ok(p.preparedBoardCooks>0);
 assert.deepEqual(p.preparedBoard,p.steps[p.preparedStep].board);
 assert.ok(p.preparedBoard.filter(x=>x>0).length>
  p.startingBoard.filter(x=>x>0).length);
 assert.equal(p.scenarioRequiresCleanup,true);
 assert.equal(p.design.omittedCount,1);
 assert.equal(p.design.anchor,11);
 assert.equal(p.layout.slots.length,120);
 assert.equal(p.proposedFires.length,15);
 assert.ok(p.roundsCompleted>=1&&p.roundsCompleted<=2);
 assert.ok(p.cooks>0&&p.merges>0);
 assert.ok(p.previewExpPerHour>0);
 assert.ok(Number.isFinite(p.estimatedFuelGeneration));
 assert.equal(p.pinkMultiplier,2);
 assert.ok(p.steps.some(x=>x.kind==="refill"));
 assert.ok(p.steps.some(x=>x.kind==="cook"));
 assert.ok(p.steps.every(x=>x.kind!=="clear"));
 assert.ok(p.perTier.some(x=>x.tier===2));
 for(let i=1;i<p.steps.length;i++){
  const previous=p.steps[i-1].board,frame=p.steps[i];
  if(frame.kind==="merge"){
   assert.deepEqual(simulateMerge(previous,frame.src,frame.dst,p.windCap,
    p.windCap?25:0,64)?.board,frame.board);
  }else if(frame.kind==="move"){
   assert.deepEqual(simulateRelocation(previous,frame.src,frame.dst,p.layout.slots,64)?.board,frame.board);
  }else if(frame.kind==="cook"){
   assert.equal(previous[frame.at],0);
   assert.equal(frame.board[frame.at]>0,true);
  }else assert.deepEqual(frame.board,previous);
 }
});
test("Focused Knowledge search picks a target and projects its EXP over legal refills",()=>{
 const save=account(),p=optimizeKnowledgeRotation(save,{...options,mode:"focused",targetTier:2});
 assert.equal(p.available,true,p.reason);
 assert.equal(p.mode,"focused");
 assert.equal(p.targetTier,2);
 assert.equal(p.previewExpPerHour>0,true);
 assert.equal(p.targetPreviewExpPerHour>=0,true);
 assert.equal(p.roundsRequested,2);
 assert.equal(p.perTier.find(x=>x.tier===2).expPerCycle,p.expByTier[2]);
 assert.ok(p.targetCreated>0);
 assert.equal(p.targetExp,p.expByTier[2]);
 assert.ok(p.peakTargetCopies>=1);
 assert.ok(p.harvestCount>=1);
 assert.ok(p.steps.some(f=>f.kind==="stage"&&f.phase==="harvest"));
 assert.ok(p.steps.every(f=>f.kind!=="clear"));
});
test("Integrated optimizer refuses empty imported accounts",()=>{
 assert.equal(optimizeKnowledgeRotation(null).available,false);
 assert.equal(optimizeKnowledgeRotation({sushi:[],slots:[],tiles:[]}).available,false);
 const locked=account();locked.sushi[2][13]=0;
 assert.match(optimizeKnowledgeRotation(locked,options).reason,/Seared Knowledge/);
});

test("Focused T58 estimates Cold plus Milktoast EXP without merging the protected T58",()=>{
 const save=account();
 save.slots=Array.from({length:120},(_,i)=>i<100?0:-1);
 save.tiles=Array(120).fill(-1);
 save.slots[0]=3;save.tiles[0]=57; // T58 on Milktoast
 save.slots[1]=2;save.tiles[1]=63; // T64 on Cold
 save.fires=Array(15).fill(3);
 save.sushi[5][57]=0;save.sushi[5][63]=0;
 const plan=optimizeKnowledgeRotation(save,{
  ...options,mode:"focused",targetTier:58,rounds:2,preservePassive:true
 });
 assert.equal(plan.available,true,plan.reason);
 assert.equal(plan.targetTier,58);
 assert.deepEqual(plan.protectedIndices,[0,1]);
 assert.ok(plan.steps.every(f=>f.board[0]===58&&f.board[1]===64),
  "The T58 on Milktoast and T64 on Cold must remain throughout the replay");
 assert.ok(plan.passive.current.expPerDay[58]>0);
 assert.ok(plan.passive.imported.expPerDay[58]>0);
 assert.equal(plan.passive.imported.covered,63);
 assert.ok(plan.passive.current.covered>=63);
 assert.ok(plan.targetHybridPreviewExpPerHour>=plan.targetPreviewExpPerHour);
 assert.equal(plan.passive.needAnotherT64,true);
 assert.equal(plan.passive.usesSecondT64,false);
 assert.ok(plan.perTier.find(x=>x.tier===58).passiveExpPerDay>0);
});

test("Focused T58 with limited cooking reports precursor-only preparation, not a fake harvest",()=>{
 const save=account();
 save.sushi[5][57]=0; // T58 discovered but unavailable as a direct cook.
 const p=optimizeKnowledgeRotation(save,{...options,mode:"focused",
  targetTier:58,rounds:3,preservePassive:false});
 assert.equal(p.available,true,p.reason);
 assert.equal(p.targetTier,58);
 assert.equal(p.targetCreated,0);
 assert.equal(p.targetExp,0);
 assert.equal(p.harvestCount,0);
 assert.equal(p.targetPreviewIncomplete,true);
 assert.equal(p.targetPreviewExpPerHour,0);
 assert.ok(p.highestNewTier<58);
 assert.deepEqual(p.initialProtectedIndices,[11],
  "Unrelated imported Sushi should not be protected, only the highest anchor");
 assert.ok(p.steps.every(f=>f.phase!=="harvest"));
});
test("Focused target score ignores passive advantage when another candidate creates more targets",()=>{
 const save=account();
 const p=optimizeKnowledgeRotation(save,{...options,mode:"focused",targetTier:2,
  rounds:2,preservePassive:false});
 assert.equal(p.available,true);
 assert.equal(p.options.preservePassive,false);
 assert.ok(p.targetCreated>=p.peakTargetCopies-p.startingBoard.filter(t=>t===2).length);
});
