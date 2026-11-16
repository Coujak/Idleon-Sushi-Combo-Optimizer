# Combo Meter encrypted research — Experiments 15–17

The complete boards and replays are intentionally **not stored in plaintext in GitHub**.

## Verified research results

| Experiment | Simulated score | Merges | East Wind upgrades | Initial occupancy | Supply / engine |
|---|---:|---:|---:|---:|---|
| 14.0 (previous private record) | 76,850 | 93 | 1,861 | 100 | 23 / 77 |
| 15.0 | **76,950** | 92 | 1,865 | 100 | 23 / 77 |
| 16.0 | 77,407 | 91 | 1,875 | 100 | 23 / 77 |
| 17.0 | **77,801** | 93 | 1,880 | 100 | 23 / 77 |

Experiment 17 is based on a new 77,462 board discovered by a broader mutation search of Experiment 16. An alternative early merge and a second improvement to the continuation raised it to 77,688 and then 77,801. Independent stepwise replay confirmed all 93 moves. Additional board mutation and alternative continuation searches did not improve it further during this pass.

Experiment 15 was derived from the prior validated 76,950 JSON replay. A subsequent new-board search yielded 77,191 and then 77,407 points. Each saved best was independently replayed against the project's Combo Meter mechanics: 100 filled cells, exactly one protected Tier 64, Wind cap T58, and at most 25 upgrades per triggering merge.

These are **simulator results, not in-game scores**. No mathematical global optimality is claimed.

## Encrypted artifacts

The encrypted files are named `experiment15.enc.json`, `experiment16.enc.json`, and `experiment17.enc.json`. They are AES-256-GCM encrypted with PBKDF2-SHA256 (600,000 iterations), compatible with the private experiment loader's crypto envelope. The user has received the encrypted files outside this repository, with Experiment 17 separately archived in their Library. Experiment 17 uses the same encryption passphrase as Experiments 15 and 16. **Do not commit the passphrase, decrypted boards, or unencrypted actions to public GitHub.**

The existing private research runner may read an encrypted file as `--file=private/experiment16.enc.json` while running locally. Its default filename and some messages refer to Experiment 14; use an explicit `--output` for improved results. Source and passphrase are needed for actual replay searches.

## Next search directions

- Broaden board-level mutation around Experiment 17's 77,801-point configuration.
- Jointly search new board layouts and non-greedy merge sequences.
- Investigate coordinated legal relocations that preserve East Wind engines.

## Continued 78,000 search — current working record 77,882

The best complete simulator replay in this research pass reached **77,882**, an 81-point improvement over Experiment 17.0 (77,801); the 78,000 goal is **not yet met**. This is a **working checkpoint**, not a new numbered Experiment.

- Board: 100 filled slots (23 supply / 77 Wind engine), one protected T64.
- Replay: 93 legal merges, 1,883 East Wind upgrades, and at most 25 upgrades per merge.
- Independently revalidated with an implementation of the repository's replay rules.
- Private working ciphertext: `experiment17_77882_working.enc.json` in `Sushi_Combo_77882_Working_Encrypted.zip`, saved to the user's private file Library (not GitHub).
- Compatible with the PBKDF2-SHA256 / AES-256-GCM envelope and the existing private replay candidate loader; uses the same passphrase as Experiments 15–17.

Explored random starting-board mutations, continuation-policy searches, legal mid-replay relocations, alternative merge orders including 3-deviation branches, and mutations preserving the original sequence. None of the subsequent tested candidates reached 78,000. These are bounded heuristic searches, not an optimality proof. No private board/replay or passphrase is committed here.
