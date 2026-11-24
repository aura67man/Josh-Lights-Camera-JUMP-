// input.js - keyboard with rebindable actions (saved to localStorage) + optional gamepad
const STORE = 'josh_lcj_binds_v1';

export const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'attack', 'throw', 'dash', 'special', 'assist', 'pause'];
export const ACTION_LABELS = {
  left: 'MOVE LEFT', right: 'MOVE RIGHT', up: 'UP', down: 'DOWN / DROP', jump: 'JUMP',
  attack: 'CLAPPERBOARD', throw: 'THROW REEL', dash: 'DASH (TAKE TWO)', special: 'DRAMATIC POSE',
  assist: 'STUNT ASSIST', pause: 'PAUSE',
};
export const DEFAULT_BINDS = {
  left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
  jump: ['KeyZ', 'Space'], attack: ['KeyX', 'KeyJ'], throw: ['KeyC', 'KeyK'], dash: ['ShiftLeft', 'KeyL'],
  special: ['KeyV', 'KeyI'], assist: ['KeyB', 'KeyU'], pause: ['Escape', 'KeyP'],
};
// Standard gamepad mapping (not rebindable)
const PAD = { jump: [0], attack: [2], throw: [3], dash: [1, 7], special: [5], assist: [4, 6], pause: [9],
  up: [12], down: [13], left: [14], right: [15] };

const keys = new Set();
const just = new Set();
const justRep = new Set();
const cur = {}, prev = {}, justA = {};
let padCur = {}, padPrev = {};
let padConfirm = false, padConfirmPrev = false, padBack = false, padBackPrev = false, padStart = false, padStartPrev = false;
let capture = null;
let navHold = { dir: null, t: 0 };
const navRep = { up: false, down: false, left: false, right: false };

const PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'Backspace']);

function cloneBinds(b) { const o = {}; for (const a of ACTIONS) o[a] = [...(b[a] || [null, null])]; return o; }

