// Solmar Bay configuration: the city layout, the palette, tuning, and controls.
// One place for every number a designer would want to tweak.
export const CITY = {
  half: 200,
  streets: [-160, -120, -80, -40, 0, 40, 80, 120, 160],
  roadWidth: 10,
  sidewalkWidth: 15,
  beachZ: 178,
  waterZ: 208,
};

// Golden hour: the whole city is lit by a low sunset over the west sea, so the
// palette runs warm — pink-orange sky, amber sun, long warm light on the streets.
export const PALETTE = {
  sky: 0xff9a5c,
  skyTop: '#3a2350',
  skyMid: '#ff7e5f',
  skyLow: '#feb47b',
  fog: 0xf2a06a,
  sun: 0xffb060,
  ground: 0x5a5460,
  road: 0x33303a,
  sidewalk: 0xa89a86,
  grass: 0x5f9e58,
  sand: 0xf0cf9a,
  water: 0x2f7fa8,
  plaza: 0xc0b096,
};

export const BUILDING_COLORS = [
  '#e8a06a', '#d98a5a', '#f2c078', '#c98a7a', '#e8b88a',
  '#d88a8a', '#c8a06a', '#e0a878', '#f0d0a0', '#b88a9a',
];

export const CAR_COLORS = [
  0xd84040, 0x3a6fd8, 0xe8c832, 0x38b878, 0xe8e8e8,
  0x222226, 0xc878d8, 0xe88028, 0x40c8d8, 0x8838d8,
];

// Named rides: the HUD shows the car you are driving, not just a speed number.
export const CAR_NAMES = [
  'VELOCE GT', 'COMET S', 'SUNSET COUPE', 'PALM RUNNER', 'MARINA GT',
  'CORAL SEDAN', 'STRIP CRUISER', 'DUSK ROADSTER', 'TIDE HATCH', 'GOLD COUPE',
];

export const DISTRICTS = [
  // { name, x0, x1, z0, z1 } — the minimap shows where Rico is right now.
  { name: 'NORTH DOCKS', x0: -220, x1: 220, z0: -220, z1: -120 },
  { name: 'MIRAMAR STRIP', x0: -220, x1: 220, z0: -120, z1: 40 },
  { name: 'CORAL STRAND', x0: -220, x1: 220, z0: 40, z1: 150 },
  { name: 'COQUINA BEACH', x0: -220, x1: 220, z0: 150, z1: 220 },
];

export function districtName(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d.name;
  }
  return 'SOLMAR BAY';
}

export const RADIO_STATIONS = [
  { station: 'SOLMAR FM 88.1', track: 'Sunset Drive — The Palmettos' },
  { station: 'SOLMAR FM 88.1', track: 'Golden Mile — Luna Mar' },
  { station: 'SOLMAR FM 88.1', track: 'Heatwave Nights — Coral Kings' },
  { station: 'SOLMAR FM 88.1', track: 'Neon Palms — Dusk Avenue' },
];

export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 10,
  accel: 40,
  jumpSpeed: 7,
  radius: 0.6,
  height: 1.8,
  maxHealth: 100,
};

export const CAR = {
  accel: 16,
  brake: 30,
  reverseAccel: 10,
  maxSpeed: 34,
  maxReverse: 10,
  steer: 1.9,
  grip: 6,
};

export const POLICE = {
  maxStars: 5,
  chaseSpeed: 30,
  spawnDistance: 70,
  bustTime: 2.2,
  decaySeconds: 22,
  heliMinStars: 3,
};

export const KEYS = {
  forward: 'KeyW',
  back: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  jump: 'Space',
  run: 'ShiftLeft',
  enterCar: 'KeyE',
  punch: 'KeyF',
  reload: 'KeyR',
  pause: 'KeyP',
  mute: 'KeyM',
};

export const SAVE_KEY = 'solmarbay-save-v1';

export const MISSION_REWARDS = [400, 700, 900, 1200, 2000, 2500, 3500, 5000];
