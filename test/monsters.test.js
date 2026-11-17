// What makes each monster different: flyers, spitters, splitters, armour, the brood and boiling oil.
import test from 'node:test';
import assert from 'node:assert/strict';
import { S, ENEMIES, UNITS, BOSSES, THEMES, CHARGE_AFTER, MAX_ALIVE } from '../server/game.js';
import { newGame, steps, seconds, emptyWave, addEnemy, card, place } from './bots.js';

const T = Object.fromEntries(ENEMIES.map((e, t) => [e.key, t]));
function empty() { const { g, id } = newGame(); g.units = []; emptyWave(g); return { g, id }; }

test('gloomwings fly over the walls straight at the keep', () => {
  const { g } = empty();
  addEnemy(g, T.flyer, 0, -30, { hp: 9999, cd: 0 });
  seconds(g, 10);
  assert.ok(g.th.hp < g.th.max, 'the keep was attacked');
  assert.ok(g.segs.every((s) => s.hp === s.max), 'no wall was touched');
});

test('spearmen cannot reach flyers, archers can', () => {
  const at = (k) => {
    const { g } = newGame();
    const slot = g.slots.findIndex((s) => s.x === 8 && s.z === S);
    g.units = [g.newUnit(card(k), slot)];
    g.st.dmg = 0; g.refreshDerived();
    emptyWave(g);
    const e = addEnemy(g, T.flyer, 8, S + 2, { hp: 500 });
    seconds(g, 1);
    return 500 - e.hp;
  };
  assert.equal(at('spear'), 0);
  assert.equal(at('archer'), UNITS.archer.p);
});

test('spitters stop short of the wall and spit at it from range', () => {
  const { g } = empty();
  const e = addEnemy(g, T.spitter, 0, -30, { hp: 9999, cd: 0 });
  seconds(g, 12);
  const north = g.segs.find((s) => s.x === 0 && s.z === -S);
  assert.ok(north.hp < north.max, 'the wall took acid');
  assert.ok(e.z < -S - 3, `kept its distance (z = ${e.z.toFixed(1)})`);
  assert.ok(g.fx.some((f) => f[0] === 10));
});

test('a broodsack bursts into three runners', () => {
  const { g } = empty();
  const e = addEnemy(g, T.splitter, 30, 0, { hp: 1 });
  g.hurtEnemy(e, 5);
  steps(g, 1);
  const runners = g.enemies.filter((m) => m.t === T.runner);
  assert.equal(runners.length, 3);
  assert.ok(runners.every((r) => r.max < ENEMIES[T.runner].hp), 'the spawn is weaker than a full runner');
});

test('armour shrugs off weak hits; crossbows pierce it', () => {
  const { g } = empty();
  const e = addEnemy(g, T.shellback, 30, 0, { hp: 1000 });
  g.hurtEnemy(e, 10);
  assert.equal(e.hp, 1000 - 2.5, 'a weak hit does a quarter of its damage');
  g.hurtEnemy(e, 50);
  assert.equal(e.hp, 997.5 - 42, 'a strong hit loses the armour value');
  g.hurtEnemy(e, 10, null, true);
  assert.equal(e.hp, 955.5 - 10, 'piercing ignores armour');
});

test('giant slayers hit brutes, armour and bosses harder', () => {
  const { g } = empty();
  const u = g.newUnit(card('archer', { traits: ['slayer'] }), 4);
  const brute = addEnemy(g, T.brute, 30, 0, { hp: 1000 }), runner = addEnemy(g, T.runner, 30, 5, { hp: 1000 });
  g.hurtEnemy(brute, 10, u); g.hurtEnemy(runner, 10, u);
  assert.equal(brute.hp, 985); assert.equal(runner.hp, 990);
});

test('the Brood Mother keeps spawning runners', () => {
  const { g } = empty();
  const m = addEnemy(g, T.broodmother, 0, -45, { hp: 1e6 });
  m.bt = 0.1;
  seconds(g, 7);
  assert.ok(g.enemies.filter((e) => e.t === T.runner).length >= 6);
});

test('mortar shells cannot hit flyers', () => {
  const { g } = empty();
  g.addTurret('mortar');
  const f = addEnemy(g, T.flyer, 20, 20, { hp: 100 });
  steps(g, 2);
  assert.equal(g.shells.length, 0);
  assert.equal(f.hp, 100);
});

// ---- New in the ages update ----

test('sixteen monsters: twelve of the horde and four bosses, each theme made of real ones', () => {
  assert.equal(ENEMIES.length, 16);
  assert.deepEqual(BOSSES.map((t) => ENEMIES[t].key), ['queen', 'behemoth', 'broodmother', 'skytyrant']);
  assert.equal(ENEMIES.filter((e) => e.boss).length, 4);
  assert.equal(new Set(ENEMIES.map((e) => e.key)).size, 16);
  for (const th of THEMES) for (const t in th.w || {}) assert.ok(ENEMIES[t] && !ENEMIES[t].boss, `${th.key}: ${t}`);
  const used = new Set(THEMES.flatMap((th) => Object.keys(th.w || {}).map(Number)));
  for (const [t, e] of ENEMIES.entries()) if (!e.boss) assert.ok(used.has(t), `${e.key} has a theme`);
});

