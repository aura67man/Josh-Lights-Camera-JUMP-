// scenes.js - boot, title, options, controls rebinding, level select, credits, cutscenes,
// pause, game over, level summary, Marcus's Prop Shop, completion (New Game+ / replay) + the story flow.
import { W, H, FX, Particles, makeCanvas, rand } from './engine.js';
import { Input, ACTIONS, ACTION_LABELS } from './input.js';
import { Audio } from './audio.js';
import { Save, freshSave } from './save.js';
import { Scenes, Flow } from './state.js';
import { SPR, drawSprite, drawSpriteScaled, drawBG, TILESETS, THEATRE, BGS } from './sprites.js';
import { drawText, textWidth, wrap } from './font.js';
import { Menu, TextBox, panel, dim, slider, drawLogo, drawBubble } from './ui.js';
import { CUTSCENES, MOVIE, CREDITS, SHOP_LINES } from './story.js';
import { WORLDS } from './levels.js';
import { GameScene } from './game.js';

const pickLine = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---------------- boot (needed so audio can start after a user gesture) ----------------
class BootScene {
  constructor() { this.t = 0; }
  update(dt) { this.t += dt; if (this.t > 0.2 && (Input.any() || Input.anyKey)) { Input.anyKey = false; Audio.init(); Audio.apply(Save.settings); Audio.resume(); Flow.title(); } }
  render(c) {
    c.fillStyle = '#05050c'; c.fillRect(0, 0, W, H);
    drawLogo(c, W / 2, 46, this.t);
    if (Math.floor(this.t * 2) % 2 === 0) drawText(c, 'PRESS ANY KEY', W / 2, 128, { col: '#ffffff', align: 'center' });
    drawText(c, 'A FILM IN SIX SCENES', W / 2, 160, { col: '#6a6a8a', align: 'center' });
  }
}

// ---------------- title ----------------
class TitleScene {
  constructor() {
    this.t = 0;
    const has = Save.exists();
    this.menu = new Menu([
      { label: 'NEW GAME', action: () => { if (has) Scenes.push(new ConfirmScene('START A NEW GAME? THIS OVERWRITES YOUR SAVE.', () => Flow.newGame(0))); else Flow.newGame(0); } },
      { label: 'CONTINUE', disabled: !has, action: () => Flow.continueGame() },
      { label: 'LEVEL SELECT', disabled: !has, action: () => { Save.load(); Scenes.set(new LevelSelectScene()); } },
      { label: 'OPTIONS', action: () => Scenes.push(new OptionsScene()) },
      { label: 'CREDITS', action: () => Scenes.set(new CreditsScene(() => Flow.title())) },
    ]);
    if (has) this.menu.i = 1;
  }
  enter() { Audio.music('title'); }
  update(dt) { this.t += dt; this.menu.update(dt); }
  render(c) {
    drawBG(c, 5, this.t * 14);
    c.globalAlpha = 0.35; c.fillStyle = '#000'; c.fillRect(0, 0, W, H); c.globalAlpha = 1;
    drawLogo(c, W / 2, 10, this.t);
    // Josh on a little stage in his spotlight
    c.globalAlpha = 0.18; c.fillStyle = '#fff8c0';
    c.beginPath(); c.moveTo(48, 60); c.lineTo(58, 60); c.lineTo(76, 140); c.lineTo(30, 140); c.fill(); c.globalAlpha = 1;
    c.fillStyle = '#5a3a22'; c.fillRect(28, 138, 50, 6); c.fillStyle = '#8a5a34'; c.fillRect(28, 138, 50, 2);
    drawSprite(c, SPR.josh[Math.floor(this.t * 0.5) % 4 === 3 ? 'pose' : 'idle' + (Math.floor(this.t * 2) % 2)], 53, 138);
    const keys = ['ayden', 'finn', 'craig', 'marcus'];
    keys.forEach((k, i) => drawSprite(c, SPR[k]['idle' + (Math.floor(this.t * 2 + i) % 2)], 244 + i * 18, 138, true));
    c.fillStyle = '#5a3a22'; c.fillRect(232, 138, 80, 6); c.fillStyle = '#8a5a34'; c.fillRect(232, 138, 80, 2);
    panel(c, 104, 82, 112, 62, '#0e0e1ccc', '#e8c040');
    this.menu.render(c, W / 2, 88, { gap: 11 });
    drawText(c, 'ARROWS/WASD MOVE  ' + Input.bindLabel('jump') + ' JUMP  ' + Input.bindLabel('attack') + ' SWING  ENTER SELECT', W / 2, 168, { col: '#a8a8c8', align: 'center' });
  }
}

