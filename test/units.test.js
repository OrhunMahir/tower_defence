// Defenders: recruiting, placement, promotion and how each type fights.
import test from 'node:test';
import assert from 'node:assert/strict';
import { S, UNITS, CAPACITY, PROMOTE } from '../server/game.js';
import { newGame, steps, seconds, emptyWave, addEnemy } from './bots.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} is not within ${eps} of ${b}`);
// A game whose only defender is one unit of the given type on the south wall, x = 8.
function lone(k, setup = () => {}) {
  const { g, id } = newGame();
  const slot = g.slots.findIndex((s) => s.x === 8 && s.z === S);
  g.units = [{ slot, k, cd: 0 }];
  setup(g);
  emptyWave(g);
  return { g, id, post: g.slots[slot], seg: g.segs[g.slots[slot].seg] };
}

test('recruiting costs shared gold and each unit of a type costs 8% more', () => {
  const { g, id } = newGame();
  g.gold = 1000;
  assert.equal(g.unitCost('mage'), UNITS.mage.cost);
  assert.ok(g.recruit(id, 'mage'));
  assert.equal(g.gold, 1000 - UNITS.mage.cost);
  assert.equal(g.unitCost('mage'), Math.round(UNITS.mage.cost * 1.08));
  assert.equal(g.unitCost('archer'), Math.round(UNITS.archer.cost * 1.08 ** 4), 'four archers already stand on the towers');
  for (const bad of ['__proto__', 'knight', undefined, 7]) assert.equal(g.recruit(id, bad), false);
  assert.equal(g.recruit(999, 'archer'), false, 'unknown player');
  g.gold = 0;
  assert.equal(g.recruit(id, 'spear'), false, 'no gold');
  assert.deepEqual(g.snapshot().uc, ['archer', 'spear', 'mage', 'crossbow'].map((k) => g.unitCost(k)));
});

test('the walls hold a limited number of defenders; taller walls hold more', () => {
  const { g, id } = newGame();
  g.gold = 1e6;
  while (g.recruit(id, 'archer'));
  assert.equal(g.units.length, CAPACITY[1]);
  g.b.hall = 5; g.b.walls = 5;
  while (g.recruit(id, 'spear'));
  assert.equal(g.units.length, CAPACITY[5]);
  assert.equal(new Set(g.units.map((u) => u.slot)).size, g.units.length, 'one defender per slot');
  assert.equal(g.units.length, g.slots.length, 'every slot is taken');
});

test('new defenders spread out over all four walls', () => {
  const { g, id } = newGame();
  g.gold = 1e6;
  for (let i = 0; i < 4; i++) g.recruit(id, 'archer');
  const sides = g.units.slice(4).map((u) => { const s = g.slots[u.slot]; return Math.abs(s.x) === S ? (s.x > 0 ? 'E' : 'W') : s.z > 0 ? 'S' : 'N'; });
  assert.equal(new Set(sides).size, 4, `sides ${sides}`);
});

test('spearmen stand on walls, never in towers', () => {
  const { g, id } = newGame();
  g.units = []; g.gold = 1e6;
  for (let i = 0; i < 10; i++) g.recruit(id, 'spear');
  assert.ok(g.units.every((u) => g.slots[u.slot].seg >= 0));
});

test('promotion raises a whole unit type and needs the barracks', () => {
  const { g, id } = newGame();
  g.gold = 5000;
  assert.ok(g.promote(id, 'archer'));
  assert.equal(g.tiers.archer, 2); assert.equal(g.tiers.mage, 1);
  assert.equal(g.gold, 5000 - PROMOTE[1]);
  assert.equal(g.promote(id, 'archer'), false, 'tier 3 needs barracks level 2');
  assert.equal(g.promote(id, 'hero'), false);
  g.b.barracks = 5;
  for (let i = 0; i < 10; i++) g.promote(id, 'archer');
  assert.equal(g.tiers.archer, 5, 'tiers stop at 5');
  assert.deepEqual(g.snapshot().ut, [5, 1, 1, 1]);
});

