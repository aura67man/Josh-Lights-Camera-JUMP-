// engine.js - canvas, fixed-step loop, math helpers, RNG, FX (shake / hit-stop), particles, tile physics
export const W = 320, H = 180, TILE = 16;
export const T_EMPTY = 0, T_SOLID = 1, T_PLAT = 2, T_BREAK = 3;
export let canvas = null, ctx = null;

export function initCanvas() {
  canvas = document.getElementById('game');
  canvas.width = W; canvas.height = H;
  ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const fit = () => {
    const s = Math.max(1, Math.floor(Math.min(window.innerWidth / W, window.innerHeight / H)));
    canvas.style.width = (W * s) + 'px';
    canvas.style.height = (H * s) + 'px';
  };
  window.addEventListener('resize', fit);
  fit();
}

// Fixed 60Hz simulation step, rendering every animation frame. Movement always uses dt.
export const STEP = 1 / 60;
export function startLoop(update, render) {
  let last = performance.now(), acc = 0;
  const frame = (now) => {
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.25) dt = 0.25;
    if (dt < 0) dt = 0;
    if (Math.abs(dt - STEP) < 0.002) dt = STEP; // absorb vsync jitter
    acc += dt;
    let n = 0;
    while (acc >= STEP - 1e-6) {
      update(STEP); acc -= STEP;
      if (++n >= 6) { acc = 0; break; }
    }
    ctx.imageSmoothingEnabled = false;
    render(ctx);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p) => Math.random() < p;
export const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

export function makeRng(seed) {
  let s = seed >>> 0;
  const f = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.i = (a, b) => Math.floor(a + f() * (b - a + 1));
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  f.chance = (p) => f() < p;
  return f;
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  return [c, x];
}

// Screen shake, hit-stop, flashes, slow-mo
export const FX = {
  shakeT: 0, shakeMag: 0, hitStop: 0, flashT: 0, flashMax: 0, flashCol: '#fff', slowT: 0,
  shake(mag, t = 0.25) { this.shakeMag = Math.max(this.shakeMag, mag); this.shakeT = Math.max(this.shakeT, t); },
  stop(t) { this.hitStop = Math.max(this.hitStop, t); },
  flash(col = '#fff', t = 0.15) { this.flashCol = col; this.flashT = t; this.flashMax = t; },
  slow(t) { this.slowT = Math.max(this.slowT, t); },
  update(dt) {
    if (this.shakeT > 0) { this.shakeT -= dt; if (this.shakeT <= 0) { this.shakeT = 0; this.shakeMag = 0; } }
    if (this.flashT > 0) this.flashT -= dt;
    if (this.slowT > 0) this.slowT -= dt;
  },
  offset() {
    if (this.shakeT <= 0) return [0, 0];
    const m = this.shakeMag * Math.min(1, this.shakeT * 5);
    return [Math.round((Math.random() * 2 - 1) * m), Math.round((Math.random() * 2 - 1) * m)];
  },
  drawFlash(c) {
    if (this.flashT > 0) {
      c.globalAlpha = Math.max(0, this.flashT / this.flashMax) * 0.8;
      c.fillStyle = this.flashCol; c.fillRect(0, 0, W, H);
      c.globalAlpha = 1;
    }
  },
  reset() { this.shakeT = 0; this.shakeMag = 0; this.hitStop = 0; this.flashT = 0; this.slowT = 0; },
};

export class Particles {
  constructor() { this.list = []; }
  add(p) {
    const q = { x: 0, y: 0, vx: 0, vy: 0, g: 0, life: 0.5, c: '#fff', s: 1, drag: 0, ...p };
    q.max = q.life;
    this.list.push(q);
    if (this.list.length > 600) this.list.shift();
    return q;
  }
  burst(x, y, n, cols, spd = 80, life = 0.5, g = 200, s = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = spd * (0.3 + Math.random() * 0.7);
      this.add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - spd * 0.3, g, life: life * (0.5 + Math.random() * 0.7),
        c: Array.isArray(cols) ? pick(cols) : cols, s: Math.random() < 0.3 ? s + 1 : s });
    }
  }
  ring(x, y, n, col, spd, life = 0.4) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.add({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life, c: col, s: 2, drag: 3 });
    }
  }
  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.life -= dt;
      if (p.life <= 0) { L[i] = L[L.length - 1]; L.pop(); continue; }
      p.vy += p.g * dt;
      if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
  }
  draw(c, cx, cy) {
    for (const p of this.list) {
      c.globalAlpha = Math.min(1, (p.life / p.max) * 2);
      c.fillStyle = p.c;
      c.fillRect(Math.round(p.x - cx), Math.round(p.y - cy), p.s, p.s);
    }
    c.globalAlpha = 1;
  }
  clear() { this.list.length = 0; }
}

// Tile physics. Body: {x,y,w,h,vx,vy}. Level: {get(tx,ty), cols, rows}
export const isSolidT = (t) => t === T_SOLID || t === T_BREAK;
export function moveBody(b, lvl, dt) {
  b.hitWall = 0; b.hitCeil = false;
  const T = TILE;
  // horizontal
  b.x += b.vx * dt;
  const ty0 = Math.floor((b.y + 1) / T), ty1 = Math.floor((b.y + b.h - 1) / T);
  if (b.vx > 0) {
    const tx = Math.floor((b.x + b.w - 0.001) / T);
    for (let ty = ty0; ty <= ty1; ty++) if (isSolidT(lvl.get(tx, ty))) { b.x = tx * T - b.w; b.vx = 0; b.hitWall = 1; break; }
  } else if (b.vx < 0) {
    const tx = Math.floor(b.x / T);
    for (let ty = ty0; ty <= ty1; ty++) if (isSolidT(lvl.get(tx, ty))) { b.x = (tx + 1) * T; b.vx = 0; b.hitWall = -1; break; }
  }
  // vertical
  const prevBottom = b.y + b.h;
  b.y += b.vy * dt;
  b.onGround = false;
  const tx0 = Math.floor(b.x / T), tx1 = Math.floor((b.x + b.w - 0.001) / T);
  if (b.vy >= 0) {
    const ty = Math.floor((b.y + b.h) / T);
    for (let tx = tx0; tx <= tx1; tx++) {
      const t = lvl.get(tx, ty);
      if (isSolidT(t) || (t === T_PLAT && prevBottom <= ty * T + 0.5 && !b.drop)) {
        b.y = ty * T - b.h; b.vy = 0; b.onGround = true; break;
      }
    }
  } else {
    const ty = Math.floor(b.y / T);
    for (let tx = tx0; tx <= tx1; tx++) if (isSolidT(lvl.get(tx, ty))) { b.y = (ty + 1) * T; b.vy = 0; b.hitCeil = true; break; }
  }
}

// Is there floor (solid or platform) at pixel point?
export function floorAt(lvl, px, py) {
  const t = lvl.get(Math.floor(px / TILE), Math.floor(py / TILE));
  return isSolidT(t) || t === T_PLAT;
}
