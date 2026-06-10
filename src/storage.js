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

export const Storage = {
  getBest: () => read('jos_best', 0),
  setBest: (v) => write('jos_best', v),
  getStardust: () => read('jos_stardust', 0),
  addStardust: (v) => {
    const total = read('jos_stardust', 0) + v;
    write('jos_stardust', total);
    return total;
  },
};
