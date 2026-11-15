#!/usr/bin/env node
// Private Experiment 14 merge-order search. Does not publish the board,
// password, authentication data, or checkpoints. Run on your own computer.
// node research/improve-private-experiment14.mjs --trials=3000
import {readFileSync,existsSync,writeFileSync,mkdirSync} from "node:fs";
import {dirname} from "node:path";
import {createDecipheriv,createCipheriv,pbkdf2Sync,randomBytes} from "node:crypto";
import {stdin,stdout} from "node:process";
import {simulateMerge,validateComboReplay} from "../src/optimizer-core.mjs";
import {rolloutEastWind} from "../src/lookahead-search.mjs";
import {buildPrivateExperiment14Candidate} from "../src/private-experiment14.mjs";

const options=Object.fromEntries(process.argv.slice(2).map(arg=>arg.replace(/^--/,"").split("=")));
const trials=Number(options.trials??3000);
if(!Number.isInteger(trials)||trials<1||trials>100000)throw Error("Invalid --trials count.");
const path=options.file??"private/experiment14.enc.json";
if(!existsSync(path))throw Error("Encrypted checkpoint not found at "+path);
if(!stdin.isTTY||typeof stdin.setRawMode!=="function")
 throw Error("Run from an interactive local terminal to enter your passphrase privately.");
function askHidden(message){
 return new Promise((resolve,reject)=>{
  let secret="";
  stdout.write(message);
  const stop=()=>{stdin.off("data",onData);stdin.setRawMode(false);stdin.pause();};
  function onData(chunk){
   const key=chunk.toString("utf8");
   if(key==="\u0003"){stop();reject(Error("Cancelled"));return;}
   if(key==="\r"||key==="\n"){stop();stdout.write("\n");resolve(secret);return;}
   if(key==="\u007f"){secret=secret.slice(0,-1);return;}
   if(!/[\x00-\x1f]/.test(key))secret+=key;
  }
  stdin.setRawMode(true);stdin.resume();stdin.on("data",onData);
 });
}
function decrypt(envelope,passphrase){
 if(envelope.version!==1||envelope.algorithm!=="AES-256-GCM"||
  envelope.kdf!=="PBKDF2-SHA256"||envelope.iterations<400000)throw Error("Invalid checkpoint format.");
 const key=pbkdf2Sync(passphrase,Buffer.from(envelope.salt,"hex"),envelope.iterations,32,"sha256");
 const bytes=Buffer.from(envelope.ciphertext,"hex");
 const decipher=createDecipheriv("aes-256-gcm",key,Buffer.from(envelope.iv,"hex"));
 decipher.setAuthTag(bytes.subarray(bytes.length-16));
 const text=Buffer.concat([decipher.update(bytes.subarray(0,-16)),decipher.final()]);
 return JSON.parse(text.toString("utf8"));
}
function choices(board,avoid,maxChoices){
 const byTier=new Map();
 board.forEach((tier,i)=>{if(tier>0&&tier<64){if(!byTier.has(tier))byTier.set(tier,[]);byTier.get(tier).push(i);}});
 const out=[];
 for(const positions of byTier.values())for(const dst of positions)for(const src of positions){
  if(src===dst||(src===avoid?.src&&dst===avoid?.dst))continue;
  const move=simulateMerge(board,src,dst,58,25,64);
  if(!move)continue;
  const wind=move.events.length-1;
  const continues=move.board[dst+1]===move.board[dst]&&move.board[dst]<64;
  out.push({move,rank:wind*900+(continues?1400:0)+move.score-(Math.abs(src-dst)*0.01)});
 }
 out.sort((a,b)=>b.rank-a.rank);
 const top=out.slice(0,Math.min(maxChoices,out.length));
 // Probe across the ranked candidates, not only identical greedy ties.
 for(let i=maxChoices;i<out.length&&top.length<maxChoices+8;i+=Math.max(1,Math.floor(out.length/8)))
  top.push(out[i]);
 return top;
}
const encrypted=JSON.parse(readFileSync(path,"utf8"));
let passphrase=await askHidden("Private Experiment 14 passphrase (not echoed): ");
let payload;
payload=decrypt(encrypted,passphrase);
const positions=Array.from({length:100},(_,i)=>i);
const original=buildPrivateExperiment14Candidate(payload,positions);
if(!original)throw Error("Experiment 14 decrypt succeeded but the replay is invalid.");
const board=original.board;
const slots=Array.from({length:120},(_,i)=>i<100?0:-1);
let best={score:original.privateSearch.score,moves:original.privateSearch.moves};
let evaluations=0,pass=0;
console.log("Verified private baseline: "+best.score.toLocaleString()+" points");
const target=77000;
while(evaluations<trials&&best.score<target){
 pass++;
 const seed=best.moves.slice();
 let prefix=0,found=false;
 for(let step=0;step<seed.length&&evaluations<trials;step++){
  const at=step===0?board:seed[step-1].board;
  for(const {move} of choices(at,seed[step],22)){
   if(evaluations++>=trials)break;
   const continuation=rolloutEastWind(move.board,58,25,64);
   const total=prefix+move.score+continuation.score;
   if(total>best.score){
    const moves=seed.slice(0,step).concat(move,continuation.moves);
    const validation=validateComboReplay(board,moves,58,25,slots,64);
    if(validation.score!==total)throw Error("Candidate failed independent replay verification.");
    best={score:total,moves};
    found=true;
    console.log("New replay-valid best: "+best.score.toLocaleString()+
      " | pass "+pass+" | evaluations "+evaluations+
      " | merges "+validation.merges);
    // Don't reveal the private board/moves in terminal history.
    if(best.score>=target)break;
   }
  }
  if(best.score>=target)break;
  prefix+=seed[step].score;
 }
 if(!found)break;
}
const verified=validateComboReplay(board,best.moves,58,25,slots,64);
if(best.score>original.privateSearch.score){
 const updated={...payload,score:verified.score,
  actions:best.moves.map(m=>({kind:"merge",src:m.src,dst:m.dst}))};
 if(!buildPrivateExperiment14Candidate(updated,positions))
  throw Error("Improved payload failed Experiment 14 validation.");
 const salt=randomBytes(16),iv=randomBytes(12),iterations=600000;
 const key=pbkdf2Sync(passphrase,salt,iterations,32,"sha256");
 const cipher=createCipheriv("aes-256-gcm",key,iv);
 const ciphertext=Buffer.concat([cipher.update(JSON.stringify(updated),"utf8"),
  cipher.final(),cipher.getAuthTag()]);
 const envelope={version:1,algorithm:"AES-256-GCM",kdf:"PBKDF2-SHA256",
  iterations,salt:salt.toString("hex"),iv:iv.toString("hex"),ciphertext:ciphertext.toString("hex")};
 const output=options.output??"private/experiment14-improved.enc.json";
 mkdirSync(dirname(output),{recursive:true});
 writeFileSync(output,JSON.stringify(envelope)+"\n",{mode:0o600});
 console.log("Encrypted improved replay saved locally: "+output);
}
passphrase="";
console.log("Finished: "+verified.score.toLocaleString()+" / "+target.toLocaleString()+
 " | evaluated "+evaluations+" alternatives | "+(verified.score>=target?"TARGET REACHED":"target not reached"));
console.log("No plaintext boards, actions, or passphrases were printed or written.");
