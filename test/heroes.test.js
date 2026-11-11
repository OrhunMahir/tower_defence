// Hero rules: movement, the wall walk, attacks, growth, death.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TICK, S, CLASSES, xpNext } from '../server/game.js';
import { newGame, steps, seconds, emptyWave, addEnemy, idle } from './bots.js';

const near = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} is not within ${eps} of ${b}`);

test('nothing happens without players', () => {
  const { g, p } = newGame();
  g.removePlayer(p.id);
  g.step(TICK);
  assert.equal(g.wave, 0);
  assert.equal(g.phase, 'prep');
});

test('unknown and prototype class names fall back to knight', () => {
  const { g } = newGame([]);
  for (const cls of ['nope', '__proto__', 'constructor', undefined, 42]) {
    const p = g.addPlayer(cls);
    assert.equal(p.cls, 'knight');
    assert.equal(p.maxhp, CLASSES.knight.hp);
  }
});

test('garbage input is sanitised', () => {
  const { g, p } = newGame();
  g.setInput(p.id, { mx: NaN, mz: 'x', aim: Infinity, atk: 1 });
  g.setInput(999, { mx: 1 });
  steps(g, 5);
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z) && Number.isFinite(p.aim));
  g.setInput(p.id, { mx: 50, mz: 0, aim: 0, atk: false });
  const x0 = p.x;
  steps(g, 1);
  near(p.x - x0, CLASSES.knight.speed * TICK, 1e-6);
});

test('diagonal movement is not faster than straight movement', () => {
  const { g, p } = newGame();
  p.x = -8; p.z = -8;
  g.setInput(p.id, { mx: 1, mz: 1, aim: 0, atk: false });
  seconds(g, 0.5);
  near(Math.hypot(p.x + 8, p.z + 8), CLASSES.knight.speed * 0.5, 0.05);
});

test('agility makes a hero faster', () => {
  const { g, p } = newGame();
  p.x = -10; p.z = 9; p.st.agi = 10;
  g.setInput(p.id, { mx: 1, mz: 0, aim: 0, atk: false });
  seconds(g, 0.5);
  near(p.x + 10, CLASSES.knight.speed * 1.3 * 0.5, 0.05);
});

test('the town hall blocks heroes', () => {
  const { g, p } = newGame();
  p.x = 0; p.z = 6.5;
  g.setInput(p.id, { mx: 0, mz: -1, aim: 0, atk: false });
  seconds(g, 2);
  assert.ok(p.z >= 3.5 + 0.5 - 1e-6, `stopped at the town hall (z=${p.z})`);
});

test('heroes climb onto the walls but never leave the castle', () => {
  const { g, p } = newGame();
  p.x = 6; p.z = 8;
  assert.equal(p.up, false);
  g.setInput(p.id, { mx: 0, mz: 1, aim: 0, atk: false });
  seconds(g, 3);
  assert.ok(p.z <= S + 0.3 + 1e-9 && p.z > S - 0.7, `standing on the south wall (z=${p.z})`);
  assert.equal(p.up, true);
  assert.equal(g.snapshot().pl[0][17], 1, 'snapshot reports the wall walk');
  g.setInput(p.id, { mx: 1, mz: 1, aim: 0, atk: false });
  seconds(g, 5);
  assert.ok(Math.abs(p.x) <= S + 0.3 + 1e-9 && Math.abs(p.z) <= S + 0.3 + 1e-9, 'still inside the outer edge');
});

test('a hero on a destroyed segment stands in the breach, not on a wall', () => {
  const { g, p } = newGame();
  const seg = g.segs.find((s) => s.x === 8 && s.z === S);
  p.x = 8; p.z = S;
  steps(g, 1);
  assert.equal(p.up, true);
  seg.hp = 0;
  steps(g, 1);
  assert.equal(p.up, false);
  assert.ok(p.z <= S + 0.3 + 1e-9, 'cannot walk out through the breach');
});

test('knight hits what is in front and in reach, not what is behind', () => {
  const { g, p } = newGame();
  p.x = -8; p.z = 0;
  const front = addEnemy(g, 0, -8, 2, { hp: 500 }), behind = addEnemy(g, 0, -8, -2.5, { hp: 500 }), far = addEnemy(g, 0, -8, 6, { hp: 500 });
  g.setInput(p.id, { mx: 0, mz: 0, aim: 0, atk: true });
  steps(g, 1);
  assert.equal(front.hp, 500 - CLASSES.knight.dmg);
  assert.equal(behind.hp, 500);
  assert.equal(far.hp, 500);
  assert.equal(p.atkN, 1);
});

test('attacks respect the cooldown, agility shortens it', () => {
  const count = (agi) => {
    const { g, p } = newGame();
    p.st.agi = agi;
    g.setInput(p.id, { mx: 0, mz: 0, aim: 0, atk: true });
    seconds(g, 3);
    return p.atkN;
  };
  const base = count(0), quick = count(10);
  assert.ok(base >= 6 && base <= 7, `about 3s / 0.45s attacks, got ${base}`);
  assert.ok(quick > base, `agility 10 attacks more often (${quick} vs ${base})`);
});

test('an arrow flies straight and hurts only the first enemy it meets', () => {
  const { g, p } = newGame(['archer']);
  p.x = -8; p.z = -8;
  const first = addEnemy(g, 0, -8, 4, { hp: 500 }), second = addEnemy(g, 0, -8, 6, { hp: 500 });
  g.setInput(p.id, { mx: 0, mz: 0, aim: 0, atk: true });
  steps(g, 1);
  g.setInput(p.id, idle);
  seconds(g, 1);
  assert.equal(first.hp, 500 - CLASSES.archer.dmg);
  assert.equal(second.hp, 500);
  assert.equal(g.projs.length, 0, 'the arrow is spent');
});

test('a shot from the top of a wall reaches further', () => {
  const reach = (onWall) => {
    const { g, p } = newGame(['archer']);
    p.x = 6; p.z = onWall ? S : 9;
    steps(g, 1);
    const from = p.z;
    g.setInput(p.id, { mx: 0, mz: 0, aim: 0, atk: true });
    steps(g, 1);
    g.setInput(p.id, idle);
    let last = from;
    for (let i = 0; i < 60 && g.projs.length; i++) { last = g.projs[0].z; steps(g, 1); }
    return last - from;
  };
  const ground = reach(false), wall = reach(true);
  assert.ok(wall > ground * 1.2, `wall shot ${wall.toFixed(1)} vs ground shot ${ground.toFixed(1)}`);
});

test('a mage orb explodes and hurts everything in its radius', () => {
  const { g, p } = newGame(['mage']);
  p.x = -8; p.z = -8;
  const a = addEnemy(g, 0, -8, 4, { hp: 500 }), b = addEnemy(g, 0, -6.5, 4, { hp: 500 }), c = addEnemy(g, 0, -8, 10, { hp: 500 });
  g.setInput(p.id, { mx: 0, mz: 0, aim: 0, atk: true });
  steps(g, 1);
  g.setInput(p.id, idle);
  seconds(g, 1.5);
  assert.equal(a.hp, 500 - CLASSES.mage.dmg);
  assert.equal(b.hp, 500 - CLASSES.mage.dmg);
  assert.equal(c.hp, 500);
  assert.ok(g.snapshot().fx.some((f) => f[0] === 1), 'an explosion effect is reported');
});

test('strength, weapon tier and crit multiply damage', () => {
  const { g, p } = newGame();
  p.x = -8; p.z = 0; p.st.str = 5; p.wpn = 3; p.st.crit = 20;
  const e = addEnemy(g, 1, -8, 2, { hp: 5000 });
  g.setInput(p.id, { mx: 0, mz: 0, aim: 0, atk: true });
  steps(g, 1);
  near(5000 - e.hp, CLASSES.knight.dmg * 1.4 * 1.7 * 2, 1e-6);
});

test('a kill pays gold and XP; a level gives a stat point and a full heal', () => {
  const { g, p } = newGame();
  p.x = -8; p.z = 0; p.hp = 10;
  addEnemy(g, 1, -8, 2, { hp: 1 });
  g.setInput(p.id, { mx: 0, mz: 0, aim: 0, atk: true });
  steps(g, 1);
  assert.equal(g.gold, 12);
  assert.equal(p.xp, 30);
  g.giveXp(p, xpNext(1) - 30);
  assert.equal(p.lvl, 2); assert.equal(p.xp, 0); assert.equal(p.pts, 1);
  assert.equal(p.hp, p.maxhp);
  g.giveXp(p, 10000);
  assert.ok(p.lvl > 5 && p.pts === p.lvl - 1, 'several levels at once');
});

test('stat points: spending, limits and vitality', () => {
  const { g, p } = newGame();
  assert.equal(g.addStat(p.id, 'str'), false, 'no points');
  p.pts = 30;
  assert.equal(g.addStat(p.id, 'luck'), false);
  assert.equal(g.addStat(p.id, '__proto__'), false);
  assert.ok(g.addStat(p.id, 'vit'));
  assert.equal(p.maxhp, CLASSES.knight.hp + 15); assert.equal(p.hp, p.maxhp);
  for (let i = 0; i < 25; i++) g.addStat(p.id, 'str');
  assert.equal(p.st.str, 20, 'stats are capped');
  assert.equal(p.pts, 30 - 1 - 20);
});

test('class changes only between waves and keeps the level', () => {
  const { g, p } = newGame();
  g.giveXp(p, xpNext(1)); g.addStat(p.id, 'vit');
  g.setClass(p.id, 'mage');
  assert.equal(p.cls, 'mage'); assert.equal(p.lvl, 2); assert.equal(p.maxhp, CLASSES.mage.hp + 15);
  g.setClass(p.id, 'constructor');
  assert.equal(p.cls, 'mage');
  emptyWave(g);
  addEnemy(g, 0, 40, 40);
  g.setClass(p.id, 'archer');
  assert.equal(p.cls, 'mage', 'no class change during a wave');
});

test('armor reduces damage; a dead hero respawns at the hall after 5 seconds', () => {
  const { g, p } = newGame();
  emptyWave(g);
  p.x = -10; p.z = -10; p.arm = 3;
  const e = addEnemy(g, 0, -10, -11, { hp: 9999, cd: 0 });
  steps(g, 1);
  near(p.maxhp - p.hp, 6 * (1 - 0.24), 1e-6);
  p.hp = 1; e.cd = 0;
  steps(g, 1);
  assert.ok(p.dead > 0); assert.equal(p.hp, 0);
  assert.equal(g.snapshot().pl[0][10], 5, 'snapshot shows the respawn countdown');
  g.setInput(p.id, { mx: 1, mz: 0, aim: 0, atk: true });
  const x = p.x, n = p.atkN;
  seconds(g, 2);
  assert.equal(p.x, x, 'a dead hero does not move'); assert.equal(p.atkN, n, 'or attack');
  let ticks = 40;
  while (p.dead > 0 && ticks < 200) { steps(g, 1); ticks++; }
  assert.ok(ticks >= 99 && ticks <= 101, `respawn after about 5s (${ticks} ticks)`);
  assert.equal(p.hp, p.maxhp);
  assert.ok(Math.hypot(p.x, p.z - 6.5) < 1, 'back at the hall');
});
