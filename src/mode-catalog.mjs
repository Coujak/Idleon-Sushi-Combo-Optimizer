// Human-readable names and estimated manual-execution difficulty.
// Stable IDs and benchmark algorithms are unchanged.
// Benchmark scores are simulated, not in-game confirmed.
export const MODE_CATALOG=Object.freeze([
  {
    "id": "default",
    "number": 0,
    "name": "Balanced Planner",
    "difficulty": "Adaptive",
    "benchmark": null,
    "summary": "Flexible board preparations and merges for a wide range of unlocks and custom setups."
  },
  {
    "id": "adaptive",
    "number": null,
    "name": "Progression-Aware Planner",
    "difficulty": "Adaptive",
    "benchmark": null,
    "summary": "Compares procedural multi-wave engines and strategies learned from historical experiments at your available tier, Wind cap and unlocked slot count. Scores are simulated, not inherited from T64 showcase boards."
  },
  {
    "id": "experimental",
    "number": 1,
    "name": "Wind Foundations",
    "difficulty": "Advanced",
    "benchmark": 51608,
    "summary": "Adds layered and tuned Wind reserves to recycle descending staircases."
  },
  {
    "id": "experimental2",
    "number": 2,
    "name": "Reserve Tides",
    "difficulty": "Advanced",
    "benchmark": 56315,
    "summary": "Builds a Tier 23 reserve wave for longer East Wind cascades."
  },
  {
    "id": "experimental3",
    "number": 3,
    "name": "Layered Currents",
    "difficulty": "Advanced",
    "benchmark": 57328,
    "summary": "Layers Tier 21 reserves to repeat Wind chains."
  },
  {
    "id": "experimental4",
    "number": 4,
    "name": "Long Cascade",
    "difficulty": "Expert",
    "benchmark": 58684,
    "summary": "Extends the reserve staircase to Tier 18 for longer cascades."
  },
  {
    "id": "experimental5",
    "number": 5,
    "name": "Deep Reserves",
    "difficulty": "Expert",
    "benchmark": 60572,
    "summary": "Adds deep Tier 12 reserves to support repeated Wind waves."
  },
  {
    "id": "experimental6",
    "number": 6,
    "name": "Third-Wave Engine",
    "difficulty": "Expert",
    "benchmark": 64017,
    "summary": "Rebalances Tier 11 reserves to strengthen a third Wind wave."
  },
  {
    "id": "experimental7",
    "number": 7,
    "name": "Low-Tier Overdrive",
    "difficulty": "Master",
    "benchmark": 65542,
    "summary": "Uses a tight Tier 8 ladder with reworked high-tier reserves."
  },
  {
    "id": "experimental8",
    "number": 8,
    "name": "Chaotic Reserves",
    "difficulty": "Master",
    "benchmark": 68415,
    "summary": "Reorders high-tier sushi for an extended late cascade."
  },
  {
    "id": "experimental9",
    "number": 9,
    "name": "Triple-Wave Surge",
    "difficulty": "Master",
    "benchmark": 70071,
    "summary": "Moves three Wind stages earlier to leave space for the last chain."
  },
  {
    "id": "experimental10",
    "number": 10,
    "name": "High-Tier Tempest",
    "difficulty": "Grandmaster",
    "benchmark": 73367,
    "summary": "Uses high-tier reserves to support extended three-stage Wind sequences."
  },
  {
    "id": "experimental11",
    "number": 11,
    "name": "Perfect Storm",
    "difficulty": "Grandmaster",
    "benchmark": 75047,
    "summary": "Coordinates reserve tiers and stage boundaries to pass 75,000 simulated points."
  },
  {
    "id": "experimental12",
    "number": 12,
    "name": "Wind Foresight",
    "difficulty": "Grandmaster",
    "benchmark": 75546,
    "summary": "Uses bounded merge-order lookahead to preserve better future cascades."
  },
  {
    "id": "experimental13",
    "number": 13,
    "name": "Cascade Resonance",
    "difficulty": "Grandmaster",
    "benchmark": 76532,
    "summary": "Rebalances high-tier reserve sushi for stronger repeated Wind cascades; verified under Tier 64 settings."
  },
  {
    "id": "simple",
    "number": null,
    "kind": "split",
    "name": "Simple Cascade",
    "difficulty": "Quick",
    "benchmark": null,
    "summary": "One basic descending East Wind cascade with the player's actual tier and Wind cap. No supply/engine split search."
  },
  {
    "id": "optimizer1",
    "number": null,
    "kind": "split",
    "name": "Optimizer 1 (Fast)",
    "difficulty": "Fast",
    "benchmark": null,
    "summary": "Search supply/engine divisions 50/50, 70/30 and 90/10; 20-point jumps."
  },
  {
    "id": "optimizer2",
    "number": null,
    "kind": "split",
    "name": "Optimizer 2 (Mid)",
    "difficulty": "Mid",
    "benchmark": null,
    "summary": "Search supply/engine divisions 50/50 through 90/10; 10-point jumps."
  },
  {
    "id": "optimizer3",
    "number": null,
    "kind": "split",
    "name": "Optimizer 3 (Slow)",
    "difficulty": "Slow",
    "benchmark": null,
    "summary": "Search supply/engine divisions 50/50 through 95/5; 5-point jumps."
  },
  {
    "id": "optimizer4",
    "number": null,
    "kind": "split",
    "name": "Optimizer 4 (Max)",
    "difficulty": "Max",
    "benchmark": null,
    "summary": "Search every supply/engine division 50/50 through 99/1; 1-point jumps."
  }
]);
export function getModeInfo(id){return MODE_CATALOG.find(m=>m.id===id)??MODE_CATALOG[0];}
export function modeOptionLabel(m){
 if(m.kind==="split")return m.name+" · "+m.difficulty;
 if(m.id==="adaptive")return "Adaptive — "+m.name;
 return m.number===0?"Legacy Default — "+m.name:"Exp "+m.number+".0 — "+m.name+" · "+m.difficulty;
}
export function modeDisplayLabel(m){
 if(m.kind==="split")return m.name;
 if(m.id==="adaptive")return "Adaptive · "+m.name;
 return m.number===0?"Legacy Default · "+m.name:"Experimental "+m.number+".0 · "+m.name;
}
