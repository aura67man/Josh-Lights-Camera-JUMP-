// ui.js - panels, menus, typewriter text boxes with portraits, speech bubbles, HUD, boss bar, toasts
import { W, H } from './engine.js';
import { drawText, textWidth, wrap, LINE_H } from './font.js';
import { SPR, drawSprite, portrait, CHARS } from './sprites.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { SPEAKERS, fmt } from './story.js';

export function panel(c, x, y, w, h, bg = '#141428', border = '#e8c040') {
  c.fillStyle = '#000'; c.fillRect(x - 1, y - 1, w + 2, h + 2);
  c.fillStyle = border; c.fillRect(x, y, w, h);
  c.fillStyle = bg; c.fillRect(x + 1, y + 1, w - 2, h - 2);
}
export function dim(c, a = 0.6) { c.globalAlpha = a; c.fillStyle = '#000'; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }

// Menu list widget
export class Menu {
  constructor(items, opts = {}) { this.items = items; this.i = 0; this.opts = opts; this.t = 0; this.skipDisabled(1); }
  skipDisabled(d) { for (let k = 0; k < this.items.length && this.items[this.i].disabled; k++) this.i = (this.i + d + this.items.length) % this.items.length; }
  update(dt) {
    this.t += dt;
    const n = this.items.length;
    if (Input.menuUp()) { this.i = (this.i - 1 + n) % n; this.skipDisabled(-1); Audio.sfx('menuMove'); }
    if (Input.menuDown()) { this.i = (this.i + 1) % n; this.skipDisabled(1); Audio.sfx('menuMove'); }
    const it = this.items[this.i];
    if (it.adjust) {
      if (Input.menuLeft()) { it.adjust(-1); Audio.sfx('menuMove'); }
      if (Input.menuRight()) { it.adjust(1); Audio.sfx('menuMove'); }
    }
    if (Input.confirm() && it.action && !it.disabled) { Audio.sfx('menuSelect'); it.action(); return true; }
    if (Input.back() && this.opts.onBack) { Audio.sfx('menuBack'); this.opts.onBack(); return true; }
    return false;
  }
  render(c, x, y, opts = {}) {
    const gap = opts.gap || 11;
    this.items.forEach((it, k) => {
      const sel = k === this.i;
      const label = typeof it.label === 'function' ? it.label() : it.label;
      const col = it.disabled ? '#5a5a6a' : sel ? '#ffe060' : '#e8e8f0';
      const yy = y + k * gap;
      if (opts.align === 'left') {
        if (sel) drawText(c, '>', x - 8 + (Math.floor(this.t * 4) % 2), yy, { col: '#ffe060' });
        drawText(c, label, x, yy, { col });
        if (it.value) drawText(c, it.value(), opts.valueX || x + 150, yy, { col: sel ? '#ffe060' : '#a8c8ff' });
      } else {
        drawText(c, label, x, yy, { col, align: 'center' });
        if (sel) { const w = textWidth(label); drawText(c, '>', x - w / 2 - 8 + (Math.floor(this.t * 4) % 2), yy, { col: '#ffe060' }); drawText(c, '<', x + w / 2 + 4 - (Math.floor(this.t * 4) % 2), yy, { col: '#ffe060' }); }
      }
    });
  }
}

export function slider(c, x, y, v, w = 60) {
  c.fillStyle = '#000'; c.fillRect(x - 1, y - 1, w + 2, 6);
  c.fillStyle = '#3a3a5a'; c.fillRect(x, y, w, 4);
  c.fillStyle = '#ffe060'; c.fillRect(x, y, Math.round(w * v), 4);
}

