// Keep the familiar default optimizer unchanged. Experimental includes the
// default preparations plus optional layered East Wind reserves.
import {buildCandidates} from "./preparation-core.mjs";
import {buildLayeredCandidates} from "./layered-preparation.mjs";
import {buildTuned100Candidates} from "./tuned-preparation.mjs";
import {buildExperimental2Candidates} from "./experimental2-preparation.mjs";
import {buildExperimental3Candidates} from "./experimental3-preparation.mjs";
import {buildExperimental4Candidates} from "./experimental4-preparation.mjs";
import {buildExperimental5Candidates} from "./experimental5-preparation.mjs";

export function getModeCandidates(positions,maxTier,cap,selectedBase,chainLimit,protectTier64,mode="default"){
  const candidates=buildCandidates(positions,maxTier,cap,selectedBase,chainLimit,protectTier64);
  if(["experimental","experimental2","experimental3","experimental4","experimental5"].includes(mode)&&(!selectedBase||selectedBase===cap-27)){
    candidates.push(...buildLayeredCandidates(positions,maxTier,cap,chainLimit,protectTier64));
    candidates.push(...buildTuned100Candidates(positions,maxTier,cap,chainLimit,protectTier64));
  }
  // Experimental 2.0 adds its verified layout without changing earlier modes.
  if(["experimental2","experimental3","experimental4","experimental5"].includes(mode)&&(!selectedBase||selectedBase===23)){
    candidates.push(...buildExperimental2Candidates(positions,maxTier,cap,chainLimit,protectTier64));
  }
  // Newer modes retain the older candidates; only 3.0 gets this benchmark.
  if(["experimental3","experimental4","experimental5"].includes(mode)&&(!selectedBase||selectedBase===21)){
    candidates.push(...buildExperimental3Candidates(positions,maxTier,cap,chainLimit,protectTier64));
  }
  if((mode==="experimental4"||mode==="experimental5")&&(!selectedBase||selectedBase===18)){
    candidates.push(...buildExperimental4Candidates(positions,maxTier,cap,chainLimit,protectTier64));
  }
  if(mode==="experimental5"&&(!selectedBase||selectedBase===12)){
    candidates.push(...buildExperimental5Candidates(positions,maxTier,cap,chainLimit,protectTier64));
  }
  return candidates;
}
