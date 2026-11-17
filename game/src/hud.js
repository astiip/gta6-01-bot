// The HUD: wanted stars, cash, health, speed, the objective line, the minimap
// canvas, and the start / busted / wasted overlays. All DOM, drawn over the 3D view.
import { CITY } from './config.js';

export class Hud {
  constructor() {
    this.root = document.getElementById('hud');
    this.starsEl = document.getElementById('wanted');
    this.cashEl = document.getElementById('cash');
    this.healthFill = document.getElementById('health-fill');
    this.speedEl = document.getElementById('speed');
    this.ammoEl = document.getElementById('ammo');
    this.objectiveEl = document.getElementById('objective');
    this.missionEl = document.getElementById('mission-name');
    this.bannerEl = document.getElementById('banner');
    this.bannerTitle = document.getElementById('banner-title');
    this.bannerText = document.getElementById('banner-text');
    this.minimap = document.getElementById('minimap');
    this.mm = this.minimap.getContext('2d');
    this.crosshair = document.getElementById('crosshair');
    this.damageEl = document.getElementById('damage');
    this.overlay = document.getElementById('overlay');
    this.overlayTitle = document.getElementById('overlay-title');
    this.overlayText = document.getElementById('overlay-text');
    this.bannerTimer = 0;
    this.city = null;
    this.buildingRects = [];
  }

  /** Pre-render the static minimap background once: roads, blocks and the sea. */
  bindCity(city) {
    this.city = city;
    const size = this.minimap.width;
    const scale = size / 440;
    const off = document.createElement('canvas');
    off.width = size;
    off.height = size;
    const ctx = off.getContext('2d');
    const toMap = (x, z) => [(x + 220) * scale, (z + 220) * scale];
    ctx.fillStyle = '#23232c';
    ctx.fillRect(0, 0, size, size);
    // Sea and sand on the south edge.
    ctx.fillStyle = '#2b7fb8';
    const [, wy] = toMap(0, 208);
    ctx.fillRect(0, wy, size, size - wy);
    ctx.fillStyle = '#e9d6a4';
    const [, by] = toMap(0, 178);
    ctx.fillRect(0, by, size, wy - by);
    // Sidewalks, then roads.
    ctx.fillStyle = '#6a6a72';
    for (const s of CITY.streets) {
      const [x] = toMap(s, 0);
      ctx.fillRect(x - 7.5 * scale, 0, 15 * scale, size);
      const [, z] = toMap(0, s);
      ctx.fillRect(0, z - 7.5 * scale, size, 15 * scale);
    }
    ctx.fillStyle = '#3a3a44';
    for (const s of CITY.streets) {
      const [x] = toMap(s, 0);
      ctx.fillRect(x - 5 * scale, 0, 10 * scale, size);
      const [, z] = toMap(0, s);
      ctx.fillRect(0, z - 5 * scale, size, 10 * scale);
    }
    // Building footprints.
    ctx.fillStyle = '#8a8a96';
    for (const c of city.colliders) {
      const [x1, z1] = toMap(c.minX, c.minZ);
      const [x2, z2] = toMap(c.maxX, c.maxZ);
      ctx.fillRect(x1, z1, x2 - x1, z2 - z1);
    }
    this.minimapBg = off;
  }

  showBanner(title, text, seconds) {
    this.bannerTitle.textContent = title;
    this.bannerText.textContent = text;
    this.bannerEl.classList.remove('hidden');
    this.bannerTimer = seconds || 4;
  }

  hideBanner() {
    this.bannerEl.classList.add('hidden');
    this.bannerTimer = 0;
  }

  showOverlay(title, text) {
    this.overlayTitle.textContent = title;
    this.overlayText.textContent = text;
    this.overlay.classList.remove('hidden');
  }

  hideOverlay() {
    this.overlay.classList.add('hidden');
  }

  update(dt, state) {
    const { player, police, missions } = state;
    // Wanted stars.
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < police.stars ? '★' : '☆';
    this.starsEl.textContent = stars;
    this.starsEl.classList.toggle('hot', police.stars > 0);
    this.cashEl.textContent = `$${player.cash.toLocaleString('en-US')}`;
    this.healthFill.style.width = `${Math.max(0, player.health)}%`;
    this.healthFill.style.background = player.health > 50 ? '#58d858' : player.health > 25 ? '#e8b838' : '#e83838';
    if (player.mode === 'car' && player.car) {
      this.speedEl.textContent = `${Math.round(Math.abs(player.car.speed) * 3.6)} km/h`;
    } else {
      this.speedEl.textContent = player.speed > 0.5 ? 'On foot' : '';
    }
    this.ammoEl.textContent = player.mode === 'car' ? '' : `🔫 ${player.ammo} / ${player.reserveAmmo}`;
    this.missionEl.textContent = missions.active ? `★ ${missions.name}` : 'Free Roam';
    this.objectiveEl.textContent = missions.objectiveText();
    this.crosshair.style.display = player.mode === 'foot' ? 'block' : 'none';
    const dmg = 1 - player.health / 100;
    this.damageEl.style.opacity = String(dmg * 0.55);
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.hideBanner();
    }
    this.drawMinimap(state);
  }

  drawMinimap(state) {
    const ctx = this.mm;
    const size = this.minimap.width;
    const scale = size / 440;
    const toMap = (x, z) => [(x + 220) * scale, (z + 220) * scale];
    ctx.clearRect(0, 0, size, size);
    if (this.minimapBg) ctx.drawImage(this.minimapBg, 0, 0);
    const { player, police, missions, traffic, gang } = state;
    // Mission marker.
    const step = missions.currentStep;
    if (missions.active && step && step.x !== undefined) {
      const [mx, my] = toMap(step.x, step.z);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(mx, my, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // Traffic dots.
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (const car of traffic.cars) {
      const [x, y] = toMap(car.x, car.z);
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    // Gang members.
    ctx.fillStyle = '#ff4040';
    for (const m of gang.list) {
      if (m.dead) continue;
      const [x, y] = toMap(m.x, m.z);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Police.
    ctx.fillStyle = '#4080ff';
    for (const car of police.cars) {
      const [x, y] = toMap(car.x, car.z);
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const off of police.officers) {
      const [x, y] = toMap(off.x, off.z);
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
    // Player arrow, pointing where the player faces.
    const [px, py] = toMap(player.x, player.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.atan2(Math.sin(player.heading), Math.cos(player.heading)) * -1 + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
