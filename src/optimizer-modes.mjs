// Keep the familiar default optimizer unchanged. Experimental includes the
// default preparations plus optional layered East Wind reserves.
import {buildCandidates} from "./preparation-core.mjs";
import {buildLayeredCandidates} from "./layered-preparation.mjs";

export function getModeCandidates(positions,maxTier,cap,selectedBase,chainLimit,protectTier64,mode="default"){
  const candidates=buildCandidates(positions,maxTier,cap,selectedBase,chainLimit,protectTier64);
  if(mode==="experimental"&&(!selectedBase||selectedBase===cap-27)){
    candidates.push(...buildLayeredCandidates(positions,maxTier,cap,chainLimit,protectTier64));
  }
  return candidates;
}
