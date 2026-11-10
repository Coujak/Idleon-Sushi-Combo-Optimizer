import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 perfectoSingleChance,perfectoBoardChance,perfectoAttemptsForConfidence,
 sushiDirectCookFuel,chooseNextPerfectoTier,availablePerfectoTargets,perfectoBoardPlan,getPerfectoPlanner
} from "../src/perfecto-planner.mjs";
import {getKnowledgeRows} from "../src/lab-model.mjs";
import {searchPerfectoBoard,verifyPerfectoSearch,getSushiWindCap} from "../src/perfecto-wind-search.mjs";
import {estimateSushiFuelEconomy,chooseFuelCookingTier} from "../src/perfecto-fuel.mjs";

function exampleSave(){
 const sushi=Array.from({length:8},()=>[]);
 sushi[2]=Array(46).fill(0);
 sushi[4]=[0,0,0,0,0,8,4,1]; // 8 Salt and 4 Pepper
 sushi[5]=Array(64).fill(-1);
 sushi[5][0]=1; // T1 already Perfecto
 sushi[5][1]=0; // T2 missing
 sushi[5][2]=0; // T3 missing
 sushi[5][49]=0; // T50 discovered
 sushi[5][53]=0; // T54 discovered
 sushi[6]=Array(64).fill(0);
 sushi[7]=Array(64).fill(0);
 sushi[7][49]=2;
 sushi[7][53]=3;
 const slots=Array.from({length:120},(_,i)=>i<12?0:-1);
 const tiles=Array(120).fill(-1);
 tiles[0]=15; // Higher-tier T16 preserved by default
 tiles[1]=1;  // Existing T2
 tiles[3]=0;  // T1 can be replaced
 return {sushi,slots,tiles,spelunk:Array.from({length:53},()=>[])};
}

