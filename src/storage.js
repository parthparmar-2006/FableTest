// Tiny localStorage wrapper; falls back to memory when storage is blocked
// (some webviews/private modes), so the game never crashes on persistence.
const mem = {};

function read(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return key in mem ? mem[key] : fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    mem[key] = value;
  }
}

export function todayStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export const Storage = {
  getBest: () => read('jos_best', 0),
  setBest: (v) => write('jos_best', v),

  getStardust: () => read('jos_stardust', 0),
  addStardust: (v) => {
    const total = read('jos_stardust', 0) + v;
    write('jos_stardust', total);
    return total;
  },
  spendStardust(v) {
    const cur = read('jos_stardust', 0);
    if (cur < v) return false;
    write('jos_stardust', cur - v);
    return true;
  },

  // collection album
  getOwnedSkins: () => read('jos_skins', ['classic']),
  ownSkin(id) {
    const owned = read('jos_skins', ['classic']);
    if (!owned.includes(id)) owned.push(id);
    write('jos_skins', owned);
  },
  getEquippedSkin: () => read('jos_equipped', 'classic'),
  setEquippedSkin: (id) => write('jos_equipped', id),

  // daily streak: { count, last, freezes }; freeze auto-covers one missed day
  getStreak: () => read('jos_streak', { count: 0, last: null, freezes: 1 }),
  setStreak: (s) => write('jos_streak', s),
  getLastClaim: () => read('jos_lastclaim', null),
  setLastClaim: (day) => write('jos_lastclaim', day),

  // daily challenge best, keyed by date
  getDailyBest: (day) => read('jos_daily_' + day, 0),
  setDailyBest: (day, v) => write('jos_daily_' + day, v),

  getMuted: () => read('jos_muted', false),
  setMuted: (v) => write('jos_muted', v),
  getMusicOff: () => read('jos_music_off', false),
  setMusicOff: (v) => write('jos_music_off', v),

  // player level (XP = lifetime score)
  getXp: () => read('jos_xp', 0),
  addXp(v) {
    const xp = read('jos_xp', 0) + v;
    write('jos_xp', xp);
    return xp;
  },

  // daily missions
  getMissionProgress: (day) => read('jos_mprog_' + day, {}),
  setMissionProgress: (day, p) => write('jos_mprog_' + day, p),
  getMissionsClaimed: (day) => read('jos_mclaim_' + day, []),
  claimMission(day, id) {
    const c = read('jos_mclaim_' + day, []);
    if (!c.includes(id)) c.push(id);
    write('jos_mclaim_' + day, c);
  },

  // mystery box every 3rd run
  bumpBoxCounter() {
    const n = read('jos_box_runs', 0) + 1;
    write('jos_box_runs', n);
    return n;
  },
};
