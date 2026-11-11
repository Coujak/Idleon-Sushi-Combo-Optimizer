# From fixed experiments to an adaptive Combo Meter planner

## What the earlier experiments actually established

The historical numbers below are **replay-validated simulator benchmarks at exactly 100 contiguous slots, one protected Tier 64, Wind cap T58 and 25 Wind upgrades per merge**. They are not optimality proofs, game-confirmed scores, or promises for future tier ranges.

| Experiments | Historical scores | Supply-to-engine boundary (1-based first engine) | Structural discovery |
|---|---|---:|---|
| 1 | 51,608 | Original layered/tuned examples | One descending staircase plus extra same-tier reserves can activate East Wind repeatedly |
| 2–5 | 56,315 → 60,572 | 31 | Move away from uniform tails; deepen the replenishment floor from T23 through T21, T18 and T12; preserve high tiers as merge supplies |
| 6–8 | 64,017 → 68,415 | 34 then 32 | Keep a third Wind wave alive by shifting where reserve blocks start and how low they descend |
| 9 | 70,071 | 30 | Three-stage timing: distribute more of the available slots to repeatable descending engines rather than filling the board with redundant high-tier supply |
| 10 | 73,367 | 27 | Rebalance high-tier supplies and cascade boundaries so late Wind waves retain useful triggers |
| 11 | 75,047 | 25 | Cut the fixed supply prefix to 24 tiles (including T64), giving 76 tiles to multiple descending engine stages |
| 12 | 75,546 | 25 | Same broad three-stage organization, with bounded merge-order lookahead gaining points over a greedy replay |
| 13 | 76,532 | 25 | Rebalance repeated trigger tiers in the supply section and the 3-stage engine; 1,925 Wind upgrades across 93 merges |
| 13 follow-up (not a numbered experiment) | 76,645 | 25 | A legal three-relocation late-game adjustment enables two additional merges, improving the same preparation by 113 points |

**Causality warning:** The scores changed alongside many sushi positions, not just one parameter. The table identifies common design features; it does *not* establish that any individual change accounts for the full improvement.

### Strategy primitives (portable beyond T64)

1. **Supply / tools** — A higher-to-lower tier prefix stores the ingredients for future merge triggers. Repeated trigger tiers can be more useful than a smooth descending reserve.
2. **Wind engine** — A fixed descending staircase beginning after the supply prefix upgrades many sushi with each qualifying merge. Row boundaries do not end Wind chains; *locked gaps do*.
3. **Stage reuse** — Position the next staircase so a chain or leftover trigger can activate a second or third wave. The number of stages depends on actual unlocked slots and the 25-upgrade maximum.
4. **Working-tier choice** — Highest unlocked tier is a *ceiling*, not necessarily the right tier for every engine. Compare shorter and lower working ranges under the player's real Wind cap.
5. **Merge-order and relocation search** — The prepared board does not determine its score by itself. Greedy moves, bounded lookahead, staircase reuse and legal relocations can produce different scores from the same board.
6. **Replay validation** — Every score shown must come from a legal sequence with the correct tier ceiling, Wind setting, per-merge upgrade limit and occupied/unlocked slots. An estimated future-tier score must never inherit a historic experiment benchmark.

## First adaptive implementation

`src/adaptive-combo-strategies.mjs` derives two complementary candidate families:

- **Transformed historical shapes**: relative tier offsets from Experiments 2–13, tested at several lower working ceilings. Available for 100 contiguous slots and a 25-upgrade Wind limit, with historical labels used as *structural references only*. The original exact T64 benchmark boards remain separately available and unchanged.
- **Procedural staged reserves**: design supply and one/two/three descending Wind stages according to actual slot count, selected tier, Wind cap, and chain limit. Explore multiple supply/engine splits and base tiers. This works for lower-tier progression and shorter contiguous boards.

The general Combo Planner now includes these candidate families for ordinary runs, not just for selecting an Experiment. It evaluates the simulated scores and independently validates the winner. For partial/non-contiguous layouts, the previous generic candidates remain available. Imported T64 can be kept as a protected anchor when it truly exists, even while preparing lower *other* tiers.

### Known limitations and follow-up investigations

- **Not globally optimal.** Pattern transfer and procedural construction widen the candidate search, but are heuristics.
- **Non-contiguous layouts:** the new staged engine deliberately requires contiguous slots. Generic candidates still handle gaps; a future approach could derive multiple independent contiguous segments and coordinate them.
- **Working tier vs Wind cap:** the selected Wind setting is used for all candidates; the planner does not pretend it can change a game-determined Wind cap independently of the active board's max tier.
- **Supply shape:** shifted historical patterns are an initial family; their best relative offsets and number of repeated triggers need independent measurement at each progression state.
- **Final move order:** current code compares candidate scores using greedy/staircase phases, then refines only the winning board. This may miss a strong setup with a weak greedy first pass. A multi-finalist lookahead and beam search would be the next useful improvement.
- **Buildability:** every preparation must obey the available tier and unlocked slots. The simulator validates *merge execution*, not ingredient acquisition speed or real-game timing, and future-tier releases could change the rules.
- **Research milestones remain separate:** there is no Experiment 14.0 until a full 80,000+ sequence is verified. This adaptive refactor does not change the 76,532 historical Experiment 13 benchmark or the 76,645 research-only follow-up.

