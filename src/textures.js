import { TIERS } from './config/tiers.js';

// Generates every game texture procedurally from a skin palette ($0 assets).
// Each tier gets a kawaii face baked in (open-eyes and a `${key}b` blink
// variant) — personality is half of what made Suika charming.
export function generateTextures(scene, palette) {
  const g = scene.add.graphics();

  const drawBase = (color, r) => {
    g.fillStyle(color, 1);
    g.fillCircle(r, r, r);
    g.fillStyle(0x000000, 0.18);
    g.fillCircle(r + r * 0.12, r + r * 0.15, r * 0.92);
    g.fillStyle(color, 1);
    g.fillCircle(r - r * 0.04, r - r * 0.05, r * 0.88);
    g.fillStyle(0xffffff, 0.28);
    g.fillCircle(r - r * 0.32, r - r * 0.35, r * 0.34);
  };

  const drawFace = (r, tierIdx, blink) => {
    const fc = 0x2b2b40;
    const eyeY = r - r * 0.08;
    const eyeDX = r * 0.3;
    const eyeR = Math.max(2, r * 0.09);
    if (blink || tierIdx === TIERS.length - 1) {
      // happy closed eyes (the Sun is permanently blissful)
      g.lineStyle(Math.max(2, r * 0.06), fc, 1);
      for (const s of [-1, 1]) {
        g.beginPath();
        g.arc(r + s * eyeDX, eyeY, eyeR * 1.4, Math.PI * 1.15, Math.PI * 1.85);
        g.strokePath();
      }
    } else {
      g.fillStyle(fc, 1);
      g.fillCircle(r - eyeDX, eyeY, eyeR);
      g.fillCircle(r + eyeDX, eyeY, eyeR);
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(r - eyeDX + eyeR * 0.3, eyeY - eyeR * 0.3, eyeR * 0.35);
      g.fillCircle(r + eyeDX + eyeR * 0.3, eyeY - eyeR * 0.3, eyeR * 0.35);
    }
    // angry brows for the Red Dwarf, smiles for everyone else
    if (tierIdx === 8 && !blink) {
      g.lineStyle(Math.max(2, r * 0.06), fc, 1);
      g.lineBetween(r - eyeDX - eyeR, eyeY - eyeR * 1.8, r - eyeDX + eyeR, eyeY - eyeR * 1.1);
      g.lineBetween(r + eyeDX + eyeR, eyeY - eyeR * 1.8, r + eyeDX - eyeR, eyeY - eyeR * 1.1);
    }
    g.lineStyle(Math.max(2, r * 0.06), fc, 1);
    g.beginPath();
    if (tierIdx === 8) {
      g.arc(r, r + r * 0.42, r * 0.18, Math.PI * 1.15, Math.PI * 1.85); // frown
    } else {
      g.arc(r, r + r * 0.18, r * 0.2 + tierIdx * 0.01 * r, Math.PI * 0.15, Math.PI * 0.85);
    }
    g.strokePath();
  };

  TIERS.forEach((tier, i) => {
    const color = palette[i];
    const r = tier.radius;
    const d = r * 2;
    for (const blink of [false, true]) {
      const key = blink ? tier.key + 'b' : tier.key;
      if (scene.textures.exists(key)) scene.textures.remove(key);
      g.clear();
      drawBase(color, r);
      drawFace(r, i, blink);
      g.generateTexture(key, d, d);
    }
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

  // vertical space gradient used as every scene's backdrop
  if (!scene.textures.exists('bg')) {
    g.clear();
    g.fillGradientStyle(0x141432, 0x141432, 0x0b0b1e, 0x06060f, 1);
    g.fillRect(0, 0, 480, 800);
    g.generateTexture('bg', 480, 800);
  }

  g.destroy();
}
