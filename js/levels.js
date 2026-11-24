// levels.js - world definitions + seeded tile-level builder (corridors, wave arenas, secrets, checkpoints)
import { TILE, T_EMPTY, T_SOLID, T_PLAT, T_BREAK, makeRng, clamp } from './engine.js';

export const WORLDS = [
  { name: 'SCHOOL DRAMA HALL', scene: 'SCENE 1', tier: 1, music: 'w1', waves: 3, corridor: 30, seed: 101,
    roster: { walker: 'critic', hopper: 'chair', thrower: 'tomato' }, mini: 'spotlight', boss: 'harshCritic' },
  { name: 'BACKLOT STREET', scene: 'SCENE 2', tier: 2, music: 'w2', waves: 3, corridor: 32, seed: 202,
    roster: { walker: 'stagehand', hopper: 'trashcan', thrower: 'sandbagger', flyer: 'boommic' }, mini: 'craig', boss: 'brutus' },
  { name: 'HAUNTED HORROR SET', scene: 'SCENE 3', tier: 3, music: 'w3', waves: 3, corridor: 34, seed: 303,
    roster: { walker: 'zombie', hopper: 'pumpkin', thrower: 'skeleton', flyer: 'costume' }, mini: 'rack', boss: 'wraith' },
  { name: 'SCI-FI SPACESHIP SET', scene: 'SCENE 4', tier: 4, music: 'w4', waves: 4, corridor: 30, seed: 404,
    roster: { walker: 'robot', hopper: 'goo', thrower: 'laserbot', flyer: 'drone' }, mini: 'finn', boss: 'mech' },
  { name: 'WESTERN STUNT SET', scene: 'SCENE 5', tier: 5, music: 'w5', waves: 4, corridor: 32, seed: 505,
    roster: { walker: 'bandit', hopper: 'tumbleweed', thrower: 'dynamite', flyer: 'vulture' }, mini: 'tumbleking', boss: 'dusty' },
  { name: 'THE PREMIERE', scene: 'SCENE 6', tier: 6, music: 'w6', waves: 4, corridor: 30, seed: 606,
    roster: { walker: 'paparazzi', hopper: 'statue', thrower: 'flasher', flyer: 'papdrone' }, mini: 'papprime', boss: 'finalcut' },
];

export const ROWS = 12, GROUND = 9; // ground top row (rows 9..11 are solid at h=0)

export class Level {
  constructor(cols, rows) {
    this.cols = cols; this.rows = rows;
    this.t = new Uint8Array(cols * rows);
    this.pxW = cols * TILE; this.pxH = rows * TILE;
  }
  get(tx, ty) {
    if (tx < 0 || tx >= this.cols) return T_SOLID;
    if (ty < 0 || ty >= this.rows) return T_EMPTY;
    return this.t[ty * this.cols + tx];
  }
  set(tx, ty, v) { if (tx >= 0 && tx < this.cols && ty >= 0 && ty < this.rows) this.t[ty * this.cols + tx] = v; }
  groundTopAt(tx) { for (let ty = 0; ty < this.rows; ty++) { const t = this.get(tx, ty); if (t === T_SOLID || t === T_BREAK) return ty; } return -1; }
}

function waveDef(world, wi, rng) {
  const R = world.roster, t = world.tier;
  const pool = [R.walker, R.walker, R.hopper];
  if (wi >= 1 || t >= 2) pool.push(R.thrower);
  if (R.flyer && (wi >= 1 || t >= 3)) pool.push(R.flyer);
  const n = 3 + wi + Math.floor(t / 2);
  const bursts = [[], []];
  const half = Math.ceil(n / 2);
  for (let i = 0; i < n; i++) bursts[i < half ? 0 : 1].push(pool[Math.floor(rng() * pool.length)]);
  if (t >= 4 && wi === world.waves - 1) bursts.push([R.walker, R.thrower, R.flyer || R.hopper]);
  return bursts;
}

