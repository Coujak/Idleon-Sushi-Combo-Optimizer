import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 perfectoReplayPreview,perfectoReplayWorkspacePositions
} from "../src/perfecto-replay-view.mjs";

function fixture(){
 const plan={board:Array.from({length:120},(_,index)=>{
  const slot=index<100?0:-1;
  const tier=index===99?64:index<17?58-index:index<100?62:0;
  return {index,slot,tile:index===99?63:-1,
   preparedTier:tier>0?tier-1:-1,
   role:slot<0?"locked":tier===64?"protected":tier===62?"target":"ingredient",
   newCopy:tier===62};
 })};
 const replay={available:true,mode:"recycling",stagingStart:0,
  requiredSlots:38,totalSteps:365,finalFillIndex:365};
 return {plan,replay};
}

test("Starting the recycled Wind walkthrough removes exactly ONE new T62 from the recommended board",()=>{
 const {plan,replay}=fixture();
 const preview=perfectoReplayPreview(plan,62,replay,0);
 assert.equal(preview.available,true);
 assert.equal(preview.originalCount,100);
 assert.equal(preview.filled,99);
 assert.equal(preview.unlocked,100);
 assert.equal(preview.built,false);
 assert.equal(preview.plan.board[preview.missingPosition].preparedTier,-1);
 assert.equal(preview.plan.board[preview.missingPosition].role,"empty");
 let changed=0;
 for(let i=0;i<120;i++){
  if(preview.plan.board[i].preparedTier!==plan.board[i].preparedTier){
   changed++;
   assert.equal(i,preview.missingPosition);
  }
 }
 assert.equal(changed,1,"Never erase the 38-slot workspace from the recommended board");
 assert.equal(preview.plan.board[99].preparedTier,63,"Protected T64 stays present");
 assert.equal(preview.plan.board[0].preparedTier,57,"Supporting ladder stays visible");
});

test("Recommended board is restored only when last T62 is completed",()=>{
 const {plan,replay}=fixture();
 for(const step of [0,1,120,300,364]){
  const preview=perfectoReplayPreview(plan,62,replay,step);
  assert.equal(preview.filled,99,"step "+step);
  assert.equal(preview.built,false);
 }
 const done=perfectoReplayPreview(plan,62,replay,365);
 assert.equal(done.built,true);
 assert.equal(done.filled,100);
 assert.deepEqual(done.plan.board,plan.board);
});

test("Virtual workspace includes 38 construction cells, without altering recommended board",()=>{
 const {plan,replay}=fixture();
 const positions=perfectoReplayWorkspacePositions(replay);
 assert.equal(positions.length,38);
 assert.deepEqual(positions,Array.from({length:38},(_,i)=>i));
 const shifted={...replay,stagingStart:1};
 assert.deepEqual(perfectoReplayWorkspacePositions(shifted),
  Array.from({length:38},(_,i)=>i+1));
 const compact={available:true,mode:"compact",focusPosition:17,
  workspacePositions:[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]};
 assert.deepEqual(perfectoReplayWorkspacePositions(compact),
  Array.from({length:17},(_,i)=>i+1));
 assert.equal(perfectoReplayPreview(plan,62,{...replay,available:false},0).available,false);
});

test("Do not remove a target that was already on the player's imported board",()=>{
 const {plan,replay}=fixture();
 plan.board[98]={...plan.board[98],tile:61,newCopy:false};
 const preview=perfectoReplayPreview(plan,62,replay,0);
 assert.equal(preview.available,true);
 assert.notEqual(preview.missingPosition,98);
 assert.equal(preview.plan.board[98].preparedTier,61);
 const noNew={board:plan.board.map(cell=>({...cell,newCopy:false}))};
 assert.equal(perfectoReplayPreview(noNew,62,replay,0).available,false);
});

test("Both board comparisons have a dedicated construction workspace with independently rendered frames",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../src/perfecto-ui.mjs",import.meta.url),"utf8");
 const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
 for(const prefix of ["perfecto","perfectoMax"]){
  for(const name of ["ReplayWorkspacePanel","ReplayWorkspace","ReplayWorkspaceProgress"]){
   assert.equal(html.split('id="'+prefix+name+'"').length-1,1,prefix+name);
  }
 }
 assert.match(ui,/perfectoReplayPreview\(plan,target,replay,step\)/);
 assert.match(ui,/renderBoard\(result,preview\.available\?preview\.plan:plan,boardId\)/);
 assert.match(ui,/renderWorkspace\(replay,frame,event\)/);
 assert.match(css,/\.perfecto-replay-workspace-grid\s*\{/);
 assert.match(html,/Separate construction demonstration, not additional unlocked game slots/);
});
