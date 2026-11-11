import test from "node:test";
import assert from "node:assert/strict";
import {detectSushiProgress} from "../src/sushi-progression.mjs";

test("Imported Sushi discovery flags determine available tiers even when the current board is lower",()=>{
 const tiles=Array(120).fill(-1);tiles[22]=24; // T25 on board
 const tracker=[...Array(59).fill(1),...Array(5).fill(0),...Array(36).fill(-1)];
 const progress=detectSushiProgress({tiles,sushi:[[],[],[],[],[],tracker]});
 assert.equal(progress.highestOnBoard,25);
 assert.equal(progress.highestDiscovered,64);
 assert.equal(progress.highest,64);
 assert.equal(progress.windCap,58);
 assert.match(progress.source,/discovered/);
});
test("Undiscovered future tiers do not artificially increase a player's Wind cap",()=>{
 const flags=[...Array(40).fill(0),...Array(60).fill(-1)];
 const result=detectSushiProgress({
  tiles:[7,12,-1],sushi:[[],[],[],[],[],flags]
 });
 assert.equal(result.highestDiscovered,40);
 assert.equal(result.highest,40);
 assert.equal(result.windCap,34);
});
test("A prepared highest-tier sushi on the board stays recognized even with incomplete flags",()=>{
 const result=detectSushiProgress({
  tiles:[63,-1,10],sushi:[[],[],[],[],[],[0,0,-1,-1]]
 });
 assert.equal(result.highest,64);
 assert.equal(result.highestOnBoard,64);
 assert.equal(result.windCap,58);
 assert.match(result.source,/board/);
});
test("Tracker and board can represent future tiers above 64",()=>{
 const flags=[...Array(79).fill(0),...Array(21).fill(-1)];
 const result=detectSushiProgress({
  tiles:[72,-1,-1],sushi:[[],[],[],[],[],flags]
 });
 assert.equal(result.highest,79);
 assert.equal(result.windCap,73);
});
test("No discovery data safely falls back to board only",()=>{
 const result=detectSushiProgress({tiles:[-1,8,-1]});
 assert.equal(result.highest,9);
 assert.equal(result.windCap,3);
 const none=detectSushiProgress({tiles:[]});
 assert.equal(none.highest,0);
 assert.equal(none.windCap,0);
});
