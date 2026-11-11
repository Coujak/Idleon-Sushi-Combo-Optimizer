// Focused 24/76 research runner. This is an exhaustive multiset search only
// inside the caller-selected tier interval; it is NOT a proof of optimality
// over all possible board permutations and merge orders.
//
// Example (quick smoke test):
// node research/search-24-76.mjs --min-tier=1 --max-tier=2 --limit=100
// For a real run, increase the tier domain and limit deliberately.
import {writeFileSync,existsSync,readFileSync} from "node:fs";
import {enumerateSplitTierBoards} from "../src/exhaustive-split-search.mjs";
import {searchCombos} from "../src/merge-search.mjs";
import {validateComboReplay} from "../src/optimizer-core.mjs";

const args=Object.fromEntries(process.argv.slice(2).map(arg=>{
 const [k,v]=arg.replace(/^--/,"").split("=");
 return [k,v];
}));
const integer=(name,fallback)=>{
 const value=Number(args[name]??fallback);
 if(!Number.isSafeInteger(value))throw Error("Invalid "+name);
 return value;
};
const minTier=integer("min-tier",1),maxTier=integer("max-tier",3);
const limit=integer("limit",1000),offset=integer("offset",0);
const checkpoint=args.checkpoint??"research/24-76-progress.json";
if(minTier<1||maxTier>63||maxTier<minTier||limit<1||offset<0)
 throw Error("Invalid search range");
const positions=Array.from({length:100},(_,i)=>i);
const slots=Array(120).fill(-1);for(const i of positions)slots[i]=0;
const saved=existsSync(checkpoint)?JSON.parse(readFileSync(checkpoint,"utf8")):null;
const config={minTier,maxTier,offset,limit};
if(saved&&JSON.stringify(saved.config)!==JSON.stringify(config))
 throw Error("Checkpoint settings differ. Choose another checkpoint file.");
let tested=saved?.tested??0, best=saved?.best??null;
const checkpointNow=()=>{
 writeFileSync(checkpoint,JSON.stringify({config,tested,best,complete:false},null,2)+"\n");
};
process.on("SIGINT",()=>{checkpointNow();console.log("Saved checkpoint");process.exit(130);});
for(const candidate of enumerateSplitTierBoards({
 positions,supplyCount:24,maxTier:maxTier+1,minTier,protectedTier:64
})){
 // This iterator enumerates tier multisets only, and may have a massive
 // search space. offset/limit and checkpoint permit reproducible batches.
 if(offset>0){ // Offset handled below using a monotonically increasing index.
 }
 if(!globalThis.__seen)globalThis.__seen=0;
 const index=globalThis.__seen++;
 if(index<offset+tested)continue;
 if(tested>=limit)break;
 const result=searchCombos(candidate.board,58,25,4,99,"descending domino",64);
 const verified=validateComboReplay(candidate.board,result.moves,58,25,slots,64);
 if(verified.score!==result.score)throw Error("Replay score mismatch at "+index);
 tested++;
 if(!best||result.score>best.score){
  best={score:result.score,index,board:candidate.board,moves:result.moves.length};
  console.log("New best",best.score,"at configuration",index);
 }
 if(tested%100===0){checkpointNow();console.log("Evaluated",tested,"/",limit,"best",best?.score??0);}
}
writeFileSync(checkpoint,JSON.stringify({config,tested,best,complete:tested<limit},null,2)+"\n");
console.log("Finished batch",tested,"best",best?.score??0,
 " (not exhaustive over full 24/76 board space)");
