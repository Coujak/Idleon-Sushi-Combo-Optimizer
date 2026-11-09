const $=id=>document.getElementById(id);
const COLUMNS=15;
let imported=null;
let customBoard=null;
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
const SUSHI_IMAGE_DIR="assets/sushi/";
function addSushiVisual(cell,tier){
  if(!Number.isInteger(tier)||tier<1||tier>64)return;
  const img=document.createElement("img");
  img.className="sushi-art";
  img.src=SUSHI_IMAGE_DIR+"Sushi_Station_Sushi_"+tier+".png";
  img.alt="";
  img.loading="lazy";
  img.decoding="async";
  img.onerror=()=>{img.remove();cell.classList.add("sushi-art-missing");};
  const number=document.createElement("span");
  number.className="tier";number.textContent=tier;
  cell.append(img,number);
}
const FIRE_NAMES=["Orange · Charcoal Fireplace","Green · Barium Firelighter","Blue · Copper Firelighter","Pink · Lithium Firelighter","Purple · Potassium Firelighter"];
const FIRE_IMAGES=["SushiUpg23.png","SushiUpg27.png","SushiUpg24.png","SushiUpg26.png","SushiUpg25.png"];
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
      addSushiVisual(cell,id+1);
      if(isPerfecto){const mark=document.createElement("img");mark.className="perfecto-mark";mark.src="assets/Perfecto_Symbol.png";mark.alt="Perfecto";mark.title="Perfecto";mark.loading="lazy";cell.append(mark);}
    }else if(slot>=0){cell.textContent="·";}
    cell.title="Position "+(i+1)+" · "+(SLOT_NAMES[slot]??"Locked")+(id>=0?" · Tier "+(id+1):" · Empty")+(id>=0&&perfecto?.[id]>0?" · Perfecto":"");
    board.append(cell);
  }
  const fireRow=document.createElement("div");fireRow.className="fire-row";
  for(let i=0;i<COLUMNS;i++){
    const f=fires[i]??-1,cell=document.createElement("div");cell.className="fire-cell"+(f>=0?" fire-"+f:"");
    if(f>=0&&f<FIRE_IMAGES.length){
      const img=document.createElement("img");img.className="campfire-art";img.src="assets/campfires/"+FIRE_IMAGES[f];img.alt=FIRE_NAMES[f];img.loading="lazy";img.onerror=()=>{img.remove();cell.textContent="♨";};cell.append(img);
    }
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
  imported=parsed;customBoard=null;$("importError").classList.add("hidden");
  renderBoard(parsed.tiles,parsed.perfecto,parsed.slots,parsed.fires);
  if($("baseTier").value==="custom")renderCustomEditor();
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
$("clearImport").addEventListener("click",()=>{imported=null;customBoard=null;$("solver").classList.add("hidden");$("jsonInput").value="";$("jsonFile").value="";$("board").replaceChildren();$("fireplaces").replaceChildren();$("importSummary").classList.add("hidden");$("pasteArea").classList.add("hidden");$("pasteToggle").setAttribute("aria-expanded","false");$("importStatus").textContent="Waiting for data";$("importStatus").classList.remove("success");$("boardStatus").textContent="Import a save";$("boardDetails").textContent="Your imported tiles will appear here.";$("jsonPreview").textContent="No JSON imported yet.";});

/* Experimental scoring: sum resulting tiers, including each Heat upgrade.
   Gameplay rules: merge source tier <=58 triggers a descending domino chain,
   across row boundaries, up to 25 upgrades. */
function simulateMerge(board,src,dst,cap,chainLimit){
  if(src===dst||board[src]<1||board[src]!==board[dst]||board[src]>=64)return null;
  const next=board.slice(),before=next[dst];
  next[src]=0;next[dst]=before+1;
  let score=next[dst];
  const events=[{at:dst,tier:next[dst],kind:"merge"}];
  if(before<=cap){
    let previous=before;
    for(let q=dst+1;q<next.length&&events.length-1<chainLimit;q++){
      const tier=next[q];
      // First eastern sushi receives Heat regardless of its tier.
      // Subsequent dominoes require strictly descending ORIGINAL tiers.
      if(tier<1||tier>=64||(q>dst+1&&tier!==previous-1))break;
      next[q]=tier+1;
      score+=next[q];
      events.push({at:q,tier:next[q],kind:"wind"});
      previous=tier;
    }
  }
  return {board:next,score,events,src,dst};
}
function buildCandidates(positions,maxTier,cap,selectedBase=0){
  const result=[],occupied=new Set(positions),blocked=positions.filter(p=>p>=0);
  const fixed=blocked[blocked.length-1];
  const add=(name,base,shape)=>{
    const board=Array(120).fill(0);
    positions.forEach(p=>board[p]=base);
    const usable=positions.filter(p=>p!==fixed);
    if(shape==="staircase"){
      // User's 40k board: descending staircase in physical board order,
      // then base-tier sushi. Do not overwrite the permanent Tier 64.
      const length=Math.min(cap-base+1,usable.length-2);
      for(let i=0;i<length;i++)board[usable[i]]=cap-i;
    }else if(shape==="paired"){
      for(let i=0;i<usable.length;i++)board[usable[i]]=Math.max(base,cap-Math.floor((i%30)/2));
    }else if(shape==="uniform"){
      // Uniform baseline tests whether short cascades outperform long ramps.
    }
    if(fixed!==undefined&&maxTier>=64)board[fixed]=64;
    result.push({name,board,base,shape});
  };
  for(let base=Math.max(1,selectedBase||cap-33);base<=Math.min(cap-1,maxTier,selectedBase||64);base++){
    add("Tier "+base+" → "+cap+" staircase",base,"staircase");
    add("Tier "+base+" paired ramp",base,"paired");
    add("Tier "+base+" uniform",base,"uniform");
  }
  return result;
}
function searchCombos(start,cap,chainLimit,beamWidth,depth,mode="adjacent"){
  // Multiple deterministic policies reduce the chance of one greedy dead-end.
  let best=null;
  for(let policy=0;policy<4;policy++){
    let board=start.slice(),score=0,moves=[];
    for(let step=0;step<depth;step++){
      const byTier=new Map();
      board.forEach((tier,i)=>{if(tier>0&&tier<64){if(!byTier.has(tier))byTier.set(tier,[]);byTier.get(tier).push(i);}});
      let chosen=null,rank=-Infinity;
      for(const [tier,indices] of byTier){
        if(indices.length<2)continue;
        for(const dst of indices){
          const east=dst+1;
          const sources=indices.filter(i=>i!==dst);
          sources.sort((a,b)=>Math.abs(a-dst)-Math.abs(b-dst));
          for(const src of sources.slice(0,Math.min(4,sources.length))){
            const move=simulateMerge(board,src,dst,cap,chainLimit);
            if(!move)continue;
            const wind=move.events.length-1;
            const continues=east<120&&move.board[east]===move.board[dst]&&move.board[dst]<64;
            const pairs=new Map();
            move.board.forEach(t=>{if(t>0&&t<64)pairs.set(t,(pairs.get(t)||0)+1);});
            const remainingPairs=[...pairs.values()].reduce((sum,n)=>sum+Math.floor(n/2),0);
            const r=(continues?3000:0)+wind*(policy===0?350:policy===1?150:500)+
              (src===dst-1?400:0)+(policy===2?move.score*5:policy===3?remainingPairs*20:0)+
              (policy===1?-tier:0)-Math.abs(src-dst)*.1;
            if(r>rank){rank=r;chosen=move;}
          }
        }
      }
      if(!chosen)break;
      board=chosen.board;score+=chosen.score;moves.push(chosen);

    }
    const result={board,score,moves,remaining:board.filter(t=>t>0).length};
    if(!best||result.score>best.score||(result.score===best.score&&result.remaining<best.remaining))best=result;
  }
  return best;
}
function optimizePreparation(positions,maxTier,cap,chainLimit,mode,selectedBase){
  let best=null;
  const candidates=buildCandidates(positions,maxTier,cap,selectedBase);
  for(const candidate of candidates){
    const search=searchCombos(candidate.board,cap,chainLimit,4,positions.length-1,mode);
    if(!best||search.score>best.search.score||(search.score===best.search.score&&search.remaining<best.search.remaining))best={...candidate,search};
  }
  return {...best,testedCandidates:candidates.length};
}
function getCustomBoard(){
  if(!imported)return null;
  if(!customBoard){
    customBoard=Array(120).fill(0);
    imported.slots.forEach((type,i)=>{if(i<120&&type>=0)customBoard[i]=Math.max(0,(imported.tiles[i]??-1)+1);});
  }
  return customBoard;
}
function renderCustomEditor(){
  if(!imported)return;
  const grid=$("customBoard");grid.replaceChildren();
  const board=getCustomBoard(),slots=imported.slots;
  const last=slots.findLastIndex(v=>v>=0);
  for(let i=0;i<=last;i++){
    const type=slots[i]??-1,tier=board[i];
    const cell=document.createElement("button");cell.type="button";
    cell.className="tile custom-tile"+(type>=0?" slot-"+type:" locked")+(tier===0?" empty":"");
    cell.disabled=type<0;
    if(tier>0)addSushiVisual(cell,tier);else cell.textContent="·";
    cell.title="Position "+(i+1)+" · "+(tier?"Tier "+tier:"Empty")+" · Click to paint selected tier";
    cell.setAttribute("aria-label",cell.title);
    cell.addEventListener("click",()=>{
      const value=Number($("paintTier").value);
      if(!Number.isInteger(value)||value<0||value>64)return;
      board[i]=value;renderCustomEditor();
    });
    grid.append(cell);
  }
  const occupied=board.filter(v=>v>0).length;
  $("customStatus").textContent=occupied+" sushi placed · "+slots.filter(v=>v>=0).length+" unlocked slots";
}
$("baseTier").addEventListener("change",()=>{
  const custom=$("baseTier").value==="custom";
  $("customEditor").classList.toggle("hidden",!custom);
  if(custom&&imported)renderCustomEditor();
});
$("paintTier").addEventListener("change",()=>{
  const n=Number($("paintTier").value);
  if(!Number.isInteger(n)||n<0||n>64)$("paintTier").value="41";
});
$("customFromSave").addEventListener("click",()=>{
  if(!imported)return;
  customBoard=null;renderCustomEditor();
});
$("customFill").addEventListener("click",()=>{
  if(!imported)return;
  const value=Number($("paintTier").value);
  if(!Number.isInteger(value)||value<0||value>64)return;
  const board=getCustomBoard();
  imported.slots.forEach((type,i)=>{if(i<120&&type>=0&&board[i]!==64)board[i]=value;});
  renderCustomEditor();
});
$("customClear").addEventListener("click",()=>{
  if(!imported)return;
  const board=getCustomBoard();
  imported.slots.forEach((type,i)=>{if(i<120&&type>=0&&board[i]!==64)board[i]=0;});
  renderCustomEditor();
});
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
  const chain=Math.min(25,Math.max(0,Number($("chainLimit").value)||0));
  const maxTier=Math.min(64,Math.max(1,Number($("seedTier").value)||64));
  const slots=imported.slots.slice(0,120);
  const positions=slots.map((v,i)=>v>=0?i:-1).filter(i=>i>=0);
  if(positions.length<2){$("solverNote").textContent="At least two unlocked slots are required.";$("solverSteps").replaceChildren();return;}
  $("solverNote").textContent="Searching prepared tier layouts…";
  const mode="descending domino";
  const custom=$("baseTier").value==="custom";
  const selectedBase=custom?0:(Number($("baseTier").value)||0);
  const solution=custom?(()=>{
    const board=getCustomBoard().slice();
    if(board.filter(v=>v>0).length<2)throw Error("Place at least two sushi on the custom board.");
    const search=searchCombos(board,cap,chain,4,board.filter(v=>v>0).length-1,mode);
    return {board,base:"custom",shape:"user-defined",name:"Custom board",search,testedCandidates:1};
  })():optimizePreparation(positions,maxTier,cap,chain,mode,selectedBase);
  if(!solution||!solution.search)throw Error("No valid preparations for these tier settings.");
  const result=solution.search;
  const timeout=Math.max(.1,Number($("comboTimeout").value)||5.5);
  const moveTime=Math.max(.1,Number($("mergeTime").value)||1.5);
  const timing=validateTiming(result.moves,timeout,moveTime);
  $("timingStatus").textContent=timing.valid?"Timing feasible under assumptions":"Timing infeasible under assumptions";
  $("timingStatus").className=timing.valid?"timing-good":"timing-bad";
  $("timingDetails").textContent="Estimated execution: "+timing.totalDuration.toFixed(1)+"s · Per-merge margin: "+(timing.minimumMargin===null?"—":timing.minimumMargin.toFixed(1)+"s")+" · Assumes timer refreshes after each manual merge.";
  $("solverScore").textContent=result.score.toLocaleString();
  $("solverMoves").textContent=result.moves.length;
  $("solverNote").textContent=(custom?"Custom board · best of 4 merge policies. ":"Best of "+solution.testedCandidates+" preparations (base Tier "+solution.base+", "+solution.shape+"). ")+result.remaining+" occupied sushi remain. Heat model: "+mode+". Scores are experimental and NOT verified in-game; this heuristic does not guarantee the highest possible score.";
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
      if(slot>=0&&showTiers&&tier>0){addSushiVisual(cell,tier);}
      else if(slot>=0&&!showTiers){const dot=document.createElement("span");dot.className="slot-marker";dot.textContent="•";cell.append(dot);}
      cell.title="Position "+(i+1)+" · "+(SLOT_NAMES[slot]??"Locked")+(showTiers&&tier>0?" · Tier "+tier:"");
      grid.append(cell);
    }
    scroll.append(grid);root.append(scroll);
  }
  make("1 · Slot layout (existing positions; equivalent under current combo rules)",[],false);
  make(custom?"2 · Your custom starting board":"2 · Recommended prepared sushi tiers (not your current inventory)",solution.board,true);
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
      if(type>=0&&tier>0){addSushiVisual(tile,tier);}
      tile.title="Position "+(i+1)+" · "+(SLOT_NAMES[type]??"Locked")+(tier?" · Tier "+tier:" · Empty")+(changes.has(i)?" · "+changes.get(i):"");
      boardGrid.append(tile);
    }
    if(actualInput.value!=="")actualInput.dispatchEvent(new Event("input"));
    scoreLine.textContent="Combo Meter: "+cumulative[selected].toLocaleString()+" points"+(move?" · This merge: +"+move.score:" · Ready to begin");
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
