const $=id=>document.getElementById(id);
const COLUMNS=15;
function decodeSave(input){
  if(!input||typeof input!=="object")throw Error("Expected a JSON object.");
  const raw=input.data?.Sushi??input.Sushi;
  if(raw==null)throw Error("No Sushi data found. Expected data.Sushi (Idleon Toolbox) or Sushi (raw game data).");
  let sushi=typeof raw==="string"?JSON.parse(raw):raw;
  if(!Array.isArray(sushi)||!Array.isArray(sushi[0]))throw Error("Sushi data does not contain the expected tile array.");
  if(!sushi[0].every(x=>Number.isInteger(Number(x))))throw Error("Sushi tile array contains non-numeric entries.");
  return {sushi,tiles:sushi[0].map(Number),source:input.data?.Sushi!=null?"Idleon Toolbox":"Raw game data"};
}
function renderBoard(tiles){
  const board=$("board");board.replaceChildren();
  for(const id of tiles){
    const cell=document.createElement("div");cell.className="tile"+(id<0?" empty":id>=63?" high":"");
    if(id<0){cell.textContent="·";cell.title="Empty slot";}
    else{
      const emoji=document.createElement("span");emoji.className="emoji";emoji.textContent=id>=61?"🍣":"🍱";
      const tier=document.createElement("span");tier.className="tier";tier.textContent=id+1;
      cell.append(emoji,tier);cell.title="Sushi tier "+(id+1)+" (ID "+id+")";
    }
    board.append(cell);
  }
  const filled=tiles.filter(n=>n>=0).length;
  $("boardStatus").textContent=filled+" sushi tiles";
  $("boardDetails").textContent=tiles.length+" stored positions · "+filled+" occupied · "+(tiles.length-filled)+" empty · "+COLUMNS+" columns · "+Math.ceil(tiles.length/COLUMNS)+" stored rows. Verify the visual layout against the in-game board.";
}
function importSave(data,label){
  const parsed=decodeSave(data);
  renderBoard(parsed.tiles);
  $("importStatus").textContent="JSON imported";$("importStatus").classList.add("success");
  $("importSummary").textContent=label+" · "+parsed.source+" · "+parsed.tiles.length+" sushi positions decoded.";
  $("importSummary").classList.remove("hidden");
  $("jsonPreview").textContent=JSON.stringify({source:parsed.source,sushiArrayLengths:parsed.sushi.map(x=>Array.isArray(x)?x.length:null),firstTiles:parsed.tiles.slice(0,30)},null,2);
}
function error(e){$("importStatus").textContent="Import failed";$("importStatus").classList.remove("success");$("jsonPreview").textContent=String(e.message??e);$("importSummary").classList.add("hidden");}
$("pasteToggle").addEventListener("click",()=>{const open=$("pasteArea").classList.toggle("hidden")===false;$("pasteToggle").setAttribute("aria-expanded",String(open));if(open)$("jsonInput").focus();});
$("parseJson").addEventListener("click",()=>{try{importSave(JSON.parse($("jsonInput").value),"Pasted JSON");}catch(e){error(e);}});
$("jsonFile").addEventListener("change",async e=>{const f=e.target.files?.[0];if(!f)return;try{importSave(JSON.parse(await f.text()),f.name);}catch(err){error(err);}});
$("clearImport").addEventListener("click",()=>{$("jsonInput").value="";$("jsonFile").value="";$("board").replaceChildren();$("importSummary").classList.add("hidden");$("pasteArea").classList.add("hidden");$("pasteToggle").setAttribute("aria-expanded","false");$("importStatus").textContent="Waiting for data";$("importStatus").classList.remove("success");$("boardStatus").textContent="Import a save";$("boardDetails").textContent="Your imported tiles will appear here.";$("jsonPreview").textContent="No JSON imported yet.";});
