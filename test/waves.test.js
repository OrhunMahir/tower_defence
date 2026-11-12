// Wave offers, the battle itself and how a run ends.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TICK, S, ENEMIES, BOSSES, THEMES, MAX_COUNT, OVER_TIME, START_GOLD, FINAL_WAVE, CHARGE_AFTER, hpMul, budget } from '../server/game.js';
import { newGame, steps, seconds, emptyWave, addEnemy } from './bots.js';

const points = (w) => w.c.reduce((a, n, t) => a + (ENEMIES[t].boss ? 0 : n * ENEMIES[t].points), 0);
const offersAt = (n, seed = 1) => { const { g } = newGame(seed); g.wave = n - 1; g.makeWaveOffers(); return g.waves; };

test('preparation has no clock: nothing happens until a wave is chosen', () => {
  const { g } = newGame();
  seconds(g, 600);
  assert.equal(g.phase, 'prep'); assert.equal(g.wave, 0); assert.equal(g.enemies.length, 0);
});

test('two offers: one is harder and pays double', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const ws = offersAt(6, seed);
    const hard = ws.find((w) => w.hard), easy = ws.find((w) => !w.hard);
    assert.ok(hard && easy, 'exactly one hard offer');
    assert.ok(Math.abs(hard.gold - easy.gold * 2) <= 1);
    assert.ok(points(hard) >= points(easy) * 1.3, `hard ${points(hard)} vs easy ${points(easy)}`);
  }
});

test('wave 1 is runners only; later offers follow two different themes', () => {
  assert.ok(offersAt(1).every((w) => w.th === 'swarm' && w.c.every((n, t) => (t === 0 ? n >= 3 : n === 0))));
  for (let seed = 1; seed <= 20; seed++) {
    const ws = offersAt(9, seed);
    assert.notEqual(ws[0].th, ws[1].th, `seed ${seed}`);
    for (const w of ws) assert.ok(THEMES.some((th) => th.key === w.th));
  }
});

test('no monster type shows up before its wave', () => {
  for (let n = 1; n <= 30; n++) {
    for (let seed = 1; seed <= 6; seed++) {
      for (const w of offersAt(n, seed)) {
        w.c.forEach((c, t) => { if (c && !ENEMIES[t].boss) assert.ok(ENEMIES[t].unlock <= n, `${ENEMIES[t].key} on wave ${n}`); });
      }
    }
  }
  const seen = new Set();
  for (let seed = 1; seed <= 40; seed++) for (const w of offersAt(30, seed)) w.c.forEach((c, t) => { if (c) seen.add(t); });
  for (const t of [0, 1, 3, 4, 5, 6]) assert.ok(seen.has(t), `${ENEMIES[t].key} appears by wave 30`);
});

test('every tenth wave brings a boss, in turn; the hard offer brings two from wave 20', () => {
  for (const [n, t] of [[10, 2], [20, 7], [30, 9], [40, 8], [50, 2]]) {
    const ws = offersAt(n);
    assert.ok(ws.every((w) => w.c[t] >= 1), `wave ${n}`);
    assert.ok(ws.every((w) => BOSSES.every((b) => b === t || w.c[b] === 0)));
  }
  const ws = offersAt(20);
  assert.equal(ws.find((w) => w.hard).c[7], 2);
  assert.equal(ws.find((w) => !w.hard).c[7], 1);
  assert.ok(offersAt(11).every((w) => BOSSES.every((b) => w.c[b] === 0)));
});

test('offers grow with the wave number', () => {
  const size = (n) => points(offersAt(n, 5).find((w) => !w.hard));
  assert.ok(size(5) > size(1) && size(15) > size(5) * 2);
  assert.ok(budget(200) > budget(100));
});

test('a huge wave comes as fewer, tougher elites', () => {
  const ws = offersAt(300, 7);
  for (const w of ws) {
    const count = w.c.reduce((a, b) => a + b, 0);
    assert.ok(w.hx > 1, 'elite multiplier');
    assert.ok(count <= MAX_COUNT * 1.1, `${count} monsters`);
  }
  const { g, id } = newGame(7);
  g.wave = 299; g.makeWaveOffers();
  const hx = g.waves[0].hx;
  g.chooseWave(id, 0);
  seconds(g, 1);
  const e = g.enemies.find((m) => m.t === 0) || g.enemies[0];
  if (!ENEMIES[e.t].boss) assert.equal(e.max, Math.round(ENEMIES[e.t].hp * hpMul(300) * hx));
});