class ConfirmScene {
  constructor(q, yes, no) {
    this.overlay = true; this.q = q;
    this.menu = new Menu([{ label: 'YES', action: () => { Scenes.pop(); yes(); } }, { label: 'NO', action: () => { Scenes.pop(); if (no) no(); } }], { onBack: () => Scenes.pop() });
    this.menu.i = 1;
  }
  update(dt) { this.menu.update(dt); }
  render(c) {
    dim(c, 0.55);
    const lines = wrap(this.q, 200);
    panel(c, 50, 56, 220, 30 + lines.length * 8);
    lines.forEach((l, i) => drawText(c, l, W / 2, 63 + i * 8, { col: '#fff', align: 'center' }));
    this.menu.render(c, W / 2, 68 + lines.length * 8, { gap: 10 });
  }
}

// ---------------- options + controls ----------------
class OptionsScene {
  constructor() {
    this.overlay = true;
    const S = Save.settings;
    const adj = (k) => (d) => { S[k] = Math.max(0, Math.min(1, Math.round((S[k] + d * 0.1) * 10) / 10)); this.apply(); if (k === 'sfx') Audio.sfx('rice'); };
    const pct = (k) => () => Math.round(S[k] * 100) + '%';
    const toggleMute = () => { S.mute = !S.mute; this.apply(); };
    this.menu = new Menu([
      { label: 'MASTER VOLUME', value: pct('master'), adjust: adj('master'), slider: 'master' },
      { label: 'MUSIC VOLUME', value: pct('music'), adjust: adj('music'), slider: 'music' },
      { label: 'SFX VOLUME', value: pct('sfx'), adjust: adj('sfx'), slider: 'sfx' },
      { label: 'MUTE', value: () => (S.mute ? 'ON' : 'OFF'), adjust: toggleMute, action: toggleMute },
      { label: 'CONTROLS', action: () => Scenes.push(new ControlsScene()) },
      { label: 'BACK', action: () => Scenes.pop() },
    ], { onBack: () => Scenes.pop() });
  }
  apply() { Audio.apply(Save.settings); Save.storeSettings(); }
  update(dt) { this.menu.update(dt); }
  render(c) {
    dim(c, 0.6);
    panel(c, 40, 30, 240, 112);
    drawText(c, 'OPTIONS', W / 2, 38, { col: '#ffe060', align: 'center', scale: 2 });
    const M = this.menu;
    M.items.forEach((it, k) => {
      const y = 60 + k * 12, sel = k === M.i;
      if (sel) drawText(c, '>', 52 + (Math.floor(M.t * 4) % 2), y, { col: '#ffe060' });
      drawText(c, it.label, 60, y, { col: sel ? '#ffe060' : '#e8e8f0' });
      if (it.slider) { slider(c, 160, y, Save.settings[it.slider], 70); drawText(c, it.value(), 236, y, { col: '#a8c8ff' }); }
      else if (it.value) drawText(c, '< ' + it.value() + ' >', 160, y, { col: '#a8c8ff' });
    });
    drawText(c, 'LEFT/RIGHT ADJUST  -  SETTINGS SAVE AUTOMATICALLY', W / 2, 132, { col: '#8a8aa8', align: 'center' });
  }
}

class ControlsScene {
  constructor() { this.overlay = true; this.r = 0; this.col = 0; this.waiting = false; this.t = 0; this.rows = ACTIONS.length + 2; }
  update(dt) {
    this.t += dt;
    if (this.waiting) return;
    if (Input.menuUp()) { this.r = (this.r - 1 + this.rows) % this.rows; Audio.sfx('menuMove'); }
    if (Input.menuDown()) { this.r = (this.r + 1) % this.rows; Audio.sfx('menuMove'); }
    if (Input.menuLeft() || Input.menuRight()) { this.col = 1 - this.col; Audio.sfx('menuMove'); }
    if (Input.keyJust('Escape') || Input.keyJust('Backspace')) { Audio.sfx('menuBack'); Scenes.pop(); return; }
    if (Input.keyJust('Enter') || Input.keyJust('NumpadEnter') || Input.keyJust('Space')) {
      if (this.r < ACTIONS.length) {
        const a = ACTIONS[this.r], slot = this.col;
        this.waiting = true; Audio.sfx('menuSelect');
        Input.startCapture((code) => { this.waiting = false; if (code) { Input.setBind(a, slot, code); Audio.sfx('buy'); } else Audio.sfx('menuBack'); });
      } else if (this.r === ACTIONS.length) { Input.resetBinds(); Audio.sfx('buy'); }
      else { Audio.sfx('menuBack'); Scenes.pop(); }
    }
  }
  render(c) {
    dim(c, 0.75);
    panel(c, 10, 4, 300, 172);
    drawText(c, 'CONTROLS', W / 2, 9, { col: '#ffe060', align: 'center' });
    drawText(c, 'KEY 1', 162, 18, { col: '#8a8aa8' }); drawText(c, 'KEY 2', 232, 18, { col: '#8a8aa8' });
    ACTIONS.forEach((a, i) => {
      const y = 27 + i * 10, sel = i === this.r;
      drawText(c, ACTION_LABELS[a], 22, y, { col: sel ? '#ffe060' : '#e8e8f0' });
      for (let s = 0; s < 2; s++) {
        const x = 156 + s * 70, on = sel && s === this.col;
        if (on) { c.fillStyle = this.waiting ? '#c83a3a' : '#3a3a6a'; c.fillRect(x - 3, y - 2, 62, 9); }
        const lab = on && this.waiting ? (Math.floor(this.t * 4) % 2 ? 'PRESS KEY' : '') : Input.keyLabel(Input.binds[a][s]);
        drawText(c, lab, x, y, { col: on ? '#ffffff' : '#a8c8ff' });
      }
    });
    const ry = 27 + ACTIONS.length * 10;
    drawText(c, 'RESET TO DEFAULTS', 22, ry + 2, { col: this.r === ACTIONS.length ? '#ffe060' : '#e8e8f0' });
    drawText(c, 'BACK', 22, ry + 12, { col: this.r === ACTIONS.length + 1 ? '#ffe060' : '#e8e8f0' });
    drawText(c, this.waiting ? 'PRESS ANY KEY TO BIND  -  ESC CANCELS' : 'ENTER REBIND  -  SAVED AUTOMATICALLY', 300, ry + 2, { col: '#8a8aa8', align: 'right' });
    drawText(c, 'PAD: A JUMP X SWING Y THROW B DASH RB POSE LB ASSIST', 300, ry + 12, { col: '#6a6a88', align: 'right' });
  }
}

