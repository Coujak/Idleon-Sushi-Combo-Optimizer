import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createCipheriv,randomBytes,pbkdf2Sync} from "node:crypto";
import {simulateMerge,validateComboReplay} from "../src/optimizer-core.mjs";
import {getPreparedBoardSections} from "../src/prepared-sections.mjs";
import {unlockPrivateExperiment14,buildPrivateExperiment14Candidate}
 from "../src/private-experiment14.mjs";

const positions=Array.from({length:100},(_,i)=>i);
function fixture(){
 const board=Array(100).fill(2);
 board[0]=64;board[1]=2;board[2]=2;
 const initial=board.concat(Array(20).fill(0));
 const merge=simulateMerge(initial,1,2,58,25,64);
 return {version:1,split:"23/77",score:merge.score,
  board,actions:[{kind:"merge",src:1,dst:2}]};
}
test("private experiment runs in the same replay validator as public experiments",()=>{
 const candidate=buildPrivateExperiment14Candidate(fixture(),positions);
 assert.ok(candidate);
 assert.equal(candidate.foundExperiment,14);
 assert.equal(candidate.privateExperiment,true);
 assert.equal(candidate.privateSearch.moves.length,1);
 const result=validateComboReplay(candidate.board,candidate.privateSearch.moves,58,25,
  Array(120).fill(0),64);
 assert.equal(result.score,candidate.privateSearch.score);
 assert.deepEqual(result.board,candidate.privateSearch.board);
 const sections=getPreparedBoardSections(candidate,Array(120).fill(0).map((_,i)=>i<100?0:-1));
 assert.equal(sections.experiment,14);
 assert.equal(sections.supplyCount,23);
 assert.equal(sections.chainCount,77);
});
test("a tampered saved score or invalid move cannot become a valid experiment",()=>{
 const payload=fixture();
 assert.equal(buildPrivateExperiment14Candidate({...payload,score:payload.score+1},positions),null);
 assert.equal(buildPrivateExperiment14Candidate({...payload,
  actions:[{kind:"merge",src:0,dst:2}]},positions),null);
 assert.equal(buildPrivateExperiment14Candidate(payload,[...positions].reverse()),null);
});
test("encrypted Experiment 14 unlock requires correct passphrase",async()=>{
 const payload=fixture();
 const password="synthetic-fixture-passphrase-not-the-real-one";
 const salt=randomBytes(16),iv=randomBytes(12),iterations=400000;
 const key=pbkdf2Sync(password,salt,iterations,32,"sha256");
 const cipher=createCipheriv("aes-256-gcm",key,iv);
 const ciphertext=Buffer.concat([cipher.update(JSON.stringify(payload),"utf8"),
  cipher.final(),cipher.getAuthTag()]);
 const envelope={version:1,algorithm:"AES-256-GCM",kdf:"PBKDF2-SHA256",
  iterations,salt:salt.toString("hex"),iv:iv.toString("hex"),
  ciphertext:ciphertext.toString("hex")};
 assert.deepEqual(await unlockPrivateExperiment14(envelope,password),payload);
 await assert.rejects(()=>unlockPrivateExperiment14(envelope,password+"x"));
});
test("Experiment 14 is selected and unlocked inside the existing Found Configurations UI",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const app=readFileSync(new URL("../src/app.js",import.meta.url),"utf8");
 assert.ok(html.includes('id="privateExperiment14Gate"'));
 assert.ok(html.includes('id="runFoundConfiguration"'));
 assert.ok(!html.includes('id="experiment14Frame"'));
 assert.ok(!html.includes('id="toggleExperiment14"'));
 assert.match(app,/privateFoundSelected\(\)/);
 assert.match(app,/candidate\.privateSearch\?\?/);
 assert.match(app,/!privateFound&&!winningIsFromCache/);
 assert.ok(!app.includes("IttyBittyArmy"),"Never publish the user's passphrase");
});
