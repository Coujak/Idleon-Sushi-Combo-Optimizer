// Candidate board layouts for up to 100 unlocked slots among 120 grid positions.
// Imported game boards are not modified; this only prepares recommendations.
export function buildCandidates(positions,maxTier,cap,selectedBase=0,chainLimit=25,protectTier64=maxTier>=64){
  const result=[];
  const ordered=[...new Set(positions.filter(i=>Number.isInteger(i)&&i>=0&&i<120))].sort((a,b)=>a-b);
  if(ordered.length<2||ordered.length>100)return result;
  // Tier 64 is a permanent sushi, not an ordinary mergeable ingredient.
  // Anchor exactly one at the first unlocked position in automatic preparations.
  const protectedPosition=protectTier64?ordered[0]:undefined;
  const usable=protectTier64?ordered.slice(1):ordered;
  const highestIngredient=Math.min(maxTier,protectTier64?63:64);
  if(highestIngredient<1)return result;

  const add=(name,base,shape)=>{
    const board=Array(120).fill(0);
    for(const pos of usable)board[pos]=base;
    if(protectedPosition!==undefined)board[protectedPosition]=64;
    if(shape==="staircase"){
      // Keep descending tiers in physical order, leaving base-tier reserves.
      const length=Math.max(0,Math.min(highestIngredient-base+1,usable.length-2));
      for(let i=0;i<length;i++)board[usable[i]]=highestIngredient-i;
    }else if(shape==="recycle"){
      const peak=Math.min(highestIngredient,cap+1,base+Math.max(1,chainLimit-3));
      const length=Math.max(0,Math.min(peak-base,usable.length-3));
      for(let i=0;i<length;i++)board[usable[i]]=peak-i;
    }else if(shape==="paired"){
      for(let i=0;i<usable.length;i++){
        board[usable[i]]=Math.max(base,highestIngredient-Math.floor((i%30)/2));
      }
    }else if(shape==="uniform"){
      // The rest remain at the base tier.
    }
    result.push({name,board,base,shape});
  };

  const from=Math.max(1,selectedBase||Math.max(1,highestIngredient-33));
  const to=Math.min(highestIngredient,selectedBase||highestIngredient);
  for(let base=from;base<=to;base++){
    add("Tier "+base+" → "+cap+" staircase",base,"staircase");
    if(base<cap&&ordered.length>=6)add("Tier "+base+" recycled Wind staircase",base,"recycle");
    add("Tier "+base+" paired ramp",base,"paired");
    add("Tier "+base+" uniform",base,"uniform");
  }
  return result;
}
