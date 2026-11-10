import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {SUSHI_UPGRADES,SUSHI_KNOWLEDGE,sushiUpgradeIconPath,sushiTierIconPath} from "../src/sushi-reference.mjs";
const root=fileURLToPath(new URL("../",import.meta.url));
const get=(p)=>readFileSync(path.join(root,p));
test("Every upgrade icon has its shop-numbered name and maps from internal ID",()=>{
 const expected=SUSHI_UPGRADES.map(u=>u.name+" (Upgrade "+u.shop+").png").sort();
 const actual=readdirSync(path.join(root,"assets/upgrades")).filter(f=>f.endsWith(".png")).sort();
 assert.equal(expected.length,46);assert.deepEqual(actual,expected);
 for(const u of SUSHI_UPGRADES){
  assert.equal(sushiUpgradeIconPath(u.id),"assets/upgrades/"+encodeURIComponent(u.name+" (Upgrade "+u.shop+").png"));
 }
 assert.equal(sushiUpgradeIconPath(-1),null);
 assert.equal(sushiUpgradeIconPath(17),"assets/upgrades/Salt%20Shaker%20(Upgrade%2011).png");
});
test("Every tier icon has its tier-numbered sushi name",()=>{
 const expected=SUSHI_KNOWLEDGE.map(k=>k.name+" (Tier "+k.tier+").png").sort();
 const actual=readdirSync(path.join(root,"assets/sushi")).filter(f=>f.endsWith(".png")).sort();
 assert.equal(expected.length,64);assert.deepEqual(actual,expected);
 for(const k of SUSHI_KNOWLEDGE)assert.equal(sushiTierIconPath(k.tier),"assets/sushi/"+encodeURIComponent(k.name+" (Tier "+k.tier+").png"));
 assert.equal(sushiTierIconPath(65),null);
});
test("Shaker images are identical copies of their upgrade art",()=>{
 for(const u of SUSHI_UPGRADES.filter(u=>[17,18,19].includes(u.id))){
  assert.deepEqual(get("assets/shakers/"+u.name+".png"),get("assets/upgrades/"+u.name+" (Upgrade "+u.shop+").png"));
 }
});
test("All artwork directories have README descriptions",()=>{
 for(const folder of ["assets","assets/sushi","assets/upgrades","assets/shakers","assets/campfires"]){
  assert.ok(get(folder+"/README.md").toString("utf8").length>180);
 }
});
test("Landing page and UI modules reference the renamed icon paths",()=>{
 const html=get("index.html").toString("utf8");
 const app=get("src/app.js").toString("utf8");
 const lab=get("src/lab-ui.mjs").toString("utf8");
 assert.ok(html.includes("Leviathan%20Roll%20(Tier%2058).png"));
 assert.ok(app.includes("sushiTierIconPath(tier)"));
 assert.ok(lab.includes("sushiTierIconPath(tier)"));
 assert.ok(lab.includes("sushiUpgradeIconPath(u.id)"));
 assert.ok(lab.includes('art.src="assets/shakers/"'));
});
