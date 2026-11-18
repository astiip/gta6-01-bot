// Deterministic screenshot scenes: each one plays the real game forward from a
// fresh world for a fixed number of steps, steered by a simple autopilot, so the
// frame is what a short game really looks like. ?shot=chase|city|drive|mission.
import { hashSeed, mulberry32, angleDiff } from './util.js';
import { makeCar } from './vehicles.js';
import { CAR_COLORS } from './config.js';
import { pick } from './util.js';

const STEP = 1 / 60;

/** Drive toward a point: the autopilot behind the chase and drive shots. */
function driveToward(state, tx, tz) {
  const car = state.player.car;
  if (!car) return { forward: false, back: false, left: false, right: false };
  const dx = tx - car.x;
  const dz = tz - car.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 5) return { forward: false, back: false, left: false, right: false };
  const want = Math.atan2(dx, dz);
  const diff = angleDiff(car.heading, want);
  return {
    forward: true,
    back: false,
    left: diff > 0.08,
    right: diff < -0.08,
  };
}

/** Put the player in a car at (x, z) facing `heading`. */
function putPlayerInCar(state, x, z, heading) {
  // The player's ride: a hot-pink VESPERA GT, the cover car's colour.
  const car = makeCar(state.scene, 0xe83a8c, false, x, z, heading);
  car.name = 'VESPERA GT';
  state.player.car = car;
  state.player.mode = 'car';
  state.player.mesh.visible = false;
  state.player.x = x;
  state.player.z = z;
  state.player.heading = heading;
  state.player.camYaw = heading;
  return car;
}

/**
 * Stage a shot: reset the world, set the scene up, run it forward, and return.
 * The caller renders one frame and screenshots it.
 */
