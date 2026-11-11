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
// Color is applied only after fitting the plain text into the terminal.
// ANSI sequences do not occupy character cells, so alignment is unchanged.
const ANSI={
 reset:"\x1b[0m",dim:"\x1b[2m",cyan:"\x1b[1;36m",
 green:"\x1b[1;32m",yellow:"\x1b[1;33m",
 white:"\x1b[1;37m"
};
const paint=(color,text)=>ANSI[color]+text+ANSI.reset;
export function colorizeSplitProgress(line){
 const parts=line.match(/^(Evaluating \| )(\d+\/\d+)( \| \[)(#*)( *)(\] +\d+\.\d% - Split best: )(.+)$/);
 if(!parts)return line; // Narrow columns may truncate the suffix.
 const [,verb,split,opening,done,left,ending,score]=parts;
 const complete=Number(ending.match(/\d+\.\d%/)?.[0].slice(0,-1)??0)>=100;
 return paint("dim",verb)+paint("cyan",split)+paint("dim",opening)+
  paint("green",done)+paint("dim",left)+
  paint(complete?"green":"white",ending)+paint("yellow",score);
}
export function stripTerminalColors(text){
 return text.replace(/\x1b\[[0-9;]*m/g,"");
}
export function createSplitProgressDashboard({splits,state,limits,stream=process.stdout,color}){
 const interactive=Boolean(stream?.isTTY&&typeof stream.write==="function");
 // TTY colors are enabled by default, unless NO_COLOR or a dumb terminal
 // disables them. Non-interactive output is always plain text.
 const useColor=interactive&&
  (color??(!Object.prototype.hasOwnProperty.call(process.env,"NO_COLOR")&&
   process.env.TERM!=="dumb"));
 const rows=splits.length,positions=new Map(splits.map((s,i)=>[s,i]));
 let active=false,previousWidth=0;
 function lineFor(split){
  const record=state.splitResults[split];
  const plain=formatSplitProgress(split,record.tested,limits.get(split),
   record.best?.score??null,stream.columns??100);
  return useColor?colorizeSplitProgress(plain):plain;
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
  const notice=String(message);
  stream.write((useColor&&notice.startsWith("NEW BEST ")?
   paint("green",notice):notice)+"\n");
  drawAll();
 }
 return {interactive,drawAll,update,announce};
}
