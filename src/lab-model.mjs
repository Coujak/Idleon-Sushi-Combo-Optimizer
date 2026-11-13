import {SUSHI_UPGRADES,SUSHI_KNOWLEDGE,KNOWLEDGE_CATEGORIES,ELIGIBLE_DOUBLERS} from "./sushi-reference.mjs?v=1.16.6";
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
 return abs>=1e12||abs>0&&abs<0.001?n.toExponential(3).replace(/e\+?/i,"E"):
  n.toLocaleString("en-US",{maximumFractionDigits:abs<10?3:2});
};
// Research Grid: Shakin' It (I3) is the 189th grid square (zero-based
// index 188) in Research[0]. Each level gives +1 daily use to ALL shakers,
// in addition to their base +1/day. Keep missing research distinct from Lv 0.
export function getShakerDailyUses(save){
 const level=save?.research?.[0]?.[188];
 const n=level===undefined||level===null||level===""?NaN:Number(level);
 if(!Number.isInteger(n)||n<0||n>2)
  return {total:null,base:1,bonus:null,known:false};
 return {total:1+n,base:1,bonus:n,known:true};
}
export function getSushiSnapshot(save){
 const s=save?.sushi??[];
 const raw=s[4]??[], tracking=s[5]??[],upgrades=s[2]??[],xp=s[6]??[],knowledge=s[7]??[];
 const spelunk=save?.spelunk??[];
 const doubled=Array.isArray(spelunk[52])?spelunk[52].map(num).filter(Number.isInteger):[];
 // Sushi[0] stores zero-based sushi IDs. Count only actual copies of
 // the highest tier currently present, not the highest discovered tier.
 const board=Array.isArray(save?.tiles)?save.tiles:[];
 const highest=board.reduce((top,id)=>
  Number.isInteger(id)&&id>=0?Math.max(top,id+1):top,0);
 const highestCopies=highest===0?0:board.filter(id=>id===highest-1).length;
 return {levels:upgrades,tracking,xp,knowledge,doubled,
  fuel:num(raw[0]),bucks:num(raw[3]),bestCombo:num(raw[8]),shakers:[num(raw[5]),num(raw[6]),num(raw[7])],
  shakerDaily:getShakerDailyUses(save),
  unlocked:save?.slots?.filter(t=>t>=0).length??0,
  occupied:save?.tiles?.filter(t=>t>=0).length??0,
  highest,highestCopies,
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
// Compare a Sushi upgrade's next discounted cost with the imported Bucks balance.
// Missing discount sources can only lower the quoted price: a positive
// affordability result remains safe, but a negative one is uncertain.
export function upgradeAffordability(upgrade,bucks){
 if(!upgrade||upgrade.atMax||upgrade.maxLevel===0)return "unavailable";
 if(!Number.isFinite(bucks)||bucks<0||
    !Number.isFinite(upgrade.estimatedNextCost)||upgrade.estimatedNextCost<0)return "unknown";
 if(bucks>=upgrade.estimatedNextCost)return "affordable";
 return upgrade.costBreakdown?.complete?"unaffordable":"uncertain";
}
// Pinned from Idleon Toolbox's SushiStuff.UpgCost: all four discounts stack.
export function sushiUpgradeDiscounts(save){
 if(!save)return {sources:[],known:0,total:4,complete:false,factor:1};
 const sources=[],levels=save.sushi?.[2],tracking=save.sushi?.[5];
 if(Array.isArray(levels)){
  const qty=(Number(levels[36])||0)*(save.spelunk?.[52]?.some(id=>Number(id)===36)?2:1);
  sources.push({name:"Wholesale Pricing",percent:qty,factor:1/(1+qty/100),known:true});
 }else sources.push({name:"Wholesale Pricing",known:false});
 if(Array.isArray(tracking)&&tracking.length>=64){
  let unique=0;for(const value of tracking){if(Number(value)<0)break;unique++;}
  const pct=unique>44?50:unique>26?25:0;
  sources.push({name:"Sushi discovery bonuses",percent:pct,factor:Math.max(.1,1-pct/100),known:true});
 }else sources.push({name:"Sushi discovery bonuses",known:false});
 if(Array.isArray(save.sushi?.[7])&&save.sushi[7].length>=64&&Array.isArray(tracking)&&tracking.length>=64){
  const pct=getKnowledgeRows(save).filter(x=>x.discovered&&x.category===6)
    .reduce((total,x)=>total+x.bonus,0);
  sources.push({name:"Sushi Knowledge discount",percent:pct,factor:1/(1+pct/100),known:true});
 }else sources.push({name:"Sushi Knowledge discount",known:false});
 const n=save.research?.[7]?.[9];
 if(n!==undefined&&n!==null&&Number.isFinite(Number(n))){
  const pct=Number(n)>18?25:0;
  sources.push({name:"Jelly Operator obstruction bonus",percent:pct,factor:1/(1+pct/100),known:true});
 }else sources.push({name:"Jelly Operator obstruction bonus",known:false});
 const known=sources.filter(x=>x.known).length;
 return {sources,known,total:4,complete:known===4,
  factor:sources.reduce((acc,x)=>acc*(x.known?x.factor:1),1)};
}
export function sushiUpgradeExtraText(upgrade,save){
 if(!save||!upgrade)return null;
 const idx=upgrade.id,qty=upgrade.rawBonus,raw=save.sushi??[],levels=raw[2]??[];
 const fmt=numberText,multi=pct=>fmt(1+pct/100)+"×";
 if([2,3,4,5,9,10,11,12].includes(idx))
  return Number.isFinite(Number(levels[idx]))?multi(Number(levels[idx])):null;
 if(idx===6)return fmt(Math.round(qty)+1);
 if(idx===22)return fmt(Math.round(1+qty));
 if(idx===29){
  const track=raw[5];if(!Array.isArray(track))return null;
  let unique=0;for(const v of track.slice(0,64)){if(Number(v)<0)break;unique++;}
  return fmt(Math.max(0,unique-6));
 }
 if(idx===36)return fmt(100*(1-1/(1+qty/100)))+"%";
 if(idx===37)return fmt(1+qty/10);
 const knowledge=Array.isArray(raw[5])&&raw[5].length>=64&&
  Array.isArray(raw[7])&&raw[7].length>=64?getKnowledgeRows(save):null;
 const slot=knowledge?1+knowledge.filter(x=>x.discovered&&x.category===8)
  .reduce((a,x)=>a+x.bonus,0)/100:null;
 const sparks=raw[4]?.[2],spark=Number(sparks);
 const sparkMulti=Number.isFinite(spark)&&spark>0?
  .2*Math.log2(spark)+Math.log10(spark):0;
 const fireplace=knowledge&&sparks!==undefined&&Number.isFinite(spark)?
  (1+knowledge.filter(x=>x.discovered&&x.category===9).reduce((a,x)=>a+x.bonus,0)/100)
  *(1+sparkMulti/100):null;
 if(idx===14)return slot===null?null:multi(50*slot);
 if(idx===15)return slot===null?null:fmt(.2*slot);
 if(idx===16)return slot===null?null:fmt(slot);
 if(idx===26)return fireplace===null?null:multi(100*fireplace);
 if(idx===27)return fireplace===null?null:multi(150*fireplace);
 if(idx===25)return sparks===undefined||!Number.isFinite(spark)?null:
  fmt(spark)+" Sparks. This boosts all Fireplace bonuses by "+multi(sparkMulti);
 if(idx===28){
  const v=Number(raw[4]?.[1]);
  if(raw[4]?.[1]===undefined||!Number.isFinite(v))return null;
  const pct=v>1e6?5*Math.log2(v/1e6)+10*Math.log10(v/1e6):0;
  return fmt(v)+" Overtuned Fuel. This boosts all Bucks gained by "+multi(pct);
 }
 return null;
}
export function getUpgradeRows(save){
 const s=getSushiSnapshot(save);
 const discounts=sushiUpgradeDiscounts(save);
 return SUSHI_UPGRADES.map(entry=>{
  const level=num(s.levels[entry.id]);
  const doubled=s.doubled.includes(entry.id);
  const atMax=entry.maxLevel===0||level>=entry.maxLevel;
  const rawBonus=level*entry.perLevel*(doubled?2:1);
  const increment=entry.perLevel*(doubled?2:1);
  const baseNextCost=atMax?null:baseUpgradeCost(entry,level);
  return {...entry,level,doubled,atMax,rawBonus,increment,baseNextCost,
   estimatedNextCost:atMax?null:baseNextCost*discounts.factor,costBreakdown:discounts};
 });
}
export function getKnowledgeRows(save){
 const s=getSushiSnapshot(save);
 return SUSHI_KNOWLEDGE.map(entry=>{
  const index=entry.tier-1,level=num(s.knowledge[index]),track=num(s.tracking[index]??-1);
  const discovered=save!=null&&Number(s.tracking[index]??-1)>=0;
  const perfecto=discovered&&track>=1;
  const xpValue=save?.sushi?.[6]?.[index];
  const levelValue=save?.sushi?.[7]?.[index];
  const xpKnown=xpValue!==undefined&&xpValue!==null&&xpValue!==""&&
   Number.isFinite(Number(xpValue))&&Number(xpValue)>=0;
  const levelKnown=levelValue!==undefined&&levelValue!==null&&levelValue!==""&&
   Number.isFinite(Number(levelValue))&&Number(levelValue)>=0;
  const xp=xpKnown?Number(xpValue):null;
  const xpReq=levelKnown?(3+(level+Math.pow(level,1.5)))*
   Math.pow(1.5,Math.max(0,level-2)):null;
  const hasXpProgress=discovered&&xpKnown&&levelKnown&&Number.isFinite(xpReq)&&xpReq>0;
  const xpProgress=hasXpProgress?Math.max(0,Math.min(1,xp/xpReq)):null;
  const xpRemaining=hasXpProgress?Math.max(0,xpReq-xp):null;
  const readyToLevel=hasXpProgress&&xp>=xpReq;
  const factor=Math.min(2,1+Math.max(0,track));
  const mapped=Number.isInteger(entry.category)&&entry.category>=0&&entry.category<KNOWLEDGE_CATEGORIES.length;
  return {...entry,mapped,categoryName:mapped?KNOWLEDGE_CATEGORIES[entry.category]:"Effect not yet mapped",
   level,levelKnown,discovered,perfecto,xp,xpKnown,xpReq,xpProgress,xpRemaining,readyToLevel,
   bonus:mapped&&discovered&&levelKnown?Math.max(0,entry.perLevel*level*factor*(1+index/30)):null,
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

// Menagerie[3][10] grants one Sushi Doubler per boost level (research[58][10]=1).
// Bundle and companion grants are outside this minimal raw Sushi/Spelunk model.
// Distinguish verified totals from guaranteed base-only lower bounds.
export function getSushiDoublerCounts(save){
 if(!save)return {used:null,owned:null,available:null,exact:false,baseOwned:null};
 const assignments=save.spelunk?.[52];
 const used=Array.isArray(assignments)?assignments.length:null;
 const official=save.sushiDoublerInfo;
 const exactOwned=Number(official?.owned);
 if(official&&official.owned!=null&&Number.isFinite(exactOwned)&&exactOwned>=0){
  const owned=Math.round(exactOwned);
  const count=used??(Number.isFinite(Number(official?.left))
   ?Math.max(0,owned-Number(official.left)):null);
  return {used:count,owned,available:count===null?null:Math.max(0,owned-count),exact:true,baseOwned:null};
 }
 const boost=save.menagerie?.[3]?.[10];
 const baseOwned=boost===undefined||boost===null?null:Number(boost);
 if(!Number.isFinite(baseOwned)||baseOwned<0)
  return {used,owned:null,available:null,exact:false,baseOwned:null};
 const base=Math.round(baseOwned);
 return {used,owned:null,available:used===null?null:Math.max(0,base-used),exact:false,baseOwned:base};
}
