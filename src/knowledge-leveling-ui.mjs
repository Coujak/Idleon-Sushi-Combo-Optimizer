// Knowledge EXP cycle optimizer UI. The imported save is never mutated.
// The account-dependent search only runs on an explicit Build button click.
import {getKnowledgeRows,numberText} from "./lab-model.mjs?v=1.19.13";
import {sushiTierIconPath} from "./sushi-reference.mjs?v=1.16.6";
import {parseGameQuantity} from "./progression-calibration.mjs?v=1.17.1";
import {normalizeKnowledgeCycleOptions}
 from "./knowledge-cycle-optimizer.mjs?v=1.0.1";
import {createReplayController} from "./replay-controller.mjs";

const $=id=>document.getElementById(id);
const elem=(tag,cls="",value)=>{
 const node=document.createElement(tag);
 if(cls)node.className=cls;
 if(value!==null&&value!==undefined)node.textContent=String(value);
 return node;
};
const compact=n=>Number.isFinite(n)?numberText(n):"—";
const rate=n=>n===null||n===undefined?"—":compact(n);
const finite=x=>typeof x==="number"&&Number.isFinite(x);
const formatHours=n=>{
 if(n===null||n===undefined||!finite(n)||n<0)return "Unavailable";
 if(n===0)return "Ready";
 if(n<1)return Math.max(1,Math.round(n*60))+" min";
 if(n<48)return compact(n)+" hr";
 return compact(n/24)+" days";
};
const preferenceKey="idleon-sushi-knowledge-cycle-v1";
const FIREPLACE_IMAGES=[
 "Charcoal Fireplace (Upgrade 17).png",
 "Barium Firelighter (Upgrade 26).png",
 "Copper Firelighter (Upgrade 33).png",
 "Lithium Firelighter (Upgrade 40).png",
 "Potassium Firelighter (Upgrade 42).png"
];
const FIREPLACE_NAMES=["Charcoal","Barium","Copper","Lithium","Potassium"];
const showNames=[{key:"knowledgePlanCookSeconds",field:"secondsPerCook"},
 {key:"knowledgePlanMergeSeconds",field:"secondsPerMerge"},
];
const quantityInput=id=>{
 const raw=$(id).value.trim();
 if(!raw)return null;
 try{
  const value=parseGameQuantity(raw);
  return finite(value)&&value>0?value:null;
 }catch{return null;}
};
export function initializeKnowledgeLevelingUI(getSave){
 const mode=$("knowledgePlanMode"),target=$("knowledgePlanTarget");
 const targetLabel=$("knowledgePlanTargetLabel");
 const build=$("knowledgePlanRun"),cancelButton=$("knowledgePlanCancel");
 const status=$("knowledgePlanStatus");
 const summary=$("knowledgePlanFeatured"),replay=$("knowledgePlanRotation");
 const passiveBox=$("knowledgePlanPassive"),passiveToggle=$("knowledgePlanProtectPassive");
 const board=$("knowledgePlanBoard"),tips=$("knowledgePlanTips");
 const speed=$("knowledgePlanSpeed");
 let state={mode:"balanced",targetTier:null};
 let result=null,controller=null,worker=null;
 try{
  const old=JSON.parse(window.localStorage.getItem(preferenceKey)||"null");
  state={...normalizeKnowledgeCycleOptions(old),preservePassive:old?.preservePassive!==false};
 }catch{state={...normalizeKnowledgeCycleOptions(),preservePassive:true};}
 mode.value=state.mode;
 passiveToggle.checked=state.preservePassive;
 const persist=()=>{
  try{window.localStorage.setItem(preferenceKey,JSON.stringify({
   mode:mode.value,targetTier:state.targetTier,
   preservePassive:passiveToggle.checked
  }));}catch{/* Browser-local settings are optional. */}
 };
 const stopSearch=()=>{
  worker?.terminate();worker=null;
  cancelButton.classList.add("hidden");
  build.disabled=!getSave();
 };
 const release=()=>{
  stopSearch();
  controller?.dispose();controller=null;
  result=null;summary.replaceChildren();board.replaceChildren();
  passiveBox.replaceChildren();
  $("knowledgePlanLevelRows").replaceChildren();
  summary.classList.add("hidden");passiveBox.classList.add("hidden");
  replay.classList.add("hidden");
 };
 function updateTargets(){
  const candidates=getKnowledgeRows(getSave()).filter(x=>x.discovered);
  const old=Number(state.targetTier);
  target.replaceChildren();
  for(const tier of candidates)target.append(new Option(
   "T"+tier.tier+" · "+tier.name,String(tier.tier)));
  state.targetTier=candidates.some(x=>x.tier===old)?old:candidates[0]?.tier??null;
  if(state.targetTier!==null)target.value=String(state.targetTier);
  targetLabel.classList.toggle("hidden",mode.value!=="focused");
 }
 function calibration(){
  const options={
   mode:mode.value,
   targetTier:state.targetTier,
   preservePassive:passiveToggle.checked,
   fuelGeneration:quantityInput("knowledgePlanFuelRate"),
   fuelCapacity:quantityInput("knowledgePlanFuelCap"),
   expPerCreation:quantityInput("knowledgePlanXpPerCreation"),
   rounds:Number($("knowledgePlanRounds").value)
  };
  for(const {key,field} of showNames)options[field]=Number($(key).value);
  return options;
 }
 function metric(label,value){
  const card=elem("div","lab-kp-stat");
  card.append(elem("small","",label),elem("strong","",value));return card;
 }
 function addNote(parent,text,cls="hint"){
  parent.append(elem("p",cls,text));
 }
 function renderSummary(p){
  summary.replaceChildren();summary.classList.remove("hidden");
  const heading=elem("div","lab-kp-headline");
  heading.append(elem("h3","",p.mode==="focused"?
   "Focused target-building rotation · T"+p.targetTier:"Balanced · toward one T64"),
   elem("p","",p.roundsCompleted+" refill waves · started from imported board · "+
    "starting T"+p.startCookTier+" · "+p.cooks+" cooks · "+p.merges+" merges · "+p.moves+" Sushi moves · "+
    p.windEvents+" Wind upgrades"));
  summary.append(heading);
  const grid=elem("div","lab-kp-stats");
  for(const [label,value] of [
   ["EXP / preview",compact(p.totalExpPerCycle)],
   ["Hybrid EXP / hr",rate(p.hybridPreviewExpPerHour)],
   ["Preview duration",formatHours(p.cycleSeconds/3600)],
   ["Fuel / preview",compact(p.fuelPerCycle)],
   ["Modeled Fuel / hr",compact(p.estimatedFuelGeneration)],
   ["Passive EXP / day",compact(p.passive.averageTotalPerDay)],
   ["Highest tier produced","T"+p.highestNewTier],
   ["Survivor parking",p.packingMode==="ascending"?"Staircase low → high":
     p.packingMode==="descending"?"Staircase high → low":"Simple parking"],
   ["Refill waves",p.roundsCompleted+" / "+p.roundsRequested]
  ])grid.append(metric(label,value));
  summary.append(grid);
  if(p.mode==="focused"){
   const focus=p.perTier.find(x=>x.tier===p.targetTier);
   if(focus){
    const box=elem("div","lab-kp-focus-summary");
    box.append(elem("strong","","T"+focus.tier+" · "+focus.name),
     elem("span","","Active "+rate(focus.activeExpPerHour)+" EXP/hr + "+
      "Passive "+compact(focus.passiveExpPerDay)+" EXP/day = "+
      rate(focus.expPerHour)+" hybrid EXP/hr · "+
      "Next level: "+formatHours(focus.etaHours)+
      " · "+p.focusCopies+" copies on board"));
    summary.append(box);
   }
  }
  if(p.pinkMultiplier!==null){
   addNote(summary,"Lithium Firelighter: "+compact(p.pinkMultiplier)+
    "× Knowledge EXP generated in pink columns, including Cold and Milktoast passive sources. "+
    p.proposedFires.filter(x=>x===3).length+" of "+
    p.proposedFires.filter(x=>x>=0).length+" available fireplaces set to pink.",
    "lab-kp-lithium");
  }
  addNote(summary,p.note);
  addNote(summary,"Final board: "+p.stranded+" Sushi · highest working tier T"+p.highestWorkingTier+
   (p.mode==="focused"?" · T"+p.targetTier+" copies: "+p.focusCopies:"")+
   ". "+p.haltReason,"lab-kp-note");
  if(p.rotationTerminal)addNote(summary,
   "Balanced objective reached: one T64 remains and the board is ready to refill.",
   "lab-kp-lithium");
  else addNote(summary,
   "This is a continuing rotation preview. Leftover Sushi stay on the board for the next refill. EXP/hr is a projection over this finite window, not a verified long-term rate.",
   "lab-kp-warning");
 }
 function renderPassive(p){
  const model=p.passive;
  passiveBox.replaceChildren();
  passiveBox.classList.remove("hidden");
  const block=elem("div","lab-kp-passive-panel");
  block.append(elem("h3","","Passive Knowledge setup"),
   elem("p","hint","Current EXP/day comes from the imported Sushi on Cold and Milktoast Plates. "+
    "The suggested plate layout below reuses ONLY Sushi and plates already on your board. "+
    "It is a manual setup guide, not a replay step."));
  const cards=elem("div","lab-kp-passive-stats");
  for(const [label,value] of [
   ["Current passive coverage",model.current.covered+" / 64 tiers"],
   ["Suggested passive coverage",model.recommended.covered+" / 64 tiers"],
   ["Current passive EXP/day",compact(model.current.totalDaily)],
   ["Suggested passive EXP/day",compact(model.recommended.totalDaily)]
  ])cards.append(metric(label,value));
  if(p.mode==="focused"){
   cards.append(metric("T"+p.targetTier+" · current passive/day",
    compact(model.current.expPerDay[p.targetTier])),
   metric("T"+p.targetTier+" · suggested passive/day",
    compact(model.recommended.expPerDay[p.targetTier])));
  }
  block.append(cards);
  const occupancy=elem("div","lab-kp-passive-assignments");
  const formatAssignments=(indices)=>indices.length?
   indices.map(i=>"T"+p.startingBoard[i]+
    " (R"+(Math.floor(i/15)+1)+"C"+(i%15+1)+")").join(" · "):
   "No occupied sources available";
  occupancy.append(
   elem("p","","Cold Plates: "+formatAssignments(model.coldPositions)),
   elem("p","","Milktoast Plates: "+formatAssignments(model.milktoastPositions)));
  block.append(occupancy);
  if(model.needAnotherT64)addNote(block,
   "A single T64 on Cold covers T1–T63, but T64 itself still needs Milktoast. "+
   "A second T64 is required to cover all 64 tiers this way. No extra T64 has been assumed.",
   "lab-kp-warning");
  if(!model.allTargetsCorrect)addNote(block,
   "Some suggested plate positions could not be assigned by pairwise swaps. "+
   "Treat the preview as a partial setup, not a confirmed arrangement.",
   "lab-kp-warning");
  if(p.mode==="focused"&&!p.startingBoard.includes(p.targetTier))addNote(block,
   "T"+p.targetTier+" is discovered but not currently on the board. "+
   "The Focused rotation must create a copy before it can be parked on a Milktoast Plate.",
   "lab-kp-note");
  const boardTitle=elem("div","lab-kp-passive-board-heading");
  boardTitle.append(elem("strong","","Suggested plate positions · after manual setup"),
   elem("span","",model.plateSwaps.length+" plate swaps suggested"));
  block.append(boardTitle);
  const grid=elem("div","lab-kp-passive-board");
  const slots=model.recommendedSlots;
  for(let i=0;i<120;i++){
   const type=slots[i]??-1,tier=p.startingBoard[i]??0;
   const tile=elem("div","lab-kp-passive-tile slot-"+type);
   if(type<0)tile.classList.add("locked");
   if(type!==p.layout.slots[i])tile.classList.add("changed");
   tile.title="R"+(Math.floor(i/15)+1)+"C"+(i%15+1)+
    " · "+(tier?"T"+tier:"Empty")+" · "+
    (type===2?"Cold":type===3?"Milktoast":type===1?"Hot":
     type===0?"Regular":"Locked")+
    (type!==p.layout.slots[i]?" · plate position suggested":"");
   if(tier){
    const icon=elem("img");
    icon.src=sushiTierIconPath(tier);icon.alt="";icon.loading="lazy";
    icon.onerror=()=>icon.remove();
    tile.append(icon,elem("strong","",String(tier)));
   }
   grid.append(tile);
  }
  const wrap=elem("div","lab-kp-passive-board-wrap");
  wrap.append(grid);block.append(wrap);
  addNote(block,"Use Movement Mittens to rearrange plates before following this "+
   "suggested setup. The active walkthrough below still starts from your "+
   "IMPORTED plate/Sushi layout and does not assume these plate changes "+
   "have happened. Estimated EXP/day excludes unknown modifiers.");
  passiveBox.append(block);
 }
 function showProgress(p){
  const rows=$("knowledgePlanLevelRows");
  rows.replaceChildren();
  let ordered=p.perTier.slice().sort((a,b)=>
   p.mode==="focused"&&a.tier===p.targetTier?-1:
   p.mode==="focused"&&b.tier===p.targetTier?1:
   (b.expPerHour??-1)-(a.expPerHour??-1)||a.tier-b.tier);
  for(const entry of ordered){
   const tr=elem("tr");
   const name=elem("td","lab-kp-tier");
   const img=elem("img");
   img.src=sushiTierIconPath(entry.tier);img.alt="";img.loading="lazy";
   img.onerror=()=>img.remove();
   name.append(img,elem("span","","T"+entry.tier+" · "+entry.name));
   tr.append(name,elem("td","",compact(entry.expPerCycle)),
    elem("td","",compact(entry.passiveExpPerDay)),
    elem("td","",rate(entry.expPerHour)),
    elem("td","",formatHours(entry.etaHours)));
   rows.append(tr);
  }
 }
 function renderFrame(index){
  if(!result)return;
  const frame=result.steps[index];if(!frame)return;
  const slots=result.layout.slots;
  const passiveProtected=new Set(frame.protectedIndices??result.protectedIndices??[]);
  const changed=new Set((frame.events??[]).map(e=>e.at));
  if(frame.src!==undefined)changed.add(frame.src);
  if(frame.dst!==undefined)changed.add(frame.dst);
  board.replaceChildren();
  board.setAttribute("aria-label","Sushi Knowledge board, step "+index+
   " of "+(result.steps.length-1));
  for(let i=0;i<120;i++){
   const slot=slots[i]??-1,tier=frame.board[i]??0;
   const box=elem("div","lab-kp-tile slot-"+slot);
   box.title="Row "+(Math.floor(i/15)+1)+", column "+(i%15+1)+
    " · "+(slot<0?"Locked":tier?"T"+tier:"Empty");
   if(slot<0)box.classList.add("locked");
   if(tier===64)box.classList.add("is-protected");
   if(tier&&passiveProtected.has(i))box.classList.add("is-passive-protected");
   if(changed.has(i))box.classList.add("is-affected");
   if(tier>0){
    const img=elem("img","lab-kp-tile-icon");
    img.src=sushiTierIconPath(tier);img.alt="";img.loading="lazy";
    img.onerror=()=>img.remove();
    box.append(img,elem("strong","",String(tier)));
   }
   board.append(box);
  }
  // Fireplace columns appear below the 8×15 Sushi grid.
  const fireRow=elem("div","lab-kp-fire-row");
  for(let c=0;c<15;c++){
   const type=result.proposedFires[c]??-1;
   const fire=elem("span","lab-kp-fire fire-"+type);
   fire.title="Column "+(c+1)+" · "+(type===3?"Lithium pink (2× Knowledge EXP)":
    type===0?"Orange · Fuel production":type>=0?FIREPLACE_NAMES[type]+" fireplace":"Locked");
   if(type>=0&&FIREPLACE_IMAGES[type]){
    const img=elem("img","lab-kp-fire-art");
    img.src="assets/campfires/"+encodeURIComponent(FIREPLACE_IMAGES[type]);
    img.alt=FIREPLACE_NAMES[type]+" fireplace";
    img.loading="lazy";
    img.onerror=()=>{img.remove();fire.textContent="♨";};
    fire.append(img);
   }
   fireRow.append(fire);
  }
  board.append(fireRow);
  $("knowledgePlanStepTitle").textContent="Step "+index+" · "+frame.title;
  $("knowledgePlanStepDetail").textContent=frame.detail;
  $("knowledgePlanStepCount").textContent=index+" / "+(result.steps.length-1);
  $("knowledgePlanStepXp").textContent="EXP in step: "+compact(frame.exp);
  const earned=result.steps.slice(0,index+1).reduce((s,x)=>s+x.exp,0);
  $("knowledgePlanFrameXp").textContent="Preview EXP so far: "+compact(earned);
  $("knowledgePlanPrev").disabled=index===0;
  $("knowledgePlanNext").disabled=index===result.steps.length-1;
 }
 function createReplay(p){
  controller?.dispose();
  result=p;replay.classList.remove("hidden");
  controller=createReplayController({
   totalSteps:p.steps.length-1,
   onStep:renderFrame,
   onPlayStateChange:playing=>{
    $("knowledgePlanPlay").textContent=playing?"Pause":"Play";
   },
   getDelay:()=>Number(speed.value)
  });
  const initial=Math.min(p.preparedStep??0,p.steps.length-1);
  if(initial>0)controller.goTo(initial);
  else renderFrame(0);
 }
 function renderNotes(){
  tips.replaceChildren();
  const bullets=[
   "The optimizer uses the Combo Meter legal merge engine, including up to 25 East Wind upgrades when unlocked. Each verified creation event awards EXP to the created Sushi tier.",
   "Lithium Firelighter is 2× Knowledge EXP for Sushi above pink fireplaces; the solver also models reduced Fuel regeneration when orange fireplaces are changed to pink.",
   "The first frame is the imported Sushi board. Survivors are carried forward between refills.",
   "Balanced merges and parks survivors near the top, refills empty cells, and builds toward one T64. T64 + T64 yields one T64.",
   "Focused accumulates target-tier copies while creating more. When the board fills, matching targets may merge to free space.",
   "Moving Sushi into a vacant slot is a separate action. Movement Mittens toggles dragging to plates; disable it for Sushi repositioning.",
   "Projected EXP/hr divides simulated creation EXP by estimated time and fuel regeneration. Milktoast and Cold passive EXP are not included.",
   "The optimizer compares bounded candidate patterns; it does not prove a global optimum or a sustained EXP/hr rate."
  ];
  for(const note of bullets)tips.append(elem("li","",note));
 }
 const clearAndPrompt=()=>{
  release();updateTargets();
  build.disabled=!getSave();
  status.textContent=getSave()?
   "Choose Balanced or Focused and simulate continuous refills. Timing and Fuel are estimated unless calibrated.":
   "Import a Sushi Station save in Overview before optimizing.";
  renderNotes();
 };
 mode.addEventListener("change",()=>{
  state.mode=mode.value;persist();clearAndPrompt();
 });
 passiveToggle.addEventListener("change",()=>{
  state.preservePassive=passiveToggle.checked;persist();clearAndPrompt();
 });
 target.addEventListener("change",()=>{
  state.targetTier=Number(target.value);persist();release();
 });
 build.addEventListener("click",()=>{
  release();
  const save=getSave();
  if(!save)return;
  build.disabled=true;cancelButton.classList.remove("hidden");
  status.textContent="Simulating multi-refill Sushi rotations, East Wind merges and Lithium/Fuel trade-offs…";
  try{
   const search=new Worker(new URL("./knowledge-cycle-worker.mjs?v=1.0.5",
    import.meta.url),{type:"module"});
   worker=search;
   search.onmessage=event=>{
    if(worker!==search)return; // A new search replaced this one.
    stopSearch();
    const msg=event.data;
    if(!msg?.ok){
     status.textContent="Unable to complete this cycle: "+(msg?.error??"Unknown search error");
     return;
    }
    const plan=msg.result;
    if(!plan.available){status.textContent=plan.reason;return;}
    renderSummary(plan);renderPassive(plan);showProgress(plan);createReplay(plan);
    status.textContent="Compared "+compact(plan.considered)+
     " candidates · "+plan.roundsCompleted+" refill waves · "+
     compact(plan.totalExpPerCycle)+" active EXP · starting T"+plan.startCookTier;
   };
   search.onerror=event=>{
    if(worker!==search)return;
    stopSearch();
    status.textContent="The Knowledge search worker failed. Refresh and retry the optimization.";
   };
   search.postMessage({save,options:calibration()});
  }catch(error){
   stopSearch();
   status.textContent="Knowledge optimizer unavailable in this browser: "+
    (error?.message??String(error));
  }
 });
 cancelButton.addEventListener("click",()=>{
  if(worker){stopSearch();status.textContent="Knowledge optimization canceled.";}
 });
 $("knowledgePlanReset").addEventListener("click",()=>controller?.goTo(0));
 $("knowledgePlanPrepared").addEventListener("click",()=>{
  if(result)controller?.goTo(Math.min(result.preparedStep??0,result.steps.length-1));
 });
 $("knowledgePlanNextRefill").addEventListener("click",()=>{
  if(!result||!controller)return;
  const next=result.steps.findIndex((frame,i)=>i>controller.step&&frame.kind==="refill");
  if(next>=0)controller.goTo(next);
 });
 $("knowledgePlanPrev").addEventListener("click",()=>controller?.goTo(
  Math.max(0,(controller?.step??0)-1)));
 $("knowledgePlanPlay").addEventListener("click",()=>controller?.toggle());
 $("knowledgePlanNext").addEventListener("click",()=>controller?.goTo(
  Math.min((result?.steps.length??1)-1,(controller?.step??0)+1)));
 speed.addEventListener("change",()=>controller?.reschedule());
 clearAndPrompt();
 return {refresh:clearAndPrompt};
}
