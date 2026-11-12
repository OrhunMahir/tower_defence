// Castle rules: shared gold, upgrades, repairs, perks and siege engines.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDINGS, PERKS, ENEMIES, CAPACITY } from '../server/game.js';
import { newGame, steps, seconds, emptyWave, addEnemy } from './bots.js';

test('a new run starts with 100 gold, four tower archers and two wave offers', () => {
  const { g } = newGame();
  assert.equal(g.gold, 100);
  assert.deepEqual(g.units.map((u) => [u.slot, u.k]), [[0, 'archer'], [1, 'archer'], [2, 'archer'], [3, 'archer']]);
  assert.equal(g.waves.length, 2);
  assert.deepEqual(g.b, { hall: 1, walls: 1, barracks: 1, mine: 0 });
});

test('upgrades cost shared gold and are capped by the keep', () => {
  const { g, id } = newGame();
  g.gold = 0;
  assert.equal(g.upgrade(id, 'mine'), false, 'no gold');
  g.gold = 1000;
  assert.equal(g.upgrade(id, 'walls'), false, 'walls cannot pass the keep level');
  for (const bad of ['__proto__', 'nope', undefined, 'smith']) assert.equal(g.upgrade(id, bad), false);
  assert.equal(g.upgrade(999, 'hall'), false, 'unknown player');
  assert.ok(g.upgrade(id, 'hall'));
  assert.equal(g.gold, 1000 - BUILDINGS.hall.cost[1]);
  assert.equal(g.th.max, 2100); assert.equal(g.th.hp, 2100);
  assert.ok(g.snapshot().fx.some((f) => f[0] === 4 && f[3] === 'hall'));
});

test('a damaged keep keeps its damage when upgraded', () => {
  const { g, id } = newGame();
  g.th.hp = 500;
  g.upgrade(id, 'hall');
  assert.equal(g.th.hp, 500 + 600);
});

test('wall upgrades strengthen standing segments, leave ruins alone and add room for defenders', () => {
  const { g, id } = newGame();
  g.gold = 1000; g.b.hall = 2;
  const wall = g.segs.find((s) => !s.gate), gate = g.segs.find((s) => s.gate), ruin = g.segs.filter((s) => !s.gate)[1];
  wall.hp = 100; ruin.hp = 0;
  assert.equal(g.snapshot().cap, CAPACITY[1]);
  assert.ok(g.upgrade(id, 'walls'));
  assert.equal(wall.max, 600); assert.equal(wall.hp, 300);
  assert.equal(gate.max, 900); assert.equal(gate.hp, 900);
  assert.equal(ruin.hp, 0); assert.equal(ruin.max, 600);
  assert.equal(g.snapshot().cap, CAPACITY[2]);
});

test('every building stops at its top level', () => {
  const { g, id } = newGame();
  for (const k in BUILDINGS) g.b[k] = BUILDINGS[k].max;
  g.gold = 1e6;
  for (const k in BUILDINGS) assert.equal(g.upgrade(id, k), false, k);
  assert.equal(g.gold, 1e6);
});

test('a keep upgrade offers three distinct perks and waits for the choice', () => {
  const { g, id } = newGame();
  g.gold = 5000;
  g.upgrade(id, 'hall');
  assert.equal(g.offer.length, 3);
  assert.equal(new Set(g.offer).size, 3);
  for (const k of g.offer) assert.ok(PERKS.includes(k));
  assert.equal(g.snapshot().of.length, 3);
  assert.equal(g.upgrade(id, 'hall'), false, 'next keep level waits for the pick');
  assert.equal(g.choosePerk(id, PERKS.find((k) => !g.offer.includes(k))), false, 'only offered perks can be picked');
  const pick = g.offer[1];
  assert.ok(g.choosePerk(id, pick));
  assert.equal(g.perks[pick], 1); assert.equal(g.offer, null);
  assert.equal(g.choosePerk(id, pick), false, 'one pick per offer');
  assert.ok(g.upgrade(id, 'hall'));
});

test('in co-op the first commander to click decides, and gold is shared', () => {
  const { g, ids } = newGame(1, 3);
  g.gold = 100;
  assert.ok(g.upgrade(ids[1], 'hall'));
  assert.equal(g.upgrade(ids[2], 'mine'), false, 'the gold is already spent');
  const pick = g.offer[0];
  assert.ok(g.choosePerk(ids[2], pick));
  assert.equal(g.choosePerk(ids[0], pick), false);
});

test('a perk can still be picked during the wave', () => {
  const { g, id } = newGame();
  g.upgrade(id, 'hall');
  emptyWave(g); addEnemy(g, 0, 40, 40);
  assert.ok(g.choosePerk(id, g.offer[0]));
});

