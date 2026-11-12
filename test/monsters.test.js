// What makes each monster different: flyers, spitters, splitters, armour, the brood and boiling oil.
import test from 'node:test';
import assert from 'node:assert/strict';
import { S, ENEMIES, UNITS } from '../server/game.js';
import { newGame, steps, seconds, emptyWave, addEnemy, card } from './bots.js';

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