test("IT / Corgan single-copy formula uses zero-based tier and category-10 knowledge",()=>{
 assert.equal(perfectoSingleChance(1),.6);
 const t10=.6*Math.pow(.81,9)/(1+9/8);
 assert.ok(Math.abs(perfectoSingleChance(10)-t10)<1e-15);
 assert.ok(Math.abs(perfectoSingleChance(10,100)-2*t10)<1e-14);
 assert.equal(perfectoSingleChance(1,10000),1); // probability cap
 assert.equal(perfectoSingleChance(0),0);
 assert.equal(perfectoSingleChance(65),0);
});
test("Combined Perfecto odds are a clearly assumed independent-roll projection",()=>{
 assert.ok(Math.abs(perfectoBoardChance(.6,2)-.84)<1e-12);
 assert.ok(Math.abs(perfectoBoardChance(.2,10)-(1-Math.pow(.8,10)))<1e-12);
 assert.equal(perfectoBoardChance(0,90),0);
 assert.equal(perfectoBoardChance(.3,0),0);
 assert.equal(perfectoBoardChance(1,100),1);
 assert.ok(perfectoBoardChance(.000001,100)>0);
 assert.equal(perfectoAttemptsForConfidence(.84,.5),1);
 assert.equal(perfectoAttemptsForConfidence(.84,.9),2);
 assert.equal(perfectoAttemptsForConfidence(.84,.99),3);
 assert.equal(perfectoAttemptsForConfidence(0,.9),null);
});
test("Ascending mode selects the lowest discovered tier not yet Perfecto",()=>{
 const save=exampleSave();
 assert.equal(chooseNextPerfectoTier(save),2);
 save.sushi[5][1]=1;
 assert.equal(chooseNextPerfectoTier(save),3);
 save.sushi[5][2]=1;
 save.sushi[5][49]=1;
 save.sushi[5][53]=1;
 assert.equal(chooseNextPerfectoTier(save),null);
 assert.equal(chooseNextPerfectoTier(null),null);
});
test("Search builds final target sushi through valid merges, not invented placement",()=>{
 const save=exampleSave();
 const p=getPerfectoPlanner(save,{tier:2,maxActions:120});
 assert.equal(p.plan.unlocked,12);
 assert.equal(p.plan.protected,1);
 assert.equal(p.plan.currentCopies,1);
 assert.ok(p.plan.copies>=1&&p.plan.copies<=11);
 assert.equal(p.plan.board.length,120);
 assert.equal(p.plan.board[0].role,"protected");
 assert.equal(p.plan.board[0].preparedTier,15);
 assert.equal(p.plan.board[1].role,"target");
 assert.equal(p.plan.board[1].preparedTier,1);
 assert.equal(p.plan.board[12].role,"locked");
 assert.equal(p.plan.copies,p.search.targetCount);
 assert.ok(verifyPerfectoSearch(save,2,p.search,p.search.windCap));
 const reduced=perfectoBoardPlan(save,2,{copies:Math.min(3,p.plan.copies),maxActions:120});
 assert.equal(reduced.copies,Math.min(3,p.plan.copies));
 assert.equal(reduced.board[0].role,"protected");
 const unprotected=perfectoBoardPlan(save,2,{protectHigher:false,maxActions:120});
 assert.equal(unprotected.protected,0);
 assert.ok(unprotected.eligible>=11);
});
test("Full planner includes knowledge bonuses, odds, Pepper count and no invented Salt rate",()=>{
 const save=exampleSave();
 const p=getPerfectoPlanner(save);
 assert.equal(p.target,2);
 assert.equal(p.preparation.saltAvailable,8);
 assert.equal(p.preparation.pepperAvailable,4);
 assert.equal(p.preparation.saltEstimate,0); // the deterministic search uses no Salt
 assert.equal(p.preparation.directCook,false);
 assert.ok(p.plan.copies>=1&&p.plan.copies<=11);
 assert.equal(p.bonus.rows.length,2);
 const k=getKnowledgeRows(save).filter(x=>x.category===10);
 assert.ok(Math.abs(p.bonus.knowledgeBonus-k.reduce((a,x)=>a+x.bonus,0))<1e-10);
 assert.ok(p.singleChance>0&&p.singleChance<=1);
 assert.ok(p.planChance>=p.currentChance);
 assert.equal(p.independenceAssumption,true);
 assert.equal(p.simulatedWind,true);
 assert.equal(p.freeUse.researchNotIncluded,true);
 assert.ok(p.milestones.every(x=>x.attempts>=1));
 const completed=getPerfectoPlanner(save,{tier:1});
 assert.equal(completed.recommendation.state,"completed");
 const manual=getPerfectoPlanner(save,{tier:50,copies:2});
 assert.equal(manual.target,50);
 assert.ok(manual.singleChance<1);
 assert.ok(manual.plan.copies<=2); // no invented copies for high-tier manual targets
 assert.equal(manual.plan.copies,Math.min(2,manual.search.targetCount));
 assert.equal(manual.current.name,"Soylent Nigiri");
 assert.equal(getPerfectoPlanner(save,{tier:4}).reason,"undiscovered");
});
test("Salt is optional when a tier can be cooked directly; higher tiers need merging",()=>{
 const save=exampleSave();
 save.sushi[2][6]=12; // Can direct-cook up to Tier 13
 const p=getPerfectoPlanner(save);
 assert.equal(p.preparation.directCook,true);
 assert.equal(p.preparation.saltEstimate,0);
 assert.ok(p.preparation.fuelPerCopy>0);
 assert.ok(p.preparation.minDirectCookFuel>=0);
 assert.equal(sushiDirectCookFuel(6),176);
 assert.equal(sushiDirectCookFuel(1),10);
 const high=getPerfectoPlanner(save,{tier:50});
 assert.equal(high.preparation.directCook,false);
 assert.equal(high.preparation.saltEstimate,0); // no Salt effects are assumed by this simulator
});
test("Perfecto UI is separate from Combo and connected to imported save refresh",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../src/perfecto-ui.mjs",import.meta.url),"utf8");
 const lab=readFileSync(new URL("../src/lab-ui.mjs",import.meta.url),"utf8");
 const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
 for(const name of ["perfectoPlanner","perfectoTarget","perfectoCopies","perfectoProtectHigher",
   "perfectoBoard","perfectoSingleChance","perfectoCurrentChance","perfectoPlanChance",
   "perfectoExpectedActivations","perfectoConfidence50","perfectoConfidence90",
   "perfectoConfidence99","perfectoSaltAdvice","perfectoBonusCards"]){
  assert.ok(html.includes('id="'+name+'"'),"missing UI "+name);
 }
 assert.ok(html.includes('data-planner-target="combo"'));
 assert.ok(html.includes('data-planner-target="perfecto"'));
 assert.ok(html.includes('id="solver"')); // Combo intact
 assert.ok(ui.includes("getPerfectoPlanner(saved"));
 assert.ok(lab.includes("perfectoUI.refresh()"));
 assert.ok(css.includes(".perfecto-tile.perfecto-target"));
});

