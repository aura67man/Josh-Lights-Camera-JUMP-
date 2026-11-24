// bosses.js - mini-bosses + bosses, each with 2-3 phases built from a shared attack library
import { moveBody, FX, approach, clamp, rand, overlap } from './engine.js';
import { SPR, drawSprite } from './sprites.js';
import { Audio } from './audio.js';

const TAU = Math.PI * 2;
export const BOSS_DEFS = {
  spotlight: { name: 'SPOTLIGHT SAM', spr: 'spotlight', w: 22, h: 18, hp: 16, fly: true, dmg: 1, proj: 'lightbolt',
    phases: [{ at: 1, atks: ['shoot', 'shoot', 'swoop'], rest: 1.3, shots: 3 }, { at: 0.5, atks: ['spread', 'shoot', 'swoop'], rest: 0.95, shots: 4, fan: 5 }] },
  harshCritic: { name: 'THE HARSH CRITIC', spr: 'criticBoss', w: 16, h: 36, hp: 34, dmg: 1, speed: 30, proj: 'star',
    phases: [{ at: 1, atks: ['spread', 'walkshoot'], rest: 1.35, fan: 5 }, { at: 0.66, atks: ['slam', 'spread', 'shoot'], rest: 1.1, fan: 5, shots: 3 },
      { at: 0.33, atks: ['summon', 'slam', 'charge', 'spread'], rest: 0.95, fan: 7, summon: ['critic', 'tomato'] }] },
  craig: { name: 'CRAIG TYLER: THE STUNT TEST', spr: 'craig', w: 10, h: 22, hp: 20, friendly: true, dmg: 1, speed: 50,
    phases: [{ at: 1, atks: ['charge', 'slam'], rest: 1.15 }, { at: 0.5, atks: ['charge', 'slam', 'charge'], rest: 0.8, spd: 1.25 }] },
  brutus: { name: 'BOOM MIC BRUTUS', spr: 'brutus', w: 18, h: 44, hp: 44, dmg: 1, speed: 30, proj: 'sandbag',
    phases: [{ at: 1, atks: ['charge', 'rain'], rest: 1.3, rain: 4 }, { at: 0.66, atks: ['slam', 'rain', 'charge'], rest: 1.1, rain: 5 },
      { at: 0.33, atks: ['summon', 'slam', 'rain', 'charge'], rest: 0.9, rain: 6, summon: ['stagehand', 'boommic'] }] },
  rack: { name: 'PHANTOM COSTUME RACK', spr: 'rack', w: 28, h: 26, hp: 26, fly: true, dmg: 2, proj: 'ghostorb',
    phases: [{ at: 1, atks: ['shoot', 'summon', 'swoop'], rest: 1.25, shots: 3, summon: ['costume'] },
      { at: 0.5, atks: ['spread', 'summon', 'swoop', 'shoot'], rest: 0.9, fan: 5, shots: 4, summon: ['costume', 'costume'] }] },
  wraith: { name: 'THE WARDROBE WRAITH', spr: 'wraith', w: 30, h: 40, hp: 54, fly: true, dmg: 2, proj: 'ghostorb',
    phases: [{ at: 1, atks: ['spread', 'teleport', 'shoot'], rest: 1.2, fan: 5, shots: 3 }, { at: 0.66, atks: ['rain', 'teleport', 'spread', 'swoop'], rest: 1.0, fan: 7, rain: 5 },
      { at: 0.33, atks: ['summon', 'teleport', 'rain', 'spread', 'laser'], rest: 0.85, fan: 9, rain: 6, summon: ['costume', 'zombie'] }] },
  finn: { name: '"ZORP" THE METHOD ACTOR', spr: 'finnAlien', w: 10, h: 20, hp: 30, friendly: true, dmg: 1, speed: 55, proj: 'note',
    phases: [{ at: 1, atks: ['shoot', 'slam', 'charge'], rest: 1.0, shots: 3 }, { at: 0.5, atks: ['spread', 'slam', 'charge', 'shoot'], rest: 0.75, fan: 5, shots: 4, spd: 1.2 }] },
  mech: { name: 'MK-II MALFUNCTION', spr: 'mech', w: 36, h: 38, hp: 62, dmg: 2, speed: 22, proj: 'bolt',
    phases: [{ at: 1, atks: ['laser', 'shoot', 'charge'], rest: 1.2, shots: 4 }, { at: 0.66, atks: ['laser', 'spread', 'summon', 'charge'], rest: 1.0, fan: 7, summon: ['drone', 'robot'] },
      { at: 0.33, atks: ['laser', 'rain', 'spread', 'charge'], rest: 0.85, fan: 9, rain: 6, rainProj: 'bolt' }] },
  tumbleking: { name: 'THE TUMBLE KING', spr: 'tumbleking', w: 28, h: 28, hp: 36, dmg: 2, speed: 40, proj: 'miniweed',
    phases: [{ at: 1, atks: ['roll', 'rain'], rest: 1.1, rain: 4 }, { at: 0.5, atks: ['roll', 'slam', 'rain', 'roll'], rest: 0.8, rain: 6, spd: 1.2 }] },
  dusty: { name: 'DEADEYE DUSTY', spr: 'dusty', w: 16, h: 44, hp: 72, dmg: 2, speed: 40, proj: 'laser', rainProj: 'dynamite',
    phases: [{ at: 1, atks: ['shoot', 'charge', 'slam'], rest: 1.1, shots: 5 }, { at: 0.66, atks: ['rain', 'shoot', 'charge', 'spread'], rest: 0.95, shots: 6, fan: 5, rain: 4 },
      { at: 0.33, atks: ['summon', 'shoot', 'rain', 'slam', 'charge'], rest: 0.75, shots: 7, fan: 7, rain: 6, summon: ['bandit', 'dynamite'] }] },
  papprime: { name: 'PAPARAZZO PRIME', spr: 'papprime', w: 32, h: 24, hp: 40, fly: true, dmg: 2, proj: 'flash',
    phases: [{ at: 1, atks: ['flashburst', 'shoot', 'swoop'], rest: 1.1, shots: 4 }, { at: 0.5, atks: ['flashburst', 'summon', 'spread', 'swoop'], rest: 0.85, fan: 7, summon: ['papdrone', 'paparazzi'] }] },
  finalcut: { name: 'MAX FINAL CUT', spr: 'finalcutBoss', w: 16, h: 44, hp: 120, dmg: 2, speed: 45, proj: 'scissors',
    phases: [
      { at: 1, atks: ['shoot', 'charge', 'spread', 'slam'], rest: 1.0, shots: 4, fan: 5 },
      { at: 0.66, spr: 'greenlight', w: 40, h: 42, fly: false, proj: 'bolt', rainProj: 'bolt', atks: ['laser', 'rain', 'slam', 'summon'], rest: 1.0, rain: 6, summon: ['paparazzi', 'flasher'], name: 'THE GREENLIGHT MACHINE', line: 'phase2' },
      { at: 0.33, spr: 'projector', w: 36, h: 28, fly: true, proj: 'flash', rainProj: 'scissors', atks: ['spread', 'laser', 'summon', 'swoop', 'rain'], rest: 0.85, fan: 9, rain: 7, summon: ['papdrone'], name: 'FINAL CUT: PROJECTED', line: 'phase3' },
    ] },
};

