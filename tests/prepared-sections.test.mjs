import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {getPreparedBoardSections,hasSlotLayoutChanges,FIRST_ENGINE_INDEX} from "../src/prepared-sections.mjs";
import {buildExperimental13Candidates} from "../src/experimental13-preparation.mjs";
import {buildExperimental2Candidates} from "../src/experimental2-preparation.mjs";

test("Only changed slot positions or plate types require a recommended layout board",()=>{
  const slots=Array.from({length:120},(_,i)=>i<100?i%4:-1);
  assert.equal(hasSlotLayoutChanges(slots,slots.slice()),false);
  const altered=slots.slice();altered[5]=2;
  assert.equal(hasSlotLayoutChanges(slots,altered),true);
  const moved=slots.slice();moved[0]=-1;moved[100]=0;
  assert.equal(hasSlotLayoutChanges(slots,moved),true);
});

for(const [exp,build] of [[2,buildExperimental2Candidates],[13,buildExperimental13Candidates]]){
  for(const offset of [0,20]){
    test("Exp "+exp+" labels supply and fixed engine at offset "+offset,()=>{
      const positions=Array.from({length:100},(_,i)=>i+offset);
      const [candidate]=build(positions,64,58,25,true);
      const slots=Array.from({length:120},(_,i)=>positions.includes(i)?0:-1);
      const result=getPreparedBoardSections(candidate,slots);
      assert.equal(result.experiment,exp);
      assert.equal(result.protectedPosition,offset);
      assert.equal(result.firstEnginePosition,offset+FIRST_ENGINE_INDEX[exp]);
      assert.equal(result.supplyCount,FIRST_ENGINE_INDEX[exp]);
      assert.equal(result.chainCount,100-FIRST_ENGINE_INDEX[exp]);
      assert.equal(result.roles[offset],"supply");
      assert.equal(result.roles[result.firstEnginePosition],"chain");
      assert.equal(result.roles[119-offset]??null,offset===0?null:"supply");
    });
  }
}

test("Custom and unsupported layouts are not inaccurately labeled",()=>{
 const slots=Array.from({length:120},(_,i)=>i<100?0:-1);
 const [candidate]=buildExperimental13Candidates(Array.from({length:100},(_,i)=>i),64,58,25,true);
 assert.equal(getPreparedBoardSections({...candidate,name:"Custom board"},slots),null);
 const broken=slots.slice();broken[50]=-1;broken[100]=0;
 assert.equal(getPreparedBoardSections(candidate,broken),null);
});

test("Planner omits current board and numbers sections dynamically",()=>{
 const code=readFileSync(new URL("../src/app.js",import.meta.url),"utf8");
 assert.ok(!code.includes('make("0 · Current slot layout"'));
 assert.match(code,/if\(showSlotRecommendation\)make\(/);
 assert.match(code,/heading\.textContent=sectionNumber\+" · Interactive merge sequence"/);
 assert.match(code,/getPreparedBoardSections\(solution,recommendedSlots\)/);
});
