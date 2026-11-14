import {simulateMerge,validateComboReplay,searchStaircaseCombos} from "./optimizer-core.mjs?v=1.9.9";
import {searchTacticalCombos} from "./tactical-search.mjs?v=1.9.9";
import {createReplayController} from "./replay-controller.mjs?v=1.7.4";
import {replayMotionTiming} from "./merge-motion.mjs?v=1.15.6";
import {replayFlightGeometry} from "./replay-flight-geometry.mjs?v=1.18.8";
import {buildReplayGuide,nextWindReplayStep} from "./replay-guide.mjs?v=1.18.7";
import {buildCandidates} from "./preparation-core.mjs?v=1.9.9";
import {getModeCandidates} from "./optimizer-modes.mjs?v=1.18.6";
import {comboSplitPercentages} from "./combo-split-strategies.mjs?v=1.18.0";
import {FOUND_CONFIGURATIONS,buildFoundConfiguration} from "./found-configurations.mjs?v=1.18.0";
import {searchLookaheadCombos} from "./lookahead-search.mjs?v=1.9.9";
import {throwIfCancelled,yieldToUI} from "./optimizer-run.mjs?v=1.8.1";
import {scanSplitDirectionsInParallel} from "./split-search-parallel.mjs?v=1.18.4";
import {currentRunScore,reachedCurrentRunGoal,betterRunCandidate,selectDisplayedSearchResult} from "./research-score-display.mjs?v=1.19.4";
import {buildNovelSplitCandidates} from "./split-research-round.mjs?v=1.18.6";
import {researchContext,loadResearchHistory,rememberEvaluatedBoards,rememberBestCandidate,
 resetResearchHistory,exportResearchData,importResearchData} from "./research-memory.mjs?v=1.18.6";
