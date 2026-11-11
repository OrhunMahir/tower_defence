// Headless checks of the game rules: bots play the simulation at full speed.
import assert from 'node:assert/strict';
import { Game, TICK, S } from '../server/game.js';
import { seeded, botInput, botSpend } from './bots.js';

function check(g) {
  for (const e of g.enemies) assert.ok(Number.isFinite(e.x) && Number.isFinite(e.z), 'enemy position is finite');
  for (const p of g.players.values()) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z), 'player position is finite');
}

function run(classes, seconds, { fight = true } = {}) {
  const g = new Game(seeded(42));
  const ps = classes.map((c) => g.addPlayer(c));
  let maxWave = 0, sawOver = false, resetAfterOver = false;
  for (let i = 0; i < seconds / TICK; i++) {
    for (const p of ps) { g.setInput(p.id, fight ? botInput(g, p) : { mx: 0, mz: 0, aim: 0, atk: false }); g.setReady(p.id); }
    if (fight) botSpend(g, ps);
    g.step(TICK);
    if (i % 20 === 0) { check(g); JSON.stringify(g.snapshot()); }
    maxWave = Math.max(maxWave, g.wave);
    if (g.phase === 'over') sawOver = true;
    else if (sawOver && g.wave === 0) resetAfterOver = true;
  }
  return { g, ps, maxWave, sawOver, resetAfterOver };
}

{
  const g = new Game(seeded(1));
  g.step(TICK);
  assert.equal(g.wave, 0, 'nothing happens without players');
  const p = g.addPlayer('nope');
  assert.equal(p.cls, 'knight', 'unknown class falls back to knight');
  g.setInput(p.id, { mx: NaN, mz: 'x', aim: Infinity, atk: 1 });
  g.step(TICK); check(g);
  // Walls block players, the gate does not.
  g.setInput(p.id, { mx: 1, mz: 0, aim: 0, atk: false });
  for (let i = 0; i < 200; i++) { p.ready = false; g.timer = 99; g.step(TICK); }
  assert.ok(p.x < S - 0.7, `player stopped by the east wall (x=${p.x.toFixed(2)})`);
  p.x = 0; p.z = 6.5;
  g.setInput(p.id, { mx: 0, mz: 1, aim: 0, atk: false });
  for (let i = 0; i < 100; i++) { g.timer = 99; g.step(TICK); }
  assert.ok(p.z < S - 1, `defenders stay inside the castle (z=${p.z.toFixed(2)})`);
  g.removePlayer(p.id);
  assert.equal(g.players.size, 0);
}

