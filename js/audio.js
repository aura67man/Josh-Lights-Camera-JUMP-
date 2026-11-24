// audio.js - Web Audio only: synthesized SFX + procedural chiptune music (one loop per world)
import { makeRng } from './engine.js';

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], harm: [0, 2, 3, 5, 7, 8, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10], mixo: [0, 2, 4, 5, 7, 9, 10], phryg: [0, 1, 3, 5, 7, 8, 10],
};
const TRACKS = {
  title: { bpm: 120, root: 60, scale: 'major', prog: [0, 4, 5, 3], seed: 1, drums: 'pop', bass: 'eighth', lead: 'p25' },
  w1: { bpm: 132, root: 65, scale: 'major', prog: [0, 3, 4, 0, 5, 3, 1, 4], seed: 11, drums: 'pop', bass: 'bounce', lead: 'p25' },
  w2: { bpm: 136, root: 62, scale: 'dorian', prog: [0, 3, 0, 4], seed: 22, drums: 'funk', bass: 'funk', lead: 'p12' },
  w3: { bpm: 104, root: 64, scale: 'harm', prog: [0, 5, 3, 4], seed: 33, drums: 'slow', bass: 'whole', lead: 'tri', arp: true },
  w4: { bpm: 150, root: 57, scale: 'minor', prog: [0, 5, 6, 4], seed: 44, drums: 'drive', bass: 'octave', lead: 'p25', arp: true },
  w5: { bpm: 126, root: 64, scale: 'mixo', prog: [0, 6, 3, 0], seed: 55, drums: 'gallop', bass: 'gallop', lead: 'p12', swing: 0.18 },
  w6: { bpm: 144, root: 58, scale: 'major', prog: [0, 4, 5, 3, 1, 4, 0, 4], seed: 66, drums: 'drive', bass: 'octave', lead: 'p25' },
  boss: { bpm: 162, root: 60, scale: 'minor', prog: [0, 0, 5, 4], seed: 77, drums: 'drive', bass: 'octave', lead: 'p25', arp: true },
  final: { bpm: 170, root: 62, scale: 'harm', prog: [0, 5, 3, 4], seed: 88, drums: 'drive', bass: 'octave', lead: 'p12', arp: true },
  shop: { bpm: 100, root: 67, scale: 'major', prog: [0, 5, 1, 4], seed: 99, drums: 'soft', bass: 'walk', lead: 'tri' },
  cutscene: { bpm: 88, root: 60, scale: 'major', prog: [0, 5, 3, 4], seed: 5, drums: 'none', bass: 'whole', lead: 'tri' },
  credits: { bpm: 118, root: 65, scale: 'major', prog: [0, 4, 5, 3], seed: 7, drums: 'pop', bass: 'eighth', lead: 'p25' },
};
const RHYTHMS = ['x.x.x...x.x.x...', 'x...x.x.x...x.x.', 'x.xx..x.x.xx..x.', 'x..x..x.x..x..x.', 'x.x.xxx.x...x...', 'x...x...x.x.x.x.', 'xx..x.x..x.x....', 'x.....x.x.x.x...'];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function buildSong(def) {
  const rng = makeRng(def.seed * 7919);
  const sc = SCALES[def.scale];
  const deg = (d, oct = 0) => { const o = Math.floor(d / 7); const i = ((d % 7) + 7) % 7; return def.root + sc[i] + 12 * (o + oct); };
  const bars = def.prog.length;
  const sections = 2, steps = bars * 16 * sections;
  const lead = new Array(steps).fill(null), bass = new Array(steps).fill(null), arp = new Array(steps).fill(null), pad = new Array(steps).fill(null);
  for (let s = 0; s < sections; s++) {
    let cur = 4 + rng.i(0, 2);
    for (let b = 0; b < bars; b++) {
      const ch = def.prog[b];
      const chord = [ch, ch + 2, ch + 4];
      const rhythm = RHYTHMS[(rng.i(0, RHYTHMS.length - 1) + s) % RHYTHMS.length];
      const base = (s * bars + b) * 16;
      const onsets = [];
      for (let i = 0; i < 16; i++) if (rhythm[i] === 'x') onsets.push(i);
      onsets.forEach((st, k) => {
        if (st % 4 === 0) { // strong beat: snap to chord tone
          const tgt = chord.map((c) => c + 7).sort((a, z) => Math.abs(a - cur) - Math.abs(z - cur))[0];
          cur = tgt;
        } else cur += rng.i(-2, 2);
        if (cur < 2) cur += 3; if (cur > 13) cur -= 3;
        const next = onsets[k + 1] ?? 16;
        let len = Math.min(4, next - st);
        if (b === bars - 1 && k === onsets.length - 1) { cur = ch + 7; len = 16 - st; }
        lead[base + st] = { n: deg(cur, 0), len };
      });
      // bass
      const r = deg(ch, -2), fifth = deg(ch + 4, -2);
      const B = (st, n, len) => { bass[base + st] = { n, len }; };
      switch (def.bass) {
        case 'eighth': for (let i = 0; i < 16; i += 2) B(i, r, 2); break;
        case 'bounce': for (let i = 0; i < 16; i += 2) B(i, i % 4 ? fifth : r, 2); break;
        case 'funk': [0, 3, 6, 8, 10, 11, 14].forEach((i, k) => B(i, k % 3 === 1 ? r + 12 : r, 1)); break;
        case 'whole': B(0, r, 15); break;
        case 'octave': for (let i = 0; i < 16; i += 2) B(i, i % 4 ? r + 12 : r, 2); break;
        case 'gallop': [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15].forEach((i) => B(i, i % 8 < 4 ? r : fifth, 1)); break;
        case 'walk': [0, 4, 8, 12].forEach((i, k) => B(i, deg(ch + k, -2), 3)); break;
      }
      if (def.arp) for (let i = 0; i < 16; i++) arp[base + i] = { n: deg(chord[i % 3], 1), len: 1 };
      else pad[base] = { notes: chord.map((c) => deg(c, 0)), len: 16 };
    }
  }
  return { steps, lead, bass, arp, pad, stepDur: 60 / def.bpm / 4, def };
}