import {comparePreparedBoard} from "./combo-qol.mjs?v=1.18.6";
import {renderComboReport,decoratePreparedCell} from "./combo-qol-ui.mjs?v=1.18.8";
import {searchCombos} from "./merge-search.mjs?v=1.9.9";
import {MODE_CATALOG,getModeInfo,modeOptionLabel,modeDisplayLabel} from "./mode-catalog.mjs?v=1.17.1";
const $=id=>document.getElementById(id);
import {BOARD_COLUMNS,BOARD_CELLS,normalizeBoardData,layoutOptions} from "./board-geometry.mjs?v=1.42.0";
import {windTierMaximum,clampWindTier,windTierAfterPreparedChange} from "./wind-limit.mjs?v=1.9.10";
import {detectSushiProgress} from "./sushi-progression.mjs?v=1.17.0";
import {initializeSushiLab} from "./lab-ui.mjs?v=1.50.28";
import {formatCompactNumber} from "./number-format.mjs?v=1.0.1";
import {parseSushiCurrencyExternal} from "./sushi-currency-external.mjs?v=1.0.0";
import {sushiTierIconPath} from "./sushi-reference.mjs?v=1.16.6";
import {countOverviewPlates,overviewTileInfo} from "./overview-helpers.mjs?v=1.19.9";
import {getPreparedBoardSections,hasSlotLayoutChanges,preparedSectionOutlinePath,preparedOutlineCoordinates} from "./prepared-sections.mjs?v=1.17.1";
const COLUMNS=BOARD_COLUMNS;
let imported=null;
const sushiLab=initializeSushiLab(()=>imported);
let customBoard=null;
let replayCleanup=()=>{};
let preparedOutlineCleanup=()=>{};
let activeSearch=null;
// The same score bubble shows provisional best scores and the final
// replay-validated estimate. It stays visible while detailed results are hidden.
function setComboScoreBubble(running,score=null){
 const bubble=$("solverScoreBubble");
 bubble.classList.remove("hidden");
 $("solverScoreLabel").textContent=running?"Best score so far:":"Estimated combo score:";
 $("solverScore").textContent=Number.isFinite(score)?formatCompactNumber(score):"—";
}
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
  const bundleBanJ=bundles&&typeof bundles==="object"&&
    Object.prototype.hasOwnProperty.call(bundles,"ban_j")?
    Number(bundles.ban_j)>0:
    typeof input.bundleBanJ==="boolean"?input.bundleBanJ:undefined;
  // Idleon Toolbox: Sushi CurrencyMulti reads Sailing[3][39] (artifact grade),
  // OptLacc[311] EventShopOwned(45), Gaming[12] Superbit(67) and Research grid189.
  const readArray=(key)=>{
   const raw=input.data?.[key]??input[key];
   if(Array.isArray(raw))return raw;
   if(typeof raw==="string"){try{const parsed=JSON.parse(raw);return Array.isArray(parsed)?parsed:null;}catch{}}
   return null;
  };
  const sailing=readArray("Sailing");
  const sailingArt39=Number(sailing?.[3]?.[39]);
  const sailingArtifact39=Number.isFinite(sailingArt39)&&sailingArt39>=0?sailingArt39:null;
  const accountOptions=readArray("OptLacc");
  const eventCode=accountOptions?.[311];
  // Number2Letter[45] is "S" in the game.
  const eventShop45=typeof eventCode==="string"?eventCode.includes("S"):null;
  const gaming=readArray("Gaming");
  const superbitCodes=gaming?.[12];
  // Number2Letter[67] is "筒" in the game.
  const superbit67=typeof superbitCodes==="string"?superbitCodes.includes("筒"):null;
  const research189Level=Number(research?.[0]?.[189]);
  const research189Obs=Number(research?.[1]?.[189]);
  const research189=Number.isFinite(research189Level)&&research189Level>=0?
    {level:research189Level,observation:Number.isInteger(research189Obs)?research189Obs:-1}:null;
  // Processed account exports may carry the authoritative total.
  const sushiDoublerInfo=input.account?.menagerie?.doublers?.sushi
    ??input.data?.menagerie?.doublers?.sushi??null;
  const sushiCurrencyExternal=parseSushiCurrencyExternal(input);
  return {sushi,spelunk,menagerie,research,bundleBonV,bundleBanJ,sailingArtifact39,eventShop45,superbit67,research189,sushiCurrencyExternal,
   sushiDoublerInfo,tiles,perfecto:Array.isArray(sushi[5])?sushi[5].map(Number):null,slots,fires:Array.isArray(sushi[3])?sushi[3].slice(0,15).map(Number):[],source:input.data?.Sushi!=null?"Game save export":"Raw game data"};
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
function renderPlateBreakdown(slots=null){
 const container=$("boardPlateSummary");
 container.replaceChildren();
 const types=[
  ["normal","Regular"],["hot","Hot"],["cold","Cold"],["milk","Milktoast"]
 ];
 const counts=slots?countOverviewPlates(slots):null;
 for(let i=0;i<types.length;i++){
  const [color,label]=types[i];
  const item=document.createElement("span"),sample=document.createElement("i");
  sample.className=color;
  sample.setAttribute("aria-hidden","true");
  item.append(sample,document.createTextNode(label+" "+(counts?counts[i]:"—")));
  container.append(item);
 }
 const perfecto=document.createElement("span");
 perfecto.className="perfecto-legend";
 const symbol=document.createElement("img");
 symbol.src="assets/Perfecto_Symbol.png";
 symbol.className="perfecto-legend-icon";
 symbol.alt="";
 symbol.setAttribute("aria-hidden","true");
 perfecto.append(symbol,document.createTextNode("Perfecto"));
 container.append(perfecto);
}
function renderBoard(tiles,perfecto,slots,fires){
  const board=$("board");board.replaceChildren();
  const selection=$("boardSelection");
  selection.replaceChildren();selection.classList.add("hidden");
  renderPlateBreakdown(slots);
  // Always show eight rows, even when all the user's slots are at the top.
  for(let i=0;i<BOARD_CELLS;i++){
    const id=tiles[i]??-1,slot=slots[i]??-1;
    const cell=document.createElement(slot>=0?"button":"div");
    cell.className="tile"+(slot>=0?" slot-"+slot+" overview-board-tile":" locked")+(id<0?" empty":"");
    if(slot>=0){
      cell.type="button";
      cell.dataset.position=String(i);
      cell.setAttribute("aria-pressed","false");
    }
    if(slot>=0&&id>=0){
      const isPerfecto=Array.isArray(perfecto)&&perfecto[id]>0;
      if(isPerfecto)cell.classList.add("perfecto");
      addSushiVisual(cell,id+1);
      if(isPerfecto){const mark=document.createElement("img");mark.className="perfecto-mark";mark.src="assets/Perfecto_Symbol.png";mark.alt="Perfecto";mark.title="Perfecto";mark.loading="lazy";cell.append(mark);}
    }else if(slot>=0){cell.textContent="·";}
    const info=overviewTileInfo({tiles,slots,perfecto},i);
    cell.title="Position "+info.position+" · "+info.plate+" plate"+
     (info.tier?" · T"+info.tier+" "+info.name:" · "+info.status)+
     (info.tier?" · "+info.status:"");
    if(slot>=0)cell.setAttribute("aria-label",cell.title);
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
  let selectedTile=null;
  board.onclick=event=>{
   const tile=event.target.closest?.(".overview-board-tile");
   if(!tile||!board.contains(tile))return;
   const index=Number(tile.dataset.position);
   const info=overviewTileInfo({tiles,slots,perfecto},index);
   if(!info)return;
   if(selectedTile){
    selectedTile.classList.remove("is-selected");
    selectedTile.setAttribute("aria-pressed","false");
   }
   selectedTile=tile;tile.classList.add("is-selected");
   tile.setAttribute("aria-pressed","true");
   const title=document.createElement("strong");
   title.textContent="Position "+info.position+" · "+
    (info.tier?"T"+info.tier+" "+info.name:"Empty plate");
   const details=document.createElement("span");
   details.textContent=info.plate+" plate · "+info.status;
   selection.replaceChildren(title,details);
   selection.classList.remove("hidden");
  };
  const filled=tiles.filter(n=>n>=0).length;
  $("boardStatus").textContent=filled+" sushi tiles";
  $("boardDetails").textContent=filled+" occupied slots · "+slots.filter(n=>n>=0).length+" / 100 unlocked slots across an 8×15 board · "+fires.filter(n=>n>=0).length+" fireplaces. Select a plate to inspect it, or hover over a fireplace for details.";
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
  $("solverScoreBubble").classList.add("hidden");
  $("solverScoreLabel").textContent="Estimated combo score:";
  $("solverScore").textContent="—";$("solverMoves").textContent="—";$("solverSteps").replaceChildren();
  $("importStatus").textContent="JSON imported";$("importStatus").classList.add("success");
  const tierProgress=detectSushiProgress(parsed);
  $("importSummary").textContent=label+" · "+parsed.source+" · "+parsed.tiles.filter(n=>n>=0).length+" occupied sushi slots decoded · Tier "+tierProgress.highest+" detected ("+tierProgress.source+") · Wind limit "+tierProgress.windCap+". If the player has unlocked higher tiers not present on the board, correct the Maximum prepared tier field.";
  $("importSummary").classList.remove("hidden");
  // Parsing and dashboard rendering are separate: a stale UI module must
  // never misreport successfully decoded game data as an invalid JSON file.
  let dashboardError=null;
  try{sushiLab.markImported();}
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
function clearImportedSave(){
 cancelRunningSearch();disposeReplay();imported=null;customBoard=null;
 $("solver").classList.add("hidden");
 $("jsonInput").value="";$("jsonFile").value="";
 $("board").replaceChildren();$("fireplaces").replaceChildren();
 $("importSummary").classList.add("hidden");
 $("importError").classList.add("hidden");$("importError").textContent="";
 $("pasteArea").classList.add("hidden");
 $("pasteToggle").setAttribute("aria-expanded","false");
 $("importStatus").textContent="Waiting for data";
 $("importStatus").classList.remove("success");
 $("boardStatus").textContent="Import a save";
 $("boardDetails").textContent="Your imported tiles will appear here.";
 $("jsonPreview").textContent="No JSON imported yet.";
 $("boardSelection").classList.add("hidden");$("boardSelection").replaceChildren();
 renderPlateBreakdown(null);sushiLab.clearImported();
}
$("clearImport").addEventListener("click",clearImportedSave);

// The Overview shows the same plate colors even before a save is imported.
renderPlateBreakdown(null);

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
async function showSolver(signal,foundId=null,savedOnly=false){
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
  const foundInfo=foundId?FOUND_CONFIGURATIONS.find(config=>config.id===foundId):null;
  if(foundId&&!foundInfo)throw Error("Unknown found configuration");
  const optimizerMode=foundInfo?foundInfo.id:getModeInfo($("optimizerMode").value).id;
  const optimizerModeLabel=foundInfo?"Found configuration · "+foundInfo.name:
   modeDisplayLabel(getModeInfo(optimizerMode));
  const custom=!foundInfo&&$("baseTier").value==="custom";
  if(savedOnly&&(!["optimizer1","optimizer2","optimizer3","optimizer4","optimizer5"].includes(optimizerMode)||custom))
   throw Error("Select Fast, Mid, Slow, Max, or Custom to view its saved research best.");
  // Optional score stopping applies only to Custom. Configurations per
  // unique split is now the single search-size control.
  const customOptimizer=optimizerMode==="optimizer5";
  const goal=customOptimizer?Number($("scoreTarget").value):0;
  if(customOptimizer&&(!Number.isSafeInteger(goal)||goal<0))
   throw Error("Custom score target must be a nonnegative integer.");
  const protectTier64=maxTier>=64||imported.tiles.includes(63);
  const highestIngredient=protectTier64&&maxTier>=64?maxTier-1:maxTier;
  const selectedBase=custom||foundInfo?0:($("baseTier").value==="manual"?
    Math.min(highestIngredient,Math.max(1,Math.round(Number($("manualBaseTier").value)||1))):
    (Number($("baseTier").value)||0));
  // A protected Tier 64 is retained for lower-tier legacy setups. Above
  // Tier 64 the protected preparation anchor becomes the selected maximum.
  // The MOVE button for repositioning plates is unlocked by Movement Mittens.
  // It is not automatically available just because a player has Hot slots.
  const movementMittens=Number(imported.sushi?.[2]?.[42]??0)>0;
  const arrangements=custom?[{name:"Current positions",slots}]:
   layoutOptions(slots,{movementMittens});
  const perSplit=Number($("customPerSplit").value);
  const customSettings={splitMode:$("customSplitMode").value,perSplit};
  if(!custom&&optimizerMode==="optimizer5"&&(!Number.isSafeInteger(perSplit)||perSplit<1||perSplit>1000))
   throw Error("Choose 1–1,000 configurations per unique split.");
  const dualSplit=!custom&&!foundInfo&&["optimizer1","optimizer2","optimizer3","optimizer4","optimizer5"].includes(optimizerMode);
  const researchState={checkedBefore:0,persistent:true,contexts:new Map(),best:null};
  const baseSplitMode=optimizerMode==="optimizer5"?customSettings.splitMode:optimizerMode;
  const searchBudget=optimizerMode==="optimizer5"?perSplit:50;
  const generated=custom?null:await Promise.all(arrangements.map(async layout=>{
    throwIfCancelled(signal);
    const layoutPositions=layout.slots.map((v,i)=>v>=0?i:-1).filter(i=>i>=0);
    let prepared;
    if(dualSplit){
      const context=researchContext({maxTier,cap,chain,selectedBase,
       protectHighest:protectTier64,slots:layout.slots});
      const history=await loadResearchHistory(context);
      researchState.contexts.set(context,history);
      researchState.checkedBefore+=history.seen.size;
      if(!history.persistent)researchState.persistent=false;
      // Older or corrupted results must never become the new baseline.
      if(history.best?.search?.moves&&history.best?.board){
        try{
          const verified=validateComboReplay(history.best.board,
           history.best.search.moves,cap,chain,layout.slots,maxTier);
          if(verified.score===history.best.search.score&&
           verified.board.every((tier,i)=>tier===history.best.search.board[i])&&
           (!researchState.best||history.best.search.score>researchState.best.search.score))
           researchState.best={...history.best,slots:layout.slots,layoutName:layout.name};
        }catch{/* Invalid saved results are ignored. */}
      }
      await yieldToUI(signal);
      const base=savedOnly?[]:getModeCandidates(layoutPositions,maxTier,cap,selectedBase,
       chain,protectTier64,baseSplitMode,customSettings);
      prepared=(savedOnly?[]:buildNovelSplitCandidates(base,layoutPositions,maxTier,
       selectedBase,searchBudget,history)).map(candidate=>({...candidate,researchContext:context}));
    }else{
      prepared=foundInfo?
       [buildFoundConfiguration(foundId,layoutPositions,maxTier,cap,chain,protectTier64)].filter(Boolean):
       getModeCandidates(layoutPositions,maxTier,cap,selectedBase,chain,protectTier64,optimizerMode,customSettings);
    }
    return prepared.map(candidate=>({...candidate,slots:layout.slots,layoutName:layout.name}));
  }));
  // Historical fixed boards are replayed once, never used as research seeds.
  const allCandidates=generated?.flat()??null;
  const candidates=foundInfo?allCandidates.slice(0,1):allCandidates;
  const total=custom?1:candidates.length;
  if(total<1&&!researchState.best)throw Error(savedOnly?
   "There is no saved best yet for these game settings. Run a split optimizer first.":
   foundInfo?"This Found Configuration requires 100 contiguous slots, T64, Wind limit T58, and chain limit 25.":
   "No new configurations could be generated for these game settings.");
  let solution=researchState.best;
  // Keep this run's strongest completed candidate separate from the saved
  // all-time winner. Stop & Continue must use the former, even if it scores less.
  let currentRunSolution=null;
  let showCurrentRun=false;
  let overallWinner=solution;
  let winningIsFromCache=Boolean(solution);
  let evaluatedCount=0,runBest=null;
  const previousRecord=researchState.best;
  const statsUpdate=()=>{
   if(!dualSplit)return;
   const initial=previousRecord?.search?.score??null;
   $("researchSavedBest").textContent=formatCompactNumber(overallWinner?.search?.score,{unavailable:"—"});
   $("researchRunBest").textContent=formatCompactNumber(runBest,{unavailable:"—"});
   $("researchLifetime").textContent=formatCompactNumber(researchState.checkedBefore+evaluatedCount);
   $("researchRunCount").textContent=formatCompactNumber(evaluatedCount);
   $("researchSkipped").textContent=formatCompactNumber(researchState.checkedBefore);
   $("researchImprovement").textContent=initial===null?
    (runBest===null?"—":"New record"):(overallWinner?.search?
    "+"+formatCompactNumber(Math.max(0,overallWinner.search.score-initial)):"—");
  };
  statsUpdate();
  if(dualSplit){
    $("researchHistoryStatus").textContent=
     formatCompactNumber(researchState.checkedBefore)+" previously evaluated boards for these game settings · "+
     formatCompactNumber(total)+" new preparations this run · "+
     (solution?"Best saved score: "+formatCompactNumber(solution.search.score):"No saved best yet")+
     (researchState.persistent?". Results remain on this device.":" · Browser storage unavailable; history lasts only until this page closes.");
  }
  $("optimizerSingleProgress").classList.toggle("hidden",dualSplit);
  $("optimizerDualProgress").classList.toggle("hidden",!dualSplit);
  const tracks={
    supply:{progress:$("optimizerSupplyProgress"),status:$("optimizerSupplyStatus"),done:0,
      total:dualSplit?candidates.filter(c=>c.splitDirection==="supply").length:0},
    engine:{progress:$("optimizerEngineProgress"),status:$("optimizerEngineStatus"),done:0,
      total:dualSplit?candidates.filter(c=>c.splitDirection==="engine").length:0}
  };
  for(const track of Object.values(tracks)){
    track.progress.max=Math.max(1,track.total);
    track.progress.value=0;
    track.status.textContent="50/50 · 0%";
  }
  // The running bubble reflects only THIS search's best, not the historical
  // saved winner used to protect results from regressing across sessions.
  const updateLiveScore=()=>{
   setComboScoreBubble(true,currentRunScore({splitResearch:dualSplit,runBest,solution}));
   if(activeSearch){
    // A cached record is NOT enough to enable Stop & Continue.
    activeSearch.hasResult=Boolean((dualSplit?currentRunSolution:solution)?.search);
    if(!activeSearch.signal.aborted)
     $("stopKeepBest").disabled=!activeSearch.hasResult;
   }
   statsUpdate();
  };
  const progress=(done,candidate=null)=>{
    const pct=total?Math.round(done/total*100):100;
    $("optimizerProgressBar").value=done;
    $("optimizerProgressBar").max=Math.max(1,total);
    if(total===0)$("optimizerProgressBar").value=1;
    if(dualSplit&&candidate?.splitDirection){
      const track=tracks[candidate.splitDirection];
      track.done++;
      track.progress.value=track.done;
      const ratio=candidate.splitPercent+"/"+(100-candidate.splitPercent);
      track.status.textContent=ratio+" · "+Math.round(track.done/Math.max(1,track.total)*100)+"% ("+
        track.done+"/"+track.total+")";
      $("optimizerProgressText").textContent=optimizerModeLabel+" · "+
        done+" / "+total+" layouts evaluated in both directions";
    }else{
      $("optimizerProgressText").textContent=optimizerModeLabel+" · "+pct+"% · "+done+" / "+total+" layouts evaluated";
    }
  };
  progress(0);
  // A normal completed research run and Stop & Continue both show this
  // run's result. View saved best is the explicit path to the old record.
  if(solution)updateLiveScore();
  await yieldToUI(signal);
  // Refinement improves the selected current-run board without replacing
  // the historical record unless the verified score really beats it.
  const keepBetterSearch=next=>{
    if(next&&(next.score>solution.search.score||
     (next.score===solution.search.score&&next.remaining<solution.search.remaining))){
     solution.search=next;
     if(dualSplit&&!winningIsFromCache){
      currentRunSolution={...solution,search:next};
      if(betterRunCandidate(solution,overallWinner))overallWinner=solution;
      runBest=next.score;
     }
    }
    updateLiveScore();
  };
  const persistWinner=async candidate=>{
    if(!candidate?.researchContext||!candidate.search?.moves)return;
    const verified=validateComboReplay(candidate.board,candidate.search.moves,
     cap,chain,candidate.slots,maxTier);
    if(verified.score!==candidate.search.score||
     !verified.board.every((tier,i)=>tier===candidate.search.board[i]))
     throw Error("Research result failed replay validation.");
    await rememberBestCandidate(candidate.researchContext,candidate);
  };
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
    updateLiveScore();
    progress(1);
  }else{
    // Abort means discard normally; "Stop & Continue" selects the
    // best replay-validated candidate from this invocation without refinement.
    try{
    if(dualSplit&&typeof Worker!=="undefined"&&total>0){
      await scanSplitDirectionsInParallel(candidates,
       {cap,chain,mode,maxTier},signal,async({direction,processed,splitPercent,improved,checked})=>{
        // Only report work as checked after a Worker completes its batch.
        if(improved)await persistWinner(improved);
        if(checked?.length)await rememberEvaluatedBoards(checked);
        const track=tracks[direction];
        track.done+=processed;
        track.progress.value=track.done;
        track.status.textContent=splitPercent+"/"+(100-splitPercent)+" · "+
         Math.round(track.done/Math.max(1,track.total)*100)+"% ("+
         track.done+"/"+track.total+")";
        evaluatedCount+=processed;
        $("optimizerProgressBar").value=evaluatedCount;
        $("optimizerProgressBar").max=total;
        $("optimizerProgressText").textContent=optimizerModeLabel+" · "+
         evaluatedCount+" / "+total+" layouts evaluated concurrently";
        // The worker has already replay-validated the candidate above.
        if(betterRunCandidate(improved,currentRunSolution))
         currentRunSolution=improved;
        runBest=currentRunSolution?.search?.score??null;
        if(betterRunCandidate(improved,solution)){
          solution=improved;
          overallWinner=improved;
          winningIsFromCache=false;
        }
        // Show progress from THIS run even if the saved record is stronger.
        updateLiveScore();
        if(reachedCurrentRunGoal(goal,runBest)&&activeSearch&&!signal.aborted)
         requestKeepBest();
      });
    }else if(total>0){
      // Non-split planners and browsers lacking module Workers retain the
      // original single-thread evaluation as a compatible fallback.
      for(let i=0;i<candidates.length;i++){
        throwIfCancelled(signal);
        const candidate=candidates[i];
        const greedy=searchCombos(candidate.board,cap,chain,4,positions.length-1,mode,maxTier);
        const search=searchStaircaseCombos(candidate.board,cap,chain,candidate.slots,greedy,{maximumTier:maxTier});
        if(!solution||search.score>solution.search.score||(search.score===solution.search.score&&search.remaining<solution.search.remaining)){
          solution={...candidate,search};
          overallWinner=solution;
          winningIsFromCache=false;
          updateLiveScore();
        }
        if(dualSplit){
         const candidateResult={...candidate,search};
         if(betterRunCandidate(candidateResult,currentRunSolution)){
          // Validate even sub-record candidates, since Stop & Continue
          // can intentionally choose one below the saved all-time score.
          await persistWinner(candidateResult);
          currentRunSolution=candidateResult;
         }
         if(solution?.board===candidate.board)await persistWinner(solution);
         await rememberEvaluatedBoards([{context:candidate.researchContext,
          key:candidate.board.join(",")}]);
         evaluatedCount++;
         runBest=currentRunSolution?.search?.score??null;
         updateLiveScore();
        }
        progress(i+1,candidate);
        if(reachedCurrentRunGoal(goal,runBest)&&activeSearch&&!signal.aborted)
         requestKeepBest();
        await yieldToUI(signal);
      }
    }
    }catch(error){
      if(!(error?.name==="AbortError"&&activeSearch?.keepBestRequested))
       throw error;
    }
    if(signal.aborted&&!activeSearch?.keepBestRequested)throwIfCancelled(signal);
    if(!solution?.search){
      if(signal.aborted)throwIfCancelled(signal);
      throw Error("No completed, replay-validated configuration is available yet.");
    }
    // Completed runs and Stop & Continue show this run's own winner.
    // View saved best (or a run with no new boards to evaluate) uses
    // the historical record, which is maintained independently.
    overallWinner=solution;
    showCurrentRun=dualSplit&&!savedOnly&&Boolean(currentRunSolution?.search);
    const selected=selectDisplayedSearchResult(overallWinner,currentRunSolution,showCurrentRun);
    if(showCurrentRun)winningIsFromCache=false;
    // Never mutate the saved candidate's search object during refinement.
    solution={...selected,search:{...selected.search},
     testedCandidates:dualSplit?evaluatedCount:candidates.length};
    if(!winningIsFromCache&&!activeSearch?.keepBestRequested){
     try{
      $("optimizerProgressText").textContent="Refining the best preparation…";
      await yieldToUI(signal);
      keepBetterSearch(beamSearchCombos(solution.board,cap,chain,solution.board.filter(v=>v>0).length-1,solution.search,maxTier));
      await yieldToUI(signal);
      keepBetterSearch(searchStaircaseCombos(solution.board,cap,chain,solution.slots,solution.search,{maximumTier:maxTier}));
      $("optimizerProgressText").textContent="Checking tactical Wind setups…";
      await yieldToUI(signal);
      keepBetterSearch(searchTacticalCombos(solution.board,cap,chain,solution.slots,solution.search,{depth:12,width:12,branchLimit:16,maximumTier:maxTier}));
      await yieldToUI(signal);
      if(foundInfo||optimizerMode==="adaptive"||optimizerMode==="experimental12"||optimizerMode==="experimental13"){
       $("optimizerProgressText").textContent="Exploring deeper merge orders…";
       await yieldToUI(signal);
       keepBetterSearch(searchLookaheadCombos(solution.board,cap,chain,solution.search,
         {maxPasses:3,maxBranches:18,maxEvaluations:3500,maximumTier:maxTier}));
       await yieldToUI(signal);
      }
     }catch(error){
      // A Stop & Continue click during refinement must still show the last
      // completed candidate rather than being treated like Cancel.
      if(!(error?.name==="AbortError"&&activeSearch?.keepBestRequested))
       throw error;
     }
    } // A cached winner is already verified; don't recompute its merge search.
    if(dualSplit&&activeSearch?.keepBestRequested){
     solution={...selectDisplayedSearchResult(overallWinner,currentRunSolution,true),
      testedCandidates:evaluatedCount};
    }else{
     // Refinement updates history only when this run breaks the record.
     if(betterRunCandidate(solution,overallWinner))overallWinner=solution;
    }
  }
  if(signal.aborted&&!activeSearch?.keepBestRequested)throwIfCancelled(signal);
  if(!solution||!solution.search)throw Error("No valid preparations for these tier settings.");
  if(dualSplit){
    $("researchHistoryStatus").textContent=
      formatCompactNumber(researchState.checkedBefore+evaluatedCount)+
      " boards evaluated across sessions for these game settings · "+
      "Saved best verified score: "+formatCompactNumber(overallWinner?.search?.score??solution.search.score)+
      (showCurrentRun?
       " · Showing this run's best: "+formatCompactNumber(solution.search.score):
       savedOnly?" · Viewing saved best":
       evaluatedCount===0?" · No new boards; showing saved best":"")+
      (researchState.persistent?" · Saved in this browser.":" · Session-only memory.");
  }
  const result=solution.search;
  const recommendedSlots=solution.slots??slots;
  const verified=validateComboReplay(solution.board,result.moves,cap,chain,recommendedSlots,maxTier);
  if(verified.score!==result.score||!verified.board.every((t,i)=>t===result.board[i])){
    throw Error("Combo replay validation disagrees with the optimizer result.");
  }
  // The saved-best store only replaces records with a higher validated score.
  // Displaying a weaker current-run result does not overwrite historical best.
  if(dualSplit)await persistWinner(solution);
  const timeout=Math.max(.1,Number($("comboTimeout").value)||5.5);
  const moveTime=Math.max(.1,Number($("mergeTime").value)||1.5);
  const relocationTime=Math.max(.1,Number($("relocationTime").value)||.6);
  const timing=validateTiming(result.moves,timeout,moveTime,relocationTime);
  $("timingStatus").textContent=timing.valid?"Timing feasible under assumptions":"Timing infeasible under assumptions";
  $("timingStatus").className=timing.valid?"timing-good":"timing-bad";
  $("timingDetails").textContent="Estimated execution: "+timing.totalDuration.toFixed(1)+"s · Tightest interval margin: "+(timing.minimumMargin===null?"—":timing.minimumMargin.toFixed(1)+"s")+" · Repositioning does not refresh the combo timer; merging does.";
  setComboScoreBubble(false,result.score);
  $("solverMoves").textContent=verified.merges;
  $("solverRepositions").textContent=verified.repositions;
  $("solverNote").textContent=(custom?"Custom board · staircase recycling, greedy, beam, and tactical reposition searches tested. ":
   solution.testedCandidates===0?"Loaded previously verified best configuration. ":
   "Best of "+solution.testedCandidates+" new preparations (base Tier "+solution.base+", "+solution.shape+"). ")+result.remaining+" occupied sushi remain. Heat model: "+mode+". Scores remain estimates, not a guaranteed maximum.";
  if(activeSearch?.keepBestRequested&&dualSplit)
   $("solverNote").textContent="Stopped early. This is the best completed configuration from the current run, not necessarily the historical best. "+$("solverNote").textContent;
  else if(dualSplit&&savedOnly)
   $("solverNote").textContent="Viewing the historical saved best configuration. "+$("solverNote").textContent;
  else if(dualSplit&&evaluatedCount===0)
   $("solverNote").textContent="No new configurations were available; showing the historical saved best. "+$("solverNote").textContent;
  else if(dualSplit)
   $("solverNote").textContent="This is the best completed configuration from the current run. "+$("solverNote").textContent;
  $("solverNote").textContent+=(foundInfo?" This is a previously found fixed board, not a configuration discovered by an optimizer.":"")+" Mode: "+optimizerModeLabel+". Winning strategy: "+result.strategy+". Slot arrangement: "+(solution.layoutName??"Current positions")+". Available prepared tier: "+maxTier+"; East Wind limit: "+cap+".";
  if(!movementMittens&&!custom)$("solverNote").textContent+=" Slot positions are kept unchanged because Movement Mittens is not unlocked.";
  if(solution.adaptive)$("solverNote").textContent+=" Adaptive "+solution.shape+
   " (working tier T"+solution.workingTier+
   (solution.referenceExperiment?", learned from historical Exp "+solution.referenceExperiment:"")+
   "). Historical scores do not transfer to these settings.";
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
  const comparison=comparePreparedBoard(imported.tiles,slots,solution.board,recommendedSlots);
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
      const protectedTier=sectionInfo.protectedPosition===null?null:values[sectionInfo.protectedPosition];
      supplyText.textContent=(protectedTier?"The protected Tier "+protectedTier+" stays first. ":"")+
       "Supply sushi are arranged highest to lowest for easier preparation. They feed merge triggers into the Wind engine.";
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
    }
    // Reuse Overview's square plate swatches and show the section outlines
    // as matching rose/mint border samples instead of describing colors.
    const legend=document.createElement("div");
    legend.className="legend optimizer-board-legend";
    const addKey=(symbolClass,labelText,symbolText="")=>{
      const item=document.createElement("span");
      const sample=document.createElement("i");sample.className=symbolClass;
      sample.setAttribute("aria-hidden","true");
      if(symbolText)sample.textContent=symbolText;
      item.append(sample,document.createTextNode(labelText));
      legend.append(item);
    };
    if(sectionInfo){
      addKey("prepared-legend-supply","Supply / tools");
      addKey("prepared-legend-chain","Wind engine");
    }
    for(const [symbol,labelText] of [
      ["normal","Regular"],["hot","Hot"],["cold","Cold"],["milk","Milktoast"]
    ])addKey(symbol,labelText);
    if(showTiers){
      // Match the actual symbols and colors drawn on the prepared sushi tiles.
      addKey("combo-cell-status combo-status-correct","Already correct","✓");
      addKey("combo-cell-status combo-status-wrong","Wrong sushi","!");
      addKey("combo-cell-status combo-status-missing","Add sushi","+");
      addKey("combo-cell-status combo-status-slot","Plate mismatch","↔");
    }
    root.append(legend);
    const legendHint=document.createElement("p");
    legendHint.className="hint optimizer-legend-hint";
    legendHint.textContent=(sectionInfo?
     "Hover or focus a section card to highlight its tiles; click to pin it. ":"")+
     "Hover over a tile for its plate type and position.";
    root.append(legendHint);
    const scroll=document.createElement("div");scroll.className="board-scroll optimizer-board-scroll";
    const grid=document.createElement("div");grid.className="board optimizer-board"+(sectionInfo?" prepared-section-board":"");
    for(let i=0;i<BOARD_CELLS;i++){
      const slot=recommendedSlots[i]??-1,tier=values[i]??0;
      const cell=document.createElement("div");
      cell.className="tile"+(slot>=0?" slot-"+slot:" locked")+(showTiers&&tier<1?" empty":"");
      if(sectionInfo?.roles[i])cell.classList.add("prepared-"+sectionInfo.roles[i]);
      if(sectionInfo?.protectedPosition===i)cell.classList.add("prepared-protected");
      if(sectionInfo?.firstEnginePosition===i)cell.classList.add("prepared-engine-start");
      if(slot>=0&&showTiers&&tier>0){
        addSushiVisual(cell,tier);
        if(values===solution.board)decoratePreparedCell(cell,comparison.statuses[i]);
      }
      else if(slot>=0&&!showTiers){const dot=document.createElement("span");dot.className="slot-marker";dot.textContent="•";cell.append(dot);}
      const role=sectionInfo?.roles[i]==="supply"?(sectionInfo.protectedPosition!==null&&i===sectionInfo.protectedPosition?" · Protected anchor / supply section":" · Supply / tools"):sectionInfo?.roles[i]==="chain"?" · Fixed Wind chain":"";
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
  renderComboReport(root,{solution,previousBest:dualSplit?previousRecord:null});
  const heading=document.createElement("h3");heading.textContent=sectionNumber+" · Interactive merge sequence";root.append(heading);
  const intro=document.createElement("p");intro.className="hint";intro.textContent="The board shows the selected step. Blue FROM and green TO labels mark the upcoming move; purple highlights show Wind upgrades. Use the step list or playback controls to follow the sequence.";root.append(intro);
  const layout=document.createElement("div");layout.className="merge-layout";
  layout.tabIndex=0;
  layout.setAttribute("role","region");
  layout.setAttribute("aria-label","Interactive Sushi Station merge replay. Use left and right arrows to navigate steps.");
  const left=document.createElement("div");left.className="merge-board-panel";
  const controls=document.createElement("div");controls.className="merge-controls";
  const navigation=document.createElement("div");navigation.className="merge-navigation";
  const first=document.createElement("button");first.type="button";first.className="button quiet";first.textContent="↺ Step 0";first.title="Return to the prepared board";
  const previous=document.createElement("button");previous.type="button";previous.className="button secondary";previous.textContent="← Previous";
  const playButton=document.createElement("button");playButton.type="button";playButton.className="button primary merge-play";playButton.textContent="▶ Play";playButton.setAttribute("aria-pressed","false");
  const next=document.createElement("button");next.type="button";next.className="button secondary";next.textContent="Next →";
  const nextWind=document.createElement("button");nextWind.type="button";nextWind.className="button quiet merge-next-wind";nextWind.textContent="Next Wind ✦";nextWind.title="Jump to the next merge with East Wind upgrades (skips intermediate actions in this preview)";
  const lastStep=document.createElement("button");lastStep.type="button";lastStep.className="button quiet";lastStep.textContent="Last step";lastStep.title="Skip to the final step";
  const indicator=document.createElement("strong");indicator.className="merge-step-indicator";indicator.setAttribute("aria-live","polite");
  navigation.append(first,previous,playButton,next,nextWind,lastStep);
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
  const previewLabel=document.createElement("label");previewLabel.className="merge-preview-label";
  const previewCheck=document.createElement("input");previewCheck.type="checkbox";previewCheck.checked=true;
  previewLabel.append(previewCheck,document.createTextNode("Highlight next move"));
  timeline.append(seek,speedLabel,previewLabel);left.append(timeline);
  const boardScroll=document.createElement("div");boardScroll.className="board-scroll optimizer-board-scroll";
  const boardGrid=document.createElement("div");boardGrid.className="board optimizer-board merge-board";
  boardScroll.append(boardGrid);left.append(boardScroll);
  const scoreLine=document.createElement("p");scoreLine.className="merge-score";left.append(scoreLine);
  const shortcuts=document.createElement("p");shortcuts.className="hint merge-shortcuts";
  shortcuts.textContent="Keyboard: focus the replay panel, then ← / → = previous / next, Space = play or pause, W = next Wind. Click a step on the right to jump directly.";
  left.append(shortcuts);
  const right=document.createElement("div");right.className="merge-step-list";right.setAttribute("aria-label","Merge steps");
  const listHeader=document.createElement("div");listHeader.className="merge-step-list-heading";
  const listTitle=document.createElement("strong");listTitle.textContent="Step checklist";
  const copySteps=document.createElement("button");copySteps.type="button";copySteps.className="button quiet";copySteps.textContent="Copy steps";
  listHeader.append(listTitle,copySteps);right.append(listHeader);
  layout.append(left,right);root.append(layout);
  const cumulative=[0];for(const m of result.moves)cumulative.push(cumulative[cumulative.length-1]+m.score);
  const replayGuide=buildReplayGuide(solution.board,result.moves,COLUMNS);

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
    const nextMove=(!move||resolved)&&previewCheck.checked?
      result.moves[selected]:null;
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
      if(type>=0&&nextMove&&(i===nextMove.src||i===nextMove.dst)){
        const isFrom=i===nextMove.src;
        tile.classList.remove("dim-tile");
        tile.classList.add("focus-tile",isFrom?"merge-next-from":"merge-next-to");
        const marker=document.createElement("span");
        marker.className="merge-next-marker";
        marker.textContent=isFrom?"FROM":"TO";
        marker.setAttribute("aria-hidden","true");
        tile.append(marker);
      }
      if(resolved&&move&&i===move.dst&&type>=0&&!prefersReducedMotion())
        tile.classList.add("merge-landed");
      tile.title="Position "+(i+1)+" · "+(SLOT_NAMES[type]??"Locked")+
        (tier?" · Tier "+tier:" · Empty")+
        (changes.has(i)?" · "+changes.get(i):"")+
        (nextMove&&i===nextMove.src?" · Next source":nextMove&&i===nextMove.dst?" · Next destination":"");
      boardGrid.append(tile);
    }
  }
  function completedScore(move){
    scoreLine.textContent="Combo Meter: "+formatCompactNumber(cumulative[selected])+" points"+
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
    nextWind.disabled=nextWindReplayStep(result.moves,selected)===null;
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
        const {left,top,width,height,dx,dy}=replayFlightGeometry(
          sourceRect,destRect,gridRect,boardGrid.clientLeft,boardGrid.clientTop);
        flightGhost=sourceTile.cloneNode(true);
        flightGhost.classList.remove("focus-tile","merge-source","dim-tile","wind-active");
        flightGhost.classList.add("merge-flying-sushi");
        flightGhost.removeAttribute("title");
        flightGhost.setAttribute("aria-hidden","true");
        // Absolute positioning starts at the board's inner border edge.
        // Match source size, then travel from center to center at the
        // destination even if responsive tile sizes differ fractionally.
        flightGhost.style.left=left+"px";
        flightGhost.style.top=top+"px";
        flightGhost.style.width=width+"px";
        flightGhost.style.height=height+"px";
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
      button.classList.toggle("completed",i>0&&i<selected);
      button.classList.toggle("up-next",i===selected+1);
      button.setAttribute("aria-current",i===selected?"step":"false");
    });
    // Only scroll the checklist, not the entire page while autoplay runs.
    const active=stepButtons[selected];
    if(active){
      const listBounds=right.getBoundingClientRect();
      const itemBounds=active.getBoundingClientRect();
      if(itemBounds.top<listBounds.top+45)
        right.scrollTop+=itemBounds.top-listBounds.top-70;
      else if(itemBounds.bottom>listBounds.bottom)
        right.scrollTop+=itemBounds.bottom-listBounds.bottom+12;
    }
  }
  function addStep(title,detail,index){
    const button=document.createElement("button");button.type="button";button.className="merge-step";
    const name=document.createElement("strong");name.textContent=title;
    const description=document.createElement("span");description.textContent=detail;
    button.append(name,description);button.addEventListener("click",()=>player.goTo(index));
    right.append(button);stepButtons.push(button);
  }
  addStep("Step 0 · Prepared board","All sushi positioned; combo not started",0);
  replayGuide.forEach((item,i)=>{
    addStep("Step "+item.step+" · "+item.action+" · "+item.short,
      "+"+formatCompactNumber(item.score)+" pts · "+item.windUpgrades+
      " Wind · Total "+formatCompactNumber(cumulative[i+1])+
      " · "+(timing.events[i].safe?"Timing OK":"Timeout risk"),item.step);
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
  nextWind.addEventListener("click",()=>{
    const windStep=nextWindReplayStep(result.moves,player.step);
    if(windStep!==null)player.goTo(windStep);
  });
  lastStep.addEventListener("click",()=>player.goTo(result.moves.length));
  playButton.addEventListener("click",()=>player.toggle());
  seek.addEventListener("input",()=>player.goTo(Number(seek.value)));
  speedSelect.addEventListener("change",()=>{
    finishFlight();
    player.reschedule();
  });
  previewCheck.addEventListener("change",()=>{
    // Redraw the fully resolved board when changing guide visibility.
    finishFlight();
    const move=selected>0?result.moves[selected-1]:null;
    const frame=move?.board??solution.board;
    const frameTiming=move?replayMotionTiming(move,Number(speedSelect.value),
      {reducedMotion:true}):null;
    drawFrame(frame,move,{resolved:Boolean(move),timing:frameTiming});
    completedScore(move);
  });
  layout.addEventListener("pointerdown",event=>{
    if(event.target.closest?.("button,input,select,textarea,label"))return;
    layout.focus({preventScroll:true});
  });
  layout.addEventListener("keydown",event=>{
    if(event.altKey||event.ctrlKey||event.metaKey||
      event.target.closest?.("button,input,select,textarea,[contenteditable='true']"))return;
    let handled=true;
    switch(event.key){
      case "ArrowRight":player.goTo(player.step+1);break;
      case "ArrowLeft":player.goTo(player.step-1);break;
      case "Home":player.goTo(0);break;
      case "End":player.goTo(result.moves.length);break;
      case " ":player.toggle();break;
      case "w":case "W":{
        const nextWindStep=nextWindReplayStep(result.moves,player.step);
        if(nextWindStep!==null)player.goTo(nextWindStep);
        break;
      }
      default:handled=false;
    }
    if(handled)event.preventDefault();
  });
  copySteps.addEventListener("click",async()=>{
    const lines=["Sushi Station · Combo Meter replay",
      "Starting prepared board: "+solution.board.join(","),
      "Total simulated score: "+formatCompactNumber(result.score)+" points",""];
    replayGuide.forEach((item,index)=>{
      lines.push("Step "+item.step+": "+item.instruction);
      lines.push("  "+item.outcome+" · Running total: "+
        formatCompactNumber(cumulative[index+1])+" points");
    });
    const body=lines.join("\n");
    try{
      if(!navigator.clipboard?.writeText)throw Error("Clipboard unavailable");
      await navigator.clipboard.writeText(body);
      copySteps.textContent="Copied ✓";
    }catch{
      const blob=new Blob([body],{type:"text/plain;charset=utf-8"});
      const url=URL.createObjectURL(blob),link=document.createElement("a");
      link.href=url;link.download="sushi-combo-steps.txt";
      document.body.append(link);link.click();link.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),1000);
      copySteps.textContent="Downloaded steps";
    }
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
 const shownModes=MODE_CATALOG.filter(m=>m.kind==="split");
 const found=$("foundConfiguration"),oldFound=found.value;
 found.replaceChildren();
 const placeholder=document.createElement("option");
 placeholder.value="";placeholder.textContent="Choose an Experiment…";found.append(placeholder);
 for(const entry of FOUND_CONFIGURATIONS){
  const option=document.createElement("option");
  option.value=entry.id;
  option.textContent=entry.name+" · "+formatCompactNumber(entry.benchmark)+" simulated pts";
  found.append(option);
 }
 found.value=FOUND_CONFIGURATIONS.some(entry=>entry.id===oldFound)?oldFound:"";
 for(const mode of shownModes){
  const option=document.createElement("option");option.value=mode.id;option.textContent=modeOptionLabel(mode);selector.append(option);
  const row=document.createElement("tr");row.dataset.mode=mode.id;
  const scope={simple:"One cascade",optimizer1:"20%",optimizer2:"10%",
   optimizer3:"5%",optimizer4:"1%",optimizer5:"User selected"}[mode.id]??"—";
  for(const value of [modeDisplayLabel(mode),mode.difficulty,scope]){
   const cell=document.createElement("td");cell.textContent=value;row.append(cell);
  }
  rows.append(row);
 }
 selector.value=shownModes.some(mode=>mode.id===old)?old:"simple";
}
function updateOptimizerModeHint(){
 const info=getModeInfo($("optimizerMode").value);
 $("optimizerModeName").textContent=modeDisplayLabel(info);
 const difficulty=$("optimizerDifficulty");
 difficulty.textContent=info.difficulty;
 difficulty.className="mode-difficulty mode-difficulty-"+info.difficulty.toLowerCase();
 const tier=Number($("seedTier").value);
 const discovered=imported?detectSushiProgress(imported).highest:0;
 const preview=tier>64&&tier>discovered;
 $("optimizerModeBenchmark").textContent=info.benchmark===null?
  (info.kind==="split"?"Search at your settings":info.id==="adaptive"?"Simulated at your settings":preview?"Future-tier preview":"Flexible setups"):
  (preview?"Historical T64 benchmark: ":"")+formatCompactNumber(info.benchmark)+" simulated pts";
 $("optimizerModeHint").textContent=info.summary+(preview?
  " Above-T64 tiers have not been confirmed in this save. Historical experiment benchmarks remain T64/T58 only.":"");
 const isCustom=info.id==="optimizer5";
 // Custom controls use the same main settings grid as every other mode.
 for(const field of document.querySelectorAll(".custom-optimizer-setting"))
  field.classList.toggle("hidden",!isCustom);
 const count=Number($("customPerSplit").value);
 const budget=Number.isSafeInteger(count)&&count>=1&&count<=1000?count:null;
 const resolution=$("customSplitMode").value;
 const ratios=new Set([...comboSplitPercentages(resolution,"supply"),
  ...comboSplitPercentages(resolution,"engine")]);
 $("customSearchEstimate").textContent=budget?
  ratios.size+" unique splits × "+budget+" distinct configurations = up to "+
  formatCompactNumber(ratios.size*budget)+" preparations per slot arrangement. Actual counts can be lower where the search cannot generate enough unique boards.":
  "Enter a whole number between 1 and 1,000.";
 for(const row of $("modeComparisonRows").rows)row.classList.toggle("is-selected",row.dataset.mode===info.id);
}
initModePicker();
$("optimizerMode").addEventListener("change",updateOptimizerModeHint);
$("customSplitMode").addEventListener("change",updateOptimizerModeHint);
$("customPerSplit").addEventListener("input",updateOptimizerModeHint);
const updateFoundButton=()=>{$("runFoundConfiguration").disabled=!$("foundConfiguration").value;};
$("foundConfiguration").addEventListener("change",updateFoundButton);
updateFoundButton();
updateOptimizerModeHint();
function updateCancelControls(state){
 const running=state!=="idle",stopping=state==="stopping";
 $("stopKeepBest").classList.toggle("hidden",!running);
 $("stopKeepBest").disabled=stopping||!activeSearch?.hasResult;
 $("stopKeepBest").textContent=stopping&&activeSearch?.keepBestRequested?
  "Opening this run's result…":"Stop & Continue";
 for(const button of [$("cancelSolver"),$("cancelSolverProgress")]){
  button.classList.toggle("hidden",!running);
  button.disabled=stopping;
  button.textContent=stopping?"Stopping…":
   button.id==="cancelSolverProgress"?"Cancel optimization":"Cancel";
 }
}
function requestSearchCancellation(){
 if(!activeSearch||activeSearch.signal.aborted)return;
 cancelRunningSearch();
 updateCancelControls("stopping");
 $("optimizerProgressText").textContent="Stopping after the current calculation…";
}
$("cancelSolver").addEventListener("click",requestSearchCancellation);
$("cancelSolverProgress").addEventListener("click",requestSearchCancellation);
function requestKeepBest(){
 if(!activeSearch||!activeSearch.hasResult||activeSearch.signal.aborted)return;
 activeSearch.keepBestRequested=true;
 cancelRunningSearch();
 updateCancelControls("stopping");
 $("optimizerProgressText").textContent="Stopping · preparing this run's best verified result…";
}
$("stopKeepBest").addEventListener("click",requestKeepBest);
// Research history never includes the imported Idleon account JSON.
function verifyImportedResearchBest(context,candidate){
 try{
  const [version,maxTier,cap,chain,base,protectedTop,slots]=JSON.parse(context);
  if(!Array.isArray(slots)||slots.length!==BOARD_CELLS||
   !Array.isArray(candidate.board)||candidate.board.length!==BOARD_CELLS||
   !Array.isArray(candidate.slots)||candidate.slots.length!==BOARD_CELLS||
   !candidate.slots.every((type,i)=>type===slots[i])||
   !candidate.board.every((tier,i)=>
     Number.isSafeInteger(tier)&&tier>=0&&tier<=Math.max(64,maxTier)&&
     (slots[i]>=0||tier===0))||
   !Array.isArray(candidate.search?.moves)||
   !Array.isArray(candidate.search?.board)||
   !Number.isSafeInteger(candidate.search?.score))return false;
  const verified=validateComboReplay(candidate.board,candidate.search.moves,
   cap,chain,slots,maxTier);
  return verified.score===candidate.search.score&&
   verified.board.every((tier,i)=>tier===candidate.search.board[i]);
 }catch{return false;}
}
$("exportResearch").addEventListener("click",async()=>{
 if(activeSearch)return;
 const button=$("exportResearch");button.disabled=true;
 try{
  const payload=await exportResearchData();
  const blob=new Blob([JSON.stringify(payload)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;link.download="idleon-sushi-research.json";
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  $("researchHistoryStatus").textContent="Exported "+
   formatCompactNumber(payload.checked.length)+" board fingerprints and "+
   payload.best.length+" saved best configurations. No account data included.";
 }catch(error){
  $("researchHistoryStatus").textContent="Research export failed: "+String(error.message??error);
 }finally{button.disabled=false;}
});
$("importResearchButton").addEventListener("click",()=>{
 if(!activeSearch)$("importResearch").click();
});
$("importResearch").addEventListener("change",async event=>{
 if(activeSearch)return;
 const file=event.target.files?.[0];
 if(!file)return;
 try{
  if(file.size>50*1024*1024)throw Error("Research import exceeds the 50 MB safety limit");
  const data=JSON.parse(await file.text());
  const result=await importResearchData(data,verifyImportedResearchBest);
  $("researchHistoryStatus").textContent="Imported "+
   formatCompactNumber(result.checked)+" evaluated board fingerprints and "+
   result.best+" validated best configurations. Run the optimizer to use them.";
 }catch(error){
  $("researchHistoryStatus").textContent="Research import failed: "+String(error.message??error);
 }finally{event.target.value="";}
});
$("clearResearchHistory").addEventListener("click",async()=>{
 if(activeSearch)return;
 if(!window.confirm("Clear previously evaluated optimizer boards and saved best scores from this browser?"))return;
 const button=$("clearResearchHistory");
 button.disabled=true;
 try{
  await resetResearchHistory();
  $("researchHistoryStatus").textContent="Local optimizer history cleared. The next run starts a new search.";
 }catch(error){
  $("researchHistoryStatus").textContent="Could not clear local research: "+String(error.message??error);
 }finally{button.disabled=false;}
});
async function executeConfiguredSearch(foundId=null,savedOnly=false){
  if(!imported){$("solverNote").textContent="Import a valid game save JSON first.";return;}
  if(activeSearch)return;
  disposeReplay();
  const controller=new AbortController();
  activeSearch=controller;
  controller.keepBestRequested=false;controller.hasResult=false;
  const runButton=$("runSolver"),foundButton=$("runFoundConfiguration");
  const button=foundId?foundButton:runButton;
  runButton.disabled=true;foundButton.disabled=true;
  for(const id of ["clearResearchHistory","viewResearchBest","exportResearch","importResearch","importResearchButton"])
   $(id).disabled=true;
  button.textContent=foundId?"Replaying…":savedOnly?"Loading saved best…":"Optimizing…";
  updateCancelControls("running");
  $("optimizerProgress").classList.remove("hidden");
  $("optimizerSingleProgress").classList.remove("hidden");
  $("optimizerDualProgress").classList.add("hidden");
  $("optimizerProgressBar").value=0;$("optimizerProgressBar").max=1;
  $("optimizerProgressText").textContent="Preparing search…";
  setComboScoreBubble(true);
  $("solverResults").classList.add("hidden");
  $("solverNote").textContent="Searching candidate layouts…";
  try{
    // Let the browser paint the Cancel controls before preparing a large
    // candidate catalogue, which otherwise blocks the main JS thread.
    await yieldToUI(controller.signal);
    await showSolver(controller.signal,foundId,savedOnly);
    if(!controller.keepBestRequested)throwIfCancelled(controller.signal);
    $("solverResults").classList.remove("hidden");
    $("optimizerProgressText").textContent=controller.keepBestRequested?
     "Stopped early · This run's best result ready":"Complete · Results ready";
    requestAnimationFrame(()=>{
      const target=$("optimizerSlotLayout");
      if(target)target.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"});
    });
  }catch(e){
    // Incomplete searches cannot present an unverified winner as a final score.
    $("solverScoreBubble").classList.add("hidden");
    if(e.name==="AbortError"){
      $("optimizerProgressText").textContent="Search cancelled · Change settings and run again";
      $("solverNote").textContent="Search cancelled. No incomplete results were shown.";
    }else{
      $("solverNote").textContent="Optimizer error: "+String(e.message??e);
      $("optimizerProgressText").textContent="Optimization failed";
    }
  }finally{
    if(activeSearch===controller)activeSearch=null;
    runButton.disabled=false;runButton.textContent="Run optimizer";
    foundButton.textContent="Replay found board";
    foundButton.disabled=!$("foundConfiguration").value;
    updateCancelControls("idle");
    for(const id of ["clearResearchHistory","viewResearchBest","exportResearch","importResearch"])
     $(id).disabled=false;
  }
}
$("runSolver").addEventListener("click",()=>executeConfiguredSearch());
$("viewResearchBest").addEventListener("click",()=>executeConfiguredSearch(null,true));
$("runFoundConfiguration").addEventListener("click",()=>{
 const foundId=$("foundConfiguration").value;
 if(foundId)executeConfiguredSearch(foundId);
});
