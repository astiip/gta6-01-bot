// Combat: the player's pistol and punch, gang return fire, health and the
// wasted/busted flow. Hits are raycasts against simple sphere targets.
import { PLAYER } from './config.js';
import { clamp } from './util.js';

const THREE = window.THREE;

export class Combat {
  constructor(scene, audio) {
    this.scene = scene;
    this.audio = audio;
    this.shootCooldown = 0;
    this.reloadTimer = 0;
    this.muzzleFlash = null;
    this.tracers = [];
  }

  /** Fire the pistol toward the camera's aim point. Returns what was hit. */
  shoot(player, camera, targets) {
    if (this.shootCooldown > 0 || this.reloadTimer > 0) return null;
    if (player.ammo <= 0) {
      this.reload(player);
      return null;
    }
    this.shootCooldown = 0.28;
    player.ammo -= 1;
    this.audio.shoot();
    const ray = new THREE.Raycaster();
    ray.setFromCamera({ x: 0, y: 0 }, camera);
    ray.far = 80;
    const meshes = [];
    for (const t of targets) {
      if (!t.dead) meshes.push(t.mesh);
    }
    const hits = ray.intersectObjects(meshes, true);
    let hit = null;
    if (hits.length > 0) {
      let obj = hits[0].object;
      while (obj.parent && obj.parent !== this.scene) obj = obj.parent;
      hit = targets.find((t) => t.mesh === obj) || null;
      if (hit) {
        hit.health -= 1;
        this.flashHit(hit);
        if (hit.health <= 0) hit.dead = true;
      }
    }
    this.spawnTracer(camera);
    return hit;
  }

  reload(player) {
    if (this.reloadTimer > 0 || player.reserveAmmo <= 0 || player.ammo === 12) return;
    this.reloadTimer = 1.1;
    this.audio.blip(500, 0.08, 'square', 0.15);
  }

  finishReload(player) {
    const need = 12 - player.ammo;
    const take = Math.min(need, player.reserveAmmo);
    player.ammo += take;
    player.reserveAmmo -= take;
  }

  punch(player, targets) {
    if (player.punching > 0) return null;
    player.punching = 0.35;
    this.audio.punch();
    for (const t of targets) {
      if (t.dead) continue;
      const d = Math.hypot(t.x - player.x, t.z - player.z);
      if (d < 2.2) {
        t.health -= 1;
        if (t.health <= 0) t.dead = true;
        this.flashHit(t);
        return t;
      }
    }
    return null;
  }

  flashHit(target) {
    // A quick red blink on the hit target: swap its torso colour briefly.
    const torso = target.mesh.children[0];
    if (!torso || !torso.material) return;
    const original = torso.material.color.getHex();
    torso.material.color.setHex(0xff3020);
    setTimeout(() => torso.material.color.setHex(original), 90);
  }

  spawnTracer(camera) {
    const from = new THREE.Vector3();
    camera.getWorldPosition(from);
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const to = from.clone().add(dir.multiplyScalar(30));
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9 }),
    );
    this.scene.add(line);
    this.tracers.push({ line, life: 0.08 });
  }

  /** Gang members shoot back when the player is close and visible. */
  gangFire(dt, gang, player, world) {
    for (const member of gang.list) {
      if (member.dead) continue;
      member.shootTimer -= dt;
      const dx = player.x - member.x;
      const dz = player.z - member.z;
      const dist = Math.hypot(dx, dz);
      member.heading = Math.atan2(dx, dz);
      member.mesh.rotation.y = member.heading;
      // Wounded gang members back off instead of standing and shooting.
      if (member.health <= 1 && dist < 15) {
        member.x -= Math.sin(member.heading) * 2.4 * dt;
        member.z -= Math.cos(member.heading) * 2.4 * dt;
        member.mesh.position.set(member.x, 0, member.z);
        continue;
      }
      // Strafe sideways to stay a threat, not a statue.
      member.x += Math.cos(member.heading) * member.strafeDir * 1.2 * dt;
      member.z -= Math.sin(member.heading) * member.strafeDir * 1.2 * dt;
      if (Math.random() < dt * 0.1) member.strafeDir *= -1;
      member.mesh.position.set(member.x, 0, member.z);
      if (member.shootTimer <= 0 && dist < 28 && player.mode === 'foot') {
        member.shootTimer = 1.6 + Math.random() * 1.2;
        this.audio.noiseBurst(0.1, 0.25, 2200);
        // Hit chance falls with distance; a hit costs 8 health.
        if (Math.random() < clamp(0.55 - dist * 0.012, 0.08, 0.55)) {
          world.onPlayerShot(8);
        }
      }
    }
  }

  update(dt, player) {
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) this.finishReload(player);
    }
    for (let i = this.tracers.length - 1; i >= 0; i -= 1) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        this.tracers.splice(i, 1);
      }
    }
  }
}
