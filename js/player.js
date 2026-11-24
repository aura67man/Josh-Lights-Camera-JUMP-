// player.js - Josh: run, jump, double jump, dash ("Take Two"), clapperboard swing, film-reel throw, Dramatic Pose
import { moveBody, TILE, T_BREAK, T_PLAT, FX, approach, overlap } from './engine.js';
import { SPR, drawSprite } from './sprites.js';
import { Input } from './input.js';
import { Audio } from './audio.js';

const RUN = 95, ACC_G = 900, ACC_A = 650, FRIC = 1100, GRAV = 950, MAXFALL = 330, JUMP = 312, DJUMP = 272, DASH = 270;

export class Player {
  constructor(game, x, y) {
    this.g = game;
    this.w = 10; this.h = 18;
    this.x = x; this.y = y - this.h;
    this.vx = 0; this.vy = 0; this.facing = 1; this.onGround = false;
    this.coyote = 0; this.jbuf = 0; this.jumps = 1; this.airDash = true;
    this.dashT = 0; this.dashCD = 0; this.atkT = 0; this.atkCD = 0; this.atkHit = new Set();
    this.throwT = 0; this.throwCD = 0; this.inv = 0; this.hurtT = 0; this.poseT = 0; this.poseFired = false;
    this.special = 40; this.dead = false; this.deathT = 0; this.t = 0; this.dropT = 0; this.ghosts = [];
    this.maxHp = 6 + 2 * game.save.upgrades.hearts;
    this.hp = this.maxHp;
    this.frozen = false;
  }
  get dashDur() { return 0.14 + 0.05 * this.g.save.upgrades.dash; }
  get meleeDmg() { return 2 + this.g.save.upgrades.clapper + (this.g.save.goldClapper ? 1 : 0); }
  get reelDmg() { return 1 + Math.floor(this.g.save.upgrades.clapper / 2); }
  get specialRate() { return 4.2 * (1 + 0.45 * this.g.save.upgrades.special); }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  onPlatform() {
    const L = this.g.L, ty = Math.floor((this.y + this.h + 1) / TILE);
    const a = L.get(Math.floor((this.x + 1) / TILE), ty), b = L.get(Math.floor((this.x + this.w - 1) / TILE), ty);
    return (a === T_PLAT || a === 0) && (b === T_PLAT || b === 0) && (a === T_PLAT || b === T_PLAT);
  }

  respawn(x, y) {
    this.x = x; this.y = y - this.h; this.vx = this.vy = 0; this.dead = false; this.deathT = 0;
    this.hp = this.maxHp; this.inv = 1.5; this.hurtT = 0; this.dashT = 0; this.atkT = 0; this.poseT = 0;
  }

