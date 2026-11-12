// Castle rules: gold, upgrades, repairs, lords, turrets and the shop.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, BUILDINGS, ENEMIES, CAPACITY, START_GOLD, LORDS, ITEMS, TURRETS, TURRET_SPOTS, thMax, wallMul } from '../server/game.js';
import { newGame, steps, seconds, emptyWave, addEnemy, seeded } from './bots.js';

test('a new run starts with gold, the lord\'s defenders, a shop and two wave offers', () => {
  const { g } = newGame();
  assert.equal(g.lord, 'marshal');
  assert.equal(g.gold, START_GOLD);
  assert.deepEqual(g.units.map((u) => u.k), LORDS.marshal.units);
  assert.ok(g.units.every((u) => u.lv === 1 && typeof u.name === 'string' && u.name.length > 1));
  assert.ok(g.units.filter((u) => u.k === 'spear').every((u) => g.slots[u.slot].seg >= 0), 'the spearman stands on a wall');
  assert.equal(g.waves.length, 2);
  assert.equal(g.shop.length, 4);
  assert.deepEqual(g.b, { hall: 1, walls: 1 });
  assert.equal(g.phase, 'prep'); assert.equal(g.level, 1);
});

test('every lord starts differently and trades a strength for a weakness', () => {
  for (const [k, lord] of Object.entries(LORDS)) {
    const g = new Game(seeded(1), 'normal', k);
    assert.deepEqual(g.units.map((u) => u.k), lord.units, k);
    for (const [s, v] of Object.entries(lord.mods)) assert.equal(g.tot[s], v, `${k} ${s}`);
    assert.ok(Object.values(lord.mods).some((v) => v < 0) || k === 'marshal', `${k} has a drawback`);
    assert.equal(g.gold, START_GOLD + (lord.gold || 0));
    assert.equal(g.turrets.length, lord.turret ? 1 : 0);
  }
  const saint = new Game(seeded(1), 'normal', 'saint');
  assert.equal(saint.th.max, thMax(1) + 400);
  assert.equal(new Game(seeded(1), 'normal', 'nobody').lord, 'marshal', 'unknown lords fall back to the marshal');
});

test('upgrades cost gold and the walls are capped by the keep', () => {
  const { g, id } = newGame();
  g.gold = 1000;
  assert.equal(g.upgrade(id, 'walls'), false, 'walls cannot pass the keep level');
  for (const bad of ['__proto__', 'nope', undefined, 'mine', 'barracks']) assert.equal(g.upgrade(id, bad), false, String(bad));
  assert.equal(g.upgrade(999, 'hall'), false, 'unknown player');
  assert.ok(g.upgrade(id, 'hall'));
  assert.equal(g.gold, 1000 - BUILDINGS.hall.cost[1]);
  assert.equal(g.th.max, thMax(2)); assert.equal(g.th.hp, thMax(2));
  assert.ok(g.upgrade(id, 'walls'));
  assert.ok(g.snapshot().fx.some((f) => f[0] === 4 && f[3] === 'walls'));
});

test('upgrade prices rise level by level, both buildings go to 20 and stop', () => {
  for (const k in BUILDINGS) {
    const c = BUILDINGS[k].cost;
    assert.equal(BUILDINGS[k].max, 20);
    for (let l = 2; l < c.length; l++) assert.ok(c[l] > c[l - 1], `${k} ${l}`);
  }
  const { g, id } = newGame();
  g.b.hall = 20; g.b.walls = 20; g.gold = 1e9;
  assert.equal(g.upgrade(id, 'hall'), false); assert.equal(g.upgrade(id, 'walls'), false);
  assert.deepEqual(g.snapshot().bc, [-1, -1]);
});