test('an archer shoots the nearest monster in range and holds fire otherwise', () => {
  const { g, post } = lone('archer');
  const nearE = addEnemy(g, 0, post.x, post.z + 10, { hp: 500 }), farE = addEnemy(g, 0, post.x + 12, post.z + 12, { hp: 500 });
  const out = addEnemy(g, 0, post.x, post.z + 40, { hp: 500 });
  steps(g, 1);
  assert.equal(g.projs.length, 1);
  seconds(g, 0.6);
  assert.equal(nearE.hp, 500 - UNITS.archer.dmg);
  assert.equal(farE.hp, 500); assert.equal(out.hp, 500);
});

test('nobody shoots at monsters out of range', () => {
  const { g } = lone('archer');
  addEnemy(g, 0, 50, 50, { hp: 500 });
  steps(g, 10);
  assert.equal(g.projs.length, 0);
});

test('a crossbow goes for the toughest monster, not the nearest', () => {
  const { g, post } = lone('crossbow');
  const runner = addEnemy(g, 0, post.x, post.z + 6, { hp: 30 }), brute = addEnemy(g, 1, post.x + 3, post.z + 18, { hp: 400 });
  seconds(g, 1);
  assert.equal(brute.hp, 400 - UNITS.crossbow.dmg);
  assert.equal(runner.hp, 30);
});

test('a mage orb explodes and hurts the whole group', () => {
  const { g, post } = lone('mage');
  const a = addEnemy(g, 1, post.x, post.z + 10, { hp: 500 }), b = addEnemy(g, 1, post.x + 2, post.z + 10.5, { hp: 500 }), c = addEnemy(g, 1, post.x - 9, post.z + 10, { hp: 500 });
  seconds(g, 1);
  assert.equal(a.hp, 500 - UNITS.mage.dmg); assert.equal(b.hp, 500 - UNITS.mage.dmg); assert.equal(c.hp, 500);
  assert.ok(g.snapshot().fx.some((f) => f[0] === 1));
});

test('a spearman stabs only what is at the foot of his wall', () => {
  const { g, post } = lone('spear');
  const close = addEnemy(g, 1, post.x, post.z + 2, { hp: 500 }), away = addEnemy(g, 1, post.x, post.z + 8, { hp: 500 });
  steps(g, 1);
  assert.equal(close.hp, 500 - UNITS.spear.dmg, 'hit at once, no projectile');
  assert.equal(away.hp, 500); assert.equal(g.projs.length, 0);
});

test('a defender is out of action while his wall segment is down', () => {
  const { g, post, seg } = lone('archer');
  addEnemy(g, 0, post.x, post.z + 30, { hp: 500 });
  seg.hp = 0;
  seconds(g, 2);
  assert.equal(g.projs.length, 0);
  seg.hp = 50;
  for (const e of g.enemies) { e.x = post.x; e.z = post.z + 12; }
  steps(g, 1);
  assert.equal(g.projs.length, 1, 'back in action once the wall stands again');
});

test('barracks and promotion multiply damage; sharp arrows help archers only', () => {
  const dmg = (k, setup) => { const { g, post } = lone(k, setup); addEnemy(g, 1, post.x, post.z + (k === 'spear' ? 2 : 10), { hp: 9999 }); steps(g, 1); return k === 'spear' ? 9999 - g.enemies[0].hp : g.projs[0].dmg; };
  near(dmg('archer', (g) => { g.b.barracks = 3; }), UNITS.archer.dmg * 1.5);
  near(dmg('archer', (g) => { g.tiers.archer = 3; }), UNITS.archer.dmg * 1.7);
  near(dmg('archer', (g) => { g.perks.sharp = 2; }), UNITS.archer.dmg * 1.6);
  near(dmg('mage', (g) => { g.perks.sharp = 2; g.tiers.archer = 5; }), UNITS.mage.dmg);
  near(dmg('spear', (g) => { g.b.barracks = 2; g.tiers.spear = 2; }), UNITS.spear.dmg * 1.25 * 1.35);
});

test('rapid bows shorten every reload', () => {
  const reload = (setup) => { const { g, post } = lone('crossbow', setup); addEnemy(g, 1, post.x, post.z + 10, { hp: 9999 }); steps(g, 1); return g.units[0].cd; };
  const base = reload(() => {}), quick = reload((g) => { g.perks.rapid = 2; });
  assert.ok(base >= UNITS.crossbow.cd * 0.9 - 0.06 && base <= UNITS.crossbow.cd * 1.1);
  assert.ok(quick <= (UNITS.crossbow.cd / 1.4) * 1.1);
});
