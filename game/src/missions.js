// Missions and the story of Solmar Bay: Rico Vega, a driver for hire, is pulled
// into Mara Solis's crew and ends up taking the city from the Vultures.
// Each mission is a list of steps; a step completes and the next one begins.
import { MISSION_REWARDS } from './config.js';

const THREE = window.THREE;

export const MISSION_NAMES = [
  'First Fare',
  'Hot Wheels',
  'The Drop',
  'Turf War',
  'The Bank Job',
  'Skyline Escape',
  'The Golden Mile',
  'King of Solmar',
];

export const MISSION_INTROS = [
  'Mara Solis needs a driver. Take her car to the pier and prove you can handle Solmar Bay.',
  'The crew needs wheels. Steal the marked coupe and bring it to the garage on the east side.',
  'A package for the north docks — and the Solmar Bay PD just got a tip. Lose them or outrun them.',
  'The Vultures are moving on the plaza. Clear them out and show them whose streets these are.',
  'Hit the Solmar Bay Bank. Hold the lobby while Mara cracks the vault, then get out clean.',
  'The bank job put a police helicopter on you. Break line of sight, lose the chopper, reach the safehouse.',
  'One last quiet job before the end: steal the Vultures\' gold coupe and deliver it to the marina — in their own car, nobody looks twice.',
  'Dante Kross is on the marina yacht. Reach it, end this, and take the city.',
];

// Who says what when a mission starts — the HUD draws their portrait and line.
export const MISSION_DIALOGUE = [
  { speaker: 'Mara Solis', role: 'Fixer', line: 'Rico. You drive, I plan. Get my car to the pier — and don\'t scratch the paint.', hair: '#2a2018', skin: '#e8b890', shirt: '#8a2a4a' },
  { speaker: 'Mara Solis', role: 'Fixer', line: 'The crew needs wheels. That coupe on the Strip is ours now. Take it.', hair: '#2a2018', skin: '#e8b890', shirt: '#8a2a4a' },
  { speaker: 'Mara Solis', role: 'Fixer', line: 'Package for the north docks. The PD got a tip — so drive like you mean it.', hair: '#2a2018', skin: '#e8b890', shirt: '#8a2a4a' },
  { speaker: 'Mara Solis', role: 'Fixer', line: 'The Vultures are moving on my plaza. Clear them out. All of them.', hair: '#2a2018', skin: '#e8b890', shirt: '#8a2a4a' },
  { speaker: 'Mara Solis', role: 'Fixer', line: 'We hit the bank tonight. Hold the lobby while I crack the vault.', hair: '#2a2018', skin: '#e8b890', shirt: '#8a2a4a' },
  { speaker: 'Lena Voss', role: 'Getaway Pilot', line: 'Chopper\'s on you, Rico! Break line of sight — duck under the skyline, lose the light!', hair: '#c8a020', skin: '#f0c8a0', shirt: '#2a5a8a' },
  { speaker: 'Nina', role: 'Wheelwoman', line: 'Take the gold coupe. It\'s the Vultures\' own car — nobody stops their own. Marina, quiet.', hair: '#101018', skin: '#c89068', shirt: '#3a7a4a' },
  { speaker: 'Mara Solis', role: 'Fixer', line: 'Dante\'s on the yacht. End this, Rico — Solmar Bay is ours.', hair: '#2a2018', skin: '#e8b890', shirt: '#8a2a4a' },
];

function stepGoto(x, z, radius, text) {
  return { type: 'goto', x, z, radius: radius || 6, text };
}

function stepSteal(text) {
  return { type: 'steal', text };
}

function stepDeliver(x, z, text) {
  return { type: 'deliver', x, z, radius: 7, text };
}

function stepKill(count, x, z, text) {
  return { type: 'kill', count, x, z, radius: 30, text, spawned: false, killed: 0 };
}

function stepSurvive(seconds, x, z, text) {
  return { type: 'survive', seconds, x, z, radius: 14, text, elapsed: 0 };
}