test('a blightling bursts against the first wall it reaches', () => {
  const { g } = empty();
  g.st.armor = 0; g.refreshDerived();
  const e = addEnemy(g, T.blightling, 0, -S - 3, { hp: 999 });
  addEnemy(g, T.brute, 300, 300, { hp: 1e9 });   // a bystander, so the wave does not end
  seconds(g, 1.5);
  const north = g.segs.find((s) => s.x === 0 && s.z === -S);
  assert.equal(north.max - north.hp, ENEMIES[T.blightling].dmg * ENEMIES[T.blightling].wallMul);
  assert.equal(e.hp, 0); assert.ok(!g.enemies.includes(e), 'nothing is left of it');
  assert.ok(g.fx.some((f) => f[0] === 1 && f[4] === 2));
  // Through a breach it bursts against the keep, without the wall bonus.
  const { g: h } = empty();
  h.st.armor = 0; h.refreshDerived();
  h.segs.find((s) => s.x === 0 && s.z === -S).hp = 0;
  addEnemy(h, T.blightling, 0, -S - 3, { hp: 999 });
  addEnemy(h, T.brute, 300, 300, { hp: 1e9 });
  seconds(h, 4);
  assert.equal(h.th.max - h.th.hp, ENEMIES[T.blightling].dmg);
});

test('a shaman keeps its distance and mends the monsters around it; two shamans do not heal twice', () => {
  const heal = (shamans, t = T.brute) => {
    const { g } = empty();
    for (let i = 0; i < shamans; i++) addEnemy(g, T.shaman, 2 + i, -40, { hp: 999 });
    const e = addEnemy(g, t, 0, -40, { hp: 1000 }), far = addEnemy(g, T.brute, 30, -40, { hp: 1000 });
    e.hp = 500; far.hp = 500;
    seconds(g, 1);
    return [e.hp - 500, far.hp - 500, g];
  };
  const [one, far] = heal(1);
  assert.ok(Math.abs(one - 1000 * ENEMIES[T.shaman].heal) < 0.5, `${one} health a second`);
  assert.equal(far, 0, 'only within reach');
  assert.ok(Math.abs(heal(3)[0] - one) < 0.5);
  assert.ok(Math.abs(heal(1, T.queen)[0] - one / 4) < 0.5, 'bosses mend a quarter as fast');
  const { g } = empty();
  const sh = addEnemy(g, T.shaman, 0, -40, { hp: 999, cd: 0 });
  seconds(g, 20);
  assert.ok(sh.z < -S - 5, 'the shaman stays out of reach of spears');
  const north = g.segs.find((s) => s.x === 0 && s.z === -S);
  assert.ok(north.hp < north.max, 'and throws at the wall');
  const tired = empty().g;
  addEnemy(tired, T.shaman, 2, -40, { hp: 999 });
  const e = addEnemy(tired, T.brute, 0, -40, { hp: 1000 }); e.hp = 500;
  tired.waveT = 2 * CHARGE_AFTER + 1;
  seconds(tired, 1);
  assert.equal(e.hp, 500, 'a long fight wears the shamans out');
});

test('a ram is slow, armoured and breaks walls five times as fast', () => {
  const { g } = empty();
  g.st.armor = 0; g.refreshDerived();
  addEnemy(g, T.ram, 0, -S - 2, { hp: 9999, cd: 0 });
  steps(g, 1);
  const north = g.segs.find((s) => s.x === 0 && s.z === -S);
  assert.equal(north.max - north.hp, ENEMIES[T.ram].dmg * 5);
  const e = addEnemy(g, T.ram, 30, 30, { hp: 1000 });
  g.hurtEnemy(e, 10);
  assert.equal(1000 - e.hp, 4, 'armour 6');
});

test('a burrower digs under the walls and comes up in the courtyard', () => {
  const { g } = newGame();
  g.units = []; g.st.dmg = 0; g.refreshDerived();
  const u = place(g, 'archer', g.slots.findIndex((s) => s.x === 0 && s.z === -S));
  emptyWave(g);
  const e = addEnemy(g, T.burrower, 0, -22, { hp: 5000, cd: 0 });
  e.under = true;
  assert.equal(g.snapshot().en[0][5] & 8, 8, 'the client draws it as a mound');
  g.hurtEnemy(e, 100);
  assert.equal(e.hp, 5000, 'nothing can hurt it underground');
  seconds(g, 3);
  assert.equal(e.hp, 5000, 'nobody shoots at it');
  assert.ok(e.under);
  seconds(g, 3);
  assert.equal(e.under, false, 'it surfaces inside the walls');
  assert.ok(Math.max(Math.abs(e.x), Math.abs(e.z)) < S - 2);
  assert.ok(g.segs.every((s) => s.hp === s.max), 'no wall was touched');
  seconds(g, 6);
  assert.ok(g.th.hp < g.th.max, 'and goes for the keep');
  assert.ok(e.hp < 5000 && u.cd > 0, 'now the archer can hit it');
});

