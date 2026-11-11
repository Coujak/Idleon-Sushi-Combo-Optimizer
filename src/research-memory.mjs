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
