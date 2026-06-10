import { Storage } from './storage.js';

// All SFX are synthesized with Web Audio — zero asset downloads, zero cost.
let ctx;
let muted = Storage.getMuted();

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function beep({ freq, end = freq, dur = 0.1, type = 'sine', vol = 0.2, when = 0 }) {
  if (muted) return;
  try {
    const c = ac();
    const t = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(end, 1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  } catch {
    // audio is never worth crashing the game over
  }
}

export const Sfx = {
  drop: () => beep({ freq: 220, end: 140, dur: 0.08, type: 'square', vol: 0.1 }),
  // pitch rises with tier and chain depth — the "ascending dopamine" cue
  merge: (tier, chain = 1) =>
    beep({
      freq: 280 * Math.pow(1.12, tier) + (chain - 1) * 70,
      end: 280 * Math.pow(1.12, tier) * 1.5 + (chain - 1) * 70,
      dur: 0.18,
      type: 'triangle',
      vol: 0.22,
    }),
  ui: () => beep({ freq: 600, end: 480, dur: 0.05, vol: 0.08 }),
  over: () => beep({ freq: 330, end: 70, dur: 0.7, type: 'sawtooth', vol: 0.12 }),
  reward: () => {
    beep({ freq: 523, dur: 0.1 });
    beep({ freq: 659, dur: 0.1, when: 0.1 });
    beep({ freq: 784, dur: 0.18, when: 0.2 });
  },
  toggleMute() {
    muted = !muted;
    Storage.setMuted(muted);
    return muted;
  },
  isMuted: () => muted,
};
