// Local, account-private optimizer research memory. No Idleon JSON is saved.
// History is keyed by game mechanics, board geometry, and scorer version;
// optimizer mode is intentionally excluded so Fast/Mid/Slow/Max share work.
const DATABASE="idleon-sushi-research";
const VERSION=1;
export const RESEARCH_RULES_VERSION="combo-search-v1";
let databasePromise;
const fallbackChecked=new Map();
const fallbackBest=new Map();

export function researchBoardKey(board){
 return board.join(",");
}
export function researchContext({maxTier,cap,chain,selectedBase,protectHighest,slots}){
 return JSON.stringify([RESEARCH_RULES_VERSION,maxTier,cap,chain,selectedBase,
  Boolean(protectHighest),slots]);
}
function openResearchDatabase(){
 if(!("indexedDB" in globalThis))return Promise.resolve(null);
 if(!databasePromise){
  databasePromise=new Promise(resolve=>{
   let request;
   try{request=indexedDB.open(DATABASE,VERSION);}
   catch{return resolve(null);}
   request.onupgradeneeded=()=>{
    const db=request.result;
    if(!db.objectStoreNames.contains("checked"))
     db.createObjectStore("checked");
    if(!db.objectStoreNames.contains("best"))
     db.createObjectStore("best");
   };
   request.onsuccess=()=>resolve(request.result);
   request.onerror=()=>resolve(null);
   request.onblocked=()=>resolve(null);
  });
 }
 return databasePromise;
}
function transactionResult(db,store,mode,operation){
 return new Promise((resolve,reject)=>{
  let tx;
  try{tx=db.transaction(store,mode);}
  catch(error){reject(error);return;}
  let result;
  tx.oncomplete=()=>resolve(result);
  tx.onerror=()=>reject(tx.error??new Error("Research database write failed"));
  tx.onabort=()=>reject(tx.error??new Error("Research database transaction aborted"));
  operation(tx.objectStore(store),value=>{result=value;});
 });
}
export async function loadResearchHistory(context){
 const db=await openResearchDatabase();
 if(!db)return {seen:new Set(fallbackChecked.get(context)??[]),
  best:fallbackBest.get(context)??null,persistent:false};
 try{
  const prefix=context+"|";
  const keys=await transactionResult(db,"checked","readonly",(store,done)=>{
   const request=store.getAllKeys(IDBKeyRange.bound(prefix,prefix+"\uffff"));
   request.onsuccess=()=>done(request.result);
  });
  const best=await transactionResult(db,"best","readonly",(store,done)=>{
   const request=store.get(context);
   request.onsuccess=()=>done(request.result??null);
  });
  return {seen:new Set(keys.map(key=>key.slice(prefix.length))),
   best,persistent:true};
 }catch{
  return {seen:new Set(fallbackChecked.get(context)??[]),
   best:fallbackBest.get(context)??null,persistent:false};
 }
}
export async function rememberEvaluatedBoards(evaluated){
 if(!evaluated.length)return;
 const db=await openResearchDatabase();
 if(db){
  try{
   await transactionResult(db,"checked","readwrite",store=>{
    for(const {context,key} of evaluated)store.put(1,context+"|"+key);
   });
   return;
  }catch{/* Keep an in-memory fallback if browser storage is blocked. */}
 }
 for(const {context,key} of evaluated){
  if(!fallbackChecked.has(context))fallbackChecked.set(context,new Set());
  fallbackChecked.get(context).add(key);
 }
}
export async function rememberBestCandidate(context,candidate){
 if(!context||!candidate?.search)return;
 const db=await openResearchDatabase();
 const record={...candidate,recordedAt:new Date().toISOString()};
 if(db){
  try{
   await transactionResult(db,"best","readwrite",(store,done)=>{
    const req=store.get(context);
    req.onsuccess=()=>{
     const previous=req.result;
     if(!previous||record.search.score>previous.search.score||
       (record.search.score===previous.search.score&&
        record.search.remaining<previous.search.remaining)){
      store.put(record,context);
     }
    };
   });
   return;
  }catch{/* In-memory fallback. */}
 }
 const current=fallbackBest.get(context);
 if(!current||record.search.score>current.search.score)
  fallbackBest.set(context,record);
}
export async function resetResearchHistory(){
 const db=await openResearchDatabase();
 fallbackChecked.clear();fallbackBest.clear();
 if(!db)return;
 await Promise.all(["checked","best"].map(name=>
  transactionResult(db,name,"readwrite",store=>store.clear())));
}


export async function exportResearchData(){
 const db=await openResearchDatabase();
 if(!db){
  return {format:"idleon-sushi-research",version:1,exportedAt:new Date().toISOString(),
   checked:[...fallbackChecked].flatMap(([context,keys])=>[...keys].map(key=>({context,key}))),
   best:[...fallbackBest].map(([context,candidate])=>({context,candidate}))};
 }
 const checked=await transactionResult(db,"checked","readonly",(store,done)=>{
  const req=store.getAllKeys();req.onsuccess=()=>done(req.result);
 });
 const best=await transactionResult(db,"best","readonly",(store,done)=>{
  const req=store.getAll();const keys=store.getAllKeys();
  let values=null,ids=null;
  const collect=()=>{if(values&&ids)done(ids.map((context,i)=>({context,candidate:values[i]})));};
  req.onsuccess=()=>{values=req.result;collect();};
  keys.onsuccess=()=>{ids=keys.result;collect();};
 });
 return {format:"idleon-sushi-research",version:1,exportedAt:new Date().toISOString(),
  checked:checked.map(raw=>{const cut=raw.lastIndexOf("|");
   return {context:raw.slice(0,cut),key:raw.slice(cut+1)};}),
  best};
}
export async function importResearchData(data,validateBest){
 if(data?.format!=="idleon-sushi-research"||data.version!==1||
  !Array.isArray(data.checked)||!Array.isArray(data.best))
  throw Error("Not an Idleon Sushi research history export");
 if(data.checked.length>500000||data.best.length>10000)
  throw Error("Research export is too large to safely import");
 const contextValid=context=>{
  if(typeof context!=="string"||context.length>2500)return false;
  try{const parts=JSON.parse(context);
   return Array.isArray(parts)&&parts.length===7&&
    parts[0]===RESEARCH_RULES_VERSION&&Array.isArray(parts[6])&&
    parts[6].length<=1000;
  }catch{return false;}
 };
 const boardValid=key=>typeof key==="string"&&key.length<7000&&
  /^\d+(,\d+)*$/.test(key);
 for(const {context,key} of data.checked){
  if(!contextValid(context)||!boardValid(key))
   throw Error("Research export contains an invalid board or settings");
 }
 // Treat uploaded scores as untrusted: validate each replay before saving it.
 const accepted=[];
 for(const entry of data.best){
  if(!contextValid(entry.context)||!entry.candidate||
   !validateBest(entry.context,entry.candidate))
   throw Error("Research export contains an invalid or incompatible winning replay");
  accepted.push(entry);
 }
 const chunk=1000;
 for(let i=0;i<data.checked.length;i+=chunk)
  await rememberEvaluatedBoards(data.checked.slice(i,i+chunk));
 for(const {context,candidate} of accepted)
  await rememberBestCandidate(context,candidate);
 return {checked:data.checked.length,best:accepted.length};
}
