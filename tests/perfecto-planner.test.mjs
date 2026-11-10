import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 perfectoSingleChance,perfectoBoardChance,perfectoAttemptsForConfidence,
 sushiDirectCookFuel,chooseNextPerfectoTier,availablePerfectoTargets,
 perfectoBoardPlan,getPerfectoPlanner
} from "../src/perfecto-planner.mjs";
import {getKnowledgeRows} from "../src/lab-model.mjs";
import {searchPerfectoBoard,getSushiWindCap} from "../src/perfecto-wind-search.mjs";
import {estimateSushiFuelEconomy} from "../src/perfecto-fuel.mjs";

function exampleSave(){
 const sushi=Array.from({length:8},()=>[]);
 sushi[2]=Array(46).fill(0);
 sushi[4]=[0,0,0,0,0,8,4,1];
 sushi[5]=Array(64).fill(-1);
 sushi[5][0]=1; // T1 already Perfecto
 sushi[5][1]=0; // T2 missing
 sushi[5][2]=0; // T3 missing
 sushi[5][49]=0; // T50
 sushi[5][53]=0; // T54
 sushi[6]=Array(64).fill(0);
 sushi[7]=Array(64).fill(0);
 sushi[7][49]=2;sushi[7][53]=3;
 const slots=Array.from({length:120},(_,i)=>i<12?0:-1);
 const tiles=Array(120).fill(-1);
 tiles[0]=15; // T16: protected for target T2
 tiles[1]=1;  // existing T2
 tiles[3]=0;  // T1 replaceable
 return {sushi,slots,tiles,spelunk:Array.from({length:53},()=>[])};
}

