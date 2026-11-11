# Sushi Station: 30/70 → 10/90 local research

Run in the **repository root** from the VS Code terminal (Node.js 18+):

```powershell
git pull --ff-only
node research/sweep-30-to-10.mjs --mode=guided --per-split=1000
```

This visits **21 splits**, from **30 supply / 70 engine** to **10 supply / 90 engine**, inclusive. It uses 100 contiguous unlocked slots, a protected T64 in the first slot, T58 Wind cap, and a maximum Wind chain of 25. **Guided mode is a practical heuristic search, not exhaustive**. It begins with generated preparations; the 24/76 split also gets the explicitly identified Experiment 13 benchmark seed (76,532 simulator points), then mutation explores additional boards.

Every evaluated board is searched with the existing eight greedy merge policies by default (`--scoring=full`). This does **not** test every possible merge order, but new winning results are replay-checked before they are saved.

Progress and per-split winning boards/action sequences are saved to `research/results/sweep-30-to-10.json`. The script prints interim best scores. Press **Ctrl+C** to save and exit, then rerun the same command to resume. Increase the budget to continue farther:

```powershell
node research/sweep-30-to-10.mjs --mode=guided --per-split=10000
```

Here, `--per-split` is the **cumulative number of preparations evaluated at each split**, not an additional number on each invocation. A run of 10,000 per split evaluates at most 210,000 preparations total. Guided mode may revisit previously seen boards.

## Exact enumeration within a chosen domain

```powershell
node research/sweep-30-to-10.mjs --mode=exact --min-tier=9 --max-tier=20 --per-split=1000 --checkpoint=research/results/exact-9-to-20.json
```

Exact mode enumerates **distinct tier assignments** for each split, visiting them in a deterministic, widely spaced order. By default, the 23–29/etc. supply ingredients are sorted high-to-low (for practical setup), and **engine positions are fully ordered**. The protected first-position T64 is fixed. All tier assignments in the chosen range are covered **only if the run reaches the printed total for every split**. A limited `--per-split` run samples those assignments systematically; it is **not exhaustive yet**.

To include every ordering of supply ingredients, add `--supply-order=all`. To reduce the search to sorted engine tier lists, add `--engine-order=sorted`; this will **exclude** non-sorted staged Wind engines.

To request literal completion of the bounded search:

```powershell
node research/sweep-30-to-10.mjs --mode=exact --min-tier=1 --max-tier=2 --engine-order=sorted --per-split=all --checkpoint=research/results/exact-small.json
```

**Warning:** The unrestricted T1–T63 search of 100 slots is astronomically large, even when the split is fixed. It cannot realistically be completed on an ordinary desktop; `--per-split=all` does not make that tractable. The enumerator does not claim coverage beyond its tier range and ordering constraints.

## Other settings

- `--scoring=quick` evaluates one East Wind policy instead of the eight-policy scorer. Scores remain replay-checked, but merge-order exploration is weaker.
- `--report-every=25` prints progress every 25 evaluations.
- `--save-every=25` writes periodic checkpoints; new best scores always trigger a save.
- `--start=30 --end=10` selects the inclusive descending split range.
- `--reset` starts a new search and **overwrites the specified checkpoint**.
- Changing the mode, bounds, or other search settings requires a separate checkpoint file or `--reset`. Increasing `--per-split` preserves prior progress.
- Saved action positions are zero-based indices (add 1 for numbered board positions).

The resulting scores are **replay-valid in the current simulator**, not guaranteed in-game outcomes or proven global maximums.