# Combo Meter encrypted research — Experiments 15 and 16

The complete boards and replays are intentionally **not stored in plaintext in GitHub**.

## Verified research results

| Experiment | Simulated score | Merges | East Wind upgrades | Initial occupancy | Supply / engine |
|---|---:|---:|---:|---:|---|
| 14.0 (previous private record) | 76,850 | 93 | 1,861 | 100 | 23 / 77 |
| 15.0 | **76,950** | 92 | 1,865 | 100 | 23 / 77 |
| 16.0 | **77,407** | 91 | 1,875 | 100 | 23 / 77 |

Experiment 15 was derived from the prior validated 76,950 JSON replay. A subsequent new-board search yielded 77,191 and then 77,407 points. Each saved best was independently replayed against the project's Combo Meter mechanics: 100 filled cells, exactly one protected Tier 64, Wind cap T58, and at most 25 upgrades per triggering merge.

These are **simulator results, not in-game scores**. No mathematical global optimality is claimed.

## Encrypted artifacts

The files are named `experiment15.enc.json` and `experiment16.enc.json`. They are AES-256-GCM encrypted with PBKDF2-SHA256 (600,000 iterations), compatible with the private experiment loader's crypto envelope. The user has received the encrypted files outside this repository. **Do not commit the passphrase, decrypted boards, or unencrypted actions to public GitHub.**

The existing private research runner may read an encrypted file as `--file=private/experiment16.enc.json` while running locally. Its default filename and some messages refer to Experiment 14; use an explicit `--output` for improved results. Source and passphrase are needed for actual replay searches.

## Next search directions

- Broaden board-level mutation around Experiment 16's 77,407-point configuration.
- Jointly search new board layouts and non-greedy merge sequences.
- Investigate coordinated legal relocations that preserve East Wind engines.
