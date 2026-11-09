# Idleon Sushi Combo Optimizer

Browser-based Sushi Station preparation and Combo Meter optimizer for Legends of Idleon.

**Site:** https://coujak.github.io/Idleon-Sushi-Combo-Optimizer/

## Features
- Load Idleon Toolbox JSON locally (your save is processed in your browser).
- Reconstruct a 15-column Sushi Station board, plate types, fireplaces and Perfecto indicators.
- Compare prepared layouts; edit individual sushi tiers using the custom board editor.
- Simulate Heat of the East Wind and search using greedy, beam, and staircase-recycling strategies.
- Deliberately reuse descending staircases across scoring passes. The replay includes zero-point relocations of sushi between unlocked slots and distinguishes them from merges.
- Enter action times to estimate combo-time feasibility. **Only merges reset the combo timer** in the timing estimate.
- Inspect the full board after each merge or relocation and compare predicted scores with observed gameplay.

## Verified model regression

The test suite reconstructs the tier layout implied by the user's 52-step video breakdown (22 descending Tier 30…9 sushi followed by 30 Tier 8 sushi). It validates **all 50 scoring merges**, not just the final score:

| Model sequence | Predicted score |
| --- | ---: |
| Original approach, two relocations | **6,544** |
| Relocate an extra Tier 8, Wind limit ≥33 | **7,069** |
| Relocate an extra Tier 8, Wind limit 32 | **7,036** |

The 7,069 sequence adds 9+10+…+33 = **525** points from the same spare sushi. The exact board reconstruction and predicted improvement remain **simulation-derived**, not independently validated against a 7,069-point in-game run.

## Run tests

```sh
node --test tests/optimizer-core.test.mjs
```

Tests cover the full 50-merge score progression, extra Wind-target upgrade, Wind limit, replay consistency and legal relocation.

## Notes
- The displayed highest sushi on the imported board is a **fallback**, not proof of the account's actual highest unlocked tier. If you unlocked a higher sushi tier, set *Maximum prepared tier* manually so the Wind cap (highest tier minus six) is accurate.
- The optimizer is a bounded search and does **not** guarantee a globally optimal score.
- The timing estimate does not model animation delays, network lag or player precision.
- Local JSON imports are never sent to a server by the site.
