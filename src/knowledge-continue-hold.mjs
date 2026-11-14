// Press-and-hold repeat for Knowledge refills. A regular click retains the
// existing 5% advance. Long press schedules the NEXT 5% advance only after
// the previous validated worker result has been committed.
// Release stops scheduling new work; the current in-flight batch can finish.
export function installKnowledgeContinueHold({
 button,canStart,trigger,onHoldingChange=()=>{},
 releaseTarget=document,blurTarget=window,
 delayMs=320,repeatDelayMs=80,
 schedule=setTimeout,cancel=clearTimeout
}={}){
 if(!button||typeof canStart!=="function"||typeof trigger!=="function")
  throw Error("Knowledge hold control needs a button and callbacks");
 let press=null,active=false,started=false,holdTimer=null,
  repeatTimer=null,suppressTrustedClick=false,disposed=false;
 const cancelTimer=timer=>{if(timer!==null)cancel(timer);};
 const clearTimers=()=>{
  cancelTimer(holdTimer);cancelTimer(repeatTimer);
  holdTimer=null;repeatTimer=null;
 };
 const stop=()=>{
  if(disposed)return;
  clearTimers();
  const wasActive=active;
  press=null;active=false;started=false;
  if(wasActive)onHoldingChange(false);
 };
 const begin=(identity)=>{
  if(disposed||press!==null||!canStart())return false;
  clearTimers();
  suppressTrustedClick=false;
  press=identity;started=false;
  holdTimer=schedule(()=>{
   holdTimer=null;
   if(disposed||press!==identity||!canStart())return;
   started=true;active=true;
   onHoldingChange(true);
   trigger();
  },delayMs);
  return true;
 };
 const finish=(identity)=>{
  if(disposed||press!==identity)return false;
  const wasStarted=started;
  stop();
  if(wasStarted)suppressTrustedClick=true;
  return wasStarted;
 };
 const onPointerDown=event=>{
  if(event.button!==0||event.isPrimary===false)return;
  begin("pointer:"+event.pointerId);
 };
 const onPointerUp=event=>finish("pointer:"+event.pointerId);
 const onPointerCancel=event=>finish("pointer:"+event.pointerId);
 // Keyboard hold works with Space/Enter; prevent native key-repeat clicks.
 const onKeyDown=event=>{
  if(event.key!==" "&&event.key!=="Enter")return;
  if(event.repeat&&press===("key:"+event.key)){event.preventDefault();return;}
  if(begin("key:"+event.key))event.preventDefault();
 };
 const onKeyUp=event=>{
  if(event.key!==" "&&event.key!=="Enter")return;
  if(press!==("key:"+event.key))return;
  event.preventDefault();
  const held=finish("key:"+event.key);
  if(!held&&canStart())trigger(); // ordinary short key press = one click
 };
 const onBlur=()=>stop();
 const onVisibility=()=>{
  if(releaseTarget.hidden)stop();
 };
 const onContextMenu=event=>{
  if(active)event.preventDefault();
 };
 button.addEventListener("pointerdown",onPointerDown);
 releaseTarget.addEventListener("pointerup",onPointerUp);
 releaseTarget.addEventListener("pointercancel",onPointerCancel);
 button.addEventListener("keydown",onKeyDown);
 releaseTarget.addEventListener("keyup",onKeyUp);
 blurTarget.addEventListener("blur",onBlur);
 releaseTarget.addEventListener("visibilitychange",onVisibility);
 button.addEventListener("contextmenu",onContextMenu);
 return {
  // The physical click after releasing a long pointer press must not start
  // an additional run. Synthetic clicks used for hold repeats still work.
  shouldIgnoreClick(event){
   if(suppressTrustedClick&&event?.isTrusted){
    suppressTrustedClick=false;
    return true;
   }
   return false;
  },
  afterCompletion(){
   if(!active||disposed||!canStart())return false;
   cancelTimer(repeatTimer);
   repeatTimer=schedule(()=>{
    repeatTimer=null;
    if(active&&!disposed&&canStart())trigger();
   },repeatDelayMs);
   return true;
  },
  stop,
  get holding(){return active;},
  dispose(){
   if(disposed)return;
   stop();disposed=true;
   button.removeEventListener("pointerdown",onPointerDown);
   releaseTarget.removeEventListener("pointerup",onPointerUp);
   releaseTarget.removeEventListener("pointercancel",onPointerCancel);
   button.removeEventListener("keydown",onKeyDown);
   releaseTarget.removeEventListener("keyup",onKeyUp);
   blurTarget.removeEventListener("blur",onBlur);
   releaseTarget.removeEventListener("visibilitychange",onVisibility);
   button.removeEventListener("contextmenu",onContextMenu);
  }
 };
}
