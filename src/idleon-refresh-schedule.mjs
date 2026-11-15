// Timer and countdown for an in-memory Google-connected cloud save.
// All intervals are cancelled on Pause, Clear, manual JSON import and sign-out.
export const CLOUD_SAVE_REFRESH_INTERVAL_MS=5*60*1000;
export function formatRefreshCountdown(ms){
 const seconds=Math.max(0,Math.ceil(ms/1000));
 return Math.floor(seconds/60)+":"+String(seconds%60).padStart(2,"0");
}
export function startCloudSaveRefresh(onRefresh,{
 schedule=setInterval,cancel=clearInterval,now=Date.now,onTick=()=>{}
}={}){
 if(typeof onRefresh!=="function")throw new TypeError("Expected refresh callback");
 let stopped=false;
 let refreshAt=now()+CLOUD_SAVE_REFRESH_INTERVAL_MS;
 const update=()=>{if(!stopped)onTick(Math.max(0,refreshAt-now()));};
 const timer=schedule(()=>{
  if(stopped)return;
  refreshAt=now()+CLOUD_SAVE_REFRESH_INTERVAL_MS;
  onRefresh();
  update();
 },CLOUD_SAVE_REFRESH_INTERVAL_MS);
 const countdown=schedule(update,1000);
 update();
 return ()=>{
  if(stopped)return;
  stopped=true;
  cancel(timer);
  cancel(countdown);
 };
}
