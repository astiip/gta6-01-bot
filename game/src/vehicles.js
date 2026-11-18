// Cars: the mesh factory, the traffic that fills the streets, the parked cars you
// can steal, and the arcade driving physics shared by the player and the police.
import { CITY, CAR_COLORS, CAR, CAR_NAMES } from './config.js';
import { rand, pick, clamp, angleLerp, angleDiff } from './util.js';
import { resolveBuildingCollision } from './city.js';

const THREE = window.THREE;

/** Build a detailed low-poly sports car from boxes. `police` adds a light bar and a black-white paint job. */
export function makeCarMesh(color, police) {
  const group = new THREE.Group();
  const paint = police ? 0xf0f0f0 : color;
  const dark = 0x181820;
  const glass = 0x141c26;
  const lam = (c, e) => new THREE.MeshLambertMaterial({ color: c, emissive: e || 0x000000 });
  const add = (geo, mat, x, y, z, rx) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (rx) m.rotation.x = rx;
    group.add(m);
    return m;
  };
  // Low, wide body over a dark lower skirt — two-tone paint.
  add(new THREE.BoxGeometry(2.0, 0.5, 4.5), lam(paint), 0, 0.52, 0);
  add(new THREE.BoxGeometry(2.04, 0.22, 4.1), lam(dark), 0, 0.28, 0);
  // Hood, front splitter and grille.
  add(new THREE.BoxGeometry(1.8, 0.1, 1.0), lam(paint), 0, 0.78, 1.55);
  add(new THREE.BoxGeometry(2.02, 0.12, 0.35), lam(dark), 0, 0.3, 2.28);
  add(new THREE.BoxGeometry(1.2, 0.16, 0.08), lam(dark), 0, 0.55, 2.26);
  // Glasshouse cabin with a painted roof panel.
  add(new THREE.BoxGeometry(1.62, 0.5, 1.9), lam(glass), 0, 1.0, -0.35);
  add(new THREE.BoxGeometry(1.5, 0.08, 1.5), lam(paint), 0, 1.28, -0.35);
  // Sloped windshield and rear glass.
  add(new THREE.BoxGeometry(1.55, 0.06, 0.7), lam(0x0e141c), 0, 1.08, 0.72, -0.5);
  add(new THREE.BoxGeometry(1.55, 0.06, 0.6), lam(0x0e141c), 0, 1.08, -1.32, 0.45);
  // Side mirrors.
  add(new THREE.BoxGeometry(0.16, 0.1, 0.3), lam(dark), -1.05, 1.05, 0.55);
  add(new THREE.BoxGeometry(0.16, 0.1, 0.3), lam(dark), 1.05, 1.05, 0.55);
  // Rear wing on two struts — the silhouette that reads as "sports car".
  add(new THREE.BoxGeometry(0.1, 0.28, 0.1), lam(dark), -0.7, 0.92, -2.0);
  add(new THREE.BoxGeometry(0.1, 0.28, 0.1), lam(dark), 0.7, 0.92, -2.0);
  add(new THREE.BoxGeometry(1.9, 0.07, 0.5), lam(paint), 0, 1.1, -2.05);
  // Centre stripe down the hood and roof (civilian cars only).
  if (!police) {
    add(new THREE.BoxGeometry(0.5, 0.03, 1.0), lam(dark), 0, 0.84, 1.55);
    add(new THREE.BoxGeometry(0.5, 0.03, 1.5), lam(dark), 0, 1.33, -0.35);
  }
  // Twin exhausts.
  const exhaustMat = lam(0x3a3a40);
  for (const ex of [-0.5, 0.5]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.25, 8), exhaustMat);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(ex, 0.32, -2.28);
    group.add(pipe);
  }
  // Wheels: tyre + light hub + crossed spokes, grouped so stepCar can spin them.
  const tireGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  const tireMat = lam(0x141416);
  const hubGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.32, 10);
  const hubMat = lam(0xc8c8d0);
  const spokeGeo = new THREE.BoxGeometry(0.34, 0.62, 0.12);
  const spokeMat = lam(0x3a3a44);
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Group();
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.rotation.z = Math.PI / 2;
    wheel.add(tire);
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.z = Math.PI / 2;
    wheel.add(hub);
    for (const a of [0, Math.PI / 2]) {
      const spoke = new THREE.Mesh(spokeGeo, spokeMat);
      spoke.rotation.x = a;
      wheel.add(spoke);
    }
    wheel.position.set(wx, 0.38, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  // Headlights: bright emissive pair; taillights: one full-width red bar.
  const headMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xaa8833 });
  for (const hx of [-0.65, 0.65]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.08), headMat);
    head.position.set(hx, 0.62, 2.26);
    group.add(head);
  }
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xd82020, emissive: 0xcc1818 });
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.14, 0.08), tailMat);
  tail.position.set(0, 0.62, -2.26);
  group.add(tail);
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
    name: police ? 'SOLMAR PD INTERCEPTOR' : CAR_NAMES[(color >>> 0) % CAR_NAMES.length],
    ai: null,
    parked: false,
    wanted: false,
    health: 100,
    drifting: false,
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
  // Drifting: hard steering at speed, sideways enough to light up the HUD.
  car.drifting = Math.abs(car.steer) > 0.65 && Math.abs(car.speed) > 15;
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
    for (let i = 0; i < 22; i += 1) this.spawnCruiser();
    for (let i = 0; i < 12; i += 1) this.spawnParked();
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
