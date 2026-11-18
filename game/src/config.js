// Jakarta Heat: every tuning number, colour and story constant in one place.
// The world is a fixed 2600x2000 unit city; the renderer shows a 1280x720 window of it.

export const VIEW = { width: 1280, height: 720 };
export const TICK = 1 / 60;
export const WORLD = { width: 2600, height: 2000 };

export const START_CASH = 250;
export const DEBT = 5000;
export const PAYOUTS = [800, 1200, 1500, 1500];
export const MISSION_NAMES = ['Macet Total', 'Kopor Hilang', 'Balap Liar', 'Jebakan di Pelabuhan'];

export const SAVE_KEY = 'jakarta-heat.save.v1';

export const FOOT = {
  walk: 175,
  run: 265,
  accel: 1400,
  radius: 15,
  punchRange: 52,
  punchDamage: 34,
  punchCooldown: 0.38,
};

export const CAR = {
  accel: 430,
  brake: 700,
  reverseMax: 170,
  maxSpeed: 520,
  raceMaxSpeed: 650,
  turn: 2.6,
  grip: 6.5,
  driftGrip: 2.2,
  radius: 30,
  enterRange: 78,
};

export const HEALTH = { max: 100, regenDelay: 8, regenRate: 9, regenCap: 50 };

export const WANTED = {
  heatPerStar: 100,
  maxStars: 5,
  decayPerSecond: 7,
  evadeDelay: 5,
  evadeDecay: 26,
  // 4.5s of slow cornering before a bust: the escape route forces slow
  // turns with police glued behind, and 2.2s busted a fleeing player
  // mid-turn in four of five full verification runs. Flooring the
  // throttle never fills the meter, so this only catches a player who
  // genuinely stops or gives up next to a patrol car.
  bustTime: 4.5,
  bustFine: 150,
  deathFine: 100,
};

export const COMBAT = {
  pistolDamage: 40,
  pistolRange: 540,
  pistolCooldown: 0.3,
  startAmmo: 24,
  guardDamage: 9,
  guardRange: 520,
  goonDamage: 8,
};

// Golden hour: warm ground, amber light, teal glass, long soft shadows.
export const PALETTE = {
  groundDirt: '#b99a6d',
  groundGrass: '#7d8f57',
  groundPlaza: '#c8b18a',
  groundDock: '#8d8578',
  asphalt: '#4c4a52',
  asphaltDark: '#403e46',
  sidewalk: '#b3a58d',
  lane: '#e8d9a8',
  water: '#2e6f8e',
  waterDeep: '#245a76',
  wallCream: '#e6d6b8',
  wallTerra: '#c96f4a',
  wallBrick: '#a85f43',
  wallGlass: '#3f7d8c',
  wallSlate: '#6e7683',
  roofTile: '#b4552d',
  roofFlat: '#8a8073',
  roofDark: '#5d564c',
  faceSouth: '#8a6f52',
  faceEast: '#6f5a44',
  shadow: 'rgba(52,28,16,0.34)',
  text: '#f5efe2',
  muted: '#c9bda6',
  gold: '#f2c14e',
  goldDeep: '#c98f1f',
  panel: 'rgba(24,18,14,0.82)',
  panelEdge: 'rgba(242,193,78,0.55)',
  danger: '#e5534b',
  policeRed: '#ff4d4d',
  policeBlue: '#4da6ff',
  marker: '#ffd94d',
  health: '#7bc950',
  playerJacket: '#2e8f8a',
  playerSkin: '#c68e5f',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const FONT_NUM = '"SF Mono", "Cascadia Mono", Consolas, monospace';

export const SIGN_TEXTS = [
  'KOPI SENJA', 'WARUNG BU RATNA', 'HOTEL SENJA', 'BANK NUSANTARA', 'MAL SENJA',
  'BIOSKOP REX', 'PASAR PAGI', 'APOTEK SEHAT', 'TOKO BUKU', 'NASI GORENG 88',
  'GUDANG 7', 'BENGKEL JAYA', 'FOTO CERIA', 'ROTIBAKAR 24', 'SELAMAT DATANG',
];
