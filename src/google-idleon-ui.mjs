// One-click, short-lived Firebase popup test for the development branch.
// No OAuth client configuration, passwords, or tokens are stored.
import {
 preloadIdleonPopup,signInAndFetchIdleonSave,describeIdleonPopupError
} from "./idleon-firebase-popup.mjs?v=1.0.1";

const $=id=>document.getElementById(id);

export function initializeGoogleIdleonUI(onSave){
 const button=$("googleIdleonConnect"),status=$("googleIdleonStatus");
 if(!button||!status)return {clear(){}};
 let ready=false,busy=false,generation=0;
 const update=(message,state="idle")=>{
  status.textContent=message;
  status.dataset.state=state;
 };
 button.disabled=true;
 update("Preparing Google's sign-in library…");
 preloadIdleonPopup().then(()=>{
  ready=true;button.disabled=false;
  update("Ready for a one-click sign-in test. Idleon may reject requests from this website.");
 }).catch(error=>{
  ready=false;button.disabled=true;
  update("Google sign-in library could not load. "+describeIdleonPopupError(error),"error");
 });

 button.addEventListener("click",async()=>{
  if(!ready||busy)return;
  const requestId=++generation;
  busy=true;button.disabled=true;
  button.textContent="Signing in…";
  update("Opening Google sign-in through Idleon's Firebase project…","busy");
  try{
   const save=await signInAndFetchIdleonSave();
   if(requestId!==generation)return;
   onSave(save,"Google cloud save");
   update("Idleon cloud save loaded successfully. Sign-in credentials were discarded.","ok");
  }catch(error){
   if(requestId===generation)update(describeIdleonPopupError(error),"error");
  }finally{
   if(requestId===generation){
    busy=false;button.disabled=!ready;
    button.textContent="Try Google sign-in";
   }
  }
 });
 return {
  clear(){
   generation++;
   busy=false;button.disabled=!ready;
   button.textContent="Try Google sign-in";
   update(ready?"Ready for another sign-in attempt. No account credentials are stored.":
    "Google sign-in is unavailable until the library loads.");
  }
 };
}
