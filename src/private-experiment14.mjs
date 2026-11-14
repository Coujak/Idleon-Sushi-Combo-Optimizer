// Browser-only decryption for the locally encrypted Experiment 14 checkpoint.
// NEVER commit a passphrase or an unencrypted board to this repository.
import {simulateMerge} from "./optimizer-core.mjs?v=1.9.9";

const bytesFromHex=(value,length)=>{
 if(typeof value!=="string"||value.length!==length*2||!/^[0-9a-f]+$/i.test(value))
  throw Error("Invalid encrypted experiment format.");
 return Uint8Array.from(value.match(/../g),part=>Number.parseInt(part,16));
};
export async function unlockPrivateExperiment14(envelope,password){
 if(envelope?.version!==1||envelope?.algorithm!=="AES-256-GCM"||
  envelope?.kdf!=="PBKDF2-SHA256"||
  !Number.isInteger(envelope.iterations)||envelope.iterations<400000||
  envelope.iterations>1500000||
  typeof password!=="string"||!password)
  throw Error("Invalid encrypted experiment or passphrase.");
 if(!globalThis.crypto?.subtle)
  throw Error("Browser encryption is unavailable. Open this site on localhost or HTTPS.");
 const material=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),
  "PBKDF2",false,["deriveKey"]);
 const key=await crypto.subtle.deriveKey({
  name:"PBKDF2",hash:"SHA-256",salt:bytesFromHex(envelope.salt,16),
  iterations:envelope.iterations
 },material,{name:"AES-GCM",length:256},false,["decrypt"]);
 const ciphertext=bytesFromHex(envelope.ciphertext,
  typeof envelope.ciphertext==="string"?envelope.ciphertext.length/2:0);
 const decrypted=await crypto.subtle.decrypt({
  name:"AES-GCM",iv:bytesFromHex(envelope.iv,12)
 },key,ciphertext);
 const payload=JSON.parse(new TextDecoder().decode(decrypted));
 // Verify using the same physical 100-cell preparation as the search.
 if(!buildPrivateExperiment14Candidate(payload,
   Array.from({length:100},(_,i)=>i)))
  throw Error("Encrypted experiment is invalid.");
 return payload;
}

export function buildPrivateExperiment14Candidate(payload,positions){
 if(payload?.version!==1||typeof payload.split!=="string"||
  !/^\\d{1,2}\\/\\d{1,2}$/.test(payload.split)||
  !Number.isSafeInteger(payload.score)||payload.score<1||
  !Array.isArray(payload.board)||payload.board.length!==100||
  !Array.isArray(payload.actions)||payload.actions.length<1||
  payload.actions.length>1000||
  !Array.isArray(positions)||positions.length!==100||
  positions.some((p,i)=>!Number.isInteger(p)||p<0||p>=120||
   (i>0&&p!==positions[i-1]+1))||
  payload.board.some(t=>!Number.isInteger(t)||t<1||t>64)||
  payload.board[0]!==64)return null;
 const supply=Number(payload.split.split("/")[0]);
 if(supply<2||supply>=100||100-supply!==Number(payload.split.split("/")[1]))return null;
 const start=Array(120).fill(0);
 payload.board.forEach((tier,i)=>{start[positions[i]]=tier;});
 let board=start,score=0;
 const moves=[];
 for(const action of payload.actions){
  if(action?.kind!=="merge"||
   !Number.isInteger(action.src)||action.src<0||action.src>=100||
   !Number.isInteger(action.dst)||action.dst<0||action.dst>=100)return null;
  const src=positions[action.src],dst=positions[action.dst];
  const move=simulateMerge(board,src,dst,58,25,64);
  if(!move||move.events.some(e=>!positions.includes(e.at))||
   board[positions[0]]!==64||move.board[positions[0]]!==64)return null;
  moves.push(move);
  board=move.board;
  score+=move.score;
 }
 if(score!==payload.score)return null;
 const remaining=board.filter(t=>t>0).length;
 return {
  name:"Experimental 14.0 · Private",foundExperiment:14,privateExperiment:true,
  foundBenchmark:null,base:Math.min(...payload.board.filter(t=>t<64)),
  shape:"private encrypted "+payload.split+" preparation",
  board:start,foundSplit:payload.split,
  strategySections:{protectedPosition:positions[0],
   enginePositions:positions.slice(supply)},
  supplyCount:supply,engineCount:100-supply,splitPercent:supply,
  privateSearch:{board,score,moves,remaining,
   strategy:"Saved replay · private research",strategiesTested:1}
 };
}