// ---------------- level select ----------------
class LevelSelectScene {
  constructor() {
    this.t = 0;
    const d = Save.data;
    const items = WORLDS.map((w, i) => ({
      label: () => (i <= d.unlocked ? w.scene + ': ' + w.name : w.scene + ': ???'),
      disabled: i > d.unlocked,
      action: () => Scenes.set(new GameScene(i, 'replay')),
    }));
    items.push({ label: 'BACK', action: () => Flow.title() });
    this.menu = new Menu(items, { onBack: () => Flow.title() });
  }
  enter() { Audio.music('title'); }
  update(dt) { this.t += dt; this.menu.update(dt); }
  render(c) {
    const d = Save.data;
    drawBG(c, Math.min(this.menu.i, 5), this.t * 10);
    dim(c, 0.55);
    drawText(c, 'LEVEL SELECT', W / 2, 8, { col: '#ffe060', align: 'center', scale: 2 });
    panel(c, 16, 26, 288, 108);
    this.menu.items.forEach((it, k) => {
      const y = 33 + k * 13, sel = k === this.menu.i;
      if (sel) drawText(c, '>', 22 + (Math.floor(this.t * 4) % 2), y, { col: '#ffe060' });
      drawText(c, it.label(), 30, y, { col: it.disabled ? '#5a5a6a' : sel ? '#ffe060' : '#e8e8f0' });
      if (k < 6 && !it.disabled) {
        if (d.cookers[k]) c.drawImage(SPR.cooker[0].c, 222, y - 4, 14, 15);
        drawText(c, d.sebastian[k] ? 'S' : '-', 244, y, { col: d.sebastian[k] ? '#8aa0c8' : '#4a4a5a' });
        drawText(c, d.best[k] ? 'RANK ' + d.best[k] : '', 296, y, { col: '#a8ffb0', align: 'right' });
      }
    });
    const A = d.achievements;
    drawText(c, 'RICE ' + d.rice + '   COOKERS ' + d.cookers.filter(Boolean).length + '/6   SEBASTIAN ' + d.sebastian.filter(Boolean).length + '/6', W / 2, 140, { col: '#fffbe8', align: 'center' });
    const ach = [A.cookers ? 'MASTER CHEF OF CINEMA' : '???', A.seb ? "WHERE'S SEBASTIAN?" : '???', A.bowls ? 'BOWLED OVER' : '???'];
    drawText(c, 'ACHIEVEMENTS: ' + ach.join('  /  '), W / 2, 152, { col: '#c8a8ff', align: 'center' });
    if (d.goldClapper) drawText(c, 'BONUS: GOLDEN CLAPPERBOARD EQUIPPED', W / 2, 163, { col: '#ffe060', align: 'center' });
  }
}

// ---------------- credits ----------------
class CreditsScene {
  constructor(onDone) { this.onDone = onDone; this.y = H + 4; this.t = 0; this.done = false; }
  enter() { Audio.music('credits'); }
  update(dt) {
    this.t += dt;
    const fast = Input.down('jump') || Input.down('attack');
    this.y -= dt * (fast ? 70 : 20);
    if (!this.done && (Input.back() || Input.keyJust('Escape') || this.y < -CREDITS.length * 12 - 20)) { this.done = true; this.onDone(); }
  }
  render(c) {
    drawBG(c, 5, this.t * 8);
    dim(c, 0.6);
    CREDITS.forEach(([txt, kind], i) => {
      const y = Math.round(this.y + i * 12);
      if (y < -12 || y > H) return;
      if (kind === 'title') drawText(c, txt, W / 2, y, { col: '#ffe060', align: 'center', scale: 2, outline: true });
      else drawText(c, txt, W / 2, y, { col: kind === 'head' ? '#a8c8ff' : '#ffffff', align: 'center' });
    });
    const parade = ['josh', 'craig', 'marcus', 'ayden', 'finn', 'sebastian'];
    parade.forEach((k, i) => {
      const x = ((this.t * 30 + i * 52) % (W + 60)) - 30;
      drawSprite(c, SPR[k]['run' + (Math.floor(this.t * 9 + i) % 4)], x, 174);
    });
    drawText(c, 'HOLD JUMP TO SPEED UP  -  ESC TO SKIP', W - 4, 4, { col: '#6a6a8a', align: 'right' });
  }
}

