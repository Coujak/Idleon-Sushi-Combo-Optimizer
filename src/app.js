const $=id=>document.getElementById(id);
const COLUMNS=15;
let imported=null;
function decodeSave(input){
  if(!input||typeof input!=="object")throw Error("Expected a JSON object.");
  const raw=input.data?.Sushi??input.Sushi;
  if(raw==null)throw Error("No Sushi data found. Expected data.Sushi (Idleon Toolbox) or Sushi (raw game data).");
  let sushi=typeof raw==="string"?JSON.parse(raw):raw;
  if(!Array.isArray(sushi)||!Array.isArray(sushi[0]))throw Error("Sushi data does not contain the expected tile array.");
  if(!sushi[0].every(x=>Number.isInteger(Number(x))))throw Error("Sushi tile array contains non-numeric entries.");
  return {sushi,tiles:sushi[0].slice(0,120).map(Number),perfecto:Array.isArray(sushi[5])?sushi[5].map(Number):null,slots:Array.isArray(sushi[1])?sushi[1].slice(0,120).map(Number):[],fires:Array.isArray(sushi[3])?sushi[3].slice(0,15).map(Number):[],source:input.data?.Sushi!=null?"Idleon Toolbox":"Raw game data"};
}
const SLOT_NAMES=["Regular","Hot","Cold","Milktoast"];
const FIRE_NAMES=["Red · Charcoal","Green · Barium","Blue · Copper","Pink · Lithium","Purple · Potassium"];
function renderBoard(tiles,perfecto,slots,fires){
  const board=$("board");board.replaceChildren();
  const active=Math.max(0,slots.findLastIndex(n=>n>=0)+1);
  const count=Math.max(active,tiles.findLastIndex(n=>n>=0)+1);
  for(let i=0;i<count;i++){
    const id=tiles[i]??-1,slot=slots[i]??-1;
    const cell=document.createElement("div");
    cell.className="tile"+(slot>=0?" slot-"+slot:" locked")+(id<0?" empty":"");
    if(slot>=0&&id>=0){
      const isPerfecto=Array.isArray(perfecto)&&perfecto[id]>0;
      if(isPerfecto)cell.classList.add("perfecto");
      const tier=document.createElement("span");tier.className="tier";tier.textContent=id+1;cell.append(tier);
      if(isPerfecto){const mark=document.createElement("span");mark.className="perfecto-mark";mark.textContent="✓";mark.setAttribute("aria-label","Perfecto");cell.append(mark);}
    }else if(slot>=0){cell.textContent="·";}
    cell.title="Position "+(i+1)+" · "+(SLOT_NAMES[slot]??"Locked")+(id>=0?" · Tier "+(id+1):" · Empty")+(id>=0&&perfecto?.[id]>0?" · Perfecto":"");
    board.append(cell);
  }
  const fireRow=document.createElement("div");fireRow.className="fire-row";
  for(let i=0;i<COLUMNS;i++){
    const f=fires[i]??-1,cell=document.createElement("div");cell.className="fire-cell"+(f>=0?" fire-"+f:"");
    cell.textContent=f>=0?"♨":"";
    cell.title="Column "+(i+1)+" · "+(FIRE_NAMES[f]??"No fireplace");
    fireRow.append(cell);
  }
  $("fireplaces").replaceChildren(fireRow);
  const filled=tiles.filter(n=>n>=0).length;
  $("boardStatus").textContent=filled+" sushi tiles";
  $("boardDetails").textContent=filled+" occupied slots · "+slots.filter(n=>n>=0).length+" unlocked slots · "+fires.filter(n=>n>=0).length+" fireplaces. Hover over a slot or fireplace for details.";
}
function importSave(data,label){
  const parsed=decodeSave(data);
  imported=parsed;
  renderBoard(parsed.tiles,parsed.perfecto,parsed.slots,parsed.fires);
  $("solver").classList.remove("hidden");$("runSolver").click();
  $("importStatus").textContent="JSON imported";$("importStatus").classList.add("success");
  $("importSummary").textContent=label+" · "+parsed.source+" · "+parsed.tiles.filter(n=>n>=0).length+" occupied sushi slots decoded (120-slot storage).";
  $("importSummary").classList.remove("hidden");
  $("jsonPreview").textContent=JSON.stringify({source:parsed.source,sushiArrayLengths:parsed.sushi.map(x=>Array.isArray(x)?x.length:null),firstTiles:parsed.tiles.slice(0,30),slotTypes:parsed.slots,fireTypes:parsed.fires,perfectoFlags:parsed.perfecto?.slice(0,70)??null},null,2);
}
function error(e){$("importStatus").textContent="Import failed";$("importStatus").classList.remove("success");$("jsonPreview").textContent=String(e.message??e);$("importSummary").classList.add("hidden");}
$("pasteToggle").addEventListener("click",()=>{const open=$("pasteArea").classList.toggle("hidden")===false;$("pasteToggle").setAttribute("aria-expanded",String(open));if(open)$("jsonInput").focus();});
$("parseJson").addEventListener("click",()=>{try{importSave(JSON.parse($("jsonInput").value),"Pasted JSON");}catch(e){error(e);}});
$("jsonFile").addEventListener("change",async e=>{const f=e.target.files?.[0];if(!f)return;try{importSave(JSON.parse(await f.text()),f.name);}catch(err){error(err);}});
$("clearImport").addEventListener("click",()=>{imported=null;$("solver").classList.add("hidden");$("jsonInput").value="";$("jsonFile").value="";$("board").replaceChildren();$("fireplaces").replaceChildren();$("importSummary").classList.add("hidden");$("pasteArea").classList.add("hidden");$("pasteToggle").setAttribute("aria-expanded","false");$("importStatus").textContent="Waiting for data";$("importStatus").classList.remove("success");$("boardStatus").textContent="Import a save";$("boardDetails").textContent="Your imported tiles will appear here.";$("jsonPreview").textContent="No JSON imported yet.";});