function stepEscape(text) {
  return { type: 'escape', text };
}

export function missionSteps(index, city) {
  switch (index) {
    case 0:
      return [
        stepGoto(city.pierTip.x, city.pierTip.z - 40, 6, 'Drive to the pier — follow the yellow marker'),
        stepGoto(city.plaza.x, city.plaza.z, 6, 'Mara is waiting at the plaza. Go meet her'),
      ];
    case 1:
      return [
        stepSteal('Steal the marked coupe — get close and press E'),
        stepDeliver(city.garage.x, city.garage.z, 'Deliver the coupe to the garage'),
      ];
    case 2:
      return [
        stepGoto(-120, -160, 6, 'Pick up the package at the north docks'),
        stepDeliver(120, -160, 'Deliver the package — the police are on to you'),
      ];
    case 3:
      return [
        stepKill(6, city.plaza.x, city.plaza.z, 'Clear the Vultures out of the plaza (6 left)'),
      ];
    case 4:
      return [
        stepGoto(city.bank.x, city.bank.z, 7, 'Get to the Solmar Bay Bank'),
        stepSurvive(20, city.bank.x, city.bank.z, 'Hold the bank lobby while Mara cracks the vault'),
        stepEscape('Get out — lose the police and reach the garage'),
      ];
    case 5:
      return [
        stepGoto(city.garage.x, city.garage.z, 7, 'Reach the safehouse garage — the chopper is on you'),
        stepEscape('Lose the chopper — break line of sight, then lay low'),
      ];
    case 6:
      return [
        stepSteal('Steal the gold coupe — the Vultures\' own car, nobody will look twice'),
        stepDeliver(city.marina.x, city.marina.z - 24, 'Deliver the gold coupe to the marina'),
        stepGoto(city.garage.x, city.garage.z, 7, 'Get back to the garage — Mara has the last job'),
      ];
    case 7:
      return [
        stepGoto(city.marina.x, city.marina.z - 30, 7, 'Reach the marina — Dante Kross is waiting'),
        stepKill(4, city.marina.x, city.marina.z, 'Take down Dante\'s guards (4 left)'),
        stepGoto(city.marina.x, city.marina.z + 18, 5, 'Board the yacht and end this'),
      ];
    default:
      return [];
  }
}

/** A floating beacon + a ground ring that marks where the player must go. */
export class Marker {
  constructor(scene) {
    this.scene = scene;
    this.beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 26, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffd23f, transparent: true, opacity: 0.28,
        side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    this.beacon.position.y = 13;
    this.beacon.visible = false;
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(2.2, 3, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.15;
    this.ring.visible = false;
    this.scene.add(this.beacon);
    this.scene.add(this.ring);
  }

  show(x, z) {
    this.beacon.position.x = x;
    this.beacon.position.z = z;
    this.ring.position.x = x;
    this.ring.position.z = z;
    this.beacon.visible = true;
    this.ring.visible = true;
  }

  hide() {
    this.beacon.visible = false;
    this.ring.visible = false;
  }

  update(dt, time) {
    if (!this.beacon.visible) return;
    this.beacon.rotation.y += dt * 0.8;
    const s = 1 + Math.sin(time * 4) * 0.12;
    this.ring.scale.set(s, s, 1);
  }
}

export class MissionManager {
  constructor(scene, city, audio) {
    this.scene = scene;
    this.city = city;
    this.audio = audio;
    this.marker = new Marker(scene);
    this.index = 0;
    this.completed = [];
    this.active = false;
    this.steps = [];
    this.stepIndex = 0;
    this.onEvent = null;
    this.onStart = null;
    this.escapeTimer = 0;
  }

  get currentStep() {
    return this.steps[this.stepIndex] || null;
  }

  get name() {
    return MISSION_NAMES[this.index] || 'Free Roam';
  }

