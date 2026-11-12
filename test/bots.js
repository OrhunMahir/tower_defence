// Bots and helpers shared by the tests and the balance report.
import { Game, TICK, ENEMIES, BUILDINGS, UNITS, UNIT_KEYS, CAPACITY, RARITY, ITEMS } from '../server/game.js';

export function seeded(seed) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function newGame(seed = 1, players = 1, diff = 'normal') {
  const g = new Game(seeded(seed), diff);
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
  const e = { id: g.nextId++, t, x, z, hp, max: hp, cd, slow: 0, slowK: 0, burn: 0, burnDps: 0, curse: 0, curseK: 0, hold: -2, bt: 99, hx: 1 };
  g.enemies.push(e);
  return e;
}

// A defender of class k with base stats, as a recruit card would describe it.
export function card(k, extra = {}) {
  const d = UNITS[k];
  return { k, rar: 0, lv: 1, p: d.p, cd: d.cd, range: d.range, traits: [], name: 'Test', ...extra };
}

// Places a defender on a given slot directly (tests only).
export function place(g, k, slot, extra) { const u = g.newUnit(card(k, extra), slot); g.units.push(u); g.refreshDerived(); return u; }

// Plays out the rest of a wave and accepts the first option of every reward.
export function finishWave(g, id) {
  for (let i = 0; i < 20 * 600 && g.phase === 'wave'; i++) g.step(TICK);
  for (let i = 0; i < 100 && g.phase === 'reward'; i++) if (!g.choose(id, 0)) g.skip(id);
}

const STAT_RANK = { dmg: 10, aspd: 9, wallhp: 8, armor: 7, keephp: 6, crit: 6, range: 5, regen: 5, elem: 5, harvest: 4, eng: 3, luck: 3, xp: 3 };

// How much an average commander likes a spoils option.
function spoilsValue(o) {
  if (o.type === 'recruit') return 100 + 20 * o.card.rar;
  if (o.type === 'promote') return 40 + 10 * (3 - o.rar);
  if (o.type === 'item') return 30 + 25 * ITEMS[o.key].r;
  if (o.type === 'turret') return 45;
  if (o.type === 'bless') return 25 + 10 * o.v;
  return 0;
}

// An average commander: takes the best-looking reward, repairs, then keeps buying the cheapest
// useful thing (a building level, a shop offer or training the weakest defender), then picks a wave.
// pick: 'easy' | 'hard' | 'mixed' (hard on even waves, never on a boss wave).
export function botTurn(g, id, { pick = 'easy', spend = true, abilities = spend } = {}) {
  if (g.phase === 'wave') { if (abilities) useAbilities(g, id); return; }
  for (let guard = 0; g.phase === 'reward' && guard < 100; guard++) {
    const p = g.picks[0];
    if (p.type === 'victory') { g.choose(id, 0); continue; }
    if (!spend) { if (p.type === 'spoils') g.skip(id); else g.choose(id, 0); continue; }
    const score = (o) => (p.type === 'level' ? STAT_RANK[o.stat] + 4 * o.r : spoilsValue(o));
    let best = 0;
    p.opts.forEach((o, i) => { if (score(o) > score(p.opts[best])) best = i; });
    if (!g.choose(id, best)) g.skip(id);
  }
  if (g.phase !== 'prep') return;
  if (spend) {
    g.repair(id, 'hall'); g.repair(id, 'walls');
    for (let n = 0; n < 200; n++) {
      const opts = [];
      for (const k in BUILDINGS) {
        const l = g.b[k], d = BUILDINGS[k];
        if (l < d.max && (k === 'hall' || l < g.b.hall)) opts.push([d.cost[l] * (k === 'walls' && g.units.length >= CAPACITY[l] - 1 ? 0.25 : 0.45), () => g.upgrade(id, k)]);
      }
      g.shop.forEach((o, i) => { if (o) opts.push([o.price * 0.6, () => g.buy(id, i)]); });
      let weak = null;
      for (const u of g.units) if (!weak || g.trainCost(u) < g.trainCost(weak)) weak = u;
      if (weak) opts.push([g.trainCost(weak) * 1.4, () => g.train(id, weak.uid)]);
      opts.sort((a, b) => a[0] - b[0]);
      if (!opts.length || opts[0][0] > g.gold) break;
      if (!opts[0][1]()) break;
    }
  }
  const next = g.wave + 1;
  const wantHard = pick === 'hard' || (pick === 'mixed' && next % 2 === 0 && next % 10 !== 0);
  g.chooseWave(id, g.waves.findIndex((w) => w.hard === wantHard));
}

// During a wave: arrows on the thickest crowd near the walls, mend when the walls are hurt,
// rally when many monsters are close.
function useAbilities(g, id) {
  if (!g.abil.volley) {
    let best = null, score = 0;
    for (const e of g.enemies) {
      if (Math.hypot(e.x, e.z) > 30) continue;
      let c = 0;
      for (const o of g.enemies) if (Math.hypot(o.x - e.x, o.z - e.z) < 5) c++;
      if (c > score) { score = c; best = e; }
    }
    if (best && score >= 4) g.ability(id, 'volley', best.x, best.z);
  }
  if (!g.abil.mend) {
    const hp = g.segs.reduce((a, s) => a + s.hp, 0), max = g.segs.reduce((a, s) => a + s.max, 0);
    if (hp < max * 0.7) g.ability(id, 'mend');
  }
  if (!g.abil.rally && g.enemies.filter((e) => Math.hypot(e.x, e.z) < 26).length >= 12) g.ability(id, 'rally');
}

export { UNIT_KEYS, RARITY };
