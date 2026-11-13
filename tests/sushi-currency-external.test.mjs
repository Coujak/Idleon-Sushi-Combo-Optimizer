import test from "node:test";
import assert from "node:assert/strict";
import {parseSushiCurrencyExternal} from "../src/sushi-currency-external.mjs";
import {progressionGoalMetric} from "../src/progression-goal-impact.mjs";
import {getDoublerAccountImpact} from "../src/doubler-stat-impact.mjs";
import {getUpgradeRows} from "../src/lab-model.mjs";

// Synthetic game export. No real player's account data is committed here.
function fixture(){
 const options=Array(620).fill(0);
 options[594]=330;
 const research=Array.from({length:19},()=>[]);
 research[0]=Array(240).fill(0);
 research[1]=Array(240).fill(-1);
 research[7]=Array(16).fill(0);
 research[0][125]=3;research[1][125]=7;
 research[0][173]=1;
 research[0][189]=4;research[1][189]=6;
 research[7][4]=24; // 12th Minehead opponent has been defeated
 const arcade=Array(80).fill(0);arcade[67]=100;
 const atoms=Array(20).fill(0);atoms[14]=51;
 const levels=Array(46).fill(0);levels[31]=100;levels[40]=120;
 const sushi=[Array(120).fill(-1),Array(120).fill(0),levels,
  Array(15).fill(1),[0,0,17014050,0,0,0,0,0,320],
  Array(64).fill(1),Array(64).fill(0),Array(64).fill(10)];
 sushi[0][0]=25;
 const companion={l:["0,0,0,0,0","27,0,0,0,0","55,0,0,0,0","147,0,0,0,0"]};
 const weeklyBoss={"d_71":-1,"d_72":-1,"d_76":67};
 const raw={data:{Sushi:JSON.stringify(sushi),Research:JSON.stringify(research),
  ArcadeUpg:JSON.stringify(arcade),Atoms:atoms,OptLacc:options,
  WeeklyBoss:weeklyBoss},companion};
 return {raw,sushi,research,levels};
}
const near=(actual,expected,tolerance=1e-10)=>
 assert.ok(Math.abs(actual/expected-1)<tolerance,actual+" vs "+expected);

test("Reads Sushi's missing Toolbox multipliers directly from raw game fields",()=>{
 const {raw}=fixture(),untouched=JSON.stringify(raw);
 const result=parseSushiCurrencyExternal(raw);
 assert.ok(result.complete);
 assert.equal(result.arcadeSushi,25); // decay(100,25,100), doubled by pet27
 assert.equal(result.atomSushi,51); // Phosphorus Atom index14
 assert.equal(result.mineheadSushi,25); // opponent 11 beaten
 assert.equal(result.researchAllmulti,1.23); // pet55 + King Doot + 2 clouds + Sushi53
 near(result.researchGrid189,153.75);
 near(result.researchGrid125,23.985);
 assert.equal(result.details.sushiPresses,40);
 near(result.buttonSushi,148.782);
 assert.equal(JSON.stringify(raw),untouched,"Parsing must not mutate the JSON");
});

test("All external sources combine multiplicatively, not as a single additive percent",()=>{
 const {raw,sushi,research}=fixture();
 const external=parseSushiCurrencyExternal(raw);
 const base={sushi,spelunk:Array.from({length:53},()=>[]),
  research,tiles:sushi[0],slots:sushi[1],fires:sushi[3],
  research189:{level:4,observation:6}};
 const before=progressionGoalMetric(base,"bucks").value;
 const after=progressionGoalMetric({...base,sushiCurrencyExternal:external},"bucks").value;
 const expected=1.25*1.51*1.25*(1+148.782/100)*
  ((1+153.75/100)/(1+125/100));
 near(after/before,expected,1e-9);
 assert.ok(after>before*6);
});

test("Doubler what-if comparison retains external bonuses on both sides",()=>{
 const {raw,sushi,research}=fixture();
 const spelunk=Array.from({length:53},()=>[]);spelunk[52]=[31];
 const base={sushi,spelunk,research,tiles:sushi[0],slots:sushi[1],
  fires:sushi[3],research189:{level:4,observation:6}};
 const external=parseSushiCurrencyExternal(raw);
 const save={...base,sushiCurrencyExternal:external};
 const u=getUpgradeRows(save).find(x=>x.id===31);
 const without=getDoublerAccountImpact(base,u);
 const withExternal=getDoublerAccountImpact(save,u);
 assert.equal(without.currentSide,"with");
 assert.equal(withExternal.currentSide,"with");
 assert.ok(withExternal.withDoubler!==without.withDoubler);
 assert.equal(save.spelunk[52].length,1,"What-if must not mutate assignments");
});

test("Unowned companions or unfinished Minehead cannot grant fake Sushi multipliers",()=>{
 const {raw}=fixture();
 raw.companion={l:[]};
 raw.data.Research=JSON.parse(raw.data.Research);
 raw.data.Research[7][4]=11;
 const result=parseSushiCurrencyExternal(raw);
 assert.equal(result.arcadeSushi,12.5);
 assert.equal(result.mineheadSushi,0);
 assert.equal(result.researchAllmulti,1.03); // two completed clouds + Sushi53
 assert.equal(result.buttonSushi,40*2*(1+result.researchGrid125/100));
});
