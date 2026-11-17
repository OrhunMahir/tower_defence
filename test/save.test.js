// Saving and continuing a run, and rejecting anything malformed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, START_GOLD, LORDS, ITEMS, ITEM_KEYS, UNITS, UNIT_KEYS, AGES, LAST_AGE, seededRng } from '../server/game.js';
import { newGame, botTurn, seconds, seeded, takeRewards, steps } from './bots.js';

// A run that has got somewhere: a few waves played by the bot.
function played(waves = 6) {
  const { g, id } = newGame(7);
  while (g.wave < waves) { botTurn(g, id); seconds(g, 1); }
  while (g.phase === 'wave') { botTurn(g, id); seconds(g, 1); }
  return { g, id };
}
const copy = (g) => JSON.parse(JSON.stringify(g.save()));

test('a saved run continues where it left off', () => {
  const { g, id } = played();
  takeRewards(g, id);
  g.addItem('whetstone'); g.addItem('oil'); g.addTurret('bolt'); g.addTurret('bolt');
  g.st.crit = 12; g.bless.archer = 2; g.refreshDerived(); g.segs[5].hp = 77; g.th.hp = g.th.max - 300;
  g.shop[0] = { type: 'item', key: 'crown', price: 1, locked: true };
  g.units = g.army(); g.refreshDerived();
  g.units[0].spec = 2; g.capBonus = 2; g.eggAt = 40; g.wallsLost = 3; g.battleT = 321.4;
  const h = new Game(seeded(99));
  assert.ok(h.load(copy(g)));
  assert.equal(h.phase, 'prep');
  assert.equal(h.wave, g.wave); assert.equal(h.gold, Math.floor(g.gold)); assert.equal(h.siege, g.siege); assert.equal(h.lord, g.lord);
  assert.deepEqual(h.b, g.b); assert.deepEqual(h.st, g.st); assert.deepEqual(h.items, g.items); assert.deepEqual(h.bless, g.bless);
  assert.deepEqual(h.turrets.map((t) => [t.k, t.lv, t.spot]), g.turrets.map((t) => [t.k, t.lv, t.spot]));
  assert.equal(h.level, g.level); assert.deepEqual(h.stats, g.stats);
  assert.deepEqual(h.tot, g.tot); assert.deepEqual(h.famTier, g.famTier);
  assert.equal(h.th.hp, g.th.hp); assert.equal(h.th.max, g.th.max);
  assert.equal(h.segs[5].hp, 77);
  const strip = (u) => [u.slot, u.k, u.name, u.rar, u.lv, u.p, u.rcd, u.range, u.traits, u.kills, u.spec];
  assert.deepEqual(h.units.map(strip), g.army().map(strip));
  assert.equal(new Set(h.units.map((u) => u.uid)).size, h.units.length, 'fresh unique ids');
  assert.equal(h.waves.length, 2);
  assert.equal(h.shop[0].key, 'crown'); assert.ok(h.shop[0].locked, 'locked offers are kept');
  assert.deepEqual([h.capBonus, h.eggAt, h.wallsLost, h.battleT], [2, 40, 3, 321]);
  assert.equal(h.runId, g.runId, 'the same run, so its renown is counted once');
});

test('ages, buildings, doctrines and the unlocked pools are saved with the run', () => {
  const { g, id } = newGame(3, 1, { siege: 4, lord: 'merchant', classes: ['archer', 'mage', 'spear', 'cleric'], items: ITEM_KEYS.filter((k) => !ITEMS[k].relic).slice(0, 12), abilities: ['meteor', 'freeze', 'mend'], daily: true });
  g.bossWaves = 2; g.age = 2; g.doctrines = ['moat', 'treasury']; g.level = 15; g.xp = 9.5; g.gold = 5000;
  g.refreshDerived();
  assert.ok(g.build(id, 0, 'forge')); assert.ok(g.upgradeBuilding(id, 0)); assert.ok(g.build(id, 3, 'library'));
  g.phoenixUsed = true; g.muts = { hide: 2, twin: 1 }; g.adapt.marksmen = 16; g.adapt.arcane = -8; g.dealt.alchemy = 512.4; g.lastAdapt = 'marksmen';
  const h = new Game();
  assert.ok(h.load(copy(g)));
  assert.deepEqual([h.siege, h.lord, h.age, h.bossWaves, h.daily], [4, 'merchant', 2, 2, true]);
  assert.deepEqual(h.doctrines, ['moat', 'treasury']);
  assert.deepEqual(h.plots.map((p) => p && [p.k, p.lv]), [['forge', 2], null, null, ['library', 1], null, null, null]);
  assert.equal(h.plots[0].paid, g.plots[0].paid, 'so a demolition still refunds the right amount');
  assert.deepEqual([...h.classes], ['archer', 'mage', 'spear', 'cleric']); assert.equal(h.itemPool.size, 12);
  assert.deepEqual(h.loadout, ['meteor', 'freeze', 'mend']);
  assert.ok(h.phoenixUsed);
  assert.deepEqual(h.muts, { hide: 2, twin: 1 }); assert.deepEqual(h.adapt, g.adapt); assert.equal(h.dealt.alchemy, 512); assert.equal(h.lastAdapt, 'marksmen');
  assert.deepEqual(h.forecast, g.forecast, 'the weather that was forecast still comes');
  assert.equal(h.path, null);
  assert.deepEqual(h.tot, g.tot); assert.equal(h.level, 15); assert.equal(h.xp, 9.5);
  assert.deepEqual(h.ageReq(), g.ageReq());
});