export function buildLevel(index) {
  const world = WORLDS[index];
  const rng = makeRng(world.seed);
  const order = [];
  const nW = world.waves, midAfter = 2; // mini-boss after wave 2 (midway)
  for (let i = 0; i < nW; i++) { order.push({ kind: 'wave', wave: i }); if (i + 1 === midAfter) order.push({ kind: 'mini' }); }
  order.push({ kind: 'boss' });

  const corLen = world.corridor;
  const cols = 8 + order.length * (corLen + 40) + 20;
  let L = new Level(cols, ROWS);
  const pickups = [], spawns = [], decor = [], segments = [], checkpoints = [];
  const secrets = { cooker: null, sebastian: null };
  let col = 0;
  const setGround = (c, h) => { for (let ty = GROUND - h; ty < ROWS; ty++) L.set(c, ty, T_SOLID); };
  const grain = (x, y) => pickups.push({ type: 'grain', x, y });
  const bowl = (x, y) => pickups.push({ type: 'bowl', x, y });
  const flat = (n, h, rice = false) => {
    for (let i = 0; i < n; i++) {
      setGround(col, h);
      if (rice && i % 2 === 0) grain(col * TILE + 8, (GROUND - h) * TILE - 10);
      col++;
    }
  };
  const cooker = rng.i(0, 1) ? 1 : 2; // corridor index holding the vault
  const sebCor = cooker === 1 ? 3 : 1; // corridor index holding Sebastian
  const roamPool = [world.roster.walker, world.roster.hopper];
  if (world.tier >= 2) roamPool.push(world.roster.thrower);
  if (world.tier >= 3 && world.roster.flyer) roamPool.push(world.roster.flyer);

  const corridor = (len, ci) => {
    const end = col + len;
    let h = 0;
    flat(4, 0);
    let roam = 0;
    const vaultAt = ci === cooker ? col + Math.floor(len * 0.4) : -1;
    const sebAt = ci === sebCor ? col + Math.floor(len * 0.55) : -1;
    const placeVault = () => {
      // Secret vault: 5x3 block, cavity behind a breakable "prop wall"
      flat(2, h);
      const cx = col, gr = GROUND - h;
      flat(5, h);
      for (let i = 0; i < 5; i++) for (let r = 1; r <= 3; r++) L.set(cx + i, gr - r, T_SOLID);
      for (let i = 1; i <= 3; i++) for (let r = 1; r <= 2; r++) L.set(cx + i, gr - r, T_EMPTY);
      L.set(cx, gr - 1, T_BREAK); L.set(cx, gr - 2, T_BREAK);
      secrets.cooker = { x: (cx + 2) * TILE + 8, y: (gr - 1) * TILE + 8 };
      pickups.push({ type: 'cooker', x: secrets.cooker.x, y: secrets.cooker.y });
      grain((cx + 2) * TILE + 8, (gr - 3) * TILE - 10);
      flat(3, h);
    };
    const placeSeb = () => {
      // Hidden high ledge (always built from base ground so it stays on screen below the HUD)
      while (h > 0) { h--; flat(2, h); }
      const gr = GROUND - h, sx = col;
      flat(8, h);
      for (let i = 0; i < 3; i++) L.set(sx + i, gr - 3, T_PLAT);
      for (let i = 3; i < 7; i++) L.set(sx + i, gr - 5, T_PLAT);
      secrets.sebastian = { x: (sx + 5) * TILE + 8, y: (gr - 5) * TILE };
      bowl((sx + 1) * TILE + 8, (gr - 3) * TILE - 12);
    };
    while (col < end - 7) {
      if (vaultAt >= 0 && col >= vaultAt && !secrets.cooker) { placeVault(); continue; }
      if (sebAt >= 0 && col >= sebAt && !secrets.sebastian) { placeSeb(); continue; }
      const r = rng();
      if (r < 0.2 && col > 12) { // pit gap
        const gw = rng.i(2, 3);
        const gy = (GROUND - h) * TILE;
        for (let i = 0; i < gw; i++) { if (i === Math.floor(gw / 2)) grain(col * TILE + 8, gy - 34); col++; }
        flat(3, h);
      } else if (r < 0.38) { // step up / down
        h = clamp(h + (rng() < 0.5 || h === 2 ? -1 : 1), 0, 2);
        flat(rng.i(3, 5), h, true);
      } else if (r < 0.6) { // floating platforms with rice
        const pw = rng.i(3, 5), start = col + 1, pr = GROUND - h - 3;
        flat(pw + 2, h);
        for (let i = 0; i < pw; i++) { L.set(start + i, pr, T_PLAT); grain((start + i) * TILE + 8, pr * TILE - 8); }
        if (h === 0 && rng() < 0.5) { const hr = pr - 3; L.set(start + 1, hr, T_PLAT); L.set(start + 2, hr, T_PLAT); bowl((start + 1) * TILE + 16, hr * TILE - 10); }
      } else if (r < 0.72) { // pillar / crate block
        flat(2, h);
        const ph = rng.i(1, 2), pw = rng.i(1, 2);
        for (let i = 0; i < pw; i++) { setGround(col, h); for (let k = 1; k <= ph; k++) L.set(col, GROUND - h - k, T_SOLID); col++; }
        grain((col - 1) * TILE + 8, (GROUND - h - ph) * TILE - 10);
        flat(2, h);
      } else {
        const n = rng.i(4, 7);
        const sc = col;
        flat(n, h, true);
        if (roam < 2 + Math.floor(world.tier / 2) && sc > 14) {
          spawns.push({ type: roamPool[Math.floor(rng() * roamPool.length)], x: (sc + 2) * TILE, y: (GROUND - h) * TILE - 24 });
          roam++;
        }
        if (rng() < 0.5) decor.push({ x: (sc + 1) * TILE + rng.i(0, 16), y: (GROUND - h) * TILE, v: rng.i(0, 2) });
      }
    }
    if (vaultAt >= 0 && !secrets.cooker) placeVault();
    if (sebAt >= 0 && !secrets.sebastian) placeSeb();
    while (h > 0) { h--; flat(2, h); }
    flat(Math.max(6, end - col), 0);
  };

  flat(4, 0);
  order.forEach((seg, i) => {
    corridor(corLen, i);
    checkpoints.push({ x: (col - 4) * TILE, y: GROUND * TILE, seg: i, active: false });
    const a = col;
    flat(20, 0);
    const P = (c0, c1, row) => { for (let c = c0; c <= c1; c++) L.set(a + c, row, T_PLAT); };
    if (seg.kind === 'boss') { P(1, 3, 6); P(16, 18, 6); }
    else { P(3, 6, 6); P(13, 16, 6); if (world.tier >= 3 && seg.kind === 'wave') P(8, 11, 3); }
    segments.push({ ...seg, x0: a * TILE, x1: (a + 20) * TILE, state: 'pending',
      bursts: seg.kind === 'wave' ? waveDef(world, seg.wave, rng) : null });
    // rice in arenas
    for (let k = 0; k < 4; k++) grain((a + 4 + k * 4) * TILE + 8, GROUND * TILE - 10);
  });
  flat(6, 0);
  for (let i = 0; i < 4; i++) { for (let ty = 0; ty < ROWS; ty++) L.set(col, ty, T_SOLID); col++; }
  // trim to used width
  const T2 = new Level(col, ROWS);
  for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < col; tx++) T2.set(tx, ty, L.get(tx, ty));
  L = T2;

  return { world, index, L, pickups, spawns, decor, segments, checkpoints, secrets,
    start: { x: 2 * TILE, y: GROUND * TILE } };
}
