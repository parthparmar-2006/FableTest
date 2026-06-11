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

/* ------- generative background music: soft arpeggio pad, zero assets ------- */
// chord cycle (Am - F - C - G), frequencies in Hz
const CHORDS = [
  [220.0, 261.63, 329.63, 440.0],
  [174.61, 220.0, 261.63, 349.23],
  [130.81, 196.0, 261.63, 329.63],
  [196.0, 246.94, 293.66, 392.0],
];
let musicTimer = null;
let musicOff = Storage.getMusicOff();
let chordIdx = 0;

function playBar() {
  if (musicOff || muted) return;
  try {
    const c = ac();
    const chord = CHORDS[chordIdx % CHORDS.length];
    chordIdx++;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const master = c.createGain();
    master.gain.value = 0.05;
    lp.connect(master).connect(c.destination);
    for (let i = 0; i < 8; i++) {
      const note = chord[i % chord.length] * (i >= 4 ? 2 : 1);
      const t = c.currentTime + i * 0.25;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'triangle';
      o.frequency.value = note;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(1, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(g).connect(lp);
      o.start(t);
      o.stop(t + 0.7);
    }
  } catch {
    // music must never break the game
  }
}

export const Music = {
  start() {
    if (musicTimer) return;
    playBar();
    musicTimer = setInterval(playBar, 2000);
  },
  stop() {
    clearInterval(musicTimer);
    musicTimer = null;
  },
  toggle() {
    musicOff = !musicOff;
    Storage.setMusicOff(musicOff);
    return musicOff;
  },
  isOff: () => musicOff,
};

export const Sfx = {
  drop: () => beep({ freq: 220, end: 140, dur: 0.08, type: 'square', vol: 0.1 }),
  siren: () => {
    beep({ freq: 440, end: 660, dur: 0.35, type: 'sawtooth', vol: 0.12 });
    beep({ freq: 440, end: 660, dur: 0.35, type: 'sawtooth', vol: 0.12, when: 0.45 });
  },
  heartbeat: () => beep({ freq: 80, end: 50, dur: 0.12, type: 'sine', vol: 0.25 }),
  fanfare: () => {
    [523, 659, 784, 1047].forEach((f, i) =>
      beep({ freq: f, dur: 0.16, when: i * 0.12, type: 'triangle', vol: 0.2 })
    );
  },
  boxOpen: () => {
    beep({ freq: 200, end: 400, dur: 0.15, type: 'square', vol: 0.12 });
    beep({ freq: 600, end: 1200, dur: 0.25, when: 0.18, type: 'triangle', vol: 0.18 });
  },
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