// Typewriter dialogue box with portrait + name
export class TextBox {
  constructor(lines, onDone) {
    this.lines = Array.isArray(lines) ? lines : [lines];
    this.k = 0; this.onDone = onDone; this.done = false; this.t = 0; this.blipT = 0;
    this.start();
  }
  start() {
    const L = this.lines[this.k];
    this.speaker = L.s || null;
    this.text = fmt(L.t || L.n || '');
    this.narr = !!L.n;
    this.shown = 0;
    const tw = this.speaker && portrait(this.speaker) ? 254 : 296;
    this.wrapped = wrap(this.text, tw);
  }
  get complete() { return this.shown >= this.text.length; }
  update(dt) {
    if (this.done) return;
    this.t += dt;
    if (!this.complete) {
      const before = Math.floor(this.shown);
      this.shown = Math.min(this.text.length, this.shown + dt * 48);
      this.blipT -= dt;
      if (Math.floor(this.shown) > before && this.blipT <= 0 && this.text[before] !== ' ') { Audio.sfx('blip'); this.blipT = 0.05; }
    }
    if (Input.confirm() || Input.pressed('attack')) {
      if (!this.complete) this.shown = this.text.length;
      else if (this.k < this.lines.length - 1) { this.k++; this.start(); Audio.sfx('menuMove'); }
      else { this.done = true; if (this.onDone) this.onDone(); }
    }
  }
  render(c) {
    const x = 6, y = 126, w = W - 12, h = 48;
    panel(c, x, y, w, h, this.narr ? '#0a0a14' : '#141428', this.narr ? '#8a8aa0' : '#e8c040');
    let tx = x + 8;
    const por = this.speaker ? portrait(this.speaker) : null;
    if (por) {
      c.fillStyle = '#000'; c.fillRect(x + 5, y + 7, 34, 30);
      const col = (CHARS[this.speaker] && CHARS[this.speaker].col) || '#c05050';
      c.fillStyle = col; c.fillRect(x + 6, y + 8, 32, 28);
      c.drawImage(por, x + 6, y + 8);
      tx = x + 44;
    }
    if (this.speaker) {
      const name = SPEAKERS[this.speaker] || this.speaker.toUpperCase();
      const nw = textWidth(name) + 8;
      panel(c, x + 4, y - 8, nw, 10, '#e8c040', '#000');
      drawText(c, name, x + 8, y - 6, { col: '#1a1428', shadow: false });
    }
    let left = Math.floor(this.shown);
    this.wrapped.forEach((ln, i) => {
      if (left <= 0) return;
      const part = ln.slice(0, left);
      left -= ln.length + 1;
      drawText(c, part, tx, y + 7 + i * (LINE_H + 2), { col: this.narr ? '#c8c8e0' : '#ffffff' });
    });
    if (this.complete && Math.floor(this.t * 3) % 2) drawText(c, '^', x + w - 12, y + h - 9, { col: '#ffe060' });
  }
}

// Speech bubble above a world position (screen coords)
export function drawBubble(c, text, sx, sy, alpha = 1) {
  const lines = wrap(text, 128);
  const tw = Math.max(...lines.map((l) => textWidth(l)));
  const bw = tw + 8, bh = lines.length * 7 + 6;
  let bx = Math.round(sx - bw / 2), by = Math.round(sy - bh - 6);
  bx = Math.max(2, Math.min(W - bw - 2, bx)); by = Math.max(22, by);
  c.globalAlpha = alpha;
  c.fillStyle = '#000'; c.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
  c.fillStyle = '#fffbe8'; c.fillRect(bx, by, bw, bh);
  const tx = Math.max(bx + 3, Math.min(bx + bw - 5, Math.round(sx)));
  c.fillStyle = '#000'; c.fillRect(tx - 1, by + bh, 4, 2); c.fillRect(tx, by + bh + 2, 2, 2);
  c.fillStyle = '#fffbe8'; c.fillRect(tx, by + bh - 1, 2, 2); c.fillRect(tx + 1, by + bh + 1, 1, 1);
  lines.forEach((l, i) => drawText(c, l, bx + 4, by + 4 + i * 7, { col: '#1a1428', shadow: false }));
  c.globalAlpha = 1;
}

export function drawHeart(c, x, y, fill) { // fill: 0 empty, 1 half, 2 full
  const fr = SPR.heart[0];
  if (fill === 2) { c.drawImage(fr.c, x, y); return; }
  c.globalAlpha = 0.35; c.drawImage(fr.c, x, y); c.globalAlpha = 1;
  if (fill === 1) c.drawImage(fr.c, 0, 0, Math.floor(fr.w / 2), fr.h, x, y, Math.floor(fr.w / 2), fr.h);
}

