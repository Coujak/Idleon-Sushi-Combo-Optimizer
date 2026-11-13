// Human-readable, unit-aware Sushi Knowledge descriptions.
// Inputs are the existing modeled bonus amount (raw percentage points);
// these labels must never be confused with a permanent tier reward.
import {formatCompactNumber} from "./number-format.mjs?v=1.0.0";

export function describeKnowledgeBonus(category,amount){
 if(typeof amount!=="number"||!Number.isFinite(amount)||amount<0)return "Unavailable";
 const n=formatCompactNumber(amount);
 const multiplier=formatCompactNumber(1+amount/100);
 switch(category){
  case 0:return "+"+n+"% Sushi Bucks generated";
  case 1:return "+"+n+"% Knowledge EXP";
  case 2:return "+"+n+"% chance of +1 cooked tier";
  case 3:return multiplier+"× maximum Fuel capacity";
  case 4:return "+"+n+"% Fuel generation";
  case 5:return "+"+n+"% chance of a free Shaker use";
  case 6:return "+"+n+"% upgrade discount bonus";
  case 7:return multiplier+"× Fuel generation";
  case 8:return "+"+n+"% stronger slot effects";
  case 9:return "+"+n+"% stronger fireplace effects";
  case 10:return multiplier+"× Perfecto chance";
  default:return "Effect unavailable";
 }
}
