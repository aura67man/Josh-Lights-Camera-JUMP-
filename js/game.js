// game.js - gameplay scene: level, waves, arenas, checkpoints, pickups, secrets, allies, camera, HUD
import { W, H, TILE, T_SOLID, T_PLAT, T_BREAK, FX, Particles, clamp, overlap, rand, chance, floorAt, isSolidT, makeCanvas } from './engine.js';
import { SPR, drawSprite, TILESETS, drawBG, WPAL } from './sprites.js';
import { buildLevel, GROUND } from './levels.js';
import { Player } from './player.js';
import { Enemy, ENEMY_DEFS } from './enemies.js';
import { Boss } from './bosses.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { Save } from './save.js';
import { Flow } from './state.js';
import { TextBox, drawBubble, drawHUD, banner, Toasts } from './ui.js';
import { drawText } from './font.js';
import { Joker, JOKES, BOSS_TALK, AYDEN_HINTS, SEB_LINES, SEB_ALL } from './story.js';

const [spotC, spotX] = (() => { try { return makeCanvas(W, H); } catch (e) { return [null, null]; } })();

export class GameScene {
  constructor(li, mode = 'story') {
    this.li = li; this.mode = mode; this.save = Save.data;
    const lv = buildLevel(li);
    this.lv = lv; this.world = lv.world; this.L = lv.L; this.tier = lv.world.tier;
    this.player = new Player(this, lv.start.x, lv.start.y);
    this.enemies = []; this.projs = []; this.parts = new Particles(); this.floats = []; this.warns = []; this.timers = [];
    this.pickups = lv.pickups.map((p) => ({ ...p, taken: false, t: Math.random() * 6, vy: 0 }));
    for (const s of lv.spawns) this.enemies.push(new Enemy(this, s.type, s.x, s.y, this.tier));
    this.segments = lv.segments; this.checkpoints = lv.checkpoints;
    this.cp = { x: lv.start.x, y: lv.start.y };
    this.arena = null; this.boss = null; this.bossBarT = 0; this.laser = null; this.assist = null; this.npc = null;
    this.assistCharges = this.save.allies.craig ? 1 : 0; this.understudyUsed = false; this.finnCameo = 0;
    this.cam = { x: 0 }; this.t = 0; this.score = 0;
    this.stats = { time: 0, kills: 0, rice: 0, damage: 0, cooker: false, seb: false };
    this.textbox = null; this.bubble = null; this.bubbleCD = 0; this.banners = []; this.spotlightT = 0;
    this.state = 'play'; this.sebFound = false; this.sebBubble = null; this.aydenBubble = null; this.hintShown = false;
    this.wavesTotal = lv.world.waves; this.wavesDone = 0; this.lastSafe = { x: lv.start.x, y: lv.start.y };
    this.cutsceneLock = false;
    this.addBanner(this.world.scene, this.world.name, 2.4);
    this.after(1.4, () => { this.bubble = { text: JOKES.level[li], t: 3.2 }; Joker.last = JOKES.level[li]; this.bubbleCD = 4; });
  }
  enter() { FX.reset(); Audio.music(this.world.music); }
  resume() {}

  // ---------- helpers used by entities ----------
  after(t, fn) { this.timers.push({ t, fn }); }
  addProj(p) { this.projs.push({ t: 0, g: 0, anim: 0, ...p }); }
  countPlayerProj() { return this.projs.filter((p) => p.owner === 'player').length; }
  addFloat(text, x, y, col = '#fff') { this.floats.push({ text, x, y, col, t: 0.7 }); }
  addWarn(x, t) { this.warns.push({ x, t, max: t }); }
  addBanner(text, sub, t = 1.8, col) { this.banners.push({ text, sub, t, col }); }
  hittables() {
    const out = [];
    for (const e of this.enemies) if (!e.dead && e.spawnT <= 0) out.push(e);
    if (this.boss && !this.boss.dead && !this.boss.gone) out.push(this.boss);
    return out;
  }
  say(cat, force = false, prob = 1) {
    if (this.player.dead) return;
    if (!force && (this.bubbleCD > 0 || Math.random() > prob)) return;
    const l = Joker.line(cat);
    if (!l) return;
    this.bubble = { text: l, t: 2.6 }; this.bubbleCD = 3.6;
  }
  dialog(lines, onDone) { this.textbox = new TextBox(lines, onDone); }
  breakTile(tx, ty) {
    this.L.set(tx, ty, 0);
    const pal = WPAL[this.li];
    this.parts.burst(tx * TILE + 8, ty * TILE + 8, 14, [pal.brk, pal.fill, '#ffffff'], 120, 0.6);
    Audio.sfx('break'); FX.shake(2, 0.15);
    if (!this._secretSaid) { this._secretSaid = true; this.say('secret', true); }
  }

