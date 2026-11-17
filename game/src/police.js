// The wanted system: stars that rise with crime, police cars and officers who
// chase, ram and try to bust the player, and the slow cool-down when you lay low.
import { POLICE, CITY } from './config.js';
import { rand, pick, clamp, angleDiff, angleLerp } from './util.js';
import { makeCar, stepCar } from './vehicles.js';
import { makePersonMesh } from './people.js';

const THREE = window.THREE;

export class Police {
  constructor(scene, rng, city) {
    this.scene = scene;
    this.rng = rng;
    this.city = city;
    this.stars = 0;
    this.cars = [];
    this.officers = [];
    this.decayTimer = 0;
    this.spawnTimer = 0;
    this.heat = 0;
  }

  addStars(n, reason) {
    const before = this.stars;
    this.stars = clamp(this.stars + n, 0, POLICE.maxStars);
    this.decayTimer = 0;
    if (this.stars > before) this.heat = 1;
    return this.stars;
  }

  clear() {
    this.stars = 0;
    this.decayTimer = 0;
    for (const car of this.cars) this.scene.remove(car.mesh);
    for (const off of this.officers) this.scene.remove(off.mesh);
    this.cars = [];
    this.officers = [];
  }

  wantedCount() {
    return this.stars;
  }

  /** How many police units the current wanted level should field. */
  desiredUnits() {
    return this.stars === 0 ? 0 : this.stars + 1;
  }

  spawnCarNear(player) {
    const angle = this.rng() * Math.PI * 2;
    const x = clamp(player.x + Math.cos(angle) * POLICE.spawnDistance, -190, 190);
    const z = clamp(player.z + Math.sin(angle) * POLICE.spawnDistance, -190, 190);
    const car = makeCar(this.scene, 0xf0f0f0, true, x, z, Math.atan2(player.x - x, player.z - z));
    car.ai = { player: true };
    this.cars.push(car);
    return car;
  }

  spawnOfficerNear(player) {
    const angle = this.rng() * Math.PI * 2;
    const x = clamp(player.x + Math.cos(angle) * 12, -190, 190);
    const z = clamp(player.z + Math.sin(angle) * 12, -190, 190);
    const mesh = makePersonMesh(0x1a2a4a, 0x1a1a22, pick(this.rng, [0xe8b890, 0xc89068, 0x8a5a3a]));
    const hat = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.1, 0.46),
      new THREE.MeshLambertMaterial({ color: 0x101018 }),
    );
    hat.position.y = 1.92;
    mesh.add(hat);
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const officer = { mesh, x, z, heading: 0, speed: 0, bustProgress: 0 };
    this.officers.push(officer);
    return officer;
  }

  update(dt, player, world) {
    // Keep the field at the wanted level's strength.
    const want = this.desiredUnits();
    this.spawnTimer -= dt;
    if (this.cars.length + this.officers.length < want && this.spawnTimer <= 0) {
      this.spawnTimer = 2.5;
      if (player.mode === 'car' || this.rng() < 0.6) this.spawnCarNear(player);
      else this.spawnOfficerNear(player);
    }
    // Too many units (stars fell): send the extras home.
    while (this.cars.length + this.officers.length > want) {
      if (this.cars.length > 0) {
        const car = this.cars.pop();
        this.scene.remove(car.mesh);
      } else {
        const off = this.officers.pop();
        this.scene.remove(off.mesh);
      }
    }

    // Police cars chase and ram.
    for (const car of this.cars) {
      const dx = player.x - car.x;
      const dz = player.z - car.z;
      const dist = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      const diff = angleDiff(car.heading, wantHeading);
      const input = {
        forward: dist > 4,
        back: false,
        left: diff > 0.1,
        right: diff < -0.1,
      };
      const cruise = POLICE.chaseSpeed;
      const oldMax = 34;
      stepCar(car, input, dt, this.city);
      car.speed = clamp(car.speed, -10, cruise);
      // Ramming the player's car damages it; touching the player on foot hurts.
      if (player.mode === 'car' && player.car && dist < 3.4) {
        player.car.speed *= 0.85;
        car.speed *= 0.7;
        if (world.onRam) world.onRam(6);
      }
      if (player.mode === 'foot' && dist < 2.2) {
        if (world.onRam) world.onRam(10 * dt);
      }
    }

    // Officers on foot chase and try to bust the player.
    for (const off of this.officers) {
      const dx = player.x - off.x;
      const dz = player.z - off.z;
      const dist = Math.hypot(dx, dz);
      if (player.mode === 'car') {
        // Officers give up on a speeding car and jog back to the street.
        off.speed = 2;
        off.heading = angleLerp(off.heading, Math.atan2(-dx, -dz), Math.min(1, dt * 2));
      } else {
        off.heading = angleLerp(off.heading, Math.atan2(dx, dz), Math.min(1, dt * 4));
        off.speed = dist > 3 ? 5.2 : 2.2;
        if (dist < 2.0) {
          off.bustProgress += dt;
          if (off.bustProgress > POLICE.bustTime && world.onBusted) world.onBusted();
        } else {
          off.bustProgress = Math.max(0, off.bustProgress - dt);
        }
      }
      off.x += Math.sin(off.heading) * off.speed * dt;
      off.z += Math.cos(off.heading) * off.speed * dt;
      off.mesh.position.set(off.x, 0, off.z);
      off.mesh.rotation.y = off.heading;
      const u = off.mesh.userData;
      u.walkPhase += dt * off.speed * 1.6;
      const swing = Math.sin(u.walkPhase) * 0.5;
      u.legL.rotation.x = swing;
      u.legR.rotation.x = -swing;
      u.armL.rotation.x = -swing * 0.8;
      u.armR.rotation.x = swing * 0.8;
    }

    // Cool down: no crime for a while and no police close by, lose a star.
    if (this.stars > 0) {
      this.decayTimer += dt;
      const nearest = this.nearestDistance(player);
      if (this.decayTimer > POLICE.decaySeconds && nearest > 45) {
        this.stars -= 1;
        this.decayTimer = 0;
      }
    } else {
      this.decayTimer = 0;
    }
  }

  nearestDistance(player) {
    let best = Infinity;
    for (const car of this.cars) best = Math.min(best, Math.hypot(car.x - player.x, car.z - player.z));
    for (const off of this.officers) best = Math.min(best, Math.hypot(off.x - player.x, off.z - player.z));
    return best;
  }
}
