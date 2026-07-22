# PIP-OS — Unofficial Interactive Pip-Boy

A vanilla HTML/CSS/JS, zero-dependency, no-build static site. An unofficial fan
homage to the Pip-Boy 3000 from the **Fallout** series. Six in-Pip-Boy
mini-games, persistent SPECIAL stats, a draining fusion cell, scuttling
radroaches, and roughly two dozen easter eggs.

Hosted at **<https://pipboy.benrichardson.dev>**.

> **Unofficial fan project.** Not affiliated with, endorsed by, or sponsored by
> Bethesda Softworks LLC or ZeniMax Media. Fallout, Pip-Boy, Vault-Tec, ROBCO,
> and Vault Boy are trademarks of their respective owners. This is a
> non-commercial homage by Ben Richardson.

## Features

### Five tabs
- **STATS** — S.P.E.C.I.A.L. (rolled once, persisted), HP/AP/RAD bars, perks, karma meter, click-able Vault Boy.
- **INV** — Weapons / Apparel / Aid / Misc / Ammo / Keys, with use-actions (Stimpak heals, RadAway clears rads, Fusion Core recharges battery).
- **DATA** — Quests, Notes (with karma triggers), Holotape launcher, Achievements, Workshop recipes.
- **MAP** — Hand-drawn SVG wasteland with twelve hexagonal markers (Megaton, New Vegas, Vault 111, Far Harbor, …).
- **RADIO** — Six stations with original parody DJ chatter, synthesized tube hum and static, draggable volume knob.

### Six mini-games (holotapes)
- **ROBCO Term-Link** — authentic same-length-word hacking puzzle with Hamming-likeness feedback and clickable bracket pairs that remove duds or reset attempts.
- **Lockpicking** — bobby pin & screwdriver; mouse rotates, Spacebar applies torque; sweet-spot scales by difficulty (Very Easy → Very Hard).
- **Red Menace** — Donkey Kong clone (girders, ladders, barrels, the maiden).
- **Atomic Command** — Missile Command clone defending eight cities (NYC, D.C., Seattle, Vegas, S.F., St. Louis, Mt. Rushmore, Boston).
- **Zeta Invaders** — Space Invaders clone with Zetan aliens, mothership, and bunkers.
- **Pipfall** — Pitfall clone; collect 5 bobbleheads in 300 seconds with 10 HP.

### Easter eggs
- ROBCO boot sequence with **WAR. WAR NEVER CHANGES.**, occasional Liberty Prime quotes
- Hidden `~` developer console: `tgm`, `tcl`, `showracemenu`, `coc qasmoke`, `player.additem caps 1000`, `goto <vault#>`, `wildwasteland`, `nuclear`, `reset`, `help`
- **Konami code** (`↑↑↓↓←→←→BA Enter`) unlocks the dev room (max SPECIAL, all bobbleheads, ∞ caps); enter it again to engage **Nuclear Winter** palette inversion
- Seven hidden bobbleheads scattered as tiny pixels across tabs (one per SPECIAL letter)
- **Mysterious Stranger** drops by every few minutes
- "Please Stand By" overlay on rare tab switches
- Vault number deterministically assigned from your local user ID
- **Phosphor cycler** — `Ctrl+Shift+P` switches between green / amber / blue / white CRT colors
- 60-second idle screensaver (DVD-bouncing Vault Boy)
- Scuttling radroaches you can click to squash for caps (10 → Exterminator achievement)
- Click Vault Boy 100 times for a hidden bobblehead
- Battery drains 1 % per minute; tap to recharge
- Real-life today's date injected into a pre-war "Eyebot Broadcast 2287" log
- Karma triggers (Notes tab): "Give a beggar 5 caps" / "Detonate Megaton"
- `[ENCRYPTED]` holotape — solve the hacking puzzle to unlock a Vault-Tec President memo
- Codsworth helper appears bottom-right after the Konami unlock
- Achievement toaster with a synth chime

## Tech

- **No build, no dependencies.** ES6 modules natively in the browser.
- **All visuals are original.** Vault Boy, bobbleheads, holotape art, and the wasteland map are hand-authored SVG / CSS — no Bethesda artwork is shipped.
- **All sound is synthesized** at runtime via the Web Audio API (oscillators + noise). No audio files are shipped.
- **Fonts** — VT323 and Share Tech Mono, both SIL OFL.
- **Persistence** — single `localStorage` key (`pipboy:state`). Defensive parse with version backfill.
- **Accessibility** — keyboard-reachable tabs (Tab, 1–5), ARIA roles, `prefers-reduced-motion` disables flicker / scanline drift / idle screensaver, ESC closes mini-games.
- **Performance** — `requestAnimationFrame` loops; tab modules dynamically `import()`-ed; all CRT effects use `transform`/`opacity` (no layout thrash).

## Run locally

```sh
cd /path/to/pipboy
python3 -m http.server 8765
```
Then open <http://localhost:8765>. ES6 modules require an HTTP origin — opening `index.html` directly via `file://` will fail.

## Deploy

This repo ships a `CNAME` for `pipboy.benrichardson.dev`. Push to a GitHub repo and enable Pages on the `main` branch (folder: `/`). Cloudflare Pages or Netlify drop also work — there is no build step.

## Controls cheat-sheet

| Action | Keys |
|---|---|
| Switch tab | Click the tab, or press `1`–`5` |
| Open dev console | `~` (or `` ` ``) |
| Cycle phosphor color | `Ctrl`+`Shift`+`P` |
| Konami code | `↑↑↓↓←→←→BA Enter` |
| Close mini-game | `ESC` or click `EJECT` |
| Move (canvas games) | Arrow keys / WASD |
| Fire / jump (canvas games) | `Space` |
| Lockpicking torque | Hold `Space` |

## license

[GNU Affero General Public License v3.0 or later](./LICENSE), with an attribution
requirement added under section 7(b) — see
[ADDITIONAL-TERMS.md](./ADDITIONAL-TERMS.md).

In short: you may run, modify, redistribute and even sell this, but if you
distribute it — or run a modified version where other people can reach it — you
have to publish your source under the same licence and keep the attribution. A
separate commercial licence without those obligations is available on request:
<hi@ben.gy>.

Third-party components keep their own licences — see
[THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md).
