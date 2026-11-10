import {SUSHI_UPGRADES,SUSHI_KNOWLEDGE,KNOWLEDGE_CATEGORIES,ELIGIBLE_DOUBLERS} from "./sushi-reference.mjs";
export const ADVISOR_GOALS=[
 {id:"bucks",name:"Bucks generation"},
 {id:"capacity",name:"Fuel capacity"},
 {id:"fuel",name:"Fuel generation"},
 {id:"knowledge",name:"Knowledge EXP"},
 {id:"perfecto",name:"Perfecto hunting"},
 {id:"discount",name:"Cheaper upgrades"}
];
const num=x=>{const n=Number(x);return Number.isFinite(n)?n:0;};
export const numberText=(n)=>{
 if(!Number.isFinite(n))return "Too large to display";
 const abs=Math.abs(n);
 return abs>=1e12||abs>0&&abs<0.001?n.toExponential(3):
  n.toLocaleString("en-US",{maximumFractionDigits:abs<10?3:2});
};
export function getSushiSnapshot(save){
 const s=save?.sushi??[];
 const raw=s[4]??[], tracking=s[5]??[],upgrades=s[2]??[],xp=s[6]??[],knowledge=s[7]??[];
 const spelunk=save?.spelunk??[];
 const doubled=Array.isArray(spelunk[52])?spelunk[52].map(num).filter(Number.isInteger):[];
 return {levels:upgrades,tracking,xp,knowledge,doubled,
  fuel:num(raw[0]),bucks:num(raw[3]),bestCombo:num(raw[8]),shakers:[num(raw[5]),num(raw[6]),num(raw[7])],
  unlocked:save?.slots?.filter(t=>t>=0).length??0,
  occupied:save?.tiles?.filter(t=>t>=0).length??0,
  highest:Math.max(0,...(save?.tiles??[]).filter(t=>t>=0).map(t=>t+1)),
  perfectos:tracking.slice(0,64).filter(x=>num(x)>=1).length,
  discovered:tracking.slice(0,64).filter(x=>num(x)>=0).length,
  totalUpgrades:upgrades.reduce((a,v)=>a+num(v),0),
  totalKnowledge:knowledge.slice(0,64).reduce((a,v)=>a+num(v),0)};
}
export function baseUpgradeCost(entry,level){
 // Cost BEFORE bonuses, discounts, doublers, Jelly and other account effects.
 // The full game price also considers Wholesale Pricing, Knowledge, etc.
 const pos=entry.shop-1;
 const n=Math.max(0,num(level));
 return Math.max(.1,entry.costBase||1)*
   (5+pos+Math.pow(Math.max(0,pos-1),2))*
   Math.pow(1.5+Math.max(0,pos-3)/16,Math.max(0,pos-4))*
   Math.pow(1.3,Math.max(0,pos-20))*
   Math.pow(entry.costGrowth,n);
}
export function getUpgradeRows(save){
 const s=getSushiSnapshot(save);
 return SUSHI_UPGRADES.map(entry=>{
  const level=num(s.levels[entry.id]);
  const doubled=s.doubled.includes(entry.id);
  const atMax=entry.maxLevel===0||level>=entry.maxLevel;
  const rawBonus=level*entry.perLevel*(doubled?2:1);
  const increment=entry.perLevel*(doubled?2:1);
  return {...entry,level,doubled,atMax,rawBonus,increment,
   baseNextCost:atMax?null:baseUpgradeCost(entry,level)};
 });
}
export function getKnowledgeRows(save){
 const s=getSushiSnapshot(save);
 return SUSHI_KNOWLEDGE.map(entry=>{
  const index=entry.tier-1,level=num(s.knowledge[index]),track=num(s.tracking[index]??-1);
  const discovered=save!=null&&Number(s.tracking[index]??-1)>=0;
  const perfecto=discovered&&track>=1;
  const xp=num(s.xp[index]);
  const xpReq=(3+(level+Math.pow(level,1.5)))*Math.pow(1.5,Math.max(0,level-2));
  const factor=Math.min(2,1+Math.max(0,track));
  const mapped=Number.isInteger(entry.category)&&entry.category>=0&&entry.category<KNOWLEDGE_CATEGORIES.length;
  return {...entry,mapped,categoryName:mapped?KNOWLEDGE_CATEGORIES[entry.category]:"Effect not yet mapped",
   level,discovered,perfecto,xp,xpReq,
   bonus:mapped&&discovered?Math.max(0,entry.perLevel*level*factor*(1+index/30)):null,
   nextLevelGain:mapped?entry.perLevel*factor*(1+index/30):null};
 });
}
export function advisorUpgrades(save,goal){
 return getUpgradeRows(save).filter(u=>u.goals.includes(goal)&&u.maxLevel>0)
 .sort((a,b)=>Number(a.atMax)-Number(b.atMax)||a.baseNextCost-b.baseNextCost);
}
export function doublerUpgrades(save,goal){
 return getUpgradeRows(save).filter(u=>ELIGIBLE_DOUBLERS.includes(u.id)&&u.maxLevel>0&&
  (goal==="all"||u.goals.includes(goal))).sort((a,b)=>Number(b.doubled)-Number(a.doubled)||b.level-a.level);
}
