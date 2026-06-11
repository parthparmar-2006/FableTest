// Tier table: the entire merge progression is data-driven so balancing is a
// one-file edit. Radii roughly follow Suika's ~1.25-1.35x step per tier.
export const TIERS = [
  { key: 'tier0', name: 'Stardust', radius: 16, color: 0xcfd8ff, score: 1 },
  { key: 'tier1', name: 'Pebble', radius: 21, color: 0x9aa7c7, score: 3 },
  { key: 'tier2', name: 'Asteroid', radius: 28, color: 0x8d6e63, score: 6 },
  { key: 'tier3', name: 'Comet', radius: 36, color: 0x80deea, score: 10 },
  { key: 'tier4', name: 'Moon', radius: 46, color: 0xe0e0e0, score: 15 },
  { key: 'tier5', name: 'Planet', radius: 58, color: 0x66bb6a, score: 21 },
  { key: 'tier6', name: 'Ringed Giant', radius: 72, color: 0xffb74d, score: 28 },
  { key: 'tier7', name: 'Ice Giant', radius: 88, color: 0x4fc3f7, score: 36 },
  { key: 'tier8', name: 'Red Dwarf', radius: 106, color: 0xef5350, score: 45 },
  { key: 'tier9', name: 'Sun', radius: 126, color: 0xffd54f, score: 100 },
];

// Only small bodies spawn as droppables (classic Suika rule): big ones must be earned.
export const MAX_DROP_TIER = 4;

// Escalating drop weights: stage advances every ESCALATION_DROPS drops, shifting
// odds toward bigger pieces so runs end in 2-4 minutes instead of dragging on.
// Stage 0 keeps the first minute nearly loss-proof.
export const DROP_STAGES = [
  [5, 4, 3, 2, 1],
  [4, 4, 3, 3, 2],
  [3, 3, 4, 3, 3],
  [2, 3, 4, 4, 3],
  [1, 2, 3, 5, 4],
  [0, 2, 3, 5, 5],
];
export const ESCALATION_DROPS = 10;
