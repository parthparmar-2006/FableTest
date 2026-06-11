# Launch Checklist — Jar of Stars

The code side of week 3 is done. Everything below is account/store work that
only you (the account owner) can do. Total cash needed: **$25** (Play Console).

## 1. Web launch (free, do this first — today)

- [ ] `npm run build`, zip the **contents** of `dist/` (index.html at zip root)
- [ ] **itch.io**: create account → New project → Kind: HTML → upload zip →
      tick "This file will be played in the browser" → viewport 480x800,
      mobile-friendly ON → publish. Takes ~15 minutes.
- [ ] **CrazyGames**: https://developer.crazygames.com → submit the same build
      (they may ask for their SDK later; Basic Launch gives ~2 weeks of real
      traffic + retention metrics — this is your free market test)
- [ ] Register a domain for the game name (~$10) so clones don't own your search results

## 2. Short-form clips (free, 2-3 per week)

- [ ] Record 15-30s of chain merges / near-miss saves (screen record on your phone)
- [ ] Post to TikTok + YouTube Shorts + Instagram Reels. Formats that work:
      "satisfying" chains, last-second SAVE ME rescues, "1 merge from the Sun" fails
- [ ] Reply to every comment fast; turn the best comments into follow-up clips

## 3. Google Play (the $25 step)

- [ ] Create a Play Console developer account ($25 one-time): https://play.google.com/console
- [ ] Personal accounts must run a **closed test: 12 testers for 14 consecutive days**
      before production. Recruit 15-18 testers (friends + r/AndroidClosedTesting
      tester-exchange communities) so dropouts don't reset the clock.
- [ ] Build the AAB on your machine (needs Android Studio):
      ```
      npm run build && npx cap sync android
      npx cap open android   # opens Android Studio
      # Build > Generate Signed Bundle (create a keystore, BACK IT UP)
      ```
- [ ] Store listing: declare target audience **13+** (NOT child-directed — this
      keeps full ad inventory; child-directed = contextual-only ads at much lower eCPM)
- [ ] Content rating questionnaire, data-safety form (we store nothing server-side)

## 4. AdMob (do AFTER the app is publicly listed)

- [ ] Create an AdMob account: https://admob.google.com
- [ ] Add the app, create 2 ad units: 1 interstitial, 1 rewarded
- [ ] Replace the TEST IDs:
      - `src/ads.js` → `TEST_UNITS` → your real unit IDs, and remove
        `initializeForTesting: true`
      - `android/app/src/main/AndroidManifest.xml` → real APPLICATION_ID
- [ ] **NEVER tap your own live ads — AdMob bans are non-appealable.**
      While developing, the shipped test IDs are always safe.

## 5. Analytics (before Android launch)

- [ ] Create a free Firebase project, add the Android app, drop
      `google-services.json` into `android/app/`
- [ ] Until then, the built-in local counter tracks run_start/run_end/ad events
      (see `analyticsSummary()` in src/ads.js) — enough for your own playtesting

## 6. Decision gates (from GAME_PLAN.md)

| When | Metric | Action |
|---|---|---|
| Web, ~2 weeks | D1 retention from CrazyGames dashboard | <20% after 2 iterations → fix biggest drop-off or pivot to game #2 |
| Android, week 6+ | D1 ≥35% and D7 ≥10-15% | pitch Voodoo/Supersonic/Homa (free) |
| Any time | a clip pops (>100k views) | ship updates fast, ride the wave |

## Ad placements implemented (retention-safe pacing)

| Placement | Format | Where in code |
|---|---|---|
| SAVE ME (clear 30%, once/run) | Rewarded | GameScene.offerSave |
| 2x stardust | Rewarded | GameOverScene |
| Between runs | Interstitial | GameOverScene buttons → Ads.maybeShowInterstitial |

Pacing enforced in `src/ads.js`: no interstitial before 90s of session time,
≥3 min between interstitials, max 3/session, 60s suppression after any
rewarded ad, none at app open. Web builds show no interstitials at all.
