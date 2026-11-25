// sprites.js - all pixel art is generated in code. Every character/enemy/boss/pickup sprite gets an
// automatic clean 1px black outline. Also builds per-world tilesets and parallax backgrounds.
import { makeCanvas, makeRng, W, H } from './engine.js';
import { drawText } from './font.js';

// ---------- pixel grid + painter ----------
export class G {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Array(w * h).fill(0); }
  p(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c; }
  get(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.d[y * this.w + x] : 0; }
  r(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.p(x + i, y + j, c); }
  hl(x0, x1, y, c) { for (let x = x0; x <= x1; x++) this.p(x, y, c); }
  vl(x, y0, y1, c) { for (let y = y0; y <= y1; y++) this.p(x, y, c); }
  e(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / (rx + 0.35), dy = (y - cy) / (ry + 0.35);
        if (dx * dx + dy * dy <= 1) this.p(x, y, c);
      }
  }
  l(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.p(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  s(x, y, rows, pal) { rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const c = pal[row[i]]; if (c) this.p(x + i, y + j, c); } }); }
}

const CC = {};
function rgb(c) {
  if (CC[c]) return CC[c];
  let h = c.slice(1);
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  const n = parseInt(h, 16);
  return (CC[c] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]);
}
function gridToCanvas(g) {
  const [cv, x] = makeCanvas(g.w, g.h);
  const id = x.createImageData(g.w, g.h);
  for (let i = 0; i < g.d.length; i++) {
    const c = g.d[i];
    if (c) { const [r, gg, b] = rgb(c); id.data[i * 4] = r; id.data[i * 4 + 1] = gg; id.data[i * 4 + 2] = b; id.data[i * 4 + 3] = 255; }
  }
  x.putImageData(id, 0, 0);
  return cv;
}
function flipCanvas(src) {
  const [cv, x] = makeCanvas(src.width, src.height);
  x.translate(src.width, 0); x.scale(-1, 1); x.drawImage(src, 0, 0);
  return cv;
}
// Clean 1px outline: any empty pixel touching (4-neighbour) a filled pixel becomes black.
export function outline(g, col = '#000') {
  const o = new G(g.w + 2, g.h + 2);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) { const c = g.get(x, y); if (c) o.p(x + 1, y + 1, c); }
  for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) {
    if (o.get(x, y)) continue;
    const sx = x - 1, sy = y - 1;
    if (g.get(sx - 1, sy) || g.get(sx + 1, sy) || g.get(sx, sy - 1) || g.get(sx, sy + 1)) o.p(x, y, col);
  }
  return o;
}
export function scaleG(g, k) {
  const o = new G(g.w * k, g.h * k);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) { const c = g.get(x, y); if (c) o.r(x * k, y * k, k, k, c); }
  return o;
}
// frame: {c, f (flipped), w, h, ax, ay}  (ax, ay = anchor, default bottom-centre)
export function frame(g, ax, ay, noOutline = false) {
  const o = noOutline ? g : outline(g);
  const off = noOutline ? 0 : 1;
  const c = gridToCanvas(o);
  return { c, f: flipCanvas(c), w: o.w, h: o.h, ax: (ax ?? g.w / 2) + off, ay: (ay ?? g.h) + off };
}
export function whiteOf(fr, flip) {
  const k = flip ? 'wf' : 'wc';
  if (!fr[k]) {
    const [cv, x] = makeCanvas(fr.w, fr.h);
    x.drawImage(flip ? fr.f : fr.c, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = '#fff'; x.fillRect(0, 0, fr.w, fr.h);
    fr[k] = cv;
  }
  return fr[k];
}
// Draw frame with its anchor at (x,y) in screen space. Sprites face right; flip=true faces left.
export function drawSprite(c, fr, x, y, flip = false, white = false, alpha = 1) {
  if (!fr) return;
  const img = white ? whiteOf(fr, flip) : flip ? fr.f : fr.c;
  const ax = flip ? fr.w - fr.ax : fr.ax;
  if (alpha < 1) c.globalAlpha = Math.max(0, alpha);
  c.drawImage(img, Math.round(x - ax), Math.round(y - fr.ay));
  if (alpha < 1) c.globalAlpha = 1;
}
export function drawSpriteScaled(c, fr, x, y, s, flip = false) {
  const img = flip ? fr.f : fr.c;
  const ax = flip ? fr.w - fr.ax : fr.ax;
  c.drawImage(img, Math.round(x - ax * s), Math.round(y - fr.ay * s), fr.w * s, fr.h * s);
}

// ---------- humanoid generator (height, skin, hair, outfit differ - nothing else) ----------
const HAIR = {
  swoop(g, x, y, o) { g.hl(x, x + 5, y, o.hair); g.hl(x - 1, x + 6, y + 1, o.hair); g.hl(x - 1, x + 1, y + 2, o.hair); g.hl(x + 5, x + 6, y + 2, o.hair); g.p(x - 1, y + 3, o.hair); g.p(x, y + 3, o.hair); g.p(x - 1, y + 4, o.hair); g.hl(x + 2, x + 4, y, o.hairL || o.hair); },
  crop(g, x, y, o) { g.hl(x, x + 5, y, o.hair); g.hl(x - 1, x + 5, y + 1, o.hair); g.hl(x - 1, x, y + 2, o.hair); g.p(x - 1, y + 3, o.hair); },
  curly(g, x, y, o) { g.p(x, y - 1, o.hair); g.p(x + 2, y - 1, o.hair); g.p(x + 4, y - 1, o.hair); g.hl(x - 1, x + 6, y, o.hair); g.hl(x - 1, x + 6, y + 1, o.hair); g.hl(x - 1, x, y + 2, o.hair); g.p(x + 6, y + 2, o.hair); g.p(x - 1, y + 3, o.hair); g.p(x + 1, y, o.hairL || o.hair); g.p(x + 4, y + 1, o.hairL || o.hair); },
  bigcurly(g, x, y, o) { g.p(x + 1, y - 2, o.hair); g.p(x + 3, y - 2, o.hair); g.hl(x - 1, x + 5, y - 1, o.hair); g.hl(x - 2, x + 6, y, o.hair); g.hl(x - 2, x + 7, y + 1, o.hair); g.hl(x - 2, x, y + 2, o.hair); g.hl(x + 6, x + 7, y + 2, o.hair); g.hl(x - 2, x - 1, y + 3, o.hair); g.hl(x - 2, x - 1, y + 4, o.hair); g.p(x - 1, y + 5, o.hair); g.p(x + 2, y - 1, o.hairL); g.p(x, y + 1, o.hairL); g.p(x + 5, y, o.hairL); },
  messy(g, x, y, o) { g.p(x + 1, y - 1, o.hair); g.p(x + 4, y - 1, o.hair); g.hl(x - 1, x + 5, y, o.hair); g.hl(x - 1, x + 6, y + 1, o.hair); g.hl(x - 1, x + 1, y + 2, o.hair); g.p(x + 4, y + 2, o.hair); g.p(x + 6, y + 2, o.hair); g.hl(x - 1, x, y + 3, o.hair); g.p(x - 1, y + 4, o.hair); g.p(x + 2, y, o.hairL || o.hair); },
  short(g, x, y, o) { HAIR.crop(g, x, y, o); },
  bald(g, x, y, o) { g.hl(x + 1, x + 4, y, o.skin); g.p(x - 1, y + 1, o.hair); g.hl(x - 1, x, y + 2, o.hair); g.p(x - 1, y + 3, o.hair); },
  slick(g, x, y, o) { g.hl(x, x + 5, y, o.hair); g.hl(x - 1, x + 6, y + 1, o.hair); g.hl(x - 1, x, y + 2, o.hair); g.p(x - 1, y + 3, o.hair); g.hl(x + 1, x + 4, y, o.hairL || o.hair); },
  none() {},
};
const darken = (c, k = 0.7) => { const [r, g, b] = rgb(c); const h = (v) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0'); return '#' + h(r) + h(g) + h(b); };

const ACC = {
  scarf(g, A, c) { const { bx, tTop, P } = A; const f = P.flut || 0; g.hl(bx, bx + 6, tTop, c); g.hl(bx - 1, bx, tTop + 1, c); g.p(bx - 2, tTop + 1 + f, c); g.p(bx - 3, tTop + 2 - f, c); g.p(bx + 5, tTop + 1, darken(c)); },
  longscarf(g, A, c) { const { bx, tTop, P } = A; const f = P.flut || 0; g.hl(bx, bx + 6, tTop, c); g.vl(bx + 5, tTop + 1, tTop + 4, c); g.p(bx + 6, tTop + 1, c); g.hl(bx - 2, bx - 1, tTop + 1, c); g.p(bx - 3, tTop + 2 + f, c); g.p(bx - 4, tTop + 2, c); },
  apron(g, A, c) { const { bx, tTop, torsoH } = A; g.r(bx + 2, tTop + 1, 4, torsoH + 1, c); g.p(bx + 2, tTop, c); g.p(bx + 5, tTop, c); g.p(bx + 3, tTop + 2, darken(c)); },
  headphones(g, A) { const { hX, hy } = A; g.hl(hX, hX + 4, hy - 1, '#2a2a30'); g.r(hX + 1, hy + 2, 2, 3, '#2a2a30'); g.p(hX + 1, hy + 3, '#d84a4a'); },
  camera(g, A) { const { bx, tTop, P } = A; g.r(bx + 7, tTop - 4, 6, 4, '#3a3a46'); g.hl(bx + 7, bx + 12, tTop - 4, '#5a5a6a'); g.r(bx + 13, tTop - 3, 2, 2, '#18181e'); g.p(bx + 14, tTop - 3, '#7ad0ff'); g.p(bx + 8, tTop - 5, P.rec ? '#ff3030' : '#6a2020'); g.r(bx + 10, tTop - 6, 2, 2, '#3a3a46'); },
  beanie(g, A, c) { const { hX, hy } = A; g.hl(hX, hX + 5, hy - 2, c); g.hl(hX - 1, hX + 6, hy - 1, c); g.hl(hX - 1, hX + 6, hy, c); g.hl(hX - 1, hX + 6, hy + 1, darken(c)); },
  cap(g, A, c) { const { hX, hy } = A; g.hl(hX, hX + 5, hy - 1, c); g.hl(hX - 1, hX + 5, hy, c); g.hl(hX - 1, hX + 8, hy + 1, darken(c)); },
  cowboy(g, A, c) { const { hX, hy } = A; g.hl(hX + 1, hX + 4, hy - 3, c); g.hl(hX, hX + 5, hy - 2, c); g.hl(hX, hX + 5, hy - 1, c); g.hl(hX, hX + 5, hy, '#3a2414'); g.hl(hX - 3, hX + 8, hy + 1, c); },
  glasses(g, A) { const { hX, hy } = A; g.hl(hX + 2, hX + 6, hy + 3, '#2a2a2a'); g.p(hX + 3, hy + 3, '#bfe0ff'); g.p(hX + 5, hy + 3, '#bfe0ff'); },
  shades(g, A) { const { hX, hy } = A; g.hl(hX + 1, hX + 6, hy + 3, '#111'); g.p(hX + 3, hy + 4, '#111'); g.p(hX + 5, hy + 4, '#111'); g.p(hX + 4, hy + 3, '#555'); },
  bandana(g, A, c) { const { hX, hy } = A; g.r(hX + 1, hy + 4, 6, 3, c); g.p(hX - 1, hy + 4, c); g.p(hX - 2, hy + 5, c); g.p(hX + 4, hy + 5, darken(c)); },
  tie(g, A, c) { const { bx, tTop, torsoH } = A; g.vl(bx + 4, tTop, tTop + torsoH - 2, c); g.p(bx + 3, tTop, '#f4f4f4'); g.p(bx + 5, tTop, '#f4f4f4'); },
  headset(g, A) { const { hX, hy } = A; g.hl(hX, hX + 4, hy - 1, '#333'); g.p(hX + 1, hy + 3, '#333'); g.p(hX + 2, hy + 5, '#333'); g.p(hX + 3, hy + 5, '#333'); },
  antenna(g, A, c) { const { hX, hy } = A; g.vl(hX + 1, hy - 2, hy - 1, c); g.p(hX, hy - 3, '#ffe84a'); g.vl(hX + 4, hy - 2, hy - 1, c); g.p(hX + 5, hy - 3, '#ffe84a'); },
  vest(g, A, c) { const { bx, tTop, torsoH } = A; g.r(bx, tTop, 2, torsoH, c); g.r(bx + 5, tTop, 1, torsoH, c); },
  coat(g, A, c) { const { bx, tTop, torsoH, lTop } = A; g.r(bx, tTop, 2, torsoH + 3, c); g.r(bx + 5, tTop, 1, torsoH + 2, c); g.p(bx - 1, lTop + 1, c); },
  torn(g, A) { const { bx, tTop } = A; g.p(bx + 2, tTop + 2, '#3a3a40'); g.p(bx + 4, tTop + 4, '#3a3a40'); g.p(bx + 1, tTop + 4, '#a8c49a'); },
  star(g, A) { const { bx, tTop } = A; g.p(bx + 3, tTop + 2, '#ffd84a'); },
  stripe(g, A, c) { const { bx, tTop, torsoH } = A; g.vl(bx + 2, tTop, tTop + torsoH - 1, c); },
};
const PROP = {
  clapper(g, hx, hy, mode, o) {
    const B = o.clapGold ? '#d8a820' : '#2b2b2b', S = o.clapGold ? '#fff4b0' : '#f4f4f4', D = o.clapGold ? '#8a6a10' : '#151515';
    if (mode === 'atk1') { g.r(hx - 2, hy - 4, 5, 4, B); for (let i = 0; i < 5; i++) g.p(hx - 2 + i, hy - 5, i % 2 ? D : S); g.hl(hx - 1, hx + 1, hy - 2, S); }
    else if (mode === 'atk2') { g.r(hx + 1, hy - 2, 5, 4, B); for (let i = 0; i < 5; i++) g.p(hx + 1 + i, hy - 3, i % 2 ? D : S); g.hl(hx + 2, hx + 4, hy, S); }
  },
  note(g, hx, hy) { g.r(hx, hy - 3, 3, 4, '#f4f4e8'); g.hl(hx, hx + 2, hy - 2, '#8a8aa0'); g.hl(hx, hx + 2, hy, '#8a8aa0'); },
  tomato(g, hx, hy) { g.r(hx, hy - 2, 3, 3, '#e03a2a'); g.p(hx + 1, hy - 3, '#3a9a3a'); },
  sandbag(g, hx, hy) { g.r(hx, hy - 3, 4, 4, '#c8a56a'); g.p(hx + 1, hy - 4, '#8a6a3a'); },
  dynamite(g, hx, hy) { g.r(hx, hy - 4, 2, 5, '#d03030'); g.p(hx + 1, hy - 5, '#ffd84a'); },
  pcam(g, hx, hy) { g.r(hx, hy - 3, 5, 4, '#2a2a30'); g.p(hx + 5, hy - 2, '#9cf'); g.p(hx + 1, hy - 4, '#ffffff'); },
  boom(g, hx, hy) { g.l(hx, hy, hx + 7, hy - 7, '#6a6a6a'); g.r(hx + 7, hy - 10, 4, 3, '#8a8a8a'); g.p(hx + 8, hy - 10, '#aaaaaa'); },
  scissors(g, hx, hy) { g.l(hx, hy, hx + 4, hy - 3, '#c8c8d0'); g.l(hx, hy - 3, hx + 4, hy, '#c8c8d0'); g.p(hx, hy, '#d03030'); },
  revolver(g, hx, hy) { g.r(hx, hy - 1, 4, 2, '#4a4a52'); g.p(hx, hy + 1, '#6a4a2a'); },
};

function humanoid(o, P) {
  const torsoH = o.h === 'tall' ? 8 : o.h === 'short' ? 5 : 6;
  const legH = o.h === 'tall' ? 9 : o.h === 'short' ? 5 : 7;
  const top = 4, bx = 8;
  const Ht = top + 7 + torsoH + legH;
  const g = new G(26, Ht);
  const bob = P.bob || 0, lean = P.lean || 0;
  const hy = top + bob, hX = bx + lean;
  const tTop = top + 7 + bob, lTop = top + 7 + torsoH;
  const arms = P.arms || ['down', 'down'];
  const neutral = ['down', 'fwd', 'back'];
  const armB = arms[0];
  const armF = o.armF && neutral.includes(arms[1]) ? o.armF : arms[1];
  const sleeve = o.sleeve || o.shirt;
  const armPts = (side, mode) => {
    const sx = side === 'f' ? bx + 6 : bx - 1, sy = tTop + 1, d = side === 'f' ? 1 : -1;
    const n = torsoH, pts = [];
    switch (mode) {
      case 'down': for (let r = 0; r < n; r++) pts.push([sx, sy + r]); break;
      case 'fwd': for (let r = 0; r < n; r++) pts.push([sx + Math.round(r * 0.45), sy + r]); break;
      case 'back': for (let r = 0; r < n; r++) pts.push([sx - Math.round(r * 0.45), sy + r]); break;
      case 'up': pts.push([sx, sy], [sx, sy - 1], [sx + d, sy - 2], [sx + d, sy - 3]); break;
      case 'atk1': pts.push([sx, sy], [sx, sy - 1], [sx + 1, sy - 2], [sx + 1, sy - 3], [sx + 1, sy - 4]); break;
      case 'atk2': pts.push([sx, sy], [sx + 1, sy + 1], [sx + 2, sy + 1], [sx + 3, sy + 1], [sx + 4, sy + 1]); break;
      case 'throw': pts.push([sx, sy], [sx + 1, sy], [sx + 2, sy], [sx + 3, sy]); break;
      case 'pose':
        if (side === 'f') pts.push([sx, sy], [sx + 1, sy - 1], [sx + 2, sy - 2], [sx + 3, sy - 3], [sx + 4, sy - 4]);
        else pts.push([sx, sy], [sx - 1, sy], [sx - 2, sy], [sx - 3, sy]);
        break;
      case 'hold': pts.push([sx, sy], [sx + 1, sy], [sx + 2, sy - 1]); break;
      case 'note': pts.push([sx, sy], [sx, sy + 1], [sx + 1, sy + 2], [sx + 2, sy + 2]); break;
      case 'carry': pts.push([sx, sy], [sx + 1, sy + 1], [sx + 2, sy + 1]); break;
      default: break;
    }
    return pts;
  };
  const drawArm = (side, mode, col) => {
    const pts = armPts(side, mode);
    pts.forEach((p, i) => g.p(p[0], p[1], i === pts.length - 1 ? o.skin : col));
    return pts[pts.length - 1];
  };
  const legs = P.legs || [0, 0], lift = P.lift || [0, 0];
  const leg = (lx, s, L, col) => {
    const n = Math.max(2, legH - L);
    for (let r = 0; r < n; r++) {
      const t = n > 1 ? r / (n - 1) : 1;
      const off = Math.round(s * t);
      if (r === n - 1) g.r(lx + off, lTop + r, 3, 1, o.shoe);
      else g.r(lx + off, lTop + r, 2, 1, col);
    }
  };
  drawArm('b', armB, o.shirtD);
  leg(bx + 1, legs[0], lift[0], o.pantsD || darken(o.pants));
  leg(bx + 3, legs[1], lift[1], o.pants);
  // torso
  g.r(bx, tTop, 6, torsoH, o.shirt);
  g.vl(bx, tTop, tTop + torsoH - 1, o.shirtD);
  if (o.inner) g.vl(bx + 4, tTop, tTop + torsoH - 2, o.inner);
  if (o.belt) g.hl(bx, bx + 5, lTop - 1, o.belt);
  // head
  g.r(hX, hy + 1, 6, 6, o.skin);
  g.p(hX, hy + 6, o.skinD);
  g.p(hX + 1, hy + 3, o.skinD);
  (HAIR[o.style] || HAIR.short)(g, hX, hy, o);
  const ey = hy + 3, E = '#1a1a1a';
  const eyes = P.eyes || o.eyes || 'n';
  if (eyes === 'n' || eyes === 'angry') { g.p(hX + 3, ey, E); g.p(hX + 5, ey, E); }
  if (eyes === 'angry') { g.p(hX + 3, ey - 1, darken(o.skin, 0.5)); g.p(hX + 4, ey - 1, darken(o.skin, 0.5)); }
  if (eyes === 'closed') { g.p(hX + 3, ey + 1, darken(o.skin, 0.55)); g.p(hX + 5, ey + 1, darken(o.skin, 0.55)); }
  if (eyes === 'hurt') { g.p(hX + 3, ey, E); g.p(hX + 5, ey, E); g.p(hX + 2, ey - 1, E); g.p(hX + 4, ey - 1, E); }
  if (eyes === 'ko') { g.p(hX + 3, ey, '#a02020'); g.p(hX + 5, ey, '#a02020'); g.p(hX + 4, ey - 1, '#a02020'); }
  if (eyes === 'glow') { g.p(hX + 3, ey, '#ffe84a'); g.p(hX + 5, ey, '#ffe84a'); }
  const mouth = P.mouth || o.mouth || 'smile', M = '#9a3a3a';
  if (mouth === 'smile') { g.p(hX + 4, hy + 5, M); g.p(hX + 5, hy + 5, M); }
  else if (mouth === 'open') { g.p(hX + 4, hy + 5, '#3a1010'); g.p(hX + 5, hy + 5, '#3a1010'); g.p(hX + 4, hy + 6, '#3a1010'); }
  else if (mouth === 'flat') { g.p(hX + 4, hy + 5, darken(o.skin, 0.6)); g.p(hX + 5, hy + 5, darken(o.skin, 0.6)); }
  else if (mouth === 'frown') { g.p(hX + 4, hy + 6, M); g.p(hX + 5, hy + 5, M); }
  const A = { bx, hX, hy, tTop, lTop, torsoH, legH, P };
  for (const a of o.acc || []) ACC[a[0]](g, A, a[1]);
  const hand = drawArm('f', armF, sleeve);
  if (hand) {
    const prop = P.prop !== undefined ? P.prop : o.prop;
    if (prop && PROP[prop]) {
      if (prop === 'clapper') { if (armF === 'atk1' || armF === 'atk2') PROP.clapper(g, hand[0], hand[1], armF, o); }
      else PROP[prop](g, hand[0], hand[1], armF, o);
    }
  }
  return g;
}

const POSES = {
  idle0: { arms: ['down', 'down'] },
  idle1: { arms: ['down', 'down'], bob: 1 },
  run0: { legs: [-2, 2], arms: ['fwd', 'back'], flut: 0 },
  run1: { legs: [0, 1], lift: [0, 2], arms: ['down', 'down'], flut: 1 },
  run2: { legs: [2, -2], arms: ['back', 'fwd'], flut: 0 },
  run3: { legs: [1, 0], lift: [2, 0], arms: ['down', 'down'], flut: 1 },
  jump: { legs: [-1, 2], lift: [1, 3], arms: ['back', 'up'], flut: 1 },
  fall: { legs: [-1, 1], arms: ['up', 'up'], flut: 0 },
  atk0: { legs: [-1, 1], arms: ['back', 'atk1'], prop: 'clapper', mouth: 'open' },
  atk1: { legs: [-2, 2], arms: ['back', 'atk2'], prop: 'clapper', mouth: 'open' },
  throw: { legs: [-1, 1], arms: ['back', 'throw'], mouth: 'open' },
  hurt: { legs: [-1, 1], arms: ['up', 'up'], lean: -1, eyes: 'hurt', mouth: 'open' },
  pose: { legs: [-2, 1], arms: ['pose', 'pose'], eyes: 'closed', mouth: 'smile' },
  ko: { arms: ['up', 'up'], eyes: 'ko', mouth: 'open', lean: -1 },
};
function humanoidSet(o, scale = 1) {
  const set = {};
  for (const k in POSES) {
    let g = humanoid(o, { ...POSES[k] });
    if (scale > 1) g = scaleG(g, scale);
    set[k] = frame(g, 11 * scale, g.h);
  }
  return set;
}

// Character looks: height / skin tone / hair / outfit only.
export const CHARS = {
  josh: { name: 'JOSH', h: 'normal', skin: '#f1c493', skinD: '#d29a6a', hair: '#1b1b2a', hairL: '#3a3a58', style: 'swoop', shirt: '#3b6fd6', shirtD: '#2a4fa0', inner: '#f4f4f4', pants: '#2d3452', shoe: '#f4f4f4', acc: [['scarf', '#d8343d']], prop: 'clapper', col: '#5a8ff0' },
  craig: { name: 'CRAIG', h: 'tall', skin: '#7e4f33', skinD: '#5f3a24', hair: '#16100d', style: 'crop', shirt: '#e2762b', shirtD: '#b5571a', inner: '#262626', pants: '#2a2a2a', shoe: '#5a3a22', acc: [['stripe', '#262626']], col: '#f08a40' },
  marcus: { name: 'MARCUS', h: 'short', skin: '#8f5b3a', skinD: '#6d4229', hair: '#16100d', hairL: '#3a2a20', style: 'curly', shirt: '#ececec', shirtD: '#c2c2c2', pants: '#6b4a2e', shoe: '#2a2a2a', acc: [['apron', '#3f8f4f']], col: '#5ac06a' },
  ayden: { name: 'AYDEN', h: 'normal', skin: '#f5d3bb', skinD: '#dcae92', hair: '#9b6b3a', hairL: '#b88a50', style: 'messy', shirt: '#7d8898', shirtD: '#5f6878', pants: '#2a2a33', shoe: '#3a3a3a', acc: [['headphones'], ['camera']], armF: 'hold', mouth: 'flat', col: '#a8b8d0' },
  finn: { name: 'FINN', h: 'normal', skin: '#f3cfb3', skinD: '#d8ab8c', hair: '#7a4422', hairL: '#9a5a30', style: 'bigcurly', shirt: '#7b3fa9', shirtD: '#5a2c7e', inner: '#f0f0f0', pants: '#22222a', shoe: '#6a3a1a', acc: [['longscarf', '#f2c230']], col: '#c080ff' },
  sebastian: { name: 'SEBASTIAN', h: 'normal', skin: '#ecc6a0', skinD: '#cfa47c', hair: '#3a2617', style: 'short', shirt: '#2d3f68', shirtD: '#1f2d4d', pants: '#6c6c74', shoe: '#2a2a2a', acc: [['beanie', '#4a4a52']], mouth: 'flat', col: '#8aa0c8' },
  finalcut: { name: 'MAX FINAL CUT', h: 'tall', skin: '#e8c0a0', skinD: '#c89a78', hair: '#2a2018', hairL: '#4a3a2a', style: 'slick', shirt: '#4a4a58', shirtD: '#34343e', inner: '#f4f4f4', pants: '#3a3a46', shoe: '#111', acc: [['tie', '#c82a3a'], ['shades']], prop: 'scissors', mouth: 'frown', col: '#e05050' },
};
const ENEMY_H = {
  critic: { h: 'normal', skin: '#e8c4a4', skinD: '#c8a080', hair: '#9a9a9a', style: 'bald', shirt: '#7a5a3a', shirtD: '#5a4028', inner: '#e8e0d0', pants: '#4a3a2a', shoe: '#2a1a10', acc: [['glasses'], ['tie', '#3a5a9a']], armF: 'note', prop: 'note', eyes: 'angry', mouth: 'frown' },
  tomatoCritic: { h: 'normal', skin: '#d8a880', skinD: '#b88860', hair: '#5a3a2a', style: 'short', shirt: '#4a8a4a', shirtD: '#3a6a3a', pants: '#3a3a4a', shoe: '#2a2a2a', acc: [['cap', '#c84030']], armF: 'carry', prop: 'tomato', eyes: 'angry', mouth: 'frown' },
  stagehand: { h: 'normal', skin: '#c58c62', skinD: '#a06c48', hair: '#1a1a1a', style: 'short', shirt: '#26262c', shirtD: '#18181c', pants: '#1e1e24', shoe: '#3a3a3a', acc: [['cap', '#3a3a44'], ['headset']], eyes: 'angry', mouth: 'frown' },
  sandbagger: { h: 'normal', skin: '#e2b48c', skinD: '#c09068', hair: '#6a4a2a', style: 'short', shirt: '#8a6a3a', shirtD: '#6a4e2a', pants: '#5a4a3a', shoe: '#2a2a2a', acc: [['cap', '#c88a30'], ['vest', '#5a6a8a']], armF: 'carry', prop: 'sandbag', eyes: 'angry', mouth: 'frown' },
  zombie: { h: 'normal', skin: '#a8c49a', skinD: '#88a47a', hair: '#3a3a2a', style: 'messy', shirt: '#6a6a72', shirtD: '#4a4a52', pants: '#3a3a50', shoe: '#2a2a2a', acc: [['torn']], armF: 'throw', eyes: 'glow', mouth: 'open' },
  bandit: { h: 'normal', skin: '#d8a478', skinD: '#b88458', hair: '#3a2a1a', style: 'short', shirt: '#d8c8a0', shirtD: '#b8a880', pants: '#4a4a6a', shoe: '#5a3a1a', acc: [['vest', '#7a5a3a'], ['cowboy', '#6a4a2a'], ['bandana', '#c83030']], eyes: 'angry' },
  dynamiteBandit: { h: 'normal', skin: '#c89468', skinD: '#a87448', hair: '#2a1a10', style: 'short', shirt: '#a03030', shirtD: '#802020', pants: '#3a3a3a', shoe: '#2a2a2a', acc: [['cowboy', '#2a2a2a'], ['bandana', '#3a6ad0']], armF: 'carry', prop: 'dynamite', eyes: 'angry' },
  paparazzi: { h: 'normal', skin: '#e0b090', skinD: '#c09070', hair: '#4a3a2a', style: 'short', shirt: '#b8a878', shirtD: '#988858', pants: '#3a3a4a', shoe: '#2a2a2a', acc: [['vest', '#6a7a4a'], ['cap', '#333338']], armF: 'carry', prop: 'pcam', eyes: 'angry', mouth: 'open' },
  flasher: { h: 'normal', skin: '#b88460', skinD: '#986440', hair: '#1a1a1a', style: 'crop', shirt: '#6a3a9a', shirtD: '#4a2a7a', inner: '#e0e0e0', pants: '#2a2a3a', shoe: '#111', acc: [['shades']], armF: 'carry', prop: 'pcam', mouth: 'frown' },
};
const BOSS_H = {
  criticBoss: { ...ENEMY_H.critic, shirt: '#6a2a2a', shirtD: '#4a1a1a', acc: [['glasses'], ['tie', '#d8b040']] },
  brutus: { h: 'tall', skin: '#c08860', skinD: '#a06840', hair: '#1a1a1a', style: 'crop', shirt: '#2a2a32', shirtD: '#1a1a20', pants: '#1e1e24', shoe: '#4a4a4a', acc: [['cap', '#c83030'], ['headset']], armF: 'carry', prop: 'boom', eyes: 'angry', mouth: 'frown' },
  dusty: { h: 'tall', skin: '#d0a070', skinD: '#b08050', hair: '#2a1a10', style: 'short', shirt: '#8a2a2a', shirtD: '#6a1a1a', pants: '#3a3030', shoe: '#2a1a10', acc: [['coat', '#5a3a2a'], ['cowboy', '#1e1e1e'], ['bandana', '#2a2a2a'], ['star']], armF: 'carry', prop: 'revolver', eyes: 'angry' },
  finnAlien: { ...CHARS.finn, shirt: '#5fbf4a', shirtD: '#3f9a2a', inner: '#9fef7a', pants: '#3f9a2a', shoe: '#2a6a1a', acc: [['antenna', '#5fbf4a'], ['longscarf', '#f2c230']], prop: 'note', eyes: 'n', mouth: 'open' },
};

// ---------- painter sprites (props, robots, ghosts, items) ----------
const P2 = {
  chair(f) { const g = new G(14, 14), Wd = '#a8713a', D = '#7a4a22', L = '#c89a5a', s = f; g.r(2, s, 10, 6, Wd); g.r(3, s + 1, 8, 4, L); g.r(4, s + 2, 2, 2, '#fff'); g.p(5, s + 3, '#111'); g.r(8, s + 2, 2, 2, '#fff'); g.p(8, s + 3, '#111'); g.hl(4, 5, s + 1, '#3a2010'); g.hl(8, 9, s + 1, '#3a2010'); g.hl(5, 8, s + 5, '#3a2010'); g.vl(2, s, 8, D); g.vl(11, s, 8, D); g.r(1, 7, 12, 2, L); g.hl(1, 12, 8, D); if (f) { g.r(1, 9, 2, 5, D); g.r(11, 9, 2, 5, D); } else { g.r(2, 9, 2, 5, D); g.r(10, 9, 2, 5, D); } return g; },
  trashcan(f) { const g = new G(12, 14), B = '#8a929e', D = '#6a727e', L = '#aab2be'; g.r(1, 4, 10, 10, B); [3, 6, 9].forEach((x) => g.vl(x, 5, 12, D)); if (!f) { g.r(0, 2, 12, 2, L); g.r(5, 1, 2, 1, L); g.r(2, 6, 3, 1, '#ffd84a'); g.r(7, 6, 3, 1, '#ffd84a'); g.hl(3, 8, 9, '#3a3a44'); } else { g.r(0, 0, 12, 2, L); g.r(5, -1, 2, 1, L); g.r(1, 2, 10, 2, '#22222a'); g.p(3, 3, '#ffd84a'); g.p(8, 3, '#ffd84a'); } return g; },
  boommic(f) { const g = new G(18, 10); g.r(0, 4 + f, 8, 2, '#555'); g.e(12, 5, 5, 4, '#8a8a8a'); for (let i = 0; i < 9; i++) g.p(8 + ((i * 7) % 9), 2 + ((i * 5) % 6), '#a8a8a8'); g.r(10, 3, 2, 2, '#fff'); g.p(11, 4, '#111'); g.r(14, 3, 2, 2, '#fff'); g.p(14, 4, '#111'); g.hl(10, 12, 2, '#333'); g.hl(13, 15, 2, '#333'); return g; },
  pumpkin(f) { const g = new G(12, 12), O = '#e8822a', D = '#c8621a', Y = '#ffe060'; g.e(5.5, f ? 7.5 : 6.5, 5.5, f ? 4.2 : 5, O); g.vl(3, f ? 4 : 3, 10, D); g.vl(8, f ? 4 : 3, 10, D); g.r(5, f ? 2 : 0, 2, 2, '#4a7a2a'); const y = f ? 6 : 5; g.r(2, y, 2, 2, Y); g.r(7, y, 2, 2, Y); g.hl(3, 8, y + 3, Y); g.p(4, y + 2, Y); g.p(7, y + 2, Y); return g; },
  skeleton(f) { const g = new G(12, 20), B = '#eeeee0', D = '#c8c8b8'; g.r(3, 0, 6, 5, B); g.p(4, 2, '#222'); g.p(7, 2, '#222'); g.r(4, 5, 4, 1, D); g.vl(5, 6, 13, B); g.vl(6, 6, 13, D); for (let y = 7; y <= 11; y += 2) g.hl(3, 8, y, B); g.r(3, 13, 6, 2, B); const l = f ? 1 : 0; g.r(3 - l, 15, 2, 5, B); g.r(7 + l, 15, 2, 5, B); g.vl(2, 7, 11, D); if (f) { g.vl(9, 3, 7, D); g.p(10, 2, B); } else g.vl(9, 7, 11, D); return g; },
  costume(f) { const g = new G(14, 16), C = '#7a3fb0', D = '#5a2a8a', T = '#d0a0ff'; g.e(7, 2.5, 3.5, 2.5, '#2a1040'); g.p(5, 2, '#9ff'); g.p(8, 2, '#9ff'); for (let y = 4; y < 16; y++) { const h = 2 + Math.floor((y - 4) * 0.42); g.hl(7 - h, 6 + h, y, C); g.p(7 - h, y, D); } g.hl(2, 11, 9, T); for (let x = 0; x < 14; x++) if ((x + f) % 3 === 0) { g.p(x, 15, 0); g.p(x, 14, 0); } g.r(0, 6 + f, 3, 2, C); g.r(11, 6 - f, 3, 2, C); return g; },
  robot(f) { const g = new G(14, 17), B = '#7a869a', L = '#9aa6b8', D = '#4a5262'; g.vl(7, 0, 1, '#888'); g.p(7, 0, f ? '#f33' : '#ff8'); g.r(3, 2, 8, 5, L); g.r(4, 4, 6, 2, '#222'); g.p(f ? 8 : 5, 4, '#f33'); g.p(f ? 8 : 5, 5, '#a22'); g.r(2, 7, 10, 6, B); g.r(5, 9, 4, 2, '#4cf'); g.r(0, 8, 2, 4, D); g.r(12, 8, 2, 4, D); g.r(2, 13, 4, 4, D); g.r(8, 13, 4, 4, D); g.hl(2 + f, 5, 16, '#222'); g.hl(8, 11 - f, 16, '#222'); return g; },
  goo(f) { const g = new G(14, 10), C = '#5ad04a', L = '#9af08a'; if (f) g.e(6.5, 6.5, 6.5, 3.2, C); else g.e(6.5, 5, 5, 4.6, C); g.p(4, f ? 5 : 3, L); g.p(5, f ? 5 : 3, L); const y = f ? 6 : 5; g.p(5, y, '#111'); g.p(8, y, '#111'); g.p(5, y - 1, '#fff'); g.p(8, y - 1, '#fff'); return g; },
  laserbot(f) { const g = new G(14, 14); g.e(6, 4, 5, 4, '#c0c8d8'); g.hl(2, 10, 7, '#8a92a8'); g.r(10, 3, 4, 2, '#555'); g.p(9, 4, f ? '#ff5050' : '#a02020'); g.p(5, 3, '#222'); g.l(4, 8, 1, 13, '#6a7288'); g.l(6, 8, 6, 13, '#6a7288'); g.l(8, 8, 11, 13, '#6a7288'); return g; },
  drone(f) { const g = new G(16, 8); g.r(4, 3, 8, 4, '#5a6070'); g.r(8, 4, 2, 2, '#ff4040'); g.p(4, 2, '#888'); g.p(11, 2, '#888'); if (f) { g.hl(1, 6, 1, '#bbb'); g.hl(9, 14, 1, '#bbb'); } else { g.hl(2, 4, 1, '#ddd'); g.hl(11, 13, 1, '#ddd'); } g.hl(5, 10, 7, '#3a3e4a'); return g; },
  tumbleweed(f) { const g = new G(14, 14); for (let k = 0; k < 46; k++) { const a = k * 0.73 + f * 0.6, r = 2 + (k % 5) * 1.15; const a2 = a + 0.9, r2 = 2 + ((k + 2) % 5) * 1.15; g.l(7 + Math.cos(a) * r, 7 + Math.sin(a) * r, 7 + Math.cos(a2) * r2, 7 + Math.sin(a2) * r2, k % 3 ? '#a8743a' : '#7a5022'); } g.p(5, 6, '#fff'); g.p(9, 6, '#fff'); g.p(5, 7, '#111'); g.p(9, 7, '#111'); return g; },
  vulture(f) { const g = new G(18, 12), B = '#3a2a2a', P = '#d88a8a'; g.e(8, 7, 4, 3, B); g.r(11, 3, 2, 3, P); g.r(12, 1, 3, 3, P); g.p(14, 2, '#111'); g.hl(15, 16, 3, '#e8c040'); g.hl(4, 6, 9, B); if (f) { g.l(6, 6, 1, 1, B); g.l(7, 6, 3, 1, B); g.l(9, 6, 7, 1, B); } else { g.l(6, 7, 1, 11, B); g.l(7, 8, 3, 11, B); g.l(9, 8, 8, 11, B); } return g; },
  statue(f) { const g = new G(10, 17), Gd = '#e8c040', L = '#fff0a0', D = '#b8901a'; g.r(1, 14, 8, 3, '#3a3a3a'); g.hl(1, 8, 14, '#5a5a5a'); g.e(5, 2.5, 2, 2, Gd); g.p(4, 2, '#5a3a10'); g.p(6, 2, '#5a3a10'); g.r(4, 5, 3, 6, Gd); g.vl(4, 5, 10, L); g.vl(6, 5, 10, D); if (f) { g.l(4, 6, 1, 3, Gd); g.l(6, 6, 9, 3, Gd); g.r(3, 11, 2, 3, Gd); g.r(6, 11, 2, 2, Gd); } else { g.l(4, 6, 2, 9, Gd); g.l(6, 6, 8, 9, Gd); g.r(3, 11, 2, 3, Gd); g.r(6, 11, 2, 3, Gd); } return g; },
  papdrone(f) { const g = new G(16, 11); g.r(3, 4, 10, 6, '#2a2a32'); g.e(8, 7, 2.5, 2.5, '#111'); g.p(8, 7, '#ff4040'); g.p(7, 6, '#9cf'); g.r(10, 1, 4, 3, f ? '#ffffff' : '#aac0e0'); if (f) { g.hl(0, 5, 2, '#bbb'); } else { g.hl(1, 3, 2, '#ddd'); } g.p(3, 3, '#888'); return g; },
  // bosses
  spotlight(f) { const g = new G(26, 22), B = '#3a3a46', L = '#5a5a66'; g.r(8, 0, 8, 2, '#777'); g.r(8, 0, 2, 6, '#777'); g.r(14, 0, 2, 6, '#777'); g.r(2, 5, 16, 14, B); g.hl(2, 17, 5, L); g.r(17, 3, 4, 18, L); g.e(21, 12, 3, 7.5, f ? '#fff8c0' : '#ffe060'); g.e(21.5, 12, 1.5, 4, '#ffffff'); for (let x = 4; x < 16; x += 3) g.vl(x, 15, 18, '#26262e'); g.r(6, 8, 3, 3, '#fff'); g.r(11, 8, 3, 3, '#fff'); g.p(8, 10, '#111'); g.p(13, 10, '#111'); g.l(5, 6, 9, 8, '#111'); g.l(14, 6, 10, 8, '#111'); g.hl(7, 12, 13, '#111'); return g; },
  rack(f) { const g = new G(32, 30), M = '#a8a8b8', D = '#6a6a7a'; g.r(2, 2, 28, 2, M); g.r(2, 2, 2, 25, D); g.r(28, 2, 2, 25, D); g.r(0, 26, 6, 2, D); g.r(26, 26, 6, 2, D); g.r(1, 28, 2, 2, '#222'); g.r(29, 28, 2, 2, '#222'); const cols = ['#c83a3a', '#3a5ac8', '#3aa85a', '#d8a830']; cols.forEach((c, i) => { const x = 6 + i * 6 + (i % 2 ? f : -f); g.p(x + 2, 4, M); g.r(x, 5, 5, 3, c); g.r(x - 1, 8, 7, 10, c); g.vl(x - 1, 8, 17, darken(c)); for (let k = 0; k < 7; k += 2) g.p(x - 1 + k, 18, c); }); g.r(13, 9, 2, 2, '#9ff'); g.r(18, 9, 2, 2, '#9ff'); g.hl(13, 20, 14, '#1a1a2a'); return g; },
  wraith(f) { const g = new G(44, 46), C = '#6a2aa0', D = '#4a1a78', T = '#c890ff'; for (let y = 14; y < 46; y++) { const h = 5 + Math.floor((y - 14) * 0.48); g.hl(22 - h, 21 + h, y, C); g.hl(22 - h, 23 - h, y, D); } g.hl(8, 35, 30, T); g.hl(6, 37, 38, T); for (let x = 0; x < 44; x++) if ((x + f * 2) % 5 < 2) { g.p(x, 45, 0); g.p(x, 44, 0); } g.r(2, 17 + f, 12, 5, C); g.r(30, 17 - f, 12, 5, C); for (let i = 0; i < 3; i++) { g.p(1, 18 + f + i * 2, '#e0d8ff'); g.p(42, 18 - f + i * 2, '#e0d8ff'); } g.e(22, 9, 8, 8.5, '#3a1a5a'); g.e(22, 10, 5, 5.5, '#120820'); g.r(18, 8, 2, 2, '#7ff'); g.r(24, 8, 2, 2, '#7ff'); g.hl(19, 25, 13, '#7ff'); return g; },
  mech(f) { const g = new G(42, 40); g.r(4, 32, 34, 8, '#3a3a44'); for (let x = 8; x < 38; x += 8) g.e(x, 36, 2.5, 2.5, '#6a6a74'); g.r(8, 14, 26, 18, '#8a96a8'); g.r(10, 16, 22, 14, '#6a7688'); g.e(21, 23, 4, 4, f ? '#8ff' : '#4ef'); g.e(21, 9, 9, 6.5, '#a8b4c8'); g.r(14, 8, 14, 3, '#222'); g.r(f ? 23 : 16, 8, 3, 3, '#f33'); g.r(0, 18, 8, 7, '#5a6272'); g.r(34, 18, 8, 7, '#5a6272'); g.r(0, 25, 3, 3, '#333'); g.r(39, 25, 3, 3, '#333'); g.vl(30, 0, 3, '#888'); if (f) { g.p(31, 0, '#ff8'); g.p(29, 1, '#ff8'); g.p(12, 15, '#ff8'); } return g; },
  tumbleking(f) { const g = new G(32, 34); for (let k = 0; k < 120; k++) { const a = k * 0.61 + f * 0.5, r = 3 + (k % 7) * 1.85; const a2 = a + 0.7, r2 = 3 + ((k + 3) % 7) * 1.85; g.l(16 + Math.cos(a) * r, 19 + Math.sin(a) * r, 16 + Math.cos(a2) * r2, 19 + Math.sin(a2) * r2, k % 3 ? '#a8743a' : '#7a5022'); } g.s(9, 0, ['#.#.#.#.#.#.#', '#############', '#############'], { '#': '#e8c040' }); g.p(12, 1, '#e83a3a'); g.p(16, 1, '#3a8ae8'); g.p(20, 1, '#3ae86a'); g.r(10, 15, 4, 4, '#fff'); g.r(18, 15, 4, 4, '#fff'); g.r(12, 16, 2, 2, '#111'); g.r(18, 16, 2, 2, '#111'); g.l(9, 13, 14, 15, '#2a1a0a'); g.l(23, 13, 18, 15, '#2a1a0a'); g.hl(12, 20, 23, '#2a1a0a'); return g; },
  papprime(f) { const g = new G(36, 28); g.r(2, 8, 32, 18, '#2a2a32'); g.hl(2, 33, 8, '#4a4a56'); g.r(8, 3, 12, 6, '#3a3a44'); g.r(23, 1, 9, 7, f ? '#ffffff' : '#c8d8f0'); g.hl(23, 31, 7, '#888'); g.e(17, 17, 8.5, 8, '#111'); g.e(17, 17, 6, 6, '#3a4a6a'); g.e(17, 17, 3.5, 3.5, '#111'); g.r(16, 16, 3, 3, '#ff3030'); g.p(14, 14, '#9cf'); g.r(28, 12, 4, 10, '#3a3a44'); g.l(9, 10, 13, 12, '#ff3030'); g.l(25, 10, 21, 12, '#ff3030'); return g; },
  greenlight(f) { const g = new G(46, 44); g.r(8, 32, 6, 12, '#555'); g.r(32, 32, 6, 12, '#555'); g.r(4, 40, 12, 4, '#333'); g.r(30, 40, 12, 4, '#333'); g.r(4, 13, 38, 20, '#2a6a3a'); g.hl(4, 41, 13, '#4aaa5a'); g.hl(4, 41, 32, '#1a4a2a'); g.r(8, 17, 30, 3, '#1a4a2a'); g.r(14, 0, 18, 14, '#222'); g.e(19, 7, 3.5, 3.5, f ? '#ff3030' : '#5a1a1a'); g.e(27, 7, 3.5, 3.5, f ? '#1a5a1a' : '#3aff5a'); g.r(0, 18, 6, 10, '#888'); g.r(40, 18, 6, 10, '#888'); g.r(0, 28, 3, 3, '#666'); g.r(43, 28, 3, 3, '#666'); g.r(17, 23, 12, 6, '#163a20'); g.s(18, 24, ['#..#.#', '#.##.#', '#..#..'], { '#': '#3aff5a' }); return g; },
  projector(f) { const g = new G(42, 34); g.r(4, 14, 30, 16, '#5a5060'); g.hl(4, 33, 14, '#7a7080'); g.r(34, 17, 6, 10, '#222'); g.r(40, 18, 2, 8, '#fff8c0'); [12, 27].forEach((cx) => { g.e(cx, 8, 7, 7, '#3a3a44'); g.e(cx, 8, 2, 2, '#888'); for (let a = 0; a < 3; a++) { const an = a * 2.094 + f * 0.6; g.l(cx, 8, cx + Math.cos(an) * 6, 8 + Math.sin(an) * 6, '#888'); } }); g.r(9, 18, 5, 4, '#fff'); g.r(20, 18, 5, 4, '#fff'); g.r(11, 19, 2, 3, '#111'); g.r(20, 19, 2, 3, '#111'); g.l(8, 16, 14, 18, '#111'); g.l(26, 16, 20, 18, '#111'); g.hl(11, 23, 26, '#111'); g.r(6, 30, 4, 4, '#333'); g.r(28, 30, 4, 4, '#333'); return g; },
  // projectiles + items
  reel(f) { const g = new G(9, 9); g.e(4, 4, 4, 4, '#9a9aa8'); g.e(4, 4, 1, 1, '#333'); const o = f ? [[2, 2], [6, 2], [2, 6], [6, 6]] : [[4, 1], [7, 4], [4, 7], [1, 4]]; o.forEach(([x, y]) => g.p(x, y, '#333')); return g; },
  tomato() { const g = new G(6, 6); g.e(2.5, 3, 2.5, 2.4, '#e03a2a'); g.p(2, 2, '#ff8a7a'); g.p(2, 0, '#3a9a3a'); g.p(3, 0, '#3a9a3a'); return g; },
  star() { const g = new G(9, 9); g.s(0, 0, ['....#....', '...###...', '#########', '.#######.', '..#####..', '.###.###.', '.##...##.', '#.......#', '.........'], { '#': '#ffd84a' }); g.p(4, 3, '#fff8c0'); return g; },
  lightbolt() { const g = new G(6, 6); g.e(2.5, 2.5, 2.5, 2.5, '#ffe060'); g.e(2.5, 2.5, 1, 1, '#ffffff'); return g; },
  sandbag() { const g = new G(7, 6); g.r(0, 1, 7, 5, '#c8a56a'); g.r(2, 0, 3, 1, '#8a6a3a'); g.hl(1, 5, 3, '#a8854a'); return g; },
  bone(f) { const g = f ? new G(4, 8) : new G(8, 4); if (f) { g.r(1, 1, 2, 6, '#eee'); g.p(0, 0, '#eee'); g.p(3, 0, '#eee'); g.p(0, 7, '#eee'); g.p(3, 7, '#eee'); } else { g.r(1, 1, 6, 2, '#eee'); g.p(0, 0, '#eee'); g.p(0, 3, '#eee'); g.p(7, 0, '#eee'); g.p(7, 3, '#eee'); } return g; },
  laser() { const g = new G(9, 3); g.hl(0, 8, 1, '#ff3030'); g.hl(1, 7, 0, '#ff8080'); g.hl(1, 7, 2, '#c01010'); g.p(8, 1, '#fff'); return g; },
  bolt() { const g = new G(8, 3); g.hl(0, 7, 1, '#40e0ff'); g.hl(1, 6, 0, '#a0f8ff'); g.hl(1, 6, 2, '#20a0c0'); return g; },
  dynamite(f) { const g = new G(4, 9); g.r(0, 2, 4, 7, '#d03030'); g.hl(0, 3, 4, '#a02020'); g.p(2, 1, '#6a4a2a'); g.p(f ? 3 : 2, 0, '#ffd84a'); return g; },
  flash() { const g = new G(7, 7); g.e(3, 3, 3, 3, '#c8f0ff'); g.e(3, 3, 1.5, 1.5, '#ffffff'); return g; },
  scissors(f) { const g = new G(9, 7); if (f) { g.l(0, 0, 8, 6, '#c8c8d0'); g.l(0, 6, 8, 0, '#c8c8d0'); } else { g.l(0, 1, 8, 3, '#c8c8d0'); g.l(0, 5, 8, 3, '#c8c8d0'); } g.r(0, 0, 2, 2, '#d03030'); g.r(0, 5, 2, 2, '#d03030'); return g; },
  ghostorb(f) { const g = new G(7, 7); g.e(3, 3, 3, 3, f ? '#b080ff' : '#80f0ff'); g.e(3, 3, 1.2, 1.2, '#ffffff'); return g; },
  note(f) { const g = new G(7, 8); g.r(0, 0, 7, 8, '#f8f8f0'); g.hl(1, 5, 2, '#8a8aa0'); g.hl(1, 5, 4, '#8a8aa0'); g.hl(1, 3 + f, 6, '#8a8aa0'); return g; },
  shock(f) { const g = new G(12, 9); g.e(6, 8, 6, 6 + f, '#ffd080'); g.e(6, 8.5, 3.5, 3, '#fff4d0'); return g; },
  miniweed(f) { const g = new G(9, 9); for (let k = 0; k < 20; k++) { const a = k * 0.8 + f, r = 1 + (k % 3) * 1.3; g.l(4 + Math.cos(a) * r, 4 + Math.sin(a) * r, 4 + Math.cos(a + 1) * (r + 1), 4 + Math.sin(a + 1) * (r + 1), '#a8743a'); } return g; },
  grain() { const g = new G(3, 5); g.s(0, 0, ['.w.', 'www', 'www', 'wcw', '.c.'], { w: '#fbfbf0', c: '#d8d4b8' }); return g; },
  bowl() { const g = new G(10, 8); g.s(0, 0, ['..wwwwww..', '.wwwwwwww.', 'wwwwcwwwww', 'bbbbbbbbbb', 'bLbLbLbLbb', '.bbbbbbbb.', '..bbbbbb..', '...dddd...'], { w: '#fbfbf0', c: '#d8d4b8', b: '#3a6ad8', L: '#8ab0ff', d: '#2a4aa0' }); return g; },
  heart() { const g = new G(7, 6); g.s(0, 0, ['.##.##.', '#h#####', '#######', '.#####.', '..###..', '...#...'], { '#': '#e83a4a', h: '#ff9aa0' }); return g; },
  cooker(f) { const g = new G(12, 13); if (f) { g.p(5, 0, '#ffffff'); g.p(7, 1, '#ffffff'); } g.r(2, 3, 8, 2, '#f0c840'); g.r(5, 2, 2, 1, '#b88a10'); g.r(1, 5, 10, 7, '#e8b830'); g.vl(2, 5, 11, '#fff0a0'); g.vl(10, 5, 11, '#b88a10'); g.hl(1, 10, 12, '#b88a10'); g.r(0, 6, 1, 2, '#b88a10'); g.r(11, 6, 1, 2, '#b88a10'); g.r(4, 8, 4, 2, '#2a6a2a'); g.p(5, 8, '#7aff7a'); return g; },
};

// ---------- tilesets ----------
export const WPAL = [
  { top: '#c8894a', topL: '#e8b070', fill: '#6a4024', fillD: '#54321c', plat: '#d8a060', platD: '#8a5a30', brk: '#a06a3a', style: 'wood' },
  { top: '#6a6a74', topL: '#e8c040', fill: '#44444e', fillD: '#38383f', plat: '#9aa0ac', platD: '#5a606c', brk: '#a05040', style: 'street' },
  { top: '#4a6a3a', topL: '#6a8a4a', fill: '#3a2a3a', fillD: '#2a1e2a', plat: '#6a5a4a', platD: '#4a3a2a', brk: '#6a6a7a', style: 'grave' },
  { top: '#6a7a94', topL: '#4ae0f0', fill: '#2a3346', fillD: '#222a3a', plat: '#3ad0e0', platD: '#1a7a8a', brk: '#5a6a84', style: 'metal' },
  { top: '#e0a860', topL: '#f0c880', fill: '#b0743a', fillD: '#965e2e', plat: '#a0703a', platD: '#6a4a24', brk: '#b88848', style: 'sand' },
  { top: '#c8283a', topL: '#e8c040', fill: '#3a3048', fillD: '#2e263a', plat: '#e0b840', platD: '#9a7a20', brk: '#8a2a3a', style: 'carpet' },
];
function buildTileset(i) {
  const p = WPAL[i], rng = makeRng(900 + i);
  const [c, x] = makeCanvas(16 * 5, 16);
  const px = (X, Y, w, h, col) => { x.fillStyle = col; x.fillRect(X, Y, w, h); };
  // 0 fill
  px(0, 0, 16, 16, p.fill);
  for (let k = 0; k < 10; k++) px(rng.i(0, 15), rng.i(0, 15), rng.i(1, 2), 1, p.fillD);
  if (p.style === 'street' || p.style === 'metal') { px(0, 0, 16, 1, p.fillD); px(0, 8, 16, 1, p.fillD); px(8, 0, 1, 8, p.fillD); px(3, 8, 1, 8, p.fillD); }
  if (p.style === 'wood') { px(0, 5, 16, 1, p.fillD); px(0, 11, 16, 1, p.fillD); }
  // 1 top (fill + surface)
  x.drawImage(c, 0, 0, 16, 16, 16, 0, 16, 16);
  px(16, 0, 16, 5, p.top);
  px(16, 0, 16, 1, p.topL);
  if (p.style === 'wood') { px(16, 4, 16, 1, p.fillD); px(21, 1, 1, 3, p.fillD); px(29, 1, 1, 3, p.fillD); }
  if (p.style === 'street') { px(16, 1, 16, 1, '#8a8a94'); px(20, 2, 6, 1, p.topL); }
  if (p.style === 'grave') { for (let k = 0; k < 6; k++) px(16 + rng.i(0, 15), 1, 1, rng.i(1, 3), p.topL); px(16, 4, 16, 1, '#2a3a22'); }
  if (p.style === 'metal') { px(16, 2, 16, 1, '#4a5a74'); px(18, 3, 4, 1, p.topL); px(26, 3, 4, 1, p.topL); }
  if (p.style === 'sand') { for (let k = 0; k < 5; k++) px(16 + rng.i(0, 15), rng.i(1, 4), 1, 1, '#c88a48'); }
  if (p.style === 'carpet') { px(16, 4, 16, 1, p.topL); px(16, 1, 16, 1, '#e04050'); }
  // 2 one-way platform
  px(32, 0, 16, 5, p.plat); px(32, 0, 16, 1, '#ffffff22'); px(32, 4, 16, 1, p.platD);
  px(34, 5, 2, 3, p.platD); px(44, 5, 2, 3, p.platD);
  if (p.style === 'metal') { px(32, 1, 16, 1, '#bff8ff'); }
  // 3 breakable (looks almost like fill - with a crack hint)
  x.drawImage(c, 0, 0, 16, 16, 48, 0, 16, 16);
  px(48, 0, 16, 16, p.brk); px(48, 0, 16, 1, p.topL); px(49, 1, 14, 14, darken(p.brk, 0.85));
  px(52, 4, 1, 3, '#00000066'); px(53, 7, 1, 3, '#00000066'); px(54, 10, 1, 2, '#00000066');
  // 4 dark underside (solid with no top, deep)
  px(64, 0, 16, 16, p.fillD);
  return c;
}

// ---------- parallax backgrounds ----------
function gradient(x, w, h, stops) {
  const gr = x.createLinearGradient(0, 0, 0, h);
  stops.forEach(([o, col]) => gr.addColorStop(o, col));
  x.fillStyle = gr; x.fillRect(0, 0, w, h);
}
function buildBG(i) {
  const rng = makeRng(500 + i * 17);
  const [sky, sx] = makeCanvas(W, H);
  const layers = [];
  const layer = (k, draw, w = 640) => { const [c, x] = makeCanvas(w, H); draw(x, w); layers.push({ c, k }); };
  const R = (x, X, Y, w, h, col) => { x.fillStyle = col; x.fillRect(Math.round(X), Math.round(Y), Math.round(w), Math.round(h)); };
  if (i === 0) { // school drama hall
    gradient(sx, W, H, [[0, '#1a0a12'], [1, '#3a1420']]);
    layer(0.15, (x, w) => { for (let X = 0; X < w; X += 10) { R(x, X, 0, 10, 150, X % 20 ? '#7a1424' : '#8e1c2c'); R(x, X + 7, 0, 2, 150, '#5a0e1a'); } R(x, 0, 0, w, 14, '#c89a3a'); R(x, 0, 14, w, 3, '#8a6a20'); for (let X = 0; X < w; X += 40) R(x, X + 18, 17, 4, 6, '#c89a3a'); });
    layer(0.4, (x, w) => { R(x, 0, 24, w, 3, '#2a2a30'); for (let X = 20; X < w; X += 80) { R(x, X, 27, 2, 8, '#2a2a30'); R(x, X - 5, 34, 12, 8, '#3a3a44'); x.globalAlpha = 0.12; x.fillStyle = '#fff6c0'; x.beginPath(); x.moveTo(X - 4, 42); x.lineTo(X + 6, 42); x.lineTo(X + 30, 160); x.lineTo(X - 28, 160); x.fill(); x.globalAlpha = 1; R(x, X - 3, 42, 8, 2, '#ffe080'); } });
    layer(0.7, (x, w) => { for (let X = 0; X < w; X += 14) { R(x, X, 128, 12, 12, '#2a0e16'); R(x, X + 1, 124, 10, 6, '#3a141e'); } });
  } else if (i === 1) { // backlot street (dusk)
    gradient(sx, W, H, [[0, '#2a2050'], [0.55, '#c8587a'], [1, '#f0a060']]);
    sx.fillStyle = '#ffe0a0'; sx.beginPath(); sx.arc(250, 110, 18, 0, 7); sx.fill();
    layer(0.12, (x, w) => { let X = 0; while (X < w) { const bw = rng.i(18, 40), bh = rng.i(40, 100); R(x, X, 150 - bh, bw, bh, '#4a3060'); for (let k = 0; k < 6; k++) R(x, X + rng.i(2, bw - 4), 150 - bh + rng.i(4, bh - 6), 2, 2, '#f0c070'); X += bw + rng.i(0, 6); } });
    layer(0.4, (x, w) => { let X = 0; while (X < w) { const bw = rng.i(50, 80), bh = rng.i(60, 95), col = rng.pick(['#8a5a4a', '#6a7a8a', '#9a8a5a', '#7a4a5a']); R(x, X, 150 - bh, bw, bh, col); R(x, X, 150 - bh, bw, 4, darken(col, 0.7)); for (let wy = 150 - bh + 10; wy < 135; wy += 16) for (let wx = X + 6; wx < X + bw - 10; wx += 14) R(x, wx, wy, 8, 9, rng.chance(0.4) ? '#f0d080' : '#2a2a3a'); R(x, X + bw, 150 - bh + 8, 3, bh, '#5a4a3a'); X += bw + rng.i(16, 30); } });
    layer(0.75, (x, w) => { for (let X = 30; X < w; X += 110) { R(x, X, 80, 3, 64, '#2a2a30'); R(x, X - 4, 78, 11, 4, '#2a2a30'); R(x, X - 3, 82, 9, 2, '#ffe080'); } });
  } else if (i === 2) { // haunted horror set
    gradient(sx, W, H, [[0, '#0a0614'], [1, '#3a1a4a']]);
    for (let k = 0; k < 40; k++) { sx.fillStyle = '#c8b8ff'; sx.fillRect(rng.i(0, W), rng.i(0, 100), 1, 1); }
    sx.fillStyle = '#e8e0c0'; sx.beginPath(); sx.arc(70, 50, 24, 0, 7); sx.fill(); sx.fillStyle = '#d0c8a8'; sx.fillRect(62, 44, 5, 4); sx.fillRect(78, 56, 4, 3);
    layer(0.15, (x, w) => { x.fillStyle = '#1e1030'; x.beginPath(); x.moveTo(0, 150); for (let X = 0; X <= w; X += 20) x.lineTo(X, 110 + Math.sin(X * 0.02) * 14 + rng.i(-4, 4)); x.lineTo(w, 180); x.lineTo(0, 180); x.fill(); R(x, 380, 70, 50, 50, '#140a20'); R(x, 395, 56, 20, 16, '#140a20'); x.fillStyle = '#140a20'; x.beginPath(); x.moveTo(375, 72); x.lineTo(405, 40); x.lineTo(435, 72); x.fill(); R(x, 390, 85, 6, 8, '#f0c040'); R(x, 410, 85, 6, 8, '#f0c040'); });
    layer(0.45, (x, w) => { for (let X = 20; X < w; X += rng.i(70, 120)) { R(x, X, 70, 5, 80, '#0e0818'); x.strokeStyle = '#0e0818'; x.lineWidth = 2; for (let b = 0; b < 4; b++) { x.beginPath(); x.moveTo(X + 2, 80 + b * 12); x.lineTo(X + 2 + (b % 2 ? 16 : -16), 70 + b * 12); x.stroke(); } } });
    layer(0.75, (x, w) => { for (let X = 0; X < w; X += 6) R(x, X, 126, 2, 18, '#1a1024'); R(x, 0, 128, w, 2, '#1a1024'); for (let X = 30; X < w; X += 90) { R(x, X, 120, 10, 20, '#4a4a5a'); R(x, X + 1, 118, 8, 2, '#4a4a5a'); R(x, X + 4, 124, 2, 6, '#2a2a3a'); R(x, X + 2, 126, 6, 2, '#2a2a3a'); } });
  } else if (i === 3) { // sci-fi spaceship
    gradient(sx, W, H, [[0, '#02020a'], [1, '#0a1030']]);
    for (let k = 0; k < 90; k++) { sx.fillStyle = rng.pick(['#fff', '#8cf', '#ffc']); sx.fillRect(rng.i(0, W), rng.i(0, H), 1, 1); }
    layer(0.08, (x) => { x.fillStyle = '#c8603a'; x.beginPath(); x.arc(220, 70, 34, 0, 7); x.fill(); x.fillStyle = '#e88a5a'; x.fillRect(196, 56, 30, 4); x.fillRect(200, 76, 40, 3); x.strokeStyle = '#d8c0a0'; x.lineWidth = 2; x.beginPath(); x.ellipse(220, 70, 54, 9, -0.2, 0, 7); x.stroke(); }, 320);
    layer(0.4, (x, w) => { R(x, 0, 0, w, 30, '#2a3446'); R(x, 0, 30, w, 2, '#4ae0f0'); for (let X = 0; X < w; X += 80) { R(x, X, 0, 12, 150, '#2a3446'); R(x, X + 12, 32, 2, 118, '#3a4a60'); R(x, X + 3, 60, 6, 2, '#ff6060'); } R(x, 0, 130, w, 20, '#2a3446'); });
    layer(0.75, (x, w) => { for (let X = 10; X < w; X += 100) { R(x, X, 112, 30, 30, '#3a4660'); R(x, X + 3, 115, 24, 12, '#0a2030'); for (let k = 0; k < 5; k++) R(x, X + 5 + k * 4, 120 - rng.i(0, 4), 2, 2, rng.pick(['#4ef', '#f44', '#ff4', '#4f4'])); } R(x, 0, 140, w, 4, '#1a2232'); });
  } else if (i === 4) { // western stunt set
    gradient(sx, W, H, [[0, '#f0904a'], [0.6, '#f8c878'], [1, '#ffe8a8']]);
    sx.fillStyle = '#fff4c0'; sx.beginPath(); sx.arc(90, 60, 20, 0, 7); sx.fill();
    layer(0.15, (x, w) => { for (let X = 0; X < w; X += rng.i(90, 140)) { const mw = rng.i(50, 90), mh = rng.i(30, 60); R(x, X, 150 - mh, mw, mh, '#c86a3a'); R(x, X - 6, 150 - mh + 4, mw + 12, 6, '#b05a2e'); R(x, X, 150 - mh, mw, 3, '#e08a50'); } });
    layer(0.45, (x, w) => { let X = 10; while (X < w) { const bw = rng.i(44, 64), bh = rng.i(36, 54), col = rng.pick(['#8a5a34', '#9a6a3a', '#7a4a2a']); R(x, X, 150 - bh, bw, bh, col); R(x, X + 4, 150 - bh - 8, bw - 8, 10, col); R(x, X, 150 - bh + 16, bw, 3, '#5a3a1a'); R(x, X + 8, 150 - bh + 24, 10, 10, '#2a1a10'); R(x, X + bw - 18, 150 - bh + 24, 10, 10, '#2a1a10'); X += bw + rng.i(30, 60); } });
    layer(0.75, (x, w) => { for (let X = 40; X < w; X += rng.i(80, 130)) { R(x, X, 110, 6, 34, '#3a7a3a'); R(x, X - 6, 118, 6, 4, '#3a7a3a'); R(x, X - 6, 110, 3, 10, '#3a7a3a'); R(x, X + 6, 122, 6, 4, '#3a7a3a'); R(x, X + 9, 114, 3, 10, '#3a7a3a'); } for (let X = 0; X < w; X += 24) R(x, X, 132, 3, 12, '#6a4a2a'); R(x, 0, 134, w, 2, '#6a4a2a'); });
  } else { // premiere red carpet + studio tower
    gradient(sx, W, H, [[0, '#06081a'], [1, '#1a2050']]);
    for (let k = 0; k < 50; k++) { sx.fillStyle = '#fff'; sx.fillRect(rng.i(0, W), rng.i(0, 80), 1, 1); }
    sx.globalAlpha = 0.14; sx.fillStyle = '#e8f0ff';
    [[60, -0.35], [260, 0.35], [160, 0.1]].forEach(([bx, a]) => { sx.beginPath(); sx.moveTo(bx - 4, 180); sx.lineTo(bx + 4, 180); sx.lineTo(bx + 4 + Math.sin(a) * 300 + 20, -20); sx.lineTo(bx - 4 + Math.sin(a) * 300 - 20, -20); sx.fill(); });
    sx.globalAlpha = 1;
    layer(0.1, (x, w) => { let X = 0; while (X < w) { const bw = rng.i(16, 34), bh = rng.i(50, 120); R(x, X, 150 - bh, bw, bh, '#141834'); for (let k = 0; k < 10; k++) R(x, X + rng.i(2, bw - 3), 150 - bh + rng.i(3, bh - 4), 1, 2, '#f8e8a0'); X += bw + 2; } });
    layer(0.35, (x) => { R(x, 120, 20, 70, 130, '#2a2850'); R(x, 130, 6, 50, 16, '#2a2850'); R(x, 150, -10, 10, 18, '#2a2850'); R(x, 124, 26, 62, 2, '#e8c040'); for (let wy = 34; wy < 140; wy += 10) for (let wx = 128; wx < 182; wx += 9) R(x, wx, wy, 5, 5, (wx + wy) % 3 ? '#f8e8a0' : '#3a3870'); R(x, 126, 8, 58, 9, '#e8c040'); drawText(x, 'RELIVERSE', 155, 10, { col: '#3a1018', align: 'center', shadow: false }); }, 320);
    layer(0.75, (x, w) => { for (let X = 0; X < w; X += 40) { R(x, X + 6, 120, 3, 22, '#e8c040'); R(x, X + 5, 118, 5, 3, '#ffe880'); x.strokeStyle = '#a01828'; x.lineWidth = 2; x.beginPath(); x.moveTo(X + 8, 124); x.quadraticCurveTo(X + 28, 134, X + 48, 124); x.stroke(); } for (let X = 0; X < w; X += 9) { R(x, X, 106 + (X % 3) * 2, 7, 20, '#0e1028'); R(x, X + 2, 101 + (X % 3) * 2, 4, 5, '#0e1028'); } });
  }
  return { sky, layers };
}
function buildTheatre() {
  const [c, x] = makeCanvas(W, H);
  gradient(x, W, H, [[0, '#1a0810'], [1, '#2a0c18']]);
  for (let X = 0; X < W; X += 10) { x.fillStyle = X % 20 ? '#6a1020' : '#7a1828'; x.fillRect(X, 0, 10, 96); }
  x.fillStyle = '#c89a3a'; x.fillRect(0, 0, W, 4);
  x.fillStyle = '#0a0a0a'; x.fillRect(56, 4, 208, 74);
  x.fillStyle = '#d8d4c8'; x.fillRect(60, 8, 200, 66);
  return c;
}

// ---------- registry ----------
export const SPR = {};
export let TILESETS = [], BGS = [], THEATRE = null;

const two = (fn) => [frame(fn(0)), frame(fn(1))];
export function initSprites() {
  for (const k in CHARS) SPR[k] = humanoidSet(CHARS[k]);
  SPR.joshGold = humanoidSet({ ...CHARS.josh, clapGold: true });
  // REC light on variant for checkpoints
  {
    const o = { ...CHARS.ayden };
    const g = humanoid(o, { ...POSES.idle0, rec: true });
    SPR.aydenRecOn = frame(g, 11, g.h);
  }
  for (const k in ENEMY_H) SPR[k] = humanoidSet(ENEMY_H[k]);
  SPR.criticBoss = humanoidSet(BOSS_H.criticBoss, 2);
  SPR.brutus = humanoidSet(BOSS_H.brutus, 2);
  SPR.dusty = humanoidSet(BOSS_H.dusty, 2);
  SPR.finalcutBoss = humanoidSet(CHARS.finalcut, 2);
  SPR.finnAlien = humanoidSet(BOSS_H.finnAlien);
  for (const k of ['chair', 'trashcan', 'boommic', 'pumpkin', 'skeleton', 'costume', 'robot', 'goo', 'laserbot', 'drone',
    'tumbleweed', 'vulture', 'statue', 'papdrone', 'spotlight', 'rack', 'wraith', 'mech', 'tumbleking', 'papprime',
    'greenlight', 'projector', 'reel', 'bone', 'dynamite', 'scissors', 'ghostorb', 'note', 'shock', 'miniweed', 'cooker'])
    SPR[k] = two(P2[k]);
  for (const k of ['tomato', 'star', 'lightbolt', 'sandbag', 'laser', 'bolt', 'flash', 'grain', 'bowl', 'heart'])
    SPR[k] = [frame(P2[k](0))];
  // centred anchors for projectiles/pickups
  const centre = (k) => SPR[k].forEach((fr) => { fr.ax = fr.w / 2; fr.ay = fr.h / 2; });
  ['reel', 'bone', 'dynamite', 'scissors', 'ghostorb', 'note', 'miniweed', 'tomato', 'star', 'lightbolt', 'sandbag', 'laser',
    'bolt', 'flash', 'grain', 'bowl', 'heart', 'cooker', 'shock'].forEach(centre);
  TILESETS = WPAL.map((_, i) => buildTileset(i));
  BGS = WPAL.map((_, i) => buildBG(i));
  THEATRE = buildTheatre();
}

// Portrait: head-and-shoulders crop of a sprite, scaled 2x. Cached.
const PORTRAITS = {};
export function portrait(key) {
  if (PORTRAITS[key]) return PORTRAITS[key];
  const set = SPR[key];
  let fr = set && (set.idle0 || set[0]);
  if (!fr) return null;
  const [c, x] = makeCanvas(32, 28);
  x.imageSmoothingEnabled = false;
  if (set.idle0) {
    const big = fr.h > 40; // 2x humanoid
    const s = big ? 1 : 2;
    const sx = fr.ax - 8 * (big ? 2 : 1), sy = big ? 2 : 1;
    x.drawImage(fr.c, sx, sy, 16 * (big ? 2 : 1), 14 * (big ? 2 : 1), 0, 0, 32, 28);
    void s;
  } else {
    const k = Math.min(1, 30 / fr.w, 26 / fr.h);
    x.drawImage(fr.c, 0, 0, fr.w, fr.h, Math.round(16 - (fr.w * k) / 2), Math.round(14 - (fr.h * k) / 2), Math.round(fr.w * k), Math.round(fr.h * k));
  }
  PORTRAITS[key] = c;
  return c;
}

// Draw world parallax background at camera x
export function drawBG(c, world, camX) {
  const bg = BGS[world];
  c.drawImage(bg.sky, 0, 0);
  for (const L of bg.layers) {
    const w = L.c.width;
    let ox = -Math.round(camX * L.k) % w;
    if (ox > 0) ox -= w;
    for (let x = ox; x < W; x += w) c.drawImage(L.c, x, 0);
  }
}
