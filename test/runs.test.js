// Whole runs played by bot commanders at full speed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TICK } from '../server/game.js';
import { newGame, botTurn } from './bots.js';

function run(minutes, opt, seed = 42) {
  const { g, id } = newGame(seed);
  const out = { g, maxWave: 0, peakUnits: 4, peakBuilt: 3, sawOver: false, restarted: false };
  for (let i = 0; i < (minutes * 60) / TICK; i++) {
    botTurn(g, id, opt);
    g.step(TICK);
    if (i % 20 === 0) {
      for (const e of g.enemies) assert.ok(Number.isFinite(e.x) && Number.isFinite(e.z) && Number.isFinite(e.hp), 'enemy state is finite');
      assert.ok(Number.isFinite(g.gold) && g.gold >= 0 && Number.isFinite(g.th.hp));
      JSON.parse(JSON.stringify(g.snapshot()));
    }
    out.maxWave = Math.max(out.maxWave, g.wave);
    out.peakUnits = Math.max(out.peakUnits, g.units.length);
    out.peakBuilt = Math.max(out.peakBuilt, Object.values(g.b).reduce((a, b) => a + b, 0));
    if (g.phase === 'over') out.sawOver = true;
    else if (out.sawOver && g.wave === 0) { out.restarted = true; break; }
  }
  return out;
}

test('a commander who never spends loses early and the run restarts from scratch', () => {
  const r = run(15, { spend: false });
  assert.ok(r.sawOver && r.restarted);
  assert.ok(r.maxWave >= 3 && r.maxWave <= 8, `fell on wave ${r.maxWave}`);
  assert.equal(r.g.gold, 100); assert.equal(r.g.th.hp, r.g.th.max); assert.equal(r.g.units.length, 4);
});

for (const pick of ['easy', 'mixed', 'hard']) {
  test(`a bot commander on ${pick} waves beats the first Queen and builds up the castle`, () => {
    const r = run(12, { pick });
    assert.ok(r.maxWave > 10, `reached wave ${r.maxWave}`);
    assert.ok(r.peakUnits >= 14, `peak army ${r.peakUnits}`);
    assert.ok(r.peakBuilt >= 9, `building levels add up to ${r.peakBuilt} (a fresh castle has 3)`);
  });
}

test('every run ends eventually: the horde outgrows the castle', () => {
  const r = run(60, { pick: 'easy' });
  assert.ok(r.sawOver, `still alive at wave ${r.maxWave}`);
});
