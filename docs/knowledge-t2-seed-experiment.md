# T2-seeded Knowledge rotation experiment

This is a **research baseline**, not an optimal board or a guaranteed fastest EXP/hr strategy. The scenario is deliberately independent of the user's imported board.

## Setup

- Board: 8 rows × 15 columns, with **100 contiguous unlocked slots** (indices 0–99).
- Permanent T64: **index 99, R7C10**, last unlocked slot.
- Other unlocked slots: **99 copies of T2** (no T1 and no other starting ingredients).
- East Wind trigger tier: **T58**; cascade cap: **25 additional Sushi upgrades per triggering merge**.
- Every merge follows `simulateMerge` from `src/optimizer-core.mjs`; only two equal tiers can be merged, with T64+T64→T64.
- T64 is retained, not used as an ingredient for upgrading the T2 seed.

## Single fill: no new cooks

A reproducible deterministic **greedy merge-only** baseline performs **90 legal merges**, leaving **9** working-area Sushi, with the highest at **T20**. The original T64 remains in R7C10. The candidate trace is verified against `validateComboReplay` (no teleporting, overwrites, or deletion). **T20 is not a proven optimum.**

More importantly, **T58 is mathematically impossible with only these initial 99 T2 and no refills** under the 25-upgrade cascade limit, even with unlimited legal repositioning:

1. Exclude the untouched T64. The initial sum of the other Sushi tier numbers is `99 × 2 = 198`.
2. A merge of T`t`+T`t` changes that sum by `1 − t + w`, where `w` is the number of East Wind upgrades. Always `w ≤ 25`.
3. Since every Sushi starts at T2 and the rules never create T1, the sum never increases: the descending wind chain has at most `t−1` upgrades.
4. Whenever the working-area maximum first reaches a new tier `k`, a T`k−1` merge must occur. For `k = 28…58`, its sum loss is at least `k−27`.
5. Those necessary losses total `1 + 2 + … + 31 = 496`. Reaching T58 must leave a working-area sum of at least 58. Thus the initial sum would have to be **at least 554**, equivalent to **at least 277 T2 ingredients**. This is a necessary lower bound, not a recipe.

**Conclusion:** Refill cycles are mandatory for a T2-seeded route toward T58 on a 100-slot board.

## Repeated refill baseline

A second experiment uses `simulateContinuousKnowledgeRotation` on this same imported-style starting board, with:
- T2 as the **only cooked tier** during refill waves (`pattern: "uniform"`).
- At most **12 refill waves**, **3,600** replay actions, T58 East Wind limit, 25 upgrades per cascade.
- Legal merging, parking surviving Sushi in empty top slots, and cooking into empty cells only.
- No starting bonuses, random cooking procs, or unverified removals.

Result (verified in GitHub Actions on 2026-11-14):

| Measure | Result |
|---|---:|
| Highest working-area Sushi tier | **T32** |
| Refill waves | 12 |
| New T2 Sushi cooked during refills | 1,062 |
| Manual merges | 1,150 |
| East Wind automatic tier upgrades | 7,717 |
| Working-area Sushi remaining at preview end | 11 |
| Original T64 | Preserved |

**T58 was not reached within this bounded heuristic preview**. This neither proves T58 impossible *with additional refills* nor claims T32 is optimal for 12 refills. Better long-horizon staircase preparation and leftover parking search are required.

## Automated reproduction

See `tests/knowledge-t2-seed-experiment.test.mjs`, run with:

```sh
node --test tests/knowledge-t2-seed-experiment.test.mjs
```

The test checks the full initial board, validates the one-fill merge replay, enforces the no-refill lower bound, and runs the 12-refill simulation while preserving the T64 and forbidding Sushi deletion.


## Staircase-recycling improvement (2026-11-14)

The earlier 12-refill test used simple survivor parking. We added a second
search policy that **repositions the surviving Sushi in a sorted staircase**
between refills using only `simulateRelocation` and vacant unlocked cells.
Every displacement uses a temporary empty cell; the T64 anchor stays fixed
and the resulting merge/cascade sequence is validated action by action.

An identical 12-refill benchmark (`tests/knowledge-staircase-packing.test.mjs`)
now compares all three strategies:

| Survivor arrangement | Highest new tier | Manual merges | East Wind upgrades | Sushi relocations |
|---|---:|---:|---:|---:|
| Original parking | T32 | 1,150 | 7,717 | 96 |
| Ascending staircase (low → high) | T37 | 1,090 | 8,446 | 207 |
| Descending staircase (high → low) | **T38** | 1,097 | **8,751** | 174 |

These are **deterministic simulated outcomes**, not global optima.
An improved tier and more Wind events do not automatically mean a higher
EXP/hr because rearrangements cost player time. The account-aware optimizer
therefore evaluates all three policies against its estimated EXP/hr scoring,
including the extra move time and the Lithium-versus-Fuel trade-off.
Focused mode retains its target-tier parking strategy.

The solver's displayed “Highest tier produced” intentionally **excludes any
T64 already present in the imported starting board**. Otherwise the existing
anchor would make all candidate strategies appear to reach T64 immediately.

The remaining objective is to improve the planned descending staircase,
shorten the number of manual moves, and extend multi-refill search beyond
the current T38 benchmark toward T58 without assuming free Sushi deletion.