test('a run saved between rewards continues with its choices still waiting', () => {
  const { g, id } = played(8);
  assert.equal(g.phase, 'reward');
  const types = g.picks.map((p) => p.type);
  assert.ok(types.includes('relic'), 'a boss wave was just won');
  const h = new Game(seeded(5));
  assert.ok(h.load(copy(g)));
  assert.equal(h.phase, 'reward');
  assert.deepEqual(h.picks.map((p) => p.type), types);
  assert.ok(h.picks[0].opts.length >= 2);
  const hid = h.addPlayer();
  takeRewards(h, hid);
  assert.equal(h.phase, 'prep'); assert.equal(h.waves.length >= 2, true);
  assert.ok(id);
});

test('a save taken while a doctrine is being chosen offers it again', () => {
  const { g, id } = newGame();
  g.bossWaves = 1; g.level = 6; g.gold = 250;
  assert.ok(g.advanceAge(id));
  const h = new Game(seeded(2));
  assert.ok(h.load(copy(g)));
  assert.equal(h.age, 1); assert.equal(h.gold, 0);
  assert.equal(h.phase, 'reward'); assert.equal(h.picks[0].type, 'doctrine'); assert.equal(h.picks[0].opts.length, 3);
  const hid = h.addPlayer();
  assert.ok(h.choose(hid, 0));
  assert.equal(h.phase, 'prep'); assert.equal(h.doctrines.length, 1); assert.equal(h.waves.length, 2);
});

test('sellswords are not saved: they were only hired for the wave', () => {
  const { g } = newGame();
  g.gold = 100; g.applyEvent({ k: 'hire', gold: 40 });
  const s = copy(g);
  assert.equal(s.units.length, LORDS.marshal.units.length);
  assert.ok(new Game().load(s));
});

test('a save holds every class, whatever reach the dice gave it', () => {
  // A priest or a seraph reaches the whole field; a lucky roll must not make the save unreadable.
  for (const k of UNIT_KEYS) {
    const { g } = newGame(31), path = UNITS[k].path || null;
    Object.assign(g, { age: path ? LAST_AGE : AGES.length - 1, path, bossWaves: LAST_AGE });
    let best = null;
    for (let n = 0; n < 80; n++) { const c = g.makeCard(0, 0, k); if (!best || c.range > best.range) best = c; }
    g.units = [g.newUnit(best, g.slots.findIndex((s) => s.seg >= 0))];
    g.refreshDerived();
    const h = newGame(32).g;
    assert.ok(h.load(copy(g)), `a ${k} with a reach of ${best.range} loads`);
    assert.equal(h.units[0].k, k);
    assert.equal(h.units[0].range, best.range);
  }
});

