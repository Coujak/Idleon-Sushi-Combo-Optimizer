// Browser-only Combo Meter research and preparation report.
import {compareResearchBest,preparationGroups,scoreBreakdown}
 from "./combo-qol.mjs";

const element=(name,className,text)=>{
 const node=document.createElement(name);
 if(className)node.className=className;
 if(text!==undefined)node.textContent=String(text);
 return node;
};
function metric(parent,label,value){
 const item=element("div","combo-report-metric");
 item.append(element("small","",label),element("strong","",value));
 parent.append(item);
}
function appendHeading(root,text){
 const heading=element("h3","combo-report-heading",text);root.append(heading);
 return heading;
}
export function renderComboReport(root,{currentTiles,currentSlots,solution,
 comparison,sections,previousBest}){
 const prep=element("section","combo-preparation-report");
 appendHeading(prep,"Board preparation progress");
 const count=comparison.counts;
 const summary=element("p","hint","A green ✓ means the same sushi tier is already in the same position and plate type as the recommended board. Differences are highlighted on the recommended board. If the recommended plate layout differs, move the plates before copying sushi.");
 prep.append(summary);
 const overview=element("div","combo-report-grid");
 metric(overview,"Already correct",count.correct+" / "+count.required);
 metric(overview,"Wrong sushi tier",count.misplaced);
 metric(overview,"Empty, needs sushi",count.missing);
 metric(overview,"Plate mismatch",count.wrongSlot);
 prep.append(overview);
 const legend=element("p","hint","✓ Correct sushi + slot · ! Incorrect tier · + Empty slot to fill · ↔ Plate layout must change");
 prep.append(legend);
 const before=compareResearchBest(previousBest,solution);
 if(before){
  appendHeading(prep,"Saved best vs. current recommendation");
  const details=element("p","hint",
   "Previous record: "+before.oldScore.toLocaleString()+" pts · Current: "+
   before.newScore.toLocaleString()+" pts · Change: "+
   (before.delta>=0?"+":"")+before.delta.toLocaleString()+" pts · "+
   before.changedPositions.length+" board positions differ. "+
   "Supply/engine split: "+(before.oldSplit===null?"—":before.oldSplit+"/"+(100-before.oldSplit))+
   " → "+(before.newSplit===null?"—":before.newSplit+"/"+(100-before.newSplit))+".");
  prep.append(details);
  if(before.changedPositions.length){
   const changes=element("details","combo-changes");
   changes.append(element("summary","","Show changed positions"));
   changes.append(element("p","hint",before.changedPositions.join(", ")));
   prep.append(changes);
  }
 }
 appendHeading(prep,"Preparation checklist");
 prep.append(element("p","hint","Tick items as you prepare your board. These checkboxes track manual preparation only; they do not change your Idleon save."));
 const checklist=element("div","combo-checklist");
 const groups=preparationGroups(solution.board,solution.slots??currentSlots,sections);
 let currentSection=null;
 for(const group of groups){
  if(group.section!==currentSection){
   checklist.append(element("h4","combo-checklist-section",group.section));
   currentSection=group.section;
  }
  const line=element("label","combo-checklist-item");
  const check=element("input");check.type="checkbox";
  const countReady=group.positions.filter(pos=>comparison.statuses[pos-1]==="correct").length;
  const text=element("span","",
   "T"+group.tier+" ×"+group.count+" · "+countReady+" already correct · positions "+
   group.positions.join(", "));
  check.addEventListener("change",()=>line.classList.toggle("is-checked",check.checked));
  line.append(check,text);checklist.append(line);
 }
 prep.append(checklist);root.append(prep);
 const breakdown=scoreBreakdown(solution.search.moves);
 const scorePanel=element("section","combo-breakdown");
 appendHeading(scorePanel,"Combo score breakdown");
 const metrics=element("div","combo-report-grid");
 metric(metrics,"Manual-merge points",breakdown.mergePoints.toLocaleString());
 metric(metrics,"Wind-upgrade points",breakdown.windPoints.toLocaleString());
 metric(metrics,"Wind upgrades",breakdown.windUpgrades.toLocaleString());
 metric(metrics,"Longest Wind chain",breakdown.peakChain);
 scorePanel.append(metrics);
 scorePanel.append(element("p","hint",
  breakdown.total.toLocaleString()+" simulated points from "+breakdown.manualMerges+
  " merges and "+breakdown.repositionCount+" relocations. "+
  "The point totals are calculated from the replay events, not estimated independently."));
 if(breakdown.chains.length){
  const details=element("details","combo-chains");
  details.append(element("summary","","Top five scoring Wind chains"));
  const list=element("ol");
  for(const item of breakdown.chains.slice(0,5)){
   list.append(element("li","","Merge #"+item.step+" · "+item.windPoints.toLocaleString()+
    " Wind points · "+item.upgrades+" upgrades"));
  }
  details.append(list);scorePanel.append(details);
 }
 root.append(scorePanel);
}
export function decoratePreparedCell(cell,status){
 if(status==="correct"){
  cell.classList.add("combo-cell-correct");
  const tick=element("span","combo-cell-status combo-status-correct","✓");
  tick.setAttribute("aria-label","Sushi and plate already correct");
  cell.append(tick);
 }else if(status==="misplaced"){
  cell.classList.add("combo-cell-misplaced");
  cell.append(element("span","combo-cell-status combo-status-wrong","!"));
 }else if(status==="missing"){
  cell.classList.add("combo-cell-missing");
  cell.append(element("span","combo-cell-status combo-status-missing","+"));
 }else if(status==="wrongSlot"){
  cell.classList.add("combo-cell-wrong-slot");
  cell.append(element("span","combo-cell-status combo-status-slot","↔"));
 }
}
