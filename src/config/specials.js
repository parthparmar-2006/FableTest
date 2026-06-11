// Special pieces: variable rewards living inside the drop stream itself.
// Probabilities are per-drop and mutually exclusive (~1 in 11 drops total).
export const SPECIALS = {
  gold: { chance: 1 / 25, badge: '⭐', scoreMult: 3 },
  prism: { chance: 1 / 35, badge: '🌈' },
  bomb: { chance: 1 / 40, badge: '💣', fuseMs: 1200, radius: 120, pointsPer: 5 },
};

/** Roll a special type for a new drop, or null. */
export function rollSpecial(rand) {
  let r = rand();
  for (const [kind, def] of Object.entries(SPECIALS)) {
    if (r < def.chance) return kind;
    r -= def.chance;
  }
  return null;
}
