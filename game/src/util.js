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
