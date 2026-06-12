import { Storage } from './storage.js';

// Ad abstraction with the retention-safe pacing policy from GAME_PLAN.md:
//   - no interstitial in the first 90s of a session
//   - >= 3 minutes between interstitials, max 3 per session
//   - never within 60s after a rewarded ad
//   - rewarded ads are always opt-in
// On the web build ads are stubbed (rewarded grants after a short delay) —
// the CrazyGames/Poki SDK replaces the stub at portal submission, and the
// AdMob path activates only inside the Capacitor Android app.
// AdMob stays in TEST mode until the Play Store listing is approved.

const PACING = {
  minSessionMs: 90_000,
  minGapMs: 180_000,
  maxPerSession: 3,
  rewardedCooldownMs: 60_000,
};

// Google's published AdMob TEST unit IDs — safe to ship in test builds,
// MUST be replaced with real unit IDs only at production release.
const TEST_UNITS = {
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
};

const state = {
  sessionStart: Date.now(),
  lastInterstitialAt: 0,
  interstitialCount: 0,
  lastRewardedAt: 0,
  native: false,
  admob: null,
  cg: null,
  rewardedReady: false,
  rewardEarned: false,
};

const AD_TIMEOUT_MS = 8000;

// An unresolved ad promise must never hang the game (seen on-device with the
// SAVE ME overlay): every native ad call races this timeout.
function withTimeout(promise, ms = AD_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve('__timeout__'), ms)),
  ]);
}

async function initNative() {
  // Capacitor is only present in the wrapped Android app
  const cap = window.Capacitor;
  if (!cap?.isNativePlatform?.()) return initCrazyGames();
  try {
    const mod = await import('@capacitor-community/admob');
    const AdMob = mod.AdMob;
    await withTimeout(AdMob.initialize({ initializeForTesting: true }));
    // trust plugin events over show-promise resolution for the reward signal
    const ev = mod.RewardAdPluginEvents ?? {};
    if (ev.Rewarded) {
      AdMob.addListener(ev.Rewarded, () => {
        state.rewardEarned = true;
      });
    }
    if (ev.FailedToLoad) {
      AdMob.addListener(ev.FailedToLoad, () => {
        state.rewardedReady = false;
      });
    }
    state.admob = AdMob;
    state.native = true;
  } catch (e) {
    console.warn('AdMob unavailable, running ad-free:', e);
  }
}
initNative();

// CrazyGames web SDK: loaded only on their domain, everything defensive —
// the game must run identically when the SDK is absent or its API shifts.
function initCrazyGames() {
  try {
    if (!/crazygames\./.test(location.hostname)) return;
    const s = document.createElement('script');
    s.src = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
    s.onload = async () => {
      try {
        await window.CrazyGames?.SDK?.init?.();
        state.cg = window.CrazyGames?.SDK ?? null;
        track('cg_sdk_ready');
      } catch {
        state.cg = null;
      }
    };
    document.head.appendChild(s);
  } catch {
    /* never break the game over an ad SDK */
  }
}

function cgRequestAd(type) {
  // resolves true when the ad completed (rewarded earned / midgame finished)
  return new Promise((resolve) => {
    try {
      state.cg.ad.requestAd(type, {
        adFinished: () => resolve(true),
        adError: () => resolve(false),
        adStarted: () => {},
      });
    } catch {
      resolve(false);
    }
  });
}

function interstitialAllowed() {
  const now = Date.now();
  return (
    now - state.sessionStart >= PACING.minSessionMs &&
    now - state.lastInterstitialAt >= PACING.minGapMs &&
    now - state.lastRewardedAt >= PACING.rewardedCooldownMs &&
    state.interstitialCount < PACING.maxPerSession
  );
}

