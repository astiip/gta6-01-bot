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
    this.heli = null;
    this.decayTimer = 0;
    this.spawnTimer = 0;
    this.heat = 0;
    this.heliBlink = 0;
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
    this.removeHeli();
  }

  /** The police helicopter: body, tail, spinning rotor and a searchlight cone. */
  makeHeli(x, z) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 1.6, 4.6),
      new THREE.MeshLambertMaterial({ color: 0x1a2a4a }),
    );
    body.position.y = 0;
    group.add(body);
    const nose = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.2, 1.4),
      new THREE.MeshLambertMaterial({ color: 0x2a4a7a }),
    );
    nose.position.set(0, -0.1, 2.8);
    group.add(nose);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.7, 4.4),
      new THREE.MeshLambertMaterial({ color: 0x1a2a4a }),
    );
    tail.position.set(0, 0.4, -4.2);
    group.add(tail);
    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 1.8, 1.2),
      new THREE.MeshLambertMaterial({ color: 0xd82020 }),
    );
    fin.position.set(0, 1.2, -6.2);
    group.add(fin);
    const skids = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 0.18, 3.6),
      new THREE.MeshLambertMaterial({ color: 0x222226 }),
    );
    skids.position.y = -1.1;
    group.add(skids);
    const rotor = new THREE.Group();
    rotor.position.y = 1.2;
    const bladeMat = new THREE.MeshLambertMaterial({ color: 0x181818 });
    for (const rot of [0, Math.PI / 2]) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.12, 0.5), bladeMat);
      blade.rotation.y = rot;
      rotor.add(blade);
    }
    group.add(rotor);
    // Searchlight beam: a translucent cone widening down toward the street.
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(4.5, 26, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfff2b0, transparent: true, opacity: 0.16,
        side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    beam.position.y = -14;
    group.add(beam);
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0xd82020, emissive: 0x881111 }),
    );
    beacon.position.set(0, -1.2, 0);
    group.add(beacon);
    group.position.set(x, 30, z);
    this.scene.add(group);
    return { mesh: group, rotor, beam, beacon, x, z, y: 30 };
  }

  spawnHeli(player) {
    if (this.heli) return this.heli;
    this.heli = this.makeHeli(player.x + 18, player.z - 18);
    return this.heli;
  }

  removeHeli() {
    if (!this.heli) return;
    this.scene.remove(this.heli.mesh);
    this.heli = null;
  }

  /**
   * The units on the HUD's response list: callsign, distance in metres and
   * what the unit is doing right now — RAMMING up close, ROADBLOCK when it
   * sits ahead of you, BOXING IN when two cars close in, PURSUIT otherwise,
   * SEARCHLIGHT for the helicopter.
   */
  responseUnits(player) {
    const units = [];
    const sorted = [...this.cars].sort((a, b) =>
      Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z));
    sorted.forEach((car, i) => {
      const dist = Math.hypot(car.x - player.x, car.z - player.z);
      const ahead = (car.x - player.x) * Math.sin(player.heading)
        + (car.z - player.z) * Math.cos(player.heading);
      let behavior = 'PURSUIT';
      if (dist < 8) behavior = 'RAMMING';
      else if (ahead > 0 && dist < 42) behavior = 'ROADBLOCK';
      else if (i === 1 && dist < 16) behavior = 'BOXING IN';
      units.push({ callsign: `UNIT ${12 + i * 7}`, dist: Math.round(dist), behavior });
    });
    if (this.heli) {
      const dist = Math.hypot(this.heli.x - player.x, this.heli.z - player.z);
      units.push({ callsign: 'AIR-1', dist: Math.round(dist), behavior: 'SEARCHLIGHT' });
    }
    return units.slice(0, 4);
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

    // The helicopter joins at 3 stars and leaves when the heat drops.
    if (this.stars >= POLICE.heliMinStars) {
      this.spawnHeli(player);
    } else {
      this.removeHeli();
    }
    if (this.heli) {
      const h = this.heli;
      const tx = player.x + 14;
      const tz = player.z - 14;
      h.x += (tx - h.x) * Math.min(1, dt * 1.2);
      h.z += (tz - h.z) * Math.min(1, dt * 1.2);
      h.y = 30 + Math.sin(performance.now() / 900) * 1.2;
      h.mesh.position.set(h.x, h.y, h.z);
      h.mesh.rotation.y = Math.atan2(player.x - h.x, player.z - h.z);
      h.rotor.rotation.y += dt * 22;
      // The beam stays under the helicopter, sweeping toward the player.
      h.beam.position.x = (player.x - h.x) * 0.25;
      h.beam.position.z = (player.z - h.z) * 0.25;
      this.heliBlink += dt;
      const on = Math.floor(this.heliBlink / 0.5) % 2 === 0;
      h.beacon.material.emissive.setHex(on ? 0xff2020 : 0x330000);
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
    if (this.heli) best = Math.min(best, Math.hypot(this.heli.x - player.x, this.heli.z - player.z));
    return best;
  }
}
