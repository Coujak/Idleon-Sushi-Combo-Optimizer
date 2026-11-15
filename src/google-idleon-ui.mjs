// Experimental device-code sign-in. Google/Firebase credentials are never persisted.
// A matching OAuth device client must be configured and accepted by Firebase.
import {
 preloadIdleonPopup,signInWithDeviceIdTokenAndFetchIdleonSave,
 refreshSignedInIdleonSave,endIdleonSession,describeIdleonPopupError
} from "./idleon-firebase-popup.mjs?v=1.0.4";
import {
 requestGoogleDeviceCode,awaitGoogleDeviceApproval,validateDeviceOAuthConfig
} from "./idleon-device-code.mjs?v=1.0.0";
import {
 CLOUD_SAVE_REFRESH_INTERVAL_MS,formatRefreshCountdown,startCloudSaveRefresh
} from "./idleon-refresh-schedule.mjs?v=1.0.1";

const $=id=>document.getElementById(id);
export function initializeGoogleIdleonUI(onSave){
 const button=$("googleIdleonConnect"),status=$("googleIdleonStatus");
 const pauseButton=$("googleIdleonAutoRefreshToggle");
 const panel=$("googleIdleonDevicePanel"),setup=$("googleIdleonDeviceSetup");
 const approval=$("googleIdleonDeviceApproval"),start=$("googleIdleonDeviceStart");
 const close=$("googleIdleonDeviceClose"),copy=$("googleIdleonDeviceCopy");
 const clientInput=$("googleIdleonDeviceClientId");
 const secretInput=$("googleIdleonDeviceClientSecret");
 const code=$("googleIdleonDeviceCode"),waiting=$("googleIdleonDeviceWait");
 if(!button||!status||!panel||!setup||!approval||!start||!close||
    !clientInput||!secretInput||!code||!waiting)return {clear(){}};

 let ready=false,busy=false,connected=false,paused=false,generation=0;
 let remaining=CLOUD_SAVE_REFRESH_INTERVAL_MS,lastSaveVersion=null;
 let stopRefresh=()=>{},authorizationController=null;
 const versionOf=save=>save.updatedAt||JSON.stringify(save.data);

 const update=(message,state="idle")=>{
  status.textContent=message;
  status.dataset.state=state;
  status.classList.toggle("hidden",state==="idle");
 };
 const stopTimer=()=>{stopRefresh();stopRefresh=()=>{};};
 const stopAuthorization=()=>{
  authorizationController?.abort();
  authorizationController=null;
  clientInput.value=clientInput.defaultValue;
  secretInput.value="";
  code.textContent="";
  waiting.textContent="";
  approval.classList.add("hidden");
  setup.classList.remove("hidden");
  panel.classList.add("hidden");
 };
 const sessionExpired=error=>/auth\/(?:requires-recent-login|user-token-expired|invalid-user-token|user-disabled)|PERMISSION_DENIED|UNAUTHENTICATED|403|did not authorize access/i.test(
  String(error?.code??error?.message??""));
 const render=()=>{
  button.disabled=!ready||busy;
  if(!busy)button.textContent=connected?
   (paused?"Refresh Google save":"Refresh ("+formatRefreshCountdown(remaining)+")"):
   "Sign in with Google";
  if(pauseButton){
   pauseButton.classList.toggle("hidden",!connected);
   pauseButton.disabled=busy;
   pauseButton.textContent=paused?"Resume auto-refresh":"Pause auto-refresh";
  }
  start.disabled=busy;
 };
 function startTimer(){
  stopTimer();
  if(!connected||paused)return;
  remaining=CLOUD_SAVE_REFRESH_INTERVAL_MS;
  stopRefresh=startCloudSaveRefresh(()=>{void refreshSave();},{
   onTick:ms=>{remaining=ms;render();}
  });
 }
 async function refreshSave(){
  if(!connected||busy)return;
  const requestId=generation;
  busy=true;
  button.disabled=true;button.textContent="Refreshing…";
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
   }else update(paused?"Cloud save checked · No changes · Auto-refresh paused.":
    "Cloud save checked · No changes · Refreshes every 5 minutes.","ok");
  }catch(error){
   if(requestId!==generation)return;
   if(sessionExpired(error)){
    stopTimer();
    connected=false;paused=false;
    void endIdleonSession();
    update(describeIdleonPopupError(error),"error");
   }else update((paused?"Manual refresh failed. ":"Cloud refresh failed; retrying in 5 minutes. ")+
    describeIdleonPopupError(error),"error");
  }finally{
   if(requestId===generation){busy=false;render();}
  }
 }

 button.disabled=true;
 update("Preparing Firebase cloud access…","busy");
 preloadIdleonPopup().then(()=>{
  ready=true;render();update("","idle");
 }).catch(error=>{
  ready=false;render();
  update("Firebase cloud access could not load. "+describeIdleonPopupError(error),"error");
 });

 button.addEventListener("click",()=>{
  if(!ready||busy)return;
  if(connected){void refreshSave();return;}
  panel.classList.remove("hidden");
  update("","idle");
 });

 close.addEventListener("click",()=>{
  generation++;
  stopAuthorization();
  busy=false;
  render();
  if(!connected)update("Device sign-in canceled. JSON import remains available.","idle");
 });

 start.addEventListener("click",async()=>{
  if(!ready||busy||connected)return;
  const config={
   clientId:clientInput.value.trim(),clientSecret:secretInput.value.trim()
  };
  const verdict=validateDeviceOAuthConfig(config);
  if(!verdict.ready){
   update(verdict.reason,"error");
   return;
  }
  const requestId=++generation;
  authorizationController?.abort();
  const controller=new AbortController();
  authorizationController=controller;
  busy=true;
  render();
  update("Requesting a temporary code directly from Google…","busy");
  waiting.textContent="Waiting for Google approval…";
  try{
   const device=await requestGoogleDeviceCode(config,{signal:controller.signal});
   if(requestId!==generation)return;
   // Never keep the client secret in a DOM element after initiating sign-in.
   secretInput.value="";
   code.textContent=device.userCode;
   setup.classList.add("hidden");
   approval.classList.remove("hidden");
   update("Approve the code on google.com/device to continue.","busy");
   const googleIdToken=await awaitGoogleDeviceApproval(config,device,{
    signal:controller.signal,
    onProgress:({remainingMs})=>{
     if(requestId===generation)
      waiting.textContent="Waiting for approval · "+
       formatRefreshCountdown(remainingMs)+" before this code expires";
    }
   });
   if(requestId!==generation)return;
   waiting.textContent="Google approved · Connecting to Idleon Firebase…";
   update("Google approved. Checking Idleon's permission to load your save…","busy");
   const save=await signInWithDeviceIdTokenAndFetchIdleonSave(googleIdToken);
   if(requestId!==generation){void endIdleonSession();return;}
   onSave(save,"Google cloud save");
   lastSaveVersion=versionOf(save);
   connected=true;
   paused=false;
   stopAuthorization();
   startTimer();
   update("Cloud save connected · Automatically refreshes every 5 minutes.","ok");
  }catch(error){
   if(requestId!==generation)return;
   const message=error?.name==="DeviceAuthError"?
    error.message:describeIdleonPopupError(error);
   update(message,"error");
   setup.classList.remove("hidden");
   approval.classList.add("hidden");
   // Failure requires a fresh code; no token or client secret is cached.
   secretInput.value="";
   code.textContent="";
  }finally{
   if(requestId===generation){
    authorizationController=null;
    busy=false;
    render();
   }
  }
 });

 copy?.addEventListener("click",async()=>{
  const value=code.textContent;
  if(!value)return;
  try{
   await navigator.clipboard.writeText(value);
   copy.textContent="Copied";
  }catch{
   copy.textContent="Select code to copy";
  }
  // The label resets on the next sign-in attempt.
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
   stopAuthorization();
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
