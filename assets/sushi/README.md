# Sushi Station tier icons

All **64/64** sushi tiers are present. Filenames use `Sushi Name (Tier X).png`, where **X is the displayed tier** (1–64), not the zero-based sushi ID used in the JSON save.

| Tier | Icon filename | Knowledge bonus category |
| ---: | --- | --- |
| 1 | `Fish Eggs (Tier 1).png` | Bucks earned |
| 2 | `Eggroll (Tier 2).png` | Knowledge XP |
| 3 | `Egg Maki (Tier 3).png` | Cooking +1 tier chance |
| 4 | `Sashimi (Tier 4).png` | Bucks earned |
| 5 | `Tuna Maki (Tier 5).png` | Cooking +1 tier chance |
| 6 | `Salmon Uramaki (Tier 6).png` | Fuel capacity |
| 7 | `Salmon Maki (Tier 7).png` | Knowledge XP |
| 8 | `Cucumber Uramaki (Tier 8).png` | Bucks earned |
| 9 | `Cucumber Maki (Tier 9).png` | Cooking +1 tier chance |
| 10 | `Onigiri (Tier 10).png` | Fuel generation |
| 11 | `Toro Slice (Tier 11).png` | Fuel capacity |
| 12 | `Toro Nigiri (Tier 12).png` | Bucks earned |
| 13 | `Beef Nigiri (Tier 13).png` | Knowledge XP |
| 14 | `Beef Tobo Nigiri (Tier 14).png` | Free Shaker chance |
| 15 | `Tobiko Maki (Tier 15).png` | Cooking +1 tier chance |
| 16 | `Tobiko Temaki (Tier 16).png` | Fuel generation |
| 17 | `Tobiko Cluster (Tier 17).png` | Fuel capacity |
| 18 | `Tobo Sardine (Tier 18).png` | Bucks earned |
| 19 | `Tobo Twins (Tier 19).png` | Upgrade discounts |
| 20 | `Live Squid (Tier 20).png` | Fuel capacity |
| 21 | `Live Octopus (Tier 21).png` | Cooking +1 tier chance |
| 22 | `Calamari Ring (Tier 22).png` | Free Shaker chance |
| 23 | `Bluefin Ring (Tier 23).png` | Knowledge XP |
| 24 | `Tobo Tamago (Tier 24).png` | Fuel generation |
| 25 | `Tako Sashimi (Tier 25).png` | Bucks earned |
| 26 | `Hamachi Sashimi (Tier 26).png` | Upgrade discounts |
| 27 | `Fat Tuna Sashimi (Tier 27).png` | Cooking +1 tier chance |
| 28 | `King Beef Sashimi (Tier 28).png` | Fuel generation multiplier |
| 29 | `Salmon Sashimi (Tier 29).png` | Fuel capacity |
| 30 | `Salmon Nigiri (Tier 30).png` | Free Shaker chance |
| 31 | `Fried Bass Nigiri (Tier 31).png` | Knowledge XP |
| 32 | `Seasoned Bass Nigiri (Tier 32).png` | Upgrade discounts |
| 33 | `Jumbo Shrimp (Tier 33).png` | Bucks earned |
| 34 | `Aged Shrimp Nigiri (Tier 34).png` | Fuel generation |
| 35 | `Tempura Shrimp (Tier 35).png` | Slot strength |
| 36 | `Ika Sashimi (Tier 36).png` | Cooking +1 tier chance |
| 37 | `Abalone Sashimi (Tier 37).png` | Fuel generation multiplier |
| 38 | `Aji Sashimi (Tier 38).png` | Free Shaker chance |
| 39 | `Aji Aji Sashimi (Tier 39).png` | Upgrade discounts |
| 40 | `Bubba Grand Salmon (Tier 40).png` | Fuel capacity |
| 41 | `Tobiko Roll (Tier 41).png` | Knowledge XP |
| 42 | `Spicy Tuna Roll (Tier 42).png` | Slot strength |
| 43 | `Salmon Uramajor (Tier 43).png` | Fuel generation |
| 44 | `Sesame Salmon Muramajor (Tier 44).png` | Fireplace strength |
| 45 | `Dragon Roll (Tier 45).png` | Cooking +1 tier chance |
| 46 | `Imaginei Dragonroll (Tier 46).png` | Fuel generation multiplier |
| 47 | `Dragon Nigiri (Tier 47).png` | Free Shaker chance |
| 48 | `Tamago Nigiri (Tier 48).png` | Slot strength |
| 49 | `Unagi Nigiri (Tier 49).png` | Fuel capacity |
| 50 | `Soylent Nigiri (Tier 50).png` | Perfecto chance |
| 51 | `Masago (Tier 51).png` | Upgrade discounts |
| 52 | `Masago Temaki (Tier 52).png` | Fireplace strength |
| 53 | `Masagoroll (Tier 53).png` | Slot strength |
| 54 | `Caviar Supreme (Tier 54).png` | Perfecto chance |
| 55 | `Dulce Vitiri (Tier 55).png` | Fuel capacity |
| 56 | `Wasabaisamarama (Tier 56).png` | Free Shaker chance |
| 57 | `Kraken Roll (Tier 57).png` | Slot strength |
| 58 | `Leviathan Roll (Tier 58).png` | Fuel generation multiplier |
| 59 | `Golthulu Roll (Tier 59).png` | Free Shaker chance |
| 60 | `Wasomber Nigiri (Tier 60).png` | Not supplied in reference |
| 61 | `Leek Nigiri (Tier 61).png` | Not supplied in reference |
| 62 | `Atomiroll (Tier 62).png` | Not supplied in reference |
| 63 | `Octolingo (Tier 63).png` | Not supplied in reference |
| 64 | `Chromatic Nigiri (Tier 64).png` | Not supplied in reference |

Used by the imported board, custom editor, optimizer preparation and replay, and missing-Perfecto/missing-tier cards.

**Code mapping:** `sushiTierIconPath(tier)` uses the correct name and URL-safe path. Future tiers above 64 display their number if no artwork is available. Knowledge categories absent from the source are marked unavailable instead of guessed.

Names were cross-checked against [Idleon Toolbox's tier list](https://idleontoolbox.com/wiki/sushi-station/sushi) and the [Idleon Sushi Station wiki](https://idleon.wiki/wiki/Sushi_Station).
