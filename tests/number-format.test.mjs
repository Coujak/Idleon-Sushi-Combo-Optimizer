import test from "node:test";
import assert from "node:assert/strict";
import {formatCompactNumber} from "../src/number-format.mjs";
import {numberText,getKnowledgeRows} from "../src/lab-model.mjs";
import {parseGameQuantity,formatGameQuantity} from "../src/progression-calibration.mjs";

test("Shared notation uses M B T Q QQ then E21 and above",()=>{
 const cases=[[0,"0"],[1e3,"1K"],[1e6,"1M"],[1e9,"1B"],
  [1e12,"1T"],[1e15,"1Q"],[1e18,"1QQ"],[1e21,"1E21"],
  [1e22,"1E22"],[1e45,"1E45"],[-1e18,"-1QQ"]];
 for(const [value,want] of cases){
  assert.equal(formatCompactNumber(value),want);
  assert.equal(formatGameQuantity(value),want);
  assert.equal(numberText(value),want);
 }
 assert.equal(formatCompactNumber(1.72e39),"1.72E39");
 assert.equal(formatCompactNumber(2.5e18),"2.5QQ");
 assert.equal(formatCompactNumber(Infinity),"Unavailable");
 assert.equal(formatCompactNumber(NaN),"Unavailable");
 assert.equal(parseGameQuantity("1QQ"),1e18);
 assert.equal(parseGameQuantity("1E21"),1e21);
 assert.equal(parseGameQuantity("2.5Q"),2.5e15);
});

test("Extreme Knowledge levels do not produce invalid EXP progress",()=>{
 const save={sushi:[[],[],[],[],[],Array(64).fill(0),
  Array(64).fill(1e308),Array(64).fill(0)]};
 save.sushi[7][0]=3000;
 const high=getKnowledgeRows(save)[0];
 assert.equal(high.level,3000);
 assert.equal(high.xpKnown,true);
 assert.equal(high.xpProgress,null);
 assert.equal(high.readyToLevel,false);
 assert.equal(high.xpRemaining,null);
 const x=getKnowledgeRows(save)[1];
 assert.ok(Number.isFinite(x.xpProgress));
 assert.ok(x.xpProgress>=0&&x.xpProgress<=1);
});
