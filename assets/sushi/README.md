# Sushi Station sushi assets

This folder contains the original Idleon Sushi Station sushi tier images used by the Sushi Combo Optimizer.

## Filename convention

Each image is named `Sushi_Station_Sushi_<tier>.png`, where `<tier>` is the displayed sushi tier from **1 through 64**.

| Example filename | Sushi tier |
| --- | --- |
| `Sushi_Station_Sushi_1.png` | Tier 1 |
| `Sushi_Station_Sushi_41.png` | Tier 41 |
| `Sushi_Station_Sushi_58.png` | Tier 58 |
| `Sushi_Station_Sushi_64.png` | Tier 64 |

## How the optimizer uses these images

The website loads images from `assets/sushi/` to display sushi artwork on the imported board, custom tier-placement editor, recommended preparation board, and interactive merge replay.

The filename number matches the **displayed tier** (not the zero-based sushi ID stored in Idleon Toolbox JSON). Tier numbers remain visible alongside the artwork, and missing images fall back to the tier label.

Keep the exact filename pattern and capitalization so the website can find each image.
