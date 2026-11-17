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
  const car = makeCar(state.scene, 0xd84040, false, x, z, heading);
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
  const seconds = name === 'chase' ? 7 : name === 'drive' ? 8 : name === 'mission' ? 4 : 3;
  player.health = 100;
  player.cash = 2450;
  player.ammo = 9;
  player.reserveAmmo = 36;

  if (name === 'chase') {
    // Cover: a police chase with the wanted level, the minimap and a mission
    // objective all on the HUD at once. The car runs straight up the x=40
    // avenue so the autopilot never cuts across buildings; the police start
    // on the same avenue, right behind it.
    missions.start(2);
    missions.stepIndex = 1;
    missions.refreshMarker();
    putPlayerInCar(state, 40, 150, Math.PI);
    police.addStars(3, 'shot');
    for (let i = 0; i < 3; i += 1) {
      const pc = makeCar(state.scene, 0xf0f0f0, true, 40 + (i - 1) * 3.5, 150 + 18 + i * 12, Math.PI);
      pc.ai = { player: true };
      police.cars.push(pc);
    }
    for (let i = 0; i < seconds / STEP; i += 1) {
      const input = driveToward(state, 40, -160);
      state.stepWorld(STEP, input);
    }
    // Two police cars head-on ahead of the player, so the chase is visible
    // in the frame, and one more right behind it.
    for (let i = 0; i < 2; i += 1) {
      const pc = makeCar(state.scene, 0xf0f0f0, true, 40 + (i === 0 ? -2 : 2), player.z - 30 - i * 10, 0);
      pc.ai = { player: true };
      police.cars.push(pc);
    }
    const pcBehind = makeCar(state.scene, 0xf0f0f0, true, 40, player.z + 16, Math.PI);
    pcBehind.ai = { player: true };
    police.cars.push(pcBehind);
  } else if (name === 'drive') {
    missions.start(1);
    putPlayerInCar(state, -40, 120, Math.PI);
    for (let i = 0; i < seconds / STEP; i += 1) {
      const input = driveToward(state, -40, -160);
      state.stepWorld(STEP, input);
    }
  } else if (name === 'mission') {
    // Turf War mid-fight at the plaza: gang members closing in, two already down.
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
    // City: on foot in the plaza, traffic and pedestrians all around.
    missions.start(0);
    player.x = city.plaza.x + 10;
    player.z = city.plaza.z - 6;
    player.heading = Math.PI * 0.75;
    player.camYaw = player.heading;
    player.mesh.position.set(player.x, 0, player.z);
    for (let i = 0; i < seconds / STEP; i += 1) {
      state.stepWorld(STEP, { forward: false, back: false, left: false, right: false });
    }
  }
  // Face the camera at the action for the final frame.
  if (name === 'chase' || name === 'drive') {
    player.camYaw = player.heading;
  }
  // The mission-intro banner would cover the middle of the frame; the mission
  // box in the top-left already names the job, so hide it for the shot.
  state.hud.hideBanner();
  state.camera.position.set(
    player.x - Math.sin(player.camYaw) * (player.mode === 'car' ? 13 : 7.5),
    player.mode === 'car' ? 5.4 : 3.6,
    player.z - Math.cos(player.camYaw) * (player.mode === 'car' ? 13 : 7.5),
  );
  state.camera.lookAt(player.x, 1.4, player.z);
}