test('choosing an offer starts exactly that wave', () => {
  const { g, id } = newGame(4);
  g.wave = 6; g.makeWaveOffers();
  const offer = g.waves[1];
  for (const bad of [2, -1, 0.5, '0', null]) assert.equal(g.chooseWave(id, bad), false, String(bad));
  assert.equal(g.chooseWave(999, 1), false, 'unknown player');
  assert.ok(g.chooseWave(id, 1));
  assert.equal(g.phase, 'wave'); assert.equal(g.wave, 7);
  const counts = ENEMIES.map((_, t) => g.queue.filter((q) => q.t === t).length);
  assert.deepEqual(counts, offer.c);
  const s = g.snapshot();
  assert.equal(s.wv.length, 0, 'no offers while the wave runs');
  assert.equal(s.shop, undefined, 'no shop while the wave runs');
});

test('monsters spawn far outside the walls and get tougher each wave; bosses less so', () => {
  const { g, id } = newGame();
  g.wave = 10; g.makeWaveOffers(); g.chooseWave(id, 0);
  seconds(g, 3);
  assert.ok(g.enemies.length > 0);
  const e = g.enemies.find((m) => !ENEMIES[m.t].boss);
  assert.equal(e.max, Math.round(ENEMIES[e.t].hp * hpMul(11)));
  const boss = g.makeEnemy(2, 50, 0);
  assert.equal(boss.max, Math.round(ENEMIES[2].hp * hpMul(11) ** 0.85));
  for (const n of [50, 100, 200]) assert.ok(hpMul(2 * n) / hpMul(n) < 8, 'growth is polynomial (at most cubic), never exponential');
});

test('difficulty changes monster health and gold', () => {
  const hp = (diff) => { const { g, id } = newGame(1, 1, diff); g.chooseWave(id, 0); return [g.makeEnemy(1, 50, 0).max, g.waves.length ? 0 : g.reward]; };
  const [relaxed, normal, brutal] = ['relaxed', 'normal', 'brutal'].map(hp);
  assert.ok(relaxed[0] < normal[0] && normal[0] < brutal[0]);
  assert.ok(relaxed[1] > normal[1] && normal[1] > brutal[1]);
});

test('clearing the wave pays the chosen reward, then the spoils, then new offers', () => {
  for (const hard of [false, true]) {
    const { g, id } = newGame(9);
    g.gold = 0;
    const i = g.waves.findIndex((w) => w.hard === hard), reward = g.waves[i].gold;
    g.chooseWave(id, i);
    g.queue = [];
    const e = addEnemy(g, 0, 30, 0, { hp: 1 });
    g.hurtEnemy(e, 5);
    steps(g, 1);
    assert.equal(g.phase, 'reward');
    assert.equal(g.gold, reward + ENEMIES[0].gold);
    assert.equal(reward, hard ? 52 : 26);
    assert.equal(g.picks.length, 1); assert.equal(g.picks[0].type, 'spoils');
    assert.equal(g.picks[0].luck, hard ? 30 : 0, 'a hard wave brings luckier spoils');
    assert.ok(g.units.every((u) => u.xp > 0), 'everyone learned something');
    assert.ok(g.skip(id));
    assert.equal(g.phase, 'prep');
    assert.equal(g.waves.length, 2, 'offers for wave 2');
  }
});

test('harvesting pays after every wave and grows 5% each time; the piggy bank pays interest', () => {
  const income = (setup) => {
    const { g, id } = newGame(9);
    g.gold = 0;
    const i = g.waves.findIndex((w) => !w.hard);
    setup(g); g.refreshDerived(); g.chooseWave(id, i); g.queue = [];
    steps(g, 1);
    return g;
  };
  assert.equal(income(() => {}).gold, 26);
  const h = income((g) => { g.st.harvest = 20; });
  assert.equal(h.gold, 26 + 20);
  assert.equal(h.st.harvest, 21);
  assert.equal(income((g) => { g.items.piggy = 1; g.gold = 100; }).gold, 100 + 26 + 10);
});

test('the final wave brings victory: go on endlessly or end the run', () => {
  for (const choice of [0, 1]) {
    const { g, id } = newGame();
    g.wave = FINAL_WAVE - 1; g.makeWaveOffers();
    g.chooseWave(id, 0); g.queue = []; g.enemies = [];
    steps(g, 1);
    assert.equal(g.phase, 'reward'); assert.equal(g.picks[0].type, 'victory'); assert.ok(g.won);
    assert.equal(g.pickView().type, 'victory');
    assert.equal(g.choose(id, 5), false);
    assert.ok(g.choose(id, choice));
    if (choice === 0) {
      assert.ok(g.endless);
      assert.equal(g.picks[0].type, 'spoils', 'two spoils follow a boss wave');
      assert.equal(g.picks.length, 2);
    } else {
      assert.equal(g.phase, 'over'); assert.ok(g.snapshot().victory); assert.equal(g.reached, FINAL_WAVE);
    }
  }
});

