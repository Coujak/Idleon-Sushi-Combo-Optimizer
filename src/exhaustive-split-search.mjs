// Exhaustive, resumable enumeration of tier multisets for one split.
// Unlike sampled preparation profiles, every non-increasing tier assignment
// within the supplied tier domain is visited exactly once.
// IMPORTANT: this enumerates multisets, not all permutations or merge orders.
// The caller must handle board geometry, scoring and legal replay validation.
export function* enumerateTierMultisets(count,minTier,maxTier){
 if(!Number.isSafeInteger(count)||count<0||
  !Number.isSafeInteger(minTier)||!Number.isSafeInteger(maxTier)||
  minTier<1||maxTier<minTier)throw new RangeError("Invalid tier domain");
 const values=Array(count).fill(maxTier);
 if(count===0){yield [];return;}
 while(true){
  yield values.slice();
  let index=count-1;
  while(index>=0&&values[index]===minTier)index--;
  if(index<0)return;
  const next=values[index]-1;
  for(let i=index;i<count;i++)values[i]=next;
 }
}
export function* enumerateSplitTierBoards({
 positions,supplyCount,maxTier,minTier=1,protectedTier=null
}){
 if(!Array.isArray(positions)||positions.length<2||
  positions.some((p,i)=>!Number.isSafeInteger(p)||p<0||p>=120||
   i>0&&p!==positions[i-1]+1)||
  !Number.isSafeInteger(supplyCount)||supplyCount<1||
  supplyCount>=positions.length)throw new RangeError("Invalid split geometry");
 const anchorCount=protectedTier===null?0:1;
 if(anchorCount&&(!Number.isSafeInteger(protectedTier)||protectedTier<1||
  protectedTier>maxTier))throw new RangeError("Invalid protected tier");
 const supplySize=supplyCount-anchorCount;
 if(supplySize<0)throw new RangeError("No room for protected tier");
 const engineSize=positions.length-supplyCount;
 for(const supply of enumerateTierMultisets(supplySize,minTier,maxTier-anchorCount)){
  for(const engine of enumerateTierMultisets(engineSize,minTier,maxTier-anchorCount)){
   const board=Array(120).fill(0);
   const tiers=[...(anchorCount?[protectedTier]:[]),...supply,...engine];
   positions.forEach((p,i)=>{board[p]=tiers[i];});
   yield {board,supplyCount,engineCount:engineSize};
  }
 }
}
