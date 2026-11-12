import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 perfectoSingleChance,perfectoBoardChance,perfectoAttemptsForConfidence,
 sushiDirectCookFuel,chooseNextPerfectoTier,availablePerfectoTargets,
 perfectoBoardPlan,getPerfectoPlanner,perfectoOddsImprovement,
 perfectoKnownFreeUseEstimate
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

test("Single-copy Perfecto odds use the zero-based tier and Knowledge category 10",()=>{
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
 assert.equal(result.plan.board[11].role,"protected");
 assert.equal(result.plan.board[11].preparedTier,15);
 assert.equal(result.plan.board.filter(cell=>cell.role==="target").length,result.plan.copies);
 assert.ok(result.plan.board.some(cell=>cell.role==="target"&&cell.preparedTier===1));
 assert.equal(result.plan.board[12].role,"locked");
 assert.ok(result.plan.searchAttempts>=1);
 assert.ok(result.search.certificate || result.search.purchased<=result.search.effortBudget+1e-6);
 const same=getPerfectoPlanner(save,{tier:2});
 assert.equal(same.search,result.search); // unchanged save uses cached solution
 assert.deepEqual(same.plan.board,result.plan.board);
 const cannotDisable=getPerfectoPlanner(save,{tier:2,protectHigher:false});
 assert.equal(cannotDisable.plan.protected,1,
  "higher-tier sushi always remain protected");
});
test("Perfecto odds and shaker data come from the imported account, not controls",()=>{
 const save=exampleSave();
 const p=getPerfectoPlanner(save);
 assert.equal(p.target,2);
 assert.equal(p.preparation.pepperAvailable,4);
 assert.equal(p.pepperStackChance,perfectoBoardChance(p.planChance,4));
 assert.equal(p.recommendation.state,"save");
 assert.match(p.recommendation.title,/SAVE PEPPER/);
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
 assert.equal(result.board[11],64); // highest protected tier goes to the last regular slot
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
test("Only automatic target choice remains in Perfecto",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../src/perfecto-ui.mjs",import.meta.url),"utf8");
 const lab=readFileSync(new URL("../src/lab-ui.mjs",import.meta.url),"utf8");
 const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
 const required=["perfectoPlanner","perfectoTarget",
   "perfectoBoard","perfectoSingleChance","perfectoCurrentChance","perfectoPlanChance",
   "perfectoPlanOddsRatio","perfectoExpectedActivations","perfectoConfidence50",
   "perfectoConfidence90","perfectoConfidence99","perfectoActionTitle",
   "perfectoStoredChance","perfectoBonusCards"];
 for(const id of required)assert.ok(html.includes('id="'+id+'"'),id);
 const removed=["perfectoPlanHours","perfectoCookingPace","perfectoFuelMode",
   "perfectoFuelCapacity","perfectoFuelGeneration","perfectoSourceTier",
   "perfectoSourceCost","perfectoCapOverride","perfectoGenOverride","perfectoCopies",
   "perfectoFuelEstimate","perfectoProtectHigher","perfectoSaltUses",
   "perfectoSaltEstimate","perfectoSaltAdvice","perfectoFreeShaker",
   "perfectoExpectedConsumed"];
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
 assert.deepEqual(result.board.slice(0,17),expected);
 assert.ok(result.board.slice(17,99).every(tier=>tier===62));
 assert.equal(result.board[99],64);
 assert.ok(result.board.slice(0,100).every(tier=>tier>0));
 assert.ok(result.board.slice(100).every(tier=>tier===0));
 assert.equal(result.certificate?.supportingCount,17);
 assert.deepEqual(result.certificate.supportingSushi.map(x=>x.position),
  Array.from({length:17},(_,i)=>1+i));
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
 assert.equal(result.board[99],64); // higher tier moves to final regular plate
 assert.equal(result.targetCount,82);
 assert.equal(result.board.filter(tier=>tier===62).length,82);
 assert.equal(result.certificate?.supportingCount,17);
 assert.ok(result.board.slice(0,100).every(tier=>tier>0));
 assert.ok(result.certificate.supportingSushi[0].tier<=61);
 assert.equal(result.windCap,0);
});


test("Perfecto targets take Hot, Cold and Milktoast plates before ordinary ones",()=>{
 const save=exampleSave();
 save.sushi[2][6]=45;
 save.sushi[2][29]=1;
 save.sushi[5]=Array(64).fill(0);
 save.tiles=Array(120).fill(-1);
 save.tiles[0]=63; // Preserve the higher T64 on a special plate.
 save.slots=Array.from({length:120},(_,i)=>i<100?0:-1);
 save.slots[0]=2;
 save.slots[90]=1; // Hot, formerly leftover workspace
 save.slots[93]=2; // Cold
 save.slots[95]=3; // Milktoast
 const economy={capacity:sushiDirectCookFuel(45)*1.1,
  generationPerHour:1e13,maxCookTier:46};
 const result=searchPerfectoBoard(save,62,economy);
 assert.equal(result.targetCount,82);
 assert.equal(result.board[0],64);
 for(const pos of [90,93,95])assert.equal(result.board[pos],62,
  "Position "+(pos+1)+" should prioritize T62 on its bonus plate");
 assert.equal(result.board.filter(x=>x===62).length,82);
 assert.ok(result.board.slice(1,100).every(tier=>tier>0));
 assert.equal(result.certificate.supportingCount,17);
 const supporting=result.certificate.supportingSushi;
 assert.deepEqual(supporting.map(x=>x.tier),Array.from({length:17},(_,i)=>58-i));
 for(const item of supporting)assert.equal(result.board[item.position-1],item.tier);
 assert.ok(supporting.every(item=>save.slots[item.position-1]===0),
  "All lower supporting sushi fit on ordinary plates");
});

test("Special slots are used by T62 even when lower-tier ingredients are more numerous",()=>{
 const save=exampleSave();
 save.sushi[2][6]=45;
 save.sushi[5]=Array(64).fill(0);
 save.sushi[2][29]=1;
 save.tiles=Array(120).fill(-1);
 save.slots=Array.from({length:120},(_,i)=>i<35?0:-1);
 save.slots[28]=1;
 save.slots[29]=2;
 save.slots[30]=3;
 const economy={capacity:sushiDirectCookFuel(45)*1.1,
  generationPerHour:1e13,maxCookTier:46};
 const result=searchPerfectoBoard(save,62,economy);
 assert.ok(result.targetCount>0);
 for(const pos of [28,29,30])assert.equal(result.board[pos],62);
 assert.equal(result.board.filter(x=>x===62).length,result.targetCount);
});

test("Higher protected sushi outrank Perfecto targets for bonus slots, even if moved",()=>{
 const save=exampleSave();
 save.sushi[2][6]=45;
 save.sushi[2][29]=1;
 save.sushi[5]=Array(64).fill(0);
 save.tiles=Array(120).fill(-1);
 save.tiles[0]=63; // T64 starts on an ordinary slot
 save.slots=Array.from({length:120},(_,i)=>i<100?0:-1);
 save.slots[90]=1; // Hot
 save.slots[93]=2; // Cold
 save.slots[95]=3; // Milktoast
 const economy={capacity:sushiDirectCookFuel(45)*1.1,
  generationPerHour:1e13,maxCookTier:46};
 const result=searchPerfectoBoard(save,62,economy);
 assert.equal(result.targetCount,82);
 assert.equal(result.board[90],64); // The T64 outranks T62
 assert.equal(result.board[93],62);
 assert.equal(result.board[95],62);
 assert.equal(result.board.filter(t=>t===64).length,1);
 assert.equal(result.board.filter(t=>t===62).length,82);
 assert.ok(result.board.slice(0,100).every(t=>t>0));
 assert.ok(result.board.slice(100).every(t=>t===0));
 assert.ok(result.certificate);
 assert.deepEqual(result.certificate.supportingSushi.map(x=>x.tier),
  Array.from({length:17},(_,i)=>58-i));
 for(const item of result.certificate.supportingSushi){
  assert.equal(result.board[item.position-1],item.tier);
  assert.equal(save.slots[item.position-1],0);
 }
});

test("Among supporting sushi, the highest tiers get remaining bonus plates",()=>{
 const save=exampleSave();
 save.sushi[2][6]=45;
 save.sushi[2][29]=1;
 save.sushi[5]=Array(64).fill(0);
 save.tiles=Array(120).fill(-1);
 save.tiles[0]=63;
 save.slots=Array.from({length:120},(_,i)=>i<100?i<85?1:0:-1);
 const economy={capacity:sushiDirectCookFuel(45)*1.1,
  generationPerHour:1e13,maxCookTier:46};
 const result=searchPerfectoBoard(save,62,economy);
 assert.equal(result.targetCount,82);
 assert.equal(result.board[0],64);
 assert.ok(result.board.slice(1,83).every(t=>t===62));
 assert.deepEqual(result.board.slice(83,85),[58,57]);
 assert.deepEqual(result.board.slice(85,100),Array.from({length:15},(_,i)=>56-i));
});

test("Regular Perfecto boards put the support ladder first and protected T64 bottom-right",()=>{
 const save=exampleSave();
 save.sushi[2][6]=45;
 save.sushi[2][29]=1;
 save.sushi[5]=Array(64).fill(0);
 save.tiles=Array(120).fill(-1);
 save.tiles[0]=63;
 save.slots=Array.from({length:120},(_,i)=>i<100?0:-1);
 const economy={capacity:sushiDirectCookFuel(45)*1.1,generationPerHour:1e13,maxCookTier:46};
 const result=searchPerfectoBoard(save,62,economy);
 assert.deepEqual(result.board.slice(0,17),Array.from({length:17},(_,i)=>58-i));
 assert.ok(result.board.slice(17,99).every(tier=>tier===62));
 assert.equal(result.board[99],64);
 assert.equal(result.board.filter(tier=>tier===62).length,82);
 for(const item of result.certificate.supportingSushi){
  assert.equal(result.board[item.position-1],item.tier);
 }
});
test("Last unlocked special plate can host the top tier at the far right",()=>{
 const save=exampleSave();
 save.sushi[2][6]=45;
 save.sushi[2][29]=1;
 save.sushi[5]=Array(64).fill(0);
 save.tiles=Array(120).fill(-1);
 save.tiles[0]=63;
 save.slots=Array.from({length:120},(_,i)=>i<100?0:-1);
 save.slots[20]=1;save.slots[30]=2;save.slots[99]=3;
 const economy={capacity:sushiDirectCookFuel(45)*1.1,generationPerHour:1e13,maxCookTier:46};
 const result=searchPerfectoBoard(save,62,economy);
 assert.equal(result.board[99],64);
 assert.equal(result.board[20],62);
 assert.equal(result.board[30],62);
 assert.deepEqual(result.board.filter(tier=>tier>0).length,100);
 assert.deepEqual(result.board.filter(tier=>tier===62).length,82);
 const support=result.certificate.supportingSushi;
 assert.deepEqual(support.map(x=>x.tier),Array.from({length:17},(_,i)=>58-i));
 assert.ok(support.every(x=>result.board[x.position-1]===x.tier));
});
test("Perfecto role indicators and real plate colors are not overridden by sushi backgrounds",()=>{
 const styles=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 for(const id of [0,1,2,3])assert.ok(styles.includes(".perfecto-board .perfecto-tile.slot-"+id));
 assert.ok(styles.includes(".perfecto-board .perfecto-tile.perfecto-target"));
 assert.ok(styles.includes(".perfecto-board .perfecto-tile.perfecto-protected"));
 assert.ok(html.includes("Regular plate"));
});

test("Pepper guidance saves until prepared and never imposes a stockpile threshold",()=>{
 const pending=getPerfectoPlanner(exampleSave(),{tier:2});
 assert.equal(pending.recommendation.state,"save");
 assert.ok(pending.plan.copies>pending.plan.currentCopies);
 assert.match(pending.recommendation.title,/SAVE PEPPER/);
 assert.ok(Math.abs(pending.pepperStackChance-
   perfectoBoardChance(pending.planChance,pending.preparation.pepperAvailable))<1e-12);
 const completeBoard=exampleSave();
 for(let i=1;i<12;i++)completeBoard.tiles[i]=1;
 const ready=getPerfectoPlanner(completeBoard,{tier:2});
 assert.equal(ready.plan.currentCopies,11);
 assert.equal(ready.plan.copies,11);
 assert.equal(ready.recommendation.state,"ready");
 assert.match(ready.recommendation.title,/USE PEPPER NOW/);
 const noPepperBoard=exampleSave();
 for(let i=1;i<12;i++)noPepperBoard.tiles[i]=1;
 noPepperBoard.sushi[4][6]=0;
 const noPepper=getPerfectoPlanner(noPepperBoard,{tier:2});
 assert.equal(noPepper.recommendation.state,"empty");
 assert.match(noPepper.recommendation.title,/COLLECT PEPPER/);
 assert.equal(noPepper.pepperStackChance,0);
});
test("Public HTML removes technical source names, Salt controls, and protection toggle",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../src/perfecto-ui.mjs",import.meta.url),"utf8");
 for(const str of ["Idleon Toolbox","Corgan","perfectoProtectHigher",
   "perfectoSaltUses","perfectoSaltEstimate","perfectoSaltAdvice"]){
  assert.ok(!html.includes(str),"old public-facing content: "+str);
 }
 assert.ok(html.includes("Current Board Chances"));
 assert.ok(html.includes("What should I do with my Pepper Shakers?"));
 assert.ok(ui.includes('text("perfectoActionTitle"'));
 assert.ok(!ui.includes("protect.checked"));
 const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
 const app=readFileSync(new URL("../src/app.js",import.meta.url),"utf8");
 assert.ok(css.includes(".tile.merge-landed"));
 assert.ok(css.includes(".tile.merge-flying-sushi"));
 assert.ok(app.includes("opacity:.78"));
 assert.ok(app.includes("opacity:.66"));
});


