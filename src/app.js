import {simulateMerge,validateComboReplay,searchStaircaseCombos} from "./optimizer-core.mjs?v=1.9.9";
import {searchTacticalCombos} from "./tactical-search.mjs?v=1.9.9";
import {createReplayController} from "./replay-controller.mjs?v=1.7.4";
import {replayMotionTiming} from "./merge-motion.mjs?v=1.15.6";
import {buildCandidates} from "./preparation-core.mjs?v=1.9.9";
import {getModeCandidates} from "./optimizer-modes.mjs?v=1.10.4";
import {searchLookaheadCombos} from "./lookahead-search.mjs?v=1.9.9";
import {throwIfCancelled,yieldToUI} from "./optimizer-run.mjs?v=1.8.1";
import {searchCombos} from "./merge-search.mjs?v=1.9.9";
import {MODE_CATALOG,getModeInfo,modeOptionLabel,modeDisplayLabel} from "./mode-catalog.mjs?v=1.9.11";
const $=id=>document.getElementById(id);
import {BOARD_COLUMNS,BOARD_CELLS,normalizeBoardData,layoutOptions} from "./board-geometry.mjs?v=1.8.4";
import {windTierMaximum,clampWindTier,windTierAfterPreparedChange} from "./wind-limit.mjs?v=1.9.10";
import {initializeSushiLab} from "./lab-ui.mjs?v=1.16.6";
import {sushiTierIconPath} from "./sushi-reference.mjs?v=1.16.6";
import {getPreparedBoardSections,hasSlotLayoutChanges,preparedSectionOutlinePath,preparedOutlineCoordinates} from "./prepared-sections.mjs?v=1.10.7";
const COLUMNS=BOARD_COLUMNS;
let imported=null;
const sushiLab=initializeSushiLab(()=>imported);
let customBoard=null;
let replayCleanup=()=>{};
let preparedOutlineCleanup=()=>{};
let activeSearch=null;
function cancelRunningSearch(){activeSearch?.abort();}
function disposeReplay(){replayCleanup();replayCleanup=()=>{};}
function decodeSave(input){
  if(!input||typeof input!=="object")throw Error("Expected a JSON object.");
  const raw=input.data?.Sushi??input.Sushi;
  if(raw==null)throw Error("No Sushi data found. Expected an exported game save with Sushi data.");
  let sushi=typeof raw==="string"?JSON.parse(raw):raw;
  if(!Array.isArray(sushi)||!Array.isArray(sushi[0]))throw Error("Sushi data does not contain the expected tile array.");
  if(!sushi[0].every(x=>Number.isInteger(Number(x))))throw Error("Sushi tile array contains non-numeric entries.");
  // Preserve all 120 physical positions; only the number of unlocked
  // plates is capped at 100, not their row or column locations.
  const {tiles,slots}=normalizeBoardData(sushi[0],sushi[1]);
  let spelunk=input.data?.Spelunk??input.Spelunk??[];
  if(typeof spelunk==="string"){
    try{spelunk=JSON.parse(spelunk);}catch{spelunk=[];}
  }
  if(!Array.isArray(spelunk))spelunk=[];
  // Menagerie boost index 10 grants 1 Sushi Doubler per level.
  // Other ownership bonuses (bundles / companions) must be counted separately.
  let menagerie=input.data?.Menagerie??input.Menagerie??null;
  if(typeof menagerie==="string"){
    try{menagerie=JSON.parse(menagerie);}catch{menagerie=null;}
  }
  if(!Array.isArray(menagerie))menagerie=null;
  let research=input.data?.Research??input.Research??null;
  if(typeof research==="string"){
    try{research=JSON.parse(research);}catch{research=null;}
  }
  if(!Array.isArray(research))research=null;
  // The game export carries bundle ownership separately from Sushi.
  // Extract only the relevant flag, never keep full purchases in the UI model.
  let bundles=input.data?.BundlesReceived??input.BundlesReceived??null;
  if(typeof bundles==="string"){
    try{bundles=JSON.parse(bundles);}catch{bundles=null;}
  }
  const bundleBonV=bundles&&typeof bundles==="object"&&
    Object.prototype.hasOwnProperty.call(bundles,"bon_v")?
    Number(bundles.bon_v)>0:
    typeof input.bundleBonV==="boolean"?input.bundleBonV:undefined;
  // Processed account exports may carry the authoritative total.
  const sushiDoublerInfo=input.account?.menagerie?.doublers?.sushi
    ??input.data?.menagerie?.doublers?.sushi??null;
  return {sushi,spelunk,menagerie,research,bundleBonV,sushiDoublerInfo,tiles,perfecto:Array.isArray(sushi[5])?sushi[5].map(Number):null,slots,fires:Array.isArray(sushi[3])?sushi[3].slice(0,15).map(Number):[],source:input.data?.Sushi!=null?"Game save export":"Raw game data"};
}
function detectSushiProgress(save){
  // Sushi[0] stores tier IDs on the board (zero-based). Do not mistake
  // upgrade levels or knowledge EXP arrays for unlocked-tier flags.
  const highestOnBoard=Math.max(0,...save.tiles.filter(n=>Number.isInteger(n)&&n>=0).map(n=>n+1));
  const highest=highestOnBoard;
  return {highest,highestOnBoard,source:"Highest sushi found on board (fallback)",windCap:Math.max(0,highest-6)};
}
let previousPreparedTierForWind=Number($("seedTier").value);
function syncWindTierLimit({normalize=false,followMaximum=false}={}){
  const tierField=$("seedTier"),windField=$("windCap");
  const preparedTier=Number(tierField.value);
  // Keep the previous maximum through transient blank or invalid input.
  if(tierField.value===""||!Number.isSafeInteger(preparedTier)||preparedTier<1){
    $("windCapHint").textContent="Enter a positive prepared tier to calculate the Wind limit.";
    return;
  }
  $("manualBaseTier").max=String(preparedTier);
  $("paintTier").max=String(preparedTier);
  const allowed=windTierMaximum(preparedTier);
  windField.max=String(allowed);
  $("windCapHint").textContent="Maximum: "+allowed+" (prepared tier − 6)";
  windField.title="Choose any Wind tier from 0 to "+allowed+".";
  if(followMaximum&&windField.value!==""){
    windField.value=String(windTierAfterPreparedChange(
      windField.value,previousPreparedTierForWind,preparedTier));
  }else if(normalize||windField.value!==""&&Number(windField.value)>allowed){
    windField.value=String(clampWindTier(windField.value,preparedTier));
  }
  previousPreparedTierForWind=preparedTier;
}
$("seedTier").addEventListener("input",()=>{
  syncWindTierLimit({followMaximum:true});
  updateOptimizerModeHint();
});
$("seedTier").addEventListener("change",()=>{
  const raw=Number($("seedTier").value);
  $("seedTier").value=String(Number.isSafeInteger(raw)&&raw>=1?raw:64);
  syncWindTierLimit({normalize:true,followMaximum:true});
  updateOptimizerModeHint();
});
$("windCap").addEventListener("input",()=>{
  const field=$("windCap");
  if(field.value!==""&&(Number(field.value)>Number(field.max)||Number(field.value)<0)){
    field.value=String(clampWindTier(field.value,$("seedTier").value));
  }
});
$("windCap").addEventListener("change",()=>syncWindTierLimit({normalize:true}));
syncWindTierLimit();
function applyImportedLimits(){
  if(!imported)return;
  const progress=detectSushiProgress(imported);
  if(progress.highest<1){$("seedTier").value="";$("windCap").value="";syncWindTierLimit();return;}
  $("seedTier").value=String(progress.highest);
  $("windCap").value=String(progress.windCap);
  $("seedTier").title=progress.source;
  syncWindTierLimit({normalize:true});
}
const SLOT_NAMES=["Regular","Hot","Cold","Milktoast"];
function addSushiVisual(cell,tier){
  if(!Number.isSafeInteger(tier)||tier<1)return;
  // Artwork currently ends at Tier 64. Display higher tiers as numbers.
  if(tier<=64){
    const img=document.createElement("img");
    img.className="sushi-art";
    img.src=sushiTierIconPath(tier);
    img.alt="";
    img.loading="lazy";
    img.decoding="async";
    img.onerror=()=>{img.remove();cell.classList.add("sushi-art-missing");};
    cell.append(img);
  }else{
    cell.classList.add("sushi-art-missing");
  }
  const number=document.createElement("span");
  number.className="tier";number.textContent=tier;
  cell.append(number);
}
const FIRE_NAMES=["Orange · Charcoal Fireplace","Green · Barium Firelighter","Blue · Copper Firelighter","Pink · Lithium Firelighter","Purple · Potassium Firelighter"];
const FIRE_IMAGES=["Charcoal Fireplace (Upgrade 17).png","Barium Firelighter (Upgrade 26).png","Copper Firelighter (Upgrade 33).png","Lithium Firelighter (Upgrade 40).png","Potassium Firelighter (Upgrade 42).png"];
function renderBoard(tiles,perfecto,slots,fires){
  const board=$("board");board.replaceChildren();
  // Always show eight rows, even when all the user's slots are at the top.
  for(let i=0;i<BOARD_CELLS;i++){
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
      const img=document.createElement("img");img.className="campfire-art";img.src="assets/campfires/"+encodeURIComponent(FIRE_IMAGES[f]);img.alt=FIRE_NAMES[f];img.loading="lazy";img.onerror=()=>{img.remove();cell.textContent="♨";};cell.append(img);
    }
    cell.title="Column "+(i+1)+" · "+(FIRE_NAMES[f]??"No fireplace");
    fireRow.append(cell);
  }
  $("fireplaces").replaceChildren(fireRow);
  const filled=tiles.filter(n=>n>=0).length;
  $("boardStatus").textContent=filled+" sushi tiles";
  $("boardDetails").textContent=filled+" occupied slots · "+slots.filter(n=>n>=0).length+" / 100 unlocked slots across an 8×15 board · "+fires.filter(n=>n>=0).length+" fireplaces. Hover over a slot or fireplace for details.";
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
  // Parsing and dashboard rendering are separate: a stale UI module must
  // never misreport successfully decoded game data as an invalid JSON file.
  let dashboardError=null;
  try{sushiLab.refresh();}
  catch(e){dashboardError=e;console.error("Sushi Lab dashboard rendering failed",e);}
  $("jsonPreview").textContent=JSON.stringify({source:parsed.source,sushiArrayLengths:parsed.sushi.map(x=>Array.isArray(x)?x.length:null),firstTiles:parsed.tiles.slice(0,30),slotTypes:parsed.slots,fireTypes:parsed.fires,perfectoFlags:parsed.perfecto?.slice(0,70)??null},null,2);
  if(dashboardError){
    $("importStatus").textContent="JSON imported · dashboard incomplete";
    $("importError").textContent="Your JSON loaded successfully, but the dashboard could not finish updating: "+
      String(dashboardError.message??dashboardError)+
      ". Refresh the page to load the latest interface.";
    $("importError").classList.remove("hidden");
  }
}
function error(e){$("importStatus").textContent="Import failed";$("importStatus").classList.remove("success");$("jsonPreview").textContent=String(e.message??e);$("importSummary").classList.add("hidden");$("importError").textContent="JSON import error: "+String(e.message??e);$("importError").classList.remove("hidden");}
$("pasteToggle").addEventListener("click",()=>{const open=$("pasteArea").classList.toggle("hidden")===false;$("pasteToggle").setAttribute("aria-expanded",String(open));if(open)$("jsonInput").focus();});
$("parseJson").addEventListener("click",()=>{try{importSave(JSON.parse($("jsonInput").value),"Pasted JSON");}catch(e){error(e);}});
$("jsonFile").addEventListener("change",async e=>{const f=e.target.files?.[0];if(!f)return;try{importSave(JSON.parse(await f.text()),f.name);}catch(err){error(err);}});
$("clearImport").addEventListener("click",()=>{cancelRunningSearch();disposeReplay();imported=null;customBoard=null;$("solver").classList.add("hidden");$("jsonInput").value="";$("jsonFile").value="";$("board").replaceChildren();$("fireplaces").replaceChildren();$("importSummary").classList.add("hidden");$("pasteArea").classList.add("hidden");$("pasteToggle").setAttribute("aria-expanded","false");$("importStatus").textContent="Waiting for data";$("importStatus").classList.remove("success");$("boardStatus").textContent="Import a save";$("boardDetails").textContent="Your imported tiles will appear here.";$("jsonPreview").textContent="No JSON imported yet.";sushiLab.refresh();});

