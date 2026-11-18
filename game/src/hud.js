// The HUD: wanted stars, cash, health / armour / respect, the mission card
// with its stage bar, the police response list, weapon slots, the radio, the
// round minimap with its district name, dialogue cards with code-drawn
// portraits, and floating drift / near-miss feedback. All DOM, drawn over
// the 3D view, and readable at 768x480.
import { CITY, RADIO_STATIONS, districtName } from './config.js';
import { MISSION_NAMES } from './missions.js';
import { clamp } from './util.js';

export class Hud {
  constructor() {
    this.root = document.getElementById('hud');
    this.starsEl = document.getElementById('wanted');
    this.cashEl = document.getElementById('cash');
    this.healthFill = document.getElementById('health-fill');
    this.armourFill = document.getElementById('armour-fill');
    this.respectFill = document.getElementById('respect-fill');
    this.speedEl = document.getElementById('speed');
    this.carNameEl = document.getElementById('car-name');
    this.carCondFill = document.getElementById('car-condition-fill');
    this.carCond = document.getElementById('car-condition');
    this.carCondLabel = document.getElementById('car-condition-label');
    this.countEl = document.getElementById('mission-count');
    this.timerEl = document.getElementById('mission-timer');
    this.clockEl = document.getElementById('day-clock');
    this.sightEl = document.getElementById('sight');
    this.pdMetaEl = document.getElementById('pd-meta');
    this.objectiveEl = document.getElementById('objective');
    this.missionEl = document.getElementById('mission-name');
    this.stageFill = document.getElementById('stage-fill');
    this.stageLabel = document.getElementById('stage-label');
    this.nextEl = document.getElementById('mission-next');
    this.pdPanel = document.getElementById('pd-panel');
    this.pdList = document.getElementById('pd-list');
    this.districtEl = document.getElementById('district-label');
    this.dialogueEl = document.getElementById('dialogue');
    this.dialoguePortrait = document.getElementById('dialogue-portrait');
    this.dialogueName = document.getElementById('dialogue-name');
    this.dialogueRole = document.getElementById('dialogue-role');
    this.dialogueLine = document.getElementById('dialogue-line');
    this.radioStation = document.getElementById('radio-station');
    this.radioTrack = document.getElementById('radio-track');
    this.feedbackEl = document.getElementById('feedback');
    this.wPistol = document.getElementById('w-pistol');
    this.wFists = document.getElementById('w-fists');
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
    this.dialogueTimer = 0;
    this.radioIndex = -1;
    this.feedbackPinned = false;
    this.missionIndex = -1;
    this.missionStartTime = 0;
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

  /** A dialogue card: portrait drawn in code, name, role and one spoken line. */
  showDialogue(speaker, role, line, colors) {
    const c = this.dialoguePortrait;
    const ctx = c.getContext('2d');
    const skin = (colors && colors.skin) || '#e8b890';
    const hair = (colors && colors.hair) || '#2a2018';
    const shirt = (colors && colors.shirt) || '#8a2a4a';
    ctx.fillStyle = '#1a2030';
    ctx.fillRect(0, 0, 64, 64);
    // Shoulders.
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.moveTo(6, 64);
    ctx.quadraticCurveTo(10, 46, 32, 46);
    ctx.quadraticCurveTo(54, 46, 58, 64);
    ctx.closePath();
    ctx.fill();
    // Head.
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(32, 29, 15, 0, Math.PI * 2);
    ctx.fill();
    // Hair.
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.arc(32, 24, 15, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(17, 22, 30, 6);
    // Sunglasses.
    ctx.fillStyle = '#101018';
    ctx.fillRect(20, 27, 10, 5);
    ctx.fillRect(34, 27, 10, 5);
    ctx.fillRect(29, 29, 6, 2);
    // Mouth.
    ctx.strokeStyle = '#7a4a3a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(28, 41);
    ctx.lineTo(36, 41);
    ctx.stroke();
    this.dialogueName.textContent = speaker;
    this.dialogueRole.textContent = ` — ${role}`;
    this.dialogueLine.textContent = `“${line}”`;
    this.dialogueEl.classList.remove('hidden');
    this.dialogueTimer = 7;
  }

  hideDialogue() {
    this.dialogueEl.classList.add('hidden');
    this.dialogueTimer = 0;
  }

  /** Floating feedback: DRIFT x3, NEAR MISS +$250 — pops, then fades. */
  showFeedback(text, subtext) {
    const div = document.createElement('div');
    div.className = 'feedback-item';
    div.innerHTML = `${text} <small>${subtext || ''}</small>`;
    this.feedbackEl.appendChild(div);
    // Pinned feedback (screenshot staging) stays until the page goes away;
    // live feedback fades after a few seconds.
    setTimeout(() => { if (!this.feedbackPinned) div.remove(); }, 5500);
    while (this.feedbackEl.children.length > 3) {
      this.feedbackEl.firstChild.remove();
    }
  }

  update(dt, state) {
    const { player, police, missions, stats } = state;
    // Day clock: the story opens at 18:45 on Day 1 and one game minute
    // passes per real second, so the golden hour never ends mid-mission.
    const mins = 18 * 60 + 45 + Math.floor(state.time || 0);
    const hh = String(Math.floor(mins / 60) % 24).padStart(2, '0');
    const mm = String(mins % 60).padStart(2, '0');
    this.clockEl.textContent = `DAY 1  ${hh}:${mm}`;
    // Wanted stars.
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < police.stars ? '★' : '☆';
    this.starsEl.textContent = stars;
    this.starsEl.classList.toggle('hot', police.stars > 0);
    // IN SIGHT: a unit is close enough to see Rico; SEARCHING while the
    // heat is on but nobody has eyes on him.
    if (police.stars > 0) {
      const nearest = police.nearestDistance(player);
      this.sightEl.classList.remove('hidden');
      if (nearest < 45) {
        this.sightEl.textContent = '● IN SIGHT';
        this.sightEl.classList.remove('searching');
      } else {
        this.sightEl.textContent = '○ SEARCHING';
        this.sightEl.classList.add('searching');
      }
    } else {
      this.sightEl.classList.add('hidden');
    }
    this.cashEl.textContent = `$${player.cash.toLocaleString('en-US')}`;
    // Vitals: health, armour, respect.
    this.healthFill.style.width = `${Math.max(0, player.health)}%`;
    this.healthFill.style.background = player.health > 50 ? '#58d858' : player.health > 25 ? '#e8b838' : '#e83838';
    this.armourFill.style.width = `${clamp(player.armour || 0, 0, 100)}%`;
    const respect = clamp((stats.missionsDone || 0) * 12 + (stats.gangDown || 0) * 3 + (stats.carsStolen || 0) * 2, 0, 100);
    this.respectFill.style.width = `${respect}%`;
    // Speed, car name, condition.
    if (player.mode === 'car' && player.car) {
      this.speedEl.innerHTML = `${Math.round(Math.abs(player.car.speed) * 3.6)} <small>km/h</small>`;
      this.carNameEl.textContent = player.car.name || '';
      this.carCond.style.display = 'block';
      this.carCondLabel.style.display = 'block';
      const cond = clamp(player.car.health, 0, 100);
      this.carCondFill.style.width = `${cond}%`;
      this.carCondFill.style.background = cond > 50 ? '#58d858' : cond > 25 ? '#e8b838' : '#e83838';
    } else {
      this.speedEl.textContent = player.speed > 0.5 ? 'ON FOOT' : '';
      this.carNameEl.textContent = player.speed > 0.5 ? 'RICO VEGA' : '';
      this.carCond.style.display = 'none';
      this.carCondLabel.style.display = 'none';
    }
    // Weapon slots: pistol is the live weapon on foot, fists while driving.
    this.wPistol.querySelector('.w-ammo').textContent = `${player.ammo} / ${player.reserveAmmo}`;
    this.wPistol.classList.toggle('active', player.mode === 'foot');
    this.wFists.classList.toggle('active', player.mode === 'car');
    // Mission card: number, name, objective, stage bar, next step, timer.
    // The timer counts up from the moment the mission starts.
    if (missions.active) {
      if (missions.index !== this.missionIndex) {
        this.missionIndex = missions.index;
        this.missionStartTime = state.time || 0;
      }
      const elapsed = Math.max(0, Math.floor((state.time || 0) - this.missionStartTime));
      this.timerEl.textContent = `⏱ ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
      const total = MISSION_NAMES.length;
      this.countEl.textContent = `MISSION ${missions.index + 1}/${total}`;
      this.missionEl.textContent = missions.name.toUpperCase();
      this.objectiveEl.textContent = missions.objectiveText();
      const steps = missions.steps.length;
      const done = Math.min(missions.stepIndex, steps);
      this.stageFill.style.width = `${steps > 0 ? (done / steps) * 100 : 0}%`;
      this.stageLabel.textContent = `STAGE ${Math.min(done + 1, steps)}/${steps}`;
      const next = missions.steps[missions.stepIndex + 1];
      this.nextEl.innerHTML = next
        ? `<b>NEXT:</b> ${next.text}`
        : '<b>NEXT:</b> Finish the job — complete this step';
    } else {
      this.missionIndex = -1;
      this.timerEl.textContent = '';
      this.countEl.textContent = 'FREE ROAM';
      this.missionEl.textContent = 'Solmar Bay';
      this.objectiveEl.textContent = 'Free roam — press M for the mission list, E to steal a car';
      this.stageFill.style.width = '0%';
      this.stageLabel.textContent = '';
      this.nextEl.textContent = '';
    }
    // Police response list.
    if (police.stars > 0) {
      const units = police.responseUnits(player);
      this.pdMetaEl.textContent = `${police.cars.length} UNITS • CODE ${police.stars}`;
      this.pdList.innerHTML = units.map((u) => (
        `<div class="pd-row"><span class="pd-callsign">${u.callsign}</span>` +
        `<span class="pd-dist">${u.dist}m</span>` +
        `<span class="pd-behavior">${u.behavior}</span></div>`
      )).join('') + (police.cars.length > units.length
        ? `<div id="pd-foot">+${police.cars.length - units.length} more units in the search zone</div>` : '');
      this.pdPanel.classList.remove('hidden');
    } else {
      this.pdPanel.classList.add('hidden');
    }
    // District under the minimap, radio track on a slow rotation.
    this.districtEl.textContent = districtName(player.x, player.z);
    const radioIndex = Math.floor((state.time || 0) / 18) % RADIO_STATIONS.length;
    if (radioIndex !== this.radioIndex) {
      this.radioIndex = radioIndex;
      this.radioStation.textContent = RADIO_STATIONS[radioIndex].station;
      this.radioTrack.textContent = RADIO_STATIONS[radioIndex].track;
    }
    this.crosshair.style.display = player.mode === 'foot' ? 'block' : 'none';
    const dmg = 1 - player.health / 100;
    this.damageEl.style.opacity = String(dmg * 0.55);
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.hideBanner();
    }
    if (this.dialogueTimer > 0) {
      this.dialogueTimer -= dt;
      if (this.dialogueTimer <= 0) this.hideDialogue();
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
      ctx.arc(mx, my, 5, 0, Math.PI * 2);
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
    // Helicopter.
    if (police.heli) {
      const [x, y] = toMap(police.heli.x, police.heli.z);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.stroke();
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