test("Preparation comparison reports per-use odds and expected Pepper attempt savings",()=>{
 const result=perfectoOddsImprovement(.2,.6);
 assert.equal(result.before,.2);
 assert.equal(result.after,.6);
 assert.ok(Math.abs(result.ratio-3)<1e-12);
 assert.ok(Math.abs(result.percentagePointGain-40)<1e-12);
 assert.ok(Math.abs(result.currentAttempts-5)<1e-12);
 assert.ok(Math.abs(result.optimizedAttempts-5/3)<1e-12);
 assert.ok(Math.abs(result.savedAttempts-10/3)<1e-12);
 assert.equal(result.improvement,true);
 assert.equal(result.fromZero,false);
 const fromEmpty=perfectoOddsImprovement(0,.4);
 assert.equal(fromEmpty.ratio,null);
 assert.equal(fromEmpty.currentAttempts,null);
 assert.equal(fromEmpty.fromZero,true);
 const unchanged=perfectoOddsImprovement(.3,.3);
 assert.equal(unchanged.improvement,false);
 assert.equal(unchanged.savedAttempts,0);
});

test("Known shaker refunds give a conservative cap-aware charge estimate",()=>{
 const partial=perfectoKnownFreeUseEstimate(.2,.25);
 assert.equal(partial.knownChance,.25);
 assert.equal(partial.atCap,false);
 assert.ok(Math.abs(partial.expectedConsumedUpperBound-3.75)<1e-12);
 const capped=perfectoKnownFreeUseEstimate(.5,.99);
 assert.equal(capped.knownChance,.6);
 assert.equal(capped.atCap,true);
 assert.ok(Math.abs(capped.expectedConsumedUpperBound-.8)<1e-12);
 assert.equal(perfectoKnownFreeUseEstimate(0,.3).expectedConsumedUpperBound,null);
 assert.equal(perfectoKnownFreeUseEstimate(1,0).expectedConsumedUpperBound,1);
});

