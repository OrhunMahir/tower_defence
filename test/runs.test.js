// Whole runs played by bots at full speed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, TICK } from '../server/game.js';
import { seeded, botInput, botSpend, idle } from './bots.js';

function run(classes, minutes, { fight = true } = {}) {
  const g = new Game(seeded(42));
  const ps = classes.map((c) => g.addPlayer(c));
  const out = { g, ps, maxWave: 0, peakLevel: 1, peakBuilt: 0, sawOver: false, restarted: false };
  for (let i = 0; i < (minutes * 60) / TICK; i++) {
    for (const p of ps) { g.setInput(p.id, fight ? botInput(g, p) : idle); g.setReady(p.id); }
    if (fight) botSpend(g, ps);
    g.step(TICK);
    if (i % 20 === 0) {
      for (const e of g.enemies) assert.ok(Number.isFinite(e.x) && Number.isFinite(e.z) && Number.isFinite(e.hp), 'enemy state is finite');
      for (const p of ps) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z) && Number.isFinite(p.hp), 'hero state is finite');
      assert.ok(Number.isFinite(g.gold) && Number.isFinite(g.th.hp));
      JSON.parse(JSON.stringify(g.snapshot()));
    }
    out.maxWave = Math.max(out.maxWave, g.wave);
    out.peakLevel = Math.max(out.peakLevel, ...ps.map((p) => p.lvl));
    out.peakBuilt = Math.max(out.peakBuilt, Object.values(g.b).reduce((a, b) => a + b, 0));
    if (g.phase === 'over') out.sawOver = true;
    else if (out.sawOver && g.wave === 0) { out.restarted = true; break; }
  }
  return out;
}

test('an undefended castle falls early and the run restarts from scratch', () => {
  const r = run(['knight'], 15, { fight: false });
  assert.ok(r.sawOver && r.restarted);
  assert.ok(r.maxWave >= 3 && r.maxWave <= 8, `fell on wave ${r.maxWave}`);
  assert.equal(r.g.gold, 0); assert.equal(r.g.th.hp, r.g.th.max);
});

for (const team of [['knight'], ['archer'], ['mage'], ['knight', 'archer', 'mage', 'archer']]) {
  test(`bots (${team.join(', ')}) survive the early waves, level up and upgrade the castle`, () => {
    const r = run(team, 12);
    assert.ok(r.maxWave >= 8, `reached wave ${r.maxWave}`);
    assert.ok(r.peakLevel >= 4, `peak hero level ${r.peakLevel}`);
    assert.ok(r.peakBuilt >= 7, `building levels add up to ${r.peakBuilt} (a fresh castle has 3)`);
  });
}
