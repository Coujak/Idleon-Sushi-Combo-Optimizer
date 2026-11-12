// Perfecto Planner presentation. Only actionable target/protection controls remain.
// The optimizer chooses its own final copy count and prepared arrangement.
import {sushiTierIconPath} from "./sushi-reference.mjs?v=1.16.6";
import {numberText} from "./lab-model.mjs?v=1.16.6";
import {availablePerfectoTargets,getPerfectoPlanner,perfectoKnowledgeMilestones} from "./perfecto-planner.mjs?v=1.27.0";
import {perfectoRecipeStages,perfectoFinalMergeIndex,perfectoRecipeIntegrity} from "./perfecto-recipe-guide.mjs?v=1.23.0";
import {createPerfectoFinalTargetReplay} from "./perfecto-full-replay.mjs?v=1.27.0";
import {createPerfectoRecycledTargetReplay} from "./perfecto-recycled-target.mjs?v=1.28.0";
import {perfectoReplayPreview,perfectoReplayWorkspacePositions} from "./perfecto-replay-view.mjs?v=1.29.0";

const $=id=>document.getElementById(id);
const node=(tag,css="",value)=>{
 const element=document.createElement(tag);
 if(css)element.className=css;
 if(value!==undefined&&value!==null)element.textContent=String(value);
 return element;
};
const display=value=>Number.isFinite(value)?numberText(value):"—";
const percent=value=>{
 if(!Number.isFinite(value))return "—";
 if(value<=0)return "0%";
 const p=value*100;
 return (p>=.01?p.toFixed(2):Number(p.toPrecision(3)).toString())+"%";
};
const numAttempts=value=>Number.isFinite(value)&&value!==null?display(value):"—";
function perfectoPreparationSteps(result){
 const {plan,search,target}=result;
 const proof=search?.certificate;
 const steps=[];
 if(plan.protected){
  steps.push("Keep all "+plan.protected+" existing sushi above T"+target+
   ". The target preparation must not consume them.");
 }
 if(proof){
  steps.push("Keep at least "+proof.workspaceSlots+
   " unlocked cells available while building each target copy. "+
   "Completed target sushi can then be parked outside the working area.");
  steps.push("Cook T"+proof.startingTier+" (each cook costs "+
   display(search.sourceCost)+" Fuel). Producing "+
   proof.finalCopies+" new T"+target+" sushi requires "+proof.cooksExact+
   " cooks and "+proof.mergesExact+" merges; existing target sushi are preserved.");
  if(proof.startingTier<target){
   if(proof.windStages?.length){
    steps.push("This certified recipe uses Heat of the East Wind. Prepare three equal-tier sushi in a contiguous workspace for each Wind stage. Merge left into middle (Wind upgrades the right), then right into middle. Other stages use ordinary two-to-one merges. Repeat for each target copy; no Salt luck is assumed.");
   }else{
    steps.push("Combine equal-tier sushi using regular two-to-one merges, working up from T"+
     proof.startingTier+" to T"+target+
     ". Repeat for each copy. This recipe does not rely on Wind or Salt luck.");
   }
  }
  if(proof.supportingCount){
   if(proof.supportingMode==="cascade"){
    const wind=proof.supportingCascade;
    steps.push("Long Heat of the East Wind cascade: prepare "+
     wind.ingredientTiers.length+" arranged sushi, merge two T"+
     wind.triggerTier+" triggers and upgrade "+wind.windChainLength+
     " descending sushi in one activation. Shift the upgraded chain west "+
     "and cook the final T"+wind.finalCookTier+
     ". Estimated supporting Fuel savings: "+display(wind.fuelSavingPercent)+
     "% versus separate construction; no Salt Shakers are assumed.");
   }else if(proof.supportingMode==="direct-source"){
    steps.push("Once all target copies are complete, you can directly cook T"+
     proof.startingTier+" into the "+proof.supportingCount+
     " leftover cells. These are optional filler, not ingredients required for Perfecto.");
   }else{
    steps.push("After building the targets, use the released workspace to make "+
     proof.supportingCount+" supporting sushi, highest tier first (T"+
     proof.supportingHighest+" down to T"+proof.supportingLowest+
     "). These do not improve your immediate Pepper odds.");
   }
  }
 }else if(search?.reason==="direct-cooking"){
  steps.push("Cook T1 directly in the available unlocked spaces. No merges are necessary.");
 }else{
  steps.push("Prepare the non-protected sushi shown in the final board. "+
   "This is a simulated candidate using valid merge/Wind actions, "+
   "but an exact step-by-step construction sequence is not available.");
 }
 steps.push("Arrange the final sushi to match the board above. Put the "+
  "highest tiers on available Hot, Cold or Milktoast plates where possible.");
 steps.push("Once the target copies are ready, activate Pepper one use at a time. "+
  "Stop as soon as T"+target+" becomes Perfecto.");
 return steps;
}
export function initializePerfectoUI(getSave){
 let plannerTab="combo",tierChoice="auto";
 let accountPlan=null,benchmarkPlan=null,hoveredPosition=null,pinnedPosition=null;
 const benchmarkToggle=$("perfectoShowBenchmark");
 const comparisonStatus=$("perfectoComparePosition");
 const comparisonWrap=document.querySelector(".perfecto-board-comparison");
 const infoTrigger=$("perfectoMilestoneInfo");
 const infoBox=infoTrigger.closest(".perfecto-milestone-info");
 const closeMilestoneInfo=()=>{
  infoBox.classList.remove("is-open");
  infoTrigger.setAttribute("aria-expanded","false");
 };
 infoTrigger.addEventListener("click",()=>{
  const opened=infoBox.classList.toggle("is-open");
  infoTrigger.setAttribute("aria-expanded",String(opened));
 });
 document.addEventListener("pointerdown",event=>{
  if(!infoBox.contains(event.target))closeMilestoneInfo();
 });
 document.addEventListener("keydown",event=>{
  if(event.key==="Escape")closeMilestoneInfo();
 });
 const targetSelect=$("perfectoTarget");
 const cookTierInput=$("perfectoCookTier");
 const summary=$("perfectoTargetSummary");
 function setPlannerTab(target){
  plannerTab=target==="perfecto"?"perfecto":"combo";
  $("solver").classList.toggle("hidden",plannerTab!=="combo");
  $("perfectoPlanner").classList.toggle("hidden",plannerTab!=="perfecto");
  $("perfectoPlanner").setAttribute("aria-hidden",String(plannerTab!=="perfecto"));
  for(const choice of document.querySelectorAll("[data-planner-target]")){
   const selected=choice.dataset.plannerTarget===plannerTab;
   choice.setAttribute("aria-selected",String(selected));
   choice.tabIndex=selected?0:-1;
  }
  if(plannerTab==="perfecto")render();
 }
 for(const button of document.querySelectorAll("[data-planner-target]")){
  button.addEventListener("click",()=>setPlannerTab(button.dataset.plannerTarget));
  button.addEventListener("keydown",event=>{
   if(event.key!=="ArrowLeft"&&event.key!=="ArrowRight")return;
   event.preventDefault();
   const target=plannerTab==="combo"?"perfecto":"combo";
   document.querySelector('[data-planner-target="'+target+'"]').focus();
   setPlannerTab(target);
  });
 }
 targetSelect.addEventListener("change",()=>{tierChoice=targetSelect.value;render();});
 cookTierInput?.addEventListener("change",render);
 $("perfectoResetTarget").addEventListener("click",()=>{tierChoice="auto";render();});
 function text(id,value){$(id).textContent=value;}
 function sushiIcon(tier,css){
  const img=node("img",css);
  img.src=sushiTierIconPath(tier);
  img.alt="";img.loading="lazy";img.onerror=()=>img.remove();
  return img;
 }
 function renderBoard(result,plan=result.plan,hostId="perfectoBoard"){
  const box=$(hostId);
  box.replaceChildren();
  if(!plan){
   box.append(node("p","hint","Import an account save to see a recommended board."));
   return;
  }
  for(const cell of plan.board){
   const div=node("div","perfecto-tile perfecto-"+cell.role);
   div.dataset.position=String(cell.index);
   div.dataset.tier=String(cell.preparedTier>=0?cell.preparedTier+1:0);
   if(cell.slot>=0)div.classList.add("slot-"+cell.slot);
   else div.classList.add("locked");
   if(cell.preparedTier!==null&&cell.preparedTier>=0){
    const tier=cell.preparedTier+1;
    div.append(sushiIcon(tier,"perfecto-tile-icon"),
     node("span","perfecto-tile-tier","T"+tier));
   }else if(cell.slot>=0)div.append(node("span","perfecto-tile-empty","·"));
   const before=cell.tile>=0?"T"+(cell.tile+1):"Empty";
   const after=cell.preparedTier>=0?"T"+(cell.preparedTier+1):"Empty";
   const slotLabel=["Regular","Hot","Cold","Milktoast"][cell.slot]??"Locked";
   div.title="Position "+(cell.index+1)+" · "+slotLabel+" slot · "+
    before+" → "+after+" · "+cell.role;
   if(cell.newCopy)div.classList.add("perfecto-new-copy");
   box.append(div);
  }
 }

 // The same position is highlighted in both *final* boards. Hover temporarily,
 // or click to pin the comparison until clicked again.
 function cellLabel(cell){
  return !cell||cell.slot<0?"Locked":cell.preparedTier>=0?
   "T"+(cell.preparedTier+1):"Empty";
 }
 function highlightComparison(){
  const index=hoveredPosition??pinnedPosition;
  for(const host of [$("perfectoBoard"),$("perfectoMaxBoard")]){
   for(const tile of host.querySelectorAll(".perfecto-tile")){
    tile.classList.toggle("perfecto-tile-matched",
     index!==null&&Number(tile.dataset.position)===index);
   }
  }
  if(index===null){
   comparisonStatus.textContent=benchmarkToggle.checked?
    "Hover or select a board cell to compare its position.":
    "Hover a cell to inspect its position. Enable the benchmark to compare.";
   return;
  }
  const shownTier=hostId=>{
   const tile=$(hostId).querySelector('.perfecto-tile[data-position="'+index+'"]');
   const value=Number(tile?.dataset.tier);
   if(!tile)return null;
   if(tile.classList.contains("locked"))return "Locked";
   return value>0?"T"+value:"Empty";
  };
  const current=shownTier("perfectoBoard")??cellLabel(accountPlan?.board?.[index]);
  const benchmark=shownTier("perfectoMaxBoard")??cellLabel(benchmarkPlan?.board?.[index]);
  comparisonStatus.textContent="Position "+(index+1)+" · Account: "+current+
   (benchmarkToggle.checked?" · T46: "+benchmark:"")+
   (pinnedPosition===index?" · Selected":"");
 }
 function setComparisonVisibility(){
  const visible=benchmarkToggle.checked;
  comparisonWrap.classList.toggle("is-benchmark-hidden",!visible);
  $("perfectoScenarioDifference").classList.toggle("hidden",!visible);
  highlightComparison();
 }
 benchmarkToggle.addEventListener("change",setComparisonVisibility);
 for(const id of ["perfectoBoard","perfectoMaxBoard"]){
  const board=$(id);
  board.tabIndex=0;
  board.setAttribute("aria-describedby","perfectoComparePosition");
  const getPosition=event=>{
   const tile=event.target.closest?.(".perfecto-tile");
   return tile&&board.contains(tile)?Number(tile.dataset.position):null;
  };
  board.addEventListener("mouseover",event=>{
   const position=getPosition(event);
   if(position===null)return;
   if(hoveredPosition!==position){hoveredPosition=position;highlightComparison();}
  });
  board.addEventListener("mouseleave",()=>{
   hoveredPosition=null;highlightComparison();
  });
  board.addEventListener("click",event=>{
   const position=getPosition(event);
   if(position===null)return;
   pinnedPosition=pinnedPosition===position?null:position;
   highlightComparison();
  });
  board.addEventListener("keydown",event=>{
   const jumps={ArrowLeft:-1,ArrowRight:1,ArrowUp:-15,ArrowDown:15};
   if(Object.hasOwn(jumps,event.key)){
    event.preventDefault();
    const initial=hoveredPosition??pinnedPosition??0;
    pinnedPosition=Math.max(0,Math.min(119,initial+jumps[event.key]));
    hoveredPosition=null;highlightComparison();
   }else if(event.key==="Escape"){
    pinnedPosition=null;hoveredPosition=null;highlightComparison();
   }
  });
 }
 // Recipe stages are a compact, recursively repeated construction pattern.
 // A full individual-merge replay is not available from the proof certificate.
 function bindRecipeNavigator(prefix){
  const section=$(prefix+"RecipeNavigator");
  const state={stages:[],index:0};
  function show(){
   if(!state.stages.length){section.classList.add("hidden");return;}
   section.classList.remove("hidden");
   const stage=state.stages[state.index];
   text(prefix+"RecipeCount","Stage "+(state.index+1)+" of "+state.stages.length);
   text(prefix+"RecipeStage","T"+stage.from+
    (stage.direct?" · Direct cook":" → T"+stage.to));
   const visual=$(prefix+"RecipeVisual");
   const pieces=Array.from({length:stage.ingredients},()=>node("span",
    "perfecto-recipe-ingredient","T"+stage.from));
   visual.replaceChildren(...pieces,node("span","perfecto-recipe-arrow",
    stage.direct?"Direct cook":"→"),
    node("span","perfecto-recipe-product","T"+stage.to));
   visual.classList.toggle("uses-wind",stage.wind);
   const instructions=stage.direct?
    "Cook T"+stage.from+" directly. No merges are needed for this tier.":
    stage.wind?
    "Prepare three T"+stage.from+" sushi together. Merge left into middle: "+
    "the merge makes T"+(stage.from+1)+" and Wind upgrades the right sushi. "+
    "Then merge the right sushi into the middle to produce T"+stage.to+".":
    "Prepare two T"+stage.from+" sushi. Merge right into left to produce T"+
    stage.to+". Rebuild the ingredients as often as later stages require.";
   text(prefix+"RecipeDescription",instructions);
   $(prefix+"RecipePrev").disabled=state.index===0;
   $(prefix+"RecipeNext").disabled=state.index===state.stages.length-1;
   $(prefix+"RecipeFinal").disabled=
    state.index>=perfectoFinalMergeIndex(state.stages);
   $(prefix+"RecipeStart").disabled=state.index===0;
  }
  $(prefix+"RecipePrev").addEventListener("click",()=>{
   state.index=Math.max(0,state.index-1);show();
  });
  $(prefix+"RecipeNext").addEventListener("click",()=>{
   state.index=Math.min(state.stages.length-1,state.index+1);show();
  });
  $(prefix+"RecipeFinal").addEventListener("click",()=>{
   state.index=perfectoFinalMergeIndex(state.stages);show();
  });
  $(prefix+"RecipeStart").addEventListener("click",()=>{
   state.index=0;show();
  });
  return (search,target)=>{
   const proof=search?.certificate;
   const check=proof?perfectoRecipeIntegrity(proof,search.sourceTier,target):null;
   state.stages=check&&!check.valid?[]:
    perfectoRecipeStages(proof,search?.sourceTier,
     search?.reason==="direct-cooking"?target:null);
   state.index=0;show();
   return check;
  };
 }
 const accountRecipe=bindRecipeNavigator("perfecto");
 const maximumRecipe=bindRecipeNavigator("perfectoMax");
 // This demonstration begins near the *recommended* end board: all other
 // target copies are prepared and one final target plus its workspace is empty.
 function bindBoardReplay(prefix,boardId){
  const state={replay:null,plan:null,result:null,target:null,step:-1};
  const btn=id=>$(prefix+"Replay"+id);
  const workspacePanel=$(prefix+"ReplayWorkspacePanel");
  const workspaceGrid=$(prefix+"ReplayWorkspace");
  function renderWorkspace(replay,frame,event){
   const locations=perfectoReplayWorkspacePositions(replay);
   workspaceGrid.replaceChildren();
   let occupied=0;
   for(let i=0;i<locations.length;i++){
    const pos=locations[i],tier=Number(frame.board[pos]??0);
    const cell=node("div","perfecto-workspace-cell "+(tier?"is-filled":"is-empty"));
    cell.dataset.workspacePosition=String(pos);
    cell.title="Temporary construction slot "+(i+1)+" · "+(tier?"T"+tier:"Empty");
    cell.setAttribute("aria-label",cell.title);
    if(tier){
     occupied++;
     cell.append(sushiIcon(tier,"perfecto-workspace-icon"),
      node("span","perfecto-workspace-tier","T"+tier));
    }else cell.append(node("span","perfecto-workspace-empty","·"));
    cell.append(node("span","perfecto-workspace-number",String(i+1)));
    workspaceGrid.append(cell);
   }
   const mark=(pos,kind)=>{
    if(!Number.isInteger(pos))return;
    workspaceGrid.querySelector('[data-workspace-position="'+pos+'"]')
     ?.classList.add("perfecto-replay-"+kind);
   };
   if(event){
    if(event.kind==="merge"||event.kind==="move"){
     mark(event.src,"from");mark(event.dst,"to");
    }else if(Number.isInteger(event.at))mark(event.at,"to");
    for(const extra of event.events??[]){
     if(extra.kind==="wind")mark(extra.at,"wind");
    }
   }
   workspacePanel.classList.remove("hidden");
   text(prefix+"ReplayWorkspaceProgress",occupied+" / "+locations.length+" occupied");
  }
  function paint(){
   const {replay,plan,result,target,step}=state;
   if(!replay?.available||!plan)return;
   const frame=step>=0?replay.getFrame(step):null;
   const event=frame?.event??null;
   const preview=perfectoReplayPreview(plan,target,replay,step);
   if(step<0){
    renderBoard(result,plan,boardId);
    workspacePanel.classList.add("hidden");
    workspaceGrid.replaceChildren();
   }else{
    // Show just one missing new target on the recommended board.
    // The 38-slot recycled construction exists only below, in its own view.
    renderBoard(result,preview.available?preview.plan:plan,boardId);
    if(preview.available&&!preview.built)
     $(boardId).querySelector(
      '.perfecto-tile[data-position="'+preview.missingPosition+'"]'
     )?.classList.add("perfecto-replay-missing");
    renderWorkspace(replay,frame,event);
   }
   const done=step===replay.totalSteps;
   const isRecycled=replay.mode==="recycling";
   const phrase=step<0?"Final recommended board":step===0?
    "Only final T"+target+" missing":
    done?"Final T"+target+" constructed · Board restored":
    isRecycled?"Refill · Merge · Recycle toward T"+target:
    step<replay.finalFillIndex?"Constructing final T"+target:
    "Finishing supporting sushi";
   text(prefix+"ReplayStatus",phrase);
   if(step<0)text(prefix+"ReplayProgress",
    display(replay.totalSteps)+" construction actions available");
   else{
    const filled=preview.available?preview.filled:plan.board.filter(
     cell=>cell.slot>=0&&cell.preparedTier>=0).length;
    const unlocked=preview.available?preview.unlocked:plan.unlocked;
    text(prefix+"ReplayProgress",display(step)+" / "+display(replay.totalSteps)+
     " · Recommended board "+filled+" / "+unlocked+" filled");
   }
   let action=step<0?"Start the verified Wind-recycling walkthrough for T"+target+".":
    frame.description??"";
   if(event?.kind==="cook")action+=" Cook T"+event.tier+
    " at position "+(event.at+1)+".";
   else if(event?.kind==="prepared")action+=" Use a previously prepared T"+
    event.tier+" at position "+(event.at+1)+".";
   else if(event?.kind==="move")action+=" Move sushi from position "+
    (event.src+1)+" to "+(event.dst+1)+".";
   else if(event?.kind==="merge"){
    action+=" Merge position "+(event.src+1)+" into "+(event.dst+1)+".";
    const winds=event.events?.filter(e=>e.kind==="wind")??[];
    if(winds.length)action+=" Heat of the East Wind upgrades "+
     winds.map(x=>"position "+(x.at+1)+" to T"+x.tier).join(", ")+".";
   }
   text(prefix+"ReplayAction",done?
    (isRecycled?"The final T"+target+" was constructed in the separate Wind workspace. "+
     "The recommended board above now shows all its target copies. "+
     "This workspace is illustrative, not additional game space.":
     "The final T"+target+" and its support construction are complete. "+
     "The recommended board above is restored."):action);
   const cycle=btn("Cycle");
   cycle.classList.toggle("hidden",!isRecycled);
   cycle.disabled=!isRecycled||step<0||done;
   btn("Start").disabled=step===0;
   btn("Prev").disabled=step<=0;
   btn("Next").disabled=step<0||done;
   btn("Final").disabled=step<0||step>=replay.lastMergesIndex;
   btn("Cascade").disabled=step<0||replay.windCascadeIndex===null||
    step>=replay.windCascadeIndex;
   btn("Fill").disabled=step<0||step>=replay.finalFillIndex;
   btn("Done").disabled=step<0;
   highlightComparison();
  }
  btn("Start").addEventListener("click",()=>{state.step=0;paint();});
  btn("Prev").addEventListener("click",()=>{
   state.step=Math.max(0,state.step-1);paint();
  });
  btn("Next").addEventListener("click",()=>{
   state.step=Math.min(state.replay?.totalSteps??0,Math.max(0,state.step)+1);paint();
  });
  btn("Final").addEventListener("click",()=>{
   state.step=state.replay?.lastMergesIndex??0;paint();
  });
  btn("Cycle").addEventListener("click",()=>{
   if(state.replay?.mode!=="recycling")return;
   state.step=state.replay.nextCycle(state.step);paint();
  });
  btn("Cascade").addEventListener("click",()=>{
   const at=state.replay?.windCascadeIndex;
   if(at===null||at===undefined)return;
   state.step=Math.max(0,at-1);paint();
  });
  btn("Fill").addEventListener("click",()=>{
   state.step=state.replay?.mode==="recycling"?
    state.replay.totalSteps:state.replay?.finalFillIndex??0;
   paint();
  });
  btn("Done").addEventListener("click",()=>{state.step=-1;paint();});
  return (saved,result,plan,search,target)=>{
   state.result=result;state.plan=plan;state.target=target;state.step=-1;
   const recycled=createPerfectoRecycledTargetReplay(saved,search,plan,target);
   state.replay=recycled.available?recycled:
    createPerfectoFinalTargetReplay(saved,search,plan,target);
   if(state.replay.available&&!perfectoReplayPreview(plan,target,state.replay,0).available)
    state.replay={available:false,reason:"No newly produced target sushi can be isolated."};
   workspacePanel.classList.add("hidden");
   workspaceGrid.replaceChildren();
   const replay=state.replay,ready=replay.available;
   const recycling=ready&&replay.mode==="recycling";
   btn("Fill").textContent=recycling?"Finish target":"Finish supporting sushi";
   text(prefix+"ReplayStatus",ready?
    (recycling?"Recycled Wind ladder · T"+target:"Final target walkthrough · T"+target):
    "Replay unavailable");
   text(prefix+"ReplayProgress",ready?display(replay.totalSteps)+" steps":"—");
   text(prefix+"ReplayAction",ready?
    (recycling?"Follow the T"+replay.sourceTier+" → T"+target+
     " Wind ladder: refill, merge, reposition, and repeat until the target is made.":
     "Watch how to construct the final T"+target+" from the recommended board."):
    "This example cannot be verified: "+replay.reason);
   const windPlan=search?.certificate?.supportingCascade;
   const notice=ready&&recycling?
    "WIND RECYCLING · Cook T"+replay.sourceTier+" "+display(replay.totalCooks)+
    " times, make "+display(replay.totalMerges)+" merges and "+
    display(replay.totalMoves)+" legal moves. "+
    display(replay.totalWind)+" sushi are upgraded by Wind across the sequence. "+
    "This is a separate teaching board reserving "+replay.requiredSlots+
    " contiguous unlocked cells. The recommended board keeps every other target copy; "+
    "the separate workspace below is NOT extra in-game space. "+
    "You must reserve this area before filling the final board. "+
    "Reposition steps require Movement Mittens. "+
    "No Salt Shakers or higher-tier cooking are assumed.":
    ready?
    (windPlan?"SUPPORT WIND CASCADE · "+windPlan.windChainLength+
     " sushi upgraded in one merge. ":"")+
    "PREPARED STAGING BOARD · "+replay.preparedCopies+
    " other target copies are complete; "+replay.workspacePositions.length+
    " temporary support cells start empty. "+
    "This is an illustrative setup, not the imported board."+
    (replay.partial?" Some T"+replay.sourceTier+
     " ingredients must be prepared before the late merges.":""):
    "No verified construction replay is available: "+replay.reason;
   text(prefix+"ReplayLimit",notice);
   for(const id of ["Start","Prev","Next","Cycle","Final","Cascade","Fill","Done"])
    btn(id).disabled=!ready||id!=="Start";
   return replay;
  };
 }
 const accountBoardReplay=bindBoardReplay("perfecto","perfectoBoard");
 const maximumBoardReplay=bindBoardReplay("perfectoMax","perfectoMaxBoard");
 function renderBonuses(result){
  const host=$("perfectoBonusCards");host.replaceChildren();
  for(const k of result.bonus.rows){
   const item=node("div","perfecto-bonus-item");
   item.append(sushiIcon(k.tier,"perfecto-bonus-icon"));
   const info=node("div","perfecto-bonus-copy");
   info.append(node("strong","","T"+k.tier+" · "+k.name),
    node("span","",k.discovered?
     "Knowledge Lv "+display(k.level)+(k.perfecto?" · Perfecto":" · Not Perfecto"):
     "Not discovered"),
    node("span","perfecto-bonus-value",
     k.discovered?"+"+display(k.bonus)+"% to Perfecto chance":"No active bonus"));
   item.append(info);host.append(item);
  }
  text("perfectoBonusTotal",display(result.bonus.knowledgeMultiplier)+"×");
 }
 function renderKnowledgeTheory(result){
  const host=$("perfectoTheoryMilestones");host.replaceChildren();
  const milestone=perfectoKnowledgeMilestones(result.bonus.rows,result.target,result.plan?.copies??0);
  if(!milestone.available){
   text("perfectoTheoryLevels","Both T50 and T54 are required.");
   text("perfectoTheoryBonus",milestone.reason);
   for(const id of ["perfectoTheoryBefore","perfectoTheoryAfter","perfectoTheoryGain"])text(id,"—");
   return;
  }
  const first=milestone.rows[0];
  const byTier=tier=>milestone.currentLevels.find(x=>x.tier===tier);
  const nextTier=tier=>first.levels.find(x=>x.tier===tier);
  text("perfectoTheoryLevels","T50 Lv "+byTier(50).level+" → "+nextTier(50).level+
   " · T54 Lv "+byTier(54).level+" → "+nextTier(54).level);
  text("perfectoTheoryBonus","Combined Knowledge bonus: +"+display(milestone.currentBonus)+
   "% → +"+display(first.combinedBonus)+"%. Both tiers use their current Perfecto multipliers.");
  text("perfectoTheoryBefore",percent(milestone.currentChance));
  text("perfectoTheoryAfter",percent(first.chance));
  const relative=milestone.currentChance>0?
   100*(first.chance/milestone.currentChance-1):null;
  text("perfectoTheoryGain",relative!==null?
   "+"+display(relative)+"% relative":"—");
  function deltaText(chance){
   const relativeGain=milestone.currentChance>0?
    100*(chance/milestone.currentChance-1):null;
   return relativeGain===null?"—":"+"+display(relativeGain)+"%";
  }
  for(const entry of milestone.rows){
   const tr=node("tr");
   if(entry===first)tr.classList.add("is-next");
   const t50=entry.levels.find(x=>x.tier===50);
   const t54=entry.levels.find(x=>x.tier===54);
   for(const value of ["Lv "+t50.level,"Lv "+t54.level,
    "+"+display(entry.combinedBonus)+"%",percent(entry.chance),
    deltaText(entry.chance)]){
    tr.append(node("td","",value));
   }
   host.append(tr);
  }
 }
 function render(){
  if(plannerTab!=="perfecto")return;
  const saved=getSave();
  const available=availablePerfectoTargets(saved);
  const auto=targetSelect.querySelector('option[value="auto"]');
  const next=available[0]?.tier??null;
  auto.textContent=next?"Auto · next missing tier (T"+next+")":
   "Auto · no missing discovered tiers";
  for(const option of [...targetSelect.options].slice(1))option.remove();
  for(const k of available){
   const option=document.createElement("option");
   option.value=String(k.tier);option.textContent="T"+k.tier+" · "+k.name;
   targetSelect.append(option);
  }
  if(tierChoice!=="auto"&&!available.some(k=>k.tier===Number(tierChoice))){
   tierChoice="auto";
  }
  targetSelect.value=tierChoice;
  const cookTierValue=cookTierInput?.value.trim()??"";
  const parsedCookTier=Number(cookTierValue);
  const cookTier=cookTierValue!==""&&Number.isInteger(parsedCookTier)&&
   parsedCookTier>=1&&parsedCookTier<=46?parsedCookTier:null;
  const result=getPerfectoPlanner(saved,{tier:tierChoice,cookTier});
  text("perfectoHeaderTarget",result.target?"CURRENT TARGET · T"+result.target:
   "No active Perfecto target");
  renderBonuses(result);
  const ready=!!result.target&&!!result.plan;
  $("perfectoCalculator").classList.toggle("hidden",!ready);
  $("perfectoNoData").classList.toggle("hidden",ready);
  if(!ready){
   accountPlan=null;benchmarkPlan=null;hoveredPosition=null;pinnedPosition=null;
   highlightComparison();
   $("perfectoRecipeNavigator").classList.add("hidden");
   $("perfectoReplayControls").classList.add("hidden");
   $("perfectoMaxReplayControls").classList.add("hidden");
   $("perfectoMaxRecipeNavigator").classList.add("hidden");
   text("perfectoNoData",result.reason==="complete"?
    "All discovered sushi are Perfecto. Import an updated save after discovering more.":
    "Import your game save JSON on Overview to plan your Perfecto board.");
   return;
  }
  renderKnowledgeTheory(result);
  $("perfectoReplayControls").classList.remove("hidden");
  $("perfectoMaxReplayControls").classList.remove("hidden");
  const p=result.plan;
  const account=result.comparisons.account;
  const maximum=result.comparisons.maximum;
  accountPlan=p;benchmarkPlan=maximum.plan;
  hoveredPosition=null;pinnedPosition=null;
  const accountCheck=accountRecipe(account.search,result.target);
  maximumRecipe(maximum.search,result.target);
  text("perfectoAccountScenario",p.copies+" target copies · "+percent(account.chance)+" per Pepper");
  text("perfectoMaximumScenario",(maximum.plan?.copies??0)+
   " target copies · "+percent(maximum.chance)+" per Pepper");
  function scenarioFuel(comparison){
   const econ=comparison.economy;
   const source=comparison.search?.sourceTier;
   const optionalFuel=Number(econ?.totalFuel)-Number(econ?.targetFuel);
   return "Cook from "+(source?"T"+source:"unknown tier")+
    " · Target recipe Fuel: "+display(econ?.targetFuel)+
    (Number.isFinite(optionalFuel)&&optionalFuel>0?
     " · Optional filler: "+display(optionalFuel)+" Fuel":"");
  }
  text("perfectoAccountFuel",scenarioFuel(account));
  text("perfectoMaximumFuel",scenarioFuel(maximum));
  text("perfectoScenarioDifference",
   "Benchmark difference: "+result.comparisons.copyDifference+
   " target copies · "+result.comparisons.percentagePointGain.toFixed(4)+
   " percentage points per Pepper. The benchmark assumes T46 direct cooking and is not your current account.");
  text("perfectoAccountBoardTag",
   cookTier!==null?"Confirmed T"+cookTier+" cooking tier":"Estimated from imported JSON");
  text("perfectoMaximumBoardTag","T46 directly cookable · hypothetical");
  const maxP=maximum.plan;
  text("perfectoMaximumSummary",maxP?
   maxP.copies+" target copies · "+maxP.protected+" protected higher-tier sushi · "+
   maxP.unlocked+" unlocked slots":"No constructible benchmark board");
  const maximumGuide=$("perfectoMaxPreparationSteps");
  maximumGuide.replaceChildren(...(maxP?
   perfectoPreparationSteps({...result,plan:maxP,search:maximum.search}):
   ["No benchmark preparation available."]).map(step=>node("li","",step)));
  renderBoard(result,maxP,"perfectoMaxBoard");
  maximumBoardReplay(saved,result,maxP,maximum.search,result.target);
  summary.replaceChildren(sushiIcon(result.target,"perfecto-target-icon"),
   node("span","","T"+result.target+" · "+result.current.name+
    (result.current.perfecto?" · Perfecto":" · Not Perfecto")));
  text("perfectoSingleChance",percent(result.singleChance));
  text("perfectoCurrentChance",percent(result.currentChance));
  text("perfectoCurrentOddsRatio",result.currentChance>0?
   "1 in "+display(1/result.currentChance):"No target copies yet");
  text("perfectoPlanChance",percent(result.planChance));
  text("perfectoPlanOddsRatio",result.planChance>0?
   "1 in "+display(1/result.planChance):"No target copies yet");
  text("perfectoCurrentCopies",p.currentCopies+" on board");
  text("perfectoPlanCopies",p.copies+" copies");
  text("perfectoExpectedActivations",numAttempts(result.expectedActivations));
  const delta=result.improvement;
  text("perfectoImprovement",delta.fromZero?"From no chance to "+percent(result.planChance):
   !delta.improvement?"Already at recommended target-copy odds":
   (delta.ratio??1).toLocaleString("en-US",{maximumFractionDigits:2})+
   "× chance per Pepper use");
  text("perfectoImprovementDetail",delta.fromZero?
   "You currently have no T"+result.target+" sushi on the board. "+
   "Preparing "+p.copies+" copies makes a Pepper attempt possible.":
   !delta.improvement?
   "The recommended board does not improve your per-activation Perfecto odds. "+
   "It may still be useful for arranging your sushi.":
   "Current "+percent(result.currentChance)+" → optimized "+
   percent(result.planChance)+" (+"+
   delta.percentagePointGain.toLocaleString("en-US",{maximumFractionDigits:4})+
   " percentage points). Estimated attempts until success: "+
   numAttempts(delta.currentAttempts)+" → "+
   numAttempts(delta.optimizedAttempts)+".");
  text("perfectoCopyCount",p.copies+" target copies found");
  const proof=result.search?.certificate;
  const bonusSlots=p.board.filter(cell=>cell.slot>=1&&cell.slot<=3);
  const bonusTargets=bonusSlots.filter(cell=>cell.role==="target").length;
  const bonusProtected=bonusSlots.filter(cell=>cell.role==="protected").length;
  text("perfectoPreparationSummary",
   p.copies+" target copies · "+p.additionalCopies+" newly produced in the simulation · "+
   (proof?.supportingCount?proof.supportingCount+" supporting sushi · ":"")+
   p.protected+" protected higher-tier sushi · "+p.unlocked+" unlocked slots"+
   (bonusSlots.length?" · Special plates: "+bonusProtected+
    " protected high-tier, "+bonusTargets+" target sushi":""));
  text("perfectoProtectedCount",p.protected+" higher-tier sushi preserved");
  const list=$("perfectoPreparationSteps");
  list.replaceChildren(...perfectoPreparationSteps(result).map(step=>node("li","",step)));
  text("perfectoModelNote",proof?
   accountCheck&&!accountCheck.valid?
   "Recipe counts did not pass internal consistency checks. Do not rely on this preparation estimate.":
   "Recursive "+(proof.windStages?.length?"Wind-assisted":"merge-only")+
   " construction recipe. The walkthrough demonstrates the last target copy using a "+
   "prepared staging board; it does not replay preparation from your imported save. "+
   "This is not a proven global optimum.":
   result.search?.reason==="direct-cooking"?
   "Direct cooking layout. The slot arrangement can be changed as needed.":
   "Heuristic recipe from "+p.searchAttempts+" evaluated search variants, with "+
   display(p.estimatedManualMerges)+" simulated merges and "+
   display(p.windUpgrades)+" Wind upgrades. This is not an exact move-by-move "+
   "build guide or a proven global maximum.");
  for(const milestone of result.milestones)
   text("perfectoConfidence"+Math.round(milestone.confidence*100),
    numAttempts(milestone.attempts));
  const pepper=result.preparation.pepperAvailable;
  text("perfectoPepperUses",display(pepper));
  text("perfectoKnownFreeChance",(result.freeUse.atCap?"":"≥ ")+
   percent(result.freeUse.knownChance));
  text("perfectoExpectedSpentUpper",numAttempts(result.freeUse.expectedConsumedUpperBound));
  text("perfectoStoredChance",percent(result.pepperStackChance));
  text("perfectoStoredChanceHint",
   pepper===0?"No Pepper available yet.":
   "Estimated chance across up to "+display(pepper)+
   " activation"+(pepper===1?"":"s")+
   " on the optimized board; stop as soon as you succeed.");
  const tip=$("perfectoRecommendation");
  tip.className="perfecto-recommendation perfecto-status-"+result.recommendation.state;
  text("perfectoActionTitle",result.recommendation.title);
  text("perfectoActionText",result.recommendation.text);
  const currentCopies=result.plan?.currentCopies??0;
  const targetCopies=result.plan?.copies??0;
  const state=result.recommendation.state;
  text("perfectoActionProgress",
    state==="completed"?"Perfecto achieved":
    "BOARD PROGRESS · "+display(currentCopies)+" / "+display(targetCopies)+" target copies");
  text("perfectoActionNext",
    state==="ready"?"NEXT: ACTIVATE PEPPER":
    state==="empty"?"NEXT: COLLECT PEPPER":
    state==="completed"?"NEXT: CHOOSE ANOTHER TARGET":
    state==="blocked"?"NEXT: REVIEW AVAILABLE SLOTS":
    "NEXT: BUILD THE OPTIMIZED BOARD");
  renderBoard(result,p,"perfectoBoard");
  accountBoardReplay(saved,result,p,account.search,result.target);
  setComparisonVisibility();
 }
 setPlannerTab("combo");
 return {refresh:render,activateTab:setPlannerTab};
}
