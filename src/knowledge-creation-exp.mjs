// Knowledge EXP granted by one Sushi creation, evaluated from the imported
// account's effective (including Doubler) upgrade and Knowledge bonuses.
// Every cook/merge/East Wind creation uses the column where the RESULT is born.
// No Sushi-tier multiplier is part of the documented creation EXP formula.
// Other unverified in-game modifiers are deliberately not invented.
const bonusOf=(rows,id)=>{
 const row=rows.find(row=>row.id===id);
 const value=Number(row?.rawBonus);
 return Number.isFinite(value)?Math.max(0,value):0;
};
export function calculateKnowledgeCreationExp({
 upgradeRows=[],knowledgeRows=[],options={},lithiumUnlocked=false,
 searedUnlocked=true
}={}){
 const secondDegree=bonusOf(upgradeRows,37);
 const thirdDegree=bonusOf(upgradeRows,38);
 const knowledgeBonus=knowledgeRows
  .filter(row=>row.discovered&&row.category===1&&Number.isFinite(row.bonus))
  .reduce((sum,row)=>sum+Math.max(0,row.bonus),0);
 const provided=Number(options.expPerCreation);
 const manuallyCalibrated=options.expPerCreation!==null&&
  options.expPerCreation!==undefined&&Number.isFinite(provided)&&provided>0;
 const base=manuallyCalibrated?provided:1+secondDegree/10;
 const thirdMultiplier=1+thirdDegree/100;
 const knowledgeMultiplier=1+knowledgeBonus/100;
 const globalMultiplier=thirdMultiplier*knowledgeMultiplier;
 const lithiumValue=Number(options.lithiumMultiplier);
 const pinkMultiplier=lithiumUnlocked?
  (options.lithiumMultiplier!=null&&Number.isFinite(lithiumValue)&&lithiumValue>0?
   lithiumValue:2):1;
 const regular=searedUnlocked?base*globalMultiplier:0;
 const pink=regular*pinkMultiplier;
 if(![base,thirdMultiplier,knowledgeMultiplier,regular,pink].every(Number.isFinite))
  throw Error("Invalid Knowledge EXP creation multiplier");
 return {
  unlocked:searedUnlocked,manuallyCalibrated,
  secondDegree,thirdDegree,knowledgeBonus,
  base,thirdMultiplier,knowledgeMultiplier,globalMultiplier,
  lithiumEnabled:lithiumUnlocked,lithium:pinkMultiplier,
  regular,pink,
  expAt:(fires,index)=>regular*
   (Array.isArray(fires)&&fires[index%15]===3?pinkMultiplier:1)
 };
}
