// Run the two split search directions simultaneously, using dedicated
// browser threads. Only small batches are copied at once; the main thread
// remains responsive to score updates and cancellation.
export async function scanSplitDirectionsInParallel(candidates,settings,signal,onProgress){
 const {cap,chain,mode,maxTier}=settings;
 const byDirection={
  supply:candidates.filter(c=>c.splitDirection==="supply"),
  engine:candidates.filter(c=>c.splitDirection==="engine")
 };
 const active=new Set();
 const cancelJobs=[];
 const batchSize=5;
 const launch=(direction,items)=>new Promise((resolve,reject)=>{
  if(!items.length){resolve();return;}
  let worker=null,offset=0,settled=false;
  const cleanup=()=>{
   signal?.removeEventListener("abort",abort);
   if(worker){worker.terminate();active.delete(worker);worker=null;}
  };
  const finish=(error=null)=>{
   if(settled)return;
   settled=true;
   cleanup();
   if(error)reject(error);else resolve();
  };
  const abort=()=>{
   const error=new Error("Optimization cancelled");
   error.name="AbortError";
   finish(error);
  };
  const next=()=>{
   if(signal?.aborted){abort();return;}
   if(offset>=items.length){finish();return;}
   const batch=items.slice(offset,offset+batchSize);
   offset+=batch.length;
   try{worker.postMessage({type:"evaluate",candidates:batch,cap,chain,mode,maxTier});}
   catch(error){finish(error);}
  };
  cancelJobs.push(abort);
  try{
   worker=new Worker(new URL("./split-search-worker.mjs",import.meta.url),{type:"module"});
   active.add(worker);
   worker.onmessage=({data})=>{
    if(settled)return;
    if(data?.type==="error"){
     finish(new Error(direction+" search worker: "+data.message));return;
    }
    if(data?.type!=="progress")return;
    try{
     onProgress({direction,processed:data.processed,
      splitPercent:data.splitPercent,improved:data.improved});
    }catch(error){finish(error);return;}
    next();
   };
   worker.onerror=event=>{
    event.preventDefault?.();
    finish(new Error(direction+" search worker failed: "+(event.message??"unknown error")));
   };
   signal?.addEventListener("abort",abort,{once:true});
   next();
  }catch(error){finish(error);}
 });
 try{
  await Promise.all([launch("supply",byDirection.supply),
   launch("engine",byDirection.engine)]);
 }finally{
  // If either direction fails, terminate both before the caller handles it.
  for(const abort of cancelJobs)abort();
  for(const worker of active)worker.terminate();
 }
}