test("Perfecto plan exposes improvement and known-source shaker charge estimate",()=>{
 const save=exampleSave();
 save.sushi[2][21]=4; // Bottomless Shakers contributes 4 percentage points
 const p=getPerfectoPlanner(save,{tier:2});
 assert.ok(Math.abs(p.improvement.after-p.planChance)<1e-12);
 assert.ok(Math.abs(p.improvement.before-p.currentChance)<1e-12);
 assert.equal(p.freeUse.knownChance,.04);
 assert.equal(p.freeUse.atCap,false);
 assert.ok(Math.abs(p.freeUse.expectedConsumedUpperBound-
  p.expectedActivations*.96)<1e-10);
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../src/perfecto-ui.mjs",import.meta.url),"utf8");
 for(const id of [
  "perfectoCurrentOddsRatio","perfectoImprovement","perfectoImprovementDetail",
  "perfectoPreparationSteps","perfectoKnownFreeChance","perfectoExpectedSpentUpper"
 ])assert.ok(html.includes('id="'+id+'"'),"Expected Perfecto UI "+id);
 assert.ok(ui.includes("perfectoPreparationSteps(result)"));
 assert.ok(ui.includes('text("perfectoImprovement",'));
 assert.ok(ui.includes('text("perfectoKnownFreeChance",'));
});

