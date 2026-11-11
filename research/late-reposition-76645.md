# Experiment 13.0 follow-up: 76,645 points with late repositioning

**Status:** Independently validated by the repository's `validateComboReplay` simulator; **not** game-confirmed. **Not Experiment 14.0**, whose minimum remains 80,000.

## Result

| | Experiment 13.0 | Reposition candidate |
|---|---:|---:|
| Simulated Combo Meter score | 76,532 | **76,645** |
| Merges | 93 | 95 |
| East Wind upgrades | 1,925 | 1,925 |
| Reposition actions | 0 | 3 |
| Occupied initial cells | 100 | 100 |
| Protected initial Tier 64 | 1 | 1 |
| Maximum East Wind upgrades per merge | 25 | 25 |

The improvement is **113 points** from two additional merges, not from claiming an impossible extra Wind trigger.

### Exact construction

Keep **the same starting board as Experiment 13.0**. Follow the original first **75** merge actions. Before the original next merge, perform these relocations using *1-based* cell numbers relative to the 100-slot prepared area:

1. Move the Tier 57 sushi from cell **81** to the vacant cell **2**.
2. Move the Tier 56 sushi from cell **85** to cell **81** (now vacant).
3. Move the sushi from cell **2** to cell **85** (now vacant).

Then follow the explicit 20-merge suffix encoded in `src/experimental13-reposition-research.mjs`. That module generates the complete original prefix, performs all three moves using `simulateRelocation`, performs the suffix using `simulateMerge`, and independently checks all 98 actions using `validateComboReplay`.

Tests: `tests/experimental13-reposition-research.test.mjs`, including board offsets 0 and 20, exact score/merges/reposition counts, Wind limit, and rejection by the 80,000-point Experiment 14.0 certification gate.

### Search performed in this research pass

- Reproduced the **76,532** result and the **93-merge** baseline in an independent compiled implementation of the repository's merge rules.
- Tried a complete single-deviation alternative-merge check against the original greedy suffix (**4,399** alternative merge continuations); none improved the baseline.
- Sampled **30,000** stochastic board modifications; no new record.
- Tested **39,375** coordinated parameter variations across the three descending staircase sections; none exceeded 76,532.
- Tested single legal relocations and temporary-space swaps at selected points, finding the **76,645** result at the start of action 76.
- After that improvement, retested **57,306** local candidate continuations near the late-game phase without finding a further increase.
- Tested pairs of swaps and 3-cycles around the later merge boundaries, with no additional validated improvement.

This does **not** establish an upper bound or prove that 80,000 cannot be reached. A further breakthrough likely requires a stronger multi-action planner (for example, deliberately reorganizing a complete portion of the Wind chain) or a different preparation family, rather than one-tile tweaks.

## Research rules

The preset list remains unchanged. Only name an Experiment 14.0 after a complete **80,000+** replay is validated. The next thresholds are 85,000 for Experiment 15.0, 90,000 for 16.0, then increase by 5,000 points. Any claimed score is subject to the in-game Combo timer and player execution conditions.
