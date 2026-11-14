# Idleon Sushi Station Lab

Browser-based Sushi Station account dashboard, reference guides and Combo Meter optimizer for Legends of Idleon.

**Site:** https://coujak.github.io/Idleon-Sushi-Combo-Optimizer/


## Account data import

Sushi Station Lab currently uses **local JSON import only**. Choose a file or paste exported game data in Overview. The imported save stays in browser memory; there is no active account-login or Firebase integration.

Early experiments for Steam/Firebase and Google device-code authentication are retained as **unconnected research modules** in `src/idleon-cloud-auth.mjs`, `src/idleon-cloud-ui.mjs`, and `src/google-device-flow.mjs` with unit tests. They are not loaded by the website and should not be treated as supported sign-in functionality. Revisit this only if an authorized account-login method becomes available.

## Combo Meter progressive search (beta)

The Combo Meter planner is a **heuristic** search tool, not a guarantee of the highest mathematically possible score. Its recommended board and merge sequence are checked against the local simulator. In-game execution, combo timing and game effects can still differ.

- **Simple** offers a quick baseline; **Fast / Mid / Slow / Max** examine progressively finer supply/engine ratios. **Custom** lets you choose the split increment, **boards per unique split**, and an optional score to stop at (0 means no score target).
- **Two concurrent browser workers** independently evaluate supply-heavy and engine-heavy candidates. The neutral 50/50 configurations are divided between them. Different progress speeds are normal. Long runs can be canceled, or stopped while retaining the best validated result.
- **Progressive local research** remembers exactly which prepared boards were evaluated and the best replay-validated result for matching settings. Repeated runs generate unseen variations where possible. Research is saved in the current browser only; it is **not shared between users** and is not a guarantee of improvement every time.
- Use **View saved best**, **Export research**, **Import research JSON** or **Clear local history** to manage this data. Research exports contain board configurations, search settings and replay results—not imported account JSON.
- The recommended board marks correctly placed sushi with a green checkmark. The replay includes FROM/TO indicators, next-Wind navigation, a step list, playback controls and text export.

**Before relying on a long research result:** Import a current game save, confirm your unlocked plate layout and maximum sushi tier, and check the suggested preparation and timing. The release remains beta until cross-browser and full regression testing are complete.


