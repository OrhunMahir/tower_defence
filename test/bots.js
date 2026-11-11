// Bots shared by the rule tests and the balance report.
import { S, BUILDINGS, GEAR } from '../server/game.js';

export function seeded(seed) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Stay inside, walk towards the nearest enemy, face it and attack.
export function botInput(g, p) {
  let best = null, bd = Infinity;
  for (const e of g.enemies) { const d = Math.hypot(e.x - p.x, e.z - p.z); if (d < bd) { bd = d; best = e; } }
  const lim = S - 2, home = { x: 0, z: 6 };
  const tgt = best ? { x: Math.max(-lim, Math.min(lim, best.x)), z: Math.max(-lim, Math.min(lim, best.z)) } : home;
  const dx = tgt.x - p.x, dz = tgt.z - p.z, d = Math.hypot(dx, dz);
  const hold = best && bd < (p.cls === 'knight' ? 2.5 : 14);
  return { mx: hold || d < 0.5 ? 0 : dx / d, mz: hold || d < 0.5 ? 0 : dz / d, aim: best ? Math.atan2(best.x - p.x, best.z - p.z) : 0, atk: !!best };
}

// An average player's spending: repair first, then keep buying the cheapest thing on offer.
export function botSpend(g, ps) {
  if (g.phase === 'prep') {
    g.repair(ps[0].id, 'hall'); g.repair(ps[0].id, 'walls');
    if (g.offer) g.choosePerk(ps[0].id, g.offer[0]);
    for (let n = 0; n < 20; n++) {
      const opts = [];
      for (const k in BUILDINGS) {
        const l = g.b[k], d = BUILDINGS[k];
        if (l < d.max && (k === 'hall' || l < g.b.hall) && !(k === 'hall' && g.offer)) opts.push([d.cost[l], () => g.upgrade(ps[0].id, k)]);
      }
      for (const p of ps) for (const kind in GEAR) {
        const t = p[kind];
        if (t < GEAR[kind].length && g.b.smith >= t) opts.push([GEAR[kind][t], () => g.buyGear(p.id, kind)]);
      }
      opts.sort((a, b) => a[0] - b[0]);
      if (!opts.length || opts[0][0] > g.gold) break;
      opts[0][1]();
      if (g.offer) g.choosePerk(ps[0].id, g.offer[0]);
    }
  }
  for (const p of ps) g.addStat(p.id, ['str', 'agi', 'vit', 'crit'][p.lvl % 4]);
}

// ---- Helpers for rule tests ----
import { Game, TICK, ENEMIES } from '../server/game.js';

export function newGame(classes = ['knight'], seed = 1) {
  const g = new Game(seeded(seed));
  const ps = classes.map((c) => g.addPlayer(c));
  return { g, ps, p: ps[0] };
}

// Advance the simulation; while preparing, keep the countdown from starting a wave.
export function steps(g, n, { holdPrep = true } = {}) {
  for (let i = 0; i < n; i++) { if (holdPrep && g.phase === 'prep') g.timer = 99; g.step(TICK); }
}
export const seconds = (g, s, opt) => steps(g, Math.round(s / TICK), opt);

// Start wave 1 with an empty spawn queue, so a test controls every enemy itself.
export function emptyWave(g) {
  for (const p of g.players.values()) g.setReady(p.id);
  g.step(TICK);
  g.queue = [];
  g.enemies = [];
}

export function addEnemy(g, t, x, z, { hp = ENEMIES[t].hp, cd = 99 } = {}) {
  const e = { id: g.nextId++, t, x, z, hp, max: hp, cd };
  g.enemies.push(e);
  return e;
}

export const idle = { mx: 0, mz: 0, aim: 0, atk: false };