test('a malformed save is rejected as a whole and leaves a fresh game', () => {
  const { g, id } = played();
  takeRewards(g, id);
  g.gold = 1e5; g.level = 30; g.build(id, 0, 'forge'); g.addTurret('bolt');
  const good = copy(g);
  assert.ok(new Game().load(good), 'the untouched save loads');
  const unit = good.units.find((u) => u.k === 'archer');
  const bad = [
    null, 'save', [], { ...good, v: 4 }, { ...good, siege: -1 }, { ...good, siege: 10000 }, { ...good, siege: 'normal' }, { ...good, lord: 'nobody' }, { ...good, gold: NaN }, { ...good, gold: -5 }, { ...good, wave: 1.5 },
    { ...good, age: 4 }, { ...good, age: -1 },
    { ...good, b: { ...good.b, walls: good.b.hall + 1 } }, { ...good, b: { ...good.b, hall: 99 } }, { ...good, b: { hall: 6, walls: 1 } }, { ...good, segs: good.segs.slice(1) },
    { ...good, units: [...good.units, { ...good.units[0] }] }, { ...good, units: [] },
    { ...good, units: [{ ...unit, k: '__proto__' }] }, { ...good, units: [{ ...unit, lv: 0 }] },
    { ...good, units: [{ ...unit, k: 'spear', slot: 0 }] }, { ...good, units: [{ ...unit, k: 'sapper', slot: 1 }] }, { ...good, units: [{ ...unit, rcd: 0 }] },
    { ...good, units: [{ ...unit, spec: 3 }] }, { ...good, units: [{ ...unit, rar: 6 }] }, { ...good, units: [{ ...unit, k: 'lancer' }] },
    { ...good, muts: { nope: 1 } }, { ...good, muts: { hide: 4 } }, { ...good, muts: [] }, { ...good, adapt: { marksmen: 99 } }, { ...good, dealt: { arcane: -1 } }, { ...good, lastAdapt: 'nobody' },
    { ...good, forecast: ['clear'] }, { ...good, forecast: ['clear', 'clear', 'hail'] }, { ...good, path: 'legend' }, { ...good, path: 'nowhere' }, { ...good, age: 1 },
    { ...good, picks: [{ type: 'mutation', boss: 9 }] }, { ...good, picks: [{ type: 'muster' }] }, { ...good, picks: [{ type: 'victory' }] },
    { ...good, items: { nope: 1 } }, { ...good, items: { whetstone: -1 } }, { ...good, items: [] }, { ...good, items: { phoenix: 2 } },
    { ...good, turrets: [{ k: 'bolt', lv: 1, spot: 0 }, { k: 'bolt', lv: 1, spot: 1 }] }, { ...good, turrets: [{ k: 'laser', lv: 1, spot: 0 }] }, { ...good, turrets: [{ k: 'bolt', lv: 1, spot: 8 }] },
    { ...good, plots: [{ k: 'castle', lv: 1 }] }, { ...good, plots: [{ k: 'forge', lv: 1 }, { k: 'forge', lv: 1 }] }, { ...good, plots: [{ k: 'forge', lv: 3 }] },
    { ...good, plots: [{ k: 'mint', lv: 1 }] }, { ...good, plots: Array(8).fill(null) },
    { ...good, doctrines: ['moat'] }, { ...good, doctrines: ['nope'] },
    { ...good, classes: [] }, { ...good, classes: ['dragon'] }, { ...good, pool: ['phoenix'] }, { ...good, loadout: ['volley', 'mend'] }, { ...good, loadout: ['volley', 'volley', 'mend'] },
    { ...good, picks: [{ type: 'free gold' }] }, { ...good, shop: [{ type: 'item', key: 'nope' }] }, { ...good, shop: [{ type: 'item', key: 'phoenix' }] },
    { ...good, capBonus: 9 }, { ...good, bossWaves: -1 }, { ...good, th: 0 }, { ...good, xp: -1 },
    { ...good, units: Array.from({ length: 40 }, (_, i) => ({ ...unit, slot: i })) },
  ];
  for (const b of bad) {
    const h = new Game();
    assert.equal(h.load(b), false, JSON.stringify(b)?.slice(0, 120));
    assert.equal(h.wave, 0); assert.equal(h.gold, START_GOLD); assert.equal(h.units.length, LORDS.marshal.units.length); assert.equal(h.age, 0);
  }
});

test('names in a save are cleaned up', () => {
  const { g } = newGame();
  const s = g.save();
  s.units[0].name = '<img src=x onerror=alert(1)>';
  s.runId = '<script>';
  const h = new Game();
  assert.ok(h.load(s));
  assert.match(h.units[0].name, /^[A-Za-z]{1,12}$/);
  assert.match(h.runId, /^[a-z0-9-]+$/);
});

test('a daily challenge deals the same run to everyone', () => {
  const run = (seed) => {
    const g = new Game(seededRng(seed), { daily: true });
    const id = g.addPlayer();
    const log = [];
    for (let i = 0; i < 4; i++) {
      log.push(JSON.stringify(g.waves), JSON.stringify(g.shop));
      g.chooseWave(id, 0);
      for (let t = 0; t < 20 * 200 && g.phase === 'wave'; t++) steps(g, 1);
      log.push(JSON.stringify(g.picks[0]?.opts));
      takeRewards(g, id);
    }
    return log.join('|');
  };
  assert.equal(run(20261116), run(20261116));
  assert.notEqual(run(20261116), run(20261117));
});
