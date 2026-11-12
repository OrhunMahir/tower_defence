// Wave offers, the battle itself and how a run ends.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TICK, S, ENEMIES } from '../server/game.js';
import { newGame, steps, seconds, emptyWave, addEnemy } from './bots.js';

const points = (w) => w.c[0] + 4 * w.c[1];

test('preparation has no clock: nothing happens until a wave is chosen', () => {
  const { g } = newGame();
  seconds(g, 600);
  assert.equal(g.phase, 'prep'); assert.equal(g.wave, 0); assert.equal(g.enemies.length, 0);
});

test('two offers: one is harder and pays double', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const { g } = newGame(seed);
    g.wave = 5; g.makeWaveOffers();
    const hard = g.waves.find((w) => w.hard), easy = g.waves.find((w) => !w.hard);
    assert.ok(hard && easy, 'exactly one hard offer');
    assert.equal(hard.gold, easy.gold * 2);
    assert.ok(points(hard) >= points(easy) * 1.35, `hard ${points(hard)} vs easy ${points(easy)}`);
  }
});

test('the first offer is a swarm, the second leans on brutes; wave 1 has runners only', () => {
  const { g } = newGame(3);
  assert.ok(g.waves.every((w) => w.c[1] === 0 && w.c[2] === 0 && w.c[0] >= 3));
  for (let seed = 1; seed <= 20; seed++) {
    const { g: h } = newGame(seed);
    h.wave = 7; h.makeWaveOffers();
    const share = (w) => (4 * w.c[1]) / points(w);
    assert.ok(share(h.waves[1]) > share(h.waves[0]), `seed ${seed}`);
  }
});

test('every tenth wave brings the Queen; the hard offer brings two from wave 20', () => {
  const { g } = newGame();
  g.wave = 9; g.makeWaveOffers();
  assert.deepEqual(g.waves.map((w) => w.c[2]), [1, 1]);
  g.wave = 19; g.makeWaveOffers();
  assert.equal(g.waves.find((w) => w.hard).c[2], 2);
  assert.equal(g.waves.find((w) => !w.hard).c[2], 1);
  g.wave = 10; g.makeWaveOffers();
  assert.deepEqual(g.waves.map((w) => w.c[2]), [0, 0]);
});

test('offers grow with the wave number', () => {
  const size = (n) => { const { g } = newGame(5); g.wave = n; g.makeWaveOffers(); return points(g.waves.find((w) => !w.hard)); };
  assert.ok(size(4) > size(0) && size(14) > size(4) * 2);
});

test('choosing an offer starts exactly that wave', () => {
  const { g, id } = newGame(4);
  g.wave = 6; g.makeWaveOffers();
  const offer = g.waves[1];
  for (const bad of [2, -1, 0.5, '0', null]) assert.equal(g.chooseWave(id, bad), false, String(bad));
  assert.equal(g.chooseWave(999, 1), false, 'unknown player');
  assert.ok(g.chooseWave(id, 1));
  assert.equal(g.phase, 'wave'); assert.equal(g.wave, 7);
  const counts = [0, 1, 2].map((t) => g.queue.filter((q) => q.t === t).length);
  assert.deepEqual(counts, offer.c);
  assert.equal(g.snapshot().wv.length, 0, 'no offers while the wave runs');
});

test('monsters spawn far outside the walls and get tougher each wave', () => {
  const { g, id } = newGame();
  g.wave = 10; g.makeWaveOffers(); g.chooseWave(id, 0);
  seconds(g, 3);
  assert.ok(g.enemies.length > 0);
  const e = g.enemies.at(-1);
  assert.ok(e.max === Math.round(ENEMIES[e.t].hp * 1.09 ** 10));
});

test('clearing the wave pays the chosen reward and makes new offers', () => {
  for (const hard of [false, true]) {
    const { g, id } = newGame(9);
    g.gold = 0;
    const i = g.waves.findIndex((w) => w.hard === hard), reward = g.waves[i].gold;
    g.chooseWave(id, i);
    g.queue = [];
    const e = addEnemy(g, 0, 30, 0, { hp: 1 });
    g.hurtEnemy(e, 5);
    steps(g, 1);
    assert.equal(g.phase, 'prep');
    assert.equal(g.gold, reward + ENEMIES[0].gold);
    assert.equal(reward, hard ? 110 : 55);
    assert.equal(g.waves.length, 2, 'offers for wave 2');
  }
});

