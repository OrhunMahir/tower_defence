// Castle rules: shared gold, upgrades, repairs, perks, wall archers and siege engines.
import test from 'node:test';
import assert from 'node:assert/strict';
import { S, BUILDINGS, GEAR, PERKS, ENEMIES } from '../server/game.js';
import { newGame, steps, seconds, emptyWave, addEnemy } from './bots.js';

// Enemies on a ring: every archer post has a target, but too far for an arrow to land within one tick.
function ring(g, hp = 9999) {
  for (let a = 0; a < 36; a++) addEnemy(g, 0, Math.sin(a / 36 * Math.PI * 2) * 30, Math.cos(a / 36 * Math.PI * 2) * 30, { hp });
}

test('upgrades cost shared gold and are capped by the town hall', () => {
  const { g, p } = newGame();
  assert.equal(g.upgrade(p.id, 'walls'), false, 'no gold');
  g.gold = 1000;
  assert.equal(g.upgrade(p.id, 'walls'), false, 'walls cannot pass the town hall level');
  for (const bad of ['__proto__', 'nope', undefined]) assert.equal(g.upgrade(p.id, bad), false);
  assert.equal(g.upgrade(999, 'hall'), false, 'unknown player');
  assert.ok(g.upgrade(p.id, 'hall'));
  assert.equal(g.gold, 1000 - BUILDINGS.hall.cost[1]);
  assert.equal(g.th.max, 2100); assert.equal(g.th.hp, 2100);
  assert.ok(g.snapshot().fx.some((f) => f[0] === 4 && f[3] === 'hall'));
});

test('a damaged town hall keeps its damage when upgraded', () => {
  const { g, p } = newGame();
  g.gold = 100; g.th.hp = 500;
  g.upgrade(p.id, 'hall');
  assert.equal(g.th.hp, 500 + 600);
});

test('wall upgrades strengthen standing segments and leave ruins alone', () => {
  const { g, p } = newGame();
  g.gold = 1000; g.b.hall = 2;
  const wall = g.segs.find((s) => !s.gate), gate = g.segs.find((s) => s.gate), ruin = g.segs.filter((s) => !s.gate)[1];
  wall.hp = 100; ruin.hp = 0;
  assert.ok(g.upgrade(p.id, 'walls'));
  assert.equal(wall.max, 600); assert.equal(wall.hp, 300);
  assert.equal(gate.max, 900); assert.equal(gate.hp, 900);
  assert.equal(ruin.hp, 0); assert.equal(ruin.max, 600);
});

test('every building stops at its top level', () => {
  const { g, p } = newGame();
  for (const k in BUILDINGS) g.b[k] = BUILDINGS[k].max;
  g.gold = 1e6;
  for (const k in BUILDINGS) assert.equal(g.upgrade(p.id, k), false, k);
  assert.equal(g.gold, 1e6);
});

test('a town hall upgrade offers three distinct perks and waits for the choice', () => {
  const { g, p } = newGame();
  g.gold = 5000;
  g.upgrade(p.id, 'hall');
  assert.equal(g.offer.length, 3);
  assert.equal(new Set(g.offer).size, 3);
  for (const k of g.offer) assert.ok(PERKS.includes(k));
  assert.equal(g.snapshot().of.length, 3);
  assert.equal(g.upgrade(p.id, 'hall'), false, 'next hall level waits for the pick');
  const outside = PERKS.find((k) => !g.offer.includes(k));
  assert.equal(g.choosePerk(p.id, outside), false, 'only offered perks can be picked');
  const pick = g.offer[1];
  assert.ok(g.choosePerk(p.id, pick));
  assert.equal(g.perks[pick], 1); assert.equal(g.offer, null);
  assert.equal(g.choosePerk(p.id, pick), false, 'one pick per offer');
  assert.ok(g.upgrade(p.id, 'hall'));
});

test('a perk can still be picked during the wave', () => {
  const { g, p } = newGame();
  g.gold = 100; g.upgrade(p.id, 'hall');
  emptyWave(g); addEnemy(g, 0, 40, 40);
  assert.ok(g.choosePerk(p.id, g.offer[0]));
});

