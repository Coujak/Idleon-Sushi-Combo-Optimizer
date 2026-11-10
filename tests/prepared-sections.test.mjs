import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {getPreparedBoardSections,hasSlotLayoutChanges,FIRST_ENGINE_INDEX,preparedSectionOutlinePath,preparedOutlineCoordinates} from "../src/prepared-sections.mjs";
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
      assert.equal(result.roles[offset+99],"chain");
      if(offset===20)assert.equal(result.roles[0],null);
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

test("Connected boundary follows a stepped supply/chain split",()=>{
  const roles=Array.from({length:120},(_,i)=>i<24?"supply":"chain");
  const x=Array.from({length:16},(_,i)=>i*10);
  const y=Array.from({length:9},(_,i)=>i*10);
  const supply=preparedSectionOutlinePath(roles,"supply",x,y);
  const chain=preparedSectionOutlinePath(roles,"chain",x,y);
  assert.match(supply,/M /);
  assert.match(supply,/Z/);
  assert.match(chain,/Z/);
  // At the break after the ninth tile on row two the contour
  // returns to the left edge before closing the supply shape.
  assert.match(supply,/L 90\.0 20\.0/);
  assert.match(chain,/L 90\.0 20\.0/);
  assert.equal(preparedSectionOutlinePath(roles,"missing",x,y),"");
});

test("Prepared board spotlight supports hover, focus, click and cleanup",()=>{
  const code=readFileSync(new URL("../src/app.js",import.meta.url),"utf8");
  const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
  assert.match(code,/preparedSectionOutlinePath\(sectionInfo\.roles,role,xs,ys,COLUMNS\)/);
  assert.match(code,/addEventListener\("pointerenter"/);
  assert.match(code,/addEventListener\("focus"/);
  assert.match(code,/addEventListener\("keydown"/);
  assert.match(code,/observer\?\.disconnect\(\)/);
  assert.match(css,/\.prepared-outline-supply\{stroke:/);
  assert.match(css,/\.prepared-outline-chain\{stroke:/);
  assert.match(css,/highlight-supply \.tile\.prepared-chain/);
  assert.match(css,/highlight-chain \.tile\.prepared-supply/);
});

test("Outline coordinates hug tile edges and center each gap in SVG space",()=>{
  const tiles=Array.from({length:120},(_,i)=>{
    const col=i%15,row=Math.floor(i/15);
    const left=100+col*12,top=200+row*13;
    return {left,right:left+10,top,bottom:top+11};
  });
  const frame={left:95,top:194,width:200,height:120};
  const coordinates=preparedOutlineCoordinates(tiles,frame,15,2);
  assert.ok(coordinates);
  assert.equal(coordinates.xs.length,16);
  assert.equal(coordinates.ys.length,9);
  assert.equal(coordinates.xs[0],3); // 2px beyond the leftmost tile
  assert.equal(coordinates.xs[1],16); // midpoint of the first 2px gap
  assert.equal(coordinates.xs[15],185); // 2px beyond the rightmost tile
  assert.equal(coordinates.ys[0],4);
  assert.equal(coordinates.ys[1],18);
  assert.equal(coordinates.ys[8],110);
});
test("Prepared UI measures SVG coordinates rather than the board border",()=>{
  const code=readFileSync(new URL("../src/app.js",import.meta.url),"utf8");
  assert.match(code,/const svgBox=outline\.getBoundingClientRect\(\)/);
  assert.match(code,/preparedOutlineCoordinates\(bounds,svgBox,COLUMNS,2\)/);
});
