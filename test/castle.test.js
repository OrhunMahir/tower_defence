// Castle rules: gold, keep and walls, repairs, lords, the shop, turrets and courtyard buildings.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Game, CASTLE, ENEMIES, CAPACITY, START_GOLD, LORDS, ITEMS, TURRETS, TURRET_SPOTS, TURRET_BASE, BUILDINGS, BUILDING_KEYS, BUILD_LEVEL_REQ,
  PLOTS, PLOTS_BY_AGE, AGE_CAP, thMax, wallMul,
} from '../server/game.js';
import { newGame, steps, seconds, emptyWave, addEnemy, seeded, takeRewards } from './bots.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} is not within ${eps} of ${b}`);

test('a new run starts with gold, the lord\'s defenders, a shop and two wave offers', () => {
  const { g } = newGame();
  assert.equal(g.lord, 'marshal'); assert.equal(g.siege, 1); assert.equal(g.age, 0);
  assert.equal(g.gold, START_GOLD);
  assert.deepEqual(g.units.map((u) => u.k), LORDS.marshal.units);
  assert.ok(g.units.every((u) => u.lv === 1 && u.spec === 0 && typeof u.name === 'string' && u.name.length > 1));
  assert.ok(g.units.filter((u) => u.k === 'spear').every((u) => g.slots[u.slot].seg >= 0), 'the spearman stands on a wall');
  assert.equal(g.waves.length, 2);
  assert.equal(g.shop.length, 4);
  assert.deepEqual(g.b, { hall: 1, walls: 1 });
  assert.ok(g.plots.every((p) => p === null));
  assert.equal(g.phase, 'prep'); assert.equal(g.level, 1);
});

test('every lord starts differently and trades a strength for a weakness', () => {
  for (const [k, lord] of Object.entries(LORDS)) {
    const g = new Game(seeded(1), { lord: k });
    assert.deepEqual(g.units.map((u) => u.k), lord.units, k);
    for (const [s, v] of Object.entries(lord.mods)) assert.equal(g.tot[s], v, `${k} ${s}`);
    assert.ok(Object.values(lord.mods).some((v) => v < 0) || k === 'marshal', `${k} has a drawback`);
    assert.equal(g.gold, START_GOLD + (lord.gold || 0));
    assert.equal(g.turrets.length, lord.turret ? 1 : 0);
  }
  assert.equal(new Game(seeded(1), { lord: 'saint' }).th.max, thMax(1) + 400);
  assert.equal(new Game(seeded(1), { lord: 'nobody' }).lord, 'marshal', 'unknown lords fall back to the marshal');
  const gambler = new Game(seeded(1), { lord: 'gambler' }), plain = new Game(seeded(1));
  assert.equal(gambler.shopRerollCost(), Math.round(plain.shopRerollCost() / 2), 'the gambler rerolls at half price');
  const architect = new Game(seeded(1), { lord: 'architect' });
  assert.equal(architect.plotCount(), PLOTS_BY_AGE[0] + 1);
  assert.equal(architect.buildingCost('forge', 1), Math.round(plain.buildingCost('forge', 1) * 0.75));
});

test('upgrades cost gold; the walls are capped by the keep and both by the age', () => {
  const { g, id } = newGame();
  g.gold = 1e6;
  assert.equal(g.upgrade(id, 'walls'), false, 'walls cannot pass the keep level');
  for (const bad of ['__proto__', 'nope', undefined, 'forge']) assert.equal(g.upgrade(id, bad), false, String(bad));
  assert.equal(g.upgrade(999, 'hall'), false, 'unknown player');
  assert.ok(g.upgrade(id, 'hall'));
  assert.equal(g.gold, 1e6 - CASTLE.hall.cost[1]);
  assert.equal(g.th.max, thMax(2)); assert.equal(g.th.hp, thMax(2));
  assert.ok(g.upgrade(id, 'walls'));
  while (g.upgrade(id, 'hall'));
  assert.equal(g.b.hall, AGE_CAP, 'the first age stops the keep at level 5');
  assert.equal(g.snapshot().bc[0], -2);
  g.age = 3; g.b.hall = 20; g.b.walls = 20;
  assert.equal(g.upgrade(id, 'hall'), false);
  assert.deepEqual(g.snapshot().bc, [-2, -2], 'the Golden Age stops both at level 20');
  g.age = 4;
  assert.ok(g.upgrade(id, 'hall'), 'every later age lifts the cap by five more levels');
  assert.equal(g.castleCap(), 25);
  for (const k in CASTLE) for (let l = 2; l < CASTLE[k].cost.length; l++) assert.ok(CASTLE[k].cost[l] > CASTLE[k].cost[l - 1]);
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
  g.th.hp -= 800; g.gold = 10;
  assert.ok(g.repair(id, 'hall'), 'a partial repair');
  assert.equal(g.gold, 0);
  assert.equal(Math.round(g.th.hp), 1500 - 800 + 200);
  assert.equal(g.repair(id, 'moat'), false);
});