export const Ads = {
  /** Natural-break interstitial (between runs). Resolves immediately when pacing blocks it. */
  async maybeShowInterstitial() {
    if (!interstitialAllowed()) return false;
    if (state.cg) {
      // CrazyGames midgame ad, same pacing rules
      const ok = await withTimeout(cgRequestAd('midgame'), AD_TIMEOUT_MS * 2);
      if (ok === true) {
        state.lastInterstitialAt = Date.now();
        state.interstitialCount += 1;
        track('ad_interstitial', 'cg');
      }
      return ok === true;
    }
    if (!state.native) return false; // plain web build: no interstitials at all
    try {
      const r1 = await withTimeout(
        state.admob.prepareInterstitial({ adId: TEST_UNITS.interstitial })
      );
      if (r1 === '__timeout__') return false;
      const r2 = await withTimeout(state.admob.showInterstitial());
      if (r2 === '__timeout__') return false;
      state.lastInterstitialAt = Date.now();
      state.interstitialCount += 1;
      track('ad_interstitial');
      return true;
    } catch {
      return false;
    }
  },

  /** Call at run start so SAVE ME shows instantly instead of loading at fail time. */
  async preloadRewarded() {
    if (!state.native || state.rewardedReady) return;
    try {
      const r = await withTimeout(
        state.admob.prepareRewardVideoAd({ adId: TEST_UNITS.rewarded })
      );
      state.rewardedReady = r !== '__timeout__';
    } catch {
      state.rewardedReady = false;
    }
  },

  /** Opt-in rewarded ad. Resolves true only if the reward was earned. Never hangs. */
  async showRewarded(placement) {
    track('ad_rewarded_open', placement);
    if (state.native) {
      try {
        state.rewardEarned = false;
        if (!state.rewardedReady) {
          const p = await withTimeout(
            state.admob.prepareRewardVideoAd({ adId: TEST_UNITS.rewarded })
          );
          if (p === '__timeout__') return false;
        }
        state.rewardedReady = false; // consumed; next run preloads again
        const result = await withTimeout(
          state.admob.showRewardVideoAd(),
          AD_TIMEOUT_MS * 4 // the video itself runs ~30s; only guard real hangs
        );
        const earned = state.rewardEarned || (result !== '__timeout__' && !!result);
        if (earned) state.lastRewardedAt = Date.now();
        track(earned ? 'ad_rewarded_earned' : 'ad_rewarded_abandoned', placement);
        return earned;
      } catch {
        return false;
      }
    }
    if (state.cg) {
      const earned = await withTimeout(cgRequestAd('rewarded'), AD_TIMEOUT_MS * 4);
      if (earned === true) {
        state.lastRewardedAt = Date.now();
        track('ad_rewarded_earned', placement + ':cg');
        return true;
      }
      track('ad_rewarded_abandoned', placement + ':cg');
      return false;
    }
    // plain web stub: short fake delay, always grants
    await new Promise((r) => setTimeout(r, 800));
    state.lastRewardedAt = Date.now();
    track('ad_rewarded_earned', placement);
    return true;
  },

  rewardedAvailable: () => true,
  _state: state, // exposed for tests/debugging
  _pacing: PACING,
};

// Minimal local analytics: counters in localStorage so retention/opt-in math
// is possible before Firebase is wired in (see LAUNCH.md).
export function track(event, label = '') {
  try {
    const key = 'jos_evt_' + event + (label ? ':' + label : '');
    const n = Number(localStorage.getItem(key) || 0) + 1;
    localStorage.setItem(key, String(n));
  } catch {
    // analytics must never break gameplay
  }
}

// session day marker for D1-retention math
track('session');
try {
  if (!localStorage.getItem('jos_first_open')) {
    localStorage.setItem('jos_first_open', new Date().toISOString());
  }
} catch { /* ignore */ }

// keep Storage import meaningful: expose a debug summary of tracked events
export function analyticsSummary() {
  const out = { stardust: Storage.getStardust() };
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith('jos_evt_')) out[k.slice(8)] = localStorage.getItem(k);
    }
  } catch { /* ignore */ }
  return out;
}