test('a damaged keep keeps its damage when upgraded', () => {
  const { g, id } = newGame();
  g.th.hp = 500; g.gold = 1000;
  g.upgrade(id, 'hall');
  assert.equal(g.th.hp, 500 + 700);
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

test('the wall HP stat scales every segment at once', () => {
  const { g } = newGame();
  g.st.wallhp = 50;
  g.refreshDerived();
  assert.ok(g.segs.every((s) => s.max === Math.round(s.base * wallMul(1) * 1.5) && s.hp === s.max));
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

test('after every wave half the damage is mended for free and ruins rise to a third', () => {
  const { g } = newGame();
  emptyWave(g);
  g.th.hp = 500; g.segs[0].hp = 0; g.segs[1].hp = g.segs[1].max - 200;
  steps(g, 1);
  assert.notEqual(g.phase, 'wave');
  assert.equal(g.th.hp, 500 + (1500 - 500) / 2);
  assert.equal(g.segs[0].hp, g.segs[0].max / 3);
  assert.equal(g.segs[1].hp, g.segs[1].max - 100);
});

test('nothing can be bought, trained, upgraded or repaired during a wave', () => {
  const { g, id } = newGame();
  g.gold = 5000; g.th.hp -= 100;
  emptyWave(g); addEnemy(g, 0, 40, 40);
  assert.equal(g.phase, 'wave');
  assert.equal(g.upgrade(id, 'hall'), false);
  assert.equal(g.repair(id, 'hall'), false);
  assert.equal(g.buy(id, 0), false);
  assert.equal(g.rerollShop(id), false);
  assert.equal(g.lock(id, 0), false);
  assert.equal(g.train(id, g.units[0].uid), false);
  assert.equal(g.dismiss(id, g.units[0].uid), false);
  assert.equal(g.chooseWave(id, 0), false);
  assert.equal(g.gold, 5000);
});

test('the shop sells items and turrets, never the same offer twice, prices growing with the wave', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const { g } = newGame(seed);
    const ids = g.shop.filter(Boolean).map((o) => o.key || o.k);
    assert.equal(new Set(ids).size, ids.length, `seed ${seed}`);
    for (const o of g.shop.filter(Boolean)) {
      assert.ok(o.type === 'item' ? Object.hasOwn(ITEMS, o.key) : Object.hasOwn(TURRETS, o.k));
      assert.equal(o.price, g.priceOf(o));
    }
  }
  const { g } = newGame();
  const o = { type: 'item', key: 'whetstone' }, early = g.priceOf(o);
  g.wave = 20;
  assert.ok(g.priceOf(o) > early * 4);
});

test('buying an item applies it at once; a turret takes a courtyard spot', () => {
  const { g, id } = newGame();
  g.gold = 1e6;
  g.shop = [{ type: 'item', key: 'whetstone', price: 10, locked: false }, { type: 'turret', k: 'cannon', price: 20, locked: false }, null, null];
  assert.ok(g.buy(id, 0));
  assert.equal(g.items.whetstone, 1); assert.equal(g.tot.dmg, LORDS.marshal.mods.dmg + 6);
  assert.equal(g.shop[0], null);
  assert.equal(g.buy(id, 0), false, 'sold out');
  assert.ok(g.buy(id, 1));
  assert.deepEqual(g.turrets.map((t) => [t.k, t.lv]), [['cannon', 1]]);
  for (const bad of [-1, 4, '1', null, 0.5]) assert.equal(g.buy(id, bad), false, String(bad));
  g.gold = 0;
  g.shop[2] = { type: 'item', key: 'tome', price: 50, locked: false };
  assert.equal(g.buy(id, 2), false, 'no gold');
});

test('locked offers survive rerolls and the next wave; rerolls cost more each time', () => {
  const { g, id } = newGame(4);
  g.gold = 1e6;
  const kept = { ...g.shop[1] };
  assert.ok(g.lock(id, 1));
  const c1 = g.shopRerollCost();
  assert.ok(g.rerollShop(id));
  assert.equal(g.gold, 1e6 - c1);
  assert.ok(g.shopRerollCost() > c1);
  assert.equal(g.shop[1].key || g.shop[1].k, kept.key || kept.k);
  assert.equal(g.shop[1].locked, true);
  assert.ok(g.lock(id, 1));
  assert.equal(g.shop[1].locked, false, 'locking again unlocks');
  g.lock(id, 1);
  emptyWave(g); steps(g, 1);
  while (g.phase === 'reward') g.choose(id, 0) || g.skip(id);
  assert.equal(g.shop[1].key || g.shop[1].k, kept.key || kept.k, 'still there after the wave');
  assert.equal(g.rerolls, 0, 'reroll price resets every wave');
});

test('another copy of a turret raises its level; six spots at most', () => {
  const { g } = newGame();
  assert.ok(g.addTurret('bolt')); assert.ok(g.addTurret('bolt'));
  assert.deepEqual(g.turrets.map((t) => [t.k, t.lv]), [['bolt', 2]]);
  for (const k of ['cannon', 'tesla', 'mortar', 'ballista']) g.addTurret(k);
  assert.equal(g.turrets.length, 5);
  assert.equal(new Set(g.turrets.map((t) => t.spot)).size, 5);
  assert.ok(g.turrets.length <= TURRET_SPOTS.length);
  assert.ok(Math.abs(g.turretPower(g.turrets[0]) - TURRETS.bolt.p * 1.5) < 1e-9);
  g.st.eng = 100; g.refreshDerived();
  assert.ok(Math.abs(g.turretPower(g.turrets[0]) - TURRETS.bolt.p * 1.5 * 2) < 1e-9, 'engineering doubles turret damage');
});

test('the mortar shells the densest group and leads moving targets', () => {
  const { g } = newGame();
  g.units = []; g.addTurret('mortar');
  emptyWave(g);
  const pack = [0, 1, 2, 3].map((i) => addEnemy(g, 0, 20 + i * 0.5, 20, { hp: 100 }));
  const loner = addEnemy(g, 0, -25, -20, { hp: 100 });
  steps(g, 1);
  assert.equal(g.shells.length, 1);
  assert.ok(g.snapshot().fx.some((f) => f[0] === 5), 'launch effect');
  seconds(g, 1.3);
  for (const e of pack) assert.equal(e.hp, 100 - TURRETS.mortar.p);
  assert.equal(loner.hp, 100);
});

test('the ballista shoots the toughest enemy in range', () => {
  const { g } = newGame();
  g.units = []; g.addTurret('ballista');
  emptyWave(g);
  const runner = addEnemy(g, 0, 22, 0, { hp: 30 }), brute = addEnemy(g, 1, -8, -26, { hp: 500 });
  seconds(g, 1);
  assert.equal(brute.hp, 500 - TURRETS.ballista.p);
  assert.equal(runner.hp, 30);
});

test('the tesla coil chains between monsters', () => {
  const { g } = newGame();
  g.units = []; g.addTurret('tesla');
  emptyWave(g);
  const [x, z] = TURRET_SPOTS[0];
  const a = addEnemy(g, 1, x - 6, z, { hp: 500 }), b = addEnemy(g, 1, x - 9, z, { hp: 500 }), c = addEnemy(g, 1, x - 12, z, { hp: 500 });
  steps(g, 1);
  assert.equal(a.hp, 500 - TURRETS.tesla.p);
  assert.ok(b.hp < 500 && c.hp < 500, 'the bolt jumped');
  assert.ok(g.snapshot().fx.some((f) => f[0] === 12));
});

test('a kill pays gold and castle experience once', () => {
  const { g } = newGame();
  g.gold = 0;
  const e = addEnemy(g, 1, 30, 30, { hp: 1 });
  g.hurtEnemy(e, 5);
  g.hurtEnemy(e, 5);
  assert.equal(g.gold, ENEMIES[1].gold);
  assert.equal(g.stats.kills, 1);
  assert.equal(g.xp, ENEMIES[1].points);
});

test('a new run resets the castle, the army, the items and the stats', () => {
  const { g, id } = newGame();
  g.gold = 9999; g.upgrade(id, 'hall'); g.addItem('whetstone'); g.addTurret('bolt'); g.st.dmg = 50; g.level = 7;
  g.train(id, g.units[0].uid); g.segs[3].hp = 0; g.stats.kills = 50; g.bless.archer = 2;
  g.reset();
  assert.deepEqual(g.b, { hall: 1, walls: 1 });
  assert.equal(g.gold, START_GOLD);
  assert.deepEqual(g.items, {}); assert.equal(g.turrets.length, 0); assert.equal(g.level, 1);
  assert.equal(g.st.dmg, LORDS.marshal.mods.dmg); assert.equal(g.bless.archer, 0);
  assert.ok(g.segs.every((s) => s.hp === s.max && s.max === s.base));
  assert.equal(g.th.hp, 1500);
  assert.equal(g.units.length, LORDS.marshal.units.length); assert.ok(g.units.every((u) => u.lv === 1));
  assert.equal(g.stats.kills, 0);
});