const ATK = {
  shoot(b, dt, a) {
    if (!a.init) { a.init = 1; a.n = b.ph.shots || 3; a.cd = 0.45; b.tele = true; }
    b.face(); b.brake(dt);
    a.cd -= dt;
    if (a.cd < 0.25) b.tele = false;
    if (a.cd <= 0 && a.n > 0) { b.fire(b.aim(), 150); a.n--; a.cd = 0.33 / b.spd; Audio.sfx('shoot'); }
    return a.n <= 0 && a.cd <= 0;
  },
  walkshoot(b, dt, a) {
    if (!a.init) { a.init = 1; a.T = 2.2; a.cd = 0.5; }
    b.face(); b.vx = b.facing * (b.def.speed || 30) * 0.8;
    a.cd -= dt;
    if (a.cd <= 0) { b.fire(b.aim(), 140); a.cd = 0.6; Audio.sfx('shoot'); }
    a.T -= dt; return a.T <= 0;
  },
  spread(b, dt, a) {
    if (!a.init) { a.init = 1; a.tele = 0.45; a.n = b.phase >= 2 ? 2 : 1; a.cd = 0; }
    b.face(); b.brake(dt);
    if (a.tele > 0) { a.tele -= dt; b.tele = true; return false; }
    b.tele = false; a.cd -= dt;
    if (a.cd <= 0 && a.n > 0) {
      const k = b.ph.fan || 5, base = b.aim();
      for (let i = 0; i < k; i++) b.fire(base + (i - (k - 1) / 2) * 0.24, 115);
      a.n--; a.cd = 0.6; Audio.sfx('shoot');
    }
    return a.n <= 0 && a.cd <= 0;
  },
  slam(b, dt, a) {
    if (b.fly) return true;
    if (!a.init) { a.init = 1; a.st = 0; a.tele = 0.35; a.air = 0; }
    if (a.st === 0) {
      b.vx = 0; a.tele -= dt; b.tele = true;
      if (a.tele <= 0 && b.onGround) {
        const p = b.g.player, T = 0.78;
        b.vy = -(950 * T) / 2; b.vx = clamp((p.cx - b.cx) / T, -240, 240); b.face();
        a.st = 1; b.tele = false; Audio.sfx('jump');
      }
      return false;
    }
    if (a.st === 1) {
      a.air += dt;
      if (b.onGround && a.air > 0.15) {
        a.st = 2; a.wait = 0.45; b.vx = 0;
        FX.shake(5, 0.3); Audio.sfx('explode');
        const gy = b.y + b.h;
        for (const d of [-1, 1]) b.g.addProj({ owner: 'enemy', spr: 'shock', x: b.cx + d * 12, y: gy - 5, vx: d * 155, vy: 0, w: 10, h: 9, dmg: b.dmg, life: 1.8, anim: 10, ground: true });
        b.g.parts.burst(b.cx, gy, 14, ['#e8d8b0', '#ffffff'], 120, 0.5);
      }
      return false;
    }
    b.vx = 0; a.wait -= dt; return a.wait <= 0;
  },
  charge(b, dt, a) {
    if (!a.init) { a.init = 1; a.st = 0; a.tele = 0.55; b.face(); Audio.sfx('charge'); }
    if (a.st === 0) { b.vx = 0; a.tele -= dt; b.tele = true; if (a.tele <= 0) { a.st = 1; b.tele = false; a.T = 2.6; } return false; }
    if (a.st === 1) {
      b.vx = b.facing * 230 * b.spd; a.T -= dt;
      if (Math.random() < 0.5) b.g.parts.add({ x: b.cx - b.facing * 8, y: b.y + b.h - 2, vx: -b.facing * 40, vy: -20, life: 0.3, c: '#d8c8a0' });
      const atWall = b.facing > 0 ? b.x + b.w >= b.arena.x1 - 6 : b.x <= b.arena.x0 + 6;
      if (atWall || a.T <= 0) { FX.shake(4, 0.25); Audio.sfx('hit'); b.vx = -b.facing * 70; if (!b.fly) b.vy = -130; a.st = 2; a.wait = 0.55; }
      return false;
    }
    a.wait -= dt; b.vx = approach(b.vx, 0, 300 * dt); return a.wait <= 0;
  },
  roll(b, dt, a) {
    if (!a.init) { a.init = 1; a.st = 0; a.tele = 0.45; a.passes = b.phase >= 1 ? 3 : 2; b.face(); Audio.sfx('charge'); }
    if (a.st === 0) { b.vx = 0; a.tele -= dt; b.tele = true; if (a.tele <= 0) { a.st = 1; b.tele = false; } return false; }
    b.vx = b.facing * 200 * b.spd;
    if (b.onGround) b.vy = -rand(140, 260);
    const atWall = b.facing > 0 ? b.x + b.w >= b.arena.x1 - 6 : b.x <= b.arena.x0 + 6;
    if (atWall) { b.facing *= -1; a.passes--; FX.shake(3, 0.2); Audio.sfx('hit'); }
    return a.passes <= 0;
  },
  rain(b, dt, a) {
    if (!a.init) {
      a.init = 1; a.t = 0; a.xs = [];
      const n = b.ph.rain || 5, p = b.g.player;
      a.xs.push(p.cx);
      for (let i = 1; i < n; i++) a.xs.push(rand(b.arena.x0 + 16, b.arena.x1 - 16));
      a.xs.forEach((x) => b.g.addWarn(x, 0.75));
      b.tele = true; Audio.sfx('shoot');
    }
    a.t += dt; b.brake(dt);
    if (a.t >= 0.75 && !a.dropped) {
      a.dropped = 1; b.tele = false;
      const spr = b.ph.rainProj || b.def.rainProj || b.ph.proj || b.def.proj;
      a.xs.forEach((x, i) => b.g.addProj({ owner: 'enemy', spr, x, y: 14 - i * 8, vx: 0, vy: 190, g: 260, w: 7, h: 7, dmg: b.dmg, life: 2.5, anim: 8, explode: spr === 'dynamite', rot: spr === 'laser' || spr === 'bolt' }));
    }
    return a.t > 1.3;
  },
  laser(b, dt, a) {
    if (!a.init) {
      a.init = 1; a.t = 0; a.low = Math.random() < 0.5;
      const gy = b.arena.groundY;
      a.y0 = a.low ? gy - 11 : gy - 60; a.y1 = a.low ? gy - 2 : gy - 46;
      b.g.laser = { y0: a.y0, y1: a.y1, t: 0, x0: b.arena.x0, x1: b.arena.x1, live: false };
      Audio.sfx('charge');
    }
    a.t += dt; b.brake(dt); b.tele = a.t < 0.85;
    const L = b.g.laser;
    if (!L) return true;
    L.t = a.t;
    if (a.t >= 0.85 && !L.live) { L.live = true; Audio.sfx('laser'); FX.shake(2, 0.45); }
    if (L.live) { const p = b.g.player; if (p.y < a.y1 && p.y + p.h > a.y0) p.hurt(b.dmg, b.cx); }
    if (a.t >= 1.3) { b.g.laser = null; return true; }
    return false;
  },
  summon(b, dt, a) {
    if (!a.init) { a.init = 1; a.t = 0; b.tele = true; Audio.sfx('bossRoar'); }
    a.t += dt; b.brake(dt);
    if (a.t > 0.5 && !a.done) {
      a.done = 1; b.tele = false;
      const alive = b.g.enemies.filter((e) => !e.dead).length;
      const types = b.ph.summon || [];
      const n = Math.min(types.length ? (b.phase >= 2 ? 3 : 2) : 0, 5 - alive);
      for (let i = 0; i < n; i++) b.g.spawnArenaEnemy(types[i % types.length], b.arena);
    }
    return a.t > 0.9;
  },
  swoop(b, dt, a) {
    if (!b.fly) return true;
    if (!a.init) { a.init = 1; a.st = 0; a.t = 0; const p = b.g.player; a.tx = p.cx; a.ty = p.cy; b.tele = true; }
    a.t += dt;
    if (a.st === 0) { b.brake(dt); if (a.t > 0.45) { a.st = 1; b.tele = false; } return false; }
    if (a.st === 1) {
      const dx = a.tx - b.cx, dy = a.ty - b.cy, d = Math.hypot(dx, dy) || 1, sp = 220 * b.spd;
      if (d < 8 || a.t > 1.7) a.st = 2; else { b.vx = (dx / d) * sp; b.vy = (dy / d) * sp; }
      return false;
    }
    b.vx = approach(b.vx, 0, 400 * dt); b.vy = -110;
    if (b.y < 40 || a.t > 2.6) { b.vy = 0; return true; }
    return false;
  },
  teleport(b, dt, a) {
    if (!a.init) { a.init = 1; a.t = 0; Audio.sfx('dash'); }
    a.t += dt; b.vx = 0; b.vy = 0;
    b.alpha = a.t < 0.35 ? 1 - a.t / 0.35 : a.t < 0.7 ? (a.t - 0.35) / 0.35 : 1;
    if (a.t >= 0.35 && !a.moved) {
      a.moved = 1;
      const p = b.g.player, mid = (b.arena.x0 + b.arena.x1) / 2;
      b.x = p.cx > mid ? b.arena.x0 + 20 : b.arena.x1 - b.w - 20;
      b.y = 34 + Math.random() * 16;
    }
    if (a.t >= 0.7) { b.alpha = 1; return true; }
    return false;
  },
  flashburst(b, dt, a) {
    if (!a.init) { a.init = 1; a.t = 0; b.tele = true; Audio.sfx('charge'); }
    a.t += dt; b.brake(dt);
    if (a.t > 0.6 && !a.done) {
      a.done = 1; b.tele = false; FX.flash('#ffffff', 0.25); Audio.sfx('flash');
      const n = b.phase >= 1 ? 12 : 10;
      for (let i = 0; i < n; i++) b.fire((i / n) * TAU + a.t, 95);
    }
    return a.t > 1.0;
  },
};