test("Confirmed cooking tier can correct JSON estimate up or down",()=>{
 const save=exampleSave();
 const base=getPerfectoPlanner(save,{tier:50});
 const higher=getPerfectoPlanner(save,{tier:50,cookTier:46});
 const lower=getPerfectoPlanner(save,{tier:50,cookTier:1});
 assert.equal(higher.observedCookTier,46);
 assert.equal(higher.economy.maxCookTier,46);
 assert.ok(higher.economy.capacity>=sushiDirectCookFuel(46));
 assert.equal(lower.observedCookTier,1);
 assert.equal(lower.economy.maxCookTier,1);
 assert.equal(base.observedCookTier,null);
 assert.equal(higher.comparisons.maximum.economy.hypothetical,true);
 assert.equal(higher.comparisons.maximum.economy.maxCookTier,46);
});

test("Perfecto UI renders both boards, scenario comparison and Wind-specific guidance",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../src/perfecto-ui.mjs",import.meta.url),"utf8");
 for(const id of ["perfectoCookTier","perfectoAccountScenario","perfectoAccountFuel",
  "perfectoMaximumScenario","perfectoMaximumFuel","perfectoScenarioDifference",
  "perfectoMaxBoard","perfectoMaximumSummary","perfectoMaxPreparationSteps"]){
  assert.ok(html.includes('id="'+id+'"'),id);
  assert.ok(ui.includes('"'+id+'"'),"unwired UI ID: "+id);
 }
 assert.match(ui,/getPerfectoPlanner\(saved,\{tier:tierChoice,cookTier\}\)/);
 assert.match(ui,/proof\.windStages\?\.length/);
 assert.match(ui,/renderBoard\(result,maxP,"perfectoMaxBoard"\)/);
});

