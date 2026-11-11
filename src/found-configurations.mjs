// Previously discovered, fixed experiment boards. Never treat these as
// configurations independently discovered by the split optimizers.
import {HISTORICAL_COMBO_STRATEGIES} from "./adaptive-combo-strategies.mjs";

export const FOUND_CONFIGURATIONS=Object.freeze(HISTORICAL_COMBO_STRATEGIES.map(entry=>
 Object.freeze({id:"experimental"+entry.number,number:entry.number,
  name:"Experiment "+entry.number+" · "+entry.family,
  benchmark:entry.benchmark})
));

export function buildFoundConfiguration(id,positions,maxTier,cap,chainLimit,protectHighest){
 const number=Number(String(id).replace(/^experimental/,""));
 const experiment=HISTORICAL_COMBO_STRATEGIES.find(entry=>entry.number===number);
 if(!experiment||maxTier!==64||cap!==58||chainLimit!==25||
  !protectHighest)return null;
 const prepared=experiment.build(positions,maxTier,cap,chainLimit,protectHighest);
 if(!prepared?.length)return null;
 const candidate=prepared[0];
 return {...candidate,
  name:"Found · Experiment "+experiment.number+" · "+experiment.family,
  foundExperiment:experiment.number,
  foundBenchmark:experiment.benchmark,
  shape:"found historical configuration",
  base:experiment.base,
  strategySections:{protectedPosition:positions[0],
   enginePositions:positions.slice(experiment.boundary)},
  supplyCount:experiment.boundary,engineCount:positions.length-experiment.boundary,
  splitPercent:experiment.boundary};
}
