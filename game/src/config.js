// Jakarta Heat: every tuning number in one place. The city is a 5 by 5 grid
// of blocks separated by roads; all coordinates are metres, +X east, +Z south.
// Traffic keeps left, as in Indonesia. The bay lies to the south.
export const SEED_DEFAULT = 20261117;

// City geometry.
export const BLOCKS = 5;
export const BLOCK = 40;
export const ROAD = 12;
export const PITCH = BLOCK + ROAD;
export const EXTENT = BLOCKS * BLOCK + (BLOCKS + 1) * ROAD; // 272
export const HALF = EXTENT / 2; // 136
export const SIDEWALK = 2.5;

// Road centre lines, one per road strip, in world coordinates.
export const ROAD_CENTRES = [];
for (let i = 0; i <= BLOCKS; i += 1) ROAD_CENTRES.push(-HALF + ROAD / 2 + i * PITCH);

// The grand corridor: Jl. Sudirman runs north-south at x = 26, with the
// busway in its median. The grand roundabout sits where it meets Jl. Thamrin.
export const CORRIDOR_X = 26;
export const ROUNDABOUT = { x: 26, z: -26, circleRadius: 11, fountainRadius: 4.2 };

// Named places. The mission script and the respawns use these.
export const PLACES = {
  bengkel: { x: -104, z: 88, label: 'Bengkel Sumber Jaya' },
  hotel: { x: 104, z: -78, label: 'Hotel Merdeka' },
  port: { x: 104, z: 148, label: 'Pelabuhan' },
  gudang: { x: 104, z: 12, label: 'Gudang Kalong' },
  chopShop: { x: -104, z: 60, label: 'Bengkel Potong' },
  police: { x: -52, z: -28, label: 'Kantor Polisi' },
  hospital: { x: 0, z: 88, label: 'Rumah Sakit' },
  monument: { x: 0, z: 0, label: 'Tugu Semangat' },
  roundabout: { x: 26, z: -26, label: 'Bundaran Semangat' },
  market: { x: 104, z: -104, label: 'Pasar Pagi' },
  mosque: { x: 52, z: 0, label: 'Masjid Agung' },
  kotaTua: { x: -104, z: -104, label: 'Kota Tua' },
  kampung: { x: 104, z: 104, label: 'Kampung Melayu' },
};

export const PLAYER_START = { x: -96, z: 78, heading: 0 };

// On-foot movement.
export const ON_FOOT = {
  walkSpeed: 4.2,
  runSpeed: 7.2,
  radius: 0.55,
  punchRange: 1.9,
  punchDamage: 30,
  punchCooldown: 0.45,
  shotDamage: 34,
  shotRange: 60,
  shotCooldown: 0.22,
  magazine: 12,
  reloadTime: 1.3,
};

// Driving.
export const DRIVING = {
  accel: 15,
  brake: 32,
  reverseMax: 9,
  maxSpeed: 38,
  drag: 0.55,
  grip: 2.6,
  steerMax: 0.55,
  wheelBase: 2.8,
  radius: 2.3,
  enterRange: 3.6,
};

// Wanted level: heat 0..100 maps to stars; crimes add heat, hiding removes it.
export const WANTED = {
  starAt: [10, 25, 45, 65, 85],
  steal: 20,
  hitPed: 15,
  killPed: 30,
  shot: 6,
  hitCop: 20,
  decayDelay: 8,
  decayRate: 4,
  evadeRadius: 50,
  evadeTime: 20,
  policeByStar: [0, 1, 2, 3, 4, 4],
  bustFootRange: 6,
  bustFootTime: 2.5,
  bustCarRange: 5,
  bustCarTime: 4,
};

// Traffic and pedestrians.
export const TRAFFIC_COUNT = 8;
export const BIKE_COUNT = 12;
export const BUS_COUNT = 2;
export const PED_COUNT = 12;
export const PARKED_COUNT = 6;
export const TRAFFIC_SPEED = 8.5;

// Story: Bimo owes Bu Ratna $5,000. Four jobs pay it off.
export const DEBT_TOTAL = 5000;
export const START_CASH = 250;
export const BUST_PENALTY = 0.15;
export const WASTE_PENALTY = 0.15;

export const SAVE_KEY = 'jakarta-heat-save-v1';

// Palette: tropical golden hour — warm haze, deep blue-glass towers,
// terracotta roofs, red-and-white flags.
export const COLORS = {
  skyTop: 0x2e6fc4,
  skyHorizon: 0xffb36b,
  fog: 0xf0c096,
  ground: 0x8d8a7a,
  concrete: 0x9a968c,
  water: 0x2e6f8e,
  asphalt: 0x3a3d43,
  busway: 0x8a4a3c,
  sidewalk: 0xb5afa2,
  building: [0xd8cfc0, 0xc9b8a3, 0xb7c0c9, 0xd9b48f, 0xa8b5a0, 0xc4a9a9, 0xe0d9c8, 0x9fb2c8],
  glassTower: [0x5a7fa8, 0x4a6f96, 0x6a8fb8, 0x3e5f86, 0x7a9cc4],
  roof: 0x6b6259,
  roofTerracotta: 0xa85a38,
  roofMetal: [0x8a8f94, 0x7a6a55, 0x5f7a5a, 0x946a4a],
  carPaint: [0xd8d8d8, 0x333a42, 0xc0c4c8, 0x2e5f8a, 0x8a2f3d, 0x3a3a3a, 0xd9a441, 0x4d7c5f],
  suvPaint: [0xe8e8e8, 0x2a2d33, 0x5a6a7a, 0x7a3a2e],
  policePaint: 0x1f3a6e,
  taxiPaint: 0x7ab8c9,
  angkotPaint: 0x2e8a6e,
  bajajOrange: 0xe87f2e,
  bajajBlue: 0x2e5f9e,
  busRed: 0xc23a2e,
  busWhite: 0xf0f0ea,
  glass: 0x1d2733,
  tyre: 0x1a1a1a,
  treeTrunk: 0x6d4c33,
  treeLeaf: [0x3f7a3a, 0x4e8a42, 0x2f6d33, 0x5d8a3a],
  palmLeaf: 0x3e7a34,
  skin: [0xc98d5f, 0xa86a42, 0x8a5a36, 0xe0ac7e, 0x6e4526],
  shirt: [0xc94f43, 0x3f6d9e, 0xe0c53f, 0x5f9e6b, 0x8a5fa8, 0xe8e8e8, 0x3a3f4a],
  pants: [0x2e3a4d, 0x4a3a2e, 0x5a5a5a, 0x27331f],
  ojekGreen: 0x1f8a4c,
  guardBlue: 0x2a3a5e,
  hijab: [0xc94f6e, 0x3f6d9e, 0xe0c53f, 0x5f9e6b, 0x8a5fa8, 0x7a4a2e, 0xe8e8e8, 0x2a2a2e],
};