test("T46 maximum-case board has no lower-tier filler sushi",()=>{
 const save=exampleSave();
 save.sushi[5]=Array(64).fill(0);
 save.sushi[2][29]=1;
 save.slots=Array.from({length:120},(_,i)=>i<100?0:-1);
 save.tiles=Array(120).fill(-1);
 save.tiles[0]=63; // T64 is protected and may move for plate priority.
 const result=getPerfectoPlanner(save,{tier:62});
 const benchmark=result.comparisons.maximum;
 assert.equal(benchmark.search.sourceTier,46);
 assert.equal(benchmark.search.certificate.supportingMode,"direct-source");
 assert.equal(benchmark.plan.protected,1);
 assert.equal(benchmark.plan.copies,benchmark.search.targetCount);
 assert.ok(benchmark.plan.copies>0);
 const nonTarget=benchmark.plan.board.filter(cell=>cell.role==="ingredient");
 assert.ok(nonTarget.length>0,"benchmark should expose leftover construction workspace");
 assert.ok(nonTarget.every(cell=>cell.preparedTier===45),
  "every optional filler in the T46 benchmark is T46");
 assert.ok(!benchmark.plan.board.some(cell=>
  [43,44,45].includes(cell.preparedTier+1)),
  "never show T43-T45 as unnecessary T46 benchmark filler");
 const proof=benchmark.search.certificate;
 assert.equal(proof.supportingCount,nonTarget.length);
 assert.equal(BigInt(proof.totalCooksExact),
  BigInt(proof.cooksExact)+BigInt(proof.supportingCooksExact));
 assert.equal(proof.totalMergesExact,proof.mergesExact);
 const exactTarget=getPerfectoPlanner(save,{tier:46}).comparisons.maximum;
 assert.ok(exactTarget.plan.board.every(cell=>
  cell.slot<0||cell.role==="protected"||cell.preparedTier===45),
  "when targeting T46, the maximum benchmark uses only T46 and protected sushi");
});

test("Perfecto board comparison is side-by-side with responsive fallback",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../src/perfecto-ui.mjs",import.meta.url),"utf8");
 const wrapper=html.indexOf('class="perfecto-board-comparison"');
 const account=html.indexOf('id="perfectoBoard"',wrapper);
 const maximum=html.indexOf('id="perfectoMaxBoard"',wrapper);
 assert.ok(wrapper>=0&&account>wrapper&&maximum>account,
  "the two boards must be rendered inside the same comparison container");
 assert.match(css,/\.perfecto-board-comparison\s*\{\s*display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/@media\(max-width:1120px\)/);
 assert.ok(ui.includes('proof.supportingMode==="direct-source"'),
  "UI guide must explain directly cooked T46 leftovers");
 assert.ok(ui.includes("Target recipe Fuel:"),
  "UI must separate required recipe Fuel from optional fillers");
});
