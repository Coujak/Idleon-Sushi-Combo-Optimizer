// Timing for the Sushi Station replay's pick-up, slide, and reveal phases.
// Pure calculations let playback speed, Wind stagger and reduced-motion
// behavior be regression-tested separately from the DOM.
export function replayMotionTiming(move,speed=1,{reducedMotion=false}={}){
 const rate=Number(speed);
 const safeRate=Number.isFinite(rate)&&rate>0?Math.max(.25,Math.min(8,rate)):1;
 const windCount=Array.isArray(move?.events)?
  move.events.filter(event=>event.kind==="wind").length:0;
 if(reducedMotion){
  return {travelMs:0,windMs:0,windStaggerMs:0,windTileMs:0,
   settleMs:0,delayMs:Math.max(300,Math.round(900/safeRate))};
 }
 const travelMs=Math.round(720/safeRate);
 const windStaggerMs=65/safeRate,windTileMs=650/safeRate;
 const windMs=windCount?(windCount-1)*windStaggerMs+windTileMs:0;
 const settleMs=Math.round(480/safeRate);
 // Always leave enough time to see the destination after the flying sushi
 // lands, and let the final Wind upgrade finish before autoplay advances.
 const delayMs=Math.max(350,Math.ceil(travelMs+
  Math.max(windMs,420/safeRate)+settleMs));
 return {travelMs,windMs,windStaggerMs,windTileMs,settleMs,delayMs};
}
