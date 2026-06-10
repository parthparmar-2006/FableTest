import { TIERS } from './config/tiers.js';

// Generates every game texture procedurally from a skin palette ($0 assets).
// Safe to call again after equipping a new skin: existing textures are
// replaced, and any scene started afterwards picks up the new colors.
export function generateTextures(scene, palette) {
  const g = scene.add.graphics();

  TIERS.forEach((tier, i) => {
    const color = palette[i];
    const r = tier.radius;
    const d = r * 2;
    if (scene.textures.exists(tier.key)) scene.textures.remove(tier.key);
    g.clear();
    g.fillStyle(color, 1);
    g.fillCircle(r, r, r);
    g.fillStyle(0x000000, 0.18);
    g.fillCircle(r + r * 0.12, r + r * 0.15, r * 0.92);
    g.fillStyle(color, 1);
    g.fillCircle(r - r * 0.04, r - r * 0.05, r * 0.88);
    g.fillStyle(0xffffff, 0.28);
    g.fillCircle(r - r * 0.32, r - r * 0.35, r * 0.34);
    g.generateTexture(tier.key, d, d);
  });

  const rr = TIERS[6].radius;
  if (scene.textures.exists('ring')) scene.textures.remove('ring');
  g.clear();
  g.lineStyle(Math.max(3, rr * 0.12), 0xfff3e0, 0.9);
  g.strokeEllipse(rr * 1.4, rr * 1.4, rr * 2.4, rr * 0.8);
  g.generateTexture('ring', rr * 2.8, rr * 2.8);

  if (!scene.textures.exists('dot')) {
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture('dot', 8, 8);
  }

  if (!scene.textures.exists('star')) {
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(2, 2, 2);
    g.generateTexture('star', 4, 4);
  }

  g.destroy();
}
