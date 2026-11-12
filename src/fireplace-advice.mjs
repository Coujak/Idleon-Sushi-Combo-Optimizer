// Lightweight, save-aware advice for the Overview board. This is not an
// optimizer: goals, play time and the cost of losing other fireplace effects
// cannot be inferred from an imported save alone.
const RATE_PER_DAY=86400;
const finiteNonnegative=value=>{
 if(value===null||value===undefined||value==="")return null;
 const n=Number(value);return Number.isFinite(n)&&n>=0?n:null;
};
export function sparkFireplaceBonus(sparks){
 const s=finiteNonnegative(sparks);
 if(s===null)return null;
 return s>0?.2*Math.log2(s)+Math.log10(s):0;
}
export function formatSparkBonusPoints(value){
 if(value>=.1)return value.toFixed(2);
 if(value>=.001)return value.toFixed(3);
 if(value>=.00001)return value.toFixed(5);
 return value.toExponential(2).replace(/e\+?/i,"E");
}
const fireNames=["Charcoal","Barium","Copper","Lithium","Potassium"];
export function fireplaceOverviewAdvice(save){
 if(!save)return null;
 const fires=save.fires,levels=save.sushi?.[2],raw=save.sushi?.[4];
 if(!Array.isArray(fires)||!fires.some(type=>Number.isInteger(type)&&type>=0&&type<=4))
  return {heading:"Fireplace advice unavailable",summary:
   "Import a save with fireplace colors to see a recommendation.",detail:""};
 const counts=fireNames.map((_,id)=>fires.filter(type=>type===id).length);
 const purple=counts[4],sparkBalance=finiteNonnegative(raw?.[2]);
 const potassiumUnlocked=Array.isArray(levels)&&levels.length>25?
  Number(levels[25])>0:null;
 const unlocked=id=>Array.isArray(levels)&&Number(levels[id])>0;
 const alternatives=[
  "Charcoal for Fuel",
  unlocked(27)?"Barium for Bucks":null,
  unlocked(24)?"Copper for active merges":null,
  unlocked(26)?"Lithium for Knowledge EXP":null
 ].filter(Boolean).join(" · ");
 const colors="Current fireplaces: "+counts.map((n,id)=>n+" "+fireNames[id]).join(", ")+".";
 const weakestCharcoal=fires.map((kind,col)=>{
  if(kind!==0)return null;
  let total=0;
  for(let row=0;row<8;row++){
   const tile=Number(save.tiles?.[row*15+col]??-1);
   if(Number.isInteger(tile)&&tile>=0)total+=tile+1;
  }
  return {column:col+1,tierTotal:total};
 }).filter(Boolean).sort((a,b)=>a.tierTotal-b.tierTotal||a.column-b.column)[0]??null;
 const suggestion=weakestCharcoal?
  " If changing a Charcoal fireplace, column "+weakestCharcoal.column+
  " has the lowest sushi-tier total of your current Charcoal columns, so it sacrifices the least Charcoal Fuel contribution.":
  " Avoid replacing a useful Barium, Copper or Lithium column without considering its purpose.";
 if(potassiumUnlocked===false)
  return {heading:"Potassium is not unlocked yet",
   summary:"Potassium is locked. Keep your current fireplace bonuses.",
   detail:alternatives+". "+colors,counts,purple,sparkBalance,weakestCharcoal};
 if(sparkBalance===null)
  return {heading:"Potassium: Spark data unavailable",
   summary:"Spark balance is missing, so Purple cannot be assessed yet.",
   detail:alternatives+". "+colors,counts,purple,sparkBalance,weakestCharcoal};
 // Compare one MORE Purple fireplace with keeping the current mix.
 // Existing Purple fires generate Sparks in both scenarios.
 const timeGains=[
  {label:"1 hour",seconds:3600},
  {label:"24 hours",seconds:RATE_PER_DAY},
  {label:"7 days",seconds:7*RATE_PER_DAY}
 ].map(({label,seconds})=>{
  const current=sparkBalance+purple*seconds;
  const extra=current+seconds;
  return {label,points:sparkFireplaceBonus(extra)-sparkFireplaceBonus(current)};
 });
 const marginal=timeGains[1].points;
 const gainText="Extra Spark-based fireplace strength from one additional Purple fireplace: "+
  timeGains.map(item=>item.label+" +"+formatSparkBonusPoints(item.points)+" percentage points").join("; ")+
  ". Assumes continuous +1 Spark/second; losses from replacing another fireplace are not included.";
 let heading,summary;
 if(marginal>=.1){
  heading=purple?"Keep Potassium for passive Spark growth":"Consider one Potassium while idling";
  summary=purple?
   "Good for passive Sparks: your Purple fireplaces improve all fireplace bonuses over time. Keep Charcoal for Fuel or other firelighters when you need their immediate effects.":
   "Worth considering while idling: Purple builds Sparks that boost all fireplaces. It replaces a Fuel, Bucks, or Knowledge benefit, so avoid switching an important column.";
 }else if(marginal>=.01){
  heading="Potassium is optional";
  summary="Optional: Purple adds Sparks over time, but the strength gained is slowing. Keep Charcoal for Fuel, Barium for Bucks, or Lithium for Knowledge when those matter more.";
 }else{
  heading="Favor productive fireplaces over more Potassium";
  summary=purple?
   "Avoid adding more Purple for now: the extra Spark bonus is small, while replacing a fireplace loses its immediate effect. Favor Fuel, Bucks, or Knowledge instead.":
   "Avoid swapping a productive fire to Purple for now: the added Spark bonus is small. Keep Charcoal for Fuel, Barium for Bucks, or Lithium for Knowledge.";
 }
 return {heading,summary,detail:gainText+" "+alternatives+"."+suggestion,
  counts,purple,sparkBalance,weakestCharcoal,marginalSparkPointsPerDay:marginal,
  timeGains,timeGainCaption:"Extra fireplace-strength bonus from adding 1 Purple · assumes continuous +1 Spark/sec; excludes lost effects from the replaced fireplace.",
  colors};
}
