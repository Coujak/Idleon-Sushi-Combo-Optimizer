import test from "node:test";
import assert from "node:assert/strict";
import {existsSync,readFileSync} from "node:fs";
const projectFile=path=>new URL("../"+path,import.meta.url);
test("public release retains only approved Found Configurations",()=>{
 const app=readFileSync(projectFile("src/app.js"),"utf8");
 const html=readFileSync(projectFile("index.html"),"utf8");
 const catalog=readFileSync(projectFile("src/found-configurations.mjs"),"utf8");
 assert.match(app,/FOUND_CONFIGURATIONS\.find\(config=>config\.id===foundId\)/);
 assert.match(app,/buildFoundConfiguration\(foundId,layoutPositions,maxTier,cap,chain,protectTier64\)/);
 assert.doesNotMatch(app,/privateExperiment|privateFound|privateReplay|unlockedExperiment14|PRIVATE_EXPERIMENT/);
 assert.doesNotMatch(html,/privateExperiment|Experiment 14\.0/);
 assert.doesNotMatch(catalog,/experimental14/);
 for(const file of ["src/private-experiment14.mjs","research/encrypt-experiment14.mjs","tests/private-experiment14.test.mjs"]){
  assert.equal(existsSync(projectFile(file)),false,file+" must remain development-only");
 }
});
