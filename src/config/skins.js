// Collection album: each skin recolors the 10 merge tiers. Costs are tuned so
// the first unlock lands within a session or two (~200 stardust ≈ 2 decent runs)
// and the last is a long-term chase goal.
export const SKINS = [
  {
    id: 'classic', name: 'Classic', cost: 0,
    palette: [0xcfd8ff, 0x9aa7c7, 0x8d6e63, 0x80deea, 0xe0e0e0,
              0x66bb6a, 0xffb74d, 0x4fc3f7, 0xef5350, 0xffd54f],
  },
  {
    id: 'ocean', name: 'Deep Ocean', cost: 200,
    palette: [0xb3e5fc, 0x81d4fa, 0x4fc3f7, 0x29b6f6, 0x039be5,
              0x0288d1, 0x0277bd, 0x01579b, 0x26c6da, 0x00e5ff],
  },
  {
    id: 'candy', name: 'Candy Shop', cost: 300,
    palette: [0xfff9c4, 0xffe0b2, 0xffccbc, 0xf8bbd0, 0xf48fb1,
              0xce93d8, 0xb39ddb, 0xff80ab, 0xea80fc, 0xffeb3b],
  },
  {
    id: 'forest', name: 'Forest Floor', cost: 300,
    palette: [0xdcedc8, 0xc5e1a5, 0xaed581, 0x9ccc65, 0x8bc34a,
              0x7cb342, 0x689f38, 0x558b2f, 0xa1887f, 0xffd54f],
  },
  {
    id: 'lava', name: 'Molten Core', cost: 500,
    palette: [0xffe082, 0xffca28, 0xffb300, 0xffa000, 0xff8f00,
              0xff7043, 0xff5722, 0xf4511e, 0xd84315, 0xff1744],
  },
  {
    id: 'ice', name: 'Frozen Void', cost: 500,
    palette: [0xe1f5fe, 0xe0f7fa, 0xb2ebf2, 0xb3e5fc, 0x80deea,
              0x80d8ff, 0x40c4ff, 0x18ffff, 0x84ffff, 0xffffff],
  },
  {
    id: 'neon', name: 'Neon Nights', cost: 800,
    palette: [0xf4ff81, 0xccff90, 0xa7ffeb, 0x84ffff, 0x80d8ff,
              0xb388ff, 0xea80fc, 0xff80ab, 0xff9e80, 0x76ff03],
  },
  {
    id: 'mono', name: 'Monochrome', cost: 800,
    palette: [0xf5f5f5, 0xe0e0e0, 0xbdbdbd, 0x9e9e9e, 0x757575,
              0x616161, 0x424242, 0x303030, 0x8d8d8d, 0xffffff],
  },
  {
    id: 'sunset', name: 'Sunset Drive', cost: 1200,
    palette: [0xfff3e0, 0xffe0b2, 0xffab91, 0xff8a65, 0xf06292,
              0xba68c8, 0x9575cd, 0x7986cb, 0x4dd0e1, 0xffd740],
  },
  {
    id: 'royal', name: 'Royal Cosmos', cost: 2000,
    palette: [0xd1c4e9, 0xb39ddb, 0x9575cd, 0x7e57c2, 0x673ab7,
              0x5e35b1, 0x512da8, 0x4527a0, 0xffd700, 0xffecb3],
  },
];

export function skinById(id) {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}
