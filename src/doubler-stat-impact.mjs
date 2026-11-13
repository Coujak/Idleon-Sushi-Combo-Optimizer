// Account-effect previews for a Sushi Doubler. Flip only the selected
// Spelunk[52] assignment in two shallow-copied scenarios; keep every other
// upgrade, board tile and modifier exactly as found in the imported save.
// A preview is a what-if, not proof that an extra Doubler is available.
import {getUpgradeRows,getKnowledgeRows,sushiUpgradeDiscounts} from "./lab-model.mjs?v=1.19.11";
import {progressionGoalMetric} from "./progression-goal-impact.mjs?v=1.17.0";
import {formatGameQuantity,parseGameQuantity} from "./progression-calibration.mjs?v=1.17.0";

const finite=v=>typeof v==="number"&&Number.isFinite(v);
const pct=v=>finite(v)?v.toLocaleString("en-US",{maximumFractionDigits:2})+"%":"Unavailable";
const qualified=(value,suffix)=>finite(value)&&value>=0?
 formatGameQuantity(value)+suffix:"Unavailable";

function withDoubler(save,id,active){
 const spelunk=Array.isArray(save?.spelunk)?save.spelunk.slice():[];
 const existing=Array.isArray(spelunk[52])?spelunk[52].map(Number):[];
 // Do not remove any unrelated assignment, and do not invent one in the
 // player's actual data. Only copied what-if scenarios are modified.
 const other=existing.filter(x=>x!==id);
 spelunk[52]=active?[...other,id]:other;
 return {...save,spelunk};
}
function bonusById(save){
 const map=new Map(getUpgradeRows(save).map(u=>[u.id,u.rawBonus]));
 return id=>Math.max(0,map.get(id)??0);
}
function createdSushiKnowledgeExp(save){
 const get=bonusById(save);
 const knowledge=getKnowledgeRows(save).filter(k=>k.discovered&&k.category===1)
  .reduce((sum,k)=>sum+(finite(k.bonus)?k.bonus:0),0);
 // SushiStuff upgrade 37's panel formula is 1 + UpgradeQTY / 10,
 // multiplied by the known global Knowledge EXP bonuses.
 return (1+get(37)/10)*(1+(knowledge+get(38))/100);
}
function metric(save,goal){
 if(goal==="knowledge"){
  const value=createdSushiKnowledgeExp(save);
  return {value,label:"Knowledge EXP per created Sushi",
   display:qualified(value," EXP / Sushi"),estimated:true,
   note:"Partial model: newly created Sushi and known global Knowledge EXP bonuses. Plate, fireplace and other account modifiers are not included."};
 }
 if(goal==="perfecto"){
  const quantity=bonusById(save)(21);
  const value=Math.max(0,Math.min(100,quantity));
  return {value,label:"Free Shaker-use chance",
   display:pct(value),estimated:false,
   note:"This is the chance of a free Shaker use, not the chance that a Sushi becomes Perfecto. The effect also applies to non-Pepper Shakers."};
 }
 const m=progressionGoalMetric(save,goal);
 return {value:m.value,label:m.label,display:m.display,estimated:m.estimated,note:m.note};
}
const units={
 bucks:" Bucks/hr",fuel:" Fuel/hr",capacity:" Fuel"
};
const names={
 bucks:"Bucks per hour",fuel:"Fuel generation per hour",capacity:"Maximum Fuel",
 discount:"Upgrade price discount",knowledge:"Knowledge EXP per created Sushi",
 perfecto:"Free Shaker-use chance"
};
const incidental={
 bucks:{
  35:"Quickpay Fee generates instant Bucks when Sushi are created; it does not increase passive Bucks/hr.",
  22:"Sasaphrax Saffron affects Shaker Bucks rewards, not passive Bucks/hr."
 },
 fuel:{
  20:"Shake N' Bake adds Fuel when a Shaker is used; it does not increase passive Fuel/hr."
 }
};
// Action-only effects must not be ranked as 0% benefit just because they
// don't alter the passive hourly number displayed by the advisor.
const actionOnly={
 bucks:new Set([22,35]),
 fuel:new Set([20])
};
const fmtGain=value=>value.toLocaleString("en-US",{maximumFractionDigits:2});
function gainRanking(goal,upgrade,no,yes){
 if(upgrade.level<=0)return {gainScore:null,gainText:"Level this upgrade before doubling",gainRankable:false};
 if(actionOnly[goal]?.has(upgrade.id))return {
  gainScore:null,gainText:"Per-use benefit · not comparable by passive rate",gainRankable:false
 };
 if(!finite(no.value)||!finite(yes.value))return {
  gainScore:null,gainText:"No reliable modeled stat gain available",gainRankable:false
 };
 if(goal==="discount"){
  // Discounts multiply price factors. A gain of 10 percentage points in the
  // displayed discount is NOT the same as a 10% reduction of remaining cost.
  const before=Math.max(0,1-no.value/100);
  const after=Math.max(0,1-yes.value/100);
  if(before<=0)return {gainScore:0,gainText:"No further modeled price reduction",gainRankable:true};
  const savedPct=Math.max(0,(1-after/before)*100);
  return {gainScore:savedPct,gainText:"≈"+fmtGain(savedPct)+"% lower upgrade cost",gainRankable:true};
 }
 if(goal==="perfecto"){
  const points=Math.max(0,yes.value-no.value);
  return {gainScore:points,gainText:"+"+fmtGain(points)+" percentage points free-use chance",gainRankable:true};
 }
 if(no.value<=0){
  if(yes.value>0)return {gainScore:null,gainText:"Enables this stat · relative gain unavailable",gainRankable:false};
  return {gainScore:0,gainText:"No modeled increase in this stat",gainRankable:true};
 }
 const gain=Math.max(0,(yes.value/no.value-1)*100);
 return {gainScore:gain,gainText:"≈+"+fmtGain(gain)+"% "+names[goal],gainRankable:true};
}

