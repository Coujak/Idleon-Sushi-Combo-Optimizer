// Active Sushi Knowledge EXP is earned by CREATE events (cook, merge, Wind).
// Keep a sparse history by tier so jumping to any replay step is fast, even
// for multi-thousand-action Focused previews and press-and-hold continuations.
// This tracks simulation values; only a real game measurement is "observed".
export function buildKnowledgeActiveExpHistory(frames,maxTier=64){
 if(!Array.isArray(frames)||!Number.isInteger(maxTier)||maxTier<1)
  throw Error("Knowledge EXP history requires a valid replay");
 const changes=Array.from({length:maxTier+1},()=>[]);
 const exp=Array(maxTier+1).fill(0);
 const creations=Array(maxTier+1).fill(0);
 for(let step=0;step<frames.length;step++){
  const frame=frames[step]??{};
  const gains=frame.gains??[];
  const counts=Array(maxTier+1).fill(0);
  for(const event of frame.events??[]){
   if(Number.isInteger(event.tier)&&event.tier>=1&&event.tier<=maxTier)
    counts[event.tier]++;
  }
  for(let tier=1;tier<=maxTier;tier++){
   const gain=Number(gains[tier]??0);
   if(!Number.isFinite(gain)||gain<0)
    throw Error("Invalid Knowledge EXP gain in replay at step "+step);
   if(gain===0&&counts[tier]===0)continue;
   exp[tier]+=gain;
   creations[tier]+=counts[tier];
   changes[tier].push({step,exp:exp[tier],creations:creations[tier]});
  }
 }
 const atStep=(tier,step)=>{
  if(!Number.isInteger(tier)||tier<1||tier>maxTier||
     !Number.isFinite(step)||step<0)return {exp:0,creations:0};
  const history=changes[tier];
  let lo=0,hi=history.length;
  while(lo<hi){
   const mid=(lo+hi)>>1;
   if(history[mid].step<=step)lo=mid+1;
   else hi=mid;
  }
  return lo?{exp:history[lo-1].exp,creations:history[lo-1].creations}:
   {exp:0,creations:0};
 };
 return {atStep,finalExp:exp,finalCreations:creations,changes};
}
