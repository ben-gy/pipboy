# Optional asset overrides

The Pip-Boy ships with hand-authored SVG art so the site works out of the box.
If you want to use **real Fallout assets** instead, drop image files into this
folder with the names below. The code will pick them up automatically; if a
file is missing, the original SVG fallback is used.

## Recognized filenames

| File                | Used in            | Suggested source (Fallout Wiki) |
|---------------------|--------------------|----------------------------------|
| `vault-boy.png`     | STATS tab, screensaver, Pipfall sprite | `Vault Boy` page on fallout.fandom.com |
| `holotape.png`      | DATA → Holotapes tiles | `Holotape` page on fallout.fandom.com |
| `bobble-S.png`      | hidden bobblehead — Strength      | `Vault-Tec bobblehead - Strength` |
| `bobble-P.png`      | hidden bobblehead — Perception    | `Vault-Tec bobblehead - Perception` |
| `bobble-E.png`      | hidden bobblehead — Endurance     | `Vault-Tec bobblehead - Endurance` |
| `bobble-C.png`      | hidden bobblehead — Charisma      | `Vault-Tec bobblehead - Charisma` |
| `bobble-I.png`      | hidden bobblehead — Intelligence  | `Vault-Tec bobblehead - Intelligence` |
| `bobble-A.png`      | hidden bobblehead — Agility       | `Vault-Tec bobblehead - Agility` |
| `bobble-L.png`      | hidden bobblehead — Luck          | `Vault-Tec bobblehead - Luck` |
| `wasteland-map.png` | MAP tab background | Capital Wasteland / Commonwealth maps |
| `pipboy-device.png` | Optional device chrome (frames the screen on desktop) | `Pip-Boy 3000` page |
| `mister-handy.png`  | Codsworth helper (after Konami unlock) | `Codsworth` / `Mr. Handy` |
| `mysterious-stranger.png` | random Stranger appearance | `Mysterious Stranger` page |
| `radroach.png`      | scuttling radroach sprite | `Radroach` page |
| `nuka-cola.png`     | Nuka-Cola entry in INV → Aid | `Nuka-Cola` page |
| `power-armor.png`   | T-51 entry in INV → Apparel  | `T-51 power armor` page |

## How to grab them

1. Open the Fallout Wiki page for the asset.
2. Right-click the icon image → "Save image as…" → save here with the matching name.
3. Refresh the Pip-Boy. The image swaps in.

> Note: these assets are owned by Bethesda. The wiki hosts them under fan-use
> conventions; using them on a personal, non-commercial fan tribute is your
> call. The code makes the swap optional so the project itself ships with only
> original art.

## Recommended sizes

- `vault-boy.png` — transparent PNG, ~400×500 (or larger; will scale).
- `holotape.png` — ~160×100 transparent.
- `bobble-*.png` — ~120×160 transparent.
- `wasteland-map.png` — 1600×1000 or larger.
- `radroach.png` — 32×16 transparent.
- All other icons — square transparent PNGs work best.
