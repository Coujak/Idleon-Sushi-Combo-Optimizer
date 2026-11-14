#!/usr/bin/env node
// Encrypt the strongest replay-validated split board for the private dev preview.
// Run locally. NEVER commit the plaintext checkpoint or share the passphrase.
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {dirname,resolve} from "node:path";
import {randomBytes,pbkdf2Sync,createCipheriv} from "node:crypto";

const source=resolve(process.argv[2]??"research/results/sweep-30-to-10.json");
const output=resolve("private/experiment14.enc.json");
if(!process.stdin.isTTY||typeof process.stdin.setRawMode!=="function"){
 console.error("Run this in an interactive terminal so your password can be entered without echo.");
 process.exit(1);
}
function secretPrompt(label){
 return new Promise((done,reject)=>{
  process.stdout.write(label);
  let chars="";
  const restore=()=>{
   process.stdin.setRawMode(false);
   process.stdin.off("data",onData);
   process.stdin.pause();
  };
  function onData(chunk){
   const key=chunk.toString("utf8");
   if(key==="\u0003"){restore();process.stdout.write("\n");reject(Error("Cancelled"));return;}
   if(key==="\r"||key==="\n"){restore();process.stdout.write("\n");done(chars);return;}
   if(key==="\u007f"){chars=chars.slice(0,-1);return;}
   // Only accept printable characters. Never echo password or expose as CLI args.
   if(!/[\x00-\x1f]/.test(key))chars+=key;
  }
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on("data",onData);
 });
}
try{
 const checkpoint=JSON.parse(readFileSync(source,"utf8"));
 if(checkpoint?.config?.mode!=="guided"||!checkpoint?.splitResults)
  throw Error("Invalid guided search checkpoint.");
 const entries=Object.entries(checkpoint.splitResults).filter(([,entry])=>
  Number(entry.tested)>=100000&&entry.best&&Number.isFinite(entry.best.score));
 if(entries.length!==21)
  throw Error("Expected 21 fully completed 100,000-board split searches; found "+entries.length+".");
 entries.sort((a,b)=>b[1].best.score-a[1].best.score);
 const [supply,record]=entries[0];
 const best=record.best;
 if(!Array.isArray(best.board)||best.board.length!==100||
   !Array.isArray(best.actions)||best.actions.length<1)
  throw Error("Invalid best board or replay.");
 if(best.actions.some(action=>action.kind!=="merge"||
  !Number.isInteger(action.src)||!Number.isInteger(action.dst)))
  throw Error("This preview supports merge-only experiments.");
 const payload={
  version:1,split:supply+"/"+(100-Number(supply)),score:best.score,
  board:best.board,actions:best.actions.map(({kind,src,dst})=>({kind,src,dst}))
 };
 const password=await secretPrompt("Choose a UNIQUE passphrase (20+ characters; input hidden): ");
 if(password.length<20)throw Error("Passphrase too short. Use 20+ characters.");
 const confirmation=await secretPrompt("Confirm passphrase (input hidden): ");
 if(password!==confirmation)throw Error("Passphrases did not match.");
 const salt=randomBytes(16),iv=randomBytes(12),iterations=600000;
 const key=pbkdf2Sync(password,salt,iterations,32,"sha256");
 const cipher=createCipheriv("aes-256-gcm",key,iv);
 const ciphertext=Buffer.concat([
  cipher.update(JSON.stringify(payload),"utf8"),
  cipher.final(),cipher.getAuthTag()
 ]);
 const envelope={
  version:1,algorithm:"AES-256-GCM",kdf:"PBKDF2-SHA256",
  iterations,salt:salt.toString("hex"),
  iv:iv.toString("hex"),ciphertext:ciphertext.toString("hex")
 };
 mkdirSync(dirname(output),{recursive:true});
 writeFileSync(output,JSON.stringify(envelope)+"\n",{mode:0o600});
 console.log("Encrypted Experiment 14.0 to: "+output);
 console.log("Only the ciphertext may be published. Never commit the checkpoint or passphrase.");
 console.log("You can now git add private/experiment14.enc.json and git commit/push it.");
}catch(error){
 console.error("Encryption failed: "+error.message);
 process.exitCode=1;
}
