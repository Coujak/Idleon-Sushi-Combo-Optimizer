// Account-aware Knowledge EXP rotation. All position claims refer to the
// imported board; preparation instructions NEVER mutate or magically replace Sushi.
const CELLS=120,COLS=15;
const normalizeSlots=save=>Array.from({length:CELLS},(_,i)=>{
 const n=Number(save?.slots?.[i]);
 return Number.isInteger(n)&&n>=0&&n<=3?n:-1;
});
const normalizeTiles=save=>Array.from({length:CELLS},(_,i)=>{
 const n=Number(save?.tiles?.[i]);
 return Number.isInteger(n)&&n>=0&&n<64?n+1:0;
});
const level=(save,id)=>{
 const n=Number(save?.sushi?.[2]?.[id]);
 return Number.isFinite(n)&&n>0?n:0;
};
const unique=a=>[...new Set(a)];
const positions=(a,pred)=>a.flatMap((v,i)=>pred(v,i)?[i]:[]);
const positive=x=>Number.isInteger(x)&&x>=1&&x<=64;
export const KNOWLEDGE_ROTATION_MODES=[
 {value:"balanced",label:"Balanced · distribute EXP"},
 {value:"focused",label:"Focused · one Sushi tier"}
];
export function normalizeKnowledgeRotationOptions(raw){
 const obj=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw:{};
 const mode=obj.mode==="focused"?"focused":"balanced";
 const tier=Number(obj.targetTier);
 return {mode,targetTier:positive(tier)?tier:null};
}
export function positionLabel(index){
 return "R"+(Math.floor(index/COLS)+1)+"C"+(index%COLS+1);
}
export function buildKnowledgeRotation(save,knowledgeRows,rawOptions={}){
 const {mode,targetTier}=normalizeKnowledgeRotationOptions(rawOptions);
 const available=Array.isArray(knowledgeRows)?
  knowledgeRows.filter(k=>k&&positive(k.tier)&&k.discovered).sort((a,b)=>a.tier-b.tier):[];
 const slots=normalizeSlots(save),tiles=normalizeTiles(save);
 const counts={unlocked:slots.filter(v=>v>=0).length,
  milktoast:slots.filter(v=>v===3).length,cold:slots.filter(v=>v===2).length};
 const fires=Array.from({length:COLS},(_,i)=>{
  const raw=save?.fires?.[i],n=Number(raw);
  return raw!==undefined&&raw!==null&&Number.isInteger(n)&&n>=0&&n<=4?n:-1;
 });
 const hasMittens=level(save,42)>0;
 const hasSeared=level(save,13)>0;
 const hasLithium=level(save,26)>0;
 const hasWind=level(save,29)>0;
 const milkPositions=positions(slots,v=>v===3);
 const coldPositions=positions(slots,v=>v===2);
 const maxOnBoard=Math.max(0,...tiles);
 const selected=available.find(r=>r.tier===targetTier)??available[0]??null;
 const possibleFocus=selected?.tier??null;
 const suggestedColdTier=maxOnBoard>0?maxOnBoard:null;
 const coldActive=coldPositions.filter(i=>tiles[i]>0);
 const coldAtHighest=coldPositions.filter(i=>tiles[i]===maxOnBoard&&maxOnBoard>0);
 const makeTarget=row=>{
  const occupied=positions(tiles,(tier,i)=>slots[i]>=0&&tier===row.tier);
  const onMilktoast=occupied.filter(i=>slots[i]===3);
  const eligibleCold=coldPositions.filter(i=>tiles[i]>row.tier);
  return {tier:row.tier,name:row.name,level:row.level,
   xp:row.xp,xpReq:row.xpReq,xpRemaining:row.xpRemaining,
   xpProgress:row.xpProgress,readyToLevel:!!row.readyToLevel,
   occupiedPositions:occupied,milktoastPositions:onMilktoast,
   coldSourcePositions:eligibleCold,
   needsCreation:occupied.length===0,
   needsMilktoastPreparation:milkPositions.length>0&&onMilktoast.length===0,
   valueKnown:row.levelKnown&&row.xpKnown};
 };
 const createPhase=(index,targets,kind)=>{
  const columns=unique(milkPositions.slice(0,targets.length).map(i=>i%COLS))
   .filter(i=>fires[i]>=0);
  const slotPairs=targets.map((t,j)=>({
   tier:t.tier,name:t.name,
   platePosition:milkPositions[j]??null,
   existingPosition:t.occupiedPositions[0]??null,
   alreadyOnPlate:t.milktoastPositions.includes(milkPositions[j]),
   onAnyMilktoast:t.milktoastPositions.length>0
  }));
  return {index:index+1,kind,targets,slotPairs,columns,
   readyCount:targets.filter(t=>t.occupiedPositions.length>0).length,
   milkReadyCount:slotPairs.filter(p=>p.onAnyMilktoast).length};
 };
 let phases=[];
 if(mode==="focused"&&selected){
  const one=makeTarget(selected);
  // Focused uses a repeatable three-stage loop, not arbitrary equal EXP phases.
  phases=[
   createPhase(0,[one],"Prepare the target"),
   createPhase(1,[one],"Create the target repeatedly"),
   createPhase(2,[one],"Maintain passive EXP")
  ];
 }else if(mode==="balanced"){
  // One exposure per discovered tier per complete cycle. When Milktoast
  // plates exist, each wave has at most one tier per owned Milktoast plate.
  // Without Milktoast, use compact four-tier active creation waves.
  const batchSize=milkPositions.length||Math.min(4,Math.max(1,counts.unlocked));
  const every=available.map(makeTarget);
  for(let i=0;i<every.length;i+=batchSize)
   phases.push(createPhase(phases.length,every.slice(i,i+batchSize),"Balanced wave"));
 }
 const selectedTarget=mode==="focused"?selected:null;
 return {mode,selectedTier:possibleFocus,selectedTarget,
  available,counts,hasMittens,hasSeared,hasLithium,hasWind,
  fires,slots,tiles,positions:{milktoast:milkPositions,cold:coldPositions,
   coldOccupied:coldActive,coldHighest:coldAtHighest},
  highestOnBoard:maxOnBoard,suggestedColdTier,phases,
  // Cold sources must hold a tier strictly ABOVE their recipient. Milktoast
  // sources benefit their occupant; Lithium affects Sushi above its column.
  guidance:{
   passive:milkPositions.length>0||coldPositions.length>0,
   coldBenefitsFocus:possibleFocus!==null&&coldActive.some(i=>tiles[i]>possibleFocus),
   pinkColumns:unique(milkPositions.map(i=>i%COLS)).filter(i=>fires[i]>=0),
   alreadyPink:positions(fires,v=>v===3)
  }};
}
