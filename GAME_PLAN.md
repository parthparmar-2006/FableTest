# "Addictive, Lightly Ad-Monetized" Mobile Game — Research Findings & End-to-End Money Plan

## Context

Solo developer, AI-assisted (minimal hand-coding), budget **<$100 and <1 month** to first
release, monetized via in-game ads kept light enough not to hurt retention. User deferred
concept choice ("it must be addictive") and chose **Android-only** for the paid store
(no iOS — the $99/yr fee alone breaks the budget). This session's deliverable is research +
concept + an end-to-end earning plan (no game code yet). Deep research was run across 5
angles (case studies, market 2024-26, ad monetization, $0 distribution, retention mechanics);
key findings and the resulting plan follow.

---

## Part 1 — What the research says (condensed, with confidence notes)

### Why games succeed fast with low effort (case studies 2021-2026)
- **The product is the clip.** Every recent organic hit was discovered via TikTok/YouTube/
  streamers, not store browsing: Suika Game (VTubers, 2023), Vampire Survivors (SplatterCat,
  Jan 2022), Level Devil (Poki + TikTok troll clips → ~35M installs, $0 UA), Sprunki, Crazy
  Cattle 3D. Design the 15-second shareable moment first.
- **One instantly-legible mechanic** (drop fruit / guess word / drag blocks), rounds of
  30s-2min, "one more try" fail states.
- **Recombination beats invention.** Suika cloned a Chinese browser game; Vampire Survivors =
  free Phaser engine + ~£1,100 of assets; Megabonk cloned Vampire Survivors and sold 1M in
  2 weeks. A fresh twist on a proven loop is the norm, not a novel genre.
- **Clones move fast:** Sprunki/Crazy Cattle search traffic was captured by clone sites within
  days. Secure name/domain/store listing early.

### Market (2024-2026)
- Hyper-casual is consolidated, not dead (~22B downloads/yr) but the solo "ship in 2 weeks,
  buy installs" arbitrage is gone post-ATT. Industry standard now = **hybrid-casual**: simple
  puzzle/arcade core + light meta + ads-plus-IAP.
- Hottest casual subgenres by revenue growth: **block puzzle (~12x YoY), sort, screw/jam,
  merge**. Block Blast! = #1 most-downloaded game on earth 2024 AND 2025, ~70M DAU,
  monetized ~entirely by ads — proof the ad-only model still works at the top.
