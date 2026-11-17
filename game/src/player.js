// Rico Vega, the player: on-foot movement with a third-person camera, and the
// hand-off between walking and driving. The camera orbits with the mouse.
import { PLAYER, CAR, KEYS } from './config.js';
import { clamp, angleLerp } from './util.js';
import { resolveBuildingCollision } from './city.js';
import { makePersonMesh } from './people.js';
import { stepCar } from './vehicles.js';

const THREE = window.THREE;

export function createPlayer(scene) {
  const mesh = makePersonMesh(0x2a8a8a, 0x2a2a3a, 0xe8b890);
  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.12, 0.44),
    new THREE.MeshLambertMaterial({ color: 0xd84040 }),
  );
  cap.position.y = 1.94;
  mesh.add(cap);
  scene.add(mesh);
  return {
    mesh,
    x: 20, z: 8,
    heading: Math.PI,
    camYaw: Math.PI,
    camPitch: 0.32,
    speed: 0,
    vy: 0,
    onGround: true,
    mode: 'foot',
    car: null,
    health: PLAYER.maxHealth,
    cash: 0,
    ammo: 12,
    reserveAmmo: 48,
    punching: 0,
    bustedTimer: 0,
  };
}

/** Read the keyboard into a shared input object; mouse drag orbits the camera. */
export function bindInput(player) {
  const input = {
    forward: false, back: false, left: false, right: false,
    jump: false, run: false, enterCar: false, punch: false,
    reload: false, shoot: false, pause: false, mute: false,
    mouseDX: 0, mouseDY: 0,
  };
  const down = (e) => {
    switch (e.code) {
      case KEYS.forward: input.forward = true; break;
      case KEYS.back: input.back = true; break;
      case KEYS.left: input.left = true; break;
      case KEYS.right: input.right = true; break;
      case KEYS.jump: input.jump = true; e.preventDefault(); break;
      case KEYS.run: input.run = true; break;
      case KEYS.enterCar: input.enterCar = true; break;
      case KEYS.punch: input.punch = true; break;
      case KEYS.reload: input.reload = true; break;
      case KEYS.pause: input.pause = true; break;
      case KEYS.mute: input.mute = true; break;
    }
  };
  const up = (e) => {
    switch (e.code) {
      case KEYS.forward: input.forward = false; break;
      case KEYS.back: input.back = false; break;
      case KEYS.left: input.left = false; break;
      case KEYS.right: input.right = false; break;
      case KEYS.jump: input.jump = false; break;
      case KEYS.run: input.run = false; break;
      case KEYS.enterCar: input.enterCar = false; break;
      case KEYS.punch: input.punch = false; break;
      case KEYS.reload: input.reload = false; break;
      case KEYS.pause: input.pause = false; break;
      case KEYS.mute: input.mute = false; break;
    }
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  window.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    if (e.button === 0) input.shoot = true;
  });
  window.addEventListener('mouseup', (e) => {
    dragging = false;
    if (e.button === 0) input.shoot = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    input.mouseDX += e.clientX - lastX;
    input.mouseDY += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  return input;
}

/**
 * One step of the player. `world` carries city, traffic, police hooks and callbacks
 * (onSteal, onPedHit) so this module stays free of game-rule decisions.
 */
export function updatePlayer(player, input, dt, world) {
  // Camera orbit from mouse drag (shot autopilots pass no mouse deltas).
  player.camYaw -= (input.mouseDX || 0) * 0.005;
  player.camPitch = clamp(player.camPitch + (input.mouseDY || 0) * 0.004, 0.05, 1.1);
  input.mouseDX = 0;
  input.mouseDY = 0;

  if (player.mode === 'car' && player.car) {
    stepCar(player.car, input, dt, world.city);
    player.x = player.car.x;
    player.z = player.car.z;
    player.heading = player.car.heading;
    player.mesh.visible = false;
    if (input.enterCar) {
      input.enterCar = false;
      exitCar(player, world);
    }
    // Running over pedestrians in a car knocks them down and draws heat.
    for (const ped of world.peds.list) {
      if (ped.fallen) continue;
      const d = Math.hypot(ped.x - player.x, ped.z - player.z);
      if (d < 1.8 && Math.abs(player.car.speed) > 4) {
        world.peds.knockDown(ped);
        world.onPedHit(ped);
      }
    }
    return;
  }

  // On foot.
  const speedTarget = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const moving = input.forward || input.back || input.left || input.right;
  const camSin = Math.sin(player.camYaw);
  const camCos = Math.cos(player.camYaw);
  let mx = 0;
  let mz = 0;
  if (input.forward) { mx += camSin; mz += camCos; }
  if (input.back) { mx -= camSin; mz -= camCos; }
  if (input.left) { mx -= camCos; mz += camSin; }
  if (input.right) { mx += camCos; mz -= camSin; }
  const len = Math.hypot(mx, mz);
  if (len > 0) {
    mx /= len;
    mz /= len;
    player.heading = angleLerp(player.heading, Math.atan2(mx, mz), Math.min(1, dt * 10));
    player.speed += (speedTarget - player.speed) * Math.min(1, dt * 8);
    player.x += mx * player.speed * dt;
    player.z += mz * player.speed * dt;
  } else {
    player.speed += (0 - player.speed) * Math.min(1, dt * 10);
  }
  if (input.jump && player.onGround) {
    player.vy = PLAYER.jumpSpeed;
    player.onGround = false;
  }
  if (!player.onGround) {
    player.vy -= 22 * dt;
    player.mesh.position.y += player.vy * dt;
    if (player.mesh.position.y <= 0) {
      player.mesh.position.y = 0;
      player.vy = 0;
      player.onGround = true;
    }
  }
  const fixed = resolveBuildingCollision(world.city, player.x, player.z, PLAYER.radius);
  player.x = fixed.x;
  player.z = fixed.z;
  player.x = clamp(player.x, -204, 204);
  player.z = clamp(player.z, -204, 206);
  player.mesh.position.set(player.x, player.mesh.position.y, player.z);
  player.mesh.rotation.y = player.heading;
  const u = player.mesh.userData;
  u.walkPhase += dt * player.speed * 1.6;
  const swing = Math.sin(u.walkPhase) * 0.55 * clamp(player.speed / 6, 0, 1);
  u.legL.rotation.x = swing;
  u.legR.rotation.x = -swing;
  u.armL.rotation.x = -swing * 0.8;
  u.armR.rotation.x = swing * 0.8;
  if (player.punching > 0) {
    player.punching -= dt;
    u.armR.rotation.x = -1.4;
  }

  // Enter the nearest parked or traffic car.
  if (input.enterCar) {
    input.enterCar = false;
    const car = world.traffic.nearestParked(player.x, player.z, 3.5)
      || nearestTrafficCar(world, player.x, player.z, 3.5);
    if (car) {
      enterCar(player, car, world);
    }
  }
}

function nearestTrafficCar(world, x, z, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of world.traffic.cars) {
    if (Math.abs(car.speed) > 1) continue;
    const d = Math.hypot(car.x - x, car.z - z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function enterCar(player, car, world) {
  if (car.parked) world.traffic.steal(car);
  else {
    const i = world.traffic.cars.indexOf(car);
    if (i >= 0) world.traffic.cars.splice(i, 1);
  }
  player.car = car;
  player.mode = 'car';
  player.mesh.visible = false;
  car.speed = 0;
  world.onSteal(car);
}

export function exitCar(player, world) {
  const car = player.car;
  if (!car) return;
  player.mode = 'foot';
  player.car = null;
  player.mesh.visible = true;
  const side = 2.6;
  player.x = car.x + Math.cos(car.heading) * side;
  player.z = car.z - Math.sin(car.heading) * side;
  player.mesh.position.set(player.x, 0, player.z);
  // The car stays where it was left, now parked and stealable again.
  car.parked = true;
  car.speed = 0;
  world.traffic.parked.push(car);
}

/** Chase camera: behind the player or the car, smoothed, looking ahead. */
export function updateCamera(player, camera, dt) {
  const inCar = player.mode === 'car';
  const dist = inCar ? 11 : 7.5;
  const height = inCar ? 4.6 : 3.6;
  // While driving the camera settles behind the car; on foot it orbits freely.
  if (inCar) player.camYaw = angleLerp(player.camYaw, player.heading, Math.min(1, dt * 1.4));
  const yaw = player.camYaw;
  const tx = player.x - Math.sin(yaw) * dist;
  const tz = player.z - Math.cos(yaw) * dist;
  const ty = height - player.camPitch * 2;
  const k = Math.min(1, dt * 6);
  camera.position.x += (tx - camera.position.x) * k;
  camera.position.y += (ty - camera.position.y) * k;
  camera.position.z += (tz - camera.position.z) * k;
  camera.lookAt(player.x + Math.sin(yaw) * 3, 1.4, player.z + Math.cos(yaw) * 3);
}