  spawnArenaEnemy(type, seg) {
    const d = ENEMY_DEFS[type], p = this.player;
    let x, y;
    if (d.beh === 'flyer') { x = chance(0.5) ? seg.x0 + 12 : seg.x1 - 28; y = rand(36, 70); }
    else {
      let tries = 0;
      do { x = rand(seg.x0 + 20, seg.x1 - 34); tries++; } while (Math.abs(x - p.cx) < 60 && tries < 12);
      y = 24;
    }
    const e = new Enemy(this, type, x, y, this.tier, { active: true, arena: seg, spawn: true });
    this.enemies.push(e);
    this.parts.burst(x + e.w / 2, y + e.h / 2, 10, ['#ffffff', '#c8c8ff'], 60, 0.5, 0);
    return e;
  }

  onEnemyKilled(e, silent) {
    this.stats.kills++;
    this.score += 100 + 20 * this.tier;
    if (!silent) {
      Audio.sfx('enemyDie');
      this.parts.burst(e.cx, e.cy, 12, ['#ffffff', '#ffd84a', '#ff8a5a'], 110, 0.5);
      this.say('kill', false, 0.28);
      const r = Math.random();
      if (r < 0.06) this.drop('heart', e.cx, e.cy);
      else if (r < 0.14) this.drop('bowl', e.cx, e.cy);
      else if (r < 0.8) { this.drop('grain', e.cx - 3, e.cy); if (r < 0.4) this.drop('grain', e.cx + 3, e.cy); }
    }
  }
  drop(type, x, y) { this.pickups.push({ type, x, y, taken: false, t: 0, vy: -120, falls: true }); }

  onBossPhase(b) {
    this.drop('heart', b.cx, b.y);
    const talk = BOSS_TALK[b.key];
    if (b.ph.line && talk && talk[b.ph.line]) this.dialog([{ s: b.key === 'finalcut' ? 'finalcut' : b.key, t: talk[b.ph.line] }]);
  }
  onBossDefeated(b) {
    const seg = this.arena;
    this.score += b.def.friendly ? 2500 : seg && seg.kind === 'boss' ? 5000 : 2500;
    FX.shake(6, 0.9); FX.slow(1.0);
    Audio.sfx(b.def.friendly ? 'waveClear' : 'bossDie');
    this.projs = this.projs.filter((p) => p.owner === 'player');
    for (const e of this.enemies) if (!e.dead && e.arena) e.kill(true);
    this.warns = [];
    this.after(b.def.friendly ? 1.0 : 2.0, () => {
      if (b.def.friendly) { b.gone = true; this.npc = { key: b.key === 'finn' ? 'finnAlien' : 'craig', x: b.cx, y: b.y + b.h, f: b.facing < 0 }; }
      const talk = BOSS_TALK[b.key].outro;
      this.cutsceneLock = true;
      this.dialog(talk, () => {
        this.cutsceneLock = false;
        if (b.key === 'craig') {
          this.save.allies.craig = true; this.assistCharges = 1;
          this.addBanner('STUNT ASSIST UNLOCKED!', 'PRESS [' + Input.bindLabel('assist') + '] TO CALL CRAIG', 2.6, '#f08a40');
        }
        if (b.key === 'finn') {
          this.save.allies.finn = true; this.understudyUsed = false;
          this.addBanner('FINN JOINED THE CAST!', 'UNDERSTUDY: ONE FREE REVIVE PER SCENE', 2.6, '#c080ff');
        }
        if (this.npc) { this.parts.burst(this.npc.x, this.npc.y - 10, 16, ['#ffffff', '#ffd84a'], 80, 0.5); this.npc = null; }
        Save.store();
        if (seg && seg.kind === 'boss') { this.say('bossdown', true); this.levelComplete(); }
        else {
          if (seg) seg.state = 'done';
          this.arena = null; this.boss = null;
          this.addBanner('CUT! PRINT IT!', 'MINI-BOSS DOWN', 1.6);
          Audio.music(this.world.music);
        }
      });
    });
  }

  levelComplete() {
    this.state = 'complete';
    if (this.arena) this.arena.state = 'done';
    this.addBanner("THAT'S A WRAP!", this.world.scene + ' COMPLETE', 3.2);
    Audio.stopMusic(); Audio.sfx('victory');
    this.after(3.4, () => Flow.levelComplete(this));
  }

