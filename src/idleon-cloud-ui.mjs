// Optional Idleon cloud-login interface. Does not replace manual JSON import.
import {createIdleonCloudClient,cloudLoginError,STEAM_LOGIN_URL}
 from "./idleon-cloud-auth.mjs?v=1.20.1";

const $=id=>document.getElementById(id);

export function initializeIdleonCloudUI({onSave,onDisconnect}){
 const client=createIdleonCloudClient();
 const openButton=$("idleonSteamOpen");
 const input=$("idleonSteamReturnUrl");
 const connectButton=$("idleonSteamConnect");
 const refreshButton=$("idleonCloudRefresh");
 const disconnectButton=$("idleonCloudDisconnect");
 const state=$("idleonCloudStatus");
 const problem=$("idleonCloudError");
 const details=$("idleonCloudDetails");
 let busy=false;

 function report(error){
  problem.textContent=cloudLoginError(error);
  problem.classList.remove("hidden");
 }
 function clearError(){
  problem.textContent="";
  problem.classList.add("hidden");
 }
 function update(connected=client.isConnected()){
  connectButton.disabled=busy||connected||!input.value.trim();
  refreshButton.disabled=busy||!connected;
  disconnectButton.disabled=busy||!connected;
  openButton.disabled=busy||connected;
  input.disabled=busy||connected;
  state.textContent=busy?"Connecting to Idleon…":
   connected?"Connected · Read-only":"Not connected";
  state.classList.toggle("success",!busy&&connected);
  details.textContent=connected?
   "Account connected in this tab. Refresh to read the latest cloud save.":
   "Steam login is experimental. Your manual JSON import remains available.";
 }
 async function act(fn){
  if(busy)return;
  busy=true;clearError();update();
  try{await fn();}
  catch(error){report(error);}
  finally{busy=false;update();}
 }
 openButton.addEventListener("click",()=>{
  clearError();
  window.open(STEAM_LOGIN_URL,"_blank","noopener,noreferrer");
 });
 input.addEventListener("input",()=>{clearError();update();});
 connectButton.addEventListener("click",()=>act(async()=>{
  // This Steam URL contains one-use signed values. Clear the visible field
  // before calling the official Idleon authentication endpoint.
  const returnUrl=input.value;
  input.value="";
  const data=await client.connectSteam(returnUrl);
  onSave(data,"Idleon cloud save",{mode:"cloud"});
 }));
 input.addEventListener("keydown",event=>{
  if(event.key==="Enter"&&!connectButton.disabled){
   event.preventDefault();connectButton.click();
  }
 });
 refreshButton.addEventListener("click",()=>act(async()=>{
  const data=await client.refresh();
  onSave(data,"Idleon cloud save (refreshed)",{mode:"cloud"});
 }));
 async function disconnect({clearData=true}={}){
  if(busy)return;
  busy=true;clearError();update();
  try{
   await client.disconnect();
   if(clearData)onDisconnect?.();
  }catch(error){report(error);}
  finally{busy=false;input.value="";update();}
 }
 disconnectButton.addEventListener("click",()=>disconnect());
 update(false);
 return {disconnect,isConnected:()=>client.isConnected()};
}
