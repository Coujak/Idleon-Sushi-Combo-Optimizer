// Compact, navigable recipe stages. Each stage is a repeated construction
// pattern, not a timestamped replay of every cook or merge.
export function perfectoRecipeStages(proof,sourceTier=null,targetTier=null){
 const raw=Array.isArray(proof?.stages)?proof.stages:[];
 if(!raw.length){
  const source=Number(sourceTier??proof?.startingTier);
  const target=Number(targetTier??proof?.targetTier);
  if(Number.isInteger(source)&&source===target&&source>=1&&source<=64)
   return [{from:source,to:target,wind:false,ingredients:1,direct:true}];
  return [];
 }
 const stages=raw.map(stage=>{
  const from=Number(stage.from),to=Number(stage.to);
  const wind=stage.wind===true;
  const ingredients=wind?3:2;
  if(!Number.isInteger(from)||!Number.isInteger(to)||from<1||to>64||
     to-from!==(wind?2:1))return null;
  return {from,to,wind,ingredients,direct:false};
 });
 if(stages.some(stage=>!stage))return [];
 for(let i=1;i<stages.length;i++)if(stages[i-1].to!==stages[i].from)return [];
 if(Number.isInteger(Number(proof?.startingTier))&&stages[0].from!==Number(proof.startingTier))
  return [];
 if(Number.isInteger(Number(proof?.targetTier))&&
    stages.at(-1).to!==Number(proof.targetTier))return [];
 return stages;
}

export function perfectoFinalMergeIndex(stages,finalCount=4){
 if(!Array.isArray(stages)||!stages.length)return 0;
 const count=Number.isInteger(finalCount)?Math.max(1,finalCount):4;
 return Math.max(0,stages.length-count);
}

// Checks the compact recursive stage arithmetic without claiming that
// all physical tile movements have been replayed and validated.
export function perfectoRecipeIntegrity(proof,sourceTier,targetTier){
 if(!proof)return {valid:false,reason:"No construction certificate"};
 const stages=perfectoRecipeStages(proof,sourceTier,targetTier);
 if(!stages.length)return {valid:false,reason:"No coherent recipe stages"};
 const first=stages[0].from,last=stages.at(-1).to;
 if(first!==Number(sourceTier)||last!==Number(targetTier))
  return {valid:false,reason:"Recipe does not reach requested tier"};
 let cooks=1n,merges=0n,wind=0n,workspace=1;
 for(const stage of stages){
  if(stage.direct)continue;
  const factor=BigInt(stage.ingredients);
  merges=merges*factor+(stage.wind?2n:1n);
  wind=wind*factor+(stage.wind?1n:0n);
  cooks*=factor;
  workspace+=stage.ingredients-1;
 }
 const copies=BigInt(proof.finalCopies??0);
 if(copies<0n||String(cooks*copies)!==String(proof.cooksExact)||
    String(merges*copies)!==String(proof.mergesExact)||
    String(wind*copies)!==String(proof.windEventsExact)||
    workspace!==Number(proof.workspaceSlots))
  return {valid:false,reason:"Recipe resource totals do not match its stages"};
 return {valid:true,reason:"Recursive tier recipe arithmetic matches"};
}