export function drawHUD(c, g) {
  const p = g.player;
  c.fillStyle = '#00000088'; c.fillRect(0, 0, W, 22);
  const n = Math.ceil(p.maxHp / 2);
  for (let i = 0; i < n; i++) drawHeart(c, 3 + i * 9, 2, p.hp >= (i + 1) * 2 ? 2 : p.hp === i * 2 + 1 ? 1 : 0);
  // special meter
  drawText(c, 'POSE', 4, 13, { col: '#ffe060' });
  c.fillStyle = '#000'; c.fillRect(22, 13, 42, 6);
  c.fillStyle = '#3a3a5a'; c.fillRect(23, 14, 40, 4);
  const full = p.special >= 100;
  c.fillStyle = full ? (Math.floor(g.t * 8) % 2 ? '#ffffff' : '#ffe060') : '#e8a030';
  c.fillRect(23, 14, Math.round(40 * p.special / 100), 4);
  if (full) drawText(c, 'READY ' + '[' + Input.bindLabel('special') + ']', 68, 13, { col: '#ffe060' });
  else if (g.save.allies.craig) drawText(c, 'STUNT ' + (g.assistCharges > 0 ? '[' + Input.bindLabel('assist') + ']' : 'USED'), 68, 13, { col: g.assistCharges > 0 ? '#f08a40' : '#6a6a7a' });
  // centre: wave counter / segment
  drawText(c, g.hudCenter(), W / 2, 3, { col: '#ffffff', align: 'center' });
  if (g.save.allies.finn) drawText(c, g.understudyUsed ? 'UNDERSTUDY USED' : 'UNDERSTUDY READY', W / 2, 12, { col: g.understudyUsed ? '#6a6a7a' : '#c080ff', align: 'center' });
  // rice + score
  const bowl = SPR.bowl[0];
  c.drawImage(bowl.c, W - 64, 2);
  drawText(c, String(g.save.rice), W - 50, 4, { col: '#fffbe8' });
  drawText(c, 'SCORE ' + String(g.score).padStart(6, '0'), W - 3, 13, { col: '#a8c8ff', align: 'right' });
  // boss bar
  const b = g.boss;
  if (b && !b.gone && g.bossBarT > 0) {
    const bw = 200, bx = (W - bw) / 2, by = 170;
    const a = Math.min(1, g.bossBarT);
    c.globalAlpha = a;
    drawText(c, b.name, W / 2, by - 8, { col: b.def.friendly ? '#a8ffb0' : '#ff8a8a', align: 'center', outline: true });
    c.fillStyle = '#000'; c.fillRect(bx - 2, by - 1, bw + 4, 7);
    c.fillStyle = '#3a1018'; c.fillRect(bx - 1, by, bw + 2, 5);
    c.fillStyle = b.def.friendly ? '#4ad070' : '#e83040';
    c.fillRect(bx, by + 1, Math.round(bw * Math.max(0, b.hp) / b.maxHp), 3);
    c.fillStyle = '#ffffff55'; c.fillRect(bx, by + 1, Math.round(bw * Math.max(0, b.hp) / b.maxHp), 1);
    for (const ph of b.def.phases.slice(1)) { c.fillStyle = '#000'; c.fillRect(Math.round(bx + bw * ph.at), by, 1, 5); }
    c.globalAlpha = 1;
  }
}

// Toasts (achievements etc)
export const Toasts = {
  list: [],
  add(text, col = '#ffe060') { this.list.push({ text, col, t: 3.2 }); },
  update(dt) { if (this.list.length) { this.list[0].t -= dt; if (this.list[0].t <= 0) this.list.shift(); } },
  render(c) {
    const T = this.list[0]; if (!T) return;
    const w = textWidth(T.text) + 12, x = Math.round((W - w) / 2);
    const y = T.t > 2.9 ? 24 - (T.t - 2.9) * 60 : T.t < 0.3 ? 24 - (0.3 - T.t) * 60 : 24;
    panel(c, x, Math.round(y), w, 11, '#1a1428', T.col);
    drawText(c, T.text, W / 2, Math.round(y) + 3, { col: T.col, align: 'center' });
  },
};

export function banner(c, text, sub, t, col = '#ffe060') {
  // t: remaining time; slides in
  const a = Math.min(1, t * 3);
  c.globalAlpha = a;
  c.fillStyle = '#000000aa'; c.fillRect(0, 62, W, sub ? 34 : 24);
  c.fillStyle = col; c.fillRect(0, 62, W, 1); c.fillRect(0, (sub ? 95 : 85), W, 1);
  drawText(c, text, W / 2, 67, { col, align: 'center', scale: 2, outline: true });
  if (sub) drawText(c, sub, W / 2, 84, { col: '#ffffff', align: 'center' });
  c.globalAlpha = 1;
}

export function drawLogo(c, x, y, t) {
  const bob = Math.round(Math.sin(t * 2) * 1.5);
  drawText(c, 'JOSH:', x, y + bob, { col: '#ffe060', align: 'center', scale: 4, outline: '#3a1018' });
  drawText(c, 'LIGHTS, CAMERA,', x - 18, y + 26, { col: '#ffffff', align: 'center', scale: 2, outline: '#1a1440' });
  const jy = y + 26 - Math.abs(Math.round(Math.sin(t * 5) * 3));
  drawText(c, 'JUMP!', x + 76, jy, { col: '#ff5a6a', align: 'center', scale: 2, outline: '#3a1018' });
}

export function drawActor(c, key, x, y, t, flip = false, frameKey = null) {
  const set = SPR[key];
  if (!set) return;
  const fr = set.idle0 ? set[frameKey || 'idle' + (Math.floor(t * 2) % 2)] : set[Math.floor(t * 4) % set.length];
  drawSprite(c, fr, x, y, flip);
}
