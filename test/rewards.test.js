// Rewards between waves (level-ups and spoils), items with special effects and the castle abilities.
import test from 'node:test';
import assert from 'node:assert/strict';
import { STATS, STAT_KEYS, ITEMS, CAPACITY, ABILITIES, ENEMIES, RARITY, levelNeed } from '../server/game.js';
import { newGame, steps, seconds, emptyWave, addEnemy, card } from './bots.js';

// Ends an empty wave and returns the game in its reward phase (or prep when nothing is due).
function cleared(g, setup = () => {}) {
  emptyWave(g);
  setup(g);
  steps(g, 1);
  return g;
}

test('castle levels come from kills and each one queues a choice of four stat upgrades', () => {
  const { g, id } = newGame();
  emptyWave(g);
  g.castleXp(levelNeed(1) + levelNeed(2));
  assert.equal(g.level, 3);
  assert.deepEqual(g.picks.map((p) => p.type), ['level', 'level']);
  assert.equal(g.phase, 'wave', 'choices wait until the wave is over');
  steps(g, 1);
  assert.equal(g.phase, 'reward');
  assert.deepEqual(g.picks.map((p) => p.type), ['level', 'level', 'spoils'], 'level-ups first, then the spoils');
  const p = g.picks[0];
  assert.equal(p.opts.length, 4);
  assert.equal(new Set(p.opts.map((o) => o.stat)).size, 4, 'four different stats');
  for (const o of p.opts) assert.ok(STAT_KEYS.includes(o.stat) && o.r >= 0 && o.r < 4);
  const o = p.opts[1], before = g.tot[o.stat];
  assert.ok(g.choose(id, 1));
  assert.equal(g.tot[o.stat], before + STATS[o.stat][o.r]);
  assert.equal(g.picks.length, 2);
  for (const bad of [-1, 4, 'x', null, 1.5]) assert.equal(g.choose(id, bad), false, String(bad));
  assert.equal(g.choose(999, 0), false, 'unknown player');
});

test('every fifth castle level is at least rare', () => {
  const { g } = newGame(3);
  for (let i = 0; i < 30; i++) { g.level = 5; assert.ok(g.levelOptions().every((o) => o.r >= 1)); }
});

test('the spoils always offer a recruit (or a promotion when the walls are full)', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const { g } = newGame(seed);
    const opts = g.spoilsOptions();
    assert.equal(opts.length, 3);
    assert.equal(opts[0].type, 'recruit');
    for (const o of opts) assert.ok(['recruit', 'promote', 'item', 'turret', 'bless'].includes(o.type));
  }
  const { g } = newGame();
  while (g.units.length < CAPACITY[1]) g.units.push(g.newUnit(card('archer'), g.freeSlot('archer')));
  assert.equal(g.spoilsOptions()[0].type, 'promote');
});

test('taking a recruit puts a new defender on the walls', () => {
  const { g, id } = newGame();
  cleared(g);
  g.picks[0].opts[0] = { type: 'recruit', card: card('pyro', { rar: 2, name: 'Edda' }) };
  assert.ok(g.choose(id, 0));
  const u = g.units.at(-1);
  assert.deepEqual([u.k, u.rar, u.name], ['pyro', 2, 'Edda']);
  assert.equal(g.phase, 'prep');
});

test('a promotion raises a defender a rarity, or three levels once legendary', () => {
  const { g, id } = newGame();
  const u = g.units[0], p = u.p;
  cleared(g);
  g.picks[0].opts[0] = { type: 'promote', uid: u.uid };
  assert.ok(g.choose(id, 0));
  assert.equal(u.rar, 1); assert.ok(Math.abs(u.p - p * RARITY[1].mul) < 0.01);
  u.rar = 3;
  cleared(g);
  g.picks[0].opts[0] = { type: 'promote', uid: u.uid };
  g.choose(id, 0);
  assert.equal(u.rar, 3); assert.equal(u.lv, 4);
});

test('a blessing makes every defender of a class stronger', () => {
  const { g, id } = newGame();
  const u = g.units[0], before = g.unitPower(u);
  cleared(g);
  g.picks[0].opts[0] = { type: 'bless', k: 'archer', v: 2 };
  g.choose(id, 0);
  assert.ok(Math.abs(g.unitPower(u) - before * 1.4) < 1e-9);
});

test('skipping the spoils pays gold; rerolling costs more each time and resets after a pick', () => {
  const { g, id } = newGame();
  cleared(g);
  g.gold = 1000;
  const c1 = g.pickRerollCost();
  assert.ok(g.rerollPick(id));
  assert.equal(g.gold, 1000 - c1);
  assert.ok(g.pickRerollCost() > c1);
  g.gold = 0;
  assert.equal(g.rerollPick(id), false, 'no gold');
  const skip = g.skipGold();
  assert.ok(g.skip(id));
  assert.equal(g.gold, skip);
  assert.equal(g.skip(id), false, 'nothing left to skip');
  assert.equal(g.pickRerolls, 0);
});

