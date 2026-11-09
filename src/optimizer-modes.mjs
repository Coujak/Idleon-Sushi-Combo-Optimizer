// Keep the familiar default optimizer unchanged. Experimental includes the
// default preparations plus optional layered East Wind reserves.
import {buildCandidates} from "./preparation-core.mjs";
import {buildLayeredCandidates} from "./layered-preparation.mjs";
import {buildTuned100Candidates} from "./tuned-preparation.mjs";
import {buildExperimental2Candidates} from "./experimental2-preparation.mjs";
import {buildExperimental3Candidates} from "./experimental3-preparation.mjs";
import {buildExperimental4Candidates} from "./experimental4-preparation.mjs";
import {buildExperimental5Candidates} from "./experimental5-preparation.mjs";
import {buildExperimental6Candidates} from "./experimental6-preparation.mjs";
import {buildExperimental7Candidates} from "./experimental7-preparation.mjs";
import {buildExperimental8Candidates} from "./experimental8-preparation.mjs";
import {buildExperimental9Candidates} from "./experimental9-preparation.mjs";
import {buildExperimental10Candidates} from "./experimental10-preparation.mjs";
import {buildExperimental11Candidates} from "./experimental11-preparation.mjs";
import {buildExperimental12Candidates} from "./experimental12-preparation.mjs";
import {buildExperimental13Candidates} from "./experimental13-preparation.mjs";

export function getModeCandidates(positions,maxTier,cap,selectedBase,chainLimit,protectTier64,mode="default"){
  const candidates=buildCandidates(positions,maxTier,cap,selectedBase,chainLimit,protectTier64);
  if(["experimental","experimental2","experimental3","experimental4","experimental5","experimental6","experimental7","experimental8","experimental9","experimental10","experimental11","experimental12","experimental13"].includes(mode)&&(!selectedBase||selectedBase===cap-27)){
    candidates.push(...buildLayeredCandidates(positions,maxTier,cap,chainLimit,protectTier64));
    candidates.push(...buildTuned100Candidates(positions,maxTier,cap,chainLimit,protectTier64));
  }
  // Experimental 2.0 adds its verified layout without changing earlier modes.
  if(["experimental2","experimental3","experimental4","experimental5","experimental6","experimental7","experimental8","experimental9","experimental10","experimental11","experimental12","experimental13"].includes(mode)&&(!selectedBase||selectedBase===23)){
    candidates.push(...buildExperimental2Candidates(positions,maxTier,cap,chainLimit,protectTier64));
  }
  // Newer modes retain the older candidates; only 3.0 gets this benchmark.
  if(["experimental3","experimental4","experimental5","experimental6","experimental7","experimental8","experimental9","experimental10","experimental11","experimental12","experimental13"].includes(mode)&&(!selectedBase||selectedBase===21)){
    candidates.push(...buildExperimental3Candidates(positions,maxTier,cap,chainLimit,protectTier64));
  }
  if(["experimental4","experimental5","experimental6","experimental7","experimental8","experimental9","experimental10","experimental11","experimental12","experimental13"].includes(mode)&&(!selectedBase||selectedBase===18)){
    candidates.push(...buildExperimental4Candidates(positions,maxTier,cap,chainLimit,protectTier64));
  }
  if(["experimental5","experimental6","experimental7","experimental8","experimental9","experimental10","experimental11","experimental12","experimental13"].includes(mode)&&(!selectedBase||selectedBase===12)){
    candidates.push(...buildExperimental5Candidates(positions,maxTier,cap,chainLimit,protectTier64));
  }
  if(["experimental6","experimental7","experimental8","experimental9","experimental10","experimental11","experimental12","experimental13"].includes(mode)&&(!selectedBase||selectedBase===11)){
    candidates.push(...buildExperimental6Candidates(positions,maxTier,cap,chainLimit,protectTier64));
  }
  if(["experimental7","experimental8","experimental9","experimental10","experimental11","experimental12","experimental13"].includes(mode)&&(!selectedBase||selectedBase===8)){
    candidates.push(...buildExperimental7Candidates(positions,maxTier,cap,chainLimit,protectTier64));
  }
  if(["experimental8","experimental9","experimental10","experimental11","experimental12","experimental13"].includes(mode)&&(!selectedBase||selectedBase===8)){
    candidates.push(...buildExperimental8Candidates(positions,maxTier,cap,chainLimit,protectTier64));
  }
  if(["experimental9","experimental10","experimental11","experimental12","experimental13"].includes(mode)&&(!selectedBase||selectedBase===10)){
    candidates.push(...buildExperimental9Candidates(positions,maxTier,cap,chainLimit,protectTier64));
  }
  if(["experimental10","experimental11","experimental12","experimental13"].includes(mode)&&(!selectedBase||selectedBase===10)){
    candidates.push(...buildExperimental10Candidates(positions,maxTier,cap,chainLimit,protectTier64));
  }
  if(["experimental11","experimental12","experimental13"].includes(mode)&&(!selectedBase||selectedBase===9)){
    candidates.push(...buildExperimental11Candidates(positions,maxTier,cap,chainLimit,protectTier64));
  }
  if((mode==="experimental12"||mode==="experimental13")&&(!selectedBase||selectedBase===9)){
    candidates.push(...buildExperimental12Candidates(positions,maxTier,cap,chainLimit,protectTier64));
  }
  if(mode==="experimental13"&&(!selectedBase||selectedBase===9)){
    candidates.push(...buildExperimental13Candidates(positions,maxTier,cap,chainLimit,protectTier64));
  }
  return candidates;
}
