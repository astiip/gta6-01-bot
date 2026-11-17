// Cars: the mesh factory, the traffic that fills the streets, the parked cars you
// can steal, and the arcade driving physics shared by the player and the police.
import { CITY, CAR_COLORS, CAR } from './config.js';
import { rand, pick, clamp, angleLerp, angleDiff } from './util.js';
import { resolveBuildingCollision } from './city.js';

const THREE = window.THREE;

/** Build a low-poly car from boxes. `police` adds a light bar and a black-white paint job. */
export function makeCarMesh(color, police) {
  const group = new THREE.Group();
  const bodyColor = police ? 0xf0f0f0 : color;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 0.62, 4.4),
    new THREE.MeshLambertMaterial({ color: bodyColor }),
  );
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.55, 2.1),
    new THREE.MeshLambertMaterial({ color: police ? 0x222226 : 0x1a2530 }),
  );
  cabin.position.set(0, 1.1, -0.25);
  group.add(cabin);
  const bumper = new THREE.Mesh(
    new THREE.BoxGeometry(2.05, 0.22, 0.3),
    new THREE.MeshLambertMaterial({ color: 0x222226 }),
  );
  bumper.position.set(0, 0.4, 2.2);
  group.add(bumper);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141416 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  const headMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0x554411 });
  for (const hx of [-0.65, 0.65]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.08), headMat);
    head.position.set(hx, 0.62, 2.22);
    group.add(head);
  }
  let lightBar = null;
  if (police) {
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(2.02, 0.3, 1.4),
      new THREE.MeshLambertMaterial({ color: 0x1a1a22 }),
    );
    door.position.set(0, 0.6, 0.2);
    group.add(door);
    lightBar = new THREE.Group();
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.18, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xd82020, emissive: 0x881111 }),
    );
    red.position.x = -0.45;
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.18, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x2040d8, emissive: 0x111188 }),
    );
    blue.position.x = 0.45;
    lightBar.add(red);
    lightBar.add(blue);
    lightBar.position.set(0, 1.48, -0.25);
    group.add(lightBar);
    lightBar.userData.red = red;
    lightBar.userData.blue = blue;
  }
  group.userData.wheels = wheels;
  group.userData.lightBar = lightBar;
  return group;
}

/** A car in the world: mesh plus the driving state the physics step moves. */
export function makeCar(scene, color, police, x, z, heading) {
  const mesh = makeCarMesh(color, police);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  return {
    mesh,
    x, z,
    heading,
    speed: 0,
    steer: 0,
    police: !!police,
    color,
    ai: null,
    parked: false,
    wanted: false,
    health: 100,
    dead: false,
  };
}

/** Arcade car step: accelerate, steer, roll, collide with buildings, stay in the city. */
export function stepCar(car, input, dt, city) {
  const accel = input.forward ? CAR.accel : input.back ? -CAR.reverseAccel : 0;
  car.speed += accel * dt;
  if (!input.forward && !input.back) {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), CAR.brake * 0.4 * dt);
  }
  if (input.back && car.speed > 0.5) car.speed -= CAR.brake * dt;
  car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
  const steerTarget = input.left ? 1 : input.right ? -1 : 0;
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  const turn = car.steer * CAR.steer * clamp(Math.abs(car.speed) / 8, 0, 1) * Math.sign(car.speed || 1);
  car.heading += turn * dt;
  const fx = Math.sin(car.heading);
  const fz = Math.cos(car.heading);
  car.x += fx * car.speed * dt;
  car.z += fz * car.speed * dt;
  car.x = clamp(car.x, -CITY.half - 6, CITY.half + 6);
  car.z = clamp(car.z, -CITY.half - 6, CITY.waterZ - 2);
  const fixed = resolveBuildingCollision(city, car.x, car.z, 1.6);
  if (fixed.x !== car.x || fixed.z !== car.z) {
    car.x = fixed.x;
    car.z = fixed.z;
    if (Math.abs(car.speed) > 6) car.speed *= 0.4;
  }
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  const spin = car.speed * dt / 0.36;
  for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
  if (car.mesh.userData.lightBar) {
    const on = Math.floor(performance.now() / 180) % 2 === 0;
    car.mesh.userData.lightBar.userData.red.material.emissive.setHex(on ? 0xff2020 : 0x330000);
    car.mesh.userData.lightBar.userData.blue.material.emissive.setHex(on ? 0x111188 : 0x2020ff);
  }
}

/** Traffic: cars that cruise the street grid on Manhattan routes. */
export class Traffic {
  constructor(scene, rng, city) {
    this.scene = scene;
    this.rng = rng;
    this.city = city;
    this.cars = [];
    this.parked = [];
    for (let i = 0; i < 14; i += 1) this.spawnCruiser();
    for (let i = 0; i < 8; i += 1) this.spawnParked();
  }

  spawnCruiser() {
    const s = pick(this.rng, CITY.streets);
    const t = rand(this.rng, -160, 160);
    const alongX = this.rng() < 0.5;
    const x = alongX ? t : s;
    const z = alongX ? s : t;
    const heading = alongX ? (this.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (this.rng() < 0.5 ? 0 : Math.PI);
    const car = makeCar(this.scene, pick(this.rng, CAR_COLORS), false, x, z, heading);
    car.ai = { target: this.randomIntersection(), speed: rand(this.rng, 8, 13), wait: 0 };
    this.cars.push(car);
    return car;
  }

  spawnParked() {
    const s = pick(this.rng, CITY.streets);
    const t = rand(this.rng, -160, 160);
    const alongX = this.rng() < 0.5;
    const lane = (this.rng() < 0.5 ? 1 : -1) * 3.4;
    const x = alongX ? t : s + lane;
    const z = alongX ? s + lane : t;
    const heading = alongX ? (this.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (this.rng() < 0.5 ? 0 : Math.PI);
    const car = makeCar(this.scene, pick(this.rng, CAR_COLORS), false, x, z, heading);
    car.parked = true;
    this.parked.push(car);
    return car;
  }

  randomIntersection() {
    return { x: pick(this.rng, CITY.streets), z: pick(this.rng, CITY.streets) };
  }

  /** Steal a parked car: remove it from the parked list and hand it to the player. */
  steal(car) {
    const i = this.parked.indexOf(car);
    if (i >= 0) this.parked.splice(i, 1);
    car.parked = false;
    return car;
  }

  nearestParked(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of this.parked) {
      const d = Math.hypot(car.x - x, car.z - z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  update(dt, playerCar) {
    for (const car of this.cars) {
      const ai = car.ai;
      const dx = ai.target.x - car.x;
      const dz = ai.target.z - car.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 4) {
        ai.target = this.randomIntersection();
        continue;
      }
      const wantHeading = Math.atan2(dx, dz);
      const diff = angleDiff(car.heading, wantHeading);
      const input = {
        forward: true,
        back: false,
        left: diff > 0.12,
        right: diff < -0.12,
      };
      // Ease off when another car is right ahead.
      let ahead = false;
      for (const other of this.cars) {
        if (other === car) continue;
        const ox = other.x - car.x;
        const oz = other.z - car.z;
        const forward = ox * Math.sin(car.heading) + oz * Math.cos(car.heading);
        const side = Math.abs(ox * Math.cos(car.heading) - oz * Math.sin(car.heading));
        if (forward > 0 && forward < 9 && side < 2.4) { ahead = true; break; }
      }
      if (ahead) input.forward = false;
      const cruise = ai.speed;
      const oldMax = CAR.maxSpeed;
      CAR.maxSpeed = cruise;
      stepCar(car, input, dt, this.city);
      CAR.maxSpeed = oldMax;
    }
  }
}