test('a boss wave gives two spoils; a hard wave makes them luckier', () => {
  for (const hard of [false, true]) {
    const { g, id } = newGame();
    g.wave = 9; g.makeWaveOffers();
    g.chooseWave(id, g.waves.findIndex((w) => w.hard === hard)); g.queue = []; g.enemies = [];
    steps(g, 1);
    const spoils = g.picks.filter((p) => p.type === 'spoils');
    assert.equal(spoils.length, 2);
    assert.ok(spoils.every((p) => p.luck === (hard ? 90 : 60)));
  }
});

test('the recruiting poster adds a fourth choice to the spoils, once', () => {
  const { g } = newGame();
  g.addItem('poster');
  assert.equal(g.spoilsOptions().length, 4);
  for (let i = 0; i < 50; i++) { const o = g.itemOption(500); assert.ok(!o || o.key !== 'poster', 'unique items are not offered twice'); }
});

test('items with trade-offs change several stats, and stack', () => {
  const { g } = newGame();
  const dmg = g.tot.dmg, aspd = g.tot.aspd;
  g.addItem('heavybolts'); g.addItem('heavybolts');
  assert.equal(g.tot.dmg, dmg + 2 * ITEMS.heavybolts.mods.dmg);
  assert.equal(g.tot.aspd, aspd + 2 * ITEMS.heavybolts.mods.aspd);
});

test('boiling oil and thorned walls hurt monsters at the walls', () => {
  for (const item of ['oil', 'thorns']) {
    const { g } = newGame();
    g.units = [];
    g.addItem(item);
    emptyWave(g);
    const e = addEnemy(g, 1, 0, -14 - 1.6, { hp: 1000, cd: 0 });
    seconds(g, 1.5);
    assert.ok(e.hp < 1000, item);
  }
});

test('the hourglass slows every monster at the start of a wave', () => {
  const walk = (item) => {
    const { g } = newGame();
    g.units = [];
    if (item) g.addItem('hourglass');
    emptyWave(g);
    const e = addEnemy(g, 0, 0, -50, { hp: 1e6 });
    seconds(g, 2);
    return 50 + e.z;
  };
  assert.ok(Math.abs(walk(true) - walk(false) * 0.6) < 0.1);
});

test('the bounty board and Midas touch add to kill gold', () => {
  const { g } = newGame();
  g.gold = 0; g.addItem('bounty');
  g.hurtEnemy(addEnemy(g, 1, 30, 30, { hp: 1 }), 5);
  assert.equal(g.gold, Math.round(ENEMIES[1].gold * 1.25));
});

test('volley: arrows fall on the chosen spot a moment later', () => {
  const { g, id } = newGame();
  g.units = [];
  emptyWave(g);
  const inside = addEnemy(g, 1, 30, 0, { hp: 1e6 }), outside = addEnemy(g, 1, 30, 15, { hp: 1e6 });
  assert.equal(g.ability(id, 'volley', 'a', 0), false);
  assert.ok(g.ability(id, 'volley', 30, 0));
  assert.equal(g.ability(id, 'volley', 30, 0), false, 'on cooldown');
  assert.equal(inside.hp, 1e6, 'not yet');
  inside.x = outside.x = 30; inside.z = 0; outside.z = 15;
  for (const e of [inside, outside]) e.cd = 99;
  g.enemies.forEach((e) => { e.speed = 0; });
  seconds(g, 1);
  assert.ok(inside.hp < 1e6);
  assert.equal(outside.hp, 1e6);
  assert.ok(g.abil.volley > 0 && g.abil.volley <= ABILITIES.volley.cd);
});

test('mend patches every wall and raises ruins; rally speeds everyone up', () => {
  const { g, id } = newGame();
  emptyWave(g);
  addEnemy(g, 0, 50, 50, { hp: 1e6 });
  g.segs[0].hp = 0; g.segs[1].hp = 10;
  assert.ok(g.ability(id, 'mend'));
  assert.equal(g.segs[0].hp, g.segs[0].max * 0.2);
  assert.equal(g.segs[1].hp, 10 + g.segs[1].max * 0.25);
  const u = g.units[0], slow = g.unitReload(u);
  assert.ok(g.ability(id, 'rally'));
  assert.ok(Math.abs(g.unitReload(u) - slow / (1 + 0.5 / (1 + g.tot.aspd / 100))) < 0.2 * slow);
  assert.ok(g.unitReload(u) < slow);
  assert.equal(g.ability(id, 'nope'), false);
});

test('abilities only work during a wave and are ready again at the start of the next', () => {
  const { g, id } = newGame();
  assert.equal(g.ability(id, 'mend'), false);
  emptyWave(g);
  addEnemy(g, 0, 50, 50, { hp: 1 });
  g.ability(id, 'mend');
  g.enemies = [];
  steps(g, 1);
  while (g.phase === 'reward') g.choose(id, 0) || g.skip(id);
  g.chooseWave(id, 0);
  assert.equal(g.abil.mend, 0);
});
