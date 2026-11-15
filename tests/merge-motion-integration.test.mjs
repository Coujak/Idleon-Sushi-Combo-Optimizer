import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const app=readFileSync(new URL("../src/app.js",import.meta.url),"utf8");
const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");

test("Replay shows the source board while the picked sushi moves into place",()=>{
 assert.ok(app.includes("drawFrame(before,move)"));
 assert.ok(app.includes("flightGhost=sourceTile.cloneNode(true)"));
 assert.ok(app.includes("sourceTile.classList.add(\"merge-source-lifted\")"));
 assert.ok(app.includes("flightGhost.animate(["));
 assert.ok(app.includes("if(epoch===flightEpoch)finishFlight()"));
 assert.ok(app.includes("drawFrame(move.board,move,{resolved:true,timing})"));
});
test("Seeking, cleanup, and resize stop an obsolete animation safely",()=>{
 assert.ok(app.includes("function cancelFlight(){"));
 assert.ok(app.includes("flightAnimation.cancel()"));
 assert.ok(app.includes("flightGhost.remove()"));
 assert.ok(app.includes("cancelFlight();\n    selected="));
 assert.ok(app.includes("window.addEventListener(\"resize\",finishWhenResized)"));
 assert.ok(app.includes("window.removeEventListener(\"resize\",finishWhenResized)"));
});
test("Flying sushi overlays the board instead of occupying a grid cell",()=>{
 assert.ok(css.includes(".merge-layout .merge-board{position:relative;isolation:isolate}"));
 assert.ok(css.includes(".tile.merge-flying-sushi{"));
 assert.ok(css.includes("position:absolute;z-index:25;pointer-events:none"));
 assert.ok(css.includes(".tile.merge-source-lifted .sushi-art"));
});
test("Playback speed and reduced motion are applied to every step",()=>{
 assert.ok(app.includes('from "./merge-motion.mjs?v=1.15.6"'));
 assert.ok(app.includes("{reducedMotion:prefersReducedMotion()}"));
 assert.ok(app.includes("finishFlight();\n    player.reschedule()"));
 assert.ok(app.includes('if(document.hidden){player.pause();finishFlight();}'));
});

test("Combo interactive merge seek bar reflects replay progress with themed thumb",()=>{
 assert.match(app,/seek\.style\.setProperty\("--merge-seek-progress","0%"\)/);
 assert.match(app,/selected\/result\.moves\.length\*100/);
 assert.match(css,/#solver \.merge-timeline input\.merge-seek::-webkit-slider-runnable-track/);
 assert.match(css,/#solver \.merge-timeline input\.merge-seek::-moz-range-track/);
 assert.match(css,/#solver \.merge-timeline input\.merge-seek::-webkit-slider-thumb/);
 assert.match(css,/--merge-seek-progress/);
 assert.match(app,/seek\.addEventListener\("input",\(\)=>player\.goTo\(Number\(seek\.value\)\)\)/);
});

test("Combo checklist keeps its heading visible and scrolls only the step rows",()=>{
 assert.match(app,/const listHeader=document\.createElement\("div"\);listHeader\.className="merge-step-list-heading"/);
 assert.match(app,/const listBody=document\.createElement\("div"\);listBody\.className="merge-step-items"/);
 assert.match(app,/right\.append\(listHeader,listBody\)/);
 assert.match(app,/listBody\.append\(button\);stepButtons\.push\(button\)/);
 assert.match(app,/listBody\.scrollTop\+=itemBounds/);
 assert.doesNotMatch(app,/right\.scrollTop\+=itemBounds/);
 assert.match(css,/#solver \.merge-step-items\{[\s\S]*?overflow-y:auto/);
 assert.match(css,/#solver \.merge-step-list\{[\s\S]*?overflow:hidden/);
});
test("Combo checklist aligns step numbers, instructions, and live completion badges",()=>{
 assert.match(app,/number\.className="merge-step-number"/);
 assert.match(app,/content\.className="merge-step-content"/);
 assert.match(app,/marker\.className="merge-step-status"/);
 assert.match(app,/marker\.textContent=current\?"CURRENT":completed\?"✓":nextUp\?"NEXT":""/);
 assert.match(app,/listProgress\.textContent=selected\+" \/ "\+result\.moves\.length\+" steps"/);
 assert.match(app,/button\.addEventListener\("click",\(\)=>player\.goTo\(index\)\)/);
 assert.match(css,/#solver \.merge-step\{\s*display:grid;grid-template-columns/);
 assert.match(css,/#solver \.merge-step\.completed:before,/);
 assert.match(css,/#solver \.merge-step\.up-next:after\{content:none;display:none\}/);
});