test('repairs cost gold in proportion to the damage and rebuild ruins', () => {
  const { g, id } = newGame();
  g.gold = 0;
  assert.equal(g.repairCost('walls'), 0);
  assert.equal(g.repair(id, 'walls'), false, 'nothing to repair');
  g.segs[0].hp = 0; g.segs[2].hp -= 160;
  const cost = Math.ceil((g.segs[0].max + 160) / 20);
  assert.equal(g.repairCost('walls'), cost);
  assert.equal(g.repair(id, 'walls'), false, 'no gold');
  g.gold = 500;
  assert.ok(g.repair(id, 'walls'));
  assert.equal(g.gold, 500 - cost);
  assert.ok(g.segs.every((s) => s.hp === s.max));
  assert.equal(g.repair(id, 'moat'), false);
});

test('with too little gold a repair is partial', () => {
  const { g, id } = newGame();
  g.th.hp -= 800; g.gold = 10;
  assert.ok(g.repair(id, 'hall'));
  assert.equal(g.gold, 0);
  assert.equal(Math.round(g.th.hp), 1500 - 800 + 200);
});

test('master masons make repairs cheaper', () => {
  const { g } = newGame();
  g.th.hp -= 1000;
  const full = g.repairCost('hall');
  g.perks.masons = 1;
  assert.equal(g.repairCost('hall'), Math.ceil(full * 0.6));
});

test('nothing can be bought, upgraded or repaired during a wave', () => {
  const { g, id } = newGame();
  g.gold = 5000; g.th.hp -= 100;
  emptyWave(g); addEnemy(g, 0, 40, 40);
  assert.equal(g.phase, 'wave');
  assert.equal(g.upgrade(id, 'hall'), false);
  assert.equal(g.repair(id, 'hall'), false);
  assert.equal(g.recruit(id, 'archer'), false);
  assert.equal(g.promote(id, 'archer'), false);
  assert.equal(g.chooseWave(id, 0), false);
  assert.equal(g.gold, 5000);
});

test('a built mine blocks monsters, an unbuilt one does not', () => {
  const { g } = newGame();
  const e = { x: 8.5, z: -7 };
  g.collideStatic(e, 0.6);
  assert.deepEqual(e, { x: 8.5, z: -7 });
  g.b.mine = 1;
  g.collideStatic(e, 0.6);
  assert.ok(Math.abs(e.x - 8.5) >= 2.59 || Math.abs(e.z + 7) >= 2.59);
});

test('the mortar shells the densest group and leads moving targets', () => {
  const { g } = newGame();
  g.units = []; g.perks.mortar = 1;
  emptyWave(g);
  const pack = [0, 1, 2, 3].map((i) => addEnemy(g, 0, 20 + i * 0.5, 20, { hp: 100 }));
  const loner = addEnemy(g, 0, -25, -20, { hp: 100 });
  steps(g, 1);
  assert.equal(g.shells.length, 1);
  assert.ok(g.snapshot().fx.some((f) => f[0] === 5), 'launch effect');
  seconds(g, 1.3);
  for (const e of pack) assert.equal(e.hp, 60);
  assert.equal(loner.hp, 100);
});

test('a second mortar pick doubles the shell damage', () => {
  const { g } = newGame();
  g.units = []; g.perks.mortar = 2;
  emptyWave(g);
  const e = addEnemy(g, 1, 20, 20, { hp: 500 });
  seconds(g, 1.3);
  assert.equal(e.hp, 420);
});

test('the ballista shoots the toughest enemy in range', () => {
  const { g } = newGame();
  g.units = []; g.perks.ballista = 1;
  emptyWave(g);
  const runner = addEnemy(g, 0, 22, 0, { hp: 30 }), brute = addEnemy(g, 1, 0, -24, { hp: 150 });
  seconds(g, 1);
  assert.equal(brute.hp, 30);
  assert.equal(runner.hp, 30);
});

test('a kill pays gold once', () => {
  const { g } = newGame();
  g.gold = 0;
  const e = addEnemy(g, 1, 30, 30, { hp: 1 });
  g.hurtEnemy(e, 5);
  g.hurtEnemy(e, 5);
  assert.equal(g.gold, ENEMIES[1].gold);
});

test('a new run resets the castle, the army and the perks', () => {
  const { g, id } = newGame();
  g.gold = 9999; g.upgrade(id, 'hall'); g.choosePerk(id, g.offer[0]); g.upgrade(id, 'mine');
  g.recruit(id, 'mage'); g.promote(id, 'archer'); g.segs[3].hp = 0;
  g.reset();
  assert.deepEqual(g.b, { hall: 1, walls: 1, barracks: 1, mine: 0 });
  assert.equal(g.gold, 100); assert.equal(g.offer, null);
  assert.ok(PERKS.every((k) => g.perks[k] === 0));
  assert.ok(g.segs.every((s) => s.hp === s.max && s.max === s.base));
  assert.equal(g.th.hp, 1500);
  assert.equal(g.units.length, 4); assert.equal(g.tiers.archer, 1);
});
