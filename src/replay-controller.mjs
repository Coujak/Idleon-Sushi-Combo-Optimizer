// Drives an interactive replay without coupling timers to the DOM.
// Changing steps manually pauses playback, and dispose clears pending timers.
export function createReplayController({
  totalSteps,onStep,onPlayStateChange=()=>{},getDelay=()=>1700,
  schedule=setTimeout,cancel=clearTimeout
}){
  if(!Number.isInteger(totalSteps)||totalSteps<0)throw Error("Invalid replay length");
  let step=0,playing=false,timer=null,disposed=false;

  function clearPending(){
    if(timer!==null){cancel(timer);timer=null;}
  }
  function setPlaying(value){
    if(playing===value)return;
    playing=value;
    onPlayStateChange(playing);
  }
  function pause(){
    clearPending();
    setPlaying(false);
  }
  function display(next){
    if(!Number.isFinite(next))return;
    const clamped=Math.max(0,Math.min(totalSteps,Math.trunc(next)));
    if(clamped!==step){
      step=clamped;
      onStep(step);
    }
  }
  function tick(){
    timer=null;
    if(!playing||disposed)return;
    display(step+1);
    if(step>=totalSteps)pause();
    else arm();
  }
  function arm(){
    clearPending();
    if(!playing||disposed)return;
    const delay=Number(getDelay(step));
    timer=schedule(tick,Number.isFinite(delay)?Math.max(100,delay):1700);
  }
  function play(){
    if(disposed||playing||totalSteps===0)return;
    if(step>=totalSteps)display(0);
    setPlaying(true);
    if(step===0)display(1);
    if(step>=totalSteps)pause();
    else arm();
  }
  function goTo(next){
    if(disposed)return;
    pause();
    display(next);
  }
  function dispose(){
    pause();
    disposed=true;
  }

  return {
    play,pause,goTo,dispose,
    toggle(){if(playing)pause();else play();},
    reschedule(){if(playing)arm();},
    get step(){return step;},
    get playing(){return playing;}
  };
}
