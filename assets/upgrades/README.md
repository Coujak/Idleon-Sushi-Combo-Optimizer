# Sushi Station upgrade icons

All **46/46** upgrades are represented. Filenames use `Upgrade Name (Upgrade X).png`, where **X is the 1-based shop-list number** (1–46). Game saves instead use internal upgrade IDs (0–45).

| Shop # | Icon filename | Internal ID | Upgrade purpose |
| ---: | --- | ---: | --- |
| 1 | `Hourly Wage Meter (Upgrade 1).png` | 41 | Shows hourly Bucks generation and increases earnings. |
| 2 | `Fastburn Fuel I (Upgrade 2).png` | 8 | Increases passive Fuel generation speed. |
| 3 | `Sushi Service Bonuses (Upgrade 3).png` | 44 | Unlocks game-wide bonuses from discovering sushi types. |
| 4 | `Fuel Capacity I (Upgrade 4).png` | 1 | Raises maximum Fuel capacity. |
| 5 | `Customer Surcharge I (Upgrade 5).png` | 30 | Increases Bucks earned from sushi. |
| 6 | `Fastburn Fuel II (Upgrade 6).png` | 9 | Increases Fuel generation speed and its unique multiplier. |
| 7 | `Sushi Slot (Upgrade 7).png` | 0 | Unlocks additional board slots. |
| 8 | `Superior Sushi Skillz (Upgrade 8).png` | 6 | Lets you choose a higher cooking tier, at increased Fuel cost. |
| 9 | `Fuel Capacity II (Upgrade 9).png` | 2 | Increases maximum Fuel capacity with an additional multiplier. |
| 10 | `Sushi Tier Vision (Upgrade 10).png` | 43 | Shows numeric sushi tiers and increases earnings. |
| 11 | `Salt Shaker (Upgrade 11).png` | 17 | Salt Shaker: chance to raise sushi tiers. |
| 12 | `Customer Surcharge II (Upgrade 12).png` | 31 | Increases Bucks and rewards discovering unique sushi types. |
| 13 | `Combo Meter (Upgrade 13).png` | 39 | Unlocks the Combo Meter and permanent Bucks multiplier. |
| 14 | `Hot Slot (Upgrade 14).png` | 14 | Unlocks Hot Plates, which increase Bucks production. |
| 15 | `Movement Mittens (Upgrade 15).png` | 42 | Unlocks moving the slots themselves rather than sushi. |
| 16 | `Seared Knowledge (Upgrade 16).png` | 13 | Unlocks Knowledge EXP from creating sushi. |
| 17 | `Charcoal Fireplace (Upgrade 17).png` | 23 | Charcoal Fireplace: boosts Fuel generation based on sushi tiers in its column. |
| 18 | `Quickpay Fee (Upgrade 18).png` | 35 | Grants instant Bucks when new sushi are created. |
| 19 | `Fastburn Fuel III (Upgrade 19).png` | 10 | Further increases Fuel generation speed and scaling. |
| 20 | `Fuel Capacity III (Upgrade 20).png` | 3 | Further raises maximum Fuel capacity. |
| 21 | `Shake N' Bake (Upgrade 21).png` | 20 | Shaker activations award Fuel, with a chance for more. |
| 22 | `Customer Surcharge III (Upgrade 22).png` | 32 | Additional increase to Bucks earned. |
| 23 | `Quality Freshness (Upgrade 23).png` | 7 | Chance for cooked sushi to start one tier higher. |
| 24 | `Pepper Shaker (Upgrade 24).png` | 18 | Pepper Shaker: chance to grant Perfecto status. |
| 25 | `Milktoast Slot (Upgrade 25).png` | 16 | Unlocks Milktoast Plates for Knowledge EXP. |
| 26 | `Barium Firelighter (Upgrade 26).png` | 27 | Barium Firelighter: multiplies Bucks earned in its column. |
| 27 | `Heat of the East Wind (Upgrade 27).png` | 29 | Heat of the East Wind: tiers-up sushi to the right after merges. |
| 28 | `Fastburn Fuel IV (Upgrade 28).png` | 11 | Additional Fuel generation scaling. |
| 29 | `Wholesale Pricing (Upgrade 29).png` | 36 | Reduces the cost of Sushi Station upgrades. |
| 30 | `Bottomless Shakers (Upgrade 30).png` | 21 | Chance to receive a free additional Shaker use. |
| 31 | `Fuel Capacity IV (Upgrade 31).png` | 4 | Further raises maximum Fuel capacity. |
| 32 | `2nd Degree Searing (Upgrade 32).png` | 37 | Boosts Knowledge EXP when sushi are created. |
| 33 | `Copper Firelighter (Upgrade 33).png` | 24 | Copper Firelighter: can award two tiers rather than one. |
| 34 | `Saffron Shaker (Upgrade 34).png` | 19 | Saffron Shaker: claims passive Bucks instantly. |
| 35 | `Cold Slot (Upgrade 35).png` | 15 | Unlocks Cold Plates, which generate Knowledge EXP for lower sushi tiers. |
| 36 | `Fastburn Fuel V (Upgrade 36).png` | 12 | High-tier Fuel generation scaling. |
| 37 | `Sasaphrax Saffron (Upgrade 37).png` | 22 | Increases Bucks granted by the Saffron Shaker. |
| 38 | `Customer Surcharge IV (Upgrade 38).png` | 33 | Additional increase to Bucks earned. |
| 39 | `Overtuned Fuel (Upgrade 39).png` | 28 | Generates a resource when Fuel is produced over capacity. |
| 40 | `Lithium Firelighter (Upgrade 40).png` | 26 | Lithium Firelighter: multiplies Knowledge EXP in its column. |
| 41 | `Fuel Capacity V (Upgrade 41).png` | 5 | High-tier Fuel capacity upgrade. |
| 42 | `Potassium Firelighter (Upgrade 42).png` | 25 | Potassium Firelighter: generates an additional resource. |
| 43 | `No Tax on Tips (Upgrade 43).png` | 40 | Multiplies Bucks earned from the Sushi Station. |
| 44 | `3rd Degree Searing (Upgrade 44).png` | 38 | Boosts Knowledge EXP gained from all sources. |
| 45 | `Customer Surcharge V (Upgrade 45).png` | 34 | Additional increase to Bucks earned. |
| 46 | `Rift Guy's Upgrade (Upgrade 46).png` | 45 | Special Rift-related upgrade entry; no purchasable levels. |

**Related assets:** Separate copies of Salt, Pepper and Saffron are in [`../shakers/`](../shakers/). The five fireplace icons remain in [`../campfires/`](../campfires/) under their legacy internal-ID names.

**Code mapping:** `sushiUpgradeIconPath(internalId)` looks up the corresponding shop number so `Sushi[2]` still resolves the correct image after renaming.

Names and functions have been cross-checked against [Idleon Toolbox](https://idleontoolbox.com/wiki/sushi-station/upgrades) and the [Idleon Sushi Station wiki](https://idleon.wiki/wiki/Sushi_Station). The images are *Legends of Idleon* artwork.