test('after every wave half the damage is mended for free; spring, a chapel and the masons mend more', () => {
  // Wave 9 is a summer wave: no season helps the menders there. Wave 1 is in spring.
  const after = (setup, wave = 9) => {
    const { g } = newGame();
    g.jump(wave);
    setup(g); g.refreshDerived();
    emptyWave(g);
    g.th.hp = g.th.max - 1000; g.segs[0].hp = 0; g.segs[1].hp = g.segs[1].max - 200;
    steps(g, 1);
    return g;
  };
  const plain = after(() => {});
  assert.notEqual(plain.phase, 'wave');
  assert.equal(plain.th.hp, plain.th.max - 500);
  near(plain.segs[0].hp, plain.segs[0].max / 3);
  assert.equal(plain.segs[1].hp, plain.segs[1].max - 100);
  const spring = after(() => {}, 1);
  near(spring.th.hp, spring.th.max - 1000 * (1 - 0.65));
  const chapel = after((g) => { g.plots[0] = { k: 'chapel', lv: 2, paid: 0 }; });
  near(chapel.th.hp, chapel.th.max - 1000 * (1 - 0.66));
  const masons = after((g) => { g.doctrines.push('masons'); });
  assert.equal(masons.th.hp, masons.th.max);
  assert.ok(masons.segs.every((s) => s.hp === s.max), 'even ruins are rebuilt');
});

test('nothing can be bought, built, trained, moved, upgraded or repaired during a wave', () => {
  const { g, id } = newGame();
  g.gold = 5000; g.th.hp -= 100; g.level = 10;
  emptyWave(g); addEnemy(g, 0, 40, 40);
  assert.equal(g.phase, 'wave');
  const u = g.units[0];
  for (const done of [g.upgrade(id, 'hall'), g.repair(id, 'hall'), g.buy(id, 0), g.rerollShop(id), g.lock(id, 0), g.train(id, u.uid), g.dismiss(id, u.uid),
    g.move(id, u.uid, 10), g.build(id, 0, 'forge'), g.advanceAge(id), g.chooseWave(id, 0)]) assert.equal(done, false);
  assert.equal(g.gold, 5000);
});

test('the shop sells items and turrets of this age, never the same offer twice, prices growing with the wave', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const { g } = newGame(seed);
    const ids = g.shop.filter(Boolean).map((o) => o.key || o.k);
    assert.equal(new Set(ids).size, ids.length, `seed ${seed}`);
    for (const o of g.shop.filter(Boolean)) {
      if (o.type === 'item') assert.ok(Object.hasOwn(ITEMS, o.key) && !ITEMS[o.key].relic && ITEMS[o.key].r <= 1, 'the first age sells nothing above rare');
      else assert.equal(TURRETS[o.k].age, 1, 'only first-age turrets at the start');
      assert.equal(o.price, g.priceOf(o));
    }
  }
  const { g } = newGame();
  const o = { type: 'item', key: 'whetstone' }, early = g.priceOf(o);
  g.wave = 20;
  assert.ok(g.priceOf(o) > early * 4);
});

test('only unlocked items are sold', () => {
  const { g } = newGame(2, 1, { items: ['whetstone', 'lime', 'tome', 'fletching', 'wardrum'] });
  for (let i = 0; i < 20; i++) { g.makeShop(); for (const o of g.shop) assert.ok(!o || o.type === 'turret' || ['whetstone', 'lime', 'tome', 'fletching', 'wardrum'].includes(o.key)); }
});

test('buying an item applies it at once; a turret takes a courtyard spot', () => {
  const { g, id } = newGame();
  g.gold = 1e6;
  g.shop = [{ type: 'item', key: 'whetstone', price: 10, locked: false }, { type: 'turret', k: 'bolt', price: 20, locked: false }, null, null];
  assert.ok(g.buy(id, 0));
  assert.equal(g.items.whetstone, 1); assert.equal(g.tot.dmg, LORDS.marshal.mods.dmg + 6);
  assert.equal(g.shop[0], null);
  assert.equal(g.buy(id, 0), false, 'sold out');
  assert.ok(g.buy(id, 1));
  assert.deepEqual(g.turrets.map((t) => [t.k, t.lv]), [['bolt', 1]]);
  for (const bad of [-1, 9, '1', null, 0.5]) assert.equal(g.buy(id, bad), false, String(bad));
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
  assert.ok(g.lock(id, 1));
  assert.equal(g.shop[1].locked, false, 'locking again unlocks');
  g.lock(id, 1);
  emptyWave(g); steps(g, 1);
  takeRewards(g, id);
  assert.equal(g.shop[1].key || g.shop[1].k, kept.key || kept.k, 'still there after the wave');
  assert.equal(g.rerolls, 0, 'reroll price resets every wave');
});

