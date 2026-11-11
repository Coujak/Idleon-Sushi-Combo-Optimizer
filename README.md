# Idleon Sushi Station Lab

Browser-based Sushi Station account dashboard, reference guides and Combo Meter optimizer for Legends of Idleon.

**Site:** https://coujak.github.io/Idleon-Sushi-Combo-Optimizer/


## Combo Meter progressive search (beta)

The Combo Meter planner is a **heuristic** search tool, not a guarantee of the highest mathematically possible score. Its recommended board and merge sequence are checked against the local simulator. In-game execution, combo timing and game effects can still differ.

- **Simple** offers a quick baseline; **Fast / Mid / Slow / Max** examine progressively finer supply/engine ratios. **Custom** lets you choose the split increment, **boards per unique split**, and an optional score to stop at (0 means no score target).
- **Two concurrent browser workers** independently evaluate supply-heavy and engine-heavy candidates. The neutral 50/50 configurations are divided between them. Different progress speeds are normal. Long runs can be canceled, or stopped while retaining the best validated result.
- **Progressive local research** remembers exactly which prepared boards were evaluated and the best replay-validated result for matching settings. Repeated runs generate unseen variations where possible. Research is saved in the current browser only; it is **not shared between users** and is not a guarantee of improvement every time.
- Use **View saved best**, **Export research**, **Import research JSON** or **Clear local history** to manage this data. Research exports contain board configurations, search settings and replay results—not imported account JSON.
- The recommended board marks correctly placed sushi with a green checkmark. The replay includes FROM/TO indicators, next-Wind navigation, a step list, playback controls and text export.

**Before relying on a long research result:** Import a current game save, confirm your unlocked plate layout and maximum sushi tier, and check the suggested preparation and timing. The release remains beta until cross-browser and full regression testing are complete.


