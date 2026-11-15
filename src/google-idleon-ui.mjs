// One-click Firebase Google sign-in, with five-minute cloud-save refresh.
// The Firebase session exists in browser memory only while this page is connected.
import {
 preloadIdleonPopup,signInAndFetchIdleonSave,refreshSignedInIdleonSave,
 endIdleonSession,describeIdleonPopupError
} from "./idleon-firebase-popup.mjs?v=1.0.2";
import {startCloudSaveRefresh} from "./idleon-refresh-schedule.mjs?v=1.0.0";

const $=id=>document.getElementById(id);

export function initializeGoogleIdleonUI(onSave){
 const button=$("googleIdleonConnect"),status=$("googleIdleonStatus");
 if(!button||!status)return {clear(){}};
 let ready=false,busy=false,connected=false,generation=0;
 let stopRefresh=()=>{};
 const update=(message,state="idle")=>{
  status.textContent=message;
  status.dataset.state=state;
  status.classList.toggle("hidden",state==="idle");
 };
 const resetRefresh=()=>{
  stopRefresh();
  stopRefresh=()=>{};
 };
 const sessionExpired=error=>/auth\/(?:requires-recent-login|user-token-expired|invalid-user-token|user-disabled)|PERMISSION_DENIED|UNAUTHENTICATED|403/.test(
  String(error?.code??error?.message??""));
 const setIdleButton=()=>{
  button.disabled=!ready||busy;
  button.textContent=connected?"Refresh Google save":"Sign in with Google";
 };

 async function refreshSave(){
  if(!connected||busy)return;
  const requestId=generation;
  busy=true;
  button.disabled=true;
  button.textContent="Refreshing…";
  update("Refreshing your Idleon cloud save…","busy");
  try{
   const save=await refreshSignedInIdleonSave();
   if(requestId!==generation)return;
   onSave(save,"Google cloud save");
   update("Cloud save updated · Automatically refreshes every 5 minutes while this tab is open.","ok");
  }catch(error){
   if(requestId!==generation)return;
   if(sessionExpired(error)){
    resetRefresh();
    connected=false;
    void endIdleonSession();
    update(describeIdleonPopupError(error),"error");
   }else{
    update("Cloud refresh failed; retrying in 5 minutes. "+describeIdleonPopupError(error),"error");
   }
  }finally{
   if(requestId===generation){
    busy=false;
    setIdleButton();
   }
  }
 }

 button.disabled=true;
 update("Preparing Google sign-in…","busy");
 preloadIdleonPopup().then(()=>{
  ready=true;
  setIdleButton();
  update("","idle");
 }).catch(error=>{
  ready=false;
  setIdleButton();
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
  update("Opening Google sign-in through Idleon's Firebase project…","busy");
  try{
   const save=await signInAndFetchIdleonSave();
   if(requestId!==generation){
    void endIdleonSession();
    return;
   }
   onSave(save,"Google cloud save");
   connected=true;
   resetRefresh();
   stopRefresh=startCloudSaveRefresh(()=>{void refreshSave();});
   update("Cloud save connected · Automatically refreshes every 5 minutes while this tab is open.","ok");
  }catch(error){
   if(requestId===generation)update(describeIdleonPopupError(error),"error");
  }finally{
   if(requestId===generation){
    busy=false;
    setIdleButton();
   }
  }
 });

 return {
  clear(){
   generation++;
   resetRefresh();
   connected=false;
   busy=false;
   void endIdleonSession();
   setIdleButton();
   update("","idle");
  }
 };
}
