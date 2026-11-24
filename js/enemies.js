// enemies.js - film-set enemies. Four behaviours (walker/charger, hopper/roller, thrower/shooter, flyer); tiers scale stats + patterns.
import { moveBody, FX, approach, clamp, chance, rand, overlap, floorAt } from './engine.js';
import { SPR, drawSprite } from './sprites.js';
import { Audio } from './audio.js';

export const ENEMY_DEFS = {
  // World 1 - School Drama Hall
  critic: { name: 'ANGRY CRITIC', beh: 'walker', spr: 'critic', hp: 3, spd: 28, w: 10, h: 18 },
  chair: { name: 'RUNAWAY PROP CHAIR', beh: 'hopper', spr: 'chair', hp: 2, spd: 55, w: 12, h: 12 },
  tomato: { name: 'TOMATO CRITIC', beh: 'thrower', spr: 'tomatoCritic', hp: 3, spd: 22, w: 10, h: 18, proj: 'tomato', arc: true },
  // World 2 - Backlot Street
  stagehand: { name: 'ROGUE STAGEHAND', beh: 'walker', charge: true, spr: 'stagehand', hp: 4, spd: 32, w: 10, h: 18 },
  trashcan: { name: 'RUNAWAY TRASH CAN', beh: 'hopper', spr: 'trashcan', hp: 4, spd: 50, w: 11, h: 13 },
  sandbagger: { name: 'SANDBAG STAGEHAND', beh: 'thrower', spr: 'sandbagger', hp: 4, spd: 22, w: 10, h: 18, proj: 'sandbag', arc: true },
  boommic: { name: 'RUNAWAY BOOM MIC', beh: 'flyer', spr: 'boommic', hp: 3, spd: 40, w: 14, h: 8 },
  // World 3 - Haunted Horror Set
  zombie: { name: 'ZOMBIE EXTRA', beh: 'walker', spr: 'zombie', hp: 5, spd: 26, w: 10, h: 18 },
  pumpkin: { name: 'PROP PUMPKIN', beh: 'hopper', spr: 'pumpkin', hp: 4, spd: 55, w: 11, h: 11 },
  skeleton: { name: 'PROP SKELETON', beh: 'thrower', spr: 'skeleton', hp: 4, spd: 24, w: 10, h: 19, proj: 'bone', arc: true },
  costume: { name: 'HAUNTED COSTUME', beh: 'flyer', spr: 'costume', hp: 4, spd: 40, w: 12, h: 14 },
  // World 4 - Sci-Fi Spaceship
  robot: { name: 'MALFUNCTIONING ROBOT', beh: 'walker', charge: true, spr: 'robot', hp: 6, spd: 28, w: 12, h: 16 },
  goo: { name: 'PROP GOO', beh: 'hopper', spr: 'goo', hp: 5, spd: 60, w: 12, h: 9 },
  laserbot: { name: 'LASER TURRET', beh: 'thrower', spr: 'laserbot', hp: 5, spd: 18, w: 12, h: 13, proj: 'laser', arc: false },
  drone: { name: 'CAMERA DRONE', beh: 'flyer', spr: 'drone', hp: 4, spd: 45, w: 14, h: 7 },
  // World 5 - Western Stunt Set
  bandit: { name: 'TUMBLEWEED BANDIT', beh: 'walker', charge: true, spr: 'bandit', hp: 6, spd: 34, w: 10, h: 18 },
  tumbleweed: { name: 'TUMBLEWEED', beh: 'hopper', roll: true, spr: 'tumbleweed', hp: 5, spd: 70, w: 12, h: 12 },
  dynamite: { name: 'DYNAMITE BANDIT', beh: 'thrower', spr: 'dynamiteBandit', hp: 6, spd: 24, w: 10, h: 18, proj: 'dynamite', arc: true },
  vulture: { name: 'PROP VULTURE', beh: 'flyer', spr: 'vulture', hp: 5, spd: 48, w: 16, h: 10 },
  // World 6 - Premiere
  paparazzi: { name: 'PAPARAZZI', beh: 'walker', charge: true, spr: 'paparazzi', hp: 7, spd: 36, w: 10, h: 18 },
  statue: { name: 'RUNAWAY AWARD', beh: 'hopper', spr: 'statue', hp: 6, spd: 60, w: 9, h: 15 },
  flasher: { name: 'FLASH PHOTOGRAPHER', beh: 'thrower', spr: 'flasher', hp: 7, spd: 24, w: 10, h: 18, proj: 'flash', arc: false },
  papdrone: { name: 'PAPARAZZI DRONE', beh: 'flyer', spr: 'papdrone', hp: 6, spd: 50, w: 14, h: 9 },
};