test("Target selector offers only discovered and not-yet-Perfecto sushi",()=>{
 const save=exampleSave();
 assert.deepEqual(availablePerfectoTargets(save).map(row=>row.tier),[2,3,50,54]);
 assert.equal(availablePerfectoTargets(save).some(row=>row.tier===1),false);
 assert.deepEqual(availablePerfectoTargets(null),[]);
 save.sushi[5][2]=1;
 assert.deepEqual(availablePerfectoTargets(save).map(row=>row.tier),[2,50,54]);
 const ui=readFileSync(new URL("../src/perfecto-ui.mjs",import.meta.url),"utf8");
 assert.ok(ui.includes("available=availablePerfectoTargets(saved)"));
 assert.ok(ui.includes("for(const item of available)"));
 assert.ok(ui.includes('tierChoice="auto";'));
 assert.ok(!ui.includes("for(const item of SUSHI_KNOWLEDGE)"));
});

test("Fuel economy selects affordable tiers using capacity and regeneration",()=>{
 const save=exampleSave();
 const economy=estimateSushiFuelEconomy(save,{capacityOverride:3000,generationOverride:1800});
 assert.equal(economy.capacity,3000);
 assert.equal(economy.generationPerHour,1800);
 assert.equal(economy.manualCapacity,true);
 assert.equal(economy.manualGeneration,true);
 const source=chooseFuelCookingTier(economy,12,{hours:24,secondsPerCook:20});
 assert.ok(source.tier>=1&&source.tier<=12);
 assert.ok(source.cost<=3000);
 assert.ok(source.possibleCooks<=Math.floor(24*3600/20));
 assert.ok(source.possibleCooks<=Math.floor((economy.currentFuel+1800*24)/source.cost));
});
test("Wind cap is account-aware and the search preserves higher-tier sushi",()=>{
 const save=exampleSave();
 save.sushi[2][29]=1;
 save.sushi[5]=Array(64).fill(0);
 save.tiles[0]=63;
 assert.equal(getSushiWindCap(save),58);
 const economy=estimateSushiFuelEconomy(save,{capacityOverride:10000,generationOverride:20000});
 const result=searchPerfectoBoard(save,2,economy,{hours:24,secondsPerCook:20,maxActions:70});
 assert.equal(result.board[0],64);
 assert.equal(result.windCap,58);
 assert.ok(result.targetCount>=1&&result.targetCount<=11);
 assert.ok(result.purchased<=result.searchCookLimit);
 assert.ok(verifyPerfectoSearch(save,2,result,result.windCap));
});
test("Unreachable high target is not painted over the whole board",()=>{
 const save=exampleSave();
 save.sushi[5][61]=0;
 const p=getPerfectoPlanner(save,{tier:62,maxActions:65,hours:24});
 assert.equal(p.target,62);
 assert.equal(p.plan.currentCopies,0);
 assert.equal(p.plan.copies,0);
 assert.ok(p.plan.board.every(x=>x.role!=="target"));
 assert.equal(p.plan.board[0].role,"ingredient");
});
test("Percentage odds and 1 in X label are both rendered",()=>{
 const ui=readFileSync(new URL("../src/perfecto-ui.mjs",import.meta.url),"utf8");
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 assert.ok(ui.includes('text("perfectoPlanChance",pct(result.planChance))'));
 assert.ok(ui.includes('text("perfectoPlanOddsRatio",result.planChance>0?'));
 assert.ok(html.includes('id="perfectoPlanOddsRatio"'));
 assert.ok(html.includes('id="perfectoPlanChance"'));
});
