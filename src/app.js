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
  imported=parsed;$("importError").classList.add("hidden");
  renderBoard(parsed.tiles,parsed.perfecto,parsed.slots,parsed.fires);
  $("solver").classList.remove("hidden");
  $("solverNote").textContent="JSON loaded. Click Run optimizer to calculate a suggested preparation and merge sequence.";
  $("solverScore").textContent="—";$("solverMoves").textContent="—";$("solverSteps").replaceChildren();
  $("importStatus").textContent="JSON imported";$("importStatus").classList.add("success");
  $("importSummary").textContent=label+" · "+parsed.source+" · "+parsed.tiles.filter(n=>n>=0).length+" occupied sushi slots decoded (120-slot storage).";
  $("importSummary").classList.remove("hidden");
  $("jsonPreview").textContent=JSON.stringify({source:parsed.source,sushiArrayLengths:parsed.sushi.map(x=>Array.isArray(x)?x.length:null),firstTiles:parsed.tiles.slice(0,30),slotTypes:parsed.slots,fireTypes:parsed.fires,perfectoFlags:parsed.perfecto?.slice(0,70)??null},null,2);
}
function error(e){$("importStatus").textContent="Import failed";$("importStatus").classList.remove("success");$("jsonPreview").textContent=String(e.message??e);$("importSummary").classList.add("hidden");$("importError").textContent="JSON import error: "+String(e.message??e);$("importError").classList.remove("hidden");}
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
        // Every destination is considered, with a deterministic source choice.
        // Source identity has no effect on the immediate merge, except its empty position.
        for(const dst of indices.slice(0,24)){
          const sources=indices.filter(i=>i!==dst);
          sources.sort((a,b)=>((a%COLUMNS===0?1:0)-(b%COLUMNS===0?1:0))||a-b);
          for(const src of sources.slice(0,2)){
            const result=simulateMerge(st.board,src,dst,cap,chainLimit);
            if(!result)continue;
            const key=result.board.join(",");
            if(seen.has(key))continue;seen.add(key);
            const state={board:result.board,score:st.score+result.score,moves:[...st.moves,result]};
            candidates.push(state);
            if(state.score>best.score)best=state;
          }
        }
      }
    }
    if(!candidates.length)break;
    candidates.sort((a,b)=>b.score-a.score);
    states=candidates.slice(0,beamWidth);
  }
  return best;
}
function buildCandidates(positions,maxTier,cap){
  const result=[];
  const base=Math.min(maxTier,Math.max(2,cap));
  const add=(name,make)=>{const board=Array(120).fill(0);positions.forEach(p=>board[p]=Math.max(1,Math.min(maxTier,Math.round(make(p,Math.floor(p/COLUMNS),p%COLUMNS)))));result.push({name,board});};
  add("Uniform high-tier pairs",()=>maxTier);
  add("Alternating high tiers",p=>maxTier-(p%2));
  add("Descending eastward staircase",(p,r,c)=>base-c);
  add("Ascending eastward staircase",(p,r,c)=>base-14+c);
  add("Paired staircase",(p,r,c)=>base-Math.floor(c/2));
  add("Alternating row staircase",(p,r,c)=>base-(r%2===0?c:14-c));
  add("High-tier merge anchors",(p,r,c)=>c<2?base:base-c+1);
  add("Alternating anchors",(p,r,c)=>c%3===0?base:base-c%3);
  add("Tier 64 pairs and wind ramps",(p,r,c)=>c<2?maxTier:base-c+2);
  add("Paired high tiers and ramps",(p,r,c)=>c<4?maxTier:base-c+4);
  // Recording-inspired layouts: tier ladders are prepared row-by-row,
  // with repeated merge anchors and eastward lower-tier sushi.
  add("Repeated eastward staircase",(p,r,c)=>base-(c%8));
  add("Staggered staircase",(p,r,c)=>base-((c+r%4)%12));
  add("Double-anchor staircase",(p,r,c)=>c<2?base:base-Math.ceil((c-1)/2));
  add("Low-tier staircase",(p,r,c)=>Math.max(2,Math.min(base,16)-c));
  add("Low-tier paired staircase",(p,r,c)=>Math.max(2,Math.min(base,16)-Math.floor(c/2)));
  add("Row-shifted tier ladders",(p,r,c)=>base-((c+2*r)%15));
  return result;
}
function optimizePreparation(positions,maxTier,cap,chainLimit){
  let best=null;
  for(const candidate of buildCandidates(positions,maxTier,cap)){
    const search=searchCombos(candidate.board,cap,chainLimit,3,Math.min(positions.length-1,12));
    if(!best||search.score>best.search.score)best={...candidate,search};
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
  const maxTier=Math.min(64,Math.max(1,Number($("seedTier").value)||64));
  const slots=imported.slots.slice(0,120);
  const positions=slots.map((v,i)=>v>=0?i:-1).filter(i=>i>=0);
  if(positions.length<2){$("solverNote").textContent="At least two unlocked slots are required.";$("solverSteps").replaceChildren();return;}
  $("solverNote").textContent="Searching prepared tier layouts…";
  const solution=optimizePreparation(positions,maxTier,cap,chain);
  const result=solution.search;
  const timeout=Math.max(.1,Number($("comboTimeout").value)||5.5);
  const moveTime=Math.max(.1,Number($("mergeTime").value)||1.5);
  const timing=validateTiming(result.moves,timeout,moveTime);
  $("timingStatus").textContent=timing.valid?"Timing feasible under assumptions":"Timing infeasible under assumptions";
  $("timingStatus").className=timing.valid?"timing-good":"timing-bad";
  $("timingDetails").textContent="Estimated execution: "+timing.totalDuration.toFixed(1)+"s · Per-merge margin: "+(timing.minimumMargin===null?"—":timing.minimumMargin.toFixed(1)+"s")+" · Assumes timer refreshes after each manual merge.";
  $("solverScore").textContent=result.score.toLocaleString();
  $("solverMoves").textContent=result.moves.length;
  $("solverNote").textContent="Best of 16 prepared-tier patterns: "+solution.name+". This is a bounded heuristic, NOT a proven global maximum. Slot type does not currently change the simulated combo score, so the existing slot layout is equally optimal under this model. Wind chaining and scoring still require in-game verification.";
  const root=$("solverSteps");root.replaceChildren();
  function make(label,values,showTiers){
    const h=document.createElement("h3");h.textContent=label;root.append(h);
    const legend=document.createElement("p");legend.className="hint";legend.textContent="Green: Regular · Red: Hot · Blue: Cold · Gold: Milktoast. Hover over a tile for its slot type and position.";root.append(legend);
    const scroll=document.createElement("div");scroll.className="board-scroll optimizer-board-scroll";
    const grid=document.createElement("div");grid.className="board optimizer-board";
    const last=slots.findLastIndex(v=>v>=0);
    for(let i=0;i<=last;i++){
      const slot=slots[i]??-1,tier=values[i]??0;
      const cell=document.createElement("div");
      cell.className="tile"+(slot>=0?" slot-"+slot:" locked")+(showTiers&&tier<1?" empty":"");
      if(slot>=0&&showTiers&&tier>0){const number=document.createElement("span");number.className="tier";number.textContent=tier;cell.append(number);}
      else if(slot>=0&&!showTiers){const dot=document.createElement("span");dot.className="slot-marker";dot.textContent="•";cell.append(dot);}
      cell.title="Position "+(i+1)+" · "+(SLOT_NAMES[slot]??"Locked")+(showTiers&&tier>0?" · Tier "+tier:"");
      grid.append(cell);
    }
    scroll.append(grid);root.append(scroll);
  }
  make("1 · Slot layout (existing positions; equivalent under current combo rules)",[],false);
  make("2 · Recommended prepared sushi tiers (not your current inventory)",solution.board,true);
  const heading=document.createElement("h3");heading.textContent="3 · Interactive merge sequence";root.append(heading);
  const intro=document.createElement("p");intro.className="hint";intro.textContent="Select a step on the right to see the board after that merge. Blue = consumed source, green = destination, purple = Heat of the East Wind upgrades. Step 0 is the prepared board.";root.append(intro);
  const layout=document.createElement("div");layout.className="merge-layout";
  const left=document.createElement("div");left.className="merge-board-panel";
  const controls=document.createElement("div");controls.className="merge-controls";
  const previous=document.createElement("button");previous.className="button secondary";previous.textContent="← Previous";
  const next=document.createElement("button");next.className="button secondary";next.textContent="Next →";
  const indicator=document.createElement("strong");indicator.setAttribute("aria-live","polite");
  controls.append(previous,indicator,next);left.append(controls);
  const boardScroll=document.createElement("div");boardScroll.className="board-scroll optimizer-board-scroll";
  const boardGrid=document.createElement("div");boardGrid.className="board optimizer-board merge-board";
  boardScroll.append(boardGrid);left.append(boardScroll);
  const scoreLine=document.createElement("p");scoreLine.className="merge-score";left.append(scoreLine);
  const right=document.createElement("div");right.className="merge-step-list";right.setAttribute("aria-label","Merge steps");
  layout.append(left,right);root.append(layout);
  const cumulative=[0];for(const m of result.moves)cumulative.push(cumulative[cumulative.length-1]+m.score);
  const comparison=document.createElement("div");comparison.className="replay-comparison";
  const compareLabel=document.createElement("label");compareLabel.textContent="Observed in-game combo score ";
  const actualInput=document.createElement("input");actualInput.type="number";actualInput.min="0";actualInput.step="1";actualInput.placeholder="Enter actual score";
  const comparisonText=document.createElement("p");comparisonText.className="hint";comparisonText.textContent="Enter the Combo Meter score observed at the selected step to compare the simulation against gameplay. Different starting boards are not directly comparable.";
  compareLabel.append(actualInput);comparison.append(compareLabel,comparisonText);left.append(comparison);
  actualInput.addEventListener("input",()=>{
    const actual=actualInput.value===""?null:Number(actualInput.value);
    if(actual===null||!Number.isFinite(actual)){comparisonText.textContent="Enter the Combo Meter score observed at the selected step to compare against gameplay.";return;}
    const predicted=cumulative[selected];
    comparisonText.textContent="At step "+selected+": simulated "+predicted.toLocaleString()+" · observed "+actual.toLocaleString()+" · difference "+(predicted-actual).toLocaleString()+" points. Only meaningful if the starting board and moves match the recording.";
  });

  let selected=0;
  const stepButtons=[];
  function displayStep(step){
    selected=Math.max(0,Math.min(result.moves.length,step));
    indicator.textContent="Step "+selected+" / "+result.moves.length;
    previous.disabled=selected===0;next.disabled=selected===result.moves.length;
    const current=selected===0?solution.board:result.moves[selected-1].board;
    const move=selected>0?result.moves[selected-1]:null;
    const changes=new Map();
    if(move){changes.set(move.src,"source");changes.set(move.dst,"destination");for(const e of move.events)if(e.kind==="wind")changes.set(e.at,"wind");}
    boardGrid.replaceChildren();
    const last=slots.findLastIndex(v=>v>=0);
    for(let i=0;i<=last;i++){
      const type=slots[i]??-1,tier=current[i]??0;
      const tile=document.createElement("div");
      tile.className="tile"+(type>=0?" slot-"+type:" locked")+(tier<1?" empty":"")+(changes.has(i)?" merge-"+changes.get(i):"");
      if(type>=0&&tier>0){const n=document.createElement("span");n.className="tier";n.textContent=tier;tile.append(n);}
      tile.title="Position "+(i+1)+" · "+(SLOT_NAMES[type]??"Locked")+(tier?" · Tier "+tier:" · Empty")+(changes.has(i)?" · "+changes.get(i):"");
      boardGrid.append(tile);
    }
    if(actualInput.value!=="")actualInput.dispatchEvent(new Event("input"));
    scoreLine.textContent="+cumulative[selected].toLocaleString()+" points"+(move?" · This merge: +"+move.score:" · Ready to begin");
    stepButtons.forEach((b,i)=>{b.classList.toggle("selected",i===selected);b.setAttribute("aria-current",i===selected?"step":"false");});
    stepButtons[selected]?.scrollIntoView({block:"nearest",behavior:"auto"});
  }
  function addStep(title,detail,index){
    const button=document.createElement("button");button.type="button";button.className="merge-step";
    const name=document.createElement("strong");name.textContent=title;
    const description=document.createElement("span");description.textContent=detail;
    button.append(name,description);button.addEventListener("click",()=>displayStep(index));
    right.append(button);stepButtons.push(button);
  }
  addStep("Step 0 · Prepared board","All sushi positioned; combo not started",0);
  result.moves.forEach((m,i)=>{
    addStep("Step "+(i+1)+" · "+(m.src+1)+" → "+(m.dst+1),
      "+"+m.score+" points · Total "+cumulative[i+1]+" · "+m.events.filter(e=>e.kind==="wind").length+" wind upgrades · "+(timing.events[i].safe?"Timing OK":"Timeout risk"),i+1);
  });
  previous.addEventListener("click",()=>displayStep(selected-1));
  next.addEventListener("click",()=>displayStep(selected+1));
  displayStep(0);
}
$("runSolver").addEventListener("click",()=>{
  if(!imported){$("solverNote").textContent="Import a valid Idleon Toolbox JSON first.";return;}
  const button=$("runSolver");button.disabled=true;button.textContent="Optimizing…";
  $("solverNote").textContent="Searching candidate layouts…";
  setTimeout(()=>{try{showSolver();}catch(e){$("solverNote").textContent="Optimizer error: "+String(e.message??e);}finally{button.disabled=false;button.textContent="Run optimizer";}},20);
});