  start(index) {
    this.index = index;
    this.steps = missionSteps(index, this.city);
    this.stepIndex = 0;
    this.active = true;
    this.escapeTimer = 0;
    this.announce(MISSION_NAMES[index], MISSION_INTROS[index]);
    if (this.onEvent && MISSION_DIALOGUE[index]) {
      this.onEvent({ type: 'dialogue', ...MISSION_DIALOGUE[index] });
    }
    if (this.onStart) this.onStart(index);
    this.refreshMarker();
  }

  announce(title, text) {
    if (this.onEvent) this.onEvent({ type: 'announce', title, text });
  }

  refreshMarker() {
    const step = this.currentStep;
    if (!step) { this.marker.hide(); return; }
    if (step.type === 'steal') {
      this.marker.hide();
      return;
    }
    if (step.x !== undefined) this.marker.show(step.x, step.z);
    else this.marker.hide();
  }

  completeStep() {
    this.stepIndex += 1;
    this.audio.pickup();
    if (this.stepIndex >= this.steps.length) {
      this.completeMission();
    } else {
      this.refreshMarker();
    }
  }

  completeMission() {
    const reward = MISSION_REWARDS[this.index] || 500;
    this.completed.push(this.index);
    this.active = false;
    this.marker.hide();
    this.audio.missionDone();
    if (this.onEvent) {
      this.onEvent({
        type: 'mission-complete',
        index: this.index,
        name: MISSION_NAMES[this.index],
        reward,
      });
    }
    if (this.index + 1 < MISSION_NAMES.length) {
      this.start(this.index + 1);
    } else if (this.onEvent) {
      this.onEvent({ type: 'story-complete' });
    }
  }

  failMission(reason) {
    this.active = false;
    this.marker.hide();
    this.audio.fail();
    if (this.onEvent) this.onEvent({ type: 'mission-failed', reason });
  }

  /** Called when the player steals a car while a steal step is active. */
  onCarStolen(car) {
    const step = this.currentStep;
    if (step && step.type === 'steal') this.completeStep();
  }

  /** Called when a gang member dies while a kill step is active. */
  onGangKilled() {
    const step = this.currentStep;
    if (!step || step.type !== 'kill') return;
    step.killed += 1;
    if (this.onEvent) {
      this.onEvent({
        type: 'objective',
        text: step.text.replace(/\(\d+ left\)/, `(${step.count - step.killed} left)`),
      });
    }
    if (step.killed >= step.count) this.completeStep();
  }

  update(dt, player, world) {
    if (!this.active) return;
    const step = this.currentStep;
    if (!step) return;
    const dist = step.x !== undefined
      ? Math.hypot(player.x - step.x, player.z - step.z)
      : Infinity;
    switch (step.type) {
      case 'goto':
      case 'deliver':
        if (dist < step.radius) this.completeStep();
        break;
      case 'kill':
        if (!step.spawned) {
          step.spawned = true;
          world.gang.spawnSquad(step.x, step.z, step.count);
        }
        break;
      case 'survive':
        if (dist < step.radius) {
          step.elapsed += dt;
          if (step.elapsed >= step.seconds) this.completeStep();
          // Gang waves keep the pressure on while you hold the lobby.
          if (world.gang.list.length < 3 && Math.random() < dt * 0.4) {
            world.gang.spawnSquad(step.x + (Math.random() < 0.5 ? -14 : 14), step.z + 10, 2);
          }
        } else {
          step.elapsed = Math.max(0, step.elapsed - dt);
        }
        break;
      case 'escape':
        this.escapeTimer += dt;
        if (world.police.stars === 0 && this.escapeTimer > 3) this.completeStep();
        break;
      default:
        break;
    }
  }

  objectiveText() {
    if (!this.active) return 'Free roam — press M for the mission list, E to steal a car';
    const step = this.currentStep;
    if (!step) return '';
    if (step.type === 'kill') {
      return step.text.replace(/\(\d+ left\)/, `(${step.count - step.killed} left)`);
    }
    if (step.type === 'survive') {
      return `${step.text} — hold ${Math.max(0, Math.ceil(step.seconds - step.elapsed))}s`;
    }
    return step.text;
  }
}
