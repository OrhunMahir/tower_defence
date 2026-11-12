// Saving and continuing a run, and rejecting anything malformed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, START_GOLD, LORDS } from '../server/game.js';
import { newGame, botTurn, seconds, seeded } from './bots.js';

// A run that has got somewhere: a few waves played by the bot.
function played() {
  const { g, id } = newGame(7);
  while (g.wave < 6) { botTurn(g, id); seconds(g, 1); }
  while (g.phase === 'wave') seconds(g, 1);
  return { g, id };
}

test('a saved run continues where it left off', () => {
  const { g } = played();
  while (g.phase === 'reward') g.choose([...g.players][0], 0) || g.skip([...g.players][0]);
  g.addItem('whetstone'); g.addItem('oil'); g.addTurret('cannon'); g.addTurret('cannon');
  g.st.crit = 12; g.bless.archer = 2; g.refreshDerived(); g.segs[5].hp = 77; g.th.hp = g.th.max - 300;
  g.shop[0] = { type: 'item', key: 'crown', price: 1, locked: true };
  const data = JSON.parse(JSON.stringify(g.save()));
  const h = new Game(seeded(99));
  assert.ok(h.load(data));
  assert.equal(h.phase, 'prep');
  assert.equal(h.wave, g.wave); assert.equal(h.gold, Math.floor(g.gold)); assert.equal(h.diff, g.diff); assert.equal(h.lord, g.lord);
  assert.deepEqual(h.b, g.b); assert.deepEqual(h.st, g.st); assert.deepEqual(h.items, g.items); assert.deepEqual(h.bless, g.bless);
  assert.deepEqual(h.turrets.map((t) => [t.k, t.lv, t.spot]), g.turrets.map((t) => [t.k, t.lv, t.spot]));
  assert.equal(h.level, g.level); assert.deepEqual(h.stats, g.stats);
  assert.deepEqual(h.tot, g.tot);
  assert.equal(h.th.hp, g.th.hp); assert.equal(h.th.max, g.th.max);
  assert.equal(h.segs[5].hp, 77);
  const strip = (u) => [u.slot, u.k, u.name, u.rar, u.lv, u.p, u.rcd, u.range, u.traits, u.kills];
  assert.deepEqual(h.units.map(strip), g.units.map(strip));
  assert.equal(new Set(h.units.map((u) => u.uid)).size, h.units.length, 'fresh unique ids');
  assert.equal(h.waves.length, 2);
  assert.equal(h.shop[0].key, 'crown'); assert.ok(h.shop[0].locked, 'locked offers are kept');
});

test('a run saved between rewards continues with its choices still waiting', () => {
  const { g } = played();
  assert.equal(g.phase, 'reward');
  const types = g.picks.map((p) => p.type);
  const h = new Game(seeded(5));
  assert.ok(h.load(JSON.parse(JSON.stringify(g.save()))));
  assert.equal(h.phase, 'reward');
  assert.deepEqual(h.picks.map((p) => p.type), types);
  assert.ok(h.picks[0].opts.length >= 3);
});

test('difficulty, lord and victory are saved with the run', () => {
  const g = new Game(seeded(1), 'brutal', 'archmage');
  g.won = true; g.endless = true;
  const h = new Game();
  assert.ok(h.load(g.save()));
  assert.equal(h.diff, 'brutal'); assert.equal(h.lord, 'archmage'); assert.ok(h.won && h.endless);
});

test('a malformed save is rejected as a whole and leaves a fresh game', () => {
  const { g } = played();
  const good = g.save();
  const bad = [
    null, 'save', [], { ...good, v: 2 }, { ...good, diff: 'easy' }, { ...good, gold: NaN }, { ...good, gold: -5 }, { ...good, wave: 1.5 },
    { ...good, b: { ...good.b, walls: good.b.hall + 1 } }, { ...good, b: { ...good.b, hall: 99 } }, { ...good, segs: good.segs.slice(1) },
    { ...good, units: [...good.units, { ...good.units[0] }] }, { ...good, units: [] },
    { ...good, units: [{ ...good.units[0], k: '__proto__' }] }, { ...good, units: [{ ...good.units[0], lv: 0 }] },
    { ...good, units: [{ ...good.units[0], k: 'spear', slot: 0 }] }, { ...good, units: [{ ...good.units[0], rcd: 0 }] },
    { ...good, items: { nope: 1 } }, { ...good, items: { whetstone: -1 } }, { ...good, items: [] },
    { ...good, turrets: [{ k: 'bolt', lv: 1, spot: 0 }, { k: 'bolt', lv: 1, spot: 1 }] }, { ...good, turrets: [{ k: 'laser', lv: 1, spot: 0 }] },
    { ...good, picks: [{ type: 'free gold' }] }, { ...good, shop: [{ type: 'item', key: 'nope' }] },
    { ...good, units: Array.from({ length: 40 }, (_, i) => ({ ...good.units[0], slot: i })) },
  ];
  for (const b of bad) {
    const h = new Game();
    assert.equal(h.load(b), false, JSON.stringify(b)?.slice(0, 80));
    assert.equal(h.wave, 0); assert.equal(h.gold, START_GOLD); assert.equal(h.units.length, LORDS.marshal.units.length);
  }
});

test('names in a save are cleaned up', () => {
  const { g } = newGame();
  const s = g.save();
  s.units[0].name = '<img src=x onerror=alert(1)>';
  const h = new Game();
  assert.ok(h.load(s));
  assert.match(h.units[0].name, /^[A-Za-z]{1,12}$/);
});