// ---------------- cutscenes ----------------
const [movC, movX] = makeCanvas(W, H);
class CutsceneScene {
  constructor(id, onDone) {
    this.cs = CUTSCENES[id]; this.onDone = onDone; this.i = -1; this.t = 0;
    this.actors = {}; for (const k in this.cs.cast) this.actors[k] = { x: this.cs.cast[k], a: 1 };
    this.tb = null; this.title = null; this.movie = null; this.holo = null; this.speaker = null; this.finished = false;
    this.parts = new Particles();
    this.next();
  }
  enter() { FX.reset(); Audio.music(this.cs.music || 'cutscene'); }
  next() {
    const steps = this.cs.steps;
    for (;;) {
      this.i++;
      if (this.i >= steps.length) { this.finish(); return; }
      const st = steps[this.i];
      if (st.enter) { this.actors[st.enter] = { x: st.x, a: 0 }; continue; }
      if (st.exit) { if (this.holo && this.holo.key === st.exit) this.holo = null; else delete this.actors[st.exit]; continue; }
      if (st.holo) { this.holo = { key: st.holo, x: st.x, a: 0 }; continue; }
      if (st.fx) {
        if (st.fx === 'flash') { FX.flash('#ffffff', 0.35); Audio.sfx('flash'); }
        if (st.fx === 'applause') { Audio.sfx('applause'); for (let i = 0; i < 80; i++) this.parts.add({ x: rand(0, W), y: rand(-40, 0), vx: rand(-20, 20), vy: rand(20, 60), life: 3, c: ['#ffe060', '#ff5a6a', '#5ab0ff', '#7aff8a'][i % 4], s: 2 }); }
        continue;
      }
      if (st.title) { this.title = { text: st.title, sub: st.sub, t: 0 }; Audio.sfx('clap'); return; }
      if (st.movie) { this.movie = { k: 0, t: 0 }; Audio.music('credits'); return; }
      this.speaker = st.s || null;
      this.tb = new TextBox([st], () => { this.tb = null; this.next(); });
      return;
    }
  }
  finish() { if (this.finished) return; this.finished = true; this.onDone(); }
  update(dt) {
    this.t += dt; FX.update(dt); this.parts.update(dt);
    if (Input.skip()) { Audio.sfx('menuBack'); this.finish(); return; }
    for (const k in this.actors) this.actors[k].a = Math.min(1, this.actors[k].a + dt * 3);
    if (this.holo) this.holo.a = Math.min(1, this.holo.a + dt * 2);
    if (this.title) { this.title.t += dt; if (this.title.t > 2.4 || (this.title.t > 0.4 && Input.confirm())) { this.title = null; this.next(); } return; }
    if (this.movie) {
      const m = this.movie; m.t += dt;
      if (m.t > 2.6 || (m.t > 0.3 && Input.confirm())) { m.k++; m.t = 0; if (m.k >= MOVIE.length) { this.movie = null; Audio.music(this.cs.music || 'cutscene'); this.next(); } }
      return;
    }
    if (this.tb) this.tb.update(dt);
  }
  actorY(k, base) { return k === this.speaker && this.tb && !this.tb.complete ? base - Math.round(Math.abs(Math.sin(this.t * 12)) * 2) : base; }
  render(c) {
    const cs = this.cs;
    if (cs.bg === 'theatre') this.renderTheatre(c);
    else {
      drawBG(c, cs.bg, this.t * 6);
      const ts = TILESETS[cs.bg];
      for (let x = 0; x < W; x += 16) { c.drawImage(ts, 16, 0, 16, 16, x, 112, 16, 16); for (let y = 128; y < H; y += 16) c.drawImage(ts, 0, 0, 16, 16, x, y, 16, 16); }
      if (this.holo) {
        const a = this.holo.a * (0.6 + 0.25 * Math.sin(this.t * 20));
        drawSprite(c, SPR.finalcutBoss['idle' + (Math.floor(this.t * 2) % 2)], this.holo.x, 104, false, false, a);
        c.globalAlpha = 0.2; c.fillStyle = '#80c0ff';
        for (let y = 16; y < 104; y += 3) c.fillRect(this.holo.x - 26, y, 52, 1);
        c.globalAlpha = 1;
      }
      const jx = this.actors.josh ? this.actors.josh.x : W / 2;
      for (const k in this.actors) {
        const A = this.actors[k];
        const flip = k === 'josh' ? Object.keys(this.actors).some((o) => o !== 'josh' && this.actors[o].x < jx) && !Object.keys(this.actors).some((o) => o !== 'josh' && this.actors[o].x > jx) : A.x > jx;
        drawSprite(c, SPR[k]['idle' + (Math.floor(this.t * 2 + A.x) % 2)], A.x, this.actorY(k, 113), flip, false, A.a);
      }
    }
    this.parts.draw(c, 0, 0);
    if (this.title) {
      c.fillStyle = '#05050c'; c.fillRect(0, 0, W, H);
      const a = Math.min(1, this.title.t * 3);
      c.globalAlpha = a;
      // clapperboard
      const bx = W / 2 - 40, by = 42, open = this.title.t < 0.3 ? 1 : 0;
      c.fillStyle = '#000'; c.fillRect(bx - 1, by - 1, 82, 52);
      c.fillStyle = '#2b2b2b'; c.fillRect(bx, by + 10, 80, 40);
      c.save(); c.translate(bx, by + 10); c.rotate(open ? -0.25 : 0);
      for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#f4f4f4' : '#222'; c.fillRect(i * 10, -10, 10, 9); }
      c.restore();
      drawText(c, this.title.text, W / 2, by + 18, { col: '#ffffff', align: 'center', scale: 2 });
      drawText(c, 'TAKE 1', W / 2, by + 36, { col: '#a8a8a8', align: 'center' });
      drawText(c, this.title.sub, W / 2, 112, { col: '#ffe060', align: 'center', scale: 2, outline: '#3a1018' });
      c.globalAlpha = 1;
    }
    if (this.tb) this.tb.render(c);
    if (!this.title) drawText(c, 'ESC: SKIP', W - 4, 4, { col: '#8a8aa8', align: 'right' });
    FX.drawFlash(c);
  }
  renderTheatre(c) {
    c.drawImage(THEATRE, 0, 0);
    if (this.movie) {
      const m = this.movie, k = Math.min(m.k, MOVIE.length - 1);
      drawBG(movX, MOVIE[k].bg, m.t * 60);
      const ts = TILESETS[MOVIE[k].bg];
      for (let x = 0; x < W; x += 16) movX.drawImage(ts, 16, 0, 16, 16, x, 146, 16, 16);
      drawSpriteScaled(movX, SPR.josh['run' + (Math.floor(m.t * 10) % 4)], W / 2, 147, 2);
      c.drawImage(movC, 0, 46, W, 106, 60, 8, 200, 66);
      c.fillStyle = '#00000099'; c.fillRect(60, 64, 200, 10);
      drawText(c, MOVIE[k].t, W / 2, 66, { col: '#ffffff', align: 'center' });
    } else {
      drawText(c, 'LIGHTS, CAMERA, JUMP!', W / 2, 30, { col: '#3a3a4a', align: 'center', scale: 2, shadow: false });
      drawText(c, 'A FILM BY JOSH', W / 2, 50, { col: '#5a5a6a', align: 'center', shadow: false });
    }
    c.fillStyle = '#4a2a18'; c.fillRect(0, 78, W, 10); c.fillStyle = '#6a4024'; c.fillRect(0, 78, W, 2);
    if (this.actors.josh) drawSprite(c, SPR.josh[this.speaker === 'josh' && this.tb ? 'pose' : 'idle0'], this.actors.josh.x, this.actorY('josh', 86), false, false, this.actors.josh.a);
    // back row: Sebastian (and a reformed Final Cut)
    drawSprite(c, SPR.sebastian.idle0, 292, this.actorY('sebastian', 106), true);
    if (this.holo) drawSprite(c, SPR.finalcut.idle0, 262, this.actorY('finalcut', 106), true, false, this.holo.a);
    c.fillStyle = '#000'; c.fillRect(0, 99, W, 12);
    for (let x = 4; x < W; x += 20) { c.fillStyle = '#7a1424'; c.fillRect(x, 100, 18, 10); c.fillStyle = '#9a2434'; c.fillRect(x, 100, 18, 2); }
    // front row: friends
    const front = { marcus: 70, craig: 112, ayden: 200, finn: 244 };
    for (const k in front) drawSprite(c, SPR[k][this.speaker === k && this.tb ? 'pose' : 'idle0'], front[k], this.actorY(k, k === 'marcus' ? 124 : 128), k === 'finn' || k === 'ayden');
    c.fillStyle = '#000'; c.fillRect(0, 121, W, H - 121);
    for (let y = 122; y < H; y += 18) for (let x = (y % 36 ? 11 : 0); x < W; x += 22) { c.fillStyle = '#8a1a2a'; c.fillRect(x, y, 20, 16); c.fillStyle = '#aa2a3a'; c.fillRect(x, y, 20, 2); }
  }
}

