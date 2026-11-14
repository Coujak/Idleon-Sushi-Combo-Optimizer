// Conservative, scenario-scoped first-refill fuel safety.
// The user should not be asked to cook 100 T46 merely because each individual
// T46 technically fits within the Fuel cap.
// No invented current-Fuel balance: assume one precharged full tank and
// reserve half of it for later refills. If the imported current Fuel is known,
// show it separately rather than silently substituting it for capacity.
export function estimateKnowledgeRefillFuel(frames,{
 capacity,generationPerHour,secondsPerCook=2,reserveFraction=0.5
}={}){
 const max=Number(capacity),rate=Number(generationPerHour),seconds=Number(secondsPerCook);
 if(!(max>0)||!(rate>0)||!(seconds>0))throw Error("Invalid Fuel economy");
 const index=frames.findIndex(f=>f.kind==="refill");
 if(index<0)return {cooks:0,fuel:0,noWait:false,excessFuel:0,
  estimatedWaitSeconds:0,reason:"No refill found"};
 let count=0,fuel=0,highest=0,last=index;
 for(let i=index+1;i<frames.length&&frames[i].kind==="cook";i++){
  const f=frames[i];
  count++;
  last=i;
  fuel+=Number(f.cookFuel??0);
  highest=Math.max(highest,Number(f.requestedTier??0));
 }
 // Cap buffer: spend no more than half the storage tank plus the Fuel
 // generated naturally while performing these cooks. The spare half of the
 // tank is reserved; the result is a planning safety budget, not a true
 // simulation of minute-by-minute in-game regeneration.
 const reserve=Math.max(0,Math.min(1,Number(reserveFraction)));
 const budget=max*reserve+rate*count*seconds/3600;
 const excess=Math.max(0,fuel-budget);
 return {cooks:count,fuel,capacity:max,generationPerHour:rate,
  highestRequestedTier:highest,budget,noWait:count>0&&excess<=Math.max(1,budget*1e-9),
  excessFuel:excess,estimatedWaitSeconds:excess*3600/rate,
  refillIndex:index,preparedIndex:last,reserveFraction:reserve,
  reason:count===0?"No Sushi were cooked":"A refill would require extra Fuel regeneration"};
}
