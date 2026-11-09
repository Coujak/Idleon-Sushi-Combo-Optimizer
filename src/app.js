import {simulateMerge,validateComboReplay,searchStaircaseCombos} from "./optimizer-core.mjs?v=1.7.0";
import {searchTacticalCombos} from "./tactical-search.mjs?v=1.7.0";
import {createReplayController} from "./replay-controller.mjs?v=1.7.4";
import {buildCandidates} from "./preparation-core.mjs?v=1.7.5";
import {getModeCandidates} from "./optimizer-modes.mjs?v=1.8.1";
import {throwIfCancelled,yieldToUI} from "./optimizer-run.mjs?v=1.8.1";
import {searchCombos} from "./merge-search.mjs?v=1.8.0";
const $=id=>document.getElementById(id);
const COLUMNS=15;
const MAX_PLAYABLE_SLOTS=100;
let imported=null;
let customBoard=null;
let replayCleanup=()=>{};
let activeSearch=null;
function cancelRunningSearch(){activeSearch?.abort();}
function disposeReplay(){replayCleanup();replayCleanup=()=>{};}
function decodeSave(input){
  if(!input||typeof input!=="object")throw Error("Expected a JSON object.");
  const raw=input.data?.Sushi??input.Sushi;
  if(raw==null)throw Error("No Sushi data found. Expected data.Sushi (Idleon Toolbox) or Sushi (raw game data).");
  let sushi=typeof raw==="string"?JSON.parse(raw):raw;
  if(!Array.isArray(sushi)||!Array.isArray(sushi[0]))throw Error("Sushi data does not contain the expected tile array.");
  if(!sushi[0].every(x=>Number.isInteger(Number(x))))throw Error("Sushi tile array contains non-numeric entries.");
  // The final five locations of the 7x15 visual grid are not playable.
  // Never count game-data entries outside the first 100 as owned slots.
  const tiles=Array(120).fill(-1),slots=Array(120).fill(-1);
  for(let i=0;i<Math.min(MAX_PLAYABLE_SLOTS,sushi[0].length);i++)tiles[i]=Number(sushi[0][i]);
  if(Array.isArray(sushi[1])){
    for(let i=0;i<Math.min(MAX_PLAYABLE_SLOTS,sushi[1].length);i++)slots[i]=Number(sushi[1][i]);
  }
  return {sushi,tiles,perfecto:Array.isArray(sushi[5])?sushi[5].map(Number):null,slots,fires:Array.isArray(sushi[3])?sushi[3].slice(0,15).map(Number):[],source:input.data?.Sushi!=null?"Idleon Toolbox":"Raw game data"};
}
function detectSushiProgress(save){
  // Sushi[0] stores tier IDs on the board (zero-based). Do not mistake
  // upgrade levels or knowledge EXP arrays for unlocked-tier flags.
  const highestOnBoard=Math.max(0,...save.tiles.filter(n=>Number.isInteger(n)&&n>=0).map(n=>n+1));
  const highest=highestOnBoard;
  return {highest,highestOnBoard,source:"Highest sushi found on board (fallback)",windCap:Math.max(0,highest-6)};
}
function applyImportedLimits(){
  if(!imported)return;
  const progress=detectSushiProgress(imported);
  if(progress.highest<1){$("seedTier").value="";$("windCap").value="";return;}
  $("seedTier").value=String(progress.highest);
  $("windCap").value=String(progress.windCap);
  $("seedTier").title=progress.source;
  $("windCap").title="Highest unlocked sushi tier minus 6";
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
  cancelRunningSearch();
  disposeReplay();
  imported=parsed;customBoard=null;applyImportedLimits();$("importError").classList.add("hidden");
  renderBoard(parsed.tiles,parsed.perfecto,parsed.slots,parsed.fires);
  if($("baseTier").value==="custom")renderCustomEditor();
  $("solver").classList.remove("hidden");
  $("solverNote").textContent="JSON loaded. Click Run optimizer to calculate a suggested preparation and merge sequence.";
  $("solverScore").textContent="—";$("solverMoves").textContent="—";$("solverSteps").replaceChildren();
  $("importStatus").textContent="JSON imported";$("importStatus").classList.add("success");
  const tierProgress=detectSushiProgress(parsed);
  $("importSummary").textContent=label+" · "+parsed.source+" · "+parsed.tiles.filter(n=>n>=0).length+" occupied sushi slots decoded · Tier "+tierProgress.highest+" detected ("+tierProgress.source+") · Wind limit "+tierProgress.windCap+". If the player has unlocked higher tiers not present on the board, correct the Maximum prepared tier field.";
  $("importSummary").classList.remove("hidden");
  $("jsonPreview").textContent=JSON.stringify({source:parsed.source,sushiArrayLengths:parsed.sushi.map(x=>Array.isArray(x)?x.length:null),firstTiles:parsed.tiles.slice(0,30),slotTypes:parsed.slots,fireTypes:parsed.fires,perfectoFlags:parsed.perfecto?.slice(0,70)??null},null,2);
}
function error(e){$("importStatus").textContent="Import failed";$("importStatus").classList.remove("success");$("jsonPreview").textContent=String(e.message??e);$("importSummary").classList.add("hidden");$("importError").textContent="JSON import error: "+String(e.message??e);$("importError").classList.remove("hidden");}
$("pasteToggle").addEventListener("click",()=>{const open=$("pasteArea").classList.toggle("hidden")===false;$("pasteToggle").setAttribute("aria-expanded",String(open));if(open)$("jsonInput").focus();});
$("parseJson").addEventListener("click",()=>{try{importSave(JSON.parse($("jsonInput").value),"Pasted JSON");}catch(e){error(e);}});
$("jsonFile").addEventListener("change",async e=>{const f=e.target.files?.[0];if(!f)return;try{importSave(JSON.parse(await f.text()),f.name);}catch(err){error(err);}});
$("clearImport").addEventListener("click",()=>{cancelRunningSearch();disposeReplay();imported=null;customBoard=null;$("solver").classList.add("hidden");$("jsonInput").value="";$("jsonFile").value="";$("board").replaceChildren();$("fireplaces").replaceChildren();$("importSummary").classList.add("hidden");$("pasteArea").classList.add("hidden");$("pasteToggle").setAttribute("aria-expanded","false");$("importStatus").textContent="Waiting for data";$("importStatus").classList.remove("success");$("boardStatus").textContent="Import a save";$("boardDetails").textContent="Your imported tiles will appear here.";$("jsonPreview").textContent="No JSON imported yet.";});

