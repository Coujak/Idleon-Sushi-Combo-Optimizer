// Optional Google account -> Idleon cloud save import UI.
// This is an explicit, one-shot browser action; tokens never enter storage.
import {GOOGLE_IDLEON_CONFIG} from "./google-idleon-config.mjs?v=1.0.0";
import {validateGoogleImportConfig,importGoogleIdleonSave} from "./google-idleon-import.mjs?v=1.0.0";
const $=id=>document.getElementById(id);
const GIS_URL="https://accounts.google.com/gsi/client";
let scriptPromise=null;
function loadGoogleLibrary(){
 if(window.google?.accounts?.oauth2?.initTokenClient)return Promise.resolve();
 if(scriptPromise)return scriptPromise;
 scriptPromise=new Promise((resolve,reject)=>{
  const script=document.createElement("script");
  script.src=GIS_URL;script.async=true;
  script.onload=()=>window.google?.accounts?.oauth2?.initTokenClient?resolve():reject(Error("Google sign-in library is unavailable."));
  script.onerror=()=>reject(Error("Unable to load Google's sign-in library."));
  document.head.append(script);
 }).catch(error=>{scriptPromise=null;throw error;});
 return scriptPromise;
}
export function initializeGoogleIdleonUI(onSave){
 const button=$("googleIdleonConnect"),status=$("googleIdleonStatus");
 const panel=$("googleIdleonPanel");
 if(!button||!status||!panel)return {clear(){}};
 const config=GOOGLE_IDLEON_CONFIG;
 const ready=validateGoogleImportConfig(config);
 let busy=false,generation=0,googleReady=false;
 const setStatus=(message,state="")=>{
  status.textContent=message;
  status.dataset.state=state;
 };
 if(!ready.ready){
  button.disabled=true;
  setStatus("Development preview not configured. "+ready.reason+" Continue using JSON import.","idle");
 }else{
  setStatus("Experimental — sign in using the Google account linked to your Idleon save. Your game data stays in this browser.","idle");
  loadGoogleLibrary().then(()=>{googleReady=true;}).catch(error=>setStatus(error.message,"error"));
 }
 function clear(){
  generation++;
  busy=false;
  button.disabled=!ready.ready;
  button.textContent="Connect with Google";
  if(ready.ready)setStatus("Ready for a new one-time Google import. No session is stored.","idle");
 }
 button.addEventListener("click",()=>{
  if(busy||!ready.ready)return;
  if(!googleReady){
   setStatus("Google's sign-in library is still loading; click Connect again shortly.","idle");
   loadGoogleLibrary().then(()=>{googleReady=true;setStatus("Google sign-in is ready.","idle");})
    .catch(error=>setStatus(error.message,"error"));
   return;
  }
  let tokenClient;
  const requestId=++generation;
  try{
   tokenClient=window.google.accounts.oauth2.initTokenClient({
    client_id:ready.clientId,
    scope:"openid email profile",
    callback:async response=>{
     if(requestId!==generation)return;
     if(!response?.access_token){
      setStatus(response?.error?"Google authorization did not complete. Try again.":"No Google credential returned.","error");
      return;
     }
     busy=true;button.disabled=true;button.textContent="Loading Idleon save…";
     setStatus("Google authorization succeeded; checking Idleon Firebase access…","busy");
     try{
      const save=await importGoogleIdleonSave(response.access_token,config);
      if(requestId!==generation)return;
      onSave(save,"Google cloud save");
      setStatus("Sushi Station save imported from Idleon cloud. No access tokens were saved.","ok");
     }catch(error){
      if(requestId===generation)setStatus(error?.message??"Unable to import cloud save.","error");
     }finally{
      if(requestId===generation){
       busy=false;button.disabled=false;button.textContent="Connect / refresh Google save";
      }
     }
    },
    error_callback:()=>{
     if(requestId===generation)setStatus("Google sign-in was canceled or couldn't open. Manual JSON import is still available.","error");
    }
   });
   // Must be initiated by the actual user's click so the popup is not blocked.
   tokenClient.requestAccessToken({prompt:"select_account"});
  }catch(error){
   if(requestId===generation)setStatus("Google sign-in could not start. Check OAuth client and approved site origin.","error");
  }
 });
 return {clear};
}