test('the mine and happy citizens add to the wave income', () => {
  const income = (setup) => {
    const { g, id } = newGame(9);
    g.gold = 0;
    const i = g.waves.findIndex((w) => !w.hard);
    setup(g); g.chooseWave(id, i); g.queue = [];
    steps(g, 1);
    return g.gold;
  };
  assert.equal(income(() => {}), 55);
  assert.equal(income((g) => { g.b.mine = 2; }), 55 + 50);
  assert.equal(income((g) => { g.perks.happy = 1; }), Math.round(55 * 1.5));
});

test('a monster walks to the castle and batters the wall in its way', () => {
  const { g } = newGame();
  g.units = [];
  emptyWave(g);
  addEnemy(g, 0, 0, -30, { hp: 9999, cd: 0 });
  seconds(g, 12);
  const north = g.segs.find((s) => s.x === 0 && s.z === -S);
  assert.ok(north.hp < north.max, 'the north wall took damage');
  assert.equal(g.th.hp, g.th.max, 'the keep is untouched behind the wall');
});

test('a brute hurts walls two and a half times as much', () => {
  const { g } = newGame();
  g.units = [];
  emptyWave(g);
  addEnemy(g, 1, 0, -S - 1.6, { hp: 9999, cd: 0 });
  steps(g, 1);
  const north = g.segs.find((s) => s.x === 0 && s.z === -S);
  assert.equal(north.max - north.hp, ENEMIES[1].dmg * 2.5);
});

test('monsters pour through a breach and attack the keep', () => {
  const { g } = newGame();
  g.units = [];
  emptyWave(g);
  g.segs.find((s) => s.x === 0 && s.z === -S).hp = 0;
  addEnemy(g, 0, 6, -22, { hp: 9999, cd: 0 });
  seconds(g, 12);
  assert.ok(g.th.hp < g.th.max);
  assert.ok(g.segs.every((s) => s.hp === s.max || s.hp === 0), 'it used the breach instead of breaking another wall');
});

test('monsters do not stack on top of each other', () => {
  const { g } = newGame();
  g.units = [];
  emptyWave(g);
  const a = addEnemy(g, 0, 0, -30), b = addEnemy(g, 0, 0.01, -30);
  seconds(g, 1);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 0.9);
});

test('when the keep falls the run is over, then everything restarts', () => {
  const { g } = newGame();
  g.units = [];
  emptyWave(g);
  g.wave = 7; g.gold = 4321; g.b.mine = 3;
  g.segs.find((s) => s.x === 0 && s.z === -S).hp = 0;
  g.th.hp = 5;
  addEnemy(g, 1, 0, -4.8, { hp: 9999, cd: 0 });
  steps(g, 2);
  assert.equal(g.phase, 'over'); assert.equal(g.th.hp, 0); assert.equal(g.reached, 7);
  const snap = g.snapshot();
  assert.equal(snap.ph, 'over'); assert.equal(snap.reached, 7); assert.equal(snap.tm, 8);
  seconds(g, 7);
  assert.equal(g.phase, 'over');
  seconds(g, 1.2);
  assert.equal(g.phase, 'prep'); assert.equal(g.wave, 0); assert.equal(g.gold, 100); assert.equal(g.b.mine, 0);
  assert.equal(g.enemies.length, 0); assert.equal(g.waves.length, 2);
});

test('an empty room resets, and nothing runs without players', () => {
  const { g, id } = newGame();
  g.gold = 777; g.chooseWave(id, 0);
  g.removePlayer(id);
  assert.equal(g.phase, 'prep'); assert.equal(g.gold, 100);
  g.phase = 'wave'; g.queue = [{ t: 0, a: 0 }];
  g.step(TICK);
  assert.equal(g.enemies.length, 0);
});

test('a snapshot is plain JSON with everything the client draws', () => {
  const { g, id } = newGame();
  g.chooseWave(id, 0);
  seconds(g, 4);
  const s = JSON.parse(JSON.stringify(g.snapshot()));
  for (const k of ['ph', 'wave', 'gold', 'th', 'left', 'np', 'b', 'rc', 'pk', 'wv', 'un', 'uc', 'ut', 'cap', 'sg', 'en', 'pr', 'fx']) assert.ok(k in s, k);
  assert.equal(s.sg.length, 28); assert.equal(s.un.length, 4); assert.equal(s.b.length, 4);
  assert.ok(s.en.length > 0 && s.en[0].length === 5);
  g.fx.push([1, 0, 0, 1]);
  assert.equal(g.snapshot().fx.length, 1);
  assert.equal(g.snapshot().fx.length, 0, 'effects are sent once');
});