## Sections (v1.10.0)
- **Overview:** Import your save locally and see when it was imported. Eight balanced account stats include **Highest on board** (tier and copy count), **Highest Sushi Discovered** (tier / 64), and **Total Perfectos / 64**. Shaker cards put the daily refill pill beside the available-use count (base + Shakin’ It Research). Missing Perfectos and undiscovered tiers show their counts, a six-card preview and **Show all / Show fewer** controls. The original 8×15 board shows counts for each plate type; select any unlocked plate with a mouse, touch or keyboard to inspect its position, sushi name, tier, plate and Perfecto status. The Overview contains no planner shortcut buttons.
- **Planners:** The Combo Meter optimizer supports Simple, Fast, Mid, Slow, Max and Custom research settings, plus repeat-run local research history and guided replay. The Perfecto Planner automatically chooses the lowest discovered sushi tier missing Perfecto, or accepts a manual target. It preserves higher-tier sushi and now **chooses its own recommended final board**: it searches several realistically buildable, tier-costed ingredient recipes and applies valid 2→1 merges plus Heat of the East Wind cascades, rather than painting 99 imaginary copies. Fuel affordability is an internal constraint on directly cooked starting tiers, while users are free to prepare higher tiers through merges. No user-facing preparation horizon, cooking pace, strategy, fuel settings, or target-copy slider. Shows the best target-copy count found, independent-roll estimated Perfecto chance as a percentage and **1 in X**, expected Pepper attempts and confidence milestones, and Tier 50/54 Knowledge bonuses. The fixed recipe complexity bound prevents unbounded hypothetical production; this heuristic does not prove a global optimum and excludes Salt and random cooking-tier bonuses.
- **Upgrades:** An illustrated 46-entry catalog with account-calculated bonuses, expanded descriptions, filters, sorting, next-level total-effect hints and highlighted Menagerie Doublers using a transparent \`assets/upgrade_doubler.png\` icon. Upgrade-price estimates now apply known Wholesale Pricing, Sushi discovery, Knowledge and Jelly Operator discounts, with a per-upgrade breakdown, explicit partial-data labels, and centered, color-coded current Bucks / next-cost affordability feedback, plus a Hide maxed upgrades toggle. Assigned Sushi Doublers come from Spelunk[52]; availability uses an exact supplied Menagerie summary or a clearly labeled minimum from Menagerie[3][10]. Includes separate progression and Doubler advisors.
- **Knowledge:** 64 sushi tiers, names, knowledge levels, EXP progress, known bonus categories and Perfecto states. Tiers without category metadata are explicitly marked unavailable rather than assigned fictitious effects.
- **Knowledge EXP Optimizer (beta):** Designs independent 8×15 Sushi ingredient boards from the account's actual unlocked plates, unlocked cooking tier, Fuel capacity and generation, available East Wind mechanics and fireplace options. Preserves the actual highest Sushi at its current position, not a hypothetical deleted/moved copy. The proposed clean board may require legal manual consolidation of existing Sushi first; the tool warns explicitly because that transition is not yet simulated. **Focused** prepares and banks target Sushi (e.g., T58), then harvests target pairs into higher tiers only when saturated, earning EXP for the newly created tier. **Balanced** now ALSO starts with a complete board of the chosen starter tier, merges upward and then uses later paired refills to deliberately recover discovered Sushi tiers missing creation EXP; it ranks **actual tier coverage** ahead of raw volume or incidental East Wind cascades and lists still-uncovered tiers. A completed one-T64 consolidation no longer ends the whole multirefill preview. **Fuel-aware preparation:** the solver tests conservative starter tiers and tracks every actual cook's Fuel demand against the imported current Fuel balance, max capacity and projected regeneration; expensive T46 recipes that only fit the cap once no longer automatically win. The chosen first fill reports a Fuel budget and any estimated wait. Pink Lithium affects Knowledge creation EXP; **yellow Milktoast plates give passive EXP/day to their occupants**, not more active creation EXP. Focused can legally park target Sushi on Milktoast during preparation without falsely multiplying its creation reward. The walkthrough includes **Next refill**, **Next harvest**, and **Final step** controls, displaying the exact stop reason and simulated refill count instead of silently running out of steps. Search is bounded, browser-local and heuristic, not mathematically guaranteed optimal.

The advisors are informational and never modify the imported save. Price estimates use account discounts when their source data is available. Reference metadata is derived from the public Sushi Station game rules, and can change as the game updates.

## Account Dashboard: production and cooking chances

The Dashboard shows **modeled Bucks per hour**, **estimated Fuel generation per hour**, **estimated maximum Fuel capacity**, and cooking tier-up chance previews from the imported Sushi Station data. Rates can differ from Idleon Toolbox and the live game because the Bucks model still has unverified account-specific multipliers and some Fuel modifiers are not mapped.

The cooking chance preview combines Quality Freshness with known Sushi Knowledge bonuses. It displays the **modeled chance of at least +1** and **at least +2** tiers. Percentages above 100% are interpreted as rollover based on in-game observations (for example, 120% becomes guaranteed +1 and 20% at least +2). This rollover behavior is **not yet independently verified against game code**. The **Copper/blue fireplace** is a separate 1%-chance mechanic, not the source of that cooking rollover.

### Shared numeric formatting

Displayed quantities across the Dashboard, Combo Meter, Perfecto Planner, Upgrades and Knowledge stay as **comma-grouped numbers below 1 million** (such as `1,000`, `10,000`, or `999,999`). At **1,000,000**, displays switch to **M** (10^6), then **B** (10^9), **T** (10^12), **Q** (10^15), **QQ** (10^18), and **E21** or higher scientific notation. Input values and simulation arithmetic remain unchanged. Legacy inputs such as `1K` remain accepted where supported, even though the displayed value is `1,000`.

The Knowledge EXP table does not pass non-finite percentages to HTML progress bars. Extremely large or incomplete EXP requirements show as unavailable instead of interrupting a successful JSON import.

## Knowledge tab

The **Knowledge** section is a read-only account overview for all 64 Sushi tiers, derived from the locally imported Idleon Toolbox JSON:

- Overview counts: discovered tiers, Perfectos, known Knowledge levels and tiers with enough EXP for the next Knowledge level (where the save includes complete progress data).
- One compact toolbar with text search, a Knowledge-effect dropdown, status filters (including **Ready to level**) and sort controls; redundant category chips have been removed.
- Compact four-column Knowledge table: **Sushi tier** (with the permanent tier discovery reward directly under its name), **Knowledge level**, **EXP to next level** (value, progress bar and remaining EXP), and **Knowledge Bonus** (plain-text effect names and green numeric value pills, or purple pills for Perfecto, including projected next-level values). Permanent tier rewards also highlight only their numbers; all nonnumeric reward text remains plain. EXP progress bars use a brighter, thicker fill. Perfecto is indicated by the existing `assets/Perfecto_Symbol.png` over the Sushi icon, not a separate column. All 64 tier rewards come from the pinned reference in `src/sushi-tier-rewards.mjs`; unit-aware Knowledge effects are formatted by `src/knowledge-bonus-format.mjs`. Undiscovered tiers display their tier reward as a reference and a base Lv 1 preview without implying they are active.
- Current Knowledge level and EXP progress toward the next level. Search also matches words from permanent tier rewards.
- Missing EXP or level data is marked **unavailable**, not incorrectly treated as zero. A "Ready to level" label indicates a modeled threshold, **not that the game has automatically collected the level**.

The Knowledge tab remains a read-only progression tracker. In the Knowledge Planner, **Preserve existing passive-source Sushi** is unchecked by default and optional. The active recommendation is a preparation goal, not the imported board; no Sushi are silently removed to achieve it. Full-board Fuel safety uses a conservative planning allowance (up to one half of the maximum Fuel capacity, further bounded by the imported current balance) plus per-cook estimated regeneration. This explicitly avoids claiming that hundreds of expensive Tier 46 cooks can happen instantly just because one Tier 46 fits into the cap. **Only the first fill is certified against that buffer**; later rounds may still require regeneration waits and the projected finite-window EXP/hr is not a proven sustained value. Balanced tries to award active EXP to as many discovered tiers as possible, but higher tiers must still be made by legal merges or Wind; any tier with no verified creation in the preview is listed as uncovered. The simulated walkthrough can stop when the requested refill limit, an action limit, or genuine lack of legal moves is reached; its precise reason and final state remain visible. Passive Cold/Milktoast/Lithium setup is optional and separate from the active recipe.

## Personalized Progression Advisor

The **Upgrades → Progression Advisor** evaluates a one-level upgrade purchase against the selected goal's **before → after account model**, current Sushi Bucks, assigned Doublers and estimated discounted price. Within the chosen goal, measurable gains come before upgrades whose benefits cannot yet be quantified; affordability and estimated cost efficiency then guide the order. The featured next purchase, modeled gain and its confidence/limitations are shown separately from the raw upgrade effect. This is a transparent **partial model**, not a mathematically proven ROI ranking across unrelated effects.

- **Goal-specific metrics:** Bucks generation, Fuel generation/capacity, upgrade discounts, Knowledge EXP per created Sushi (including both 2nd and 3rd Degree Searing), and free Shaker-use chance. For Perfecto, Pepper Shaker access is a prerequisite unlock, **not +100 percentage points of free-use chance**. Other effects such as plate EXP, per-use Bucks and random outcomes may be unquantifiable in a passive-rate model.
- **Compare other upgrades:** filter/sort alternatives, optionally show maxed upgrades, and independently choose **3 / 5 / 10 / All** displayed alternatives. This does **not** change the purchase-plan calculation or next-purchase recommendation.
- **Next purchases plan:** **5 / 10 / 25 / 50 / 100**, or a custom **1–500**, with a compact single-column list by default and a Details toggle to reveal projected stat changes. Adjacent purchases of the same upgrade are grouped into a single level range with their combined cost and funding requirements; expanding the group shows every individual step, preserving the actual purchase order. Each row keeps costs, levels and affordability visible; secondary details are collapsible. The list is retained across imports and re-renders. After each simulated purchase the level, Bucks balance, prices and priority are recomputed; the same upgrade can appear repeatedly. When starting Bucks run out, the planner assumes saving just enough for a future purchase, without inventing passive income or a purchase time. A missing or malformed Bucks balance prevents a numeric purchase plan rather than being treated as zero.
- **Goal projections:** each purchase compares the current and subsequent modeled effects. Fuel, capacity, Bucks and discounts include known account bonuses where available; actual in-game totals may differ with unknown modifiers. Unsupported full totals are labeled partial.
- **Optional in-game baselines:** manually entered Bucks/hr, Fuel/hr and capacity anchor displayed totals to the player's own readings, with projected changes scaled by supported multipliers. These values stay in browser state and are not saved in the repository.

Reimport after actual purchases; recommendations never alter the imported game save.

## Perfecto Pepper plan (v1.15.7)

The Perfecto Planner gives an explicit **Save Pepper — prepare the board first** or **Use Pepper now — one activation at a time** decision. Stockpiling Pepper does not change the odds of an individual activation: the quantity of target sushi on the board does. After building the recommended board, use Pepper individually and stop after the first successful Perfecto; the planner shows estimated cumulative odds across the number of activations currently available. "Current Board Chances" compares the current imported target-sushi copies with the optimized board's per-use chance. Confidence milestones are optional details, not a minimum stockpile target. Existing higher-tier sushi are automatically protected, without a manual checkbox. Salt-use information is omitted from the Pepper plan.

The Perfecto Planner shows the account-specific board beside a hypothetical **T46 direct-cooking benchmark without Salt Shakers**. The benchmark uses the account's available Heat of the East Wind and retains its descending construction staircase; it does not rely on random Blue Campfire tier skips. Hover or click board positions to compare, or hide the benchmark.

The Perfecto Planner's **step-by-step construction** now tries a **recycled Heat of the East Wind staircase** before the older recursive walkthrough. This implements the in-game T45 example exactly: six legal merges build T49, T48, T47 and T46; those tiers move to the west; empty cells are refilled with T45; and the same staircase is progressively promoted again. The simulator records every cook, directional merge, Wind upgrade and legal relocation, including the game's 25-upgrade Wind limit. Once the account's Wind merge-tier limit is reached, the builder repeatedly harvests higher-tier sushi and combines them with ordinary merges to reach targets like T62 or T64. The replay adds a **Next refill cycle** shortcut, **Jump to biggest Wind cascade**, Previous, Next, Skip to final merges, Finish target and Show final board.

**In-place construction of the last target:** The walkthrough now uses exactly the supporting staircase positions **and the one adjacent newly built target sushi** on the recommended board. For example, the T45→T62 case reserves **18 contiguous unlocked cells**: 17 supporting cells occupied by T58 down to T45 plus three more T45 copies, followed by the T62 at position 18. These 18 cells are emptied at Step 0; all other recommended T62 and protected sushi remain in their final positions. Simulator-verified merges, cooking and relocations construct the final T62 in that same space, followed by rebuilding the supporting sushi, until the final frame matches the entire recommended board. There is **no separate second board or fictional extra workspace**. This begins from a hypothetical near-final prepared state, not from the imported save; earlier target copies are already assumed complete. Movement Mittens are needed for moves.

**Verified 18-slot recycled Wind construction:** Repeating the user's strategy of cooking T45, merging the highest equal-tier pair and repositioning the upgraded staircase can produce the last T62 **without exceeding the 18 contiguous cells on the recommended board**. A verified simulator trace then parks T62 in the final target position and rebuilds all 17 supporting sushi (T58 down to T45 plus three extra T45 copies) in that same workspace, leaving every other T62 and protected T64 untouched. The T45 case uses 120 T45 cooks and recycled merges for initial T62 production, followed by a simulator-certified long Wind cascade for restoring the supporting sushi; counts for the whole sequence are displayed in the UI. Unlike the earlier 38-slot teaching-board approach, this is an **in-place final board replay**. It is not guaranteed to be globally optimal in Fuel or movement count, but every displayed action and the final layout are verified. If this method cannot be verified for a given account, the compact certified method remains the fallback. A **Next tier milestone** shortcut skips repeated early merges, alongside Jump to biggest Wind cascade and Finish board. **Each merge counts as one numbered step** while Wind upgrades animate automatically without extra Next clicks. Previous/Start can interrupt the animation; reduced-motion settings are respected. The 38-cell technique remains independently tested as a possible *earlier board-preparation strategy*, but it is not presented as a legal construction of the last copy on this final 18-cell layout. Full-board preparation-cost estimates and copy counts still come from the compact certificate.

The optimizer continues to prefer a separate long Wind cascade for filling the optional supporting staircase when that is cheaper than individual support construction. Neither strategy assumes Salt Shakers or random tier skips, and neither claims global optimality.

**Merge-ready source-tier reserve:** The final supporting board does not descend below the player's confirmed directly cookable tier. For example, cooking **T40** and targeting **T62** with 100 unlocked cells and one protected T64 yields **77 T62 copies**, **T58 through T40**, and **three extra T40 sushi** (22 supporting cells in total). This reserves four directly cookable T40s for subsequent merges instead of wasting positions on T39, T38 and T37. The verified Wind cascade covers only the descending prefix; any additional source-tier copies are directly cooked after it. These optional support sushi do not increase the current Pepper chance.

The **Additional info · Perfecto chance Knowledge** section shows only the next combined T50/T54 Knowledge milestone, including its predicted Perfecto chance gain. Both tiers first advance to their nearest higher multiple of five; the optional info tooltip then lists subsequent milestones in smaller increments, advancing whichever tier needs fewer total levels relative to the imported save (e.g. T50 Lv32 / T54 Lv28 → 35/30 → 35/35 → 40/35 → 40/40). Equal-distance milestones advance together. The info icon opens on hover, keyboard focus, or tap/click. Existing Perfecto multipliers are retained; target copies are fixed; these are hypothetical gains, not a Knowledge EXP forecast or a change to the save.

The Combo Meter replay also makes moving sushi slightly transparent while it is picked up, dragged across the board, and dropped into the destination.

## Combo Meter interactive replay (v1.15.6)

The interactive step viewer now animates the source sushi, including its artwork and tier, from the picked tile to the destination. Before the slide completes, the board remains in its pre-action state; once the sushi reaches the destination, the merge result and staggered Heat of the East Wind upgrades appear. The same behavior applies to manual Next/Previous navigation and automatic Play. Changing speed, switching steps or hiding the window avoids leaving obsolete moving tiles behind. The replay animation does not alter the optimized move list or computed Combo Meter score.

## Perfecto final-board preparation (v1.15.5)

For a certified merge-only target board, the remaining unoccupied positions are **temporary construction workspace**, not permanently empty cells. Complete target copies first, then use the released workspace to build the supporting sushi **highest tier first**. Fill leftover positions with the highest descending ladder supported by the account's Heat of the East Wind cap, the target tier, and the space needed to recursively cook/merge the ingredients.

For example, with **100 unlocked slots**, **one protected Tier 64**, **82 Tier 62 target copies**, and **Tier 45** as the highest directly affordable source, a fully regular board puts **T58, T57, ..., T45** (one each), followed by **three extra T45s**, in positions **1–17**, **82 Tier 62** copies in positions **18–99**, and the protected **T64** at position **100**. The Perfecto preview now uses the same full-tile Regular (green), Hot (red), Cold (blue), and Milktoast (gold) colors as Overview. Target, protected and ingredient status is shown by subtle inner outlines rather than replacing those plate colors. On a mixed-plate board, final positions are rearranged so **higher-tier sushi always have priority on Hot, Cold, and Milktoast plates**: Tier 64 comes first, then Tier 62, and only then the highest available support tiers. This preserves the entire sushi inventory, though existing higher-tier sushi may need to be relocated to a special plate after construction. Each supporting ingredient can be made without moving the already completed targets: the required working-space depth decreases along with the available slots. The strictly descending portion includes **T47** once. Below the directly cookable tier the remaining positions instead hold spare source-tier sushi for later merges. It does **not** increase immediate Pepper Perfecto odds; it makes use of otherwise wasted slots and leaves a useful future merge supply. The solver still has no preparation-time cap or manual target-copy input, and 82 copies are a constructive lower bound rather than a global optimum proof.

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