// ---------------- pause / game over ----------------
class PauseScene {
  constructor(game) {
    this.overlay = true; this.game = game; this.t = 0;
    this.menu = new Menu([
      { label: 'RESUME', action: () => Scenes.pop() },
      { label: 'RESTART SCENE', action: () => Scenes.push(new ConfirmScene('RESTART THIS SCENE FROM THE TOP?', () => Flow.restartLevel(game))) },
      { label: 'OPTIONS', action: () => Scenes.push(new OptionsScene()) },
      { label: 'QUIT TO MENU', action: () => Scenes.push(new ConfirmScene('QUIT TO MENU? PROGRESS IN THIS SCENE IS LOST (RICE YOU GRABBED IS KEPT).', () => { Save.store(); Flow.title(); })) },
    ], { onBack: () => Scenes.pop() });
  }
  update(dt) {
    this.t += dt;
    if (this.t > 0.1 && Input.pausePressed()) { Audio.sfx('menuBack'); Scenes.pop(); return; }
    this.menu.update(dt);
  }
  render(c) {
    dim(c, 0.6);
    panel(c, 100, 44, 120, 84);
    drawText(c, 'PAUSED', W / 2, 52, { col: '#ffe060', align: 'center', scale: 2 });
    this.menu.render(c, W / 2, 76, { gap: 12 });
    drawText(c, WORLDS[this.game.li].scene + ': ' + WORLDS[this.game.li].name, W / 2, 140, { col: '#a8a8c8', align: 'center' });
  }
}

