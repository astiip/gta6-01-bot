// Shared helpers for Solmar Bay: seeded random, math, and tiny geometry tools.
// Every module in this game imports from here; nothing here touches the DOM.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rand(rng, a, b) {
  return a + rng() * (b - a);
}

export function randInt(rng, a, b) {
  return Math.floor(rand(rng, a, b + 1));
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Shortest-arc interpolation between two headings (radians). */
export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function dist2D(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

/** A canvas texture of a building facade: base colour with a grid of windows. */
export function facadeTexture(base, lit, rng) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 256);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0, 0, 128, 10);
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      const x = 10 + col * 23;
      const y = 22 + row * 25;
      const litWindow = rng() < 0.35;
      ctx.fillStyle = litWindow ? lit : '#1d2733';
      ctx.fillRect(x, y, 15, 17);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(x, y, 15, 2);
    }
  }
  const tex = new window.THREE.CanvasTexture(canvas);
  tex.colorSpace = window.THREE.SRGBColorSpace;
  return tex;
}

/**
 * Golden-hour sky: a vertical gradient from dusk purple through sunset pink
 * and orange to a warm horizon, with a low glowing sun disc off to the west.
 * Used as the scene background so every frame carries the sunset.
 */
export function sunsetSkyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#3a2350');
  grad.addColorStop(0.42, '#8a3a6a');
  grad.addColorStop(0.62, '#ff7e5f');
  grad.addColorStop(0.82, '#feb47b');
  grad.addColorStop(1, '#ffd9a0');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);
  // Low sun, west (left) of frame, with a soft halo.
  const halo = ctx.createRadialGradient(300, 330, 10, 300, 330, 190);
  halo.addColorStop(0, 'rgba(255, 240, 190, 0.95)');
  halo.addColorStop(0.35, 'rgba(255, 190, 110, 0.55)');
  halo.addColorStop(1, 'rgba(255, 150, 90, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, 1024, 512);
  ctx.fillStyle = '#fff3c8';
  ctx.beginPath();
  ctx.arc(300, 330, 42, 0, Math.PI * 2);
  ctx.fill();
  // A few thin dusk clouds catching the pink light.
  ctx.fillStyle = 'rgba(255, 170, 150, 0.35)';
  for (const [cx, cy, cw] of [[620, 150, 260], [820, 210, 200], [120, 120, 180], [480, 90, 220]]) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, cw / 2, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new window.THREE.CanvasTexture(canvas);
  tex.colorSpace = window.THREE.SRGBColorSpace;
  return tex;
}
