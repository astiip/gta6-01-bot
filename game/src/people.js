// People: the pedestrians who fill the sidewalks and the gang members who fight you.
// Humanoids are built from boxes so the whole crowd stays cheap to draw.
import { CITY } from './config.js';
import { rand, pick, clamp, angleLerp } from './util.js';
import { resolveBuildingCollision } from './city.js';

const THREE = window.THREE;

const SHIRTS = [0xe8e8e8, 0xd8a040, 0x40a0d8, 0xd87090, 0x70c870, 0xc8c8c8, 0x9060c0];
const SKINS = [0xe8b890, 0xc89068, 0x8a5a3a, 0xf0c8a0];

/** A simple humanoid: torso, head, arms and legs that swing while walking. */
export function makePersonMesh(shirt, pants, skin) {
  const group = new THREE.Group();
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.72, 0.34),
    new THREE.MeshLambertMaterial({ color: shirt }),
  );
  torso.position.y = 1.12;
  group.add(torso);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 10, 8),
    new THREE.MeshLambertMaterial({ color: skin }),
  );
  head.position.y = 1.68;
  group.add(head);
  const hair = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.16, 0.42),
    new THREE.MeshLambertMaterial({ color: 0x2a2018 }),
  );
  hair.position.y = 1.86;
  group.add(hair);
  const legGeo = new THREE.BoxGeometry(0.24, 0.72, 0.26);
  const legMat = new THREE.MeshLambertMaterial({ color: pants });
  const legL = new THREE.Mesh(legGeo, legMat);
  legL.position.set(-0.16, 0.36, 0);
  const legR = new THREE.Mesh(legGeo, legMat);
  legR.position.set(0.16, 0.36, 0);
  group.add(legL);
  group.add(legR);
  const armGeo = new THREE.BoxGeometry(0.18, 0.62, 0.2);
  const armMat = new THREE.MeshLambertMaterial({ color: shirt });
  const armL = new THREE.Mesh(armGeo, armMat);
  armL.position.set(-0.42, 1.12, 0);
  const armR = new THREE.Mesh(armGeo, armMat);
  armR.position.set(0.42, 1.12, 0);
  group.add(armL);
  group.add(armR);
  group.userData = { legL, legR, armL, armR, walkPhase: Math.random() * 6 };
  return group;
}

function animateWalk(mesh, speed, dt) {
  const u = mesh.userData;
  u.walkPhase += dt * speed * 1.6;
  const swing = Math.sin(u.walkPhase) * 0.55 * Math.min(1, speed / 3);
  u.legL.rotation.x = swing;
  u.legR.rotation.x = -swing;
  u.armL.rotation.x = -swing * 0.8;
  u.armR.rotation.x = swing * 0.8;
}

/** Pedestrians: they stroll the sidewalks, cross at corners, and scatter from gunfire. */
export class Pedestrians {
  constructor(scene, rng, city) {
    this.scene = scene;
    this.rng = rng;
    this.city = city;
    this.list = [];
    for (let i = 0; i < 26; i += 1) this.spawn();
  }

  spawn() {
    const s = pick(this.rng, CITY.streets);
    const t = rand(this.rng, -160, 160);
    const alongX = this.rng() < 0.5;
    const x = alongX ? t : s + (this.rng() < 0.5 ? 6 : -6);
    const z = alongX ? s + (this.rng() < 0.5 ? 6 : -6) : t;
    const mesh = makePersonMesh(pick(this.rng, SHIRTS), pick(this.rng, [0x2a2a3a, 0x4a3a2a, 0x3a4a5a]), pick(this.rng, SKINS));
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const person = {
      mesh, x, z,
      heading: this.rng() * Math.PI * 2,
      speed: rand(this.rng, 0.9, 1.9),
      target: null,
      panic: 0,
      fallen: false,
      fallTimer: 0,
    };
    person.target = this.pickTarget(person);
    this.list.push(person);
    return person;
  }

  pickTarget(person) {
    const s = pick(this.rng, CITY.streets);
    const t = rand(this.rng, -160, 160);
    const alongX = this.rng() < 0.5;
    return alongX
      ? { x: t, z: s + (this.rng() < 0.5 ? 6 : -6) }
      : { x: s + (this.rng() < 0.5 ? 6 : -6), z: t };
  }

  /** A pedestrian is knocked down by a speeding car; they get up after a while. */
  knockDown(person) {
    if (person.fallen) return;
    person.fallen = true;
    person.fallTimer = 4;
    person.mesh.rotation.x = -Math.PI / 2;
    person.mesh.position.y = 0.3;
  }

  scare(x, z, radius) {
    for (const p of this.list) {
      if (Math.hypot(p.x - x, p.z - z) < radius) p.panic = 3;
    }
  }

  update(dt) {
    for (const p of this.list) {
      if (p.fallen) {
        p.fallTimer -= dt;
        if (p.fallTimer <= 0) {
          p.fallen = false;
          p.mesh.rotation.x = 0;
          p.mesh.position.y = 0;
        }
        continue;
      }
      if (p.panic > 0) {
        p.panic -= dt;
        // Flee away from the scare point: run along the street, away from it.
        const dx = p.x - p.target.x;
        const dz = p.z - p.target.z;
        p.heading = Math.atan2(dx, dz);
        p.speed = 5;
      } else {
        p.speed = 1.4;
        const dx = p.target.x - p.x;
        const dz = p.target.z - p.z;
        if (Math.hypot(dx, dz) < 2) {
          p.target = this.pickTarget(p);
        } else {
          p.heading = angleLerp(p.heading, Math.atan2(dx, dz), Math.min(1, dt * 3));
        }
      }
      p.x += Math.sin(p.heading) * p.speed * dt;
      p.z += Math.cos(p.heading) * p.speed * dt;
      const fixed = resolveBuildingCollision(this.city, p.x, p.z, 0.5);
      p.x = fixed.x;
      p.z = fixed.z;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
      animateWalk(p.mesh, p.speed, dt);
    }
  }
}

/** Gang members: red-jacketed Vultures who shoot at the player during combat missions. */
export class Gang {
  constructor(scene, rng, city) {
    this.scene = scene;
    this.rng = rng;
    this.city = city;
    this.list = [];
  }

  spawnSquad(x, z, count) {
    const spawned = [];
    for (let i = 0; i < count; i += 1) {
      const mesh = makePersonMesh(0xc02020, 0x222226, pick(this.rng, SKINS));
      const gx = x + rand(this.rng, -6, 6);
      const gz = z + rand(this.rng, -6, 6);
      mesh.position.set(gx, 0, gz);
      this.scene.add(mesh);
      const gun = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.1, 0.5),
        new THREE.MeshLambertMaterial({ color: 0x181818 }),
      );
      gun.position.set(0.42, 1.1, 0.3);
      mesh.add(gun);
      const member = {
        mesh, x: gx, z: gz,
        heading: this.rng() * Math.PI * 2,
        health: 3,
        shootTimer: rand(this.rng, 0.5, 2),
        dead: false,
        strafeDir: this.rng() < 0.5 ? 1 : -1,
      };
      this.list.push(member);
      spawned.push(member);
    }
    return spawned;
  }

  remove(member) {
    this.scene.remove(member.mesh);
    const i = this.list.indexOf(member);
    if (i >= 0) this.list.splice(i, 1);
  }

  clear() {
    for (const m of [...this.list]) this.remove(m);
  }
}