export class Enemy {
  constructor(game, type, x, y, tier, opts = {}) {
    const d = ENEMY_DEFS[type];
    this.def = d; this.type = type; this.g = game; this.tier = tier;
    this.w = d.w; this.h = d.h; this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    const ng = game.save.ngPlus || 0;
    this.maxHp = this.hp = Math.round(d.hp * (1 + 0.35 * (tier - 1)) * (1 + 0.5 * ng));
    this.spd = d.spd * (1 + 0.07 * (tier - 1));
    this.dmg = (tier >= 4 ? 2 : 1) + (ng > 0 && tier >= 4 ? 1 : 0);
    this.facing = -1; this.t = Math.random() * 3; this.cool = rand(0.8, 2.0);
    this.state = 'move'; this.stateT = 0; this.flashT = 0; this.stunT = 0; this.throwT = 0;
    this.kbT = 0; this.kbV = 0; this.dead = false; this.deathT = 0;
    this.active = !!opts.active; this.arena = opts.arena || null; this.spawnT = opts.spawn ? 0.55 : 0;
    this.fly = d.beh === 'flyer'; this.onGround = false;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  edgeAhead(dir = this.facing) {
    if (!this.onGround) return false;
    const fx = dir > 0 ? this.x + this.w + 2 : this.x - 2;
    return !floorAt(this.g.L, fx, this.y + this.h + 4);
  }

  update(dt) {
    const g = this.g, p = g.player, d = this.def;
    this.t += dt;
    if (this.dead) { this.deathT += dt; this.vy += 500 * dt; this.y += this.vy * dt; this.x += this.vx * dt; return; }
    if (this.flashT > 0) this.flashT -= dt;
    if (this.throwT > 0) this.throwT -= dt;
    if (this.spawnT > 0) {
      this.spawnT -= dt;
      if (!this.fly) { this.vy = Math.min(300, this.vy + 900 * dt); moveBody(this, g.L, dt); }
      return;
    }
    if (this.stunT > 0) {
      this.stunT -= dt;
      this.vx = approach(this.vx, 0, 300 * dt);
      if (!this.fly) { this.vy = Math.min(300, this.vy + 900 * dt); moveBody(this, g.L, dt); }
      else { this.vy = approach(this.vy, 20, 100 * dt); this.y += this.vy * dt; this.x += this.vx * dt; this.keepAboveGround(dt); }
      return;
    }
    const dx = p.cx - this.cx, adx = Math.abs(dx), dy = p.cy - this.cy;
    const toward = Math.sign(dx) || 1;

    if (d.beh === 'walker') {
      const chase = adx < 170 && Math.abs(dy) < 60 && !p.dead;
      if (this.state === 'tele') { this.vx = 0; this.stateT -= dt; if (this.stateT <= 0) { this.state = 'charge'; this.stateT = 0.7; Audio.sfx('charge'); } }
      else if (this.state === 'charge') {
        this.vx = this.facing * this.spd * 3.2; this.stateT -= dt;
        if (this.stateT <= 0 || this.hitWall || this.edgeAhead()) { this.state = 'move'; this.cool = rand(1.4, 2.4); this.vx = 0; }
      } else {
        if (chase) this.facing = toward;
        else if (this.hitWall || this.edgeAhead()) this.facing *= -1;
        this.vx = chase && this.edgeAhead() ? 0 : this.facing * this.spd * (chase ? 1.15 : 0.7);
        this.cool -= dt;
        if (d.charge && chase && adx < 115 && Math.abs(dy) < 24 && this.cool <= 0 && this.onGround) { this.state = 'tele'; this.stateT = 0.42; }
        else if (this.tier >= 3 && chase && this.onGround && this.cool <= 0 && adx < 80) { this.vy = -250; this.cool = rand(1.2, 2); }
      }
      if (this.kbT > 0) { this.kbT -= dt; this.vx = this.kbV; }
      this.vy = Math.min(330, this.vy + 900 * dt);
      moveBody(this, g.L, dt);
    } else if (d.beh === 'hopper') {
      if (d.roll) {
        if (adx < 220) this.facing = this.onGround ? toward : this.facing;
        this.vx = approach(this.vx, this.facing * this.spd, 200 * dt);
        if (this.onGround) this.vy = -rand(110, 190);
        if (this.hitWall) this.facing *= -1;
      } else if (this.onGround) {
        this.vx = approach(this.vx, 0, 600 * dt);
        this.cool -= dt;
        if (this.cool <= 0) {
          this.facing = toward;
          this.vx = this.facing * this.spd * (adx < 200 ? 1 : 0.5);
          this.vy = -rand(200, 255);
          this.cool = Math.max(0.55, 1.35 - 0.12 * this.tier) + rand(0, 0.3);
        }
      }
      if (this.kbT > 0) { this.kbT -= dt; this.vx = this.kbV; }
      this.vy = Math.min(330, this.vy + 900 * dt);
      moveBody(this, g.L, dt);
    } else if (d.beh === 'thrower') {
      this.facing = toward;
      let want = 0;
      if (adx < 70) want = -toward; else if (adx > 150) want = toward;
      if (want && this.edgeAhead(want)) want = 0;
      this.vx = approach(this.vx, want * this.spd, 300 * dt);
      this.cool -= dt;
      if (this.cool <= 0 && adx < 230 && !p.dead) {
        this.throwT = 0.3;
        this.cool = Math.max(1.1, 2.6 - 0.22 * this.tier) + rand(0, 0.6);
        this.fire();
      }
      if (this.kbT > 0) { this.kbT -= dt; this.vx = this.kbV; }
      this.vy = Math.min(330, this.vy + 900 * dt);
      moveBody(this, g.L, dt);
    } else { // flyer
      const sp = this.spd;
      if (this.state === 'swoop') {
        this.stateT -= dt;
        const ddx = this.tx - this.cx, ddy = this.ty - this.cy, dd = Math.hypot(ddx, ddy) || 1;
        const v = 150 + 12 * this.tier;
        this.vx = (ddx / dd) * v; this.vy = (ddy / dd) * v;
        if (dd < 6 || this.stateT <= 0) { this.state = 'rise'; this.stateT = 1.2; }
      } else if (this.state === 'rise') {
        this.stateT -= dt;
        this.vy = approach(this.vy, -80, 300 * dt); this.vx = approach(this.vx, 0, 200 * dt);
        if (this.cy < p.y - 30 || this.stateT <= 0) this.state = 'move';
      } else {
        const tx = p.cx + Math.sin(this.t * 0.8) * 60, ty = p.y - 44 + Math.sin(this.t * 2) * 8;
        this.vx = approach(this.vx, clamp((tx - this.cx) * 1.2, -sp, sp), 160 * dt);
        this.vy = approach(this.vy, clamp((ty - this.cy) * 1.5, -sp, sp), 160 * dt);
        this.cool -= dt;
        if (this.cool <= 0 && adx < 150 && !p.dead) {
          this.state = 'swoop'; this.tx = p.cx; this.ty = p.cy; this.stateT = 1.0;
          this.cool = Math.max(1.6, 3.4 - 0.3 * this.tier) + rand(0, 0.8);
          this.flashT = 0.08;
        }
      }
      this.facing = this.vx >= 0 ? 1 : -1;
      if (this.kbT > 0) { this.kbT -= dt; this.vx = this.kbV; }
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.y = Math.max(20, this.y);
      this.keepAboveGround(dt);
    }

    if (this.arena) this.x = clamp(this.x, this.arena.x0 + 2, this.arena.x1 - this.w - 2);
    if (this.y > g.L.pxH + 30) this.kill(true);
    if (!p.dead && overlap(this, p)) p.hurt(this.dmg, this.cx);
  }

  keepAboveGround(dt) {
    const L = this.g.L;
    if (floorAt(L, this.cx, this.y + this.h) || floorAt(L, this.cx, this.y + this.h - 6)) { this.y -= 90 * dt; if (this.vy > 0) this.vy = 0; }
  }

  fire() {
    const g = this.g, p = g.player, d = this.def;
    const sx = this.cx + this.facing * 6, sy = this.y + 5;
    const spreads = this.tier >= 4 ? [-1, 0, 1] : this.tier >= 3 ? [0, 1] : [0];
    if (d.arc) {
      const T = 0.85;
      for (const s of spreads) {
        const vx = clamp((p.cx - sx) / T + s * 28, -210, 210), vy = (p.cy - sy) / T - 0.5 * 600 * T;
        g.addProj({ owner: 'enemy', spr: d.proj, x: sx, y: sy, vx, vy, g: 600, w: 6, h: 6, dmg: this.dmg, life: 3, anim: 10, explode: d.proj === 'dynamite' });
      }
    } else {
      const a = Math.atan2(p.cy - sy, p.cx - sx), v = 130 + 10 * this.tier;
      for (const s of spreads) {
        const an = a + s * 0.22;
        g.addProj({ owner: 'enemy', spr: d.proj, x: sx, y: sy, vx: Math.cos(an) * v, vy: Math.sin(an) * v, w: 6, h: 4, dmg: this.dmg, life: 2.5, rot: true });
      }
    }
    Audio.sfx(d.proj === 'flash' ? 'flash' : 'shoot');
  }

  hurt(dmg, dir) {
    if (this.dead || this.spawnT > 0) return false;
    const g = this.g;
    this.hp -= dmg; this.flashT = 0.12;
    if (!this.fly) { this.kbT = 0.12; this.kbV = dir * 110; this.vy = Math.min(this.vy, -70); }
    else { this.kbT = 0.1; this.kbV = dir * 120; }
    if (this.state === 'tele' || this.state === 'swoop') { this.state = this.fly ? 'rise' : 'move'; this.stateT = 0.8; }
    g.parts.burst(this.cx, this.cy, 5, ['#ffffff', '#ffd84a'], 70, 0.3);
    g.addFloat(String(dmg), this.cx, this.y - 2, '#ffffff');
    Audio.sfx('hit'); FX.stop(0.035);
    if (this.hp <= 0) this.kill();
    return true;
  }
  stun(t) { if (!this.dead) { this.stunT = t; this.state = this.fly ? 'move' : 'move'; } }
  kill(silent = false) {
    if (this.dead) return;
    this.dead = true; this.deathT = 0; this.vy = silent ? 0 : -170; this.vx = this.kbV ? Math.sign(this.kbV) * 60 : 0;
    this.g.onEnemyKilled(this, silent);
  }

  draw(c, cx, cy) {
    const S = SPR[this.def.spr];
    let fr;
    if (S.idle0) {
      if (this.dead || this.flashT > 0) fr = S.hurt;
      else if (this.stunT > 0) fr = S.idle0;
      else if (this.throwT > 0) fr = S.throw;
      else if (this.state === 'tele') fr = S.atk0 || S.idle1;
      else if (!this.onGround) fr = S.jump;
      else if (Math.abs(this.vx) > 5) fr = S['run' + (Math.floor(this.t * (this.state === 'charge' ? 16 : 9)) % 4)];
      else fr = S['idle' + (Math.floor(this.t * 2) % 2)];
    } else if (this.def.beh === 'hopper' && !this.def.roll) fr = S[this.onGround ? 0 : 1];
    else fr = S[Math.floor(this.t * (this.fly ? 8 : 6)) % S.length];
    let alpha = 1;
    if (this.dead) alpha = 1 - this.deathT / 0.5;
    if (this.spawnT > 0) alpha = Math.floor(this.spawnT * 20) % 2 ? 0.3 : 0.9;
    const white = this.flashT > 0 || (this.dead && this.deathT < 0.12);
    const ox = this.state === 'tele' ? Math.round(Math.random() * 2 - 1) : 0;
    drawSprite(c, fr, this.cx - cx + ox, this.y + this.h - cy, this.facing < 0, white, alpha);
    if (this.stunT > 0 && !this.dead) {
      for (let i = 0; i < 3; i++) {
        const a = this.t * 6 + i * 2.1;
        c.fillStyle = i % 2 ? '#ffe060' : '#ffffff';
        c.fillRect(Math.round(this.cx - cx + Math.cos(a) * 6), Math.round(this.y - cy - 4 + Math.sin(a) * 2), 2, 2);
      }
    }
    if (this.state === 'tele' && !this.dead) { c.fillStyle = '#ff3a3a'; c.fillRect(Math.round(this.cx - cx), Math.round(this.y - cy - 9), 2, 5); c.fillRect(Math.round(this.cx - cx), Math.round(this.y - cy - 3), 2, 1); }
  }
}
