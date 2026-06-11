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
};

async function initNative() {
  // Capacitor is only present in the wrapped Android app
  const cap = window.Capacitor;
  if (!cap?.isNativePlatform?.()) return;
  try {
    const { AdMob } = await import('@capacitor-community/admob');
    await AdMob.initialize({ initializeForTesting: true });
    state.admob = AdMob;
    state.native = true;
  } catch (e) {
    console.warn('AdMob unavailable, running ad-free:', e);
  }
}
initNative();

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
    if (!state.native) return false; // web build: no interstitials at all
    try {
      await state.admob.prepareInterstitial({ adId: TEST_UNITS.interstitial });
      await state.admob.showInterstitial();
      state.lastInterstitialAt = Date.now();
      state.interstitialCount += 1;
      track('ad_interstitial');
      return true;
    } catch {
      return false;
    }
  },

  /** Opt-in rewarded ad. Resolves true only if the reward was earned. */
  async showRewarded(placement) {
    track('ad_rewarded_open', placement);
    if (state.native) {
      try {
        await state.admob.prepareRewardVideoAd({ adId: TEST_UNITS.rewarded });
        const result = await state.admob.showRewardVideoAd();
        const earned = !!result;
        if (earned) state.lastRewardedAt = Date.now();
        track(earned ? 'ad_rewarded_earned' : 'ad_rewarded_abandoned', placement);
        return earned;
      } catch {
        return false;
      }
    }
    // web stub: short fake delay, always grants (portal SDK replaces this)
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