test('a market adds shop offers and makes them cheaper', () => {
  const { g } = newGame();
  const o = { type: 'item', key: 'whetstone' }, full = g.priceOf(o);
  g.plots[0] = { k: 'market', lv: 3, paid: 0 };
  assert.equal(g.shopSize(), 6);
  assert.equal(g.priceOf(o), Math.round(full * 0.88));
  g.makeShop();
  assert.equal(g.shop.length, 6);
});

test('another copy of a turret raises its level; spots come from the workshop', () => {
  const { g } = newGame();
  assert.equal(g.turretSpots(), TURRET_BASE);
  assert.ok(g.addTurret('bolt')); assert.ok(g.addTurret('bolt'));
  assert.deepEqual(g.turrets.map((t) => [t.k, t.lv]), [['bolt', 2]]);
  assert.ok(g.addTurret('cannon'));
  assert.equal(g.addTurret('tesla'), false, 'no spot left');
  g.plots[0] = { k: 'workshop', lv: 2, paid: 0 }; g.refreshDerived();
  assert.equal(g.turretSpots(), TURRET_BASE + 2);
  assert.ok(g.addTurret('tesla'));
  assert.equal(new Set(g.turrets.map((t) => t.spot)).size, 3);
  assert.ok(g.turretSpots() <= TURRET_SPOTS.length);
  near(g.turretPower(g.turrets[0]), TURRETS.bolt.p * 1.5 * (1 + 0.24), 1e-9);
  g.st.eng = 76; g.refreshDerived();
  near(g.turretPower(g.turrets[0]), TURRETS.bolt.p * 1.5 * 2, 1e-9);
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

test('the ballista shoots the toughest enemy in range; the tesla coil chains', () => {
  const { g } = newGame();
  g.units = []; g.addTurret('ballista');
  emptyWave(g);
  const [bx, bz] = TURRET_SPOTS[0];
  const runner = addEnemy(g, 0, bx - 10, bz, { hp: 30 }), brute = addEnemy(g, 1, bx - 14, bz - 6, { hp: 500 });
  seconds(g, 1);
  assert.equal(brute.hp, 500 - TURRETS.ballista.p);
  assert.equal(runner.hp, 30);
  const { g: h } = newGame();
  h.units = []; h.addTurret('tesla');
  emptyWave(h);
  const a = addEnemy(h, 1, bx - 6, bz, { hp: 500 }), b = addEnemy(h, 1, bx - 9, bz, { hp: 500 }), c = addEnemy(h, 1, bx - 12, bz, { hp: 500 });
  steps(h, 1);
  assert.equal(a.hp, 500 - TURRETS.tesla.p);
  assert.ok(b.hp < 500 && c.hp < 500, 'the bolt jumped');
  assert.ok(h.snapshot().fx.some((f) => f[0] === 12));
});

test('buildings need a free plot, the right age, a castle level and gold; one of each', () => {
  const { g, id } = newGame();
  g.gold = 1e6;
  assert.equal(g.build(id, 0, 'forge'), false, 'castle level 2 is needed first');
  g.level = BUILD_LEVEL_REQ[1];
  assert.equal(g.build(id, 0, 'mason'), false, 'a second-age building');
  assert.equal(g.build(id, PLOTS_BY_AGE[0], 'forge'), false, 'that plot opens in a later age');
  for (const bad of [-1, 99, '0', null]) assert.equal(g.build(id, bad, 'forge'), false);
  assert.equal(g.build(id, 0, 'castle'), false);
  assert.ok(g.build(id, 0, 'forge'));
  assert.equal(g.gold, 1e6 - BUILDINGS.forge.cost);
  assert.equal(g.tot.dmg, LORDS.marshal.mods.dmg + BUILDINGS.forge.mods.dmg);
  assert.equal(g.build(id, 0, 'market'), false, 'the plot is taken');
  assert.equal(g.build(id, 1, 'forge'), false, 'one forge is enough');
  assert.ok(g.build(id, 1, 'market'));
  assert.ok(g.snapshot().fx.some((f) => f[0] === 29));
  g.gold = 0;
  g.plots[1] = null;
  assert.equal(g.build(id, 1, 'chapel'), false, 'no gold');
});

test('building levels need more castle levels and gold, and are capped by the age', () => {
  const { g, id } = newGame();
  g.gold = 1e6; g.level = 2;
  g.build(id, 0, 'forge');
  assert.equal(g.upgradeBuilding(id, 0), false, 'level 2 needs castle level 6');
  g.level = 30;
  const before = g.gold;
  assert.ok(g.upgradeBuilding(id, 0));
  assert.equal(before - g.gold, g.buildingCost('forge', 2));
  assert.equal(g.tot.dmg, LORDS.marshal.mods.dmg + 2 * BUILDINGS.forge.mods.dmg);
  assert.equal(g.upgradeBuilding(id, 0), false, 'the first age stops at level 2');
  g.age = 3; g.refreshDerived();
  while (g.upgradeBuilding(id, 0));
  assert.equal(g.plots[0].lv, 5);
  assert.equal(g.upgradeBuilding(id, 3), false, 'nothing stands there');
  for (const k of BUILDING_KEYS) for (let l = 2; l <= 5; l++) assert.ok(g.buildingCost(k, l) > g.buildingCost(k, l - 1));
  assert.ok(g.buildingCost('watchtower', 1) > g.buildingCost('forge', 1) * 4, 'later buildings cost more');
});

test('demolishing a building returns half its cost and frees the plot', () => {
  const { g, id } = newGame();
  g.gold = 1000; g.level = 10;
  g.build(id, 0, 'forge'); g.upgradeBuilding(id, 0);
  const paid = 1000 - g.gold;
  assert.ok(g.demolish(id, 0));
  assert.equal(g.gold, 1000 - paid + Math.floor(paid / 2));
  assert.equal(g.plots[0], null);
  assert.equal(g.tot.dmg, LORDS.marshal.mods.dmg);
  assert.equal(g.demolish(id, 0), false);
});

test('seven plots, opened age by age, none on top of a turret spot or the keep', () => {
  assert.equal(PLOTS.length, 7);
  assert.deepEqual(PLOTS_BY_AGE, [2, 4, 6, 7]);
  for (const [x, z] of PLOTS) {
    assert.ok(Math.max(Math.abs(x), Math.abs(z)) > 5.5 && Math.max(Math.abs(x), Math.abs(z)) < 12, 'inside the walls, clear of the keep');
    for (const [tx, tz] of TURRET_SPOTS) assert.ok(Math.hypot(x - tx, z - tz) > 4.5);
  }
});

test('interest: the piggy bank, the mint and the treasury each pay on unspent gold', () => {
  const gain = (setup) => {
    const { g, id } = newGame(9);
    setup(g); g.refreshDerived();
    g.gold = 1000;
    const i = g.waves.findIndex((w) => !w.hard), reward = g.waves[i].gold;
    g.chooseWave(id, i); g.queue = [];
    steps(g, 1);
    return g.gold - 1000 - reward;
  };
  assert.equal(gain(() => {}), 0);
  assert.ok(gain((g) => { g.items.piggy = 1; }) > 0);
  assert.ok(gain((g) => { g.plots[0] = { k: 'mint', lv: 2, paid: 0 }; }) > 0);
  assert.ok(gain((g) => { g.doctrines.push('treasury'); }) > 0);
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

test('a new run resets the castle, the army, the buildings, the items and the age', () => {
  const { g, id } = newGame();
  g.gold = 9999; g.level = 9; g.upgrade(id, 'hall'); g.addItem('whetstone'); g.addTurret('bolt'); g.st.dmg = 50; g.build(id, 0, 'forge');
  g.train(id, g.units[0].uid); g.segs[3].hp = 0; g.stats.kills = 50; g.bless.archer = 2; g.age = 2; g.doctrines.push('moat'); g.bossWaves = 2;
  g.reset();
  assert.deepEqual(g.b, { hall: 1, walls: 1 });
  assert.equal(g.gold, START_GOLD); assert.equal(g.age, 0); assert.equal(g.bossWaves, 0);
  assert.deepEqual(g.items, {}); assert.equal(g.turrets.length, 0); assert.equal(g.level, 1); assert.deepEqual(g.doctrines, []);
  assert.ok(g.plots.every((p) => p === null));
  assert.equal(g.st.dmg, LORDS.marshal.mods.dmg); assert.equal(g.bless.archer, 0);
  assert.ok(g.segs.every((s) => s.hp === s.max && s.max === s.base));
  assert.equal(g.th.hp, 1500);
  assert.equal(g.units.length, LORDS.marshal.units.length); assert.ok(g.units.every((u) => u.lv === 1));
  assert.equal(g.stats.kills, 0);
});
