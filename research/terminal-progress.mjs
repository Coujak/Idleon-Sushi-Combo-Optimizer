// A fixed multi-row terminal dashboard for the 30/70 → 10/90 research sweep.
// Each split occupies exactly one terminal line, updated in place. The search
// remains sequential/round-robin: these are progress indicators, not threads.
function progressPercent(tested,total){
 if(total===null||total<=0n)return 100;
 const clamped=tested<0n?0n:tested>total?total:tested;
 return Number(clamped*1000n/total)/10;
}
export function formatSplitProgress(split,tested,total,bestScore,columns=100){
 const pct=progressPercent(BigInt(tested),total===null?null:BigInt(total));
 const label=split+"/"+(100-split);
 const best=Number.isFinite(bestScore)?bestScore.toLocaleString("en-US"):"—";
 const prefix="Evaluating | "+label+" | [";
 const suffix="] "+pct.toFixed(1).padStart(5)+"% - Split best: "+best;
 // Keep within terminal bounds so a wrapped row cannot corrupt cursor motion.
 const usable=Number.isFinite(columns)?Math.max(1,Math.floor(columns)-1):99;
 const width=Math.max(1,Math.min(40,usable-prefix.length-suffix.length));
 const filled=Math.max(0,Math.min(width,Math.round(width*pct/100)));
 const line=prefix+"#".repeat(filled)+" ".repeat(width-filled)+suffix;
 return line.length>usable?line.slice(0,usable):line;
}
export function createSplitProgressDashboard({splits,state,limits,stream=process.stdout}){
 const interactive=Boolean(stream?.isTTY&&typeof stream.write==="function");
 const rows=splits.length,positions=new Map(splits.map((s,i)=>[s,i]));
 let active=false,previousWidth=0;
 function lineFor(split){
  const record=state.splitResults[split];
  return formatSplitProgress(split,record.tested,limits.get(split),
   record.best?.score??null,stream.columns??100);
 }
 function drawAll(){
  if(!interactive)return;
  const width=stream.columns??100;
  if(active)stream.write("\x1b["+rows+"A\r\x1b[0J");
  stream.write(splits.map(lineFor).join("\n")+"\n");
  previousWidth=width;
  active=true;
 }
 function update(split){
  if(!interactive)return false;
  if(!active||previousWidth!==(stream.columns??100)){drawAll();return true;}
  const i=positions.get(split);
  if(i===undefined)return false;
  const distance=rows-i;
  stream.write("\x1b["+distance+"A\r\x1b[2K"+lineFor(split)+
   "\x1b["+distance+"B\r");
  return true;
 }
 function announce(message){
  if(!interactive){console.log(message);return;}
  if(active){
   stream.write("\x1b["+rows+"A\r\x1b[0J");
   active=false;
  }
  stream.write(String(message)+"\n");
  drawAll();
 }
 return {interactive,drawAll,update,announce};
}
