// Bots and helpers shared by the tests and the balance report.
import { Game, TICK, ENEMIES, BUILDINGS, UNIT_KEYS, CAPACITY, PROMOTE } from '../server/game.js';

export function seeded(seed) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function newGame(seed = 1, players = 1) {
  const g = new Game(seeded(seed));
  const ids = Array.from({ length: players }, () => g.addPlayer());
  return { g, ids, id: ids[0] };
}

export function steps(g, n) { for (let i = 0; i < n; i++) g.step(TICK); }
export const seconds = (g, s) => steps(g, Math.round(s / TICK));

// Start wave 1 with an empty spawn queue, so a test controls every enemy itself.
// Add an enemy before stepping: a wave with nothing left ends at once.
export function emptyWave(g) {
  g.chooseWave([...g.players][0], 0);
  g.queue = [];
  g.enemies = [];
}

export function addEnemy(g, t, x, z, { hp = ENEMIES[t].hp, cd = 99 } = {}) {
  const e = { id: g.nextId++, t, x, z, hp, max: hp, cd };
  g.enemies.push(e);
  return e;
}

const RECRUIT_ORDER = ['archer', 'spear', 'archer', 'mage', 'archer', 'crossbow'];

// An average commander: repair, take the first perk, keep buying the cheapest thing on
// offer (upgrades, or the next defender in a fixed rotation), then pick a wave.
// pick: 'easy' | 'hard' | 'mixed' (hard on even waves, never on a Queen wave).
export function botTurn(g, id, { pick = 'easy', spend = true } = {}) {
  if (g.phase !== 'prep') return;
  if (spend) {
    g.repair(id, 'hall'); g.repair(id, 'walls');
    if (g.offer) g.choosePerk(id, g.offer[0]);
    for (let n = 0; n < 40; n++) {
      const opts = [];
      for (const k in BUILDINGS) {
        const l = g.b[k], d = BUILDINGS[k];
        if (l < d.max && (k === 'hall' || l < g.b.hall) && !(k === 'hall' && g.offer)) opts.push([d.cost[l], () => g.upgrade(id, k)]);
      }
      if (g.units.length < CAPACITY[g.b.walls]) {
        const k = RECRUIT_ORDER[g.units.length % RECRUIT_ORDER.length];
        opts.push([g.unitCost(k), () => g.recruit(id, k)]);
      }
      for (const k of UNIT_KEYS) {
        const t = g.tiers[k];
        if (t < PROMOTE.length && g.b.barracks >= t && g.units.some((u) => u.k === k)) opts.push([PROMOTE[t], () => g.promote(id, k)]);
      }
      opts.sort((a, b) => a[0] - b[0]);
      if (!opts.length || opts[0][0] > g.gold) break;
      opts[0][1]();
      if (g.offer) g.choosePerk(id, g.offer[0]);
    }
  }
  const next = g.wave + 1;
  const wantHard = pick === 'hard' || (pick === 'mixed' && next % 2 === 0 && next % 10 !== 0);
  g.chooseWave(id, g.waves.findIndex((w) => w.hard === wantHard));
}

export { UNIT_KEYS };