test('stragglers charge after a minute, so no wave can stall', () => {
  const { g } = newGame();
  g.units = [];
  emptyWave(g);
  const sp = addEnemy(g, 3, 0, -30, { hp: 1e6, cd: 0 });
  seconds(g, 20);
  const held = sp.z;
  assert.ok(held < -S - 3, 'the spitter keeps its distance at first');
  seconds(g, CHARGE_AFTER - 10);
  assert.ok(sp.z > held + 1, 'then it charges');
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
  g.st.armor = 0; g.refreshDerived();
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

test('when the keep falls the run is over with a summary, then everything restarts', () => {
  const { g } = newGame();
  emptyWave(g);
  g.units = [];
  g.wave = 7; g.gold = 4321; g.b.walls = 3; g.stats.kills = 12;
  g.units.push(g.newUnit({ k: 'mage', rar: 2, lv: 5, p: 14, cd: 2, range: 17, traits: [], name: 'Mira' }, 4));
  g.units[0].kills = 40;
  g.segs.find((s) => s.x === 0 && s.z === -S).hp = 0;
  g.th.hp = 5;
  addEnemy(g, 1, 0, -4.8, { hp: 9999, cd: 0 });
  steps(g, 2);
  assert.equal(g.phase, 'over'); assert.equal(g.th.hp, 0); assert.equal(g.reached, 7);
  const snap = g.snapshot();
  assert.equal(snap.ph, 'over'); assert.equal(snap.reached, 7); assert.equal(snap.tm, OVER_TIME);
  assert.deepEqual(snap.best, { name: 'Mira', k: 'mage', kills: 40, lv: 5 });
  assert.equal(snap.st[0], 12);
  assert.equal(g.enemies.length, 0, 'the battlefield is cleared');
  seconds(g, OVER_TIME - 1);
  assert.equal(g.phase, 'over');
  seconds(g, 1.2);
  assert.equal(g.phase, 'prep'); assert.equal(g.wave, 0); assert.equal(g.gold, START_GOLD); assert.equal(g.b.walls, 1);
  assert.equal(g.waves.length, 2);
});

test('a commander can start the next run at once', () => {
  const { g, id } = newGame();
  assert.equal(g.restart(id), false, 'only after the castle has fallen');
  g.chooseWave(id, 0);
  g.fall();
  assert.equal(g.restart(999), false);
  assert.ok(g.restart(id));
  assert.equal(g.phase, 'prep'); assert.equal(g.wave, 0);
});

test('an empty room resets, and nothing runs without players', () => {
  const { g, id } = newGame();
  g.gold = 777; g.chooseWave(id, 0);
  g.removePlayer(id);
  assert.equal(g.phase, 'prep'); assert.equal(g.gold, START_GOLD);
  g.phase = 'wave'; g.queue = [{ t: 0, a: 0 }];
  g.step(TICK);
  assert.equal(g.enemies.length, 0);
});

test('a snapshot is plain JSON with everything the client draws', () => {
  const { g, id } = newGame();
  const prep = JSON.parse(JSON.stringify(g.snapshot()));
  for (const k of ['ph', 'wave', 'gold', 'diff', 'lord', 'ab', 'th', 'left', 'np', 'lv', 'b', 'bc', 'rc', 'wv', 'un', 'tu', 'cap', 'sg', 'en', 'pr', 'cl', 'st', 'fx', 'ro', 'tot', 'items', 'bless', 'fam', 'hv', 'tp', 'shop', 'rr', 'ns']) assert.ok(k in prep, k);
  assert.equal(prep.ro.length, 4); assert.equal(prep.ro[0].length, 14); assert.equal(prep.shop.length, 4); assert.equal(prep.fam.length, 2);
  assert.equal(prep.ns.length, ENEMIES.length);
  g.chooseWave(id, 0);
  seconds(g, 4);
  const s = JSON.parse(JSON.stringify(g.snapshot()));
  assert.equal(s.sg.length, 28); assert.equal(s.un.length, 4); assert.equal(s.b.length, 2);
  assert.ok(s.en.length > 0 && s.en[0].length === 6);
  assert.equal(s.ro, undefined, 'the full roster is only sent between waves');
  g.fx.push([1, 0, 0, 1]);
  assert.equal(g.snapshot().fx.length, 1);
  assert.equal(g.snapshot().fx.length, 0, 'effects are sent once');
});