export class Boss {
  constructor(game, key, arena) {
    const d = BOSS_DEFS[key];
    this.def = d; this.key = key; this.g = game; this.arena = arena;
    const ng = game.save.ngPlus || 0;
    this.maxHp = this.hp = Math.round(d.hp * (1 + 0.5 * ng));
    this.dmg = d.dmg + (ng > 0 ? 1 : 0);
    this.phase = 0; this.ph = d.phases[0];
    this.spr = d.spr; this.w = d.w; this.h = d.h; this.fly = !!d.fly;
    this.x = arena.x1 - 80; this.y = this.fly ? -this.h - 10 : 10;
    this.vx = 0; this.vy = 0; this.facing = -1; this.onGround = false;
    this.state = 'enter'; this.stateT = 0; this.atk = null; this.restT = 1; this.atkIdx = 0;
    this.t = 0; this.flashT = 0; this.stunT = 0; this.inv = 0; this.tele = false; this.alpha = 1;
    this.dead = false; this.deathT = 0; this.gone = false;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  get spd() { return this.ph.spd || 1; }
  get name() { return this.ph.name || this.def.name; }
  face() { this.facing = this.g.player.cx >= this.cx ? 1 : -1; }
  brake(dt) { this.vx = approach(this.vx, 0, 500 * dt); if (this.fly) this.vy = approach(this.vy, 0, 300 * dt); }
  aim() { const p = this.g.player; return Math.atan2(p.cy - (this.cy - 4), p.cx - this.cx); }
  fire(an, sp) {
    const proj = this.ph.proj || this.def.proj || 'star';
    this.g.addProj({ owner: 'enemy', spr: proj, x: this.cx + Math.cos(an) * 10, y: this.cy - 4 + Math.sin(an) * 6,
      vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, w: 6, h: 6, dmg: this.dmg, life: 3.2, anim: 10, rot: proj === 'laser' || proj === 'bolt' });
  }

  update(dt) {
    const g = this.g, p = g.player;
    this.t += dt;
    if (this.flashT > 0) this.flashT -= dt;
    if (this.inv > 0) this.inv -= dt;
    if (this.dead) {
      this.deathT += dt;
      if (!this.def.friendly && Math.random() < 0.4) g.parts.burst(this.x + Math.random() * this.w, this.y + Math.random() * this.h, 6, ['#ffd84a', '#ff6a3a', '#ffffff'], 120, 0.5);
      if (!this.fly || this.def.friendly) { this.vy = Math.min(330, this.vy + 950 * dt); this.vx = approach(this.vx, 0, 200 * dt); moveBody(this, g.L, dt); }
      if (!this.def.friendly && this.deathT > 1.7) this.gone = true;
      return;
    }
    if (this.state === 'enter') {
      if (this.fly) this.y = approach(this.y, 40, 90 * dt);
      else { this.vy = Math.min(330, this.vy + 950 * dt); moveBody(this, g.L, dt); }
      this.face();
      return;
    }
    if (this.state === 'phase') {
      this.stateT -= dt; this.vx = 0; this.tele = false;
      if (this.fly) this.y = approach(this.y, 40, 60 * dt); else { this.vy = Math.min(330, this.vy + 950 * dt); moveBody(this, g.L, dt); }
      if (this.stateT <= 0) { this.state = 'fight'; this.restT = 0.6; }
      return;
    }
    if (this.stunT > 0) {
      this.stunT -= dt; this.tele = false;
      this.vx = approach(this.vx, 0, 300 * dt);
      if (this.fly) { this.vy = approach(this.vy, 0, 200 * dt); this.x += this.vx * dt; this.y += this.vy * dt; }
      else { this.vy = Math.min(330, this.vy + 950 * dt); moveBody(this, g.L, dt); }
      return;
    }
    if (this.atk) {
      if (ATK[this.atk.name](this, dt, this.atk)) { this.atk = null; this.tele = false; this.alpha = 1; this.restT = this.ph.rest * rand(0.8, 1.2) / this.spd; }
    } else {
      this.restT -= dt;
      this.restMove(dt);
      if (this.restT <= 0 && !p.dead) {
        const list = this.ph.atks;
        const name = Math.random() < 0.3 ? list[Math.floor(Math.random() * list.length)] : list[this.atkIdx++ % list.length];
        this.atk = { name };
      }
    }
    if (this.fly) { this.x += this.vx * dt; this.y += this.vy * dt; this.y = clamp(this.y, 22, this.arena.groundY - this.h - 4); }
    else { this.vy = Math.min(400, this.vy + 950 * dt); moveBody(this, g.L, dt); }
    this.x = clamp(this.x, this.arena.x0 + 4, this.arena.x1 - this.w - 4);
    if (!p.dead && this.alpha > 0.5 && overlap(this, p)) p.hurt(this.dmg, this.cx);
  }

  restMove(dt) {
    const p = this.g.player;
    this.face();
    if (this.fly) {
      const tx = p.cx + Math.sin(this.t * 0.9) * 70, ty = 52 + Math.sin(this.t * 1.7) * 12;
      this.vx = approach(this.vx, clamp((tx - this.cx) * 1.5, -75, 75), 200 * dt);
      this.vy = approach(this.vy, clamp((ty - this.cy) * 2, -60, 60), 200 * dt);
    } else {
      const d = Math.abs(p.cx - this.cx);
      this.vx = d > 44 ? this.facing * (this.def.speed || 30) * this.spd * 0.7 : approach(this.vx, 0, 300 * dt);
    }
  }

  hurt(dmg, dir) {
    if (this.dead || this.inv > 0 || this.state !== 'fight' || this.alpha < 0.5) return false;
    const g = this.g;
    this.hp -= dmg; this.flashT = 0.1;
    Audio.sfx('hit'); FX.stop(0.035);
    g.parts.burst(this.cx, this.cy, 5, ['#ffffff', '#ffd84a'], 80, 0.3);
    g.addFloat(String(dmg), this.cx, this.y - 2, '#ffd84a');
    g.score += 10;
    const next = this.def.phases[this.phase + 1];
    if (this.hp <= 0) this.die();
    else if (next && this.hp / this.maxHp <= next.at) this.nextPhase();
    return true;
  }
  nextPhase() {
    const g = this.g;
    this.phase++; this.ph = this.def.phases[this.phase];
    if (this.ph.spr) {
      const bottom = this.y + this.h, mid = this.cx;
      this.spr = this.ph.spr; this.w = this.ph.w; this.h = this.ph.h; this.fly = !!this.ph.fly;
      this.x = mid - this.w / 2; this.y = this.fly ? 40 : bottom - this.h - 2;
      g.parts.burst(this.cx, this.cy, 40, ['#ffffff', '#ffd84a', '#e83040'], 160, 0.8);
    }
    this.atk = null; this.tele = false; this.alpha = 1; this.state = 'phase'; this.stateT = 1.3; this.inv = 1.3;
    g.laser = null;
    FX.shake(5, 0.5); FX.flash('#ffffff', 0.3); Audio.sfx('bossRoar');
    g.onBossPhase(this);
  }
  die() {
    this.dead = true; this.deathT = 0; this.atk = null; this.tele = false; this.alpha = 1; this.hp = 0;
    this.vy = this.fly ? 0 : -150;
    this.g.laser = null;
    this.g.onBossDefeated(this);
  }

  draw(c, cx, cy) {
    if (this.gone) return;
    const S = SPR[this.spr];
    let fr;
    if (S.idle0) {
      if (this.dead) fr = this.def.friendly ? S.hurt : S.ko;
      else if (this.flashT > 0 || this.state === 'phase' || this.stunT > 0) fr = S.hurt;
      else if (this.tele) fr = S.throw;
      else if (!this.onGround && !this.fly) fr = S.jump;
      else if (Math.abs(this.vx) > 8) fr = S['run' + (Math.floor(this.t * (Math.abs(this.vx) > 150 ? 16 : 9)) % 4)];
      else fr = S['idle' + (Math.floor(this.t * 2) % 2)];
    } else fr = S[Math.floor(this.t * (this.tele ? 10 : 4)) % S.length];
    const ox = this.tele ? Math.round(Math.random() * 2 - 1) : 0;
    const white = this.flashT > 0 || (this.tele && Math.floor(this.t * 14) % 3 === 0) || (this.dead && !this.def.friendly && Math.floor(this.deathT * 12) % 2 === 0);
    let alpha = this.alpha;
    if (this.dead && !this.def.friendly) alpha = Math.max(0, 1 - Math.max(0, this.deathT - 1.1) / 0.6);
    drawSprite(c, fr, this.cx - cx + ox, this.y + this.h - cy, this.facing < 0, white, alpha);
    if (this.stunT > 0) {
      for (let i = 0; i < 4; i++) {
        const a = this.t * 6 + i * 1.6;
        c.fillStyle = i % 2 ? '#ffe060' : '#ffffff';
        c.fillRect(Math.round(this.cx - cx + Math.cos(a) * 10), Math.round(this.y - cy - 4 + Math.sin(a) * 3), 2, 2);
      }
    }
  }
}
