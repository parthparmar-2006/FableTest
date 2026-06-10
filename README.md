# Jar of Stars

A physics drop-and-merge arcade game (Suika-style) with a twist: **the jar tilts**.
Drop celestial bodies, merge identical ones up the chain from Stardust to Sun, and
don't let the pile overflow while gravity slowly swings back and forth.

Built per [GAME_PLAN.md](./GAME_PLAN.md) — web-first, then Android via Capacitor,
monetized with lightly-paced ads (rewarded-video first).

## Features (week 2 state)

- 10-tier merge chain with chain-combo scoring, particles, screen shake
- Tilting-gravity twist that escalates as you merge
- Synthesized sound effects (Web Audio — no audio assets)
- Stardust currency earned every run, even on failure
- Collection album: 10 unlockable color skins
- Daily challenge: same drop sequence for every player each day (seeded RNG)
- Daily streak with escalating rewards and streak freezes
- Shareable score card (emoji ladder, copies to clipboard)
- All persistence in localStorage; no accounts, no backend

## Develop

```bash
npm install
npm run dev      # dev server at http://localhost:5173
npm run build    # production build to dist/
```

## Publish to itch.io / CrazyGames (web)

1. `npm run build`
2. Zip the contents of `dist/` (index.html must be at the zip root)
3. itch.io: New project → "HTML" type → upload zip → check "This file will be played in the browser"
4. CrazyGames: submit via https://developer.crazygames.com (Basic Launch)

## Android (planned, week 3)

Capacitor wrap + AdMob via `@capacitor-community/admob` — see GAME_PLAN.md Part 3.