/* Experimental combo search. These are explicit assumptions, NOT verified game logic. */
function simulateMerge(board,src,dst,cap,chainLimit){
  if(src===dst||board[src]<1||board[src]!==board[dst])return null;
  const next=board.slice(),before=next[dst];
  next[src]=0;next[dst]=Math.min(64,before+1);
  let score=next[dst],events=[{at:dst,tier:next[dst],kind:"merge"}];
  // Assumption: an affected sushi can trigger another upgrade to its right.
  let p=dst;
  for(let k=0;k<chainLimit;k++){
    const q=p+1;
    if(q>=next.length||q%COLUMNS===0||next[p]<1||next[p]>cap||next[q]<1||next[q]>=next[p]||next[q]>=64)break;
    next[q]++;score+=next[q];events.push({at:q,tier:next[q],kind:"wind"});p=q;
  }
  return {board:next,score,events,src,dst};
}
function searchCombos(start,cap,chainLimit,beamWidth,depth){
  let states=[{board:start,score:0,moves:[]}],best=states[0];
  for(let step=0;step<depth;step++){
    const candidates=[],seen=new Set();
    for(const st of states){
      const byTier=new Map();
      st.board.forEach((tier,i)=>{if(tier>0){if(!byTier.has(tier))byTier.set(tier,[]);byTier.get(tier).push(i);}});
      for(const indices of byTier.values()){
        if(indices.length<2)continue;
        for(let a=0;a<indices.length;a++)for(let b=0;b<indices.length;b++){
          if(a===b)continue;
          const result=simulateMerge(st.board,indices[a],indices[b],cap,chainLimit);
          if(!result)continue;
          const total=st.score+result.score;
          const key=result.board.join(",");
          if(seen.has(key))continue;seen.add(key);
          const state={board:result.board,score:total,moves:[...st.moves,result]};
          candidates.push(state);
          if(total>best.score)best=state;
        }
      }
    }
    if(!candidates.length)break;
    candidates.sort((a,b)=>b.score-a.score);
    states=candidates.slice(0,beamWidth);
  }
  return best;
}
function validateTiming(moves,timeout,secondsPerMerge){
  const events=moves.map((move,index)=>({
    step:index+1,
    estimatedSeconds:secondsPerMerge,
    safe:secondsPerMerge<timeout,
    remaining:timeout-secondsPerMerge,
    windUpgrades:move.events.filter(e=>e.kind==="wind").length
  }));
  return {events,valid:events.every(e=>e.safe),minimumMargin:events.length?Math.min(...events.map(e=>e.remaining)):null,totalDuration:events.length*secondsPerMerge};
}
function showSolver(){
  if(!imported)return;
  const cap=Math.min(64,Math.max(1,Number($("windCap").value)||58));
  const chain=Math.min(30,Math.max(0,Number($("chainLimit").value)||0));
  const count=imported.slots.filter(x=>x>=0).length;
  if(count<2){$("solverScore").textContent="—";$("solverMoves").textContent="0";$("solverNote").textContent="Not enough unlocked slots to simulate merges.";$("solverSteps").replaceChildren();return;}
  const slots=imported.slots.slice(0,count);
  // Slot arrangement is intentionally unchanged: no proven slot-to-combo effect yet.
  const board=Array.from({length:count},(_,i)=>slots[i]>=0?Math.max(1,Math.min(64,Number($("seedTier").value)||58)):0);
  const result=searchCombos(board,cap,chain,12,Math.min(count-1,18));
  const timeout=Math.max(0.1,Number($("comboTimeout").value)||5.5);
  const moveTime=Math.max(0.1,Number($("mergeTime").value)||1.5);
  const timing=validateTiming(result.moves,timeout,moveTime);
  $("timingStatus").textContent=timing.valid?"Timing feasible under assumptions":"Timing infeasible under assumptions";
  $("timingStatus").className=timing.valid?"timing-good":"timing-bad";
  $("timingDetails").textContent="Estimated execution: "+timing.totalDuration.toFixed(1)+"s · Per-merge margin: "+(timing.minimumMargin===null?"—":timing.minimumMargin.toFixed(1)+"s")+" · Assumes timer refreshes after every manual merge. Heat-triggered timer refresh is unverified.";
  $("solverScore").textContent=result.score.toLocaleString();
  $("solverMoves").textContent=result.moves.length;
  $("solverNote").textContent="Experimental beam search (12 states, 18 moves maximum). Slot arrangement is unchanged pending validation; all sushi tiers are hypothetical, not taken from inventory. Cooking or creating sushi during a combo resets the meter; Salt Shaker scoring is excluded. This score is NOT a proven maximum.";
  $("solverSteps").replaceChildren();
  const make=(label,tiles)=>{const h=document.createElement("h3");h.textContent=label;$("solverSteps").append(h);const g=document.createElement("div");g.className="mini-grid";tiles.forEach((v,i)=>{const e=document.createElement("span");e.textContent=v||"·";e.className="mini-cell";e.title="Slot "+(i+1);g.append(e);});$("solverSteps").append(g);};
  make("1 · Slot positions (current, not optimized)",slots.map(x=>x<0?0:["R","H","C","M"][x]));
  make("2 · Hypothetical starting sushi tiers",board);
  const h=document.createElement("h3");h.textContent="3 · Suggested merges (experimental)";$("solverSteps").append(h);
  result.moves.forEach((m,i)=>{const p=document.createElement("p");const t=timing.events[i];p.textContent=(i+1)+". Move slot "+(m.src+1)+" → "+(m.dst+1)+" · +"+m.score+" points ("+m.events.filter(e=>e.kind==="wind").length+" wind upgrades) · "+t.estimatedSeconds.toFixed(1)+"s estimated · "+(t.safe?"within timeout":"TIMEOUT RISK");p.className=t.safe?"":"timing-bad";$("solverSteps").append(p);});
  if(!result.moves.length){const p=document.createElement("p");p.textContent="No merge sequence found under these assumptions.";$("solverSteps").append(p);}
}
$("runSolver").addEventListener("click",showSolver);
