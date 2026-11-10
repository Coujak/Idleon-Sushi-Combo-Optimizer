# Idleon Sushi Station Lab

Browser-based Sushi Station account dashboard, reference guides and Combo Meter optimizer for Legends of Idleon.

**Site:** https://coujak.github.io/Idleon-Sushi-Combo-Optimizer/

## Sections (v1.10.0)
- **Overview:** Import your Idleon Toolbox JSON above the dashboard; view shaker counters with game artwork, missing Perfectos and undiscovered tiers with renamed sushi icons, account statistics and the original board. Dashboard shortcut buttons and Perfecto progress tally have been removed.
- **Planners:** The full existing Combo Meter optimizer and replay. No Bucks or Knowledge board optimizers yet.
- **Upgrades:** An illustrated 46-entry upgrade catalog with readable summaries, account-aware expanded bonuses for supported per-level effects, expandable full descriptions, category/status filters, sortable headings, levels, next-level effects and **pre-discount base cost estimates**; a goal-filtered progression advisor; and a Menagerie Doubler advisor reading Spelunk[52].
- **Knowledge:** 64 sushi tiers, names, knowledge levels, EXP progress, known bonus categories and Perfecto states. Tiers without category metadata are explicitly marked unavailable rather than assigned fictitious effects.

The advisor is informational: it does not yet compute global ROI across all game systems or modify the save. Price estimates omit account discounts and other account-dependent modifiers. Reference metadata is derived from the public Idleon Toolbox Sushi Station parser and tables, and can change as the game updates.

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
- Load Idleon Toolbox JSON locally (your save is processed in your browser).
- Reconstruct the complete **8×15 board (120 positions)**, supporting **up to 100 unlocked slots in any positions**, with plate types, fireplaces and Perfecto indicators.
- Compare prepared layouts; edit individual sushi tiers using the custom board editor.
- Choose **Balanced Planner** (Default) or one of thirteen named Experimental strategies, from **Wind Foundations** to **Cascade Resonance**. The interface labels their estimated manual execution difficulty and simulated benchmark. Original strategy IDs and algorithms remain unchanged.
- **Maximum prepared tier has no fixed 64-tier ceiling**: enter 65, 100, or higher for future-update simulation. Wind automatically follows **prepared tier − 6** when already maxed (e.g., 64 → 58, 66 → 60), but lower manual Wind selections are preserved. Tiers above the available art assets appear as numbers.
- Recommended preparations preserve the configured highest tier at the first unlocked position (Tier 64 for historical benchmarks, higher when configured). Imported and custom boards keep their own positions, including bottom-row slots.
- Simulate Heat of the East Wind and search using greedy, beam, staircase-recycling, and tactical repositioning strategies.
- Replay combo sequences at **0.5×**, 0.75×, 1× (default), 1.5×, 2×, or 3× speed; the Wind animation timing scales with playback speed.
- Deliberately reuse descending staircases across scoring passes. Search several spare-sushi Wind-tail lengths and test one-tile tactical repositioning before merges on irregular boards. The replay distinguishes zero-point relocations from merges.
- Enter action times to estimate combo-time feasibility. **Only merges reset the combo timer** in the timing estimate.
- Follow each merge or relocation in a larger replay board with highlighted actions, dimmed inactive tiles, and a staggered East Wind animation.

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