// Merge physics and staircase recycling live in optimizer-core.mjs.
// Slot relocation layouts are generated by board-geometry.mjs.
// Keep several alternative merge orders alive instead of committing to one
// greedy policy. Only evaluate this more expensive search on the best preparation.
function beamSearchCombos(start,cap,chainLimit,depth,baseline,maximumTier=64,width=12,branchLimit=12){
  const key=b=>b.join(",");
  const pairCount=b=>{
    const counts=new Map();
    for(const tier of b)if(tier>0&&tier<maximumTier)counts.set(tier,(counts.get(tier)||0)+1);
    let pairs=0;for(const count of counts.values())pairs+=Math.floor(count/2);
    return pairs;
  };
  let best=baseline;
  let frontier=[{board:start,score:0,moves:[],remaining:start.filter(t=>t>0).length}];
  for(let step=0;step<depth&&frontier.length;step++){
    const next=new Map();
    for(const state of frontier){
      const groups=new Map();
      state.board.forEach((t,i)=>{if(t>0&&t<maximumTier){if(!groups.has(t))groups.set(t,[]);groups.get(t).push(i);}});
      const choices=[];
      for(const [tier,positions] of groups){
        if(positions.length<2)continue;
        for(const dst of positions){
          for(const src of positions){
            if(src===dst)continue;
            const move=simulateMerge(state.board,src,dst,cap,chainLimit,maximumTier);
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
    const search=searchCombos(candidate.board,cap,chainLimit,4,positions.length-1,mode,maxTier);
    if(!best||search.score>best.search.score||(search.score===best.search.score&&search.remaining<best.search.remaining))best={...candidate,search};
  }
  return {...best,testedCandidates:candidates.length};
}
function getCustomBoard(){
  if(!imported)return null;
  if(!customBoard){
    customBoard=Array(120).fill(0);
    imported.slots.forEach((type,i)=>{if(i<BOARD_CELLS&&type>=0)customBoard[i]=Math.max(0,(imported.tiles[i]??-1)+1);});
  }
  return customBoard;
}
function renderCustomEditor(){
  if(!imported)return;
  const grid=$("customBoard");grid.replaceChildren();
  const board=getCustomBoard(),slots=imported.slots;
  for(let i=0;i<BOARD_CELLS;i++){
    const type=slots[i]??-1,tier=board[i];
    const cell=document.createElement("button");cell.type="button";
    cell.className="tile custom-tile"+(type>=0?" slot-"+type:" locked")+(tier===0?" empty":"");
    cell.disabled=type<0;
    if(tier>0)addSushiVisual(cell,tier);else cell.textContent="·";
    cell.title="Position "+(i+1)+" · "+(tier?"Tier "+tier:"Empty")+" · Click to paint selected tier";
    cell.setAttribute("aria-label",cell.title);
    cell.addEventListener("click",()=>{
      const value=Number($("paintTier").value);
      if(!Number.isSafeInteger(value)||value<0||value>Number($("seedTier").value))return;
      board[i]=value;renderCustomEditor();
    });
    grid.append(cell);
  }
  const occupied=board.filter(v=>v>0).length;
  $("customStatus").textContent=occupied+" sushi placed · "+slots.filter(v=>v>=0).length+" unlocked slots";
}
$("baseTier").addEventListener("change",()=>{
  const custom=$("baseTier").value==="custom";
  $("manualBaseTierLabel").classList.toggle("hidden",$("baseTier").value!=="manual");
  $("customEditor").classList.toggle("hidden",!custom);
  if(custom&&imported)renderCustomEditor();
});
$("paintTier").addEventListener("change",()=>{
  const n=Number($("paintTier").value);
  if(!Number.isSafeInteger(n)||n<0||n>Number($("seedTier").value))$("paintTier").value=String(Math.min(41,Number($("seedTier").value)||41));
});
$("customFromSave").addEventListener("click",()=>{
  if(!imported)return;
  customBoard=null;renderCustomEditor();
});
$("customFill").addEventListener("click",()=>{
  if(!imported)return;
  const value=Number($("paintTier").value);
  if(!Number.isSafeInteger(value)||value<0||value>Number($("seedTier").value))return;
  const board=getCustomBoard();
  imported.slots.forEach((type,i)=>{if(i<BOARD_CELLS&&type>=0&&board[i]!==Math.max(64,Number($("seedTier").value)||64))board[i]=value;});
  renderCustomEditor();
});
$("customClear").addEventListener("click",()=>{
  if(!imported)return;
  const board=getCustomBoard();
  imported.slots.forEach((type,i)=>{if(i<BOARD_CELLS&&type>=0&&board[i]!==Math.max(64,Number($("seedTier").value)||64))board[i]=0;});
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
  const chosenTier=Number($("seedTier").value);
  const maxTier=Number.isSafeInteger(chosenTier)&&chosenTier>=1?
    chosenTier:Math.max(1,detected.highest||1);
  // Enforce the same ceiling in the simulator even if the field was
  // edited programmatically or the change event has not fired.
  const cap=clampWindTier($("windCap").value,maxTier);
  $("windCap").value=String(cap);
  syncWindTierLimit();
  const chain=Math.min(25,Math.max(0,Number($("chainLimit").value)||0));
  const slots=imported.slots.slice(0,BOARD_CELLS);
  const positions=slots.map((v,i)=>v>=0?i:-1).filter(i=>i>=0);
  if(positions.length<2){$("solverNote").textContent="At least two unlocked slots are required.";$("solverSteps").replaceChildren();return;}
  $("solverNote").textContent="Searching prepared tier layouts…";
  const mode="descending domino";
   const optimizerMode=getModeInfo($("optimizerMode").value).id;
   const optimizerModeLabel=modeDisplayLabel(getModeInfo(optimizerMode));
  const custom=$("baseTier").value==="custom";
  const protectTier64=maxTier>=64||imported.tiles.includes(63);
  const highestIngredient=protectTier64&&maxTier>=64?maxTier-1:maxTier;
  const selectedBase=custom?0:($("baseTier").value==="manual"?
    Math.min(highestIngredient,Math.max(1,Math.round(Number($("manualBaseTier").value)||1))):
    (Number($("baseTier").value)||0));
  // A protected Tier 64 is retained for lower-tier legacy setups. Above
  // Tier 64 the protected preparation anchor becomes the selected maximum.
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
    $("optimizerProgressText").textContent=optimizerModeLabel+" · "+pct+"% · "+done+" / "+total+" layouts evaluated";
  };
  progress(0);
  // Yield between candidate evaluations so progress can paint in the browser.
  await yieldToUI(signal);
  if(custom){
    const board=getCustomBoard().slice();
    if(board.filter(v=>v>0).length<2)throw Error("Place at least two sushi on the custom board.");
    const greedy=searchCombos(board,cap,chain,4,board.filter(v=>v>0).length-1,mode,maxTier);
    await yieldToUI(signal);
    const beam=beamSearchCombos(board,cap,chain,board.filter(v=>v>0).length-1,greedy,maxTier);
    await yieldToUI(signal);
    let search=searchStaircaseCombos(board,cap,chain,slots,beam,{maximumTier:maxTier});
    await yieldToUI(signal);
    search=searchTacticalCombos(board,cap,chain,slots,search,{depth:14,width:12,branchLimit:16,maximumTier:maxTier});
    await yieldToUI(signal);
    solution={board,slots,layoutName:"Current positions",base:"custom",shape:"user-defined",name:"Custom board",search,testedCandidates:1};
    progress(1);
  }else{
    for(let i=0;i<candidates.length;i++){
      throwIfCancelled(signal);
      const candidate=candidates[i];
      const greedy=searchCombos(candidate.board,cap,chain,4,positions.length-1,mode,maxTier);
      const search=searchStaircaseCombos(candidate.board,cap,chain,candidate.slots,greedy,{maximumTier:maxTier});
      if(!solution||search.score>solution.search.score||(search.score===solution.search.score&&search.remaining<solution.search.remaining))solution={...candidate,search};
      progress(i+1);
      await yieldToUI(signal);
    }
    solution={...solution,testedCandidates:candidates.length};
    $("optimizerProgressText").textContent="Refining the best preparation…";
    await yieldToUI(signal);
    solution.search=beamSearchCombos(solution.board,cap,chain,solution.board.filter(v=>v>0).length-1,solution.search,maxTier);
    await yieldToUI(signal);
    solution.search=searchStaircaseCombos(solution.board,cap,chain,solution.slots,solution.search,{maximumTier:maxTier});
    $("optimizerProgressText").textContent="Checking tactical Wind setups…";
    await yieldToUI(signal);
    solution.search=searchTacticalCombos(solution.board,cap,chain,solution.slots,solution.search,{depth:12,width:12,branchLimit:16,maximumTier:maxTier});
    await yieldToUI(signal);
    if(optimizerMode==="experimental12"||optimizerMode==="experimental13"){
      $("optimizerProgressText").textContent="Exploring deeper merge orders…";
      await yieldToUI(signal);
      solution.search=searchLookaheadCombos(solution.board,cap,chain,solution.search,
        {maxPasses:3,maxBranches:18,maxEvaluations:3500,maximumTier:maxTier});
      await yieldToUI(signal);
    }
  }
  throwIfCancelled(signal);
  if(!solution||!solution.search)throw Error("No valid preparations for these tier settings.");
  const result=solution.search;
  const recommendedSlots=solution.slots??slots;
  const verified=validateComboReplay(solution.board,result.moves,cap,chain,recommendedSlots,maxTier);
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
  $("solverNote").textContent+=" Mode: "+optimizerModeLabel+". Winning strategy: "+result.strategy+". Slot arrangement: "+(solution.layoutName??"Current positions")+". Prepared tier cap: "+maxTier+"; East Wind limit: "+cap+".";
  if(!custom&&protectTier64)$("solverNote").textContent+=" The protected Tier "+(maxTier>=64?maxTier:64)+" is placed in the first unlocked slot of the suggested layout."; 
  preparedOutlineCleanup();preparedOutlineCleanup=()=>{};
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
  const sections=custom?null:getPreparedBoardSections(solution,recommendedSlots);
  const showSlotRecommendation=hasSlotLayoutChanges(slots,recommendedSlots);
  let sectionNumber=1;
  function make(label,values,showTiers,sectionInfo=null,slotLayoutHeading=false){
    const h=document.createElement("h3");h.textContent=sectionNumber+" · "+label;
    if(slotLayoutHeading)h.id="optimizerSlotLayout";
    root.append(h);sectionNumber++;
    let guide=null,supply=null,chainGuide=null;
    if(sectionInfo){
      guide=document.createElement("div");guide.className="prepared-section-guide";
      supply=document.createElement("div");supply.className="prepared-section-guide-item prepared-guide-supply";
      const supplyTitle=document.createElement("strong");supplyTitle.textContent="Supply / tools";
      const supplyText=document.createElement("p");
      supplyText.textContent="The protected Tier 64 stays first. Other sushi here are arranged highest to lowest to make preparation easier. They are mainly merge supplies for the chain, not the fixed Wind engine.";
      supply.append(supplyTitle,supplyText);
      chainGuide=document.createElement("div");chainGuide.className="prepared-section-guide-item prepared-guide-chain";
      const chainTitle=document.createElement("strong");chainTitle.textContent="Heat of the East Wind chain";
      const chainText=document.createElement("p");
      chainText.textContent="These sushi form the ordered merge anchors and descending Wind paths. Keep their positions exactly as shown: reordering this area can change or break the simulated combo.";
      chainGuide.append(chainTitle,chainText);
      for(const [card,name] of [[supply,"supply"],[chainGuide,"chain"]]){
        card.tabIndex=0;card.setAttribute("role","button");
        card.setAttribute("aria-label","Highlight "+(name==="supply"?"supply and tools":"Heat of the East Wind chain")+" on the board");
        card.title="Hover, focus or click to highlight this section";
      }
      guide.append(supply,chainGuide);root.append(guide);
      const key=document.createElement("p");key.className="hint prepared-section-key";
      key.textContent="Rose border = supply / tools (including protected Tier 64) · Mint border = fixed chain. Hover or focus a guide card to spotlight its section; click to pin it.";
      root.append(key);
    }
    const legend=document.createElement("p");legend.className="hint";legend.textContent="Green: Regular · Red: Hot · Blue: Cold · Gold: Milktoast. Hover over a tile for its slot type and position.";root.append(legend);
    const scroll=document.createElement("div");scroll.className="board-scroll optimizer-board-scroll";
    const grid=document.createElement("div");grid.className="board optimizer-board"+(sectionInfo?" prepared-section-board":"");
    for(let i=0;i<BOARD_CELLS;i++){
      const slot=recommendedSlots[i]??-1,tier=values[i]??0;
      const cell=document.createElement("div");
      cell.className="tile"+(slot>=0?" slot-"+slot:" locked")+(showTiers&&tier<1?" empty":"");
      if(sectionInfo?.roles[i])cell.classList.add("prepared-"+sectionInfo.roles[i]);
      if(sectionInfo?.protectedPosition===i)cell.classList.add("prepared-protected");
      if(sectionInfo?.firstEnginePosition===i)cell.classList.add("prepared-engine-start");
      if(slot>=0&&showTiers&&tier>0){addSushiVisual(cell,tier);}
      else if(slot>=0&&!showTiers){const dot=document.createElement("span");dot.className="slot-marker";dot.textContent="•";cell.append(dot);}
      const role=sectionInfo?.roles[i]==="supply"?(i===sectionInfo.protectedPosition?" · Protected anchor / supply section":" · Supply / tools"):sectionInfo?.roles[i]==="chain"?" · Fixed Wind chain":"";
      cell.title="Position "+(i+1)+" · "+(SLOT_NAMES[slot]??"Locked")+(showTiers&&tier>0?" · Tier "+tier:"")+role;
      grid.append(cell);
    }
    if(sectionInfo){
      const outline=document.createElementNS("http://www.w3.org/2000/svg","svg");
      outline.classList.add("prepared-outline");
      outline.setAttribute("aria-hidden","true");
      for(const role of ["supply","chain"]){
        const path=document.createElementNS("http://www.w3.org/2000/svg","path");
        path.classList.add("prepared-outline-"+role);
        outline.append(path);
      }
      grid.append(outline);
      const refreshOutline=()=>{
        if(!grid.isConnected)return;
        const cells=[...grid.querySelectorAll(".tile")];
        const svgBox=outline.getBoundingClientRect();
        if(!svgBox.width||!svgBox.height||cells.length!==BOARD_CELLS)return;
        const bounds=cells.map(cell=>cell.getBoundingClientRect());
        const coordinates=preparedOutlineCoordinates(bounds,svgBox,COLUMNS,2);
        if(!coordinates)return;
        const {xs,ys}=coordinates;
        outline.setAttribute("viewBox","0 0 "+svgBox.width+" "+svgBox.height);
        for(const role of ["supply","chain"]){
          outline.querySelector(".prepared-outline-"+role).setAttribute("d",
            preparedSectionOutlinePath(sectionInfo.roles,role,xs,ys,COLUMNS));
        }
      };
      const observer=typeof ResizeObserver!=="undefined"?new ResizeObserver(refreshOutline):null;
      observer?.observe(grid);
      window.addEventListener("resize",refreshOutline);
      preparedOutlineCleanup=()=>{observer?.disconnect();window.removeEventListener("resize",refreshOutline);};
      requestAnimationFrame(refreshOutline);
      let pinned=null;
      const spotlight=role=>{
        grid.classList.toggle("highlight-supply",role==="supply");
        grid.classList.toggle("highlight-chain",role==="chain");
        supply.classList.toggle("is-active",role==="supply");
        chainGuide.classList.toggle("is-active",role==="chain");
        supply.setAttribute("aria-pressed",String(pinned==="supply"));
        chainGuide.setAttribute("aria-pressed",String(pinned==="chain"));
      };
      for(const [card,role] of [[supply,"supply"],[chainGuide,"chain"]]){
        card.setAttribute("aria-pressed","false");
        card.addEventListener("pointerenter",()=>spotlight(role));
        card.addEventListener("pointerleave",()=>spotlight(pinned));
        card.addEventListener("focus",()=>spotlight(role));
        card.addEventListener("blur",()=>spotlight(pinned));
        card.addEventListener("click",()=>{pinned=pinned===role?null:role;spotlight(pinned);});
        card.addEventListener("keydown",event=>{
          if(event.key==="Enter"||event.key===" "){event.preventDefault();card.click();}
        });
      }
    }
    scroll.append(grid);root.append(scroll);
  }
  if(showSlotRecommendation)make("Recommended slot layout ("+(solution.layoutName??"current")+")",[],false,null,true);
  make(custom?"Your custom starting board":"Recommended prepared sushi tiers (not your current inventory)",solution.board,true,sections);
  const heading=document.createElement("h3");heading.textContent=sectionNumber+" · Interactive merge sequence";root.append(heading);
  const intro=document.createElement("p");intro.className="hint";intro.textContent="Watch the picked sushi slide into the destination before the merge and East Wind resolve. Blue marks the source, green the destination, and purple marks Wind. Use Play or select a step; Step 0 shows the full board.";root.append(intro);
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
  for(const rate of [0.5,0.75,1,1.5,2,3]){
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
  let flightTimer=null,flightAnimation=null,flightGhost=null,flightEpoch=0;
  const prefersReducedMotion=()=>window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function cancelFlight(){
    flightEpoch++;
    if(flightTimer!==null){window.clearTimeout(flightTimer);flightTimer=null;}
    if(flightAnimation){flightAnimation.cancel();flightAnimation=null;}
    if(flightGhost){flightGhost.remove();flightGhost=null;}
  }
  function drawFrame(board,move,{resolved=false,timing=null}={}){
    const changes=new Map(),windOrder=new Map();
    if(move){
      changes.set(move.src,"source");
      changes.set(move.dst,"destination");
      if(resolved){
        let order=0;
        for(const event of move.events??[]){
          if(event.kind==="wind"){
            changes.set(event.at,"wind");
            windOrder.set(event.at,order++);
          }
        }
      }
    }
    boardGrid.replaceChildren();
    for(let i=0;i<BOARD_CELLS;i++){
      const type=recommendedSlots[i]??-1,tier=board[i]??0;
      const tile=document.createElement("div");
      tile.className="tile"+(type>=0?" slot-"+type:" locked")+(tier<1?" empty":"");
      if(move&&type>=0){
        const change=changes.get(i);
        if(change){
          tile.classList.add("focus-tile","merge-"+change);
          if(change==="wind"){
            tile.classList.add("wind-active");
            tile.style.setProperty("--wind-delay",
              (windOrder.get(i)*(timing?.windStaggerMs??65))+"ms");
            tile.style.setProperty("--wind-duration",(timing?.windTileMs??650)+"ms");
          }
        }else tile.classList.add("dim-tile");
      }
      if(type>=0&&tier>0)addSushiVisual(tile,tier);
      if(resolved&&move&&i===move.dst&&type>=0&&!prefersReducedMotion())
        tile.classList.add("merge-landed");
      tile.title="Position "+(i+1)+" · "+(SLOT_NAMES[type]??"Locked")+
        (tier?" · Tier "+tier:" · Empty")+
        (changes.has(i)?" · "+changes.get(i):"");
      boardGrid.append(tile);
    }
  }
  function completedScore(move){
    scoreLine.textContent="Combo Meter: "+cumulative[selected].toLocaleString()+" points"+
      (move?(move.kind==="move"?" · Reposition · +0":" · This merge: +"+move.score):
       " · Ready to begin");
  }
  function finishFlight(){
    if(flightTimer===null)return;
    window.clearTimeout(flightTimer);flightTimer=null;
    if(flightAnimation){flightAnimation.cancel();flightAnimation=null;}
    if(flightGhost){flightGhost.remove();flightGhost=null;}
    const move=result.moves[selected-1];
    if(!move)return;
    const timing=replayMotionTiming(move,Number(speedSelect.value),
      {reducedMotion:prefersReducedMotion()});
    drawFrame(move.board,move,{resolved:true,timing});
    completedScore(move);
  }
  function displayStep(step){
    cancelFlight();
    selected=Math.max(0,Math.min(result.moves.length,step));
    indicator.textContent="Step "+selected+" / "+result.moves.length;
    seek.value=String(selected);
    seek.setAttribute("aria-valuetext","Step "+selected+" of "+result.moves.length);
    first.disabled=selected===0;previous.disabled=selected===0;
    next.disabled=selected===result.moves.length;
    lastStep.disabled=selected===result.moves.length;
    const move=selected>0?result.moves[selected-1]:null;
    if(!move){
      drawFrame(solution.board,null);
      completedScore(null);
    }else{
      const timing=replayMotionTiming(move,Number(speedSelect.value),
        {reducedMotion:prefersReducedMotion()});
      const before=selected===1?solution.board:result.moves[selected-2].board;
      const canAnimate=timing.travelMs>0&&move.src!==move.dst&&
        recommendedSlots[move.src]>=0&&recommendedSlots[move.dst]>=0&&before[move.src]>0;
      if(!canAnimate){
        drawFrame(move.board,move,{resolved:true,timing});
        completedScore(move);
      }else{
        // Leave the pre-action board in place until the animated source lands.
        drawFrame(before,move);
        const sourceTile=boardGrid.children[move.src],destTile=boardGrid.children[move.dst];
        const sourceRect=sourceTile.getBoundingClientRect();
        const destRect=destTile.getBoundingClientRect();
        const gridRect=boardGrid.getBoundingClientRect();
        const dx=destRect.left-sourceRect.left,dy=destRect.top-sourceRect.top;
        flightGhost=sourceTile.cloneNode(true);
        flightGhost.classList.remove("focus-tile","merge-source","dim-tile","wind-active");
        flightGhost.classList.add("merge-flying-sushi");
        flightGhost.removeAttribute("title");
        flightGhost.setAttribute("aria-hidden","true");
        flightGhost.style.left=(sourceRect.left-gridRect.left)+"px";
        flightGhost.style.top=(sourceRect.top-gridRect.top)+"px";
        flightGhost.style.width=sourceRect.width+"px";
        flightGhost.style.height=sourceRect.height+"px";
        sourceTile.classList.add("merge-source-lifted");
        boardGrid.append(flightGhost);
        const epoch=flightEpoch;
        if(typeof flightGhost.animate==="function"){
          flightAnimation=flightGhost.animate([
            {transform:"translate(0px,0px) scale(1)",opacity:.78},
            {transform:"translate("+dx+"px,"+dy+"px) scale(.94)",opacity:.66}
          ],{duration:timing.travelMs,easing:"cubic-bezier(.25,.72,.22,1)",
            fill:"forwards"});
        }else flightGhost.style.transform="translate("+dx+"px,"+dy+"px)";
        scoreLine.textContent="Picking up Tier "+before[move.src]+" · "+
          "position "+(move.src+1)+" → "+(move.dst+1)+
          (move.kind==="move"?" · Relocating":" · Merging");
        flightTimer=window.setTimeout(()=>{
          if(epoch===flightEpoch)finishFlight();
        },timing.travelMs);
      }
    }
    stepButtons.forEach((button,i)=>{
      button.classList.toggle("selected",i===selected);
      button.setAttribute("aria-current",i===selected?"step":"false");
    });
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
      const move=step>0?result.moves[step-1]:null;
      return replayMotionTiming(move,Number(speedSelect.value),
        {reducedMotion:prefersReducedMotion()}).delayMs;
    }
  });
  first.addEventListener("click",()=>player.goTo(0));
  previous.addEventListener("click",()=>player.goTo(player.step-1));
  next.addEventListener("click",()=>player.goTo(player.step+1));
  lastStep.addEventListener("click",()=>player.goTo(result.moves.length));
  playButton.addEventListener("click",()=>player.toggle());
  seek.addEventListener("input",()=>player.goTo(Number(seek.value)));
  speedSelect.addEventListener("change",()=>{
    finishFlight();
    player.reschedule();
  });
  const pauseWhenHidden=()=>{
    if(document.hidden){player.pause();finishFlight();}
  };
  const finishWhenResized=()=>finishFlight();
  document.addEventListener("visibilitychange",pauseWhenHidden);
  window.addEventListener("resize",finishWhenResized);
  replayCleanup=()=>{
    player.dispose();
    cancelFlight();
    document.removeEventListener("visibilitychange",pauseWhenHidden);
    window.removeEventListener("resize",finishWhenResized);
  };
  showPlaybackState(false);
  displayStep(0);
}
function initModePicker(){
 const selector=$("optimizerMode"),old=selector.value,rows=$("modeComparisonRows");
 selector.replaceChildren();rows.replaceChildren();
 for(const mode of MODE_CATALOG){
  const option=document.createElement("option");option.value=mode.id;option.textContent=modeOptionLabel(mode);selector.append(option);
  const row=document.createElement("tr");row.dataset.mode=mode.id;
  for(const value of [modeDisplayLabel(mode),mode.difficulty,mode.benchmark===null?"—":mode.benchmark.toLocaleString()]){
   const cell=document.createElement("td");cell.textContent=value;row.append(cell);
  }
  rows.append(row);
 }
 selector.value=MODE_CATALOG.some(mode=>mode.id===old)?old:"default";
}
function updateOptimizerModeHint(){
 const info=getModeInfo($("optimizerMode").value);
 $("optimizerModeName").textContent=modeDisplayLabel(info);
 const difficulty=$("optimizerDifficulty");
 difficulty.textContent=info.difficulty;
 difficulty.className="mode-difficulty mode-difficulty-"+info.difficulty.toLowerCase();
 const preview=Number($("seedTier").value)>64;
 $("optimizerModeBenchmark").textContent=info.benchmark===null?
  (preview?"Future-tier preview":"Flexible setups"):
  (preview?"Tier 64 benchmark: ":"")+info.benchmark.toLocaleString()+" simulated pts";
 $("optimizerModeHint").textContent=info.summary+(preview?
  " Higher tiers are hypothetical future-update previews. All record research remains at Tier 64, Wind cap 58, chain 25 and 100 unlocked slots.":"");
 for(const row of $("modeComparisonRows").rows)row.classList.toggle("is-selected",row.dataset.mode===info.id);
}
initModePicker();
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
  if(!imported){$("solverNote").textContent="Import a valid game save JSON first.";return;}
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
