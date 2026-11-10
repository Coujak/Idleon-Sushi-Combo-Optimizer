# Sushi Station tier artwork

Complete set of **64 sushi images**, named `Sushi Name (Tier X).png` where **X is the displayed tier (1–64)**, not the zero-based sushi ID stored in the save. Names match the game's sushi tier reference.

| Displayed tier | Icon filename |
| ---: | --- |
| 1 | `Fish Eggs (Tier 1).png` |
| 2 | `Eggroll (Tier 2).png` |
| 3 | `Egg Maki (Tier 3).png` |
| 4 | `Sashimi (Tier 4).png` |
| 5 | `Tuna Maki (Tier 5).png` |
| 6 | `Salmon Uramaki (Tier 6).png` |
| 7 | `Salmon Maki (Tier 7).png` |
| 8 | `Cucumber Uramaki (Tier 8).png` |
| 9 | `Cucumber Maki (Tier 9).png` |
| 10 | `Onigiri (Tier 10).png` |
| 11 | `Toro Slice (Tier 11).png` |
| 12 | `Toro Nigiri (Tier 12).png` |
| 13 | `Beef Nigiri (Tier 13).png` |
| 14 | `Beef Tobo Nigiri (Tier 14).png` |
| 15 | `Tobiko Maki (Tier 15).png` |
| 16 | `Tobiko Temaki (Tier 16).png` |
| 17 | `Tobiko Cluster (Tier 17).png` |
| 18 | `Tobo Sardine (Tier 18).png` |
| 19 | `Tobo Twins (Tier 19).png` |
| 20 | `Live Squid (Tier 20).png` |
| 21 | `Live Octopus (Tier 21).png` |
| 22 | `Calamari Ring (Tier 22).png` |
| 23 | `Bluefin Ring (Tier 23).png` |
| 24 | `Tobo Tamago (Tier 24).png` |
| 25 | `Tako Sashimi (Tier 25).png` |
| 26 | `Hamachi Sashimi (Tier 26).png` |
| 27 | `Fat Tuna Sashimi (Tier 27).png` |
| 28 | `King Beef Sashimi (Tier 28).png` |
| 29 | `Salmon Sashimi (Tier 29).png` |
| 30 | `Salmon Nigiri (Tier 30).png` |
| 31 | `Fried Bass Nigiri (Tier 31).png` |
| 32 | `Seasoned Bass Nigiri (Tier 32).png` |
| 33 | `Jumbo Shrimp (Tier 33).png` |
| 34 | `Aged Shrimp Nigiri (Tier 34).png` |
| 35 | `Tempura Shrimp (Tier 35).png` |
| 36 | `Ika Sashimi (Tier 36).png` |
| 37 | `Abalone Sashimi (Tier 37).png` |
| 38 | `Aji Sashimi (Tier 38).png` |
| 39 | `Aji Aji Sashimi (Tier 39).png` |
| 40 | `Bubba Grand Salmon (Tier 40).png` |
| 41 | `Tobiko Roll (Tier 41).png` |
| 42 | `Spicy Tuna Roll (Tier 42).png` |
| 43 | `Salmon Uramajor (Tier 43).png` |
| 44 | `Sesame Salmon Muramajor (Tier 44).png` |
| 45 | `Dragon Roll (Tier 45).png` |
| 46 | `Imaginei Dragonroll (Tier 46).png` |
| 47 | `Dragon Nigiri (Tier 47).png` |
| 48 | `Tamago Nigiri (Tier 48).png` |
| 49 | `Unagi Nigiri (Tier 49).png` |
| 50 | `Soylent Nigiri (Tier 50).png` |
| 51 | `Masago (Tier 51).png` |
| 52 | `Masago Temaki (Tier 52).png` |
| 53 | `Masagoroll (Tier 53).png` |
| 54 | `Caviar Supreme (Tier 54).png` |
| 55 | `Dulce Vitiri (Tier 55).png` |
| 56 | `Wasabaisamarama (Tier 56).png` |
| 57 | `Kraken Roll (Tier 57).png` |
| 58 | `Leviathan Roll (Tier 58).png` |
| 59 | `Golthulu Roll (Tier 59).png` |
| 60 | `Wasomber Nigiri (Tier 60).png` |
| 61 | `Leek Nigiri (Tier 61).png` |
| 62 | `Atomiroll (Tier 62).png` |
| 63 | `Octolingo (Tier 63).png` |
| 64 | `Chromatic Nigiri (Tier 64).png` |

The website uses these icons for the board, custom tier editor, strategy preparation, merge replay, missing Perfectos, and missing-tier cards.

In code, call `sushiTierIconPath(tier)` from `src/sushi-reference.mjs` to resolve the named, URL-encoded filename. If artwork is absent, the tile keeps its tier label.

See also [`../upgrades/`](../upgrades/) for Sushi Station upgrades and [`../shakers/`](../shakers/) for dedicated Shaker icons.
