// Google sign-in and Corgan-style five-minute cloud save refresh.
// OAuth/Firebase tokens stay in memory only while this tab is connected.
import {
 preloadIdleonPopup,signInAndFetchIdleonSave,refreshSignedInIdleonSave,
 endIdleonSession,describeIdleonPopupError
} from "./idleon-firebase-popup.mjs?v=1.0.3";
import {
 CLOUD_SAVE_REFRESH_INTERVAL_MS,formatRefreshCountdown,startCloudSaveRefresh
} from "./idleon-refresh-schedule.mjs?v=1.0.1";

const $=id=>document.getElementById(id);

export function initializeGoogleIdleonUI(onSave){
 const button=$("googleIdleonConnect"),status=$("googleIdleonStatus");
 const pauseButton=$("googleIdleonAutoRefreshToggle");
 if(!button||!status)return {clear(){}};

 let ready=false,busy=false,connected=false,paused=false,generation=0;
 let remaining=CLOUD_SAVE_REFRESH_INTERVAL_MS;
 let lastSaveVersion=null;
 const versionOf=save=>save.updatedAt||JSON.stringify(save.data);
 let stopRefresh=()=>{};

 const update=(message,state="idle")=>{
  status.textContent=message;
  status.dataset.state=state;
  status.classList.toggle("hidden",state==="idle");
 };
 const stopTimer=()=>{
  stopRefresh();
  stopRefresh=()=>{};
 };
 const sessionExpired=error=>/auth\/(?:requires-recent-login|user-token-expired|invalid-user-token|user-disabled)|PERMISSION_DENIED|UNAUTHENTICATED|403|did not authorize access/i.test(
  String(error?.code??error?.message??""));
 const render=()=>{
  button.disabled=!ready||busy;
  if(!busy){
   button.textContent=connected?
    (paused?"Refresh Google save":"Refresh ("+formatRefreshCountdown(remaining)+")"):
    "Sign in with Google";
  }
  if(pauseButton){
   pauseButton.classList.toggle("hidden",!connected);
   pauseButton.disabled=busy;
   pauseButton.textContent=paused?"Resume auto-refresh":"Pause auto-refresh";
  }
 };
 function startTimer(){
  stopTimer();
  if(!connected||paused)return;
  remaining=CLOUD_SAVE_REFRESH_INTERVAL_MS;
  stopRefresh=startCloudSaveRefresh(()=>{void refreshSave();},{
   onTick:ms=>{
    remaining=ms;
    render();
   }
  });
 }

 async function refreshSave(){
  if(!connected||busy)return;
  const requestId=generation;
  busy=true;
  button.disabled=true;
  button.textContent="Refreshing…";
  render();
  update("Refreshing your Idleon cloud save…","busy");
  try{
   const save=await refreshSignedInIdleonSave();
   if(requestId!==generation)return;
   const version=versionOf(save);
   if(version!==lastSaveVersion){
    onSave(save,"Google cloud save");
    lastSaveVersion=version;
    update(paused?"Cloud save updated · Auto-refresh paused.":
     "Cloud save updated · Automatically refreshes every 5 minutes.","ok");
   }else{
    update(paused?"Cloud save checked · No changes · Auto-refresh paused.":
     "Cloud save checked · No changes · Refreshes every 5 minutes.","ok");
   }
  }catch(error){
   if(requestId!==generation)return;
   if(sessionExpired(error)){
    stopTimer();
    connected=false;
    paused=false;
    void endIdleonSession();
    update(describeIdleonPopupError(error),"error");
   }else{
    update((paused?"Manual refresh failed. ":"Cloud refresh failed; retrying in 5 minutes. ")+
     describeIdleonPopupError(error),"error");
   }
  }finally{
   if(requestId===generation){
    busy=false;
    render();
   }
  }
 }

 button.disabled=true;
 update("Preparing Google sign-in…","busy");
 preloadIdleonPopup().then(()=>{
  ready=true;
  render();
  update("","idle");
 }).catch(error=>{
  ready=false;
  render();
  update("Google sign-in could not load. "+describeIdleonPopupError(error),"error");
 });

 button.addEventListener("click",async()=>{
  if(!ready||busy)return;
  if(connected){
   await refreshSave();
   return;
  }
  const requestId=++generation;
  busy=true;
  button.disabled=true;
  button.textContent="Signing in…";
  render();
  update("Opening Google sign-in through Idleon's Firebase project…","busy");
  try{
   const save=await signInAndFetchIdleonSave();
   if(requestId!==generation){
    void endIdleonSession();
    return;
   }
   onSave(save,"Google cloud save");
   lastSaveVersion=versionOf(save);
   connected=true;
   paused=false;
   startTimer();
   update("Cloud save connected · Automatically refreshes every 5 minutes.","ok");
  }catch(error){
   if(requestId===generation)update(describeIdleonPopupError(error),"error");
  }finally{
   if(requestId===generation){
    busy=false;
    render();
   }
  }
 });
 pauseButton?.addEventListener("click",()=>{
  if(!connected||busy)return;
  paused=!paused;
  if(paused){
   stopTimer();
   update("Google save connected · Auto-refresh paused. Use Refresh to update now.","ok");
  }else{
   startTimer();
   update("Google save connected · Auto-refresh resumed every 5 minutes.","ok");
  }
  render();
 });

 return {
  clear(){
   generation++;
   stopTimer();
   connected=false;
   paused=false;
   busy=false;
   remaining=CLOUD_SAVE_REFRESH_INTERVAL_MS;
   lastSaveVersion=null;
   void endIdleonSession();
   render();
   update("","idle");
  }
 };
}