test('repairs cost gold in proportion to the damage and rebuild ruins', () => {
  const { g, p } = newGame();
  assert.equal(g.repairCost('walls'), 0);
  assert.equal(g.repair(p.id, 'walls'), false, 'nothing to repair');
  g.segs[0].hp = 0; g.segs[2].hp -= 160;
  const cost = Math.ceil((g.segs[0].max + 160) / 20);
  assert.equal(g.repairCost('walls'), cost);
  assert.equal(g.repair(p.id, 'walls'), false, 'no gold');
  g.gold = 500;
  assert.ok(g.repair(p.id, 'walls'));
  assert.equal(g.gold, 500 - cost);
  assert.ok(g.segs.every((s) => s.hp === s.max));
  assert.equal(g.repair(p.id, 'moat'), false);
});

test('with too little gold a repair is partial', () => {
  const { g, p } = newGame();
  g.th.hp -= 800; g.gold = 10;
  assert.ok(g.repair(p.id, 'hall'));
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

test('no upgrades, repairs or gear during a wave', () => {
  const { g, p } = newGame();
  g.gold = 5000; g.b.smith = 1; g.th.hp -= 100;
  emptyWave(g); addEnemy(g, 0, 40, 40);
  assert.equal(g.phase, 'wave');
  assert.equal(g.upgrade(p.id, 'hall'), false);
  assert.equal(g.repair(p.id, 'hall'), false);
  assert.equal(g.buyGear(p.id, 'wpn'), false);
  assert.equal(g.gold, 5000);
});

test('gear tiers need the blacksmith and are bought per hero from shared gold', () => {
  const { g, ps } = newGame(['knight', 'archer']);
  g.gold = 5000;
  assert.equal(g.buyGear(ps[0].id, 'wpn'), false, 'no blacksmith yet');
  g.b.smith = 1;
  assert.ok(g.buyGear(ps[0].id, 'wpn'));
  assert.equal(ps[0].wpn, 2); assert.equal(ps[1].wpn, 1, 'gear is personal');
  assert.equal(g.gold, 5000 - GEAR.wpn[1]);
  assert.equal(g.buyGear(ps[0].id, 'wpn'), false, 'tier 3 needs blacksmith level 2');
  assert.equal(g.buyGear(ps[0].id, 'hat'), false);
  g.b.smith = 5;
  for (let i = 0; i < 10; i++) g.buyGear(ps[1].id, 'arm');
  assert.equal(ps[1].arm, 5, 'tiers stop at 5');
});

test('built buildings block movement, unbuilt ones do not', () => {
  const { g, p } = newGame();
  p.x = 8.5; p.z = -7;
  steps(g, 1);
  assert.equal(p.x, 8.5, 'no mine yet');
  g.b.mine = 1;
  steps(g, 1);
  assert.ok(Math.abs(p.x - 8.5) >= 2.49 || Math.abs(p.z + 7) >= 2.49, 'pushed out of the mine');
});

test('wave income grows with the wave, the mine and happy citizens', () => {
  const income = (setup) => {
    const { g } = newGame();
    emptyWave(g); setup(g);
    steps(g, 1, { holdPrep: false });
    assert.equal(g.phase, 'prep');
    return g.gold;
  };
  assert.equal(income(() => {}), 25 + 8);
  assert.equal(income((g) => { g.wave = 5; }), 25 + 40);
  assert.equal(income((g) => { g.b.mine = 2; }), 25 + 8 + 50);
  assert.equal(income((g) => { g.perks.happy = 1; }), Math.round(33 * 1.5));
});

test('wall archers: one per manned post, more with each level', () => {
  for (const [level, expected] of [[1, 4], [2, 6], [3, 8], [4, 12], [5, 16]]) {
    const { g } = newGame();
    g.b.archers = level;
    emptyWave(g); ring(g);
    steps(g, 1);
    assert.equal(g.projs.filter((b) => b.kind === 2).length, expected, `archer level ${level}`);
  }
});

test('an archer is silent while its wall segment is down', () => {
  const { g } = newGame();
  g.b.archers = 5;
  g.segs[g.posts[4].seg].hp = 0;
  emptyWave(g); ring(g);
  steps(g, 1);
  assert.equal(g.projs.filter((b) => b.kind === 2).length, 15);
});

test('archers hold fire when nothing is in range', () => {
  const { g } = newGame();
  emptyWave(g); addEnemy(g, 0, 50, 50);
  steps(g, 5);
  assert.equal(g.projs.length, 0);
});

test('sharp arrows and archer levels raise arrow damage, rapid bows the rate', () => {
  const shot = (setup) => {
    const { g } = newGame();
    setup(g); emptyWave(g); ring(g); steps(g, 1);
    return { dmg: g.projs[0].dmg, cd: Math.max(...g.archerCd.slice(0, 4)) };
  };
  const base = shot(() => {});
  assert.equal(base.dmg, 9);
  assert.equal(shot((g) => { g.b.archers = 3; }).dmg, 15);
  assert.ok(Math.abs(shot((g) => { g.perks.sharp = 1; }).dmg - 9 * 1.3) < 1e-9);
  assert.ok(base.cd > 1.3 && base.cd <= 1.66);
  assert.ok(shot((g) => { g.perks.rapid = 2; }).cd <= 1.5 / 1.4 * 1.1 + 1e-9);
});

test('castle kills share XP with every hero and pay gold', () => {
  const { g, ps } = newGame(['knight', 'archer']);
  const e = addEnemy(g, 1, 30, 30, { hp: 1 });
  g.hurtEnemy(e, 5, 0);
  assert.equal(ps[0].xp, 12); assert.equal(ps[1].xp, 12);
  assert.equal(g.gold, ENEMIES[1].gold);
  g.hurtEnemy(e, 5, 0);
  assert.equal(g.gold, ENEMIES[1].gold, 'a dead enemy pays only once');
});

test('the mortar shells the densest group and leads moving targets', () => {
  const { g, p } = newGame();
  g.b.archers = 0; g.perks.mortar = 1;
  emptyWave(g);
  const pack = [0, 1, 2, 3].map((i) => addEnemy(g, 0, 20 + i * 0.5, 20, { hp: 100 }));
  const loner = addEnemy(g, 0, -25, -20, { hp: 100 });
  steps(g, 1);
  assert.equal(g.shells.length, 1);
  assert.ok(g.snapshot().fx.some((f) => f[0] === 5), 'launch effect');
  seconds(g, 1.3);
  for (const e of pack) assert.equal(e.hp, 60);
  assert.equal(loner.hp, 100);
  assert.ok(p.xp === 0, 'no kill, no XP');
});

test('a second mortar pick doubles the shell damage', () => {
  const { g } = newGame();
  g.b.archers = 0; g.perks.mortar = 2;
  emptyWave(g);
  const e = addEnemy(g, 1, 20, 20, { hp: 500 });
  seconds(g, 1.3);
  assert.equal(e.hp, 420);
});

test('the ballista shoots the toughest enemy in range', () => {
  const { g } = newGame();
  g.b.archers = 0; g.perks.ballista = 1;
  emptyWave(g);
  const runner = addEnemy(g, 0, 22, 0, { hp: 30 }), brute = addEnemy(g, 1, 0, -24, { hp: 150 });
  seconds(g, 1);
  assert.equal(brute.hp, 30);
  assert.equal(runner.hp, 30);
});

test('a new run resets the castle, perks and heroes', () => {
  const { g, p } = newGame();
  g.gold = 9999; g.upgrade(p.id, 'hall'); g.choosePerk(p.id, g.offer[0]); g.upgrade(p.id, 'smith'); g.buyGear(p.id, 'wpn');
  g.giveXp(p, 500); g.addStat(p.id, 'vit'); g.segs[3].hp = 0;
  g.reset();
  assert.deepEqual(g.b, { hall: 1, walls: 1, archers: 1, mine: 0, smith: 0 });
  assert.equal(g.gold, 0); assert.equal(g.offer, null);
  assert.ok(PERKS.every((k) => g.perks[k] === 0));
  assert.ok(g.segs.every((s) => s.hp === s.max && s.max === s.base));
  assert.equal(g.th.hp, 1500);
  assert.equal(p.lvl, 1); assert.equal(p.pts, 0); assert.equal(p.wpn, 1); assert.equal(p.maxhp, 140); assert.equal(p.st.vit, 0);
});
