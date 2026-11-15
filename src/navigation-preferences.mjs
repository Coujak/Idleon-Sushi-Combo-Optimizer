// Browser-only navigation preferences. Never persist imported game JSON.
export const PLANNER_SUBTABS=Object.freeze(["combo","perfecto","knowledge"]);
export const UPGRADE_SUBTABS=Object.freeze(["catalog","advisor","doubler"]);
export const PLANNER_TAB_KEY="sushiLab.lastPlannerTab.v1";
export const UPGRADE_TAB_KEY="sushiLab.lastUpgradeTab.v1";

export function readSubtab(key,allowed,fallback,getStorage=()=>window.localStorage){
 try{
  const value=getStorage().getItem(key);
  return allowed.includes(value)?value:fallback;
 }catch{return fallback;}
}
export function rememberSubtab(key,value,allowed,getStorage=()=>window.localStorage){
 if(!allowed.includes(value))return false;
 try{getStorage().setItem(key,value);return true;}
 catch{return false;}
}
