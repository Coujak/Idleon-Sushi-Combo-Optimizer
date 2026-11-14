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
// Match the fireplace-strength calculation used in lab-model.mjs
// (sushiUpgradeExtraText, Lithium Firelighter / upgrade id 26).
export function calculateKnowledgeFireplaceStrength(knowledgeRows=[],sparks=null){
 const knowledgeBonus=knowledgeRows
  .filter(row=>row.discovered&&row.category===9&&Number.isFinite(row.bonus))
  .reduce((sum,row)=>sum+Math.max(0,row.bonus),0);
 const sparksKnown=sparks!==null&&sparks!==undefined&&
  Number.isFinite(Number(sparks))&&Number(sparks)>=0;
 const count=sparksKnown?Number(sparks):null;
 const sparkBonus=sparksKnown&&count>0?
  0.2*Math.log2(count)+Math.log10(count):0;
 const knowledgeMultiplier=1+knowledgeBonus/100;
 const sparkMultiplier=1+sparkBonus/100;
 return {knowledgeBonus,sparkBonus,knowledgeMultiplier,sparkMultiplier,
  strength:knowledgeMultiplier*sparkMultiplier,
  sparksKnown,sparks:count};
}
export function calculateKnowledgeCreationExp({
 upgradeRows=[],knowledgeRows=[],options={},lithiumUnlocked=false,
 searedUnlocked=true,sparks=null
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
 const fireplace=calculateKnowledgeFireplaceStrength(knowledgeRows,sparks);
 // Lithium's base 2x is 1 + 100% fireplace effect. The in-game
 // Fireplace Strength bonuses scale that 100% effect (not the whole 2x).
 // Manual multiplier override, when explicitly given, takes precedence.
 const lithiumValue=Number(options.lithiumMultiplier);
 const manualLithium=options.lithiumMultiplier!=null&&
  Number.isFinite(lithiumValue)&&lithiumValue>0;
 const pinkMultiplier=lithiumUnlocked?
  (manualLithium?lithiumValue:1+fireplace.strength):1;
 const regular=searedUnlocked?base*globalMultiplier:0;
 const pink=regular*pinkMultiplier;
 if(![base,thirdMultiplier,knowledgeMultiplier,regular,pink].every(Number.isFinite))
  throw Error("Invalid Knowledge EXP creation multiplier");
 return {
  unlocked:searedUnlocked,manuallyCalibrated,
  secondDegree,thirdDegree,knowledgeBonus,
  base,thirdMultiplier,knowledgeMultiplier,globalMultiplier,
  lithiumEnabled:lithiumUnlocked,lithium:pinkMultiplier,
  fireplaceStrength:fireplace.strength,
  fireplaceKnowledgeBonus:fireplace.knowledgeBonus,
  fireplaceSparkBonus:fireplace.sparkBonus,
  fireplaceKnowledgeMultiplier:fireplace.knowledgeMultiplier,
  fireplaceSparkMultiplier:fireplace.sparkMultiplier,
  sparksKnown:fireplace.sparksKnown,
  sparks:fireplace.sparks,
  manualLithium,
  regular,pink,
  expAt:(fires,index)=>regular*
   (Array.isArray(fires)&&fires[index%15]===3?pinkMultiplier:1)
 };
}