  update(dt) {
    const g = this.g, L = g.L;
    this.t += dt;
    if (this.dead) {
      this.deathT += dt;
      this.vy = Math.min(MAXFALL, this.vy + GRAV * dt);
      this.vx = approach(this.vx, 0, 200 * dt);
      moveBody(this, L, dt);
      return;
    }
    const dec = (k) => { if (this[k] > 0) this[k] = Math.max(0, this[k] - dt); };
    ['inv', 'hurtT', 'dashCD', 'atkCD', 'throwCD', 'throwT', 'coyote', 'jbuf', 'dropT'].forEach(dec);
    this.special = Math.min(100, this.special + this.specialRate * dt);
    for (let i = this.ghosts.length - 1; i >= 0; i--) { this.ghosts[i].a -= dt * 4; if (this.ghosts[i].a <= 0) this.ghosts.splice(i, 1); }

    if (this.frozen) { this.vx = approach(this.vx, 0, FRIC * dt); this.vy = Math.min(MAXFALL, this.vy + GRAV * dt); moveBody(this, L, dt); return; }

    // Dramatic Pose (special)
    if (this.poseT > 0) {
      this.poseT -= dt;
      if (!this.poseFired && this.poseT < 0.42) { this.poseFired = true; g.dramaticPose(this.cx, this.cy); }
      this.vx = 0; this.vy = Math.min(60, this.vy + GRAV * dt * 0.3);
      moveBody(this, L, dt);
      return;
    }

    const dir = (Input.down('right') ? 1 : 0) - (Input.down('left') ? 1 : 0);

    // Dash - "Take Two"
    if (Input.pressed('dash') && this.dashCD <= 0 && (this.onGround || this.airDash) && this.hurtT <= 0) {
      if (dir) this.facing = dir;
      this.dashT = this.dashDur; this.dashCD = 0.42 + this.dashT;
      if (!this.onGround) this.airDash = false;
      this.inv = Math.max(this.inv, this.dashT + 0.06);
      Audio.sfx('dash');
      g.say('dash', false, 0.25);
    }
    if (this.dashT > 0) {
      this.dashT -= dt;
      this.vx = this.facing * DASH; this.vy = 0;
      if (Math.floor(this.t * 60) % 3 === 0) this.ghosts.push({ x: this.x, y: this.y, f: this.facing, a: 0.6 });
      moveBody(this, L, dt);
      if (this.dashT <= 0) this.vx = this.facing * RUN;
      this.handleAttackInput(dt);
      return;
    }

    // run
    if (this.hurtT > 0) this.vx = approach(this.vx, 0, 380 * dt);
    else if (dir) { this.vx = approach(this.vx, dir * RUN, (this.onGround ? ACC_G : ACC_A) * dt); if (this.atkT <= 0) this.facing = dir; }
    else this.vx = approach(this.vx, 0, (this.onGround ? FRIC : ACC_A * 0.6) * dt);

    // jump / double jump / drop-through
    if (Input.pressed('jump')) this.jbuf = 0.12;
    if (this.onGround) { this.coyote = 0.09; this.jumps = 1; this.airDash = true; }
    if (this.jbuf > 0 && this.hurtT <= 0) {
      if (Input.down('down') && this.onGround && this.onPlatform()) { this.dropT = 0.22; this.jbuf = 0; this.y += 2; this.onGround = false; }
      else if (this.coyote > 0) { this.vy = -JUMP; this.coyote = 0; this.jbuf = 0; Audio.sfx('jump'); g.parts.burst(this.cx, this.y + this.h, 5, '#e8e0d0', 40, 0.3, 0); }
      else if (this.jumps > 0) { this.vy = -DJUMP; this.jumps--; this.jbuf = 0; Audio.sfx('djump'); g.parts.ring(this.cx, this.y + this.h, 8, '#ffffff', 60, 0.3); }
    }
    if (Input.released('jump') && this.vy < -120) this.vy *= 0.55;
    this.vy = Math.min(MAXFALL, this.vy + GRAV * dt);
    this.drop = this.dropT > 0;

    this.handleAttackInput(dt);

    // special + assist
    if (Input.pressed('special')) {
      if (this.special >= 100) {
        this.poseT = 0.78; this.poseFired = false; this.special = 0; this.inv = Math.max(this.inv, 0.9);
        this.atkT = 0; Audio.sfx('pose'); g.say('special', true); g.spotlightT = 0.78;
      } else Audio.sfx('nope');
    }
    if (Input.pressed('assist')) g.callAssist();

    const wasAir = !this.onGround, vyB = this.vy;
    moveBody(this, L, dt);
    if (this.onGround && wasAir && vyB > 220) { Audio.sfx('land'); g.parts.burst(this.cx, this.y + this.h, 4, '#d8d0c0', 30, 0.25, 0); }
  }

  handleAttackInput(dt) {
    const g = this.g;
    if (Input.pressed('attack') && this.atkCD <= 0 && this.hurtT <= 0) {
      this.atkT = 0.26; this.atkCD = 0.29; this.atkHit.clear(); Audio.sfx('swing');
    }
    if (this.atkT > 0) {
      this.atkT -= dt;
      const el = 0.26 - this.atkT;
      if (el > 0.06 && el < 0.17) this.meleeHit();
    }
    if (Input.pressed('throw') && this.throwCD <= 0 && this.hurtT <= 0 && g.countPlayerProj() < 2) {
      this.throwCD = 0.42; this.throwT = 0.18;
      g.addProj({ owner: 'player', spr: 'reel', x: this.cx + this.facing * 8, y: this.y + 7, vx: this.facing * 215, vy: 0,
        w: 6, h: 6, dmg: this.reelDmg, life: 1.1, anim: 12, breaks: true });
      Audio.sfx('throw');
    }
  }

