// Lightweight read-only presentation helpers for Sushi Knowledge.
// All values come from the imported account model; never estimate EXP income.
export const KNOWLEDGE_SORT_OPTIONS=[
 {value:"tier",label:"Tier · low to high"},
 {value:"tier-desc",label:"Tier · high to low"},
 {value:"level-desc",label:"Knowledge level · high to low"},
 {value:"level-asc",label:"Knowledge level · low to high"},
 {value:"progress-desc",label:"EXP progress · high to low"},
 {value:"next",label:"Closest to next level"},
 {value:"next-desc",label:"Farthest from next level"},
 {value:"category",label:"Knowledge effect"},
 {value:"category-desc",label:"Knowledge effect · Z to A"}
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
  const search=(k.name+" "+k.tier+" t"+k.tier+" "+k.categoryName+" "+(k.tierReward??"")).toLowerCase();
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
 // Unknown numbers always go last, including for descending sorts.
 const knownLevel=k=>k.discovered&&k.levelKnown?k.level:null;
 const numeric=(a,b,extract,descending=false)=>{
  const left=extract(a),right=extract(b);
  if(left===null||right===null)return Number(left===null)-Number(right===null)||difference(a,b);
  return (descending?right-left:left-right)||difference(a,b);
 };
 const compare={
  "tier":difference,
  "tier-desc":(a,b)=>b.tier-a.tier,
  "level-desc":(a,b)=>numeric(a,b,knownLevel,true),
  "level-asc":(a,b)=>numeric(a,b,knownLevel),
  "progress-desc":(a,b)=>(b.xpProgress??-1)-(a.xpProgress??-1)||difference(a,b),
  "next":(a,b)=>numeric(a,b,k=>k.xpRemaining),
  "next-desc":(a,b)=>numeric(a,b,k=>k.xpRemaining,true),
  "category":(a,b)=>a.categoryName.localeCompare(b.categoryName)||difference(a,b),
  "category-desc":(a,b)=>b.categoryName.localeCompare(a.categoryName)||difference(a,b)
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

 
// UI-only preferences. Never persist the account save or the modeled Knowledge rows.
export const KNOWLEDGE_PREFERENCES_KEY="idleon-sushi-knowledge-ui-v1";
export function normalizeKnowledgePreferences(raw){
 const state=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw:{};
 const validSort=KNOWLEDGE_SORT_OPTIONS.some(x=>x.value===state.sort);
 const validStatus=KNOWLEDGE_STATUS_OPTIONS.some(x=>x.value===state.status);
 const category=String(state.category??"all");
 return {
  search:typeof state.search==="string"?state.search.slice(0,120):"",
  category:category==="all"||/^(?:[0-9]|10)$/.test(category)?category:"all",
  status:validStatus?state.status:"all",
  sort:validSort?state.sort:"tier"
 };
}

// Column header clicks toggle direction; selecting a different column uses its default.
export function nextKnowledgeHeaderSort(current,primary,reverse){
 return current===primary?reverse:primary;
}

// Every five levels is a *planning checkpoint*, not a special in-game payout.
// Surface only upcoming checkpoints, without cluttering every row.
export function knowledgeCheckpoint(row){
 if(!row?.discovered||!row.levelKnown||!Number.isSafeInteger(row.level)||row.level<0)return null;
 const nextLevel=(Math.floor(row.level/5)+1)*5;
 const levelsAway=nextLevel-row.level;
 return levelsAway>=1&&levelsAway<=2?{nextLevel,levelsAway}:null;
}
