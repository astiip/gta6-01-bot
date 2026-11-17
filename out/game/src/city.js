// Solmar Bay itself: the ground, the street grid, the buildings, the beach and the
// pier. All geometry is generated from primitives at load time; the city is a fixed
// 9x9 street grid with a plaza, parks and a beach on the south shore.
import { CITY, PALETTE, BUILDING_COLORS } from './config.js';
import { rand, randInt, pick, facadeTexture } from './util.js';

const THREE = window.THREE;

function box(w, h, d, color, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  mesh.position.set(x, y, z);
  return mesh;
}

function makePalm(rng) {
  const group = new THREE.Group();
  const height = rand(rng, 4.5, 7);
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.22, height, 6),
    new THREE.MeshLambertMaterial({ color: 0x8a6a4a }),
  );
  trunk.position.y = height / 2;
  group.add(trunk);
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x3f9e4d });
  for (let i = 0; i < 6; i += 1) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.6, 4), frondMat);
    const a = (i / 6) * Math.PI * 2;
    frond.position.set(Math.cos(a) * 0.9, height + 0.2, Math.sin(a) * 0.9);
    frond.rotation.z = Math.cos(a) * 1.1;
    frond.rotation.x = -Math.sin(a) * 1.1;
    group.add(frond);
  }
  const nuts = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 6, 5),
    new THREE.MeshLambertMaterial({ color: 0x6a4a2a }),
  );
  nuts.position.y = height + 0.1;
  group.add(nuts);
  return group;
}

function makeStreetlight() {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.12, 5.2, 6),
    new THREE.MeshLambertMaterial({ color: 0x333338 }),
  );
  pole.position.y = 2.6;
  group.add(pole);
  const arm = box(1.6, 0.1, 0.1, 0x333338, 0.7, 5.15, 0);
  group.add(arm);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0x887733 }),
  );
  lamp.position.set(1.4, 5.05, 0);
  group.add(lamp);
  return group;
}

/**
 * Build the whole city into `scene`. Returns the collision boxes, the plaza centre,
 * the pier tip and helpers the traffic and mission systems use.
 */
