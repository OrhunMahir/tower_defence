// Bots and helpers shared by the tests and the balance report.
import { Game, TICK, ENEMIES, CASTLE, UNITS, UNIT_KEYS, RARITY, ITEMS, BUILDINGS, BUILDING_KEYS, BUILD_LEVEL_REQ, buildLevelReq, bossIndex, PATH_KEYS, MUTATIONS } from '../server/game.js';

export function seeded(seed) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// opts: siege, lord, classes, items, abilities (see Game).
export function newGame(seed = 1, players = 1, opts = {}) {
  const g = new Game(seeded(seed), opts);
  const ids = Array.from({ length: players }, () => g.addPlayer());
  return { g, ids, id: ids[0] };
}

export function steps(g, n) { for (let i = 0; i < n; i++) g.step(TICK); }
export const seconds = (g, s) => steps(g, Math.round(s / TICK));

// Start the next wave with an empty spawn queue, so a test controls every enemy itself.
// Add an enemy before stepping: a wave with nothing left ends at once.
// weather: what the day should be like (the forecast is overridden).
export function emptyWave(g, weather = 'clear') {
  g.forecast[0] = weather;
  g.chooseWave([...g.players][0], 0);
  g.queue = [];
  g.enemies = [];
}

export function addEnemy(g, t, x, z, { hp = ENEMIES[t].hp, cd = 99 } = {}) {
  const e = g.makeEnemy(t, x, z);
  Object.assign(e, { hp, max: hp, cd, hx: 1, pt: 999, bt: 999, under: false, shell: 0 });
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

// Accepts the first workable option of every pending reward.
export function takeRewards(g, id) {
  for (let i = 0; i < 300 && g.phase === 'reward'; i++) {
    const n = g.picks[0].opts ? g.picks[0].opts.length : 2;
    let ok = false;
    for (let j = 0; j < n && !ok; j++) ok = g.choose(id, j);
    if (!ok && !g.skip(id)) g.picks.shift(), g.nextPick();
  }
}

// Plays out the rest of a wave and accepts the first option of every reward.
export function finishWave(g, id) {
  for (let i = 0; i < 20 * 600 && g.phase === 'wave'; i++) g.step(TICK);
  takeRewards(g, id);
}

const STAT_RANK = { dmg: 10, aspd: 9, wallhp: 8, armor: 7, keephp: 6, crit: 6, range: 5, regen: 5, elem: 5, harvest: 4, eng: 3, luck: 3, xp: 4 };
// How much an average commander fears each mutation: they take the one they fear least.
const MUT_FEAR = { tunnel: 8, hide: 7, frenzy: 7, savage: 7, twin: 7, shell: 6, swell: 6, regrow: 6, champions: 6, raids: 5, undying: 5, might: 5, breach: 4,
  volatile: 4, wings: 4, plated: 3, warcry: 3, spawn: 3, dread: 3, venom: 3, escort: 3, rage: 3, thieves: 2, ward: 2 };
const BOON_WORTH = { relic: 3, level: 2, item: 2, promote: 1.5, stat: 1.5, gold: 1 };
const BUILD_ORDER = ['forge', 'barracks', 'mason', 'chapel', 'market', 'library', 'workshop', 'mint', 'tavern', 'watchtower'];

// How much an average commander likes a spoils option. They read the horde's adaptation: a
// recruit from a family the horde resists is worth less, one it has forgotten is worth more.
function spoilsValue(o, g) {
  const lean = (k) => -0.8 * g.adapt[UNITS[k].fam];
  if (o.type === 'recruit') return (o.swap ? 35 + 20 * (o.card.rar - o.out.rar) + (UNITS[o.card.k].path ? 25 : 0) : 100 + 20 * o.card.rar) + lean(o.card.k);
  if (o.type === 'promote') return 40 + 10 * (3 - o.rar);
  if (o.type === 'item') return 30 + 25 * ITEMS[o.key].r;
  if (o.type === 'turret') return 45;
  if (o.type === 'bless') return 25 + 10 * o.v;
  return 0;
}

function botRewards(g, id, spend) {
  for (let guard = 0; g.phase === 'reward' && guard < 300; guard++) {
    const p = g.picks[0];
    if (!spend) {
      if (p.type === 'spoils' || p.type === 'muster') { g.skip(id); continue; }
      // Even a miser has to answer an event or a relic: the cheapest way out.
      let ok = false;
      for (let j = p.opts.length - 1; j >= 0 && !ok; j--) ok = g.choose(id, j);
      if (!ok) { g.picks.shift(); g.nextPick(); }
      continue;
    }
    const score = (o) => (p.type === 'level' ? STAT_RANK[o.stat] + 4 * o.r : p.type === 'spoils' ? spoilsValue(o, g)
      : p.type === 'mutation' ? BOON_WORTH[o.boon.k] - MUT_FEAR[o.key] * (1 + 0.3 * o.lv) : 0);
    const order = p.opts.map((o, i) => i).sort((a, b) => score(p.opts[b]) - score(p.opts[a]));
    let ok = false;
    for (const i of order) if ((ok = g.choose(id, i))) break;
    if (!ok && !g.skip(id)) { g.picks.shift(); g.nextPick(); }
  }
}

// An average commander: takes the best-looking reward, advances the age when allowed, repairs,
// then keeps buying the cheapest useful thing (castle levels, buildings, shop offers, training),
// picks specialisations and finally a wave.
// pick: 'easy' | 'hard' | 'mixed' (hard on even waves, never on a boss wave).
// path: which path of ages to follow after the Golden Age (by default it depends on the lord's army).
export function botTurn(g, id, { pick = 'easy', spend = true, abilities = spend, path = null } = {}) {
  if (g.phase === 'wave') { if (abilities) useAbilities(g, id); return; }
  botRewards(g, id, spend);
  if (g.phase !== 'prep') return;
  if (spend) {
    for (const u of g.units) if (g.canSpecialize(u)) g.specialize(id, u.uid, 1 + (u.uid % 2));
    g.repair(id, 'hall'); g.repair(id, 'walls');
    const ar = g.ageReq();
    if (ar && ar.boss && ar.level) {
      if (g.advanceAge(id, path || PATH_KEYS[(g.level + g.units.length) % PATH_KEYS.length])) { botRewards(g, id, true); if (g.phase !== 'prep') return; }
    }
    // While an age is within reach, keep the gold for it.
    const saving = ar && ar.boss && ar.level && g.gold < ar.cost && g.gold >= ar.cost * 0.5;
    for (let n = 0; n < 200 && !saving; n++) {
      const opts = [];
      for (const k in CASTLE) {
        const l = g.b[k], d = CASTLE[k];
        if (l < d.max && l < g.castleCap() && (k === 'hall' || l < g.b.hall)) opts.push([d.cost[l] * (k === 'walls' && g.army().length >= g.capacity() - 1 ? 0.25 : 0.45), () => g.upgrade(id, k)]);
      }
      const free = g.plots.findIndex((p, i) => !p && i < g.plotCount());
      if (free >= 0 && g.level >= BUILD_LEVEL_REQ[1]) {
        const k = BUILD_ORDER.find((b) => BUILDINGS[b].age <= g.age + 1 && !g.bLv(b));
        if (k) opts.push([g.buildingCost(k, 1) * 0.5, () => g.build(id, free, k)]);
      }
      g.plots.forEach((p, i) => {
        if (p && p.lv < g.buildingCap() && g.level >= buildLevelReq(p.lv + 1)) opts.push([g.buildingCost(p.k, p.lv + 1) * 0.6, () => g.upgradeBuilding(id, i)]);
      });
      g.shop.forEach((o, i) => { if (o) opts.push([o.price * 0.6, () => g.buy(id, i)]); });
      let weak = null;
      for (const u of g.army()) if (!weak || g.trainCost(u) < g.trainCost(weak)) weak = u;
      if (weak) opts.push([g.trainCost(weak) * 1.4, () => g.train(id, weak.uid)]);
      opts.sort((a, b) => a[0] - b[0]);
      if (!opts.length || opts[0][0] > g.gold) break;
      if (!opts[0][1]()) break;
    }
  }
  const next = g.wave + 1;
  const want = pick === 'hard' || (pick === 'mixed' && next % 2 === 0 && bossIndex(next) < 0) ? 'hard' : 'std';
  const i = g.waves.findIndex((w) => w.tier === want);
  g.chooseWave(id, i < 0 ? 0 : i);
}

// During a wave: arrows (or a meteor) on the thickest crowd near the walls, mend when the walls
// are hurt, rally, freeze or a bounty hunt when many monsters are close.
function useAbilities(g, id) {
  const near = () => g.enemies.filter((e) => Math.hypot(e.x, e.z) < 26).length;
  for (const k of g.loadout) {
    if (g.abil[k]) continue;
    if (k === 'volley' || k === 'meteor') {
      let best = null, score = 0;
      for (const e of g.enemies) {
        if (Math.hypot(e.x, e.z) > 30 || e.under) continue;
        let c = 0;
        for (const o of g.enemies) if (Math.hypot(o.x - e.x, o.z - e.z) < 5) c++;
        if (c > score) { score = c; best = e; }
      }
      if (best && score >= 4) g.ability(id, k, best.x, best.z);
    } else if (k === 'mend') {
      const hp = g.segs.reduce((a, s) => a + s.hp, 0), max = g.segs.reduce((a, s) => a + s.max, 0);
      if (hp < max * 0.7) g.ability(id, 'mend');
    } else if (k === 'caltrops') {
      const e = g.enemies.find((m) => !m.under && Math.hypot(m.x, m.z) < 24 && Math.hypot(m.x, m.z) > 16);
      if (e && near() >= 8) g.ability(id, k, e.x, e.z);
    } else if (k === 'laststand') {
      if (g.th.hp < g.th.max * 0.35) g.ability(id, k);
    } else if (near() >= 12) g.ability(id, k);
  }
}

export { UNIT_KEYS, RARITY, BUILDING_KEYS, MUTATIONS };
