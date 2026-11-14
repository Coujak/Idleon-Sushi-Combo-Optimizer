// A pink fireplace bonus is active only on columns whose currently
// selected fireplace type is Lithium (index 3). Unlocking the upgrade alone
// does NOT switch existing fireplaces to pink.
// A proposed layout is a manual setup requirement, not an account change.
const COLS=15;
const validFire=x=>x!==undefined&&x!==null&&Number.isInteger(Number(x))&&
 Number(x)>=0&&Number(x)<=4?Number(x):-1;
export function inspectKnowledgePinkFireplaces({
 importedFires,proposedFires,lithiumUnlocked=false
}={}){
 if(!Array.isArray(importedFires)||importedFires.length!==COLS||
    !Array.isArray(proposedFires)||proposedFires.length!==COLS)
  throw Error("Knowledge pink fireplace inspection requires 15 columns");
 const imported=importedFires.map(validFire),proposed=proposedFires.map(validFire);
 const unlocked=lithiumUnlocked===true;
 const existingPink=imported.flatMap((type,i)=>unlocked&&type===3?[i]:[]);
 const proposedPink=proposed.flatMap((type,i)=>unlocked&&type===3?[i]:[]);
 const switchToPink=proposed.flatMap((type,i)=>
  unlocked&&type===3&&imported[i]!==3?[i]:[]);
 const switchFromPink=proposed.flatMap((type,i)=>
  unlocked&&type!==3&&imported[i]===3?[i]:[]);
 const unknown=imported.flatMap((type,i)=>type===-1?[i]:[]);
 const sameLayout=imported.every((v,i)=>v===proposed[i]);
 return {
  lithiumUnlocked:unlocked,
  imported,proposed,
  existingPink,proposedPink,switchToPink,switchFromPink,unknown,
  importedPinkCount:existingPink.length,
  proposedPinkCount:proposedPink.length,
  availableCount:imported.filter(v=>v>=0).length,
  proposedAvailableCount:proposed.filter(v=>v>=0).length,
  sameLayout,
  requiresFireplaceChanges:!sameLayout,
  requiresPinkActivation:switchToPink.length>0,
  // This is conditional modeled EXP; never claim a proposed pink is active.
  proposedPinkBonusReady:unlocked&&switchToPink.length===0&&proposedPink.length>0
 };
}