const DRUMS = {
  pop: { k: [0, 8], s: [4, 12], h: [0, 2, 4, 6, 8, 10, 12, 14] },
  funk: { k: [0, 6, 10], s: [4, 12], h: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
  slow: { k: [0], s: [8], h: [4, 12] },
  drive: { k: [0, 4, 8, 12], s: [4, 12], h: [2, 6, 10, 14] },
  gallop: { k: [0, 8], s: [4, 12], h: [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15] },
  soft: { k: [0, 8], s: [], h: [4, 12] },
  none: { k: [], s: [], h: [] },
};

export const Audio = {
  ctx: null, master: null, musicBus: null, sfxBus: null, trackGain: null,
  settings: { master: 0.8, music: 0.55, sfx: 0.8, mute: false },
  cur: null, curId: null, step: 0, nextT: 0, waves: {}, noiseBuf: null, timer: null,

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch (e) { this.ctx = null; return; }
    const c = this.ctx;
    this.master = c.createGain();
    const comp = c.createDynamicsCompressor();
    this.master.connect(comp); comp.connect(c.destination);
    this.musicBus = c.createGain(); this.musicBus.connect(this.master);
    this.sfxBus = c.createGain(); this.sfxBus.connect(this.master);
    const len = c.sampleRate;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const pulse = (duty) => {
      const n = 32, re = new Float32Array(n), im = new Float32Array(n);
      for (let k = 1; k < n; k++) re[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
      return c.createPeriodicWave(re, im);
    };
    this.waves.p12 = pulse(0.125); this.waves.p25 = pulse(0.25);
    this.apply();
    this.timer = setInterval(() => this._tick(), 25);
    if (this._pending) { const p = this._pending; this._pending = null; this.music(p); }
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  apply(s) {
    if (s) Object.assign(this.settings, s);
    if (!this.ctx) return;
    const S = this.settings, t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(S.mute ? 0 : S.master, t, 0.02);
    this.musicBus.gain.setTargetAtTime(S.music * 0.5, t, 0.02);
    this.sfxBus.gain.setTargetAtTime(S.sfx * 0.7, t, 0.02);
  },

  // ---- primitive voices ----
  _osc(type, f, t, dur, vol, bus, f2, attack = 0.005) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    if (type === 'tri') type = 'triangle';
    if (this.waves[type]) o.setPeriodicWave(this.waves[type]); else o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.02);
  },
  _noise(t, dur, vol, bus, ftype = 'bandpass', f = 1000, f2) {
    const c = this.ctx, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; fl.type = ftype; fl.frequency.setValueAtTime(f, t);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(bus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  },
  _seq(notes, type, step, vol, bus) { const t = this.ctx.currentTime; notes.forEach((n, i) => { if (n) this._osc(type, mtof(n), t + i * step, step * 1.6, vol, bus); }); },

  sfx(name) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, B = this.sfxBus;
    switch (name) {
      case 'jump': this._osc('p25', 280, t, 0.12, 0.18, B, 620); break;
      case 'djump': this._osc('p25', 420, t, 0.12, 0.16, B, 940); this._osc('tri', 840, t + 0.03, 0.08, 0.1, B, 1200); break;
      case 'dash': this._noise(t, 0.18, 0.35, B, 'highpass', 1200, 4000); this._osc('sawtooth', 700, t, 0.14, 0.08, B, 180); break;
      case 'swing': this._noise(t, 0.09, 0.3, B, 'bandpass', 1800, 4200); break;
      case 'clap': this._noise(t, 0.05, 0.5, B, 'highpass', 2500); this._osc('square', 1400, t, 0.04, 0.08, B, 900); break;
      case 'hit': this._osc('square', 220, t, 0.09, 0.22, B, 70); this._noise(t, 0.06, 0.3, B, 'lowpass', 2000); break;
      case 'enemyDie': this._osc('square', 500, t, 0.25, 0.18, B, 60); this._noise(t, 0.2, 0.25, B, 'lowpass', 3000, 300); break;
      case 'rice': this._osc('p25', 1320, t, 0.05, 0.12, B); this._osc('p25', 1760, t + 0.05, 0.07, 0.12, B); break;
      case 'bowl': this._seq([81, 85, 88, 93], 'p25', 0.05, 0.14, B); break;
      case 'heart': this._seq([76, 81, 88], 'tri', 0.07, 0.25, B); break;
      case 'cooker': this._seq([72, 76, 79, 84, 79, 84, 88], 'p25', 0.08, 0.16, B); break;
      case 'hurt': this._osc('sawtooth', 320, t, 0.28, 0.2, B, 90); this._noise(t, 0.12, 0.2, B, 'lowpass', 1500); break;
      case 'throw': this._osc('tri', 600, t, 0.1, 0.2, B, 1000); break;
      case 'pose': this._osc('p12', 300, t, 0.6, 0.12, B, 1200, 0.05); this._seq([72, 76, 79, 84], 'tri', 0.06, 0.2, B); break;
      case 'poseBoom': this._noise(t, 0.5, 0.4, B, 'lowpass', 2400, 200); this._osc('square', 110, t, 0.4, 0.2, B, 40); break;
      case 'assist': this._noise(t, 0.4, 0.4, B, 'bandpass', 600, 3000); this._seq([67, 71, 74, 79], 'p25', 0.05, 0.16, B); break;
      case 'menuMove': this._osc('p25', 660, t, 0.04, 0.1, B); break;
      case 'menuSelect': this._osc('p25', 880, t, 0.05, 0.12, B); this._osc('p25', 1320, t + 0.05, 0.08, 0.12, B); break;
      case 'menuBack': this._osc('p25', 520, t, 0.05, 0.1, B, 300); break;
      case 'checkpoint': this._seq([72, 76, 79, 84], 'tri', 0.07, 0.25, B); break;
      case 'waveStart': this._noise(t, 0.15, 0.4, B, 'lowpass', 400); this._seq([57, 57, 64], 'sawtooth', 0.09, 0.09, B); break;
      case 'waveClear': this._seq([72, 79, 84, 88], 'p25', 0.07, 0.14, B); break;
      case 'bossRoar': this._osc('sawtooth', 140, t, 0.7, 0.22, B, 55); this._noise(t, 0.6, 0.3, B, 'lowpass', 900, 200); break;
      case 'bossDie': this._noise(t, 1.2, 0.5, B, 'lowpass', 3000, 80); this._osc('square', 400, t, 1.0, 0.18, B, 30); break;
      case 'explode': this._noise(t, 0.4, 0.45, B, 'lowpass', 2000, 120); this._osc('square', 120, t, 0.25, 0.14, B, 40); break;
      case 'shoot': this._osc('square', 900, t, 0.07, 0.08, B, 400); break;
      case 'laser': this._osc('sawtooth', 1600, t, 0.35, 0.1, B, 900); break;
      case 'charge': this._osc('sawtooth', 120, t, 0.4, 0.1, B, 400); break;
      case 'blip': this._osc('square', 900 + Math.random() * 150, t, 0.018, 0.035, B); break;
      case 'break': this._noise(t, 0.25, 0.45, B, 'lowpass', 2500, 300); this._osc('square', 180, t, 0.12, 0.12, B, 60); break;
      case 'land': this._noise(t, 0.05, 0.15, B, 'lowpass', 600); break;
      case 'death': this._seq([67, 63, 60, 55], 'p25', 0.12, 0.18, B); break;
      case 'stun': this._seq([88, 91, 88, 91], 'tri', 0.04, 0.1, B); break;
      case 'secret': this._seq([79, 83, 86, 91, 95], 'tri', 0.06, 0.2, B); break;
      case 'buy': this._seq([76, 79, 84, 88], 'p25', 0.05, 0.14, B); break;
      case 'nope': this._osc('square', 200, t, 0.15, 0.12, B, 150); break;
      case 'understudy': this._seq([60, 64, 67, 72, 76], 'p25', 0.06, 0.16, B); break;
      case 'victory': this._seq([72, 72, 72, 76, null, 79, null, 84, 84], 'p25', 0.1, 0.16, B); this._seq([48, null, null, 52, null, 55, null, 60], 'tri', 0.1, 0.25, B); break;
      case 'gameover': this._seq([67, null, 66, null, 65, null, 64, 64], 'tri', 0.14, 0.25, B); break;
      case 'applause': for (let i = 0; i < 40; i++) this._noise(t + Math.random() * 2.2, 0.05, 0.12, B, 'bandpass', 1500 + Math.random() * 2500); break;
      case 'flash': this._noise(t, 0.12, 0.3, B, 'highpass', 3000); this._osc('sine', 3000, t, 0.15, 0.08, B, 1500); break;
      default: break;
    }
  },

  // ---- music ----
  music(id) {
    if (id === this.curId) return;
    if (!this.ctx) { this._pending = id; return; }
    this.curId = id;
    const c = this.ctx, t = c.currentTime;
    if (this.trackGain) { const old = this.trackGain; old.gain.setTargetAtTime(0, t, 0.08); setTimeout(() => { try { old.disconnect(); } catch (e) { /* gone */ } }, 600); }
    this.trackGain = null; this.cur = null;
    if (!id || !TRACKS[id]) return;
    if (!TRACKS[id]._song) TRACKS[id]._song = buildSong(TRACKS[id]);
    this.trackGain = c.createGain(); this.trackGain.gain.value = 1; this.trackGain.connect(this.musicBus);
    this.cur = TRACKS[id]._song; this.step = 0; this.nextT = t + 0.08;
  },
  stopMusic() { this.music(null); },
  _tick() {
    if (!this.ctx || !this.cur) return;
    const c = this.ctx;
    if (this.nextT < c.currentTime - 0.2) this.nextT = c.currentTime + 0.05;
    while (this.nextT < c.currentTime + 0.12) {
      this._playStep(this.step, this.nextT);
      this.step = (this.step + 1) % this.cur.steps;
      this.nextT += this.cur.stepDur;
    }
  },
  _playStep(i, t) {
    const S = this.cur, def = S.def, sd = S.stepDur, bus = this.trackGain;
    if (!bus) return;
    const local = i % 16;
    if (def.swing && local % 2 === 1) t += sd * def.swing;
    const L = S.lead[i]; if (L) this._osc(def.lead === 'tri' ? 'triangle' : def.lead, mtof(L.n), t, sd * L.len * 0.95, 0.13, bus);
    const Bn = S.bass[i]; if (Bn) this._osc('triangle', mtof(Bn.n), t, sd * Bn.len * 0.9, 0.32, bus);
    const A = S.arp[i]; if (A) this._osc('p12', mtof(A.n), t, sd * 0.8, 0.045, bus);
    const P = S.pad[i]; if (P) P.notes.forEach((n) => this._osc('triangle', mtof(n), t, sd * P.len * 0.9, 0.045, bus, null, 0.08));
    const D = DRUMS[def.drums] || DRUMS.none;
    if (D.k.includes(local)) this._osc('sine', 150, t, 0.14, 0.5, bus, 40);
    if (D.s.includes(local)) this._noise(t, 0.12, 0.28, bus, 'bandpass', 1800);
    if (D.h.includes(local)) this._noise(t, 0.03, 0.12, bus, 'highpass', 7000);
  },
};
