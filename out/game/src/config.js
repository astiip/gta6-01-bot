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

export const PALETTE = {
  sky: 0x8fd0f2,
  sun: 0xfff2cf,
  ground: 0x565661,
  road: 0x2f2f38,
  sidewalk: 0x9a978c,
  grass: 0x62a85e,
  sand: 0xe9d6a4,
  water: 0x2b7fb8,
  plaza: 0xb8b2a4,
};

export const BUILDING_COLORS = [
  '#e8b48c', '#d99a7a', '#c98f6b', '#f2d3a0', '#a8c8d8',
  '#d8a0a0', '#b8c8a0', '#e0c8e8', '#f0e0c0', '#98b8c8',
];

export const CAR_COLORS = [
  0xd84040, 0x3a6fd8, 0xe8c832, 0x38b878, 0xe8e8e8,
  0x222226, 0xc878d8, 0xe88028, 0x40c8d8, 0x8838d8,
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

export const MISSION_REWARDS = [400, 700, 900, 1200, 2000, 5000];