  callAssist() {
    if (!this.save.allies.craig) return;
    if (this.assistCharges <= 0 || this.assist) { Audio.sfx('nope'); return; }
    this.assistCharges--;
    this.assist = { x: this.cam.x - 30, y: this.arena ? GROUND * TILE : this.lastSafe.y, t: 0, hit: new Set() };
    Audio.sfx('assist'); this.say('assist', true); FX.shake(2, 0.6);
  }
  dramaticPose(x, y) {
    FX.flash('#fffbe0', 0.3); FX.shake(4, 0.3); Audio.sfx('poseBoom');
    this.parts.ring(x, y, 24, '#ffe060', 160, 0.5);
    this.parts.ring(x, y, 16, '#ffffff', 100, 0.4);
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.cx - x, e.cy - y) < 115) { e.stun(3.0); e.hurt(2, e.cx < x ? -1 : 1); }
    }
    const b = this.boss;
    if (b && !b.dead && b.state === 'fight' && Math.hypot(b.cx - x, b.cy - y) < 150) {
      b.hurt(4, b.cx < x ? -1 : 1);
      if (!b.dead && b.state === 'fight') { b.stunT = 1.4; b.atk = null; b.tele = false; b.alpha = 1; if (this.laser) this.laser = null; Audio.sfx('stun'); }
    }
    this.projs = this.projs.filter((p) => p.owner === 'player' || Math.hypot(p.x - x, p.y - y) > 120);
  }
  tryUnderstudy() {
    if (!this.save.allies.finn || this.understudyUsed) return false;
    this.understudyUsed = true;
    const p = this.player;
    p.hp = Math.min(p.maxHp, 4); p.inv = 2.2;
    this.finnCameo = 1.8;
    this.addBanner('UNDERSTUDY!', 'FINN TAKES THE FALL FOR YOU!', 1.8, '#c080ff');
    Audio.sfx('understudy'); FX.flash('#c080ff', 0.3);
    return true;
  }

  hudCenter() {
    const a = this.arena;
    if (a && a.state === 'active') {
      if (a.kind === 'wave') return 'WAVE ' + (a.wave + 1) + '/' + this.wavesTotal;
      return a.kind === 'mini' ? 'MINI-BOSS' : 'BOSS';
    }
    return this.world.scene + '  WAVES ' + this.wavesDone + '/' + this.wavesTotal;
  }

  // ---------- segments ----------
  startSegment(seg) {
    seg.state = 'active'; this.arena = seg; seg.groundY = GROUND * TILE; seg.burst = 0; seg.burstT = 1.0;
    if (seg.kind === 'wave') {
      this.addBanner('WAVE ' + (seg.wave + 1) + '/' + this.wavesTotal, 'ACTION!', 1.6);
      Audio.sfx('waveStart'); this.say('wave', true);
    } else {
      const key = seg.kind === 'mini' ? this.world.mini : this.world.boss;
      this.boss = new Boss(this, key, seg);
      this.bossBarT = 0;
      if (seg.kind === 'boss') this.say('preboss', true);
      Audio.stopMusic();
      const begin = () => {
        if (!this.boss) return;
        this.boss.state = 'fight'; this.boss.restT = 0.8;
        Audio.music(key === 'finalcut' ? 'final' : 'boss');
        Audio.sfx('bossRoar');
      };
      this.after(1.2, () => {
        if (seg.introSeen) begin();
        else { seg.introSeen = true; this.dialog(BOSS_TALK[key].intro, begin); }
      });
    }
  }
  updateArena(dt) {
    const seg = this.arena;
    if (!seg || seg.state !== 'active') return;
    const p = this.player;
    p.x = clamp(p.x, seg.x0 + 6, seg.x1 - p.w - 6);
    if (seg.kind === 'wave') {
      const alive = this.enemies.filter((e) => !e.dead && e.arena === seg).length;
      seg.burstT -= dt;
      if (seg.burst < seg.bursts.length && seg.burstT <= 0 && (alive <= 1 || seg.burstT < -8)) {
        for (const type of seg.bursts[seg.burst]) this.spawnArenaEnemy(type, seg);
        seg.burst++; seg.burstT = 1.2;
        if (seg.burst > 1) Audio.sfx('waveStart');
      }
      if (seg.burst >= seg.bursts.length && alive === 0 && seg.burstT <= 0) {
        seg.state = 'done'; this.arena = null; this.wavesDone++;
        this.score += 500;
        this.addBanner('CUT! PRINT IT!', 'WAVE CLEARED', 1.5);
        Audio.sfx('waveClear'); this.say('clear', true);
      }
    }
  }

  activateCheckpoint(cp, i) {
    cp.active = true;
    this.cp = { x: cp.x + 8, y: cp.y };
    Audio.sfx('checkpoint');
    this.addFloat('CAMERA ROLLING!', cp.x + 8, cp.y - 30, '#ff6060');
    if (!this.hintShown) { this.hintShown = true; this.aydenBubble = { text: AYDEN_HINTS[this.li], t: 3.6, x: cp.x + 8, y: cp.y - 26 }; }
    else this.say('checkpoint', false, 0.6);
    Save.store();
    void i;
  }

  retryFromCheckpoint() {
    const p = this.player;
    p.respawn(this.cp.x - p.w / 2, this.cp.y);
    if (this.arena && this.arena.state === 'active') { this.arena.state = 'pending'; this.arena.burst = 0; }
    this.arena = null; this.boss = null; this.laser = null; this.warns = []; this.projs = []; this.npc = null;
    this.enemies = this.enemies.filter((e) => !e.arena && !e.dead);
    this.textbox = null; this.state = 'play'; this.timers = []; this.assist = null; this.cutsceneLock = false;
    this.assistCharges = this.save.allies.craig ? 1 : 0;
    FX.reset();
    this.bubbleCD = 0; this.say('start', true);
    Audio.music(this.world.music);
    this.cam.x = clamp(p.cx - W / 2, 0, this.L.pxW - W);
  }

  // ---------- main update ----------
  update(dt) {
    if (this.textbox) {
      this.textbox.update(dt);
      if (this.textbox && this.textbox.done) this.textbox = null;
      this.parts.update(dt); FX.update(dt);
      return;
    }
    if (Input.pausePressed() && this.state === 'play' && !this.player.dead) { Flow.pause(this); return; }
    FX.update(dt);
    if (FX.hitStop > 0) { FX.hitStop -= dt; return; }
    const sdt = dt * (FX.slowT > 0 ? 0.4 : 1);
    this.t += sdt;
    if (this.state === 'play') this.stats.time += dt;
    for (let i = this.timers.length - 1; i >= 0; i--) { const tm = this.timers[i]; tm.t -= dt; if (tm.t <= 0) { this.timers.splice(i, 1); tm.fn(); if (this.textbox) return; } }

    const p = this.player, L = this.L;
    if (this.state === 'complete') p.frozen = true;
    p.update(sdt);

    // falling into a pit
    if (!p.dead && p.y > L.pxH + 8) {
      p.hp -= 2; this.stats.damage += 2;
      Audio.sfx('hurt'); FX.shake(3, 0.2);
      if (p.hp <= 0 && !this.tryUnderstudy()) { p.hp = 0; p.dead = true; p.deathT = 0.8; p.vy = 0; }
      else { p.x = this.lastSafe.x; p.y = this.lastSafe.y - p.h; p.vx = p.vy = 0; p.inv = 1.4; this.say('hurt', true); }
    }
    if (!p.dead && p.onGround && !p.dashT) {
      const fl = floorAt(L, p.x - 6, p.y + p.h + 2) && floorAt(L, p.x + p.w + 6, p.y + p.h + 2);
      const tile = L.get(Math.floor(p.cx / TILE), Math.floor((p.y + p.h + 2) / TILE));
      if (fl && isSolidT(tile)) this.lastSafe = { x: p.x, y: p.y + p.h };
    }

    // segments
    const next = this.segments.find((s) => s.state === 'pending');
    if (next && !this.arena && p.x > next.x0 + 20 && !p.dead) this.startSegment(next);
    this.updateArena(sdt);

    // checkpoints (Ayden: "Camera Rolling")
    this.checkpoints.forEach((cp, i) => { if (!cp.active && Math.abs(p.cx - (cp.x + 8)) < 16 && p.y + p.h > cp.y - 40) this.activateCheckpoint(cp, i); });

    // enemies
    const camL = this.cam.x - 60, camR = this.cam.x + W + 60;
    for (const e of this.enemies) {
      if (!e.active && e.x > camL && e.x < camR) e.active = true;
      if (e.active) e.update(sdt);
    }
    this.enemies = this.enemies.filter((e) => !(e.dead && e.deathT > 0.5));
    if (this.boss) {
      this.boss.update(sdt);
      if (this.boss && this.boss.state !== 'enter') this.bossBarT = Math.min(1, this.bossBarT + dt * 2);
    }

    this.updateProjs(sdt);
    this.updatePickups(sdt);
    this.updateSecrets(sdt);
    this.updateAssist(sdt);

    // melee deflects enemy projectiles
    if (p.atkT > 0 && p.atkT < 0.2) {
      const hb = p.meleeBox();
      for (const pr of this.projs) {
        if (pr.owner !== 'enemy' || pr.ground || pr.dead) continue;
        if (overlap(hb, { x: pr.x - pr.w / 2, y: pr.y - pr.h / 2, w: pr.w, h: pr.h })) { pr.dead = true; this.parts.burst(pr.x, pr.y, 6, '#ffffff', 80, 0.3); this.score += 5; }
      }
    }

    // timers / fx
    for (const f of this.floats) { f.t -= dt; f.y -= 20 * dt; }
    this.floats = this.floats.filter((f) => f.t > 0);
    for (const w of this.warns) w.t -= dt;
    this.warns = this.warns.filter((w) => w.t > 0);
    if (this.banners.length) { this.banners[0].t -= dt; if (this.banners[0].t <= 0) this.banners.shift(); }
    if (this.bubble) { this.bubble.t -= dt; if (this.bubble.t <= 0) this.bubble = null; }
    if (this.bubbleCD > 0) this.bubbleCD -= dt;
    if (this.sebBubble) { this.sebBubble.t -= dt; if (this.sebBubble.t <= 0) this.sebBubble = null; }
    if (this.aydenBubble) { this.aydenBubble.t -= dt; if (this.aydenBubble.t <= 0) this.aydenBubble = null; }
    if (this.spotlightT > 0) this.spotlightT -= dt;
    if (this.finnCameo > 0) this.finnCameo -= dt;
    this.parts.update(sdt);

    // camera
    let tx = p.cx - W / 2 + p.facing * 24;
    let minX = 0, maxX = L.pxW - W;
    if (this.arena && this.arena.state === 'active') minX = maxX = this.arena.x0;
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 5);
    this.cam.x = clamp(this.cam.x, minX, maxX);

    if (p.dead && p.deathT > 1.4 && this.state === 'play') { this.state = 'dead'; Audio.stopMusic(); Audio.sfx('gameover'); Flow.gameOver(this); }
  }

  updateProjs(dt) {
    const L = this.L, p = this.player;
    for (const pr of this.projs) {
      if (pr.dead) continue;
      pr.t += dt; pr.life -= dt;
      pr.vy += pr.g * dt;
      pr.x += pr.vx * dt; pr.y += pr.vy * dt;
      const tx = Math.floor(pr.x / TILE), ty = Math.floor(pr.y / TILE), tile = L.get(tx, ty);
      if (pr.ground) {
        if (isSolidT(L.get(Math.floor((pr.x + Math.sign(pr.vx) * 6) / TILE), ty)) || !floorAt(L, pr.x, pr.y + 8)) pr.dead = true;
      } else if (isSolidT(tile) && pr.y > 0) {
        if (pr.breaks && tile === T_BREAK) this.breakTile(tx, ty);
        pr.dead = true;
        this.parts.burst(pr.x, pr.y, 5, '#d8d8d8', 50, 0.25);
      } else if (pr.g > 0 && (tile === T_PLAT) && pr.vy > 0 && pr.owner === 'enemy' && pr.explode) pr.dead = true;
      const box = { x: pr.x - pr.w / 2, y: pr.y - pr.h / 2, w: pr.w, h: pr.h };
      if (pr.owner === 'player') {
        for (const t of this.hittables()) if (overlap(box, t)) { if (t.hurt(pr.dmg, Math.sign(pr.vx) || 1, 'reel')) p.special = Math.min(100, p.special + 4); pr.dead = true; break; }
      } else if (!p.dead && overlap(box, p)) { if (p.hurt(pr.dmg, pr.x)) pr.dead = true; }
      if (pr.life <= 0) pr.dead = true;
      if (pr.dead && pr.explode) this.explode(pr.x, pr.y, pr.dmg);
    }
    this.projs = this.projs.filter((pr) => !pr.dead);
  }
  explode(x, y, dmg) {
    Audio.sfx('explode'); FX.shake(3, 0.25);
    this.parts.burst(x, y, 18, ['#ffd84a', '#ff6a3a', '#ffffff', '#3a3a3a'], 140, 0.6);
    const p = this.player;
    if (Math.hypot(p.cx - x, p.cy - y) < 26) p.hurt(dmg, x);
  }

  updatePickups(dt) {
    const p = this.player, L = this.L, s = this.save;
    for (const k of this.pickups) {
      if (k.taken) continue;
      k.t += dt;
      if (k.falls) {
        k.vy = Math.min(260, k.vy + 500 * dt); k.y += k.vy * dt;
        if (k.vy > 0 && floorAt(L, k.x, k.y + 4)) { k.y = Math.floor((k.y + 4) / TILE) * TILE - 4; k.vy = 0; k.falls = false; }
        if (k.y > L.pxH + 20) { k.taken = true; continue; }
      }
      const r = k.type === 'cooker' ? 9 : 7;
      if (p.dead || !overlap({ x: k.x - r, y: k.y - r, w: r * 2, h: r * 2 }, p)) continue;
      k.taken = true;
      if (k.type === 'grain') { s.rice += 1; this.stats.rice += 1; this.score += 10; Audio.sfx('rice'); this.say('rice', false, 0.08); this.parts.burst(k.x, k.y, 3, '#fffbe8', 30, 0.25, 0); }
      else if (k.type === 'bowl') { s.rice += 10; this.stats.rice += 10; s.bowlsTotal++; this.score += 100; Audio.sfx('bowl'); this.say('bowl', false, 0.6); this.addFloat('+10 RICE', k.x, k.y - 6, '#fffbe8'); this.checkAch(); }
      else if (k.type === 'heart') { p.hp = Math.min(p.maxHp, p.hp + 2); Audio.sfx('heart'); this.say('heart', false, 0.6); this.addFloat('+1 HEART', k.x, k.y - 6, '#ff8a9a'); }
      else if (k.type === 'cooker') {
        s.rice += 50; this.stats.rice += 50; this.score += 1000; s.cookers[this.li] = true; this.stats.cooker = true;
        Audio.sfx('cooker'); this.say('cooker', true); FX.flash('#ffe060', 0.25);
        this.addBanner('GOLDEN RICE COOKER!', '+50 RICE  (' + s.cookers.filter(Boolean).length + '/6 FOUND)', 2.2);
        this.parts.ring(k.x, k.y, 20, '#ffe060', 90, 0.6);
        this.checkAch(); Save.store();
      }
    }
    if (this.pickups.length > 200) this.pickups = this.pickups.filter((k) => !k.taken);
  }

  updateSecrets(dt) {
    const S = this.lv.secrets.sebastian, p = this.player, s = this.save;
    if (S && !this.sebFound && !p.dead && Math.abs(p.cx - S.x) < 16 && Math.abs(p.y + p.h - S.y) < 20) {
      this.sebFound = true; this.stats.seb = true;
      const first = !s.sebastian[this.li];
      s.sebastian[this.li] = true;
      Audio.sfx('secret'); this.score += 777;
      this.sebBubble = { text: SEB_LINES[this.li], t: 4.2 };
      this.addFloat('SEBASTIAN FOUND ' + s.sebastian.filter(Boolean).length + '/6', S.x, S.y - 34, '#8aa0c8');
      if (first && s.sebastian.every(Boolean) && !s.goldClapper) {
        s.goldClapper = true;
        this.after(4.4, () => this.dialog([{ s: 'sebastian', t: SEB_ALL }], () => { Toasts.add('BONUS: GOLDEN CLAPPERBOARD (+1 DAMAGE)'); }));
      }
      this.checkAch(); Save.store();
    }
    void dt;
  }
  checkAch() {
    const s = this.save, A = s.achievements;
    const award = (id, name) => { if (!A[id]) { A[id] = true; Toasts.add('ACHIEVEMENT: ' + name); Audio.sfx('secret'); Save.store(); } };
    if (s.cookers.every(Boolean)) award('cookers', 'MASTER CHEF OF CINEMA');
    if (s.bowlsTotal >= 50) award('bowls', 'BOWLED OVER (50 RICE BOWLS)');
    if (s.sebastian.every(Boolean)) award('seb', "WHERE'S SEBASTIAN?");
  }

  updateAssist(dt) {
    const a = this.assist;
    if (!a) return;
    a.t += dt; a.x += 430 * dt;
    const box = { x: a.x - 6, y: 0, w: 22, h: this.L.pxH };
    for (const e of this.enemies) if (!e.dead && !a.hit.has(e) && overlap(box, e)) { a.hit.add(e); e.hurt(9, 1); FX.shake(2, 0.1); }
    const b = this.boss;
    if (b && !b.dead && !a.hit.has(b) && overlap(box, b)) { a.hit.add(b); b.hurt(7, 1); }
    if (Math.random() < 0.7) this.parts.add({ x: a.x, y: a.y - 2, vx: -60, vy: -30, life: 0.4, c: '#e8d8b0' });
    if (a.x > this.cam.x + W + 40) this.assist = null;
  }

  // ---------- render ----------
  render(c) {
    const [sx, sy] = FX.offset();
    const camX = Math.round(this.cam.x), cx = camX - sx, cy = 12 - sy;
    drawBG(c, this.li, camX);
    this.drawTiles(c, cx, cy);
    this.drawDecor(c, cx, cy);
    // checkpoints: Ayden with his camera
    for (const cp of this.checkpoints) {
      const x = cp.x + 8 - cx;
      if (x < -30 || x > W + 30) continue;
      drawSprite(c, cp.active ? SPR.aydenRecOn : SPR.ayden['idle' + (Math.floor(this.t * 2) % 2)], x, cp.y - cy, true);
      if (cp.active && Math.floor(this.t * 2) % 2) drawText(c, 'REC', x - 6, cp.y - cy - 34, { col: '#ff4040' });
    }
    // pickups
    for (const k of this.pickups) {
      if (k.taken) continue;
      const x = k.x - cx, y = k.y - cy + (k.falls ? 0 : Math.round(Math.sin(k.t * 3) * 1.5));
      if (x < -16 || x > W + 16) continue;
      const fr = k.type === 'cooker' ? SPR.cooker[Math.floor(k.t * 2) % 2] : SPR[k.type][0];
      drawSprite(c, fr, x, y);
      if (k.type === 'cooker' && Math.floor(k.t * 6) % 4 === 0) { c.fillStyle = '#fff'; c.fillRect(Math.round(x + rand(-7, 7)), Math.round(y + rand(-7, 7)), 1, 1); }
    }
    this.drawSebastian(c, cx, cy);
    for (const e of this.enemies) if (e.x > cx - 40 && e.x < cx + W + 40) e.draw(c, cx, cy);
    if (this.boss) this.boss.draw(c, cx, cy);
    if (this.npc) drawSprite(c, SPR[this.npc.key]['idle' + (Math.floor(this.t * 2) % 2)], this.npc.x - cx, this.npc.y - cy, this.npc.f);
    if (this.finnCameo > 0) drawSprite(c, SPR.finn.pose, this.player.cx - 16 - cx, this.player.y + this.player.h - cy, false, false, Math.min(1, this.finnCameo));
    this.player.draw(c, cx, cy);
    if (this.assist) drawSprite(c, SPR.craig['run' + (Math.floor(this.assist.t * 16) % 4)], this.assist.x - cx, this.assist.y - cy);
    for (const pr of this.projs) {
      const set = SPR[pr.spr]; if (!set) continue;
      const fr = set[pr.anim ? Math.floor(pr.t * pr.anim) % set.length : 0];
      drawSprite(c, fr, pr.x - cx, pr.y - cy + (pr.spr === 'shock' ? 0 : 0), pr.rot ? pr.vx < 0 : pr.vx < 0 && pr.spr !== 'star');
    }
    // laser
    if (this.laser) {
      const L = this.laser, y0 = L.y0 - cy, y1 = L.y1 - cy, x0 = L.x0 - cx, x1 = L.x1 - cx;
      if (!L.live) { if (Math.floor(L.t * 16) % 2) { c.fillStyle = '#ff3a3a'; c.fillRect(x0, Math.round((y0 + y1) / 2), x1 - x0, 1); } c.globalAlpha = 0.15; c.fillStyle = '#ff3a3a'; c.fillRect(x0, y0, x1 - x0, y1 - y0); c.globalAlpha = 1; }
      else { c.fillStyle = '#ff2a2a'; c.fillRect(x0, y0, x1 - x0, y1 - y0); c.fillStyle = '#ffd0d0'; c.fillRect(x0, y0 + 2, x1 - x0, Math.max(1, y1 - y0 - 4)); }
    }
    for (const w of this.warns) {
      const x = Math.round(w.x - cx);
      c.globalAlpha = 0.25; c.fillStyle = '#ff3a3a'; c.fillRect(x - 4, 0, 8, H); c.globalAlpha = 1;
      if (Math.floor(w.t * 10) % 2) drawText(c, '!', x, 26, { col: '#ff3a3a', align: 'center', scale: 2 });
    }
    // arena barriers (film strip)
    if (this.arena && this.arena.state === 'active') for (const bx of [this.arena.x0, this.arena.x1 - 6]) {
      const x = Math.round(bx - cx);
      c.fillStyle = '#111'; c.fillRect(x, 0, 6, H);
      c.fillStyle = '#e8e8e8';
      for (let y = (Math.floor(this.t * 40) % 8) - 8; y < H; y += 8) { c.fillRect(x + 1, y, 1, 3); c.fillRect(x + 4, y, 1, 3); }
    }
    this.parts.draw(c, cx, cy);
    for (const f of this.floats) drawText(c, f.text, f.x - cx, f.y - cy, { col: f.col, align: 'center', outline: true });
    // Dramatic Pose spotlight
    if (this.spotlightT > 0 && spotX) {
      spotX.globalCompositeOperation = 'source-over'; spotX.clearRect(0, 0, W, H);
      spotX.fillStyle = 'rgba(0,0,0,0.72)'; spotX.fillRect(0, 0, W, H);
      spotX.globalCompositeOperation = 'destination-out';
      const px = this.player.cx - cx, py = this.player.cy - cy;
      spotX.beginPath(); spotX.moveTo(px - 8, 0); spotX.lineTo(px + 8, 0); spotX.lineTo(px + 24, py + 14); spotX.lineTo(px - 24, py + 14); spotX.fill();
      spotX.beginPath(); spotX.ellipse(px, py + 10, 26, 8, 0, 0, 7); spotX.fill();
      c.drawImage(spotC, 0, 0);
    }
    // bubbles
    const p = this.player;
    if (this.textbox) { drawHUD(c, this); FX.drawFlash(c); this.textbox.render(c); return; }
    if (this.bubble && !p.dead) drawBubble(c, this.bubble.text, p.cx - cx, p.y - cy - 2, Math.min(1, this.bubble.t * 3));
    if (this.aydenBubble) drawBubble(c, this.aydenBubble.text, this.aydenBubble.x - cx, this.aydenBubble.y - cy, Math.min(1, this.aydenBubble.t * 3));
    if (this.sebBubble && this.lv.secrets.sebastian) { const S = this.lv.secrets.sebastian; drawBubble(c, this.sebBubble.text, S.x - cx, S.y - cy - 24, Math.min(1, this.sebBubble.t * 3)); }
    drawHUD(c, this);
    if (this.banners.length) { const b = this.banners[0]; banner(c, b.text, b.sub, b.t, b.col); }
    FX.drawFlash(c);
    if (this.textbox) this.textbox.render(c);
  }

  drawTiles(c, cx, cy) {
    const L = this.L, ts = TILESETS[this.li];
    const tx0 = Math.max(0, Math.floor(cx / TILE)), tx1 = Math.min(L.cols - 1, tx0 + 21);
    for (let ty = 0; ty < L.rows; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const t = L.get(tx, ty);
      if (!t) continue;
      let src;
      if (t === T_SOLID) { const up = L.get(tx, ty - 1); src = up === T_SOLID || up === T_BREAK ? 0 : 1; }
      else if (t === T_PLAT) src = 2; else src = 3;
      c.drawImage(ts, src * 16, 0, 16, 16, tx * TILE - cx, ty * TILE - cy, 16, 16);
    }
  }
  drawDecor(c, cx, cy) {
    const R = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h); };
    for (const d of this.lv.decor) {
      const x = d.x - cx, y = d.y - cy;
      if (x < -30 || x > W + 30) continue;
      switch (this.li) {
        case 0: if (d.v === 0) { R(x - 5, y - 10, 10, 2, '#7a4a22'); R(x - 5, y - 8, 2, 8, '#5a3a1a'); R(x + 3, y - 8, 2, 8, '#5a3a1a'); R(x - 5, y - 18, 2, 8, '#5a3a1a'); } else { R(x, y - 20, 1, 20, '#333'); R(x - 5, y - 22, 11, 6, '#222'); R(x - 4, y - 21, 9, 4, '#f8f8f0'); } break;
        case 1: if (d.v === 0) { R(x - 7, y - 12, 14, 12, '#a07040'); R(x - 7, y - 12, 14, 1, '#c09060'); R(x - 1, y - 12, 2, 12, '#7a5030'); } else { R(x - 3, y - 12, 6, 12, '#e86a2a'); R(x - 2, y - 9, 4, 2, '#fff'); R(x - 5, y - 1, 10, 1, '#c84a1a'); } break;
        case 2: R(x - 5, y - 12, 10, 12, '#5a5a6a'); R(x - 4, y - 14, 8, 2, '#5a5a6a'); R(x - 1, y - 10, 2, 6, '#3a3a4a'); R(x - 3, y - 8, 6, 2, '#3a3a4a'); break;
        case 3: R(x - 7, y - 14, 14, 14, '#3a4660'); R(x - 5, y - 12, 10, 5, '#0a2030'); R(x - 4, y - 11, 2, 2, Math.floor(this.t * 3 + d.x) % 2 ? '#4ef' : '#f44'); break;
        case 4: if (d.v === 0) { R(x - 5, y - 12, 10, 12, '#7a4a22'); R(x - 5, y - 9, 10, 1, '#4a2a12'); R(x - 5, y - 4, 10, 1, '#4a2a12'); } else { R(x - 2, y - 16, 4, 16, '#3a8a3a'); R(x - 6, y - 12, 4, 3, '#3a8a3a'); R(x - 6, y - 15, 2, 4, '#3a8a3a'); } break;
        default: R(x - 1, y - 18, 3, 18, '#e8c040'); R(x - 3, y - 19, 7, 2, '#ffe880'); R(x - 4, y - 1, 9, 1, '#9a7a20'); break;
      }
    }
  }
  drawSebastian(c, cx, cy) {
    const S = this.lv.secrets.sebastian;
    if (!S) return;
    const x = S.x - cx, y = S.y - cy;
    if (x < -40 || x > W + 40) return;
    drawSprite(c, SPR.sebastian['idle' + (Math.floor(this.t * 1.5) % 2)], x, y, true);
    // he's half-hidden behind a scenery flat until found
    if (!this.sebFound) {
      const pal = WPAL[this.li];
      c.fillStyle = '#000'; c.fillRect(Math.round(x - 16), Math.round(y - 15), 26, 15);
      c.fillStyle = pal.plat; c.fillRect(Math.round(x - 15), Math.round(y - 14), 24, 14);
      c.fillStyle = pal.platD; c.fillRect(Math.round(x - 15), Math.round(y - 9), 24, 1);
    }
  }
}
