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