test('a wraith slips past almost half of the shots, but not fire or poison', () => {
  const { g } = empty();
  const e = addEnemy(g, T.wraith, 30, 30, { hp: 1e6 });
  let hits = 0;
  for (let i = 0; i < 2000; i++) { const hp = e.hp; g.hurtEnemy(e, 10); if (e.hp < hp) hits++; }
  assert.ok(hits > 1000 && hits < 1200, `${hits} of 2000 shots hit`);
  assert.ok(g.fx.some((f) => f[0] === 22 && f[4] === 2), 'a miss is shown');
  const hp = e.hp;
  for (let i = 0; i < 100; i++) g.hurtEnemy(e, 10, null, false, false, false);
  assert.equal(hp - e.hp, 1000, 'burning and poison always bite');
});

test('a hurler lobs rocks at the walls from far away', () => {
  const { g } = empty();
  g.st.armor = 0; g.refreshDerived();
  const e = addEnemy(g, T.hurler, 0, -40, { hp: 1e6, cd: 0 });
  seconds(g, 16);
  assert.ok(e.z < -S - 10, `it stops at ${e.z.toFixed(1)}`);
  const north = g.segs.find((s) => s.x === 0 && s.z === -S);
  const thrown = (north.max - north.hp) / (ENEMIES[T.hurler].dmg * ENEMIES[T.hurler].wallMul);
  assert.ok(thrown >= 2 && thrown <= 4 && Number.isInteger(thrown), `${thrown} rocks in the time it had`);
  assert.ok(g.fx.some((f) => f[0] === 10 && f[4] === 1), 'drawn as a rock, not spit');
});

test('the Queen shrieks: monsters near her speed up and runners answer', () => {
  const { g } = empty();
  const q = addEnemy(g, T.queen, 0, -40, { hp: 1e6 }), near = addEnemy(g, T.brute, 5, -40, { hp: 1e6 }), far = addEnemy(g, T.brute, 40, -40, { hp: 1e6 });
  q.pt = 0;
  const count = g.enemies.length;
  steps(g, 2);
  assert.ok(near.haste > 0); assert.ok(!(far.haste > 0));
  assert.equal(g.enemies.length, count + 2, 'two runners join her');
  assert.equal(g.snapshot().en.find((e) => e[0] === near.id)[5] & 32, 32);
  const walk = (haste) => { const t = empty().g; const e = addEnemy(t, T.brute, 0, -40, { hp: 1e6 }); e.haste = haste; seconds(t, 1); return 40 + e.z; };
  assert.ok(Math.abs(walk(5) / walk(0) - 1.35) < 0.01);
  assert.ok(q.pt > 8, 'and she needs a while before the next one');
});

test('the Behemoth marks a wall, then brings more than half of it down', () => {
  const { g } = empty();
  g.st.armor = 0; g.refreshDerived();
  const b = addEnemy(g, T.behemoth, 0, -34, { hp: 1e6 });
  b.pt = 0;
  steps(g, 1);
  assert.ok(b.mark >= 0, 'a wall is marked');
  const s = g.segs[b.mark];
  assert.ok(g.fx.some((f) => f[0] === 25));
  seconds(g, 2);
  assert.equal(s.hp, s.max, 'the commander has a moment to react');
  seconds(g, 0.7);
  assert.ok(Math.abs(s.hp - s.max * 0.4) < 1, 'then the quake lands');
  assert.equal(b.mark, -1);
});

test('the Sky Tyrant dives at a defender and stuns everyone around', () => {
  const { g } = newGame();
  emptyWave(g);
  const t = addEnemy(g, T.skytyrant, 0, -45, { hp: 1e6 });
  t.pt = 0;
  steps(g, 1);
  const stunned = g.units.filter((u) => u.stun > 0);
  assert.ok(stunned.length >= 1 && stunned.length < g.units.length);
  assert.ok(g.snapshot().un.some((u) => u[4] & 1), 'the client shows who is stunned');
  addEnemy(g, T.runner, g.slots[stunned[0].slot].x, g.slots[stunned[0].slot].z - 3, { hp: 1e6 });
  stunned[0].cd = 0;
  const shots = g.projs.length;
  g.units = [stunned[0]];
  g.updateUnits(0.05);
  assert.equal(g.projs.length, shots, 'a stunned defender does nothing');
  seconds(g, 3.2);
  assert.ok(!(stunned[0].stun > 0), 'for three seconds');
});

test('the brood stops growing when the field is full', () => {
  const { g } = empty();
  const m = addEnemy(g, T.broodmother, 0, -40, { hp: 1e9 });
  m.bt = 0;
  for (let i = 0; i < MAX_ALIVE; i++) addEnemy(g, T.runner, 60 + (i % 20) * 2, 60 + Math.floor(i / 20) * 2, { hp: 1e9 });
  const count = g.enemies.length;
  steps(g, 3);
  assert.equal(g.enemies.length, count);
});