  meleeBox() {
    return this.facing > 0 ? { x: this.x + this.w - 2, y: this.y - 3, w: 21, h: 22 } : { x: this.x - 19, y: this.y - 3, w: 21, h: 22 };
  }
  meleeHit() {
    const g = this.g, hb = this.meleeBox();
    let hitAny = false;
    for (const t of g.hittables()) {
      if (this.atkHit.has(t) || !overlap(hb, t)) continue;
      this.atkHit.add(t);
      if (t.hurt(this.meleeDmg, this.facing, 'melee')) {
        hitAny = true;
        this.special = Math.min(100, this.special + 6);
      }
    }
    // breakable prop walls
    const L = g.L;
    for (let ty = Math.floor(hb.y / TILE); ty <= Math.floor((hb.y + hb.h) / TILE); ty++)
      for (let tx = Math.floor(hb.x / TILE); tx <= Math.floor((hb.x + hb.w) / TILE); tx++)
        if (L.get(tx, ty) === T_BREAK) { g.breakTile(tx, ty); hitAny = true; }
    if (hitAny && !this._clapped) { Audio.sfx('clap'); FX.stop(0.05); this._clapped = true; }
    if (!hitAny) this._clapped = false;
  }

  hurt(d, srcX) {
    if (this.dead || this.inv > 0 || this.poseT > 0 || this.g.cutsceneLock) return false;
    const g = this.g;
    this.hp -= d; g.stats.damage += d;
    this.inv = 1.1; this.hurtT = 0.32; this.dashT = 0; this.atkT = 0;
    const dir = srcX < this.cx ? 1 : -1;
    this.vx = dir * 150; this.vy = -170;
    FX.stop(0.08); FX.shake(3, 0.2); Audio.sfx('hurt');
    g.parts.burst(this.cx, this.cy, 8, ['#ff4a5a', '#ffd0d0'], 90, 0.4);
    if (this.hp <= 0) {
      if (g.tryUnderstudy()) return true;
      this.die();
    } else g.say('hurt', false, 0.6);
    return true;
  }
  die() {
    this.dead = true; this.hp = 0; this.deathT = 0; this.vy = -230; this.vx = -this.facing * 50;
    Audio.sfx('death'); FX.shake(5, 0.4); FX.slow(0.6);
  }

  frameNow() {
    const set = this.g.save.goldClapper ? SPR.joshGold : SPR.josh;
    if (this.dead) return set.ko;
    if (this.hurtT > 0) return set.hurt;
    if (this.poseT > 0) return set.pose;
    if (this.atkT > 0) return 0.26 - this.atkT < 0.07 ? set.atk0 : set.atk1;
    if (this.throwT > 0) return set.throw;
    if (this.dashT > 0) return set.run0;
    if (!this.onGround) return this.vy < 0 ? set.jump : set.fall;
    if (Math.abs(this.vx) > 15) return set['run' + (Math.floor(this.t * 12) % 4)];
    return set['idle' + (Math.floor(this.t * 2.2) % 2)];
  }

  draw(c, cx, cy) {
    const set = SPR.josh;
    for (const gh of this.ghosts) drawSprite(c, set.run0, gh.x + this.w / 2 - cx, gh.y + this.h - cy, gh.f < 0, true, gh.a * 0.5);
    if (this.inv > 0 && this.hurtT <= 0 && this.dashT <= 0 && this.poseT <= 0 && !this.dead && Math.floor(this.t * 18) % 2) return;
    drawSprite(c, this.frameNow(), this.x + this.w / 2 - cx, this.y + this.h - cy, this.facing < 0, this.hurtT > 0.22);
  }
}