- Benchmarks to beat: median game D1 ≈ 23-26%, D7 ≈ 4%. "Genuinely good" = D1 35%+,
  D7 15%+ (that's publisher-pitch territory).

### Ad monetization (the "paid in ads, not too much" part)
- **Stack: AdMob alone to start** — no traffic minimum, one $100 payout threshold, one
  dashboard. Skip AppLovin MAX/mediation until ~5-10k DAU. (If built in Unity, LevelPlay;
  we're not using Unity.)
- **Rewarded video is the backbone**: ~45% of casual ad revenue, US eCPM ~$15-20, fully
  opt-in → zero churn risk. Interstitials: US eCPM ~$14; banners ~$0.50-0.70 (skip).
- **Retention-safe pacing (also AdMob policy):** no interstitial in the first 60-90s
  (improves D1 ~5-8%), only at natural breaks (game over), 2-3 min cooldown, cap ~3-4/session,
  suppress if a rewarded ad just played, never at app open/exit.
- **Realistic money:** ads-only casual ARPDAU ≈ $0.02-0.05 mixed-geo → **~$20-50/day per
  1,000 DAU** (T1-heavy traffic better, India-heavy ~5-10x worse).
- **Account-killing gotchas:** never click your own live ads (non-appealable ban); use test
  ad units. Declare target audience 13+ in Play Console (child-directed = contextual-only
  ads = much lower eCPM).

### Distribution with $0
- **Highest-probability path = web-first, then Android** (the Level Devil arc):
  1. HTML5 build → itch.io (no gatekeeping) + CrazyGames Developer Portal (open submissions;
     "Basic Launch" gives ~2 weeks of real-traffic retention data; €100 min payout).
  2. If metrics good → pitch Poki (curated; 50/50 on their traffic, 100% on traffic you bring).
  3. In parallel: 1-3 short-form clips/week (TikTok/Shorts/Reels), sound-off-legible,
     satisfying-or-troll format; reply to comments fast, make follow-ups from them.
  4. Android port: Google Play personal accounts need a **closed test (12 testers, 14
     consecutive days) before production** — use it as the soft launch; budget 3-6 weeks
     from build-done to public listing.
- Publisher pitches (Voodoo/Supersonic/Homa) are free but ~2% acceptance; only worth it
  AFTER your own metrics clear D1 ~35-40% / D7 ~10-15%.

### Verification caveat
An adversarial verification pass was attempted; the agent hit a session limit and several
primary sources (Poki docs, Google Play help, GameAnalytics) 403-block automated fetching.
Most load-bearing claims were drawn from official docs by the first-pass agents and
corroborated across 2+ secondary sources, but **re-verify before relying on exact numbers**:
CrazyGames/Poki current rev-share terms, Google Play tester count (12 vs 20), and current
eCPMs. Revenue figures for Block Blast etc. are third-party estimates.

---

## Part 2 — The game concept (chosen for maximum addictiveness-per-dev-hour)

### Concept A: physics drop-and-merge with a twist — working title **"Jar of Stars"**
*(name/theme placeholder — final name must be unique enough to own search results)*

- **Core loop (30s-2min rounds):** drop celestial bodies (pebble→moon→planet→…→sun) into a
  jar; identical bodies merge into the next tier with a juicy pop + particle burst; you lose
  when the jar overflows. Identical comprehension-speed to Suika Game — the most-proven
  addictive casual loop of the decade (near-miss pressure + chain-reaction dopamine).
- **The twist (anti-clone differentiation, pick ONE in week 1 playtest):**
  1. **Tilt:** the jar slowly tilts back and forth, shifting the pile (default choice —
     visually dramatic for clips, trivial to implement: rotate gravity vector).
  2. Gravity flip every N merges.
  3. A "black hole" piece earned by chains that swallows 3 neighbors.
- **Built-in shareable moment:** chain merges with escalating screen-shake/particles, and a
  post-game "closest call" replay card (your near-miss moment as a shareable image/GIF —
  Wordle's emoji-grid lesson applied).

### Retention design (mapped from research checklist)
- Fail → restart in <2s; show near-miss info ("you were 1 merge from a Sun!", score vs best).
- Every run earns stardust (soft currency) even on failure → PLAY → GET → UPGRADE.
- **Collection album:** 16-24 unlockable jar skins/fruit themes bought with stardust
  (collections = single highest-leverage meta; ~72% of top-grossing games use them).
- **Daily streak with free streak-freeze** (forgiving streaks beat harsh ones — Duolingo data)
  + small escalating daily reward.
- **Daily challenge mode:** one fixed-seed run/day, everyone gets the same drops; local +
  shareable score (Wordle scarcity → appointment habit).
- Variable reward: mystery "comet" piece appears on a random schedule (variable-ratio
  reinforcement = strongest known habit former).
- First 5 minutes nearly loss-proof (smaller spawn sizes early); no tutorial beyond a
  one-line gesture hint.

### Ad placements (light by design)
| Placement | Format | Rule |
|---|---|---|
| "Save me!" on game over (clear 30% of jar) | Rewarded | Max 1/run, the money-maker |
| 2x stardust at run end | Rewarded | Always offered |
| Free daily mystery skin spin | Rewarded | 1/day |
| Between runs | Interstitial | Only after 90s+ of play, ≥3 min apart, ≤3/session, never after a rewarded ad |
| Banners | — | None |
- Later (not in v1): one $2.99 "remove interstitials forever" IAP — keeps rewarded ads, top
  ad-game revenue add-on with zero design cost.

---

## Part 3 — Build plan (4 weeks, AI-assisted)

**Tech stack (all free):**
- **Phaser 3 + Matter.js** (HTML5; same family as Vampire Survivors' origin) — one codebase
  for web portals AND Android.
- **Capacitor** to wrap the HTML5 build as an Android app; **AdMob via Capacitor community
  plugin** (`@capacitor-community/admob`).
- Art: flat shapes + free particle effects (Kenney.nl assets / AI-generated sprites);
  sound: free SFX (freesound/Kenney). Juice (tweens, shake, particles) > art quality.
- Analytics: Google Analytics for Firebase (free) — must track D1/D7 retention, session
  length, ad opt-in rate from day one; decisions later depend on these.

**Week 1 — Core loop.** Jar + drop + merge physics + lose condition + score. Playtest the
three twist options; keep the one that makes testers say "one more try" most. Milestone:
a stranger plays 3+ consecutive rounds unprompted.
**Week 2 — Juice + retention layer.** Particles/shake/sound, near-miss messaging, stardust,
collection album (8 skins min), daily challenge, streak. Milestone: itch.io build live;
post first dev-log clip.
**Week 3 — Web launch + Android wrap.** Submit to CrazyGames Basic Launch. Capacitor wrap,
AdMob test ads wired with the pacing rules above, Play Console account ($25), store listing,
start closed test with 12 testers (friend/family/tester-exchange communities) — the 14-day
clock starts now. Post 2-3 clips/week of best chain reactions + near-misses.
**Week 4 — Iterate on real data.** CrazyGames gives retention/playtime; fix the biggest
drop-off. Keep the closed test alive; apply for production access when eligible.

**Budget:** Play Console $25 one-time + domain ~$10 ≈ **$35 total**. (No iOS.)

---

## Part 4 — Money roadmap & honest expectations

**Revenue channels in order of arrival:**
1. **CrazyGames/itch.io web ads** (weeks 3+): first dollars; low ($1-ish per 1k plays at the
   bottom end, $500-3k/mo if the game performs and gets promoted to full launch).
2. **AdMob on Android** (week 6+, after closed test → production): ~$20-50/day per 1,000 DAU.
3. **Poki pitch** once CrazyGames metrics look good (50/50 split, real traffic firehose).
4. **Publisher pitch (free option, not the plan):** only if D1 ≥35% and D7 ≥10-15% — then a
   Voodoo/Supersonic/Homa deal or even an acqui-offer becomes realistic.

**Scenario math (ads-only, mixed geo):**
| Outcome | DAU | ~Monthly revenue |
|---|---|---|
| Typical first game | 100-500 | $60-750 |
| Good (one clip pops / portal promotes) | 2k-10k | $1.2k-15k |
| Outlier (sustained virality) | 50k+ | $30k+/mo |
Most first games land in row 1. The plan's edge: web portals + short-form clips give
multiple free "shots on goal," and the loop is the most-proven addictive pattern available.

**Kill/iterate criteria (decide at day ~45):** if D1 <20% after two iteration rounds, ship
game #2 with the same engine/tooling (the second game costs a fraction of the effort — this
is the real hyper-casual playbook: volume of attempts).

**Risks:** clone-speed (mitigate: distinctive name/theme, own the domain, ship fast);
AdMob ban (never self-click; test units only); Google Play tester dropout restarting the
14-day clock (recruit 15-18, not 12); virality is high-variance (the web-portal floor
exists precisely so $0 marketing ≠ zero installs).

---

## Part 5 — When we build it (next session)

Scaffold in this repo (`FableTest`): Phaser 3 + Vite project, `src/scenes/` (Boot, Menu,
Game, GameOver), Matter.js physics config, merge logic + tier table as data, then Capacitor
wrap. **Verification:** run dev server, play 10 rounds in browser; check merge chains, lose
condition, 60fps on a mid-range phone via remote debugging; AdMob in test mode only until
store approval. Use Lighthouse + Firebase DebugView to confirm analytics events
(run_start, run_end, ad_impression, d1 cohort) fire correctly.
