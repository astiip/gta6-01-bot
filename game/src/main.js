// Solmar Bay — Streets of Gold: the bootstrap, the game loop, and the wiring
// between the player, the city, the police, the missions and the HUD.
import { buildCity } from './city.js';
import { Traffic } from './vehicles.js';
import { Pedestrians, Gang } from './people.js';
import { createPlayer, bindInput, updatePlayer, updateCamera, exitCar } from './player.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { MissionManager, MISSION_NAMES } from './missions.js';
import { Hud } from './hud.js';
import { SoundBank } from './audio.js';
import { saveGame, loadGame, clearSave, freshStats } from './save.js';
import { stageShot } from './shots.js';
import { mulberry32, hashSeed } from './util.js';

const THREE = window.THREE;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const shotSeed = params.get('seed') || '1';

const state = {
  scene: null,
  camera: null,
  renderer: null,
  city: null,
  traffic: null,
  peds: null,
  gang: null,
  police: null,
  combat: null,
  missions: null,
  hud: null,
  audio: null,
  player: null,
  input: null,
  stats: freshStats(),
  started: false,
  paused: false,
  over: false,
  overTimer: 0,
  clock: null,
  time: 0,
};

function buildWorld(seedText) {
  const rng = mulberry32(hashSeed(seedText));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fd0f2);
  scene.fog = new THREE.Fog(0x8fd0f2, 180, 420);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
  camera.position.set(20, 6, -8);

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  document.getElementById('game').appendChild(renderer.domElement);

  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5a, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2cf, 1.6);
  sun.position.set(120, 180, 60);
  scene.add(sun);

  state.scene = scene;
  state.camera = camera;
  state.renderer = renderer;
  state.city = buildCity(scene, rng);
  state.traffic = new Traffic(scene, rng, state.city);
  state.peds = new Pedestrians(scene, rng, state.city);
  state.gang = new Gang(scene, rng, state.city);
  state.audio = new SoundBank();
  state.police = new Police(scene, rng, state.city);
  state.combat = new Combat(scene, state.audio);
  state.missions = new MissionManager(scene, state.city, state.audio);
  state.hud = new Hud();
  state.hud.bindCity(state.city);
  state.player = createPlayer(scene);
  state.input = bindInput(state.player);
  state.clock = new THREE.Clock();

  wireWorldCallbacks();
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function wireWorldCallbacks() {
  const world = {
    city: state.city,
    traffic: state.traffic,
    peds: state.peds,
    onSteal: (car) => {
      state.stats.carsStolen += 1;
      state.police.addStars(1, 'steal');
      state.missions.onCarStolen(car);
      state.hud.showBanner('Car stolen', 'The police have been alerted — 1 wanted star', 3);
      state.audio.pickup();
    },
    onPedHit: () => {
      state.police.addStars(1, 'pedestrian');
      state.hud.showBanner('Pedestrian hit', 'Witnesses called the police', 3);
    },
    onRam: (damage) => {
      // A ram only hurts once every 0.6 s — otherwise one touch drains the car.
      const now = state.time;
      if (now - (state.lastRam || 0) < 0.6) return;
      state.lastRam = now;
      damagePlayer(damage * 0.1);
      if (state.player.car) {
        state.player.car.health -= damage;
        if (state.player.car.health <= 0) wreckCar();
      }
    },
    onPlayerShot: (damage) => damagePlayer(damage),
    onBusted: () => endRun('BUSTED', 'The Solmar Bay PD caught you. You lost some cash — and the mission.'),
  };
  state.world = world;
  state.missions.onEvent = (event) => {
    if (event.type === 'announce') {
      state.hud.showBanner(event.title, event.text, 5);
    } else if (event.type === 'mission-complete') {
      state.player.cash += event.reward;
      state.stats.earned += event.reward;
      state.stats.missionsDone += 1;
      state.hud.showBanner('Mission complete', `${event.name} — earned $${event.reward}`, 5);
      saveGame(state);
    } else if (event.type === 'mission-failed') {
      state.hud.showBanner('Mission failed', event.reason, 4);
    } else if (event.type === 'story-complete') {
      state.hud.showBanner('King of Solmar', 'You took the city. Solmar Bay is yours — free roam, forever.', 8);
      saveGame(state);
    }
  };
  state.policeWorld = {
    onRam: world.onRam,
    onBusted: world.onBusted,
  };
}

function damagePlayer(amount) {
  if (state.over || !state.started) return;
  state.player.health -= amount;
  if (state.player.health <= 0) {
    state.player.health = 0;
    endRun('WASTED', 'Rico is down. The crew will pick him up — but the mission is lost.');
  }
}

function wreckCar() {
  const car = state.player.car;
  if (!car) return;
  state.audio.crash();
  state.hud.showBanner('Car wrecked', 'That car is finished — get out and find another', 3);
  exitCar(state.player, state.world);
  state.scene.remove(car.mesh);
  const i = state.traffic.parked.indexOf(car);
  if (i >= 0) state.traffic.parked.splice(i, 1);
}

function endRun(title, text) {
  if (state.over) return;
  state.over = true;
  state.overTimer = 0;
  state.stats[title === 'BUSTED' ? 'busted' : 'wasted'] += 1;
  state.audio.busted();
  state.hud.showOverlay(title, text);
  if (title === 'BUSTED') {
    state.player.cash = Math.floor(state.player.cash * 0.8);
  }
  state.police.clear();
  if (state.missions.active) state.missions.failMission(title === 'BUSTED' ? 'Busted by the police' : 'Rico was wasted');
  saveGame(state);
}