class GameOverScene {
  constructor(game) {
    this.overlay = true; this.game = game; this.t = 0;
    this.menu = new Menu([
      { label: 'RETRY FROM CHECKPOINT', action: () => { Scenes.pop(); game.retryFromCheckpoint(); } },
      { label: 'RESTART SCENE', action: () => Flow.restartLevel(game) },
      { label: 'QUIT TO MENU', action: () => { Save.store(); Flow.title(); } },
    ]);
  }
  update(dt) { this.t += dt; if (this.t > 0.6) this.menu.update(dt); }
  render(c) {
    c.globalAlpha = Math.min(0.75, this.t); c.fillStyle = '#1a0008'; c.fillRect(0, 0, W, H); c.globalAlpha = 1;
    drawText(c, 'CUT!', W / 2, 16, { col: '#ff4a5a', align: 'center', scale: 4, outline: true });
    drawText(c, "THAT TAKE DIDN'T WORK OUT.", W / 2, 42, { col: '#ffffff', align: 'center' });
    drawSprite(c, SPR.josh.ko, W / 2 - 14, 102);
    drawSprite(c, SPR.ayden.idle0, W / 2 + 18, 102, true);
    drawBubble(c, 'TAKE TWO.', W / 2 + 30, 80);
    if (this.t > 0.6) this.menu.render(c, W / 2, 110, { gap: 12 });
  }
}

// ---------------- level complete summary ----------------
function rankFor(g) {
  const par = [240, 270, 300, 330, 360, 390][g.li];
  let pts = 0;
  const dmg = g.stats.damage, time = g.stats.time;
  if (dmg === 0) pts += 3; else if (dmg <= 4) pts += 2; else if (dmg <= 10) pts += 1;
  if (time < par) pts += 2; else if (time < par * 1.5) pts += 1;
  if (g.stats.cooker) pts += 1;
  return pts >= 5 ? 'S' : pts >= 4 ? 'A' : pts >= 2 ? 'B' : 'C';
}
const RANKV = { S: 4, A: 3, B: 2, C: 1 };

class SummaryScene {
  constructor(g, rank, onDone) { this.g = g; this.rank = rank; this.onDone = onDone; this.t = 0; }
  enter() { Audio.music('shop'); }
  update(dt) { this.t += dt; if (this.t > 1.2 && Input.confirm()) { Audio.sfx('menuSelect'); this.onDone(); } }
  render(c) {
    const g = this.g, s = g.stats;
    drawBG(c, g.li, this.t * 10); dim(c, 0.55);
    drawText(c, "THAT'S A WRAP!", W / 2, 12, { col: '#ffe060', align: 'center', scale: 2, outline: true });
    drawText(c, g.world.scene + ': ' + g.world.name, W / 2, 32, { col: '#ffffff', align: 'center' });
    panel(c, 40, 44, 240, 104);
    const mm = Math.floor(s.time / 60), ss = String(Math.floor(s.time % 60)).padStart(2, '0');
    const rows = [['TIME', mm + ':' + ss], ['ENEMIES CUT', String(s.kills)], ['RICE COLLECTED', String(s.rice)], ['DAMAGE TAKEN', (s.damage / 2) + ' HEARTS'],
      ['GOLDEN RICE COOKER', s.cooker ? 'FOUND!' : 'NOT FOUND'], ['SEBASTIAN', s.seb ? 'FOUND!' : '???'], ['SCORE', String(g.score)]];
    rows.forEach(([k, v], i) => {
      if (this.t < 0.15 * (i + 1)) return;
      drawText(c, k, 52, 52 + i * 11, { col: '#a8c8ff' });
      drawText(c, v, 220, 52 + i * 11, { col: '#ffffff', align: 'right' });
    });
    if (this.t > 1.1) {
      drawText(c, 'RANK', 252, 60, { col: '#a8c8ff', align: 'center' });
      drawText(c, this.rank, 252, 72, { col: this.rank === 'S' ? '#ffe060' : '#ffffff', align: 'center', scale: 4, outline: true });
    }
    if (this.t > 1.2 && Math.floor(this.t * 2) % 2) drawText(c, 'PRESS ENTER TO CONTINUE', W / 2, 158, { col: '#ffffff', align: 'center' });
  }
}