// Merge physics and staircase recycling live in optimizer-core.mjs.
function layoutOptions(slots){
  const current=slots.slice(0,120).map((v,i)=>i<MAX_PLAYABLE_SLOTS?v:-1);
  const types=current.filter(v=>v>=0);
  const count=types.length;
  const layouts=[{name:"Current positions",slots:current}];
  const options=[
    {name:"Left-packed",positions:Array.from({length:count},(_,i)=>i)},
    {name:"Right-packed",positions:Array.from({length:count},(_,i)=>MAX_PLAYABLE_SLOTS-count+i)},
    {name:"Centered",positions:Array.from({length:count},(_,i)=>Math.floor((MAX_PLAYABLE_SLOTS-count)/2)+i)}
  ];
  for(const option of options){
    const arranged=Array(120).fill(-1);
    // Preserve the exact number of each unlocked plate type.
    option.positions.forEach((p,i)=>{arranged[p]=types[i];});
    if(!layouts.some(l=>l.slots.every((v,i)=>v===arranged[i])))layouts.push({name:option.name,slots:arranged});
  }
  return layouts;
}
// Keep several alternative merge orders alive instead of committing to one
// greedy policy. Only evaluate this more expensive search on the best preparation.
function beamSearchCombos(start,cap,chainLimit,depth,baseline,width=12,branchLimit=12){
  const key=b=>b.join(",");
  const pairCount=b=>{
    const counts=new Uint8Array(65);
    for(const t of b)if(t>0&&t<64)counts[t]++;
    let pairs=0;for(let t=1;t<64;t++)pairs+=Math.floor(counts[t]/2);
    return pairs;
  };
  let best=baseline;
  let frontier=[{board:start,score:0,moves:[],remaining:start.filter(t=>t>0).length}];
  for(let step=0;step<depth&&frontier.length;step++){
    const next=new Map();
    for(const state of frontier){
      const groups=new Map();
      state.board.forEach((t,i)=>{if(t>0&&t<64){if(!groups.has(t))groups.set(t,[]);groups.get(t).push(i);}});
      const choices=[];
      for(const [tier,positions] of groups){
        if(positions.length<2)continue;
        for(const dst of positions){
          for(const src of positions){
            if(src===dst)continue;
            const move=simulateMerge(state.board,src,dst,cap,chainLimit);
            if(!move)continue;
            const future=pairCount(move.board);
            const wind=move.events.length-1;
            const continuation=dst+1<120&&move.board[dst]===move.board[dst+1];
            // Score is primary; future pairs and retained staircase potential break ties.
            const priority=move.score+wind*3+future*3+(continuation?40:0);
            choices.push({move,priority});
          }
        }
      }
      choices.sort((a,b)=>b.priority-a.priority);
      for(const {move} of choices.slice(0,branchLimit)){
        const score=state.score+move.score;
        const candidate={board:move.board,score,moves:[...state.moves,move],remaining:state.remaining-1};
        if(score>best.score||(score===best.score&&candidate.remaining<best.remaining)){
          best={...candidate,strategy:"Beam search (multi-step)",strategiesTested:baseline.strategiesTested};
        }
        const id=key(move.board);
        const previous=next.get(id);
        if(!previous||score>previous.score)next.set(id,candidate);
      }
    }
    frontier=[...next.values()].sort((a,b)=>(b.score+pairCount(b.board)*8)-(a.score+pairCount(a.board)*8)).slice(0,width);
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
    imported.slots.forEach((type,i)=>{if(i<MAX_PLAYABLE_SLOTS&&type>=0)customBoard[i]=Math.max(0,(imported.tiles[i]??-1)+1);});
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
  imported.slots.forEach((type,i)=>{if(i<MAX_PLAYABLE_SLOTS&&type>=0&&board[i]!==64)board[i]=value;});
  renderCustomEditor();
});
$("customClear").addEventListener("click",()=>{
  if(!imported)return;
  const board=getCustomBoard();
  imported.slots.forEach((type,i)=>{if(i<MAX_PLAYABLE_SLOTS&&type>=0&&board[i]!==64)board[i]=0;});
  renderCustomEditor();
});
function validateTiming(moves,timeout,secondsPerMerge,secondsPerRelocation){
  let elapsed=0,totalDuration=0;
  const events=moves.map((move,index)=>{
    const actionSeconds=move.kind==="move"?secondsPerRelocation:secondsPerMerge;
    elapsed+=actionSeconds;
    totalDuration+=actionSeconds;
    const event={
      step:index+1,estimatedSeconds:actionSeconds,safe:elapsed<timeout,
      remaining:timeout-elapsed,
      windUpgrades:move.events.filter(e=>e.kind==="wind").length
    };
    // Repositioning does not refresh the combo timer. Only merging does.
    if(move.kind!=="move")elapsed=0;
    return event;
  });
  return {events,valid:events.every(e=>e.safe),
    minimumMargin:events.length?Math.min(...events.map(e=>e.remaining)):null,totalDuration};
}
async function showSolver(signal){
  throwIfCancelled(signal);
  if(!imported)return;
  const detected=detectSushiProgress(imported);
  const maxTier=Math.min(64,Math.max(1,Number($("seedTier").value)||detected.highest||1));
  const cap=Math.max(0,maxTier-6);
  $("windCap").value=String(cap);
  const chain=Math.min(25,Math.max(0,Number($("chainLimit").value)||0));
  const slots=imported.slots.slice(0,120).map((v,i)=>i<MAX_PLAYABLE_SLOTS?v:-1);
  const positions=slots.map((v,i)=>v>=0?i:-1).filter(i=>i>=0);
  if(positions.length<2){$("solverNote").textContent="At least two unlocked slots are required.";$("solverSteps").replaceChildren();return;}
  $("solverNote").textContent="Searching prepared tier layouts…";
  const mode="descending domino";
  const optimizerMode=$("optimizerMode").value==="experimental"?"experimental":"default";
  const custom=$("baseTier").value==="custom";
  const selectedBase=custom?0:(Number($("baseTier").value)||0);
  // A Tier 64 from the save stays permanent even if the prepared-tier setting is lowered.
  const protectTier64=maxTier===64||imported.tiles.includes(63);
  const arrangements=custom?[{name:"Current positions",slots}]:layoutOptions(slots);
  const candidates=custom?null:arrangements.flatMap(layout=>{
    const layoutPositions=layout.slots.map((v,i)=>v>=0?i:-1).filter(i=>i>=0);
    const prepared=getModeCandidates(layoutPositions,maxTier,cap,selectedBase,chain,protectTier64,optimizerMode);
    return prepared.map(candidate=>({...candidate,slots:layout.slots,layoutName:layout.name}));
  });
  const total=custom?1:candidates.length;
  if(total<1)throw Error("No valid preparations for these tier settings.");
  let solution=null;
  const progress=(done)=>{
    const pct=Math.round(done/total*100);
    $("optimizerProgressBar").value=done;
    $("optimizerProgressBar").max=total;
    $("optimizerProgressText").textContent=(optimizerMode==="experimental"?"Experimental":"Default")+" · "+pct+"% · "+done+" / "+total+" layouts evaluated";
  };
  progress(0);
  // Yield between candidate evaluations so progress can paint in the browser.
  await yieldToUI(signal);
  if(custom){
    const board=getCustomBoard().slice();
    if(board.filter(v=>v>0).length<2)throw Error("Place at least two sushi on the custom board.");
    const greedy=searchCombos(board,cap,chain,4,board.filter(v=>v>0).length-1,mode);
    await yieldToUI(signal);
    const beam=beamSearchCombos(board,cap,chain,board.filter(v=>v>0).length-1,greedy);
    await yieldToUI(signal);
    let search=searchStaircaseCombos(board,cap,chain,slots,beam);
    await yieldToUI(signal);
    search=searchTacticalCombos(board,cap,chain,slots,search,{depth:14,width:12,branchLimit:16});
    await yieldToUI(signal);
    solution={board,slots,layoutName:"Current positions",base:"custom",shape:"user-defined",name:"Custom board",search,testedCandidates:1};
    progress(1);
  }else{
    for(let i=0;i<candidates.length;i++){
      throwIfCancelled(signal);
      const candidate=candidates[i];
      const greedy=searchCombos(candidate.board,cap,chain,4,positions.length-1,mode);
      const search=searchStaircaseCombos(candidate.board,cap,chain,candidate.slots,greedy);
      if(!solution||search.score>solution.search.score||(search.score===solution.search.score&&search.remaining<solution.search.remaining))solution={...candidate,search};
      progress(i+1);
      await yieldToUI(signal);
    }
    solution={...solution,testedCandidates:candidates.length};
    $("optimizerProgressText").textContent="Refining the best preparation…";
    await yieldToUI(signal);
    solution.search=beamSearchCombos(solution.board,cap,chain,solution.board.filter(v=>v>0).length-1,solution.search);
    await yieldToUI(signal);
    solution.search=searchStaircaseCombos(solution.board,cap,chain,solution.slots,solution.search);
    $("optimizerProgressText").textContent="Checking tactical Wind setups…";
    await yieldToUI(signal);
    solution.search=searchTacticalCombos(solution.board,cap,chain,solution.slots,solution.search,{depth:12,width:12,branchLimit:16});
    await yieldToUI(signal);
  }
  throwIfCancelled(signal);
  if(!solution||!solution.search)throw Error("No valid preparations for these tier settings.");
  const result=solution.search;
  const recommendedSlots=solution.slots??slots;
  const verified=validateComboReplay(solution.board,result.moves,cap,chain,recommendedSlots);
  if(verified.score!==result.score||!verified.board.every((t,i)=>t===result.board[i])){
    throw Error("Combo replay validation disagrees with the optimizer result.");
  }
  const timeout=Math.max(.1,Number($("comboTimeout").value)||5.5);
  const moveTime=Math.max(.1,Number($("mergeTime").value)||1.5);
  const relocationTime=Math.max(.1,Number($("relocationTime").value)||.6);
  const timing=validateTiming(result.moves,timeout,moveTime,relocationTime);
  $("timingStatus").textContent=timing.valid?"Timing feasible under assumptions":"Timing infeasible under assumptions";
  $("timingStatus").className=timing.valid?"timing-good":"timing-bad";
  $("timingDetails").textContent="Estimated execution: "+timing.totalDuration.toFixed(1)+"s · Tightest interval margin: "+(timing.minimumMargin===null?"—":timing.minimumMargin.toFixed(1)+"s")+" · Repositioning does not refresh the combo timer; merging does.";
  $("solverScore").textContent=result.score.toLocaleString();
  $("solverMoves").textContent=verified.merges;
  $("solverRepositions").textContent=verified.repositions;
  $("solverNote").textContent=(custom?"Custom board · staircase recycling, greedy, beam, and tactical reposition searches tested. ":"Best of "+solution.testedCandidates+" preparations (base Tier "+solution.base+", "+solution.shape+"). ")+result.remaining+" occupied sushi remain. Heat model: "+mode+". Scores remain estimates, not a guaranteed maximum.";
  $("solverNote").textContent+=" Mode: "+(optimizerMode==="experimental"?"Experimental":"Default")+". Winning strategy: "+result.strategy+". Slot arrangement: "+(solution.layoutName??"Current positions")+". Prepared tier cap: "+maxTier+"; East Wind limit: "+cap+".";
  if(!custom&&protectTier64)$("solverNote").textContent+=" The permanent Tier 64 is placed in the first unlocked slot of the suggested layout."; 
  const root=$("solverSteps");root.replaceChildren();
  const movedFrom=slots.filter((v,i)=>v>=0&&recommendedSlots[i]<0).length;
  const changedTypes=slots.filter((v,i)=>v>=0&&recommendedSlots[i]>=0&&v!==recommendedSlots[i]).length;
  const layoutInfo=document.createElement("p");layoutInfo.className="hint";
  layoutInfo.textContent="Slot arrangement: "+(solution.layoutName??"Current positions")+". "+movedFrom+" slots need a new position; "+changedTypes+" positions change plate type. Keep all owned plate types. Empty the sushi from any slot before moving it. This is a combo-score comparison, not a Bucks/EXP production forecast.";
  root.append(layoutInfo);
  if(movedFrom||changedTypes){
    const moves=document.createElement("p");moves.className="hint";
    const remove=slots.map((v,i)=>v>=0&&v!==recommendedSlots[i]?i+1:null).filter(Boolean);
    const add=recommendedSlots.map((v,i)=>v>=0&&v!==slots[i]?i+1:null).filter(Boolean);
    moves.textContent="Rearrangement guide (positions counted left to right, top to bottom): Empty sushi from slots being moved. Move plates out of positions "+(remove.join(", ")||"none")+" and place the same plate types into the recommended positions "+(add.join(", ")||"none")+". Use the colored boards below to match each plate type; you may need temporary empty positions to swap plates.";
    root.append(moves);
  }
  function make(label,values,showTiers){
    const h=document.createElement("h3");h.textContent=label;if(label.startsWith("1 ·"))h.id="optimizerSlotLayout";root.append(h);
    const legend=document.createElement("p");legend.className="hint";legend.textContent="Green: Regular · Red: Hot · Blue: Cold · Gold: Milktoast. Hover over a tile for its slot type and position.";root.append(legend);
    const scroll=document.createElement("div");scroll.className="board-scroll optimizer-board-scroll";
    const grid=document.createElement("div");grid.className="board optimizer-board";
    const displaySlots=label.startsWith("0 ·")?slots:recommendedSlots;
    const last=displaySlots.findLastIndex(v=>v>=0);
    for(let i=0;i<=last;i++){
      const slot=displaySlots[i]??-1,tier=values[i]??0;
      const cell=document.createElement("div");
      cell.className="tile"+(slot>=0?" slot-"+slot:" locked")+(showTiers&&tier<1?" empty":"");
      if(slot>=0&&showTiers&&tier>0){addSushiVisual(cell,tier);}
      else if(slot>=0&&!showTiers){const dot=document.createElement("span");dot.className="slot-marker";dot.textContent="•";cell.append(dot);}
      cell.title="Position "+(i+1)+" · "+(SLOT_NAMES[slot]??"Locked")+(showTiers&&tier>0?" · Tier "+tier:"");
      grid.append(cell);
    }
    scroll.append(grid);root.append(scroll);
  }
  make("0 · Current slot layout",[],false);
  make("1 · Recommended slot layout ("+(solution.layoutName??"current")+")",[],false);
  make(custom?"2 · Your custom starting board":"2 · Recommended prepared sushi tiers (not your current inventory)",solution.board,true);
  const heading=document.createElement("h3");heading.textContent="3 · Interactive merge sequence";root.append(heading);
  const intro=document.createElement("p");intro.className="hint";intro.textContent="Watch the combo with Play, or jump between steps yourself. Blue is the source, green the destination, and purple is Heat of the East Wind. Step 0 shows the full board.";root.append(intro);
  const layout=document.createElement("div");layout.className="merge-layout";
  const left=document.createElement("div");left.className="merge-board-panel";
  const controls=document.createElement("div");controls.className="merge-controls";
  const navigation=document.createElement("div");navigation.className="merge-navigation";
  const first=document.createElement("button");first.type="button";first.className="button quiet";first.textContent="↺ Step 0";first.title="Return to the prepared board";
  const previous=document.createElement("button");previous.type="button";previous.className="button secondary";previous.textContent="← Previous";
  const playButton=document.createElement("button");playButton.type="button";playButton.className="button primary merge-play";playButton.textContent="▶ Play";playButton.setAttribute("aria-pressed","false");
  const next=document.createElement("button");next.type="button";next.className="button secondary";next.textContent="Next →";
  const lastStep=document.createElement("button");lastStep.type="button";lastStep.className="button quiet";lastStep.textContent="Last step";lastStep.title="Skip to the final step";
  const indicator=document.createElement("strong");indicator.className="merge-step-indicator";indicator.setAttribute("aria-live","polite");
  navigation.append(first,previous,playButton,next,lastStep);
  controls.append(navigation,indicator);left.append(controls);
  const timeline=document.createElement("div");timeline.className="merge-timeline";
  const seek=document.createElement("input");seek.type="range";seek.className="merge-seek";seek.min="0";seek.max=String(result.moves.length);seek.step="1";seek.value="0";seek.setAttribute("aria-label","Jump to replay step");
  const speedLabel=document.createElement("label");speedLabel.className="merge-speed-label";speedLabel.textContent="Speed";
  const speedSelect=document.createElement("select");speedSelect.setAttribute("aria-label","Playback speed");
  for(const rate of [0.75,1,1.5,2,3]){
    const option=document.createElement("option");option.value=String(rate);option.textContent=rate+"×";
    if(rate===1)option.selected=true;
    speedSelect.append(option);
  }
  speedLabel.append(speedSelect);
  timeline.append(seek,speedLabel);left.append(timeline);
  const boardScroll=document.createElement("div");boardScroll.className="board-scroll optimizer-board-scroll";
  const boardGrid=document.createElement("div");boardGrid.className="board optimizer-board merge-board";
  boardScroll.append(boardGrid);left.append(boardScroll);
  const scoreLine=document.createElement("p");scoreLine.className="merge-score";left.append(scoreLine);
  const right=document.createElement("div");right.className="merge-step-list";right.setAttribute("aria-label","Merge steps");
  layout.append(left,right);root.append(layout);
  const cumulative=[0];for(const m of result.moves)cumulative.push(cumulative[cumulative.length-1]+m.score);

  let selected=0;
  const stepButtons=[];
  function displayStep(step){
    selected=Math.max(0,Math.min(result.moves.length,step));
    indicator.textContent="Step "+selected+" / "+result.moves.length;
    seek.value=String(selected);
    seek.setAttribute("aria-valuetext","Step "+selected+" of "+result.moves.length);
    first.disabled=selected===0;previous.disabled=selected===0;
    next.disabled=selected===result.moves.length;
    lastStep.disabled=selected===result.moves.length;
    const current=selected===0?solution.board:result.moves[selected-1].board;
    const move=selected>0?result.moves[selected-1]:null;
    const changes=new Map(),windOrder=new Map();
    if(move){
      changes.set(move.src,"source");
      changes.set(move.dst,"destination");
      let order=0;
      for(const event of move.events){
        if(event.kind==="wind"){
          changes.set(event.at,"wind");
          windOrder.set(event.at,order++);
        }
      }
    }
    boardGrid.replaceChildren();
    const last=recommendedSlots.findLastIndex(v=>v>=0);
    for(let i=0;i<=last;i++){
      const type=recommendedSlots[i]??-1,tier=current[i]??0;
      const tile=document.createElement("div");
      tile.className="tile"+(type>=0?" slot-"+type:" locked")+(tier<1?" empty":"");
      if(move&&type>=0){
        const change=changes.get(i);
        if(change){
          tile.classList.add("focus-tile","merge-"+change);
          if(change==="wind"){
            tile.classList.add("wind-active");
            const rate=Number(speedSelect.value)||1;
            tile.style.setProperty("--wind-delay",(windOrder.get(i)*65/rate)+"ms");
            tile.style.setProperty("--wind-duration",(650/rate)+"ms");
          }
        }else{
          tile.classList.add("dim-tile");
        }
      }
      if(type>=0&&tier>0)addSushiVisual(tile,tier);
      tile.title="Position "+(i+1)+" · "+(SLOT_NAMES[type]??"Locked")+
        (tier?" · Tier "+tier:" · Empty")+(changes.has(i)?" · "+changes.get(i):"");
      boardGrid.append(tile);
    }
    scoreLine.textContent="Combo Meter: "+cumulative[selected].toLocaleString()+" points"+(move?(move.kind==="move"?" · Reposition · +0":" · This merge: +"+move.score):" · Ready to begin");
    stepButtons.forEach((b,i)=>{b.classList.toggle("selected",i===selected);b.setAttribute("aria-current",i===selected?"step":"false");});
    stepButtons[selected]?.scrollIntoView({block:"nearest",behavior:"auto"});
  }
  function addStep(title,detail,index){
    const button=document.createElement("button");button.type="button";button.className="merge-step";
    const name=document.createElement("strong");name.textContent=title;
    const description=document.createElement("span");description.textContent=detail;
    button.append(name,description);button.addEventListener("click",()=>player.goTo(index));
    right.append(button);stepButtons.push(button);
  }
  addStep("Step 0 · Prepared board","All sushi positioned; combo not started",0);
  result.moves.forEach((m,i)=>{
    const isMove=m.kind==="move";
    addStep("Step "+(i+1)+" · "+(isMove?"Move":"Merge")+" · "+(m.src+1)+" → "+(m.dst+1),
      (isMove?"Move Tier "+m.tier+" to an empty slot · +0 points":"+"+m.score+" points · "+m.events.filter(e=>e.kind==="wind").length+" Wind upgrades")+" · Total "+cumulative[i+1]+" · "+(timing.events[i].safe?"Timing OK":"Timeout risk"),i+1);
  });
  function showPlaybackState(playing){
    playButton.textContent=playing?"⏸ Pause":"▶ Play";
    playButton.setAttribute("aria-pressed",String(playing));
    playButton.classList.toggle("is-playing",playing);
    indicator.setAttribute("aria-live",playing?"off":"polite");
  }
  const player=createReplayController({
    totalSteps:result.moves.length,
    onStep:displayStep,
    onPlayStateChange:showPlaybackState,
    getDelay(step){
      const rate=Number(speedSelect.value)||1;
      const windCount=step>0?result.moves[step-1].events.filter(e=>e.kind==="wind").length:0;
      const windDuration=windCount?((windCount-1)*65+650)/rate:0;
      return Math.max(500,1650/rate,windDuration+240/rate);
    }
  });
  first.addEventListener("click",()=>player.goTo(0));
  previous.addEventListener("click",()=>player.goTo(player.step-1));
  next.addEventListener("click",()=>player.goTo(player.step+1));
  lastStep.addEventListener("click",()=>player.goTo(result.moves.length));
  playButton.addEventListener("click",()=>player.toggle());
  seek.addEventListener("input",()=>player.goTo(Number(seek.value)));
  speedSelect.addEventListener("change",()=>player.reschedule());
  const pauseWhenHidden=()=>{if(document.hidden)player.pause();};
  document.addEventListener("visibilitychange",pauseWhenHidden);
  replayCleanup=()=>{
    player.dispose();
    document.removeEventListener("visibilitychange",pauseWhenHidden);
  };
  showPlaybackState(false);
  displayStep(0);
}
function updateOptimizerModeHint(){
  const experimental=$("optimizerMode").value==="experimental";
  $("optimizerModeHint").textContent=experimental
    ?"Experimental also tests layered Wind reserves on compatible automatic boards. Custom boards use the same search in either mode."
    :"Default uses the original board preparations and merge strategies.";
}
$("optimizerMode").addEventListener("change",updateOptimizerModeHint);
updateOptimizerModeHint();
$("cancelSolver").addEventListener("click",()=>{
  if(!activeSearch)return;
  cancelRunningSearch();
  $("cancelSolver").disabled=true;
  $("cancelSolver").textContent="Stopping…";
  $("optimizerProgressText").textContent="Stopping after the current calculation…";
});
$("runSolver").addEventListener("click",async()=>{
  if(!imported){$("solverNote").textContent="Import a valid Idleon Toolbox JSON first.";return;}
  if(activeSearch)return;
  disposeReplay();
  const controller=new AbortController();
  activeSearch=controller;
  const button=$("runSolver"),cancel=$("cancelSolver");
  button.disabled=true;button.textContent="Optimizing…";
  cancel.classList.remove("hidden");cancel.disabled=false;cancel.textContent="Cancel";
  $("optimizerProgress").classList.remove("hidden");
  $("optimizerProgressBar").value=0;$("optimizerProgressBar").max=1;
  $("optimizerProgressText").textContent="Preparing search…";
  $("solverResults").classList.add("hidden");
  $("solverNote").textContent="Searching candidate layouts…";
  try{
    await showSolver(controller.signal);
    throwIfCancelled(controller.signal);
    $("solverResults").classList.remove("hidden");
    $("optimizerProgressText").textContent="Complete · Results ready";
    requestAnimationFrame(()=>{
      const target=$("optimizerSlotLayout");
      if(target)target.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"});
    });
  }catch(e){
    if(e.name==="AbortError"){
      $("optimizerProgressText").textContent="Search cancelled · Change settings and run again";
      $("solverNote").textContent="Search cancelled. No incomplete results were shown.";
    }else{
      $("solverNote").textContent="Optimizer error: "+String(e.message??e);
      $("optimizerProgressText").textContent="Optimization failed";
    }
  }finally{
    if(activeSearch===controller)activeSearch=null;
    button.disabled=false;button.textContent="Run optimizer";
    cancel.disabled=false;cancel.textContent="Cancel";cancel.classList.add("hidden");
  }
});
