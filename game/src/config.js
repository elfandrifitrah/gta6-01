// Jakarta Heat: every tuning number, colour and story figure in one place.

export const STEP = 1 / 60;
export const SAVE_KEY = 'jakarta-heat.save.v1';

export const WORLD = {
  half: 240,
  gap: 60,
  roadHalf: 7,
  avenueHalf: 12,
  avenueX: 0,
  waterX: 232,
  skylineR: 285,
};

/** The story's money: Bimo starts with $250, owes $5,000, and the four payouts clear it. */
export const CASH = { start: 250, debt: 5000, payouts: [800, 1200, 1500, 1500] };

export const MISSION_TITLES = ['Macet Total', 'Kopor Hilang', 'Balap Liar', 'Jebakan di Pelabuhan'];

export const PLAYER = {
  walk: 7,
  run: 11.5,
  radius: 0.7,
  health: 100,
  punchDamage: 22,
  punchRange: 2.6,
  punchGap: 0.45,
  shotDamage: 34,
  shotRange: 70,
  fireGap: 0.28,
  regen: 5,
  regenDelay: 5,
};

export const CAR = {
  accel: 17,
  brake: 28,
  reverseMax: 9,
  top: 34,
  grip: 5.5,
  steer: 2.5,
  radius: 2.3,
  offroadDrag: 1.6,
};

export const WANTED = { max: 5, bustTime: 3.2, evadeSight: 80, evadeTime: 8, decayTime: 5 };

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

/** Golden hour over Jakarta: violet sky, ember horizon, warm haze. */
export const PALETTE = {
  skyTop: [46, 30, 78],
  skyMid: [150, 62, 74],
  horizon: [255, 154, 61],
  sun: [255, 217, 138],
  haze: [232, 149, 106],
  ground: [104, 88, 66],
  grass: [96, 104, 58],
  road: [52, 50, 58],
  roadLine: [214, 190, 130],
  sidewalk: [141, 130, 112],
  plaza: [168, 148, 122],
  port: [110, 108, 104],
  water: [64, 84, 128],
  waterHi: [255, 190, 120],
  lampGlow: [255, 200, 120],
};

export const BUILDING_COLORS = [
  [214, 190, 160], [196, 172, 140], [178, 150, 122], [150, 132, 116],
  [188, 164, 132], [160, 140, 128], [140, 148, 160], [206, 178, 142],
  [172, 128, 104], [148, 118, 96], [190, 186, 172], [156, 134, 110],
];

export const TOWER_COLORS = [
  [120, 128, 148], [104, 116, 140], [136, 128, 118], [96, 108, 128],
  [150, 140, 124], [112, 100, 92],
];

export const SHIRT_COLORS = [
  [200, 70, 60], [60, 120, 190], [220, 180, 60], [70, 160, 90],
  [180, 90, 150], [230, 230, 220], [60, 60, 70], [220, 120, 50],
  [90, 170, 170], [150, 60, 60], [80, 100, 160], [190, 200, 90],
];

export const CAR_COLORS = [
  [200, 200, 205], [40, 42, 48], [150, 30, 30], [30, 60, 130],
  [180, 180, 170], [90, 100, 110], [200, 140, 40], [60, 90, 70],
];

export const SIGN_TEXTS = [
  ['WARUNG', 'nasi goreng · kopi'],
  ['KOPI', 'kopi tubruk'],
  ['BAKSO', 'bakso sapi'],
  ['TOKO', 'kelontong 24 jam'],
  ['NASI PADANG', 'rendang · ayam pop'],
  ['BENGKEL', 'las · tambal ban'],
  ['APOTEK', 'obat · vitamin'],
  ['SATE', 'sate ayam madura'],
  ['MARTABAK', 'manis · telur'],
  ['GADO-GADO', 'sayur · lontong'],
  ['ES TEH', 'manis dingin'],
  ['FOTOCOPY', 'print · jilid'],
];