test("IT/Corgan single-copy odds use the zero-based tier and Knowledge category 10",()=>{
 assert.equal(perfectoSingleChance(1),.6);
 const t10=.6*Math.pow(.81,9)/(1+9/8);
 assert.ok(Math.abs(perfectoSingleChance(10)-t10)<1e-15);
 assert.ok(Math.abs(perfectoSingleChance(10,100)-2*t10)<1e-14);
 assert.equal(perfectoSingleChance(1,10000),1);
 assert.equal(perfectoSingleChance(0),0);
 assert.equal(perfectoSingleChance(65),0);
});
test("Independent-roll board chance and cumulative Pepper milestones remain unchanged",()=>{
 assert.ok(Math.abs(perfectoBoardChance(.6,2)-.84)<1e-12);
 assert.ok(Math.abs(perfectoBoardChance(.2,10)-(1-Math.pow(.8,10)))<1e-12);
 assert.equal(perfectoBoardChance(0,90),0);
 assert.equal(perfectoBoardChance(.3,0),0);
 assert.equal(perfectoBoardChance(1,100),1);
 assert.equal(perfectoAttemptsForConfidence(.84,.5),1);
 assert.equal(perfectoAttemptsForConfidence(.84,.9),2);
 assert.equal(perfectoAttemptsForConfidence(.84,.99),3);
 assert.equal(perfectoAttemptsForConfidence(0,.9),null);
});
test("Only discovered, unperfected sushi are selectable, ascending by default",()=>{
 const save=exampleSave();
 assert.deepEqual(availablePerfectoTargets(save).map(k=>k.tier),[2,3,50,54]);
 assert.equal(chooseNextPerfectoTier(save),2);
 save.sushi[5][1]=1;assert.equal(chooseNextPerfectoTier(save),3);
 save.sushi[5][2]=1;save.sushi[5][49]=1;save.sushi[5][53]=1;
 assert.equal(chooseNextPerfectoTier(save),null);
 assert.deepEqual(availablePerfectoTargets(null),[]);
});
test("One automatically chosen final board preserves higher and target sushi",()=>{
 const save=exampleSave();
 const result=getPerfectoPlanner(save,{tier:2});
 assert.equal(result.plan.unlocked,12);
 assert.equal(result.plan.protected,1);
 assert.equal(result.plan.currentCopies,1);
 assert.ok(result.plan.copies>=1&&result.plan.copies<=11);
 assert.equal(result.plan.copies,result.search.targetCount);
 assert.equal(result.plan.board.length,120);
 assert.equal(result.plan.board[0].role,"protected");
 assert.equal(result.plan.board[0].preparedTier,15);
 assert.equal(result.plan.board[1].role,"target");
 assert.equal(result.plan.board[1].preparedTier,1);
 assert.equal(result.plan.board[12].role,"locked");
 assert.ok(result.plan.searchAttempts>=1);
 assert.ok(result.search.certificate || result.search.purchased<=result.search.effortBudget+1e-6);
 const same=getPerfectoPlanner(save,{tier:2});
 assert.equal(same.search,result.search); // unchanged save uses cached solution
 assert.deepEqual(same.plan.board,result.plan.board);
 const noProtection=perfectoBoardPlan(save,2,{protectHigher:false});
 assert.equal(noProtection.protected,0);
 assert.equal(noProtection.eligible,12);
});
test("Perfecto odds and shaker data come from the imported account, not controls",()=>{
 const save=exampleSave();
 const p=getPerfectoPlanner(save);
 assert.equal(p.target,2);
 assert.equal(p.preparation.saltAvailable,8);
 assert.equal(p.preparation.pepperAvailable,4);
 assert.equal(p.preparation.saltEstimate,0);
 const sources=getKnowledgeRows(save).filter(k=>k.category===10);
 assert.ok(Math.abs(p.bonus.knowledgeBonus-
   sources.reduce((sum,k)=>sum+(k.bonus??0),0))<1e-10);
 assert.ok(p.singleChance>0&&p.singleChance<=1);
 assert.ok(p.planChance>=p.currentChance);
 assert.ok(p.independenceAssumption);
 assert.ok(p.simulatedWind);
 assert.ok(p.freeUse.researchNotIncluded);
 assert.ok(p.milestones.every(m=>m.attempts>=1));
 const completed=getPerfectoPlanner(save,{tier:1});
 assert.equal(completed.recommendation.state,"completed");
 const manual=getPerfectoPlanner(save,{tier:50});
 assert.equal(manual.target,50);
 assert.equal(manual.current.name,"Soylent Nigiri");
 assert.equal(manual.plan.copies,manual.search.targetCount);
 assert.equal(getPerfectoPlanner(save,{tier:4}).reason,"undiscovered");
});
test("Tier 1 is cookable directly; high tiers are never painted in without a recipe",()=>{
 const save=exampleSave();
 save.sushi[5][0]=0;
 const direct=getPerfectoPlanner(save,{tier:1});
 assert.equal(direct.plan.copies,10);
 assert.equal(direct.plan.protected,2);
 assert.equal(direct.search.reason,"direct-cooking");
 const high=getPerfectoPlanner(save,{tier:50});
 assert.ok(high.plan.copies<=11);
 assert.equal(high.plan.copies,high.search.targetCount);
 for(const x of high.plan.board){
  if(x.role==="target")assert.equal(x.preparedTier,49);
 }
 assert.equal(sushiDirectCookFuel(6),176);
 assert.equal(sushiDirectCookFuel(1),10);
});
test("Account Wind limits and higher-tier preservation still apply to recipe search",()=>{
 const save=exampleSave();
 save.sushi[2][29]=1;
 save.sushi[5]=Array(64).fill(0);
 save.tiles[0]=63;
 assert.equal(getSushiWindCap(save),58);
 const economy=estimateSushiFuelEconomy(save);
 const result=searchPerfectoBoard(save,2,economy);
 assert.equal(result.board[0],64);
 assert.equal(result.windCap,58);
 assert.ok(result.targetCount>=1&&result.targetCount<=11);
 assert.ok(result.attempted>=1);
 assert.ok(result.certificate || result.purchased<=result.effortBudget+1e-6);
 assert.equal(result.board.filter(t=>t===2).length,result.targetCount);
});
test("High-target plan keeps the exact number of produced copies",()=>{
 const save=exampleSave();
 save.sushi[5][61]=0;
 const p=getPerfectoPlanner(save,{tier:62});
 assert.equal(p.target,62);
 assert.equal(p.plan.currentCopies,0);
 assert.equal(p.plan.copies,p.search.targetCount);
 assert.ok(p.plan.copies<=12);
 assert.equal(p.plan.board.filter(x=>x.role==="target").length,p.plan.copies);
 assert.equal(p.plan.board[0].role,"ingredient"); // T16 below T62
 assert.ok(p.search.certificate || p.search.purchased<=p.search.effortBudget+1e-6);
});
test("Only automatic target and protection controls remain in Perfecto",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../src/perfecto-ui.mjs",import.meta.url),"utf8");
 const lab=readFileSync(new URL("../src/lab-ui.mjs",import.meta.url),"utf8");
 const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
 const required=["perfectoPlanner","perfectoTarget","perfectoProtectHigher",
   "perfectoBoard","perfectoSingleChance","perfectoCurrentChance","perfectoPlanChance",
   "perfectoPlanOddsRatio","perfectoExpectedActivations","perfectoConfidence50",
   "perfectoConfidence90","perfectoConfidence99","perfectoSaltAdvice","perfectoBonusCards"];
 for(const id of required)assert.ok(html.includes('id="'+id+'"'),id);
 const removed=["perfectoPlanHours","perfectoCookingPace","perfectoFuelMode",
   "perfectoFuelCapacity","perfectoFuelGeneration","perfectoSourceTier",
   "perfectoSourceCost","perfectoCapOverride","perfectoGenOverride","perfectoCopies",
   "perfectoFuelEstimate"];
 for(const id of removed){
  assert.ok(!html.includes('id="'+id+'"'),"old control "+id);
  assert.ok(!ui.includes('$("'+id+'")'),"old control reference "+id);
 }
 assert.ok(html.includes('data-planner-target="combo"'));
 assert.ok(html.includes('data-planner-target="perfecto"'));
 assert.ok(html.includes('id="solver"'));
 assert.ok(ui.includes("getPerfectoPlanner(saved"));
 assert.ok(lab.includes("perfectoUI.refresh()"));
 assert.ok(css.includes(".perfecto-tile.perfecto-target"));
 assert.ok(ui.includes('text("perfectoPlanChance",percent(result.planChance))'));
 assert.ok(ui.includes('text("perfectoPlanOddsRatio",result.planChance>0?'));
});
test("Target dropdown excludes completed and undiscovered sushi",()=>{
 const save=exampleSave();
 assert.deepEqual(availablePerfectoTargets(save).map(k=>k.tier),[2,3,50,54]);
 save.sushi[5][2]=1;
 assert.deepEqual(availablePerfectoTargets(save).map(k=>k.tier),[2,50,54]);
 const ui=readFileSync(new URL("../src/perfecto-ui.mjs",import.meta.url),"utf8");
 assert.ok(ui.includes("available=availablePerfectoTargets(saved)"));
 assert.ok(ui.includes("for(const k of available)"));
});

