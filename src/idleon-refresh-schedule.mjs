// A live Google-connected save is fetched at most once per five-minute window.
// The caller owns the session and must invoke stop() on manual import or Clear.
export const CLOUD_SAVE_REFRESH_INTERVAL_MS=5*60*1000;

export function startCloudSaveRefresh(onRefresh,{
 schedule=setInterval,cancel=clearInterval
}={}){
 if(typeof onRefresh!=="function")throw new TypeError("Expected refresh callback");
 const handle=schedule(onRefresh,CLOUD_SAVE_REFRESH_INTERVAL_MS);
 let stopped=false;
 return ()=>{
  if(stopped)return;
  stopped=true;
  cancel(handle);
 };
}
