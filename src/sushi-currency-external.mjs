// CurrencyMulti inputs for Sushi Station from the raw IT game export.
// Reference: Morta1/IdleonToolbox parsers/world-7/sushiStation.ts and
// parsers/world-7/{research,button,minehead}.ts, parsers/world-2/arcade.ts.
// These are raw-game formulas and pinned metadata, not user-specific factors.
const asJson=value=>{
 if(typeof value!=="string")return value;
 try{return JSON.parse(value);}catch{return null;}
};
const nonnegative=value=>{
 const n=Number(value);return Number.isFinite(n)?Math.max(0,n):0;
};
const observationPct=[25,15,50,20,20,35,25,30,35,60];
const petBase={55:15,147:50};
const petUpgraded={55:25,147:75};
const petIndices=[0,27,55,147];
const read=(input,key)=>asJson(input?.data?.[key]??input?.[key]);
const isArray=Array.isArray;
const finiteNum=value=>Number.isFinite(Number(value))?Number(value):null;

// Owned pets and Pet Bonus Tokens are both active as in Toolbox. Unowned
// or absent pet records receive no bonus. Pet Mart+ level >=1 changes bonus.
function getPetBonuses(input,options){
 const companion=asJson(input?.companion??input?.data?.companion);
 const levels=new Map();
 for(const raw of (isArray(companion?.l)?companion.l:[])){
  const [id,,,,level]=String(raw).split(",");
  const index=Number(id);
  if(Number.isInteger(index)&&index>=0)
   levels.set(index,Math.max(levels.get(index)??0,nonnegative(level)));
 }
 // Mirrors Toolbox's account-option token gate.
 const tokenCount=Math.min(1,nonnegative(options?.[605]))+
  Math.min(1,nonnegative(options?.[615]));
 const rawToken=options?.[606]??"";
 const tokenText=String(rawToken);
 const tokens=rawToken!=""&&tokenText.split(",").length<=.5+tokenCount?
  new Set(tokenText.split(",").map(Number).filter(Number.isFinite)):new Set();
 const active=id=>levels.has(id)||tokens.has(id);
 const petBonus=id=>active(id)?
  (levels.has(id)&&levels.get(id)>=1?petUpgraded[id]:petBase[id])??0:0;
 return {hasDoot:active(0),hasArcadePet:active(27),
  researchPet:petBonus(55),buttonPet:petBonus(147)};
}

export function parseSushiCurrencyExternal(input){
 if(!input||typeof input!=="object")return null;
 const opt=read(input,"OptLacc");
 const research=read(input,"Research");
 const atoms=read(input,"Atoms");
 const arcade=read(input,"ArcadeUpg");
 const weeklyBoss=read(input,"WeeklyBoss");
 const pets=getPetBonuses(input,opt);
 const sushi=read(input,"Sushi");
 const tracked=sushi?.[5];
 const uniqueSushi=isArray(tracked)?
  (tracked.findIndex(value=>Number(value)<0)>=0?
   tracked.findIndex(value=>Number(value)<0):tracked.length):0;

 // Research Grid_Bonus_Allmulti: the W7 deckhand, Doot/grid 173, three
 // completed Equinox clouds, and Sushi Rest-of-Game bonus index 53.
 const cloudCount=[71,72,76].reduce((sum,index)=>
  sum+(weeklyBoss?.["d_"+index]===-1?1:0),0);
 const doot= pets.hasDoot&&nonnegative(research?.[0]?.[173])>=1?5:0;
 const sushiBonus53=uniqueSushi>53?1:0; // research[37][53], pinned game value
 const researchAllmulti=1+(pets.researchPet+doot+cloudCount+sushiBonus53)/100;
 const bonusGrid=(index,base)=>{
  const level=nonnegative(research?.[0]?.[index]);
  const obs=Number(research?.[1]?.[index]);
  const observer=Number.isInteger(obs)&&obs>=0?observationPct[obs]??0:0;
  return base*level*(1+observer/100)*researchAllmulti;
 };
 const grid189=bonusGrid(189,25);
 const grid125=bonusGrid(125,5);

 // ArcadeBonus(67), growth('decay', lv, 25, 100) with lv101 Super x2
 // and lv102 Omega x6; pet27 doubles the final shop bonus.
 const arcadeLv=nonnegative(arcade?.[67]);
 const arcadeFactor=arcadeLv===102?6:arcadeLv===101?2:1;
 const arcadeSushi=arcadeLv>0?
  (25*arcadeLv/(arcadeLv+100))*arcadeFactor*
  (pets.hasArcadePet?2:1):0;

 // Phosphorus Atom (14), 1% per level.
 const atomSushi=nonnegative(atoms?.[14]);

 // Research[7][4] stores Minehead opponents defeated. Opponent 11 grants
 // researchData[20][11] =25%, capped to 1.25x in CurrencyMulti.
 const opponentCount=nonnegative(research?.[7]?.[4]);
 const mineheadSushi=opponentCount>11?25:0;

 // Button category 2: 5 presses per category, 9 categories per cycle.
 // Each Sushi press adds 2%, multiplied by companion147 and Better Button
 // Research grid125. The game does not add this to ordinary Bucks upgrades.
 const presses=nonnegative(opt?.[594]);
 const sushiPresses=Math.floor(presses/45)*5+
  Math.min(5,Math.max(0,presses%45-10));
 const buttonSushi=sushiPresses*2*
  (1+pets.buttonPet/100)*(1+grid125/100);
 return {arcadeSushi,atomSushi,mineheadSushi,buttonSushi,researchAllmulti,
  researchGrid189:grid189, researchGrid125:grid125,
  details:{sushiPresses,arcadeLv,opponentCount,cloudCount,petBonuses:pets},
  complete:isArray(opt)&&isArray(research)&&isArray(atoms)&&isArray(arcade)&&
   weeklyBoss&&typeof weeklyBoss==="object"&&
   asJson(input?.companion??input?.data?.companion)?.l!=null};
}
