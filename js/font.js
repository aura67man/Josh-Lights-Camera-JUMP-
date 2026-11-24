// font.js - built-in 5px-tall bitmap font (no external fonts). Glyph atlas cached per colour.
import { makeCanvas } from './engine.js';

const GLYPHS = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'], C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'], E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'], H: ['#.#', '#.#', '###', '#.#', '#.#'], I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'], K: ['#.#', '#.#', '##.', '#.#', '#.#'], L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'], N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'], P: ['##.', '#.#', '##.', '#..', '#..'], Q: ['.#.', '#.#', '#.#', '##.', '.##'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'], S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'], V: ['#.#', '#.#', '#.#', '#.#', '.#.'], W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'], Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], Z: ['###', '..#', '.#.', '#..', '###'],
  0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['##.', '..#', '.#.', '#..', '###'],
  3: ['##.', '..#', '.#.', '..#', '##.'], 4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '##.', '..#', '##.'],
  6: ['.##', '#..', '###', '#.#', '###'], 7: ['###', '..#', '.#.', '.#.', '.#.'], 8: ['###', '#.#', '###', '#.#', '###'],
  9: ['###', '#.#', '###', '..#', '##.'],
  '.': ['.', '.', '.', '.', '#'], ',': ['.', '.', '.', '#', '#'], '!': ['#', '#', '#', '.', '#'], '?': ['##.', '..#', '.#.', '...', '.#.'],
  "'": ['#', '#', '.', '.', '.'], '"': ['#.#', '#.#', '...', '...', '...'], '-': ['...', '...', '###', '...', '...'],
  '+': ['...', '.#.', '###', '.#.', '...'], ':': ['.', '#', '.', '#', '.'], ';': ['.', '#', '.', '#', '#'],
  '/': ['..#', '..#', '.#.', '#..', '#..'], '(': ['.#', '#.', '#.', '#.', '.#'], ')': ['#.', '.#', '.#', '.#', '#.'],
  '*': ['#.#', '.#.', '#.#', '...', '...'], '%': ['#.#', '..#', '.#.', '#..', '#.#'], '&': ['.#.', '#.#', '.#.', '#.#', '.##'],
  '=': ['...', '###', '...', '###', '...'], '<': ['..#', '.#.', '#..', '.#.', '..#'], '>': ['#..', '.#.', '..#', '.#.', '#..'],
  '[': ['##', '#.', '#.', '#.', '##'], ']': ['##', '.#', '.#', '.#', '##'], '_': ['...', '...', '...', '...', '###'],
  '#': ['#.#', '###', '#.#', '###', '#.#'], '$': ['.##', '##.', '.#.', '.##', '##.'], '`': ['#.', '.#', '..', '..', '..'],
  '\\': ['#..', '#..', '.#.', '..#', '..#'], '~': ['....', '.#.#', '#.#.', '....', '....'],
  '^': ['#####', '.###.', '..#..', '.....', '.....'], // down-pointing "next" arrow
  '@': ['.#.#.', '#####', '#####', '.###.', '..#..'], // heart
  '|': ['#', '#', '#', '#', '#'],
  ' ': ['..', '..', '..', '..', '..'],
};

const CH = 5, LINE = 7;
let atlasW = 0;
const map = {};
let baseAtlas = null;
const tinted = {};

export function initFont() {
  let x = 0;
  for (const ch in GLYPHS) { const g = GLYPHS[ch]; map[ch] = { x, w: g[0].length }; x += g[0].length + 1; }
  atlasW = x;
  const [c, cx] = makeCanvas(atlasW, CH);
  cx.fillStyle = '#fff';
  for (const ch in GLYPHS) {
    const g = GLYPHS[ch], m = map[ch];
    for (let r = 0; r < CH; r++) for (let i = 0; i < g[r].length; i++) if (g[r][i] === '#') cx.fillRect(m.x + i, r, 1, 1);
  }
  baseAtlas = c;
}

function atlasFor(col) {
  if (tinted[col]) return tinted[col];
  const [c, cx] = makeCanvas(atlasW, CH);
  cx.drawImage(baseAtlas, 0, 0);
  cx.globalCompositeOperation = 'source-in';
  cx.fillStyle = col; cx.fillRect(0, 0, atlasW, CH);
  tinted[col] = c;
  return c;
}

const norm = (s) => String(s).toUpperCase();

export function textWidth(str, scale = 1) {
  const s = norm(str);
  let w = 0;
  for (const ch of s) { const m = map[ch] || map['?']; w += m.w + 1; }
  return Math.max(0, w - 1) * scale;
}

// opts: {col, align:'left'|'center'|'right', shadow:true|colour, scale, outline}
export function drawText(c, str, x, y, opts = {}) {
  const s = norm(str);
  const scale = opts.scale || 1;
  const col = opts.col || '#fff';
  let w = textWidth(s, scale);
  let sx = Math.round(x);
  if (opts.align === 'center') sx = Math.round(x - w / 2);
  else if (opts.align === 'right') sx = Math.round(x - w);
  const sy = Math.round(y);
  const pass = (atlas, ox, oy) => {
    let cx = sx + ox;
    for (const ch of s) {
      const m = map[ch] || map['?'];
      c.drawImage(atlas, m.x, 0, m.w, CH, cx, sy + oy, m.w * scale, CH * scale);
      cx += (m.w + 1) * scale;
    }
  };
  if (opts.outline) {
    const oc = atlasFor(opts.outline === true ? '#000' : opts.outline);
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) pass(oc, ox, oy);
  } else if (opts.shadow !== false) {
    pass(atlasFor(typeof opts.shadow === 'string' ? opts.shadow : '#000'), scale, scale);
  }
  pass(atlasFor(col), 0, 0);
  return w;
}

// Word wrap into lines that fit pixel width
export function wrap(str, maxW, scale = 1) {
  const words = norm(str).split(/\s+/);
  const lines = [];
  let line = '';
  for (const wd of words) {
    const t = line ? line + ' ' + wd : wd;
    if (textWidth(t, scale) > maxW && line) { lines.push(line); line = wd; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

export const LINE_H = LINE;
