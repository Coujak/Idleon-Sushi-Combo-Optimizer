// Lightweight read-only presentation helpers for Sushi Knowledge.
// All values come from the imported account model; never estimate EXP income.
export const KNOWLEDGE_SORT_OPTIONS=[
 {value:"tier",label:"Tier · low to high"},
 {value:"tier-desc",label:"Tier · high to low"},
 {value:"level-desc",label:"Knowledge level · high to low"},
 {value:"progress-desc",label:"EXP progress · high to low"},
 {value:"next",label:"Closest to next level"},
 {value:"category",label:"Knowledge effect"}
];
export const KNOWLEDGE_STATUS_OPTIONS=[
 {value:"all",label:"All tiers"},
 {value:"ready",label:"Ready to level"},
 {value:"discovered",label:"Discovered"},
 {value:"unfinished",label:"Not Perfecto"},
 {value:"perfecto",label:"Perfecto"},
 {value:"undiscovered",label:"Undiscovered"}
];

export function filterKnowledgeRows(rows,{query="",category="all",status="all",sort="tier"}={}){
 const q=String(query).trim().toLowerCase();
 const selected=String(category);
 const filtered=rows.filter(k=>{
  const search=(k.name+" "+k.tier+" t"+k.tier+" "+k.categoryName).toLowerCase();
  if(q&&!search.includes(q))return false;
  if(selected!=="all"&&String(k.category)!==selected)return false;
  if(status==="ready"&&!k.readyToLevel)return false;
  if(status==="discovered"&&!k.discovered)return false;
  if(status==="unfinished"&&(!k.discovered||k.perfecto))return false;
  if(status==="perfecto"&&!k.perfecto)return false;
  if(status==="undiscovered"&&k.discovered)return false;
  return true;
 });
 const difference=(a,b)=>a.tier-b.tier;
 const compare={
  "tier":difference,
  "tier-desc":(a,b)=>b.tier-a.tier,
  "level-desc":(a,b)=>Number(b.discovered&&b.levelKnown?b.level:-1)-
   Number(a.discovered&&a.levelKnown?a.level:-1)||difference(a,b),
  "progress-desc":(a,b)=>(b.xpProgress??-1)-(a.xpProgress??-1)||difference(a,b),
  "next":(a,b)=>(a.xpRemaining??Infinity)-(b.xpRemaining??Infinity)||difference(a,b),
  "category":(a,b)=>a.categoryName.localeCompare(b.categoryName)||difference(a,b)
 }[sort]??difference;
 return filtered.sort(compare);
}

export function knowledgeOverview(rows,hasSave=false){
 if(!hasSave)return {hasSave:false,discovered:null,perfectos:null,totalLevels:null,
  ready:null,tracked:null,categoryTotals:[]};
 const available=rows.filter(k=>k.discovered);
 const knownLevels=available.filter(k=>k.levelKnown);
 const knownProgress=available.filter(k=>k.xpProgress!==null);
 const grouped=new Map();
 for(const k of available){
  if(!k.mapped||k.bonus===null)continue;
  const prev=grouped.get(k.category)??{id:k.category,label:k.categoryName,
   total:0,tiers:0,perfectos:0};
  prev.total+=k.bonus;prev.tiers++;
  prev.perfectos+=Number(k.perfecto);
  grouped.set(k.category,prev);
 }
 return {hasSave:true,discovered:available.length,perfectos:available.filter(k=>k.perfecto).length,
  totalLevels:knownLevels.length?knownLevels.reduce((sum,k)=>sum+k.level,0):null,
  ready:knownProgress.length?knownProgress.filter(k=>k.readyToLevel).length:null,
  tracked:knownProgress.length,
  categoryTotals:[...grouped.values()].sort((a,b)=>a.id-b.id)};
}
