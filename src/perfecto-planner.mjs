// Sushi Station Perfecto Planner math and deterministic board preparation.
// Individual odds: Idleon Toolbox + Corgan (zero-based tier ID, fraction 0-1).
// Combining separate sushi rolls uses an explicit INDEPENDENCE ASSUMPTION;
// neither public parser validates independence of the actual Shaker rolls.
import {BOARD_CELLS} from "./board-geometry.mjs";
import {SUSHI_KNOWLEDGE} from "./sushi-reference.mjs";
import {getKnowledgeRows,getSushiSnapshot,getUpgradeRows} from "./lab-model.mjs";

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const finite=x=>Number.isFinite(Number(x))?Number(x):0;

export function perfectoSingleChance(tier,knowledgePct=0){
 const id=Number(tier)-1;
 if(!Number.isInteger(id)||id<0||id>=64)return 0;
 const result=.6*Math.pow(.81,id)/(1+id/8)*(1+Math.max(0,finite(knowledgePct))/100);
 return clamp(result,0,1);
}
export function perfectoBoardChance(singleChance,copies){
 const p=clamp(finite(singleChance),0,1);
 const n=Math.max(0,Math.floor(finite(copies)));
 if(n===0||p===0)return 0;
 if(p===1)return 1;
 return clamp(-Math.expm1(n*Math.log1p(-p)),0,1);
}
export function perfectoAttemptsForConfidence(chance,confidence){
 const q=clamp(finite(chance),0,1);
 const target=Number(confidence);
 if(!(target>0&&target<1)||q===0)return null;
 if(q===1)return 1;
 const n=Math.ceil(Math.log1p(-target)/Math.log1p(-q));
 return Number.isFinite(n)?Math.max(1,n):null;
}
export function sushiDirectCookFuel(tier){
 const zero=Number(tier)-1;
 if(!Number.isInteger(zero)||zero<0||zero>=64)return null;
 return zero===5?176:Math.max(0,10*Math.pow(1.83,zero)-zero*zero);
}
const normalizeSlots=(save)=>Array.from({length:BOARD_CELLS},(_,i)=>{
 const slot=Number(save?.slots?.[i]);
 const tile=Number(save?.tiles?.[i]);
 return {index:i,slot:save?.slots?.[i]===undefined?-1:(Number.isInteger(slot)?slot:-1),
  tile:save?.tiles?.[i]===undefined?-1:(Number.isInteger(tile)?tile:-1)};
});
export function availablePerfectoTargets(save){
 if(!save)return [];
 return getKnowledgeRows(save).filter(x=>x.discovered&&!x.perfecto);
}
export function chooseNextPerfectoTier(save){
 return availablePerfectoTargets(save)[0]?.tier??null;
}
export function perfectoBoardPlan(save,tier,{protectHigher=true,copies=null}={}){
 const id=Number(tier)-1;
 if(!save||!Number.isInteger(id)||id<0||id>=64)return null;
 const positions=normalizeSlots(save);
 const unlocked=positions.filter(cell=>cell.slot>=0);
 const eligible=unlocked.filter(cell=>!protectHigher||cell.tile<=id);
 const existing=eligible.filter(cell=>cell.tile===id).map(cell=>cell.index);
 const candidates=eligible.filter(cell=>cell.tile!==id);
 // Keep existing copies, then use empty Regular plates, then replace lower sushi.
 // Plate type has not been found to affect Pepper odds, so avoid moving plates.
 const priority=cell=>{
  const special=cell.slot===0?0:1;
  const classRank=cell.tile<0?0:cell.tile<id?1:2;
  return 3*classRank+special;
 };
 candidates.sort((a,b)=>priority(a)-priority(b)||a.index-b.index);
 const minCopies=existing.length?existing.length:eligible.length?1:0;
 const desired=copies===null||copies===undefined?eligible.length:
   clamp(Math.floor(finite(copies)),minCopies,eligible.length);
 const kept=existing.slice();
 const extra=candidates.slice(0,Math.max(0,desired-kept.length));
 const targets=new Set([...kept,...extra.map(x=>x.index)]);
 const board=positions.map(cell=>{
  if(cell.slot<0)return {...cell,role:"locked",preparedTier:null};
  if(targets.has(cell.index))return {...cell,role:"target",preparedTier:id};
  if(protectHigher&&cell.tile>id)return {...cell,role:"protected",preparedTier:cell.tile};
  return {...cell,role:"unchanged",preparedTier:cell.tile};
 });
 const newlyPrepared=extra.length;
 const replaced=extra.filter(cell=>cell.tile>=0).length;
 return {board,unlocked:unlocked.length,eligible:eligible.length,protected:unlocked.length-eligible.length,
  currentCopies:unlocked.filter(cell=>cell.tile===id).length,
  copies:targets.size,minCopies,additionalCopies:newlyPrepared,replaced,
  targetTier:id+1,changedPositions:extra.map(x=>x.index),positions:[...targets].sort((a,b)=>a-b)};
}
export function getPerfectoPlanner(save,{tier=null,copies=null,protectHigher=true}={}){
 const knowledge=getKnowledgeRows(save);
 const next=chooseNextPerfectoTier(save);
 const requested=Number(tier);
 const target=Number.isInteger(requested)&&requested>=1&&requested<=64?requested:next;
 const rows=knowledge.filter(x=>x.tier===50||x.tier===54);
 const knownBonus=rows.reduce((sum,row)=>sum+(row.bonus??0),0);
 const status={rows,knowledgeBonus:knownBonus,knowledgeMultiplier:1+knownBonus/100};
 if(!save||!target)return {target:null,next,bonus:status,reason:save?"complete":"import"};
 const current=knowledge[target-1];
 if(!current?.discovered)return {target:null,next,bonus:status,reason:"undiscovered"};
 const plan=perfectoBoardPlan(save,target,{protectHigher,copies});
 const snapshot=getSushiSnapshot(save);
 const rawChance=perfectoSingleChance(target,knownBonus);
 const currentChance=perfectoBoardChance(rawChance,plan?.currentCopies??0);
 const planChance=perfectoBoardChance(rawChance,plan?.copies??0);
 const avg=planChance>0?1/planChance:null;
 const upgrades=getUpgradeRows(save);
 const freeBottomless=upgrades.find(x=>x.id===21)?.rawBonus??0;
 const freeKnowledge=knowledge.filter(x=>x.category===5&&x.discovered).reduce((a,x)=>a+(x.bonus||0),0);
 const freeKnown=Math.min(.6,Math.max(0,(freeBottomless+freeKnowledge)/100));
 const maxCook=1+Math.max(0,Math.floor(finite(snapshot.levels[6])));
 const directCook=target<=maxCook;
 const fuelPerCopy=directCook?sushiDirectCookFuel(target):null;
 const currentStock=snapshot.shakers[1]??0;
 let recommendation;
 if(current.perfecto)recommendation={state:"completed",text:"This sushi is already Perfecto. Select another tier."};
 else if(!plan?.copies)recommendation={state:"blocked",text:"No usable positions. Unprotect higher-tier sushi or change the slot layout first."};
 else if(currentStock<=0)recommendation={state:"save",text:"No Pepper Shakers available. Prepare the board and save Pepper uses for your next attempt."};
 else if(plan.currentCopies===0||currentChance<planChance*.9)
  recommendation={state:"prepare",text:"Prepare more copies before spending Pepper Shakers. The recommended board offers better estimated odds."};
 else recommendation={state:"ready",text:"Your existing copies are close to the recommended odds. Pepper is reasonable to use now."};
 return {
  target,current,bonus:status,next,plan,snapshot,
  singleChance:rawChance,currentChance,planChance,
  expectedActivations:avg,
  milestones:[.5,.9,.99].map(p=>({confidence:p,attempts:perfectoAttemptsForConfidence(planChance,p)})),
  freeUse:{knownChance:freeKnown,knownFrom:["Bottomless Shakers","Sushi Knowledge"],
   researchNotIncluded:true,expectedConsumedUpperBound:avg===null?null:avg*(1-freeKnown)},
  preparation:{maxDirectCookTier:maxCook,directCook,fuelPerCopy,
   minDirectCookFuel:fuelPerCopy===null?null:fuelPerCopy*(plan?.additionalCopies??0),
   saltEstimate:directCook?0:null,saltVerified:false,
   saltAvailable:snapshot.shakers[0]??0,pepperAvailable:currentStock},
  recommendation,
  independenceAssumption:true
 };
}