// ---------------- Marcus's Prop Shop ----------------
const SHOP_ITEMS = [
  { id: 'hearts', name: 'EXTRA HEART', desc: '+1 MAX HEART. FOR THE BIG EMOTIONAL SCENES.', cost: [40, 70, 100] },
  { id: 'dash', name: 'STUNT BOOTS', desc: 'LONGER "TAKE TWO" DASH.', cost: [30, 55, 80] },
  { id: 'clapper', name: 'STEEL CLAPPERBOARD', desc: '+1 SWING DAMAGE. REELS HIT HARDER TOO.', cost: [45, 75, 110] },
  { id: 'special', name: 'SPOTLIGHT BATTERY', desc: 'DRAMATIC POSE RECHARGES FASTER.', cost: [35, 60, 90] },
];
class ShopScene {
  constructor(onDone) {
    this.onDone = onDone; this.t = 0; this.line = pickLine(SHOP_LINES.hello); this.lineT = 0;
    const items = SHOP_ITEMS.map((it) => ({ label: it.name, item: it, action: () => this.buy(it) }));
    items.push({ label: 'DONE - NEXT SCENE', action: () => { Save.store(); this.onDone(); } });
    this.menu = new Menu(items);
  }
  enter() { Audio.music('shop'); }
  buy(it) {
    const d = Save.data, lvl = d.upgrades[it.id];
    if (lvl >= it.cost.length) { this.say(pickLine(SHOP_LINES.maxed)); Audio.sfx('nope'); return; }
    const cost = it.cost[lvl];
    if (d.rice < cost) { this.say(pickLine(SHOP_LINES.poor)); Audio.sfx('nope'); return; }
    d.rice -= cost; d.upgrades[it.id]++; Save.store();
    this.say(pickLine(SHOP_LINES.buy)); Audio.sfx('buy');
  }
  say(l) { this.line = l; this.lineT = 0; }
  update(dt) { this.t += dt; this.lineT += dt; this.menu.update(dt); }
  render(c) {
    const d = Save.data;
    c.fillStyle = '#2a1a14'; c.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 24) { c.fillStyle = x % 48 ? '#3a2418' : '#33201a'; c.fillRect(x, 0, 24, 120); }
    // shelves with props
    for (let y = 24; y < 110; y += 30) { c.fillStyle = '#6a4024'; c.fillRect(0, y, 120, 4); }
    drawSprite(c, SPR.cooker[0], 20, 24); drawSprite(c, SPR.chair[0], 50, 24); drawSprite(c, SPR.reel[0], 84, 18);
    drawSprite(c, SPR.statue[0], 24, 54); drawSprite(c, SPR.pumpkin[0], 56, 54); drawSprite(c, SPR.bowl[0], 90, 48);
    drawSprite(c, SPR.trashcan[0], 22, 84); drawSprite(c, SPR.tumbleweed[0], 60, 84); drawSprite(c, SPR.heart[0], 92, 80);
    drawSpriteScaled(c, SPR.marcus['idle' + (Math.floor(this.t * 2) % 2)], 62, 140, 2);
    c.fillStyle = '#000'; c.fillRect(0, 129, 130, 51); c.fillStyle = '#7a4a2a'; c.fillRect(0, 130, 129, 50); c.fillStyle = '#9a6a3a'; c.fillRect(0, 130, 129, 3);
    drawText(c, "MARCUS'S PROP SHOP", 64, 140, { col: '#ffe060', align: 'center' });
    drawText(c, 'EST. LAST TUESDAY', 64, 150, { col: '#c8a878', align: 'center' });
    const shown = Math.min(this.line.length, Math.floor(this.lineT * 50));
    drawBubble(c, this.line.slice(0, shown) || ' ', 64, 92);
    panel(c, 136, 6, 178, 168);
    drawText(c, 'PROPS FOR RICE', 225, 12, { col: '#ffe060', align: 'center' });
    c.drawImage(SPR.bowl[0].c, 142, 22); drawText(c, 'RICE: ' + d.rice, 156, 24, { col: '#fffbe8' });
    this.menu.items.forEach((m, k) => {
      const y = 40 + k * 20, sel = k === this.menu.i;
      if (sel) { c.fillStyle = '#2a2a4a'; c.fillRect(140, y - 3, 170, m.item ? 19 : 10); }
      drawText(c, m.label, 146, y, { col: sel ? '#ffe060' : '#e8e8f0' });
      if (m.item) {
        const lvl = d.upgrades[m.item.id], max = m.item.cost.length;
        for (let i = 0; i < max; i++) { c.fillStyle = '#000'; c.fillRect(146 + i * 7, y + 8, 6, 5); c.fillStyle = i < lvl ? '#5ad06a' : '#3a3a5a'; c.fillRect(147 + i * 7, y + 9, 4, 3); }
        const cost = lvl < max ? m.item.cost[lvl] : null;
        drawText(c, cost === null ? 'SOLD OUT' : cost + ' RICE', 306, y, { col: cost === null ? '#6a6a7a' : d.rice >= cost ? '#a8ffb0' : '#ff8a8a', align: 'right' });
      }
    });
    const sel = this.menu.items[this.menu.i];
    if (sel.item) wrap(sel.item.desc, 166).forEach((l, i) => drawText(c, l, 144, 146 + i * 8, { col: '#a8c8ff' }));
    else drawText(c, 'ONWARD TO THE NEXT SET!', 144, 146, { col: '#a8c8ff' });
  }
}

