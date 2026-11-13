// Sushi Knowledge EXP rotation UI. The imported account is never edited.
import {getKnowledgeRows,numberText} from "./lab-model.mjs?v=1.19.13";
import {sushiTierIconPath} from "./sushi-reference.mjs?v=1.16.6";
import {buildKnowledgeRotation,positionLabel,normalizeKnowledgeRotationOptions}
 from "./knowledge-rotation.mjs?v=1.0.0";

const $=id=>document.getElementById(id);
const make=(tag,cls="",value)=>{
 const node=document.createElement(tag);
 if(cls)node.className=cls;
 if(value!==undefined&&value!==null)node.textContent=String(value);
 return node;
};
const fmt=n=>Number.isFinite(n)?numberText(n):"Unavailable";
const PREF_KEY="idleon-sushi-exp-rotation-v1";
const maxPreview=5;
const readable=targets=>targets.map(x=>"T"+x.tier).join(", ");
const columnNames=arr=>arr.map(x=>"C"+(x+1)).join(", ");

export function initializeKnowledgeLevelingUI(getSave){
 const modeSelect=$("knowledgePlanMode");
 const targetLabel=$("knowledgePlanTargetLabel");
 const targetSelect=$("knowledgePlanTarget");
 const status=$("knowledgePlanStatus");
 const feature=$("knowledgePlanFeatured");
 const rotation=$("knowledgePlanRotation");
 const more=$("knowledgePlanMore");
 const tips=$("knowledgePlanTips");
 let state=normalizeKnowledgeRotationOptions();
 let showAll=false;
 try{
  state=normalizeKnowledgeRotationOptions(JSON.parse(
   window.localStorage.getItem(PREF_KEY)||"null"));
 }catch{/* Local storage can be disabled; preferences then remain session-only. */}
 modeSelect.value=state.mode;
 function persist(){
  try{window.localStorage.setItem(PREF_KEY,JSON.stringify(state));}
  catch{/* Private browsing may block storage, but never blocks the planner. */}
 }
 function tierIdentity(row){
  const container=make("div","lab-kp-identity");
  const icon=make("span","lab-kp-art");
  const img=make("img");
  img.src=sushiTierIconPath(row.tier);img.alt="";img.loading="lazy";
  img.onerror=()=>img.remove();
  icon.append(img);
  const details=make("span","lab-kp-name");
  details.append(make("strong","","T"+row.tier+" · "+row.name));
  if(row.levelKnown&&Number.isFinite(row.level)){
   details.append(make("small","","Knowledge Lv "+fmt(row.level)+
    (row.readyToLevel?" · Ready to level":"")));
  }else details.append(make("small","","Level not available in imported save"));
  container.append(icon,details);
  return container;
 }
 function appendBullet(list,text){
  list.append(make("li","",text));
 }
 function renderTips(plan){
  tips.replaceChildren();
  if(!plan)return;
  appendBullet(tips,"Seared Knowledge gives EXP when Sushi is created. Creating two T(n−1) and merging into Tn is one method; direct cooking is useful only when the selected tier is actually affordable.");
  appendBullet(tips,"Milktoast grants passive EXP to its occupied Sushi. Movement Mittens rearrange plates, not the Sushi themselves. Never assume a tier can be placed in a slot without preparing it.");
  appendBullet(tips,"Cold plates give daily EXP to every Sushi tier strictly below the tier on that Cold plate. The highest owned tier is a good broad support target, but this passive benefit is not evenly distributed.");
  appendBullet(tips,"Pink Lithium fireplaces amplify Knowledge EXP for Sushi above them. When unlocked, prioritize the actual column where you are creating or holding the target Sushi.");
  appendBullet(tips,"Balanced gives each discovered tier a recurring turn, not mathematically equal EXP amounts. Focused repeats one selected target. No exact EXP, cooking costs, or timestamps are assumed.");
  if(!plan.hasMittens)appendBullet(tips,"Movement Mittens are not unlocked: keep the current plate layout, and cook or merge Sushi onto the plates that already exist.");
 }
 function updateTargetSelect(rows){
  const previous=state.targetTier;
  targetSelect.replaceChildren();
  for(const k of rows)targetSelect.append(new Option("T"+k.tier+" · "+k.name,String(k.tier)));
  const valid=rows.some(x=>x.tier===previous);
  state.targetTier=valid?previous:rows[0]?.tier??null;
  targetSelect.value=state.targetTier===null?"":String(state.targetTier);
 }
 function contextStat(label,value){
  const card=make("div","lab-kp-stat");
  card.append(make("small","",label),make("strong","",value));
  return card;
 }
 function showSummary(plan){
  feature.replaceChildren();
  const group=make("div","lab-kp-headline");
  const name=plan.mode==="focused"?"Focused EXP rotation":"Balanced EXP rotation";
  group.append(make("h3","",name),
   make("p","",plan.mode==="focused"?
    "Repeat the preparation → creation → passive support loop for one chosen Sushi. Concentrate active creation and EXP-boosting plates on that tier.":
    "Complete each wave, then repeat the full cycle. Every discovered tier receives one assigned creation/plate turn per cycle; this is equal opportunity, not a claim of equal EXP per hour."));
  feature.append(group);
  const stats=make("div","lab-kp-stats");
  stats.append(contextStat("Discovered tiers",String(plan.available.length)),
   contextStat("Milktoast plates",String(plan.counts.milktoast)),
   contextStat("Cold plates",String(plan.counts.cold)),
   contextStat("Creation EXP",plan.hasSeared?"Unlocked":"Locked"));
  feature.append(stats);
  if(!plan.hasSeared){
   feature.append(make("p","lab-kp-warning",
    "Seared Knowledge is not unlocked in this save. Creating Sushi does not yet grant its Knowledge EXP; use any passive EXP sources you own or unlock Seared Knowledge first."));
  }
  if(plan.counts.milktoast===0&&plan.counts.cold===0){
   feature.append(make("p","lab-kp-note",
    "No Milktoast or Cold plates detected. This rotation is an active Sushi-creation plan, with no passive plate EXP assumed."));
  }
 }
 function targetCard(target,assignment,hasMittens){
  const line=make("div","lab-kp-target");
  const left=tierIdentity(target);
  const note=make("div","lab-kp-target-detail");
  if(target.occupiedPositions.length){
   note.append(make("span","","Existing Sushi: "+target.occupiedPositions
    .slice(0,3).map(positionLabel).join(", ")+
    (target.occupiedPositions.length>3?" +"+(target.occupiedPositions.length-3)+" more":"")));
  }else note.append(make("span","lab-kp-needs-prep",
   "Not currently on board · create/merge this tier"));
  if(assignment&&assignment.platePosition!==null){
   const plate=positionLabel(assignment.platePosition);
   note.append(make("span","",assignment.alreadyOnPlate?
    "Milktoast "+plate+" · already matched":
    hasMittens&&target.occupiedPositions.length?
     "Milktoast "+plate+" · move the plate under an existing copy if possible":
     "Milktoast "+plate+" · prepare this tier there before farming"));
  }
  if(target.readyToLevel)note.append(make("span","lab-kp-ready","EXP threshold reached"));
  else if(Number.isFinite(target.xpRemaining)){
   note.append(make("span","","Next level: "+fmt(target.xpRemaining)+" EXP remaining"));
  }
  line.append(left,note);
  return line;
 }
 function stageInstructions(plan,phase){
  const list=make("ol","lab-kp-steps");
  const targets=phase.targets,focus=targets[0];
  const milk=plan.positions.milktoast.length;
  if(plan.mode==="balanced"){
   appendBullet(list,milk?
    "Prepare "+readable(targets)+" on the assigned Milktoast plates shown above. If Movement Mittens are unlocked, you may rearrange plates beneath Sushi already on the board; otherwise prepare Sushi on their current plate positions.":
    "Create each listed Sushi tier in turn. Without Milktoast plates, this is an active cooking/merging rotation.");
   appendBullet(list,plan.hasSeared?
    "Give each target a comparable creation turn; move to the next wave rather than farming just one tier indefinitely.":
    "Creation EXP requires Seared Knowledge. Until unlocked, this wave can only benefit from available passive EXP sources.");
   if(plan.hasLithium&&phase.columns.length){
    appendBullet(list,"When possible, set Lithium fireplaces to pink beneath "+
     columnNames(phase.columns)+" to boost EXP in those columns.");
   }else if(plan.hasLithium)appendBullet(list,
    "Set the fireplace to pink under the column where each target is being created or held, if that column has an unlocked fireplace.");
   if(plan.counts.cold&&plan.suggestedColdTier)
    appendBullet(list,"Keep a high-tier Sushi (currently up to T"+
     plan.suggestedColdTier+") on a Cold plate where possible. Cold EXP helps lower tiers, not that Sushi itself.");
  }else if(phase.index===1){
   appendBullet(list,"Protect any highest-tier Sushi already on your board. Find an existing T"+
    focus.tier+" or prepare a legal path to create it; a new Sushi cannot appear in an occupied slot by swapping tiers.");
   if(milk)appendBullet(list,"Prepare up to "+milk+" Milktoast plates for T"+focus.tier+
    " copies you can actually produce. Move plates only if Movement Mittens are unlocked; you cannot directly drag Sushi.");
   else appendBullet(list,"No Milktoast plates are unlocked. Allocate a reusable unlocked area for creating T"+focus.tier+".");
  }else if(phase.index===2){
   appendBullet(list,plan.hasSeared?"Repeatedly create T"+focus.tier+
    ". Cook it directly only if your fuel cap and costs permit; otherwise merge two T"+
    Math.max(1,focus.tier-1)+" into T"+focus.tier+
    " when practical. Recycle the supporting board without destroying protected higher-tier Sushi.":
    "Seared Knowledge is locked. Unlock it before using Sushi creation as the main way to increase T"+focus.tier+" EXP.");
   if(plan.hasWind)appendBullet(list,
    "Heat of the East Wind can create additional Sushi during valid chains. Count only actual creations; no unverified cascade or EXP bonus is included in this plan.");
   if(plan.hasLithium)appendBullet(list,
    "Set the fireplace to pink beneath the actual creation column to improve EXP gained there.");
  }else{
   if(milk)appendBullet(list,"Keep T"+focus.tier+" on as many of your "+milk+
    " Milktoast plates as you can genuinely fill. Check the current placements above before reorganizing.");
   if(plan.counts.cold){
    if(plan.guidance.coldBenefitsFocus)appendBullet(list,
     "Your current Cold-plate Sushi already include a tier above T"+focus.tier+
     ", providing passive EXP to this target.");
    else if(plan.suggestedColdTier>focus.tier)appendBullet(list,
     "Place a Sushi higher than T"+focus.tier+
     " onto a Cold plate if it can be done legally; your highest on-board Sushi is T"+
     plan.suggestedColdTier+".");
    else appendBullet(list,"Cold plates cannot grant EXP to T"+focus.tier+
     " until a higher-tier Sushi is placed on one.");
   }
   if(plan.hasLithium)appendBullet(list,
    "Keep the relevant column fireplaces pink for passive EXP, then return to Stage 2 to create more target Sushi.");
   else appendBullet(list,"Return to Stage 2 and repeat creation for T"+focus.tier+".");
  }
  return list;
 }
 function stageCard(plan,phase){
  const item=make("article","lab-kp-card lab-kp-wave");
  const header=make("div","lab-kp-wave-head");
  const label=plan.mode==="focused"?"Stage ":"Wave ";
  header.append(make("span","lab-kp-wave-index",label+phase.index+" / "+plan.phases.length),
   make("strong","",phase.kind));
  item.append(header);
  const group=make("div","lab-kp-targets");
  // For focused mode, display the target once and summarize the count of Milktoast plates.
  const pairs=phase.targets.map(t=>phase.slotPairs.find(p=>p.tier===t.tier)??null);
  for(let i=0;i<phase.targets.length;i++)group.append(targetCard(phase.targets[i],pairs[i],plan.hasMittens));
  item.append(group,stageInstructions(plan,phase));
  return item;
 }
 function render(){
  const save=getSave();
  feature.replaceChildren();rotation.replaceChildren();
  showAll=showAll&&modeSelect.value==="balanced";
  state.mode=modeSelect.value==="focused"?"focused":"balanced";
  const rows=getKnowledgeRows(save).filter(k=>k.discovered);
  updateTargetSelect(rows);
  targetLabel.classList.toggle("hidden",state.mode!=="focused");
  more.classList.add("hidden");
  if(!save){
   status.textContent="Import your game save in Overview to build an EXP rotation.";
   tips.replaceChildren();return;
  }
  const plan=buildKnowledgeRotation(save,rows,state);
  renderTips(plan);
  if(!plan.available.length){
   status.textContent="No discovered Sushi tiers in this import. Unlock or import Sushi progress before creating a rotation.";
   return;
  }
  showSummary(plan);
  status.textContent=plan.mode==="focused"?
   "Focused · T"+plan.selectedTier+" · "+plan.counts.milktoast+" Milktoast plates · 3 repeatable stages":
   "Balanced · "+plan.available.length+" tiers · "+plan.phases.length+
   " waves per full cycle · "+plan.counts.milktoast+" Milktoast plates";
  const limit=showAll?plan.phases.length:maxPreview;
  for(const phase of plan.phases.slice(0,limit))rotation.append(stageCard(plan,phase));
  if(plan.mode==="balanced"&&plan.phases.length>maxPreview){
   more.classList.remove("hidden");
   more.textContent=showAll?"Show fewer waves":"Show all "+plan.phases.length+" waves";
  }
 }
 modeSelect.addEventListener("change",()=>{
  showAll=false;state.mode=modeSelect.value;persist();render();
 });
 targetSelect.addEventListener("change",()=>{
  state.targetTier=Number(targetSelect.value);persist();render();
 });
 more.addEventListener("click",()=>{showAll=!showAll;render();});
 render();
 return {refresh:render};
}