function respawn() {
  state.over = false;
  state.hud.hideOverlay();
  state.player.health = 100;
  state.player.x = state.city.plaza.x;
  state.player.z = state.city.plaza.z;
  state.player.heading = Math.PI;
  state.player.camYaw = Math.PI;
  if (state.player.mode === 'car') exitCar(state.player, state.world);
  state.player.mesh.position.set(state.player.x, 0, state.player.z);
  state.player.mesh.visible = true;
  state.camera.position.set(state.player.x, 6, state.player.z - 8);
  // The failed mission restarts so the story can continue.
  const failed = state.missions.index;
  if (state.missions.completed.indexOf(failed) < 0 && failed < MISSION_NAMES.length) {
    state.missions.start(failed);
  }
}

/** One fixed step of the whole simulation, shared by the live loop and the shots. */
function stepWorld(dt, input) {
  const s = state;
  s.time += dt;
  updatePlayer(s.player, input, dt, s.world);
  s.traffic.update(dt, s.player.car);
  s.peds.update(dt);
  s.police.update(dt, s.player, s.policeWorld);
  s.combat.update(dt, s.player);
  s.combat.gangFire(dt, s.gang, s.player, s.world);
  s.missions.update(dt, s.player, s);
  s.missions.marker.update(dt, s.time);
  // Clean up dead gang members and count the kills.
  for (const member of [...s.gang.list]) {
    if (member.dead) {
      s.gang.remove(member);
      s.stats.gangDown += 1;
      s.missions.onGangKilled();
      s.player.cash += 25;
    }
  }
  s.audio.update(dt, s.player.mode === 'car' && s.player.car ? Math.abs(s.player.car.speed) / 34 : 0, s.police.stars);
  updateCamera(s.player, s.camera, dt);
}

state.stepWorld = stepWorld;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(state.clock.getDelta(), 0.05);
  if (!state.started || state.paused || state.over) {
    if (state.over) {
      state.overTimer += dt;
      if (state.overTimer > 3) respawn();
    }
    state.renderer.render(state.scene, state.camera);
    return;
  }
  const input = state.input;
  if (input.pause) {
    input.pause = false;
    state.paused = true;
    state.hud.showOverlay('Paused', 'Press P to keep playing. Your progress is saved.');
  }
  if (input.mute) {
    input.mute = false;
    state.audio.toggleMute();
  }
  if (input.reload) {
    input.reload = false;
    state.combat.reload(state.player);
  }
  if (input.shoot && state.player.mode === 'foot') {
    input.shoot = false;
    const targets = [...state.gang.list, ...state.police.officers.map((o) => ({
      mesh: o.mesh, x: o.x, z: o.z, health: 2, dead: false,
    }))];
    const hit = state.combat.shoot(state.player, state.camera, targets);
    if (hit) {
      state.police.addStars(1, 'shooting');
      state.peds.scare(state.player.x, state.player.z, 30);
    }
  }
  if (input.punch && state.player.mode === 'foot') {
    input.punch = false;
    const hit = state.combat.punch(state.player, state.gang.list);
    if (hit) state.police.addStars(1, 'assault');
  }
  stepWorld(dt, input);
  state.hud.update(dt, state);
  state.renderer.render(state.scene, state.camera);
}

function startGame(fresh) {
  const save = fresh ? null : loadGame();
  if (save) {
    state.player.cash = save.cash || 0;
    state.player.x = save.player ? save.player.x : 20;
    state.player.z = save.player ? save.player.z : 8;
    state.player.health = save.player ? save.player.health : 100;
    state.stats = save.stats || freshStats();
    state.missions.completed = save.completed || [];
    state.missions.start(save.missionIndex || 0);
    state.hud.showBanner('Welcome back', `Continuing: ${state.missions.name} — $${state.player.cash} in the bank`, 5);
  } else {
    state.player.cash = 150;
    state.missions.start(0);
  }
  state.started = true;
  document.getElementById('start-screen').classList.add('hidden');
  state.audio.unlock();
  state.audio.click();
}

function wireStartScreen() {
  const save = loadGame();
  const continueBtn = document.getElementById('btn-continue');
  if (!save) {
    continueBtn.style.display = 'none';
  } else {
    continueBtn.textContent = `Continue — ${MISSION_NAMES[save.missionIndex] || 'Free Roam'} ($${(save.cash || 0).toLocaleString('en-US')})`;
  }
  document.getElementById('btn-new').addEventListener('click', () => {
    clearSave();
    state.stats = freshStats();
    startGame(true);
  });
  continueBtn.addEventListener('click', () => startGame(false));
  document.getElementById('btn-how').addEventListener('click', () => {
    document.getElementById('howto').classList.toggle('hidden');
  });
}

buildWorld(shotName ? `shot-${shotName}-${shotSeed}` : 'solmar-bay-1');
wireStartScreen();
window.__solmar = state;

if (shotName) {
  // Screenshot mode: skip the menu, stage the scene, render one frame.
  document.getElementById('start-screen').classList.add('hidden');
  state.started = true;
  stageShot(shotName, state, `shot-${shotName}-${shotSeed}`);
  state.hud.update(0.016, state);
  state.renderer.render(state.scene, state.camera);
  window.__shotReady = true;
} else {
  document.getElementById('status').textContent = 'Solmar Bay loaded. Choose New Game or Continue.';
  frame();
}
