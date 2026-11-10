// Upgrade Catalog presentation helpers. Game data is unchanged.
import {estimateSushiFuelEconomy} from "./perfecto-fuel.mjs?v=1.16.6";
import {sushiUpgradeExtraText} from "./lab-model.mjs?v=1.16.6";
import {formatGameQuantity} from "./progression-calibration.mjs";
const SHORT_DESCRIPTIONS=[
  "Shows hourly Bucks earnings and increases overall sushi Bucks production.",
  "Increases how quickly Sushi Station generates fuel.",
  "Unlocks permanent game-wide bonuses for discovering new sushi types.",
  "Increases the Sushi Station's maximum fuel storage.",
  "Increases Bucks earned from all sushi.",
  "Improves fuel generation speed and its separate multiplier.",
  "Unlocks an additional sushi board slot.",
  "Unlocks cooking higher-tier sushi, with increased fuel cost.",
  "Boosts fuel capacity and its separate capacity multiplier.",
  "Displays numeric sushi tiers and boosts total Bucks earned.",
  "Unlocks the daily shaker that can increase sushi tiers.",
  "Increases sushi Bucks production; unique sushi also contribute a multiplier.",
  "Unlocks the Combo Meter and its permanent Bucks multiplier.",
  "Unlocks a Hot Plate that boosts Bucks from sushi placed on it.",
  "Lets you move the board slots themselves.",
  "Unlocks Knowledge EXP and bonuses earned from creating sushi.",
  "Unlocks a fireplace that improves fuel generation by sushi tier.",
  "Grants an instant burst of Bucks when a sushi is created.",
  "Improves fuel generation speed and its separate multiplier.",
  "Boosts fuel capacity and its separate capacity multiplier.",
  "Using a shaker also generates fuel, with a chance for extra fuel.",
  "Increases Bucks earned from all sushi.",
  "Gives freshly cooked sushi a chance to start one tier higher.",
  "Unlocks the daily shaker that can turn sushi Perfecto.",
  "Unlocks a Milktoast Plate that generates Knowledge EXP.",
  "Unlocks a green fireplace that increases sushi Bucks earnings.",
  "Allows a merge to tier-up lower-tier sushi immediately to its right.",
  "Improves fuel generation speed and its separate multiplier.",
  "Reduces the price of Sushi Station upgrades.",
  "Provides a chance to keep a shaker use after activating it.",
  "Boosts fuel capacity and its separate capacity multiplier.",
  "Increases Knowledge EXP awarded for newly created sushi.",
  "Unlocks blue fireplaces that can produce double tier upgrades.",
  "Unlocks the daily shaker that generates an hour of Bucks.",
  "Unlocks a Cold Plate that grants EXP to lower-tier sushi.",
  "Improves fuel generation speed and its separate multiplier.",
  "Increases how many hours of Bucks the Saffron Shaker awards.",
  "Increases Bucks earned from all sushi.",
  "Rewards generating fuel while the tank is already full.",
  "Unlocks pink fireplaces that multiply Knowledge EXP.",
  "Boosts fuel capacity and its separate capacity multiplier.",
  "Unlocks purple fireplaces that generate an additional resource.",
  "Applies a multiplier to Bucks earned from every source.",
  "Increases Knowledge EXP gained from all sources.",
  "Increases Bucks earned from all sushi.",
  "Special Rift-related upgrade with no listed purchase levels."
];
export const CATALOG_SORT_OPTIONS=Object.freeze([
 {value:"shop",label:"Shop order"},
 {value:"name-asc",label:"Name: A to Z"},
 {value:"name-desc",label:"Name: Z to A"},
 {value:"level-desc",label:"Level: highest first",requiresSave:true},
 {value:"level-asc",label:"Level: lowest first",requiresSave:true},
 {value:"cost-asc",label:"Next base cost: lowest first",requiresSave:true},
 {value:"cost-desc",label:"Next base cost: highest first",requiresSave:true},
 {value:"doubled-first",label:"Currently doubled first",requiresSave:true}
]);
export const CATALOG_STATUS_OPTIONS=Object.freeze([
 {value:"all",label:"All statuses"},
 {value:"not-maxed",label:"Not maxed",requiresSave:true},
 {value:"maxed",label:"Maxed",requiresSave:true},
 {value:"doubled",label:"Currently doubled",requiresSave:true},
 {value:"eligible",label:"Doubler eligible"}
]);
export function upgradeSummary(upgrade){
 return SHORT_DESCRIPTIONS[upgrade.shop-1]??"See the full upgrade details.";
}
// Game's $ symbol is a *different* per-upgrade value than the { level
// placeholder. Keep the dollar calculation separate and source-supported.
export function upgradeCatalogDollarValue(upgrade,save){
 if(!upgrade||!save?.sushi)return null;
 if(upgrade.id===8){ // Fastburn Fuel I: current Fuel/hr and maximum Fuel.
  const economy=estimateSushiFuelEconomy(save);
  if(!(economy?.generationPerHour>0)||!(economy?.capacity>0))return null;
  const text=formatGameQuantity(economy.generationPerHour)+" Fuel/hr. "+
    "Max Cap is "+formatGameQuantity(economy.capacity)+" Fuel";
  // Game export doesn't consistently expose Event Shop capacity bonuses.
  // These are *modeled* values, not necessarily the exact UI displays.
  return {text,estimated:true};
 }
 const value=sushiUpgradeExtraText(upgrade,save);
 return value===null||value===undefined?null:{text:String(value),estimated:false};
}
// Keep description values and their provenance so estimated account-wide
// totals remain distinguishable from exact upgrade-level arithmetic.
export function upgradeDescriptionSegments(raw,upgrade=null,hasSave=false,extra=null){
 if(!raw)return [{text:"No effect description is available.",kind:"text"}];
 const known=hasSave&&upgrade&&Number.isFinite(upgrade.rawBonus);
 const qty=known?upgrade.rawBonus.toLocaleString("en-US",{maximumFractionDigits:3}):null;
 const multi=known?(1+upgrade.rawBonus/100).toLocaleString("en-US",{maximumFractionDigits:3}):null;
 const dollar=hasSave&&extra?(typeof extra==="string"?{text:extra,estimated:false}:extra):null;
 const moneyText=typeof dollar?.text==="string"&&dollar.text.length>0?dollar.text:null;
 const source=raw.trim().replace(/\s*@\s*/g," ").replace(/\[resource\]/gi,
  upgrade?.id===25?"Spark":upgrade?.id===28?"Overtuned Fuel":"resource");
 const token=/\+\{%|\{%|\+\{|{|\$x|\$%|}x|\$/g;
 const parts=[];
 let from=0,match;
 while((match=token.exec(source))){
  if(match.index>from)parts.push({text:source.slice(from,match.index),kind:"text"});
  const id=match[0];let text,kind="unresolved";
  if(id.includes("{")){
   const percent=id.endsWith("%");
   text=(id.startsWith("+")?"+":"")+(known?qty:"—")+(percent?"%":"");
   if(known)kind="calculated";
  }else if(id==="}x"){
   // The game's multiplier information formatter uses 1 + quantity / 100.
   text=known?multi+"×":"—";
   if(known)kind="calculated";
  }else if(moneyText!==null){
   text=moneyText;
   kind=dollar.estimated?"estimated":"calculated";
   // The account-specific dollar result already includes its ×/% suffix.
   if(id==="$x"&&!/[×x]$/.test(text))text+="×";
   if(id==="$%"&&!/%$/.test(text))text+="%";
  }else if(id==="$x")text="—";
  else if(id==="$%")text="—";
  else text="—";
  parts.push({text,kind});
  from=token.lastIndex;
 }
 if(from<source.length)parts.push({text:source.slice(from),kind:"text"});
 return parts;
}
export function readableUpgradeDescription(raw,upgrade=null,hasSave=false,extra=null){
 return upgradeDescriptionSegments(raw,upgrade,hasSave,extra).map(part=>part.text).join("")
  .replace(/\s+/g," ").trim();
}
export function catalogHasVariableValues(raw,upgrade=null,hasSave=false,extra=null){
 return upgradeDescriptionSegments(raw,upgrade,hasSave,extra).some(part=>part.kind==="unresolved");
}
export function filterSortCatalog(upgrades,{query="",category="all",status="all",sort="shop",hasSave=false,hideMaxed=false}={}){
 const search=String(query).trim().toLocaleLowerCase();
 if(["maxed","not-maxed","doubled"].includes(status)&&!hasSave)return [];
 const rows=upgrades.filter(upgrade=>{
  if(hideMaxed&&hasSave&&upgrade.maxLevel>0&&upgrade.atMax)return false;
  const goals=upgrade.goals??[];
  if(category==="other"&&goals.length!==0)return false;
  if(category!=="other"&&category!=="all"&&!goals.includes(category))return false;
  if(status==="eligible"&&!upgrade.doublerEligible)return false;
  if(status==="doubled"&&!upgrade.doubled)return false;
  if(status==="maxed"&&!(upgrade.maxLevel>0&&upgrade.atMax))return false;
  if(status==="not-maxed"&&!(upgrade.maxLevel>0&&!upgrade.atMax))return false;
  const haystack=[upgrade.name,upgrade.shop,upgrade.id,upgrade.description,
   upgradeSummary(upgrade),...goals].join(" ").toLocaleLowerCase();
  return !search||haystack.includes(search);
 });
 const cost=upgrade=>!upgrade.atMax&&Number.isFinite(upgrade.estimatedNextCost)
  ?upgrade.estimatedNextCost:null;
 const comparePrice=(a,b,descending)=>{
  const ac=cost(a),bc=cost(b);
  if(ac===null)return bc===null?0:1;
  if(bc===null)return -1;
  return descending?bc-ac:ac-bc;
 };
 rows.sort((a,b)=>{
  let d=0;
  switch(sort){
   case "name-asc":d=a.name.localeCompare(b.name);break;
   case "name-desc":d=b.name.localeCompare(a.name);break;
   case "level-asc":if(hasSave)d=a.level-b.level;break;
   case "level-desc":if(hasSave)d=b.level-a.level;break;
   case "cost-asc":if(hasSave)d=comparePrice(a,b,false);break;
   case "cost-desc":if(hasSave)d=comparePrice(a,b,true);break;
   case "doubled-first":if(hasSave)d=Number(b.doubled)-Number(a.doubled);break;
  }
  return d||a.shop-b.shop;
 });
 return rows;
}
