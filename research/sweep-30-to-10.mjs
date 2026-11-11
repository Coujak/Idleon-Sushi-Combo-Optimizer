#!/usr/bin/env node
// Standalone local research: all split ratios 30/70 ... 10/90, inclusive.
// Guided mode searches broadly, but is NOT exhaustive. Exact mode enumerates
// every permitted tier assignment, subject to explicit order/domain constraints.
// Neither mode enumerates every possible merge order; all reported best plans
// are replay-checked with the game's current simulated mechanics.
import {mkdirSync,existsSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {buildSplitComboCandidates} from '../src/combo-split-strategies.mjs';
import {buildExperimental13Candidates,EXPERIMENTAL_13_BENCHMARK} from '../src/experimental13-preparation.mjs';
import {searchCombos} from '../src/merge-search.mjs';
import {rolloutEastWind} from '../src/lookahead-search.mjs';
import {validateComboReplay} from '../src/optimizer-core.mjs';
import {createSplitProgressDashboard} from './terminal-progress.mjs';

const flags=Object.fromEntries(process.argv.slice(2).map(arg=>{
 if(!arg.startsWith('--'))throw Error('Expected --name=value, received '+arg);
 const [name,...rest]=arg.slice(2).split('=');return [name,rest.length?rest.join('='):'true'];
}));
const integer=(name,fallback)=>{const value=Number(flags[name]??fallback);
 if(!Number.isSafeInteger(value))throw Error('Invalid --'+name);return value;};
const choice=(name,fallback,allowed)=>{const value=flags[name]??fallback;
 if(!allowed.includes(value))throw Error('--'+name+' must be '+allowed.join(' or '));return value;};
const mode=choice('mode','guided',['guided','exact']);
const scoring=choice('scoring','full',['full','quick']);
const start=integer('start',30),end=integer('end',10);
const minTier=integer('min-tier',1),maxTier=integer('max-tier',63);
const supplyOrder=choice('supply-order','sorted',['sorted','all']);
const engineOrder=choice('engine-order','all',['all','sorted']);
const perSplit=flags['per-split']==='all'?null:integer('per-split',200);
const reportEvery=integer('report-every',25),saveEvery=integer('save-every',25);
const checkpoint=resolve(flags.checkpoint??'research/results/sweep-30-to-10.json');
if(start<1||start>99||end<1||end>start||
 minTier<1||maxTier>63||minTier>maxTier||
 (perSplit!==null&&perSplit<1)||reportEvery<1||saveEvery<1||
 (mode==='guided'&&perSplit===null))throw Error('Invalid search range or limits');
if(flags.help){console.log('Usage: node research/sweep-30-to-10.mjs --mode=guided|exact --per-split=200 --scoring=full|quick --checkpoint=FILE --reset');process.exit(0);}
const positions=Array.from({length:100},(_,i)=>i);
const slots=Array(120).fill(-1);for(const p of positions)slots[p]=0;
const splits=Array.from({length:start-end+1},(_,i)=>start-i);
const config={mode,scoring,start,end,minTier,maxTier,supplyOrder,engineOrder};
const chooseCache=new Map();
function choose(n,r){if(r<0||r>n)return 0n;r=Math.min(r,n-r);const key=n+':'+r;
 if(chooseCache.has(key))return chooseCache.get(key);
 let total=1n;for(let i=1;i<=r;i++)total=total*BigInt(n-r+i)/BigInt(i);
 chooseCache.set(key,total);return total;
}
const countMultisets=(size,k)=>choose(size+k-1,size);
function unrankSorted(rank,size,k){const result=[];let maximum=k-1;
 for(let i=0;i<size;i++){
  const remaining=size-i-1;let found=false;
  for(let digit=maximum;digit>=0;digit--){
   const block=countMultisets(remaining,digit+1);
   if(rank<block){result.push(minTier+digit);maximum=digit;found=true;break;}
   rank-=block;
  }
  if(!found)throw Error('Invalid sorted multiset rank');
 }
 return result;
}
function unrankAll(rank,size,k){const values=Array(size);
 for(let i=size-1;i>=0;i--){values[i]=minTier+Number(rank%BigInt(k));rank/=BigInt(k);}
 return values;
}
function gcd(a,b){while(b!==0n){const rem=a%b;a=b;b=rem;}return a;}
const exactParams=new Map();
if(mode==='exact')for(const supply of splits){
 const k=maxTier-minTier+1,engine=100-supply,ingredients=supply-1;
 const supplyTotal=supplyOrder==='sorted'?countMultisets(ingredients,k):BigInt(k)**BigInt(ingredients);
 const engineTotal=engineOrder==='sorted'?countMultisets(engine,k):BigInt(k)**BigInt(engine);
 const total=supplyTotal*engineTotal;
 let stride=1009n;while(gcd(stride,total)!==1n)stride+=2n;
 exactParams.set(supply,{k,ingredients,engine,engineTotal,total,stride,offset:total/BigInt(3+supply%5)});
}
const fresh=()=>({
 config,created:new Date().toISOString(),updated:new Date().toISOString(),
 splitResults:Object.fromEntries(splits.map(s=>[s,{tested:'0',best:null,population:[],rng:(123456789^(s*2654435761))>>>0}]))
});
let state=existsSync(checkpoint)&&flags.reset!=='true'?JSON.parse(readFileSync(checkpoint,'utf8')):fresh();
if(JSON.stringify(state.config)!==JSON.stringify(config))throw Error('Checkpoint belongs to different settings. Use --reset or another --checkpoint.');
const save=()=>{state.updated=new Date().toISOString();mkdirSync(dirname(checkpoint),{recursive:true});
 writeFileSync(checkpoint+'.tmp',JSON.stringify(state,null,2)+'\n');renameSync(checkpoint+'.tmp',checkpoint);};
let interrupted=false,dashboard=null;
process.on('SIGINT',()=>{
 interrupted=true;
 dashboard?.announce('Stop requested; saving checkpoint...');
});
process.on('SIGTERM',()=>{interrupted=true;});
function rng(record){let x=record.rng>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;
 record.rng=x>>>0;return (record.rng>>>0)/4294967296;}
const randomInt=(record,n)=>Math.floor(rng(record)*n);
const clamp=t=>Math.max(1,Math.min(63,t));
function mutate(parent,supply,record){const tiles=parent.slice();
 const edits=1+randomInt(record,4);
 for(let e=0;e<edits;e++){
  const type=randomInt(record,10),i=1+randomInt(record,99),j=1+randomInt(record,99);
  if(type===0||type===1||type===2){const p=type===0?1+randomInt(record,supply-1):
    type===1?supply+randomInt(record,100-supply):i;
   tiles[p]=clamp(tiles[p]+(randomInt(record,2)?1:-1)*(1+randomInt(record,type===2?12:3)));
  }else if(type===3){tiles[i]=clamp(1+randomInt(record,63));}
  else if(type===4||type===5){const p=supply+randomInt(record,100-supply);
   const q=supply+randomInt(record,100-supply);[tiles[p],tiles[q]]=[tiles[q],tiles[p]];
  }else if(type===6){const p=supply+randomInt(record,100-supply);
   const length=Math.min(1+randomInt(record,8),100-p),delta=randomInt(record,2)?1:-1;
   for(let j=p;j<p+length;j++)tiles[j]=clamp(tiles[j]+delta);
  }else if(type===7){const p=supply+randomInt(record,100-supply);
   const q=supply+randomInt(record,100-supply);tiles[p]=tiles[q];
  }else if(type===8){const p=1+randomInt(record,supply-1),q=supply+randomInt(record,100-supply);
   [tiles[p],tiles[q]]=[tiles[q],tiles[p]];
  }else{const p=supply+randomInt(record,100-supply),q=supply+randomInt(record,100-supply);
   const value=tiles[p];tiles.splice(p,1);tiles.splice(q,0,value);}
 }
 tiles[0]=64;tiles.splice(1,supply-1,...tiles.slice(1,supply).sort((a,b)=>b-a));
 return tiles;
}
const initialCandidates=mode==='guided'?buildSplitComboCandidates(positions,64,58,25,0,true,'optimizer4'):[];
const exp13=buildExperimental13Candidates(positions,64,58,25,true)[0];
const seeds=new Map();
if(mode==='guided')for(const split of splits){
 const layouts=[];
 if(split===24&&exp13)layouts.push({board:exp13.board.slice(0,100),origin:'Exp 13 benchmark seed'});
 for(const c of initialCandidates)if(c.supplyCount===split)layouts.push({board:c.board.slice(0,100),origin:'generated preparation'});
 const seen=new Set();seeds.set(split,layouts.filter(item=>{
  const key=item.board.join(',');if(seen.has(key))return false;seen.add(key);return true;}));
}
function nextBoard(split,record,index){
 if(mode==='exact'){
  const p=exactParams.get(split);const rank=(p.offset+index*p.stride)%p.total;
  const supplyRank=rank/p.engineTotal,engineRank=rank%p.engineTotal;
  const supplyTiles=supplyOrder==='sorted'?unrankSorted(supplyRank,p.ingredients,p.k):unrankAll(supplyRank,p.ingredients,p.k);
  const engineTiles=engineOrder==='sorted'?unrankSorted(engineRank,p.engine,p.k):unrankAll(engineRank,p.engine,p.k);
  return {board:[64,...supplyTiles,...engineTiles],origin:'exact assignment #'+index};
 }
 const options=seeds.get(split);
 if(index<BigInt(options.length))return options[Number(index)];
 const pool=record.population;
 const parent=pool.length&&rng(record)<0.85?pool[randomInt(record,Math.min(pool.length,12))].board:
  options[randomInt(record,options.length)].board;
 return {board:mutate(parent,split,record),origin:'guided mutation'};
}
function evaluate(tiles){const board=tiles.concat(Array(20).fill(0));
 const search=scoring==='quick'?rolloutEastWind(board,58,25,64):
  searchCombos(board,58,25,4,99,'descending domino',64);
 if(!search||!Number.isFinite(search.score))throw Error('Scoring failed');
 return {search,board};
}
let overall=0;
console.log('24/76 benchmark (previously replay-verified): '+EXPERIMENTAL_13_BENCHMARK);
console.log('Mode: '+mode+' | scoring: '+scoring+' | splits: '+start+'/ '+(100-start)+' through '+end+'/'+(100-end));
console.log('Checkpoint: '+checkpoint);
if(mode==='exact'){
 console.log('Exact domain: tiers T'+minTier+'–T'+maxTier+', supply '+supplyOrder+', engine '+engineOrder);
 console.log('All-arrangements coverage applies ONLY to this chosen tier domain and ordering rules.');
 for(const split of splits)console.log(split+'/'+(100-split)+' possibilities: '+exactParams.get(split).total.toString());
}
if(mode==='guided')console.log('Guided search is NOT exhaustive; it uses seeded layouts plus iterative mutations.');
// Each of the 21 splits keeps its own persistent terminal row. Exact mode
// may finish before --per-split when its bounded domain is exhausted.
const limits=new Map(splits.map(split=>{
 const domain=mode==='exact'?exactParams.get(split).total:null;
 const budget=perSplit===null?domain:BigInt(perSplit);
 return [split,domain===null?budget:budget<domain?budget:domain];
}));
dashboard=createSplitProgressDashboard({splits,state,limits});
dashboard.drawAll();
let lastReport=0,lastPaint=0;
while(!interrupted){
 let advanced=false;
 for(const split of splits){
  if(interrupted)break;
  const record=state.splitResults[split],index=BigInt(record.tested);
  if(perSplit!==null&&index>=BigInt(perSplit))continue;
  if(mode==='exact'&&index>=exactParams.get(split).total)continue;
  advanced=true;
  const {board,origin}=nextBoard(split,record,index);
  const {search,board:fullBoard}=evaluate(board);
  record.tested=(index+1n).toString();overall++;
  if(mode==='guided'){
   const key=board.join(',');
   if(!record.population.some(p=>p.board.join(',')===key)){
    record.population.push({score:search.score,board});
    record.population.sort((a,b)=>b.score-a.score);
    if(record.population.length>16)record.population.length=16;
   }
  }
  if(!record.best||search.score>record.best.score){
   const verification=validateComboReplay(fullBoard,search.moves,58,25,slots,64);
   if(verification.score!==search.score||!verification.board.every((tier,i)=>tier===search.board[i]))
    throw Error('Replay verification failed for split '+split);
   record.best={score:search.score,board,origin,iteration:record.tested,
    merges:verification.merges,repositions:verification.repositions,
    actions:search.moves.map(move=>({kind:move.kind,src:move.src,dst:move.dst,score:move.score,
      wind:move.events.filter(e=>e.kind==='wind').length}))};
   dashboard.announce('NEW BEST '+split+'/'+(100-split)+' : '+search.score.toLocaleString()+
    ' points ('+origin+', evaluated '+record.tested+')');
   save();
  }
  if(overall-lastReport>=reportEvery){
   lastReport=overall;
   if(dashboard.interactive){
    // Avoid excessive ANSI output in million-board sweeps.
    if(Date.now()-lastPaint>=100){
     dashboard.update(split);
     lastPaint=Date.now();
    }
   }else{
    // Redirected output/CI has no cursor movements; retain plain logs.
    console.log('Evaluated '+overall.toLocaleString()+' this run | '+split+'/'+(100-split)+
     ' | split best '+(record.best?.score??0).toLocaleString());
   }
  }
  if(overall%saveEvery===0)save();
 }
 if(!advanced)break;
 // Let Ctrl+C, terminal output and filesystem signals be handled between rounds.
 await new Promise(resolve=>setImmediate(resolve));
}
save();
dashboard.drawAll();
const table=splits.map(split=>({split:split+'/'+(100-split),tested:state.splitResults[split].tested,
 bestScore:state.splitResults[split].best?.score??null}));
console.table(table);
console.log((interrupted?'Interrupted; saved':'Finished configured search')+' · '+checkpoint);
console.log('Scores are replay-valid simulator results, NOT proven global maximums or guaranteed in-game scores.');
