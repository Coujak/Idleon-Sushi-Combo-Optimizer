import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {certifiedWindTierRecipe} from "../src/perfecto-wind-certificate.mjs";
import {
 perfectoRecipeStages,perfectoFinalMergeIndex,perfectoRecipeIntegrity
} from "../src/perfecto-recipe-guide.mjs";

test("ordered recipe navigator steps jump to the final four tier-building stages",()=>{
 const recipe=certifiedWindTierRecipe(46,62,58);
 const proof={startingTier:46,targetTier:62,finalCopies:20,
  stages:recipe.stages,workspaceSlots:recipe.workspaceSlots,
  cooksExact:String(BigInt(recipe.cooksExact)*20n),
  mergesExact:String(BigInt(recipe.mergesExact)*20n),
  windEventsExact:String(BigInt(recipe.windEventsExact)*20n)};
 const stages=perfectoRecipeStages(proof);
 assert.equal(stages[0].from,46);
 assert.equal(stages.at(-1).to,62);
 assert.ok(stages.some(x=>x.wind));
 const late=perfectoFinalMergeIndex(stages);
 assert.ok(late>0,"a long recipe should skip initial easy stages");
 assert.deepEqual(stages.slice(late),stages.slice(-4));
 assert.equal(perfectoRecipeIntegrity(proof,46,62).valid,true);
 assert.equal(perfectoFinalMergeIndex(stages.slice(0,2)),0);
});

test("recipe integrity detects incorrect construction totals",()=>{
 const recipe=certifiedWindTierRecipe(45,62,58);
 const proof={startingTier:45,targetTier:62,finalCopies:3,
  stages:recipe.stages,workspaceSlots:recipe.workspaceSlots,
  cooksExact:String(BigInt(recipe.cooksExact)*3n),
  mergesExact:String(BigInt(recipe.mergesExact)*3n),
  windEventsExact:String(BigInt(recipe.windEventsExact)*3n)};
 assert.equal(perfectoRecipeIntegrity(proof,45,62).valid,true);
 assert.equal(perfectoRecipeIntegrity({...proof,cooksExact:"4"},45,62).valid,false);
 assert.equal(perfectoRecipeIntegrity({...proof,workspaceSlots:1},45,62).valid,false);
 assert.equal(perfectoRecipeIntegrity({...proof,stages:proof.stages.slice(1)},45,62).valid,false);
 assert.equal(perfectoRecipeIntegrity(proof,44,62).valid,false);
});

test("direct cooking and unverified plans do not fabricate merge stages",()=>{
 const direct={startingTier:46,targetTier:46,finalCopies:6,
  stages:[],workspaceSlots:1,cooksExact:"6",mergesExact:"0",
  windEventsExact:"0"};
 assert.deepEqual(perfectoRecipeStages(direct,46,46),[
  {from:46,to:46,wind:false,ingredients:1,direct:true}
 ]);
 assert.equal(perfectoRecipeIntegrity(direct,46,46).valid,true);
 assert.deepEqual(perfectoRecipeStages(null,12,62),[]);
 assert.equal(perfectoRecipeIntegrity(null,12,62).valid,false);
});

test("two navigators, final-tier shortcut and optional T46 benchmark are wired",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../src/perfecto-ui.mjs",import.meta.url),"utf8");
 for(const prefix of ["perfecto","perfectoMax"]){
  for(const suffix of ["RecipeNavigator","RecipeCount","RecipeStage",
   "RecipeDescription","RecipePrev","RecipeNext","RecipeFinal","RecipeStart"]){
   assert.equal(html.split('id="'+prefix+suffix+'"').length-1,1,
    "expected one element "+prefix+suffix);
  }
 }
 assert.ok(html.includes('id="perfectoShowBenchmark"'));
 assert.ok(html.includes('id="perfectoComparePosition"'));
 assert.ok(css.includes(".perfecto-board-comparison.is-benchmark-hidden"));
 assert.ok(css.includes(".perfecto-tile.perfecto-tile-matched"));
 assert.ok(ui.includes("perfectoFinalMergeIndex(state.stages)"));
 assert.ok(ui.includes('board.addEventListener("mouseover"'));
 assert.ok(ui.includes('board.addEventListener("click"'));
 assert.ok(ui.includes('benchmarkToggle.addEventListener("change"'));
 assert.ok(ui.includes("perfectoRecipeIntegrity("));
});
