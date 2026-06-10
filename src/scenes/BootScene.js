import Phaser from 'phaser';
import { TIERS } from '../config/tiers.js';

// All art is generated procedurally ($0 asset budget): each tier is a flat
// circle with a highlight and subtle rim shading; plus a particle dot and
// a star for the background.
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    const g = this.add.graphics();

    TIERS.forEach((tier) => {
      const r = tier.radius;
      const d = r * 2;
      g.clear();
      // base
      g.fillStyle(tier.color, 1);
      g.fillCircle(r, r, r);
      // rim shadow
      g.fillStyle(0x000000, 0.18);
      g.fillCircle(r + r * 0.12, r + r * 0.15, r * 0.92);
      // re-fill body over shadow, slightly smaller
      g.fillStyle(tier.color, 1);
      g.fillCircle(r - r * 0.04, r - r * 0.05, r * 0.88);
      // highlight
      g.fillStyle(0xffffff, 0.28);
      g.fillCircle(r - r * 0.32, r - r * 0.35, r * 0.34);
      g.generateTexture(tier.key, d, d);
    });

    // ring overlay for the Ringed Giant
    const ringTier = TIERS[6];
    const rr = ringTier.radius;
    g.clear();
    g.lineStyle(Math.max(3, rr * 0.12), 0xfff3e0, 0.9);
    g.strokeEllipse(rr * 1.4, rr * 1.4, rr * 2.4, rr * 0.8);
    g.generateTexture('ring', rr * 2.8, rr * 2.8);

    // particle dot
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture('dot', 8, 8);

    // background star
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(2, 2, 2);
    g.generateTexture('star', 4, 4);

    g.destroy();
    this.scene.start('Menu');
  }
}
