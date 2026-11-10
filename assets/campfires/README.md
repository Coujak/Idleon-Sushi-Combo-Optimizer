# Sushi Station fireplace icons

All **five fireplace images** use the same readable filename convention as the other upgrade artwork: `Upgrade Name (Upgrade X).png`. **X is the upgrade's one-based shop position**, not its internal game-data ID.

| Filename | Shop # | Internal upgrade ID | Color | Effect |
| --- | ---: | ---: | --- | --- |
| `Charcoal Fireplace (Upgrade 17).png` | 17 | 23 | Orange | Fuel generation increases with the sushi tiers in the fireplace's column |
| `Barium Firelighter (Upgrade 26).png` | 26 | 27 | Green | Increases Bucks earned by sushi in the column |
| `Copper Firelighter (Upgrade 33).png` | 33 | 24 | Blue | Chance for certain sushi to gain two tiers instead of one |
| `Lithium Firelighter (Upgrade 40).png` | 40 | 26 | Pink | Increases Knowledge EXP earned by sushi in the column |
| `Potassium Firelighter (Upgrade 42).png` | 42 | 25 | Purple | Generates an additional resource over time |

The board displays these in the order **Charcoal → Barium → Copper → Lithium → Potassium**. Each file is byte-identical to the corresponding named icon in [`assets/upgrades/`](../upgrades/).

The browser uses `FIRE_IMAGES` in `src/app.js` to select the proper artwork for a fireplace type; the filenames are URL-encoded for spaces and punctuation.

Images from *Legends of Idleon*. For game mechanics and reference information, see the [Idleon Sushi Station wiki](https://idleon.wiki/wiki/Sushi_Station).