export function stageShot(name, state, seedText) {
  const rng = mulberry32(hashSeed(seedText || `shot-${name}-1`));
  const { player, police, missions, gang, traffic, peds, city } = state;
  const seconds = name === 'chase' ? 4 : name === 'drive' ? 8 : name === 'mission' ? 4 : 3;
  player.health = 100;
  player.armour = 50;
  player.cash = 12450;
  player.ammo = 9;
  player.reserveAmmo = 36;

  if (name === 'chase') {
    // Cover: a golden-hour police chase — 3 wanted stars, the helicopter and
    // its searchlight, the full HUD, and a mission objective at once. The car
    // runs south down the x=40 avenue toward the beach, straight into the low
    // sun, so the sunset fills the frame ahead like the top cover does; the
    // police start on the same avenue, right behind it.
    missions.start(2);
    missions.stepIndex = 1;
    missions.refreshMarker();
    putPlayerInCar(state, 40, 40, 0);
    police.addStars(3, 'shot');
    for (let i = 0; i < 3; i += 1) {
      const pc = makeCar(state.scene, 0xf0f0f0, true, 40 + (i - 1) * 3.5, 40 - 18 - i * 12, 0);
      pc.ai = { player: true };
      police.cars.push(pc);
    }
    for (let i = 0; i < seconds / STEP; i += 1) {
      const input = driveToward(state, 40, 170);
      state.stepWorld(STEP, input);
    }
    // Two police cars flanking close behind the player — just behind it, at
    // the frame's lower left and right, the way the cover frames the chase —
    // and two more head-on ahead of it, so the chase is visible in the frame.
    // The flankers sit 2 m behind the player (8 m from the camera): close
    // enough to read as pursuit, far enough not to swallow the minimap.
    for (const fx of [-4.5, 4.5]) {
      const pc = makeCar(state.scene, 0xf0f0f0, true, player.x + fx, player.z - 2.0, 0);
      pc.ai = { player: true };
      police.cars.push(pc);
    }
    for (let i = 0; i < 2; i += 1) {
      const pc = makeCar(state.scene, 0xf0f0f0, true, 40 + (i === 0 ? -2 : 2), player.z + 26 + i * 10, Math.PI);
      pc.ai = { player: true };
      police.cars.push(pc);
    }
    // The helicopter hangs low ahead of the player for the frame, its
    // searchlight beam on the street — during play it rides higher.
    if (police.heli) {
      police.heli.x = player.x + 4;
      police.heli.z = player.z + 32;
      police.heli.y = 12;
      police.heli.mesh.position.set(police.heli.x, police.heli.y, police.heli.z);
      police.heli.mesh.rotation.y = Math.atan2(player.x - police.heli.x, player.z - police.heli.z);
      police.heli.beam.position.x = (player.x - police.heli.x) * 0.25;
      police.heli.beam.position.z = (player.z - police.heli.z) * 0.25;
    }
  } else if (name === 'drive') {
    // Drift run down the x=-40 avenue: the autopilot weaves with a sine target
    // so the car slides at speed and the real drift combo pays out on the HUD.
    missions.start(1);
    putPlayerInCar(state, -40, 120, Math.PI);
    for (let i = 0; i < seconds / STEP; i += 1) {
      const t = i * STEP;
      const input = driveToward(state, -40 + Math.sin(t * 1.1) * 26, -160);
      state.stepWorld(STEP, input);
    }
    // If the weave never slid, hold a hard turn until the drift actually fires.
    if (!state.driftCombo) {
      for (let i = 0; i < 150; i += 1) {
        state.stepWorld(STEP, { forward: true, back: false, left: true, right: false });
      }
    }
    // One fresh copy of the drift feedback the run really earned, so the still
    // frame carries it — the combo and the payout are the run's own numbers.
    // It is pinned: a slow headless capture must not outrun its lifetime.
    if (state.driftCombo) {
      state.hud.feedbackEl.innerHTML = '';
      state.hud.showFeedback(`DRIFT x${state.driftCombo}`, `+$${state.driftCombo * 50}`);
      state.hud.feedbackPinned = true;
    }
  } else if (name === 'mission') {
    // Turf War mid-fight at the plaza: gang members closing in, two already down,
    // Mara's dialogue card on the HUD.
    missions.start(3);
    player.x = city.plaza.x + 14;
    player.z = city.plaza.z + 10;
    player.heading = Math.atan2(city.plaza.x - player.x, city.plaza.z - player.z);
    player.camYaw = player.heading;
    player.mesh.position.set(player.x, 0, player.z);
    const step = missions.currentStep;
    step.spawned = true;
    const squad = gang.spawnSquad(city.plaza.x, city.plaza.z, 6);
    squad[0].dead = true;
    squad[1].dead = true;
    for (const m of squad) {
      if (m.dead) {
        m.mesh.rotation.x = -Math.PI / 2;
        m.mesh.position.y = 0.3;
      }
    }
    for (let i = 0; i < seconds / STEP; i += 1) {
      state.stepWorld(STEP, { forward: false, back: false, left: false, right: false });
    }
  } else {
    // City: on foot on the beach boulevard at golden hour — the Solmar Wheel,
    // the low sun over the southwest sea, palms down the Strip, Mara's dialogue.
    // Facing southwest puts the sun disc and the Wheel in the same frame.
    missions.start(0);
    player.x = 40;
    player.z = 168;
    player.heading = -1.35;
    player.camYaw = player.heading;
    player.mesh.position.set(player.x, 0, player.z);
    for (let i = 0; i < seconds / STEP; i += 1) {
      state.stepWorld(STEP, { forward: false, back: false, left: false, right: false });
    }
  }
  // The mission timer counts from the mission's real start (time 0), not
  // from the first HUD paint after staging — otherwise every shot would read 0:00.
  if (missions.active) {
    state.hud.missionIndex = missions.index;
    state.hud.missionStartTime = 0;
  }
  // Face the camera at the action for the final frame.
  if (name === 'chase' || name === 'drive') {
    player.camYaw = player.heading;
  }
  // The mission-intro banner would cover the middle of the frame; the mission
  // box in the top-left already names the job, so hide it for the shot.
  state.hud.hideBanner();
  // Close chase cam: the car fills the frame, low and tight behind it.
  state.camera.position.set(
    player.x - Math.sin(player.camYaw) * (player.mode === 'car' ? 9.5 : 7.5),
    player.mode === 'car' ? 4.0 : 3.6,
    player.z - Math.cos(player.camYaw) * (player.mode === 'car' ? 9.5 : 7.5),
  );
  state.camera.lookAt(player.x, 1.4, player.z);
}
