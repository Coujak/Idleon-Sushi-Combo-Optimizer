# Idleon Sushi Combo Optimizer

Browser-based Sushi Station preparation and Combo Meter optimizer for Legends of Idleon.

**Site:** https://coujak.github.io/Idleon-Sushi-Combo-Optimizer/

## Features
- Load Idleon Toolbox JSON locally (your save is processed in your browser).
- Reconstruct the complete **8×15 board (120 positions)**, supporting **up to 100 unlocked slots in any positions**, with plate types, fireplaces and Perfecto indicators.
- Compare prepared layouts; edit individual sushi tiers using the custom board editor.
- Choose **Default** for established preparations, or **Experimental 1.0**, **2.0**, **3.0**, **4.0**, **5.0**, **6.0**, and **7.0** for progressively newer layered Wind layouts. You can cancel an active search.
- Optimizer settings are editable: enter any starting base tier, lower the Wind tier limit (never above maximum prepared tier minus 6), and customize chain and timing settings within game-supported ranges.
- Recommended preparations preserve a single permanent Tier 64 (when unlocked or present in the imported save) at the first unlocked position; imported and custom boards keep their own positions, including bottom-row slots.
- Simulate Heat of the East Wind and search using greedy, beam, staircase-recycling, and tactical repositioning strategies.
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

Under the existing East Wind simulator (tier limit 58; chain limit 25),
Experimental offers a replay-tested 100-slot preparation reaching **51,608
simulated Combo Meter points** in 89 merges and zero mid-combo relocations,
with one permanent Tier 64 and 99 other sushi. This beats the earlier
reported **48,305** baseline by **3,303 points (+6.8%)**.

Experimental 2.0 adds a **56,315-point simulated benchmark** with 88 merges, 1,373 Wind upgrades, and no mid-combo relocations. The exact 100-sushi preparation and replay are covered by regression tests. It requires a contiguous 100-slot full-upgrade setup (Tier 64, Wind limit 58, chain limit 25).

Experimental 3.0 adds a reproducible **57,328-point simulated benchmark**: 88 merges, 1,418 Wind upgrades, zero repositioning, and exactly 100 unlocked slots including one Tier 64. Both a top-placed and bottom-placed contiguous board are tested in the replay suite.

Experimental 4.0 adds a replay-validated **58,684-point simulated benchmark** with 88 merges, 1,483 Wind upgrades and no repositioning, using 100 unlocked slots including one permanent Tier 64.

Experimental 5.0 reaches **60,572 simulated points**, with 88 merges, 1,595 Wind upgrades and no repositioning. The 100-sushi starting board preserves one Tier 64, and the complete replay is regression-tested at both ends of the 8×15 grid (requiring a contiguous 100-slot full-upgrade arrangement, Wind cap 58, chain limit 25).

Experimental 6.0 reaches **64,017 simulated points**, with 85 merges, 1,709 Wind upgrades and no repositioning. The full 100-sushi starting board (including permanent Tier 64) is replay-tested at positions 1–100 and 21–120. The current research target is 65,000 points.

Experimental 7.0 **passes the 65,000 target**, reaching **65,542 simulated points**, with 85 merges, 1,759 Wind upgrades, and zero repositioning. The exact starting board is tested at both ends of the 8×15 grid. This benchmark requires 100 contiguous unlocked positions, Tier 64, Wind cap 58, and chain limit 25.

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
- The optimizer is a bounded search and does **not** guarantee a globally optimal score. Tactical search considers at most one relocation before each merge and uses a limited beam/depth on the best preparation; deeper strategies may be missed.
- The timing estimate does not model animation delays, network lag or player precision.
- Local JSON imports are never sent to a server by the site.
