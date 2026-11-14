import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildKnowledgeActiveExpHistory}
 from "../src/knowledge-active-exp-history.mjs";

const gains=values=>{
 const a=Array(65).fill(0);
 for(const [tier,exp] of Object.entries(values))a[Number(tier)]=exp;
 return a;
};
const frame=(kind,events=[],values={})=>({kind,events,gains:gains(values)});
test("T58 cumulative EXP shows only creations that have occurred by the selected step",()=>{
 const frames=[
  frame("start"),
  frame("cook",[{kind:"cook",tier:38,at:0}],{38:100}),
  frame("merge",[
   {kind:"merge",tier:58,at:5},
   {kind:"wind",tier:57,at:6}
  ],{58:9500,57:350}),
  frame("wave"),
  frame("merge",[{kind:"merge",tier:58,at:20}],{58:10500}),
  frame("partial")
 ];
 const h=buildKnowledgeActiveExpHistory(frames);
 assert.deepEqual(h.atStep(58,0),{exp:0,creations:0});
 assert.deepEqual(h.atStep(58,1),{exp:0,creations:0});
 assert.deepEqual(h.atStep(58,2),{exp:9500,creations:1});
 assert.deepEqual(h.atStep(58,3),{exp:9500,creations:1});
 assert.deepEqual(h.atStep(58,4),{exp:20000,creations:2});
 assert.deepEqual(h.atStep(58,5),{exp:20000,creations:2});
 assert.deepEqual(h.atStep(38,5),{exp:100,creations:1});
 assert.deepEqual(h.atStep(57,5),{exp:350,creations:1});
 assert.deepEqual(h.atStep(59,5),{exp:0,creations:0});
});
test("Wind can create several Sushi of one tier in a single merge step",()=>{
 const frames=[
  frame("start"),
  frame("merge",[
   {kind:"merge",tier:58,at:0},
   {kind:"wind",tier:58,at:1},
   {kind:"wind",tier:59,at:2}
  ],{58:19000,59:11000})
 ];
 const h=buildKnowledgeActiveExpHistory(frames);
 assert.deepEqual(h.atStep(58,1),{exp:19000,creations:2});
 assert.deepEqual(h.atStep(59,1),{exp:11000,creations:1});
});
test("Joining continued refill chunks never recounts the former final partial frame",()=>{
 const original=[
  frame("start"),
  frame("merge",[{kind:"merge",tier:58,at:4}],{58:9200}),
  frame("partial")
 ];
 const continuation=[
  frame("start"),
  frame("refill"),
  frame("merge",[{kind:"wind",tier:58,at:8}],{58:11200}),
  frame("partial")
 ];
 const combined=original.slice(0,-1).concat(continuation.slice(1));
 const h=buildKnowledgeActiveExpHistory(combined);
 assert.equal(h.atStep(58,1).exp,9200);
 assert.deepEqual(h.atStep(58,combined.length-1),{exp:20400,creations:2});
 assert.equal(h.finalExp[58],20400);
 assert.equal(h.finalCreations[58],2);
});
test("Sparse EXP history handles long hold-to-continue previews efficiently",()=>{
 const frames=[frame("start")];
 for(let i=1;i<=30000;i++){
  frames.push(i%125===0?
   frame("merge",[{kind:"wind",tier:58,at:i%120}],{58:10000}):
   frame("wave"));
 }
 const h=buildKnowledgeActiveExpHistory(frames);
 assert.equal(h.changes[58].length,240);
 assert.deepEqual(h.atStep(58,250),{exp:20000,creations:2});
 assert.deepEqual(h.atStep(58,30000),{exp:2400000,creations:240});
});
test("UI labels the active table as modeled EXP through the selected step",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../src/knowledge-leveling-ui.mjs",import.meta.url),"utf8");
 assert.match(html,/Active EXP gained · to step/);
 assert.match(html,/Hybrid EXP \/ hr · preview/);
 assert.match(ui,/buildKnowledgeActiveExpHistory\(p\.steps\)/);
 assert.match(ui,/renderVisibleActiveExp\(index\)/);
 assert.match(ui,/activeExpHistory\.atStep\(tier,step\)/);
 assert.match(ui,/Full-preview T/);
});
