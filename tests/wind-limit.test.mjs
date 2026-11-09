import test from "node:test";
import assert from "node:assert/strict";
import {windTierMaximum,clampWindTier,windTierAfterPreparedChange} from "../src/wind-limit.mjs";

test("Wind tier cannot exceed highest prepared tier minus six",()=>{
  assert.equal(windTierMaximum(64),58);
  assert.equal(windTierMaximum(50),44);
  assert.equal(windTierMaximum(10),4);
  assert.equal(windTierMaximum(6),0);
  assert.equal(windTierMaximum(1),0);
});
test("Custom values below the cap are retained, but larger values are clamped",()=>{
  assert.equal(clampWindTier(32,64),32);
  assert.equal(clampWindTier(58,64),58);
  assert.equal(clampWindTier(64,64),58);
  assert.equal(clampWindTier(55,50),44);
  assert.equal(clampWindTier(0,64),0);
  assert.equal(clampWindTier(-12,64),0);
});
test("Input is clamped to integers and invalid limits cannot grow the cap",()=>{
  assert.equal(clampWindTier(12.5,64),12);
  assert.equal(clampWindTier("999",64),58);
  assert.equal(clampWindTier("bad",64),0);
  assert.equal(windTierMaximum(999),993);
  assert.equal(windTierMaximum(65),59);
  assert.equal(windTierMaximum(100),94);
  assert.equal(windTierMaximum(1000),994);
  assert.equal(clampWindTier(150,100),94);
});

test("Wind follows an old maximum when prepared tier increases",()=>{
 assert.equal(windTierAfterPreparedChange(58,64,66),60);
 assert.equal(windTierAfterPreparedChange(60,66,67),61);
 assert.equal(windTierAfterPreparedChange(58,64,100),94);
 assert.equal(windTierAfterPreparedChange(59,65,100),94);
});
test("Lower manually chosen Wind settings are retained or clamped",()=>{
 assert.equal(windTierAfterPreparedChange(32,64,66),32);
 assert.equal(windTierAfterPreparedChange(32,66,100),32);
 assert.equal(windTierAfterPreparedChange(55,66,50),44);
 assert.equal(windTierAfterPreparedChange(58,64,50),44);
 assert.equal(windTierAfterPreparedChange(0,64,66),0);
});