## Sections (v1.10.0)
- **Overview:** Import your game save JSON above the dashboard; view shaker counters with game artwork and their per-day refill rates (base + Shakin’ It Research), missing Perfectos and undiscovered tiers with renamed sushi icons, account statistics and the original board. Dashboard shortcut buttons and Perfecto progress tally have been removed.
- **Planners:** The Combo Meter optimizer supports Simple, Fast, Mid, Slow, Max and Custom research settings, plus repeat-run local research history and guided replay. The Perfecto Planner automatically chooses the lowest discovered sushi tier missing Perfecto, or accepts a manual target. It preserves higher-tier sushi and now **chooses its own recommended final board**: it searches several realistically buildable, tier-costed ingredient recipes and applies valid 2→1 merges plus Heat of the East Wind cascades, rather than painting 99 imaginary copies. Fuel affordability is an internal constraint on directly cooked starting tiers, while users are free to prepare higher tiers through merges. No user-facing preparation horizon, cooking pace, strategy, fuel settings, or target-copy slider. Shows the best target-copy count found, independent-roll estimated Perfecto chance as a percentage and **1 in X**, expected Pepper attempts and confidence milestones, and Tier 50/54 Knowledge bonuses. The fixed recipe complexity bound prevents unbounded hypothetical production; this heuristic does not prove a global optimum and excludes Salt and random cooking-tier bonuses.
- **Upgrades:** An illustrated 46-entry catalog with account-calculated bonuses, expanded descriptions, filters, sorting, next-level total-effect hints and highlighted Menagerie Doublers using a transparent \`assets/upgrade_doubler.png\` icon. Upgrade-price estimates now apply known Wholesale Pricing, Sushi discovery, Knowledge and Jelly Operator discounts, with a per-upgrade breakdown, explicit partial-data labels, and centered, color-coded current Bucks / next-cost affordability feedback, plus a Hide maxed upgrades toggle. Assigned Sushi Doublers come from Spelunk[52]; availability uses an exact supplied Menagerie summary or a clearly labeled minimum from Menagerie[3][10]. Includes separate progression and Doubler advisors.
- **Knowledge:** 64 sushi tiers, names, knowledge levels, EXP progress, known bonus categories and Perfecto states. Tiers without category metadata are explicitly marked unavailable rather than assigned fictitious effects.

The advisors are informational and never modify the imported save. Price estimates use account discounts when their source data is available. Reference metadata is derived from the public Sushi Station game rules, and can change as the game updates.

## Personalized Progression Advisor (v1.16.3)

The **Upgrades → Progression Advisor** uses imported Sushi Bucks, upgrade levels, assigned Doublers and discounted next upgrade costs to recommend the next purchase for the selected goal. The featured upgrade shows its current → next level, estimated price, Bucks shortfall, next raw effect, and a ranking rationale. Priority is a transparent heuristic, not mathematically proven ROI across unrelated upgrade types.

The **Next purchases plan** supports **5 / 10 / 25 / 50 / 100**, plus a custom **1–500** purchase count. It is sequential: after every purchase it updates the planned upgrade's level, recomputes the remaining Bucks, reprices upgrades and reranks recommendations. The same upgrade can appear multiple times. Once starting Bucks are exhausted, the plan assumes saving only the additional amount needed before each next purchase; **it does not forecast future earnings or time to purchase**. Reimport after real purchases.

The **Cards / List** toggle switches between visual and compact purchase results. Each step shows the selected goal's **before → after** result, and the summary compares the imported account with the end of the plan. Fuel generation/hr, fuel capacity and discounts use modeled known effects; Bucks generation/hr also incorporates known per-tier production, board bonuses, Combo and Knowledge factors. Incomplete external bonuses mean these figures are estimates rather than exact in-game totals. Knowledge EXP and Perfecto goals display partial, clearly labeled metrics when a full goal-wide total is not available.

An optional expandable **in-game readings** section accepts rates such as `2.5T` or `1.23E30` for Bucks/hr, Fuel/hr and maximum Fuel. The selected goal's current value is anchored to that reading, while future purchase effects are scaled from supported game formulas. No player's personal readings are embedded in the website or persisted to GitHub; they live only in browser form state until the page is closed or refreshed.


## Perfecto Pepper plan (v1.15.7)

The Perfecto Planner gives an explicit **Save Pepper — prepare the board first** or **Use Pepper now — one activation at a time** decision. Stockpiling Pepper does not change the odds of an individual activation: the quantity of target sushi on the board does. After building the recommended board, use Pepper individually and stop after the first successful Perfecto; the planner shows estimated cumulative odds across the number of activations currently available. "Current Board Chances" compares the current imported target-sushi copies with the optimized board's per-use chance. Confidence milestones are optional details, not a minimum stockpile target. Existing higher-tier sushi are automatically protected, without a manual checkbox. Salt-use information is omitted from the Pepper plan.

The Combo Meter replay also makes moving sushi slightly transparent while it is picked up, dragged across the board, and dropped into the destination.

## Combo Meter interactive replay (v1.15.6)

The interactive step viewer now animates the source sushi, including its artwork and tier, from the picked tile to the destination. Before the slide completes, the board remains in its pre-action state; once the sushi reaches the destination, the merge result and staggered Heat of the East Wind upgrades appear. The same behavior applies to manual Next/Previous navigation and automatic Play. Changing speed, switching steps or hiding the window avoids leaving obsolete moving tiles behind. The replay animation does not alter the optimized move list or computed Combo Meter score.

## Perfecto final-board preparation (v1.15.5)

For a certified merge-only target board, the remaining unoccupied positions are **temporary construction workspace**, not permanently empty cells. Complete target copies first, then use the released workspace to build the supporting sushi **highest tier first**. Fill leftover positions with the highest descending ladder supported by the account's Heat of the East Wind cap, the target tier, and the space needed to recursively cook/merge the ingredients.

For example, with **100 unlocked slots**, **one protected Tier 64**, **82 Tier 62 target copies**, and **Tier 45** as the highest directly affordable source, a fully regular board puts **T58, T57, ..., T42** (one each) in positions **1–17**, **82 Tier 62** copies in positions **18–99**, and the protected **T64** at position **100**. The Perfecto preview now uses the same full-tile Regular (green), Hot (red), Cold (blue), and Milktoast (gold) colors as Overview. Target, protected and ingredient status is shown by subtle inner outlines rather than replacing those plate colors. On a mixed-plate board, final positions are rearranged so **higher-tier sushi always have priority on Hot, Cold, and Milktoast plates**: Tier 64 comes first, then Tier 62, and only then the highest available support tiers. This preserves the entire sushi inventory, though existing higher-tier sushi may need to be relocated to a special plate after construction. Each supporting ingredient can be made without moving the already completed targets: the required working-space depth decreases along with the available slots. The unbroken descending ladder uses **T47**, not a duplicate T48. It does **not** increase immediate Pepper Perfecto odds; it makes use of otherwise wasted slots and leaves a useful future merge supply. The solver still has no preparation-time cap or manual target-copy input, and 82 copies are a constructive lower bound rather than a global optimum proof.

## Game artwork and naming

See [`assets/README.md`](assets/README.md) for the complete artwork inventory and links to each folder.

- **Upgrades (46/46):** `Upgrade Name (Upgrade X).png`, where X is the **1-based shop list position**, not the internal ID saved in `Sushi[2]`.
- **Sushi (64/64):** `Sushi Name (Tier X).png`, where X is the displayed tier (1–64).
- **Shakers:** Copies of the Salt, Pepper and Saffron icons under `assets/shakers/`.
- **Campfires:** Five renamed fireplace images using `Upgrade Name (Upgrade X).png`, matching the Upgrades folder; the board now loads their new paths.

The `sushiUpgradeIconPath(id)` and `sushiTierIconPath(tier)` helpers resolve renamed assets without confusing internal IDs, shop position, or displayed tiers.

## Easier Experimental preparations (v1.10.4)

The single-use merge-supply sushi now appear in **descending tier order**, making the 100-slot boards faster to arrange manually. The protected Tier 64 stays first. The trigger anchors and all downstream Wind chains retain their original positions.

Exp 1's layered and tuned preparations already have a descending high-tier supply. For Experiments 2–13, the safe supply-only prefixes end at the following positions (1-based, relative to the start of the prepared layout):

| Experiment | High-to-low supply cells | First fixed engine/trigger cell |
| --- | --- | --- |
| Exp 2 | 2–30 | 31 |
| Exp 3 | 2–30 | 31 |
| Exp 4 | 2–30 | 31 |
| Exp 5 | 2–30 | 31 |
| Exp 6 | 2–33 | 34 |
| Exp 7 | 2–31 | 32 |
| Exp 8 | 2–31 | 32 |
| Exp 9 | 2–29 | 30 |
| Exp 10 | 2–26 | 27 |
| Exp 11 | 2–24 | 25 |
| Exp 12 | 2–24 | 25 |
| Exp 13 | 2–24 | 25 |

This is a preparation convenience change, not a new scoring strategy. Historical research still uses Tier 64, Wind 58, 25 chain targets and 100 unlocked slots.

## Features
- Load game save JSON locally (your save is processed in your browser).
- Reconstruct the complete **8×15 board (120 positions)**, supporting **up to 100 unlocked slots in any positions**, with plate types, fireplaces and Perfecto indicators.
- Compare prepared layouts; edit individual sushi tiers using the custom board editor.
- Choose **Balanced Planner** (Default) or one of thirteen named Experimental strategies, from **Wind Foundations** to **Cascade Resonance**. The interface labels their estimated manual execution difficulty and simulated benchmark. Original strategy IDs and algorithms remain unchanged.
- **Maximum prepared tier has no fixed 64-tier ceiling**: enter 65, 100, or higher for future-update simulation. Wind automatically follows **prepared tier − 6** when already maxed (e.g., 64 → 58, 66 → 60), but lower manual Wind selections are preserved. Tiers above the available art assets appear as numbers.
- Recommended preparations preserve the configured highest tier at the first unlocked position (Tier 64 for historical benchmarks, higher when configured). Imported and custom boards keep their own positions, including bottom-row slots.
- Simulate Heat of the East Wind and search using greedy, beam, staircase-recycling, and tactical repositioning strategies.
- Replay combo sequences at **0.5×**, 0.75×, 1× (default), 1.5×, 2×, or 3× speed. Every merge or relocation animates the picked sushi traveling into its destination first, then updates the board and plays any Heat of the East Wind cascade. Movement, Wind, and autoplay timing all scale with speed. Seeking, resizing, and hiding the tab handle unfinished animations safely; reduced-motion users see the completed board immediately.
- Deliberately reuse descending staircases across scoring passes. Search several spare-sushi Wind-tail lengths and test one-tile tactical repositioning before merges on irregular boards. The replay distinguishes zero-point relocations from merges.
- Enter action times to estimate combo-time feasibility. **Only merges reset the combo timer** in the timing estimate.
- Follow each merge or relocation in a larger replay board with highlighted actions, dimmed inactive tiles, and a staggered East Wind animation.

## Adaptive Combo Meter strategy planner (v1.17.0)

**The Combo Planner now starts in Simple Cascade mode.** It no longer assumes that a player has reached the T64/T58 research configuration or has 100 contiguous unlocked slots. From an imported Idleon Toolbox game save it reads the **highest discovered Sushi tier** using Sushi discovery flags (rather than just the highest currently on the board), plus the player's unlocked plates. The maximum Wind tier is derived from the selected prepared tier, and the player's chosen Wind limit is respected.

Adaptive mode compares reusable **supply + Wind engine** strategy families rather than claiming every account can reproduce a fixed historical score. These include transformed 100-slot board shapes from Experiments 2–13 at several working tiers and procedural one-, two-, and three-wave boards that adapt their supply/engine split to shorter contiguous layouts. It tries lower working tiers alongside the player's available maximum, scores the actual legal merges and validates the winning replay. No score is copied from a T64 record.

**Historical experiments remain unchanged and selectable separately.** Experiment 1–13 modes retain their original T64 benchmark score labels. Legacy Default and the earlier Adaptive mode also remain available. For the new transparent split comparison use Simple, Fast, Mid, Slow, or Max.

Read [Combo strategy audit](research/combo-strategy-audit.md) for the experiment-by-experiment structural findings and known limitations. This is a first strategy-family implementation, **not a global optimization guarantee**. Notably, noncontiguous layouts still need stronger support, and merge-order refinement currently focuses on the highest-scoring initial candidate.

## Five Combo Meter search resolutions and two-direction progress (v1.17.2)

The search selection now offers **Simple Cascade**, **Optimizer 1 (Fast)**, **Optimizer 2 (Mid)**, **Optimizer 3 (Slow)**, and **Optimizer 4 (Max)**. These are **five choices**: Simple plus four increasingly fine split optimizers. They work with the current prepared-tier limit, Wind cap and available unlocked plate positions. A candidate board is scored by the actual merge model and the selected result is independently replay-verified; the optimizer's best-found score is **not** a globally proven optimum.

* **Simple:** One top-to-bottom descending cascade preparation. A single progress bar tracks completion.
* **Fast (20-point):** Supply-heavy 50/50 → 70/30 → 90/10; engine-heavy 50/50 → 30/70 → 10/90.
* **Mid (10-point):** Supply-heavy 50/50 → 90/10 and engine-heavy 50/50 → 10/90, in increments of ten.
* **Slow (5-point):** Supply-heavy 50/50 → 95/5 and engine-heavy 50/50 → 5/95, in increments of five.
* **Max (1-point):** Supply-heavy 50/50 → 99/1 and engine-heavy 50/50 → 1/99, in single-point increments.

**Current behavior:** The neutral 50/50 configurations are divided between supply-heavy and engine-heavy workers instead of being double-counted. The two progress bars update independently, and searches retain completed board evaluations in browser history. Split modes currently generate up to 50 distinct candidates per unique ratio, while Custom uses the user-selected per-ratio budget. The preceding historical description of search-resolution steps refers to the initial implementation; current totals can vary by slot arrangement and previously checked boards. Editing a specific Custom board uses the separate single-board search.

The supply/engine border in the recommended prepared board corresponds to **the actual winning split**, not just the selected mode. Existing Experiments 1–13 remain historical reference boards, not new scores promised at arbitrary player tiers.

## Combo Meter milestone research (after Experiment 13.0)

The next planned showcase targets are **Experiment 14.0 ≥ 80,000**, **15.0 ≥ 85,000**, **16.0 ≥ 90,000**, then increments of **5,000 points**. The numbers describe verified *score floors*, not algorithm versions. These are proposals until the game-mechanics replay passes the threshold; no unsupported benchmark may be published as a new experiment.

The existing Experiment 13.0 remains the verified simulation benchmark: **76,532 points**, 93 merges, 1,925 Wind upgrades, one protected T64, and 100 contiguous slots.

**New research-only improvement:** A late three-step relocation followed by 20 explicit merges has now reached **76,645 simulation-validated points** from that same starting board (95 merges, 1,925 Wind upgrades, 3 relocations). It does not meet the 80,000 milestone and has not been assigned a new experiment number. The independently tested sequence and research findings are preserved in [Late repositioning 76,645](research/late-reposition-76645.md), with a reproducible simulator implementation in `src/experimental13-reposition-research.mjs` and regression tests. Early research changed individual supply sushi, tested 3,375 three-section start-tier combinations, explored coordinated stage/reserve adjustments, and tried thousands of short supply setup sequences and stochastic variations. **No ≥80,000 candidate has yet passed replay validation**, so Experiment 14.0 has deliberately **not** been inserted into the UI or presented as solved.

The reproducible offline research runner can search the model and only save candidates that pass full replay verification:

```sh
node scripts/search-combo-milestones.mjs --trials=2000 --seed=421
```

Once a qualifying board and sequence are found, the runner writes a research candidate to `research/verified-milestones/`. Review the result and buildability before adding it to the displayed experiment list. A validated model replay cannot guarantee an actual player's score, because the game has a Combo timer and can have additional random effects; the player must complete the full action sequence in time.

The proposed future rename is a **Combo Meter score showcase / certified score boards** interface, rather than an optimization claim. Existing experiment names are retained until the milestones are confirmed and the UI can be renamed consistently.

## Verified model regression

The test suite reconstructs the tier layout implied by the user's 52-step video breakdown (22 descending Tier 30…9 sushi followed by 30 Tier 8 sushi). It validates **all 50 scoring merges**, not just the final score:

| Model sequence | Predicted score |
| --- | ---: |
| Original approach, two relocations | **6,544** |
| Relocate an extra Tier 8, Wind limit ≥33 | **7,069** |
| Relocate an extra Tier 8, Wind limit 32 | **7,036** |

The 7,069 sequence adds 9+10+…+33 = **525** points from the same spare sushi. The exact board reconstruction and predicted improvement remain **simulation-derived**, not independently validated against a 7,069-point in-game run.

## Legal 100-slot full-upgrade benchmark

There are **120 physical grid positions (8 rows × 15 columns)** but only
**100 unlockable slots**. The unlocked slots may be at the top, bottom, or
split across rows. The original 105-unlocked-slot simulations remain invalid,
including the previously reported **53,481** score. Positions 101–120 are
valid when those slots are unlocked in the imported save or when plates are
rearranged into a valid layout.

For all benchmarks: 100 contiguous unlocked slots, tier 64, Wind cap 58, chain limit 25. Difficulty is a subjective estimate of manual preparation and replay complexity, not an official game rating or optimizer runtime.

| Mode | Strategy name | Difficulty | Simulated points |
| --- | --- | --- | ---: |
| Exp 1.0 | Wind Foundations | Advanced | 51,608 |
| Exp 2.0 | Reserve Tides | Advanced | 56,315 |
| Exp 3.0 | Layered Currents | Advanced | 57,328 |
| Exp 4.0 | Long Cascade | Expert | 58,684 |
| Exp 5.0 | Deep Reserves | Expert | 60,572 |
| Exp 6.0 | Third-Wave Engine | Expert | 64,017 |
| Exp 7.0 | Low-Tier Overdrive | Master | 65,542 |
| Exp 8.0 | Chaotic Reserves | Master | 68,415 |
| Exp 9.0 | Triple-Wave Surge | Master | 70,071 |
| Exp 10.0 | High-Tier Tempest | Grandmaster | 73,367 |
| Exp 11.0 | Perfect Storm | Grandmaster | 75,047 |
| Exp 12.0 | Wind Foresight | Grandmaster | 75,546 |
| Exp 13.0 | Cascade Resonance | Grandmaster | 76,532 |

Newer modes retain all earlier candidate preparations. The current 76,532-point record is replay-validated in the simulator, not in-game confirmed; 80,000 remains the research goal.

This is a heuristic result, not a proven maximum or independently verified
in-game achievement. Default mode remains the established strategy.

## Run tests

```sh
node --test tests/*.test.mjs
```

Tests cover prior benchmarks, full multi-wave replay, Wind limits, legal relocation, and autoplay control behavior.

## Notes
- The displayed highest sushi on the imported board is a **fallback**, not proof of the account's actual highest unlocked tier. If you unlocked a higher sushi tier, set *Maximum prepared tier* manually so the Wind cap (highest tier minus six) is accurate.
- Cancellation takes effect at the next search checkpoint (after an in-progress synchronous candidate or refinement stage).
- **Research stays fixed at maximum Tier 64, Wind cap 58, chain length 25, and 100 unlocked slots.** All current benchmark records and future record attempts use these settings. Higher tier scenarios are hypothetical previews of possible future sushi updates, not new record claims.
- The optimizer is a bounded search and does **not** guarantee a globally optimal score. Tactical search considers at most one relocation before each merge and uses a limited beam/depth on the best preparation; deeper strategies may be missed.
- The timing estimate does not model animation delays, network lag or player precision.
- Local JSON imports are never sent to a server by the site.