export function buildCity(scene, rng) {
  const colliders = [];
  const streets = CITY.streets;
  const size = CITY.half * 2 + 60;

  // Ground slab, then the beach and the sea beyond the south shore.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshLambertMaterial({ color: PALETTE.ground }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 10);
  scene.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(size, 34),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.05, CITY.beachZ + 16);
  scene.add(sand);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(size, 120),
    new THREE.MeshLambertMaterial({ color: PALETTE.water }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.02, CITY.waterZ + 58);
  scene.add(sea);

  // Roads and sidewalks along every street, both axes.
  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.road });
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  for (const s of streets) {
    const roadX = new THREE.Mesh(new THREE.PlaneGeometry(CITY.roadWidth, size), roadMat);
    roadX.rotation.x = -Math.PI / 2;
    roadX.position.set(s, 0.06, 10);
    scene.add(roadX);
    const walkX = new THREE.Mesh(new THREE.PlaneGeometry(CITY.sidewalkWidth, size), walkMat);
    walkX.rotation.x = -Math.PI / 2;
    walkX.position.set(s, 0.04, 10);
    scene.add(walkX);
    const roadZ = new THREE.Mesh(new THREE.PlaneGeometry(size, CITY.roadWidth), roadMat);
    roadZ.rotation.x = -Math.PI / 2;
    roadZ.position.set(0, 0.06, s);
    scene.add(roadZ);
    const walkZ = new THREE.Mesh(new THREE.PlaneGeometry(size, CITY.sidewalkWidth), walkMat);
    walkZ.rotation.x = -Math.PI / 2;
    walkZ.position.set(0, 0.04, s);
    scene.add(walkZ);
  }

  // Centre dashes on the roads, so the streets read as streets from above.
  const dashMat = new THREE.MeshLambertMaterial({ color: 0xd8d8c8 });
  for (const s of streets) {
    for (let t = -180; t <= 180; t += 12) {
      if (Math.abs(t - s) < 8) continue;
      const d1 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 3), dashMat);
      d1.rotation.x = -Math.PI / 2;
      d1.position.set(s, 0.09, t);
      scene.add(d1);
      const d2 = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.5), dashMat);
      d2.rotation.x = -Math.PI / 2;
      d2.position.set(t, 0.09, s);
      scene.add(d2);
    }
  }

  // Buildings, parks and the plaza, one block at a time.
  const facadeMats = BUILDING_COLORS.map((c) => {
    const tex = facadeTexture(c, '#ffe9a0', rng);
    return new THREE.MeshLambertMaterial({ map: tex });
  });
  const parkMat = new THREE.MeshLambertMaterial({ color: PALETTE.grass });
  const plazaMat = new THREE.MeshLambertMaterial({ color: PALETTE.plaza });

  for (let i = 0; i < streets.length - 1; i += 1) {
    for (let j = 0; j < streets.length - 1; j += 1) {
      const cx = streets[i] + 20;
      const cz = streets[j] + 20;
      // The south row is the beach, not buildings.
      if (cz > 160) continue;
      // Central plaza: open stone square with a fountain.
      if (i === 4 && j === 4) {
        const plaza = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), plazaMat);
        plaza.rotation.x = -Math.PI / 2;
        plaza.position.set(cx, 0.08, cz);
        scene.add(plaza);
        const basin = new THREE.Mesh(
          new THREE.CylinderGeometry(4, 4.6, 1, 16),
          new THREE.MeshLambertMaterial({ color: 0xb0a890 }),
        );
        basin.position.set(cx, 0.5, cz);
        scene.add(basin);
        const waterTop = new THREE.Mesh(
          new THREE.CylinderGeometry(3.6, 3.6, 0.3, 16),
          new THREE.MeshLambertMaterial({ color: 0x4aa8d8 }),
        );
        waterTop.position.set(cx, 0.95, cz);
        scene.add(waterTop);
        colliders.push({ minX: cx - 4.6, maxX: cx + 4.6, minZ: cz - 4.6, maxZ: cz + 4.6 });
        for (let p = 0; p < 6; p += 1) {
          const palm = makePalm(rng);
          const a = (p / 6) * Math.PI * 2;
          palm.position.set(cx + Math.cos(a) * 15, 0, cz + Math.sin(a) * 15);
          scene.add(palm);
        }
        continue;
      }
      // One in six blocks is a park.
      if (rng() < 0.16) {
        const lawn = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), parkMat);
        lawn.rotation.x = -Math.PI / 2;
        lawn.position.set(cx, 0.08, cz);
        scene.add(lawn);
        for (let p = 0; p < 5; p += 1) {
          const palm = makePalm(rng);
          palm.position.set(cx + rand(rng, -14, 14), 0, cz + rand(rng, -14, 14));
          scene.add(palm);
        }
        const bench = box(3, 0.5, 1, 0x7a5a3a, cx + 8, 0.3, cz - 8);
        scene.add(bench);
        continue;
      }
      // Otherwise one or two buildings fill the block.
      const count = rng() < 0.55 ? 1 : 2;
      for (let b = 0; b < count; b += 1) {
        const w = rand(rng, 10, 15);
        const d = rand(rng, 10, 15);
        const h = rand(rng, 9, 42);
        const ox = count === 1 ? 0 : (b === 0 ? -6 : 6);
        const oz = count === 1 ? 0 : (b === 0 ? -6 : 6);
        const bx = cx + ox;
        const bz = cz + oz;
        const mat = pick(rng, facadeMats);
        const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        building.position.set(bx, h / 2, bz);
        scene.add(building);
        const roof = box(w * 0.5, 1.2, d * 0.5, 0x6a6a72, bx, h + 0.6, bz);
        scene.add(roof);
        colliders.push({
          minX: bx - w / 2, maxX: bx + w / 2,
          minZ: bz - d / 2, maxZ: bz + d / 2,
        });
      }
    }
  }

  // Palms along the beach and streetlights along the avenues.
  for (let x = -190; x <= 190; x += 18) {
    const palm = makePalm(rng);
    palm.position.set(x + rand(rng, -3, 3), 0, CITY.beachZ + rand(rng, 4, 22));
    scene.add(palm);
  }
  for (const s of streets) {
    for (let t = -160; t <= 160; t += 80) {
      const light = makeStreetlight();
      light.position.set(s + 6, 0, t);
      scene.add(light);
      const light2 = makeStreetlight();
      light2.position.set(t, 0, s + 6);
      light2.rotation.y = Math.PI / 2;
      scene.add(light2);
    }
  }

  // The pier: wooden boards out over the water, with a bait shack at the end.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x9a7a52 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(8, 0.6, 46), pierMat);
  pier.position.set(-80, 0.6, CITY.beachZ + 30);
  scene.add(pier);
  const shack = box(6, 4, 5, 0x7a5a3a, -80, 2.6, CITY.beachZ + 50);
  scene.add(shack);
  const shackRoof = box(7, 0.5, 6, 0xd84040, -80, 4.9, CITY.beachZ + 50);
  scene.add(shackRoof);
  colliders.push({ minX: -83, maxX: -77, minZ: CITY.beachZ + 47, maxZ: CITY.beachZ + 53 });

  // A distant skyline ring so the horizon is never empty.
  const skyMat = new THREE.MeshLambertMaterial({ color: 0x7a8a9a });
  for (let a = 0; a < 24; a += 1) {
    const ang = (a / 24) * Math.PI * 2;
    const r = 260 + rand(rng, 0, 40);
    const h = rand(rng, 30, 90);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(22, h, 22), skyMat);
    tower.position.set(Math.cos(ang) * r, h / 2 - 2, Math.sin(ang) * r + 10);
    scene.add(tower);
  }

  return {
    colliders,
    plaza: { x: 20, z: 20 },
    pierTip: { x: -80, z: CITY.beachZ + 50 },
    marina: { x: 120, z: CITY.beachZ + 20 },
    bank: { x: -120, z: -120 },
    garage: { x: 120, z: 120 },
  };
}

/** True when a circle at (x, z) with radius r overlaps any building. */
export function hitsBuilding(city, x, z, r) {
  for (const c of city.colliders) {
    if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return c;
  }
  return null;
}

/** Push a circle out of any building it overlaps; returns the corrected position. */
export function resolveBuildingCollision(city, x, z, r) {
  for (const c of city.colliders) {
    if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) {
      const pushLeft = (x + r) - c.minX;
      const pushRight = c.maxX - (x - r);
      const pushUp = (z + r) - c.minZ;
      const pushDown = c.maxZ - (z - r);
      const min = Math.min(pushLeft, pushRight, pushUp, pushDown);
      if (min === pushLeft) x = c.minX - r;
      else if (min === pushRight) x = c.maxX + r;
      else if (min === pushUp) z = c.minZ - r;
      else z = c.maxZ + r;
    }
  }
  return { x, z };
}

export function nearestStreetCoord(v) {
  let best = CITY.streets[0];
  let bestD = Math.abs(v - best);
  for (const s of CITY.streets) {
    const d = Math.abs(v - s);
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}

export function randomStreetPoint(rng) {
  const s = pick(rng, CITY.streets);
  const t = rand(rng, -160, 160);
  return rng() < 0.5 ? { x: s, z: t } : { x: t, z: s };
}