export const Input = {
  binds: cloneBinds(DEFAULT_BINDS),
  anyKey: false,
  onFirstGesture: null,

  init() {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        const b = JSON.parse(raw);
        for (const a of ACTIONS) if (Array.isArray(b[a])) this.binds[a] = [b[a][0] ?? null, b[a][1] ?? null];
      }
    } catch (e) { /* ignore bad storage */ }

    window.addEventListener('keydown', (e) => {
      if (this.onFirstGesture) { const f = this.onFirstGesture; this.onFirstGesture = null; f(); }
      if (capture) {
        e.preventDefault();
        const cb = capture; capture = null;
        cb(e.code === 'Escape' ? null : e.code);
        return;
      }
      if (PREVENT.has(e.code) || this.isBound(e.code)) e.preventDefault();
      if (e.repeat) { justRep.add(e.code); return; }
      keys.add(e.code); just.add(e.code); this.anyKey = true;
    });
    window.addEventListener('keyup', (e) => { keys.delete(e.code); });
    window.addEventListener('blur', () => keys.clear());
    window.addEventListener('pointerdown', () => {
      if (this.onFirstGesture) { const f = this.onFirstGesture; this.onFirstGesture = null; f(); }
      this.anyKey = true; just.add('Pointer');
    });
  },

  isBound(code) { for (const a of ACTIONS) if (this.binds[a].includes(code)) return true; return false; },

  pollPad(dt) {
    padPrev = padCur; padCur = {};
    padConfirmPrev = padConfirm; padBackPrev = padBack; padStartPrev = padStart;
    padConfirm = padBack = padStart = false;
    let pads = [];
    try { pads = navigator.getGamepads ? navigator.getGamepads() : []; } catch (e) { pads = []; }
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const btn = (i) => p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.5);
      for (const a in PAD) if (PAD[a].some(btn)) padCur[a] = true;
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      if (ax < -0.45) padCur.left = true;
      if (ax > 0.45) padCur.right = true;
      if (ay < -0.55) padCur.up = true;
      if (ay > 0.55) padCur.down = true;
      if (btn(0)) padConfirm = true;
      if (btn(1)) padBack = true;
      if (btn(9)) padStart = true;
    }
    for (const a in padCur) if (padCur[a] && !padPrev[a]) this.anyKey = true;
    // gamepad menu auto-repeat
    const dir = ['up', 'down', 'left', 'right'].find((d) => padCur[d]) || null;
    navRep.up = navRep.down = navRep.left = navRep.right = false;
    if (dir && dir === navHold.dir) {
      navHold.t += dt;
      if (navHold.t > 0.38) { navHold.t -= 0.11; navRep[dir] = true; }
    } else { navHold.dir = dir; navHold.t = 0; }
  },

  update(dt) {
    this.pollPad(dt);
    for (const a of ACTIONS) {
      prev[a] = cur[a];
      const kb = this.binds[a].some((k) => k && keys.has(k));
      cur[a] = kb || !!padCur[a];
      justA[a] = this.binds[a].some((k) => k && just.has(k)) || (!!padCur[a] && !padPrev[a]);
    }
    this._just = new Set(just);
    this._rep = new Set(justRep);
    just.clear(); justRep.clear();
  },

  down(a) { return !!cur[a]; },
  pressed(a) { return !!justA[a]; },
  released(a) { return !cur[a] && !!prev[a]; },
  keyJust(code) { return this._just ? this._just.has(code) : false; },

  _nav(action, code) {
    const j = this._just || new Set(), r = this._rep || new Set();
    return justA[action] || j.has(code) || r.has(code) || this.binds[action].some((k) => k && r.has(k)) || navRep[action];
  },
  menuUp() { return this._nav('up', 'ArrowUp'); },
  menuDown() { return this._nav('down', 'ArrowDown'); },
  menuLeft() { return this._nav('left', 'ArrowLeft'); },
  menuRight() { return this._nav('right', 'ArrowRight'); },
  confirm() {
    const j = this._just || new Set();
    return j.has('Enter') || j.has('NumpadEnter') || j.has('Space') || justA.jump || (padConfirm && !padConfirmPrev);
  },
  back() {
    const j = this._just || new Set();
    return j.has('Escape') || j.has('Backspace') || justA.attack || (padBack && !padBackPrev);
  },
  skip() {
    const j = this._just || new Set();
    return j.has('Escape') || justA.pause || (padStart && !padStartPrev);
  },
  pausePressed() {
    const j = this._just || new Set();
    return justA.pause || j.has('Escape') || (padStart && !padStartPrev);
  },
  any() {
    const j = this._just || new Set();
    return j.size > 0 || Object.keys(padCur).some((a) => padCur[a] && !padPrev[a]) || (padConfirm && !padConfirmPrev);
  },

  startCapture(cb) { capture = cb; },
  capturing() { return !!capture; },

  setBind(action, slot, code) {
    if (code) for (const a of ACTIONS) for (let s = 0; s < 2; s++) if (this.binds[a][s] === code) this.binds[a][s] = null;
    this.binds[action][slot] = code;
    this.save();
  },
  resetBinds() { this.binds = cloneBinds(DEFAULT_BINDS); this.save(); },
  save() { try { localStorage.setItem(STORE, JSON.stringify(this.binds)); } catch (e) { /* storage full or blocked */ } },

  keyLabel(code) {
    if (!code) return '---';
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    if (code.startsWith('Numpad')) return 'NUM' + code.slice(6).toUpperCase();
    const map = { ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', ArrowUp: 'UP', ArrowDown: 'DOWN', Space: 'SPACE',
      ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT', ControlLeft: 'L-CTRL', ControlRight: 'R-CTRL', AltLeft: 'L-ALT',
      AltRight: 'R-ALT', Escape: 'ESC', Enter: 'ENTER', Backspace: 'BKSP', Tab: 'TAB', Semicolon: ';', Quote: "'",
      Comma: ',', Period: '.', Slash: '/', BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=', Backquote: '`',
      Backslash: '\\', CapsLock: 'CAPS', MetaLeft: 'META', MetaRight: 'META' };
    return map[code] || code.toUpperCase().slice(0, 8);
  },
  bindLabel(a) {
    const b = this.binds[a] || [];
    return this.keyLabel(b[0] || b[1]);
  },
};
