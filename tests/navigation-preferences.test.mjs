import test from "node:test";
import assert from "node:assert/strict";
import {PLANNER_SUBTABS,UPGRADE_SUBTABS,PLANNER_TAB_KEY,UPGRADE_TAB_KEY,
 readSubtab,rememberSubtab} from "../src/navigation-preferences.mjs";

function makeStore(){
 const values=new Map();
 return {
  getItem:key=>values.get(key)??null,
  setItem:(key,value)=>values.set(key,value)
 };
}
test("Planner and Upgrade subtabs persist independently",()=>{
 const store=makeStore();
 assert.equal(readSubtab(PLANNER_TAB_KEY,PLANNER_SUBTABS,"combo",()=>store),"combo");
 assert.equal(readSubtab(UPGRADE_TAB_KEY,UPGRADE_SUBTABS,"catalog",()=>store),"catalog");
 assert.equal(rememberSubtab(PLANNER_TAB_KEY,"knowledge",PLANNER_SUBTABS,()=>store),true);
 assert.equal(rememberSubtab(UPGRADE_TAB_KEY,"doubler",UPGRADE_SUBTABS,()=>store),true);
 assert.equal(readSubtab(PLANNER_TAB_KEY,PLANNER_SUBTABS,"combo",()=>store),"knowledge");
 assert.equal(readSubtab(UPGRADE_TAB_KEY,UPGRADE_SUBTABS,"catalog",()=>store),"doubler");
});
test("Unknown or outdated values fall back to valid subtabs",()=>{
 const store=makeStore();
 store.setItem(PLANNER_TAB_KEY,"nonexistent");
 assert.equal(readSubtab(PLANNER_TAB_KEY,PLANNER_SUBTABS,"combo",()=>store),"combo");
 assert.equal(rememberSubtab(PLANNER_TAB_KEY,"bad-value",PLANNER_SUBTABS,()=>store),false);
 assert.equal(store.getItem(PLANNER_TAB_KEY),"nonexistent");
});
test("Blocked or unavailable local storage never breaks navigation",()=>{
 const blocked=()=>{throw Error("Storage access blocked");};
 assert.equal(readSubtab(PLANNER_TAB_KEY,PLANNER_SUBTABS,"combo",blocked),"combo");
 assert.equal(rememberSubtab(UPGRADE_TAB_KEY,"advisor",UPGRADE_SUBTABS,blocked),false);
});
test("Main navigation never stores imported game JSON",()=>{
 const source=readSubtab.toString()+rememberSubtab.toString();
 assert.doesNotMatch(source,/JSON\.stringify|Sushi|saveData|account/);
});
