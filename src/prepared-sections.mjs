// Explanation overlays for tested Experimental preparations only.
// These boundaries describe the candidate that actually won the search,
// not the selected optimizer mode (which can reuse earlier candidates).
// Values are zero-based indices into the 100 unlocked, contiguous sushi positions:
// the first engine sushi is at this index; the protected top-tier anchor is index 0.
export const FIRST_ENGINE_INDEX=Object.freeze({
  2:30,3:30,4:30,5:30,6:33,7:31,8:31,9:29,
  10:26,11:24,12:24,13:24
});

export function hasSlotLayoutChanges(currentSlots,recommendedSlots){
  return !Array.isArray(currentSlots)||!Array.isArray(recommendedSlots)||
    currentSlots.length!==recommendedSlots.length||
    currentSlots.some((type,index)=>type!==recommendedSlots[index]);
}

export function getPreparedBoardSections(candidate,slots){
  const match=/^Experimental (\d+)\.0(?:\s|·)/.exec(candidate?.name??"");
  const experiment=match?Number(match[1]):0;
  const firstEngineIndex=FIRST_ENGINE_INDEX[experiment];
  if(!firstEngineIndex||!Array.isArray(candidate?.board)||candidate.board.length!==120||
    !Array.isArray(slots)||slots.length!==120)return null;
  const positions=slots.flatMap((slot,index)=>slot>=0?[index]:[]);
  if(positions.length!==100||positions.some((pos,index)=>index>0&&pos!==positions[index-1]+1))return null;
  const tiers=positions.map(pos=>candidate.board[pos]);
  if(tiers[0]!==64||tiers.some(tier=>!Number.isInteger(tier)||tier<1))return null;
  const sortedSupplies=tiers.slice(1,firstEngineIndex);
  if(sortedSupplies.some((tier,index)=>index>0&&tier>sortedSupplies[index-1]))return null;
  const roles=Array(120).fill(null);
  positions.forEach((pos,index)=>{roles[pos]=index<firstEngineIndex?"supply":"chain";});
  return {
    experiment,
    roles,
    protectedPosition:positions[0],
    firstEnginePosition:positions[firstEngineIndex],
    supplyCount:firstEngineIndex,
    chainCount:positions.length-firstEngineIndex
  };
}