// ---------------- completion ----------------
class CompletionScene {
  constructor() {
    this.t = 0;
    const d = Save.data;
    this.menu = new Menu([
      { label: 'NEW GAME+ (KEEP RICE & PROPS, TOUGHER CREW)', action: () => Flow.newGame((d.ngPlus || 0) + 1) },
      { label: 'REPLAY LEVELS', action: () => Scenes.set(new LevelSelectScene()) },
      { label: 'MAIN MENU', action: () => Flow.title() },
    ]);
  }
  enter() { Audio.music('credits'); }
  update(dt) { this.t += dt; this.menu.update(dt); }
  render(c) {
    const d = Save.data;
    drawBG(c, 5, this.t * 12); dim(c, 0.45);
    drawText(c, 'THE END', W / 2, 16, { col: '#ffe060', align: 'center', scale: 4, outline: '#3a1018' });
    drawText(c, "JOSH'S FIRST MOVIE PREMIERED TO A STANDING OVATION.", W / 2, 46, { col: '#ffffff', align: 'center' });
    ['josh', 'craig', 'marcus', 'ayden', 'finn', 'sebastian'].forEach((k, i) => drawSprite(c, SPR[k][i === 0 ? 'pose' : 'idle' + (Math.floor(this.t * 2 + i) % 2)], 60 + i * 40, 92));
    drawText(c, 'TOTAL SCORE ' + d.score + '   COOKERS ' + d.cookers.filter(Boolean).length + '/6   SEBASTIAN ' + d.sebastian.filter(Boolean).length + '/6' + (d.ngPlus ? '   NG+' + d.ngPlus : ''), W / 2, 102, { col: '#fffbe8', align: 'center' });
    panel(c, 30, 116, 260, 46);
    this.menu.render(c, W / 2, 123, { gap: 12 });
  }
}

// ---------------- flow ----------------
Flow.title = () => Scenes.set(new TitleScene());
Flow.cutscene = (id, done) => Scenes.set(new CutsceneScene(id, done));
Flow.newGame = (ng = 0) => {
  const carry = ng > 0 ? Save.data : null;
  Save.data = freshSave(ng, carry);
  if (ng > 0) Save.data.unlocked = 5;
  Save.store();
  Flow.cutscene('opening', () => Flow.startLevel(0));
};
Flow.continueGame = () => {
  Save.load();
  const d = Save.data;
  if (d.level >= 6) Scenes.set(new CompletionScene());
  else if (d.level > 0) Flow.shop(() => Flow.startLevel(d.level));
  else Flow.startLevel(0);
};
Flow.startLevel = (i) => Flow.cutscene('intro' + i, () => Scenes.set(new GameScene(i, 'story')));
Flow.shop = (done) => Scenes.set(new ShopScene(done));
Flow.pause = (g) => Scenes.push(new PauseScene(g));
Flow.gameOver = (g) => Scenes.push(new GameOverScene(g));
Flow.restartLevel = (g) => Scenes.set(new GameScene(g.li, g.mode));
Flow.levelComplete = (g) => {
  const d = Save.data, i = g.li;
  const rank = rankFor(g);
  d.score += g.score;
  if (!d.best[i] || RANKV[rank] > RANKV[d.best[i]]) d.best[i] = rank;
  d.unlocked = Math.max(d.unlocked, Math.min(5, i + 1));
  if (g.mode === 'story') d.level = Math.max(d.level, i + 1);
  Save.store();
  Scenes.set(new SummaryScene(g, rank, () => {
    if (g.mode === 'replay') { Scenes.set(new LevelSelectScene()); return; }
    if (i === 5) {
      d.completed = true; d.level = 6; Save.store();
      Flow.cutscene('ending', () => Scenes.set(new CreditsScene(() => Scenes.set(new CompletionScene()))));
    } else Flow.cutscene('outro' + i, () => Flow.shop(() => Flow.startLevel(i + 1)));
  }));
};

export function startGame() { Scenes.set(new BootScene()); }