test("Certified carry construction compares every affordable tier, not a hard 50% cutoff",()=>{
 const save=exampleSave();
 save.sushi[2][6]=45; // maximum directly cooked tier T46
 save.sushi[5]=Array(64).fill(0);
 save.sushi[2][29]=1;
 save.tiles=Array(120).fill(-1);
 save.slots=Array.from({length:120},(_,i)=>i<100?0:-1);
 const cost=sushiDirectCookFuel(44);
 const economy={capacity:cost*1.1,generationPerHour:1e13,maxCookTier:46};
 const result=searchPerfectoBoard(save,62,economy);
 assert.ok(result.cookingTiersCompared>=44);
 assert.ok(result.sourceTier<=44);
 assert.ok(result.targetCount>=80);
 if(result.certificate){
  assert.equal(result.certificate.type,"recursive-westward-carry");
  assert.equal(result.certificate.targetTier,62);
  assert.equal(result.certificate.finalCopies,result.targetCount);
  assert.ok(result.certificate.capacityShare>0.5);
  assert.equal(result.board.filter(x=>x===62).length,result.targetCount);
  assert.equal(BigInt(result.certificate.cooksExact),
   BigInt(result.certificate.finalCopies)*(1n<<BigInt(62-result.certificate.startingTier)));
 }
});


test("Unused Perfecto construction workspace becomes a buildable 17-tile Wind staircase",()=>{
 const save=exampleSave();
 save.sushi[2][6]=45;
 save.sushi[2][29]=1;
 save.sushi[5]=Array(64).fill(0);
 save.tiles=Array(120).fill(-1);
 save.tiles[0]=63; // protected T64
 save.slots=Array.from({length:120},(_,i)=>i<100?0:-1);
 const cost=sushiDirectCookFuel(45);
 const economy={capacity:cost*1.1,generationPerHour:1e13,maxCookTier:46};
 const result=searchPerfectoBoard(save,62,economy);
 const expected=Array.from({length:17},(_,i)=>58-i);
 assert.equal(result.sourceTier,45);
 assert.equal(result.targetCount,82);
 assert.equal(result.board[0],64);
 assert.ok(result.board.slice(1,83).every(tier=>tier===62));
 assert.deepEqual(result.board.slice(83,100),expected);
 assert.ok(result.board.slice(0,100).every(tier=>tier>0));
 assert.ok(result.board.slice(100).every(tier=>tier===0));
 assert.equal(result.certificate?.supportingCount,17);
 assert.deepEqual(result.certificate.supportingSushi.map(x=>x.position),
  Array.from({length:17},(_,i)=>84+i));
 assert.deepEqual(result.certificate.supportingSushi.map(x=>x.tier),expected);
 for(let i=0;i<result.certificate.supportingSushi.length;i++){
  const item=result.certificate.supportingSushi[i];
  assert.ok(item.requiredWorkspace<=17-i,
   "Position "+item.position+" must fit remaining construction workspace");
  assert.ok(sushiDirectCookFuel(item.sourceTier)<=economy.capacity);
 }
 const c=result.certificate;
 assert.equal(BigInt(c.totalCooksExact),
  BigInt(c.cooksExact)+BigInt(c.supportingCooksExact));
 assert.equal(BigInt(c.totalMergesExact),
  BigInt(c.mergesExact)+BigInt(c.supportingMergesExact));
});

test("Filler ingredients never replace protected tiles or invent targets when Wind is absent",()=>{
 const save=exampleSave();
 save.sushi[5]=Array(64).fill(0);
 save.sushi[2][6]=45;
 save.tiles=Array(120).fill(-1);
 save.tiles[26]=63;
 save.slots=Array.from({length:120},(_,i)=>i<100?0:-1);
 const economy={capacity:sushiDirectCookFuel(45)*1.1,generationPerHour:1e13,maxCookTier:46};
 const result=searchPerfectoBoard(save,62,economy);
 assert.equal(result.board[26],64);
 assert.equal(result.targetCount,82);
 assert.equal(result.board.filter(tier=>tier===62).length,82);
 assert.equal(result.certificate?.supportingCount,17);
 assert.ok(result.board.slice(0,100).every(tier=>tier>0));
 assert.ok(result.certificate.supportingSushi[0].tier<=61);
 assert.equal(result.windCap,0);
});