export function getDoublerAccountImpact(save,upgrade,{readings={}}={}){
 if(!save||!upgrade||!Array.isArray(save.spelunk?.[52]))return null;
 const id=upgrade.id;
 // If an upgrade ever maps to several categories, display the same category
 // selected in the advisor rather than comparing unrelated totals.
 const goal=upgrade.goals?.[0];
 if(!goal||!Object.prototype.hasOwnProperty.call(names,goal))return null;
 const no=metric(withDoubler(save,id,false),goal);
 const yes=metric(withDoubler(save,id,true),goal);
 const baseline=metric(save,goal);
 let without=no.display,withDoublerDisplay=yes.display;
 let basis=no.estimated||yes.estimated?"Modeled / partial":"Modeled";
 let label=names[goal];
 const measured=units[goal]?parseGameQuantity(readings?.[goal]):null;
 if(measured!==null&&finite(baseline.value)&&baseline.value>0&&
  finite(no.value)&&finite(yes.value)){
  const valueWithout=measured*(no.value/baseline.value);
  const valueWith=measured*(yes.value/baseline.value);
  without=qualified(valueWithout,units[goal]);
  withDoublerDisplay=qualified(valueWith,units[goal]);
  basis="Anchored to in-game reading · projected";
 }else if(goal==="bucks"&&!String(no.label).includes("Bucks generation / hour")){
  // The raw JSON lacks a usable board. A multiplier is not Bucks/hr.
  label="Known passive Bucks multiplier";
  basis="Partial multiplier · Bucks/hr unavailable";
 }
 const extra=incidental[goal]?.[id];
 const note=(extra?extra+" ":"")+(measured!==null&&units[goal]?
  "Scaled from your entered current in-game rate using the modeled relative change. Other bonuses may affect the real result.":
  no.note);
 const ranking=gainRanking(goal,upgrade,no,yes);
 return {goal,label,basis,without,withDoubler:withDoublerDisplay,
  current:upgrade.doubled?withDoublerDisplay:without,note,
  currentSide:upgrade.doubled?"with":"without",...ranking};
}
