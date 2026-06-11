import { Storage, todayStr } from './storage.js';
import { TIERS } from './config/tiers.js';
import { SKINS } from './config/skins.js';

// deterministic RNG shared by daily challenge and daily missions
export function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function daySeed(day) {
  let seed = 0;
  for (const ch of day) seed = (seed * 31 + ch.charCodeAt(0)) | 0;
  return seed;
}

/* ---------------- player level: XP = lifetime score ---------------- */

// cumulative XP needed to REACH level n: 500 * n*(n+1)/2
function xpForLevel(n) {
  return (500 * n * (n + 1)) / 2;
}

export function levelFromXp(xp) {
  let n = 0;
  while (xpForLevel(n + 1) <= xp) n++;
  return n;
}

export function levelProgress(xp) {
  const level = levelFromXp(xp);
  const cur = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, pct: (xp - cur) / (next - cur), into: xp - cur, need: next - cur };
}

/** Add a run's score as XP. Returns level-up info (bonus already credited). */
export function addXp(score) {
  const before = levelFromXp(Storage.getXp());
  const xp = Storage.addXp(score);
  const after = levelFromXp(xp);
  if (after > before) {
    const bonus = 100 * after;
    Storage.addStardust(bonus);
    return { leveledUp: true, level: after, bonus };
  }
  return { leveledUp: false, level: after, bonus: 0 };
}

/* ---------------- daily missions ---------------- */

const MISSION_POOL = [
  { id: 'score600', text: 'Score 600+ in one run', key: 'bestRun', target: 600, reward: 100 },
  { id: 'score1200', text: 'Score 1200+ in one run', key: 'bestRun', target: 1200, reward: 150 },
  { id: 'planet', text: `Create a ${TIERS[5].name}`, key: 'bestTier', target: 5, reward: 100 },
  { id: 'giant', text: `Create a ${TIERS[6].name}`, key: 'bestTier', target: 6, reward: 150 },
  { id: 'chain3', text: 'Hit a x3 chain', key: 'bestChain', target: 3, reward: 100 },
  { id: 'runs3', text: 'Finish 3 runs', key: 'runs', target: 3, reward: 75 },
  { id: 'storms2', text: 'Survive 2 gravity storms', key: 'storms', target: 2, reward: 125 },
];

export function todaysMissions(day = todayStr()) {
  const rand = mulberry32(daySeed(day) ^ 0x5151);
  const pool = [...MISSION_POOL];
  const picked = [];
  while (picked.length < 3 && pool.length) {
    picked.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  }
  return picked;
}

export function missionState(day = todayStr()) {
  const prog = Storage.getMissionProgress(day);
  const claimed = Storage.getMissionsClaimed(day);
  return todaysMissions(day).map((m) => ({
    ...m,
    value: Math.min(prog[m.key] ?? 0, m.target),
    done: (prog[m.key] ?? 0) >= m.target,
    claimed: claimed.includes(m.id),
  }));
}

export function claimMission(id, day = todayStr()) {
  const m = missionState(day).find((x) => x.id === id);
  if (!m || !m.done || m.claimed) return 0;
  Storage.claimMission(day, id);
  Storage.addStardust(m.reward);
  return m.reward;
}

/** Called once per finished run with that run's stats. */
export function recordRun({ score, highestTier, maxChain, storms }) {
  const day = todayStr();
  const p = Storage.getMissionProgress(day);
  p.runs = (p.runs ?? 0) + 1;
  p.bestRun = Math.max(p.bestRun ?? 0, score);
  p.bestTier = Math.max(p.bestTier ?? 0, highestTier);
  p.bestChain = Math.max(p.bestChain ?? 0, maxChain);
  p.storms = (p.storms ?? 0) + storms;
  Storage.setMissionProgress(day, p);
}

/* ---------------- mystery box (every 3rd run) ---------------- */

export function boxEarnedThisRun() {
  const n = Storage.bumpBoxCounter();
  return n % 3 === 0;
}

export function openBox() {
  const r = Math.random();
  if (r < 0.1) {
    const unowned = SKINS.filter(
      (s) => !Storage.getOwnedSkins().includes(s.id)
    );
    if (unowned.length) {
      const skin = unowned[Math.floor(Math.random() * unowned.length)];
      Storage.ownSkin(skin.id);
      return { type: 'skin', skin };
    }
    const dust = 500;
    Storage.addStardust(dust);
    return { type: 'dust', dust };
  }
  const dust = r < 0.7
    ? 50 + Math.floor(Math.random() * 101) // 50-150
    : 200 + Math.floor(Math.random() * 201); // 200-400
  Storage.addStardust(dust);
  return { type: 'dust', dust };
}

/** true when the COLLECTION button should pulse "NEW!" */
export function affordableSkinExists() {
  const owned = Storage.getOwnedSkins();
  const dust = Storage.getStardust();
  return SKINS.some((s) => !owned.includes(s.id) && s.cost <= dust);
}
