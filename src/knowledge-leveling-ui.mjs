// Read-only Knowledge Leveling Planner UI. Account JSON remains browser-memory only.
import {getKnowledgeRows,getUpgradeRows,numberText} from "./lab-model.mjs?v=1.19.13";
import {sushiTierIconPath} from "./sushi-reference.mjs?v=1.16.6";
import {formatKnowledgeBonusValue} from "./knowledge-bonus-format.mjs?v=1.0.2";
import {KNOWLEDGE_LEVELING_GOALS,KNOWLEDGE_LEVELING_ORDERS,
 normalizeKnowledgeLevelingOptions,planKnowledgeLeveling}
 from "./knowledge-leveling-planner.mjs?v=1.0.0";

const $=id=>document.getElementById(id);
const elem=(tag,cls="",text)=>{
 const n=document.createElement(tag);
 if(cls)n.className=cls;
 if(text!==undefined&&text!==null)n.textContent=String(text);
 return n;
};
const VALUE=n=>numberText(n);
const PREF_KEY="idleon-sushi-leveling-plan-v1";

export function initializeKnowledgeLevelingUI(getSave){
 const goal=$("knowledgePlanGoal"),order=$("knowledgePlanOrder");
 const status=$("knowledgePlanStatus"),feature=$("knowledgePlanFeatured");
 const secondary=$("knowledgePlanAlternatives"),tips=$("knowledgePlanTips");
 for(const option of KNOWLEDGE_LEVELING_GOALS)goal.append(new Option(option.label,String(option.category)));
 for(const option of KNOWLEDGE_LEVELING_ORDERS)order.append(new Option(option.label,option.value));
 let state=normalizeKnowledgeLevelingOptions();
 try{
  state=normalizeKnowledgeLevelingOptions(JSON.parse(
   window.localStorage.getItem(PREF_KEY)||"null"));
 }catch{/* Browsers may block storage; the planner still works without it. */}
 goal.value=String(state.category);order.value=state.order;
 const remember=()=>{
  try{window.localStorage.setItem(PREF_KEY,JSON.stringify({category:goal.value,order:order.value}));}
  catch{/* Saving these two interface choices is optional. */}
 };
 const upgradeAvailable=(rows,name)=>rows.some(r=>r.name===name&&r.level>0);
 function renderGuidance(save){
  tips.replaceChildren();
  if(!save)return;
  let upgrades=[];
  try{upgrades=getUpgradeRows(save);}catch{/* Incomplete exports should not break the planner. */}
  const notes=[];
  if(upgradeAvailable(upgrades,"Seared Knowledge")){
   notes.push("Creating Sushi of your chosen tier earns Knowledge EXP. Cook or merge it to focus that tier.");
  }else{
   notes.push("Unlock Seared Knowledge to earn Knowledge EXP whenever Sushi is created.");
  }
  if(upgradeAvailable(upgrades,"Lithium Firelighter"))
   notes.push("Pink Lithium fireplaces boost Knowledge EXP earned by Sushi in the column above them.");
  if(upgradeAvailable(upgrades,"Cold Slot"))
   notes.push("A higher-tier Sushi on a Cold plate awards daily Knowledge EXP to lower Sushi tiers.");
  if(upgradeAvailable(upgrades,"Milktoast Slot"))
   notes.push("Milktoast plates award daily Knowledge EXP to the Sushi tier placed on them.");
  if(upgradeAvailable(upgrades,"2nd Degree Searing")||
     upgradeAvailable(upgrades,"3rd Degree Searing"))
   notes.push("Your Searing upgrades improve Knowledge EXP gains; this planner does not assume an exact rate.");
  for(const text of notes)tips.append(elem("li","",text));
 }
 function identity(item){
  const line=elem("div","lab-kp-identity");
  const art=elem("span","lab-kp-art");
  const img=elem("img");
  img.src=sushiTierIconPath(item.tier);img.alt="";
  img.loading="lazy";img.onerror=()=>img.remove();
  art.append(img);
  if(item.perfecto){
   const emblem=elem("img","lab-kp-perfecto");
   emblem.src="assets/Perfecto_Symbol.png";emblem.alt="Perfecto";
   emblem.title="Perfecto: Knowledge effect is doubled";emblem.loading="lazy";
   art.append(emblem);
  }
  const title=elem("span","lab-kp-name");
  title.append(elem("strong","","T"+item.tier+" · "+item.name),
   elem("small","","Knowledge Lv "+VALUE(item.level)+" → "+VALUE(item.targetLevel)));
  line.append(art,title);return line;
 }
 function effect(item){
  const line=elem("div","lab-kp-effect");
  const oldValue=formatKnowledgeBonusValue(item.category,item.bonus);
  const nextValue=formatKnowledgeBonusValue(item.category,item.nextBonus);
  line.append(elem("span","",item.categoryName),
   elem("span","lab-kp-effect-values"));
  const host=line.lastChild;
  host.append(elem("strong","lab-knowledge-value-pill"+(item.perfecto?" is-perfecto":""),oldValue??"—"),
   elem("span","lab-kp-arrow","→"),
   elem("strong","lab-knowledge-value-pill"+(item.perfecto?" is-perfecto":""),nextValue??"—"));
  return line;
 }
 function makeCard(item,featured=false){
  const card=elem("article","lab-kp-card"+(featured?" is-featured":""));
  const head=elem("div","lab-kp-card-heading");
  head.append(identity(item));
  if(item.ready)head.append(elem("span","lab-kp-ready","Ready to level"));
  card.append(head,effect(item));
  const bar=elem("progress","lab-knowledge-exp-progress");
  bar.max=100;bar.value=Number.isFinite(item.xpProgress)?
   Math.max(0,Math.min(100,item.xpProgress*100)):0;
  bar.setAttribute("aria-label","EXP progress for "+item.name);
  const amounts=elem("div","lab-kp-exp-line");
  amounts.append(elem("span","",VALUE(item.xp)+" / "+VALUE(item.xpReq)+" EXP"),
   elem("strong","",VALUE(item.remainingExp)+" EXP remaining"));
  card.append(amounts,bar);
  if(featured)card.append(elem("p","lab-kp-reason",item.ready?
   "The imported EXP meets the next-level threshold. Check the level-up in-game before farming more EXP.":
   "Best current match for your goal and sorting preference. Focus on creating this Sushi tier to earn EXP."));
  return card;
 }
 function render(){
  const save=getSave();
  feature.replaceChildren();secondary.replaceChildren();
  if(!save){
   status.textContent="Import your game save in Overview to receive Knowledge targets.";
   renderGuidance(null);return;
  }
  const rows=planKnowledgeLeveling(getKnowledgeRows(save),{
   category:goal.value,order:order.value
  });
  renderGuidance(save);
  if(!rows.length){
   status.textContent="No discovered Sushi tiers with complete EXP data for this focus. Try a different goal or import a newer save.";
   return;
  }
  status.textContent=rows.length+" eligible Sushi tier"+(rows.length===1?"":"s")+
   " · "+rows.filter(x=>x.ready).length+" ready to level";
  feature.append(elem("h3","","Recommended next Knowledge level"),makeCard(rows[0],true));
  if(rows.length>1){
   secondary.append(elem("h3","","Other candidates"));
   const list=elem("div","lab-kp-grid");
   for(const item of rows.slice(1,6))list.append(makeCard(item));
   secondary.append(list);
  }
 }
 goal.addEventListener("change",()=>{remember();render();});
 order.addEventListener("change",()=>{remember();render();});
 render();
 return {refresh:render};
}