{
  // Economy: shared gold, upgrades only between waves, capped by the town hall.
  const g = new Game(seeded(7));
  const p = g.addPlayer('knight');
  assert.equal(g.upgrade(p.id, 'walls'), false, 'no gold, no upgrade');
  g.gold = 1000;
  assert.equal(g.upgrade(p.id, 'walls'), false, 'walls cannot pass the town hall level');
  assert.equal(g.upgrade(p.id, '__proto__'), false, 'unknown building is rejected');
  assert.ok(g.upgrade(p.id, 'hall'), 'town hall upgrade');
  assert.equal(g.gold, 900);
  assert.equal(g.offer.length, 3, 'a town hall upgrade offers three perks');
  assert.equal(new Set(g.offer).size, 3, 'offered perks are distinct');
  assert.equal(g.upgrade(p.id, 'hall'), false, 'the next town hall upgrade waits for the perk choice');
  assert.equal(g.choosePerk(p.id, 'nope'), false);
  const pick = g.offer[0];
  assert.ok(g.choosePerk(p.id, pick)); assert.equal(g.perks[pick], 1); assert.equal(g.offer, null);
  g.perks.masons = 0;
  assert.equal(g.th.max, 2100); assert.equal(g.th.hp, 2100);
  assert.ok(g.upgrade(p.id, 'walls'));
  assert.equal(g.segs.find((s) => !s.gate).max, 600);
  assert.ok(g.upgrade(p.id, 'mine') && g.upgrade(p.id, 'smith'), 'new buildings can be built');
  const before = g.gold;
  g.segs[0].hp = 0; g.segs[1].hp -= 160;
  assert.equal(g.repairCost('walls'), Math.ceil((600 + 160) / 20));
  assert.ok(g.repair(p.id, 'walls'));
  assert.equal(g.gold, before - 38);
  assert.equal(g.segs[0].hp, 600, 'destroyed segment is rebuilt');
  g.th.hp -= 800; g.gold = 10;
  assert.ok(g.repair(p.id, 'hall'), 'partial repair with little gold');
  assert.equal(g.gold, 0); assert.equal(Math.round(g.th.hp), 2100 - 800 + 200);
  // Hero growth: stat points per level, gear gated by the blacksmith.
  assert.equal(g.addStat(p.id, 'str'), false, 'no points, no stat');
  g.giveXp(p, 40);
  assert.equal(p.lvl, 2); assert.equal(p.pts, 1);
  assert.equal(g.addStat(p.id, 'luck'), false);
  assert.ok(g.addStat(p.id, 'vit')); assert.equal(p.maxhp, 155); assert.equal(p.pts, 0);
  g.gold = 300;
  assert.ok(g.buyGear(p.id, 'wpn'), 'tier 2 weapon with blacksmith level 1');
  assert.equal(p.wpn, 2); assert.equal(g.gold, 240);
  assert.equal(g.buyGear(p.id, 'wpn'), false, 'tier 3 needs blacksmith level 2');
  assert.ok(g.buyGear(p.id, 'arm')); assert.equal(g.buyGear(p.id, 'hat'), false);
  const q = g.addPlayer('archer');
  g.enemies.push({ id: 999, t: 1, x: 30, z: 30, hp: 1, max: 1, cd: 9 });
  g.hurtEnemy(g.enemies[0], 5, 0);
  assert.equal(q.xp, 12, 'castle kills share XP with every hero');
  g.enemies = []; g.removePlayer(q.id); g.gold = 0;
  p.x = 8.5; p.z = -7; g.timer = 99; g.step(TICK);
  assert.ok(Math.abs(p.x - 8.5) >= 2.4 || Math.abs(p.z + 7) >= 2.4, 'a built mine blocks movement');
  g.gold = 500; g.setReady(p.id); g.step(TICK);
  assert.equal(g.phase, 'wave');
  assert.equal(g.upgrade(p.id, 'archers'), false, 'no upgrades during a wave');
  assert.equal(g.repair(p.id, 'hall'), false, 'no repairs during a wave');
  g.reset();
  assert.deepEqual(g.b, { hall: 1, walls: 1, archers: 1, mine: 0, smith: 0 }, 'a new run resets buildings');
  assert.equal(g.offer, null); assert.equal(g.perks.mortar, 0, 'a new run resets perks');
  assert.equal(g.gold, 0);
  assert.equal(p.wpn, 1); assert.equal(p.pts, 0); assert.equal(p.maxhp, 140, 'a new run resets heroes');
}

{
  const r = run(['knight'], 600, { fight: false });
  assert.ok(r.sawOver, 'an undefended castle falls');
  assert.ok(r.resetAfterOver, 'the run restarts from wave 0 after the castle falls');
  console.log(`undefended: castle fell, reached wave ${r.maxWave}`);
}

for (const team of [['knight'], ['archer'], ['mage'], ['knight', 'archer', 'mage', 'archer']]) {
  const r = run(team, 900);
  assert.ok(r.maxWave >= 3, `${team} bots clear at least 2 waves (got ${r.maxWave})`);
  const lv = r.ps.map((p) => p.lvl).join('/');
  console.log(`${team.join('+')}: max wave ${r.maxWave}, levels ${lv}, castle fell: ${r.sawOver}`);
}
console.log('all simulation checks passed');
