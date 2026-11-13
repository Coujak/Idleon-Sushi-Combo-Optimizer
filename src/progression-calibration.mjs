import {formatCompactNumber} from "./number-format.mjs?v=1.0.1";
// Optional in-game readings. Never store a player's values in the repo.
// A measured baseline anchors the result; projected changes remain estimates.
const SUFFIXES={k:1e3,m:1e6,b:1e9,t:1e12,qa:1e15,q:1e15,qi:1e18,
 qq:1e18,sx:1e21,sp:1e24,oc:1e27,no:1e30,dc:1e33};
export function parseGameQuantity(input){
 if(typeof input==="number")return Number.isFinite(input)&&input>0?input:null;
 if(typeof input!=="string")return null;
 const clean=input.trim().replace(/,/g,"").replace(/\s+/g,"").replace(/(?:fuel|bucks)?(?:\/h(?:r)?|\/hour)$/i,"");
 if(!clean)return null;
 const match=/^([+]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)([A-Za-z]{0,2})$/i.exec(clean);
 if(!match)return null;
 const base=Number(match[1]);
 const suffix=match[2].toLowerCase();
 if(suffix&&!Object.prototype.hasOwnProperty.call(SUFFIXES,suffix))return null;
 const result=base*(SUFFIXES[suffix]??1);
 return Number.isFinite(result)&&result>0?result:null;
}
export const formatGameQuantity=value=>formatCompactNumber(value);
export function calibratedProgressionMetric(currentMetric,referenceMetric,reading,goal){
 const measured=parseGameQuantity(reading);
 if(measured===null||!currentMetric||!referenceMetric)return currentMetric;
 if(!(referenceMetric.value>0)||!Number.isFinite(currentMetric.value))return currentMetric;
 const ratio=currentMetric.value/referenceMetric.value;
 if(!Number.isFinite(ratio)||ratio<0)return currentMetric;
 const value=measured*ratio;
 if(!Number.isFinite(value))return currentMetric;
 const unit=goal==="bucks"?" Bucks/hr":goal==="fuel"?" Fuel/hr":" Fuel";
 const label=goal==="bucks"?"Projected Bucks generation / hour":
  goal==="fuel"?"Projected Fuel generation / hour":
  "Projected maximum Fuel capacity";
 return {...currentMetric,value,display:formatGameQuantity(value)+unit,label,
  calibrated:true,estimated:true,note:
  "Anchored to your entered in-game reading. Future values scale only the upgrade effects covered by the model; indirect effects and other multipliers may change the real result."};
}
