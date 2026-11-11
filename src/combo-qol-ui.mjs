// Browser-only Combo Meter research and preparation report.
import {compareResearchBest,scoreBreakdown}
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
export function renderComboReport(root,{solution,previousBest}){
 const before=compareResearchBest(previousBest,solution);
 if(before){
  const comparison=element("section","combo-best-comparison");
  appendHeading(comparison,"Saved best vs. current recommendation");
  comparison.append(element("p","hint",
   "Previous record: "+before.oldScore.toLocaleString()+" pts · Current: "+
   before.newScore.toLocaleString()+" pts · Change: "+
   (before.delta>=0?"+":"")+before.delta.toLocaleString()+" pts · "+
   before.changedPositions.length+" board positions differ. "+
   "Supply/engine split: "+(before.oldSplit===null?"—":before.oldSplit+"/"+(100-before.oldSplit))+
   " → "+(before.newSplit===null?"—":before.newSplit+"/"+(100-before.newSplit))+"."));
  if(before.changedPositions.length){
   const changes=element("details","combo-changes");
   changes.append(element("summary","","Show changed positions"));
   changes.append(element("p","hint",before.changedPositions.join(", ")));
   comparison.append(changes);
  }
  root.append(comparison);
 }
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
