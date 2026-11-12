// Constructive East Wind resource proof for cooking a target sushi tier.
// Wind-assisted 3-to-1 pair: [Tn,Tn,Tn] --merge 0->1--> [.,Tn+1,Tn+1]
// --merge 2->1--> [.,Tn+2,.]. Requires n<=windCap, 3 ingredients,
// two legal merges and one Wind upgrade; not a guaranteed timing strategy.
// Any remaining single-tier climbs use right-to-left ordinary merges.
// Recursion reserves one additional workspace cell per tier gained.
export function certifiedWindTierRecipe(sourceTier,targetTier,windCap=0){
 const source=Number(sourceTier),target=Number(targetTier),cap=Number(windCap);
 if(!Number.isInteger(source)||!Number.isInteger(target)||
    !Number.isInteger(cap)||source<1||target<source||target>64)
  throw Error("Invalid sushi cooking tier or Wind limit.");
 const stages=[];
 let tier=source,cooks=1n,merges=0n,windEvents=0n,workspaceSlots=1;
 while(tier<target){
  const useWind=tier+2<=target&&tier<=cap;
  const from=tier,to=tier+(useWind?2:1),factor=useWind?3n:2n;
  // Each new stage repeats the lower-tier recipe factor times.
  merges=merges*factor+(useWind?2n:1n);
  windEvents=windEvents*factor+(useWind?1n:0n);
  cooks*=factor;
  workspaceSlots+=useWind?2:1;
  stages.push({from,to,wind:useWind,ingredients:useWind?3:2,
   description:useWind?
    "Use three T"+from+": merge left to middle (Wind upgrades the third), then merge right to middle to get T"+to+".":
    "Merge two T"+from+" sushi from right to left to get T"+to+"."});
  tier=to;
 }
 if(merges!==cooks-1n)throw Error("Invalid Sushi construction: lost merge conservation.");
 return {
  sourceTier:source,targetTier:target,windCap:cap,
  cooksExact:cooks.toString(),mergesExact:merges.toString(),
  windEventsExact:windEvents.toString(),
  workspaceSlots,stages,usesWind:windEvents>0n
 };
}

export function certifiedWindCopyCapacity(unlocked,protectedCount,sourceTier,targetTier,windCap=0){
 const slots=Number(unlocked),protectedSushi=Number(protectedCount);
 if(!Number.isInteger(slots)||!Number.isInteger(protectedSushi)||
  slots<0||slots>100||protectedSushi<0||protectedSushi>slots)
  throw Error("Invalid Sushi slot count.");
 const plan=certifiedWindTierRecipe(sourceTier,targetTier,windCap);
 const flexible=slots-protectedSushi;
 return {workspaceSlots:plan.workspaceSlots,flexible,
  newCopies:Math.max(0,flexible-(plan.workspaceSlots-1)),
  cookPerCopy:plan.cooksExact,usesWind:plan.usesWind};
}
