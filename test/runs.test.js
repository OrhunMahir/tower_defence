// Whole runs played by bot commanders at full speed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TICK, START_GOLD, FINAL_WAVE, LORDS } from '../server/game.js';
import { newGame, botTurn } from './bots.js';

// Plays until the castle falls (or a wave/minute limit), checking the state stays sane.
function run({ minutes = 60, untilWave = Infinity, seed = 42, diff = 'normal', opt = () => ({}) } = {}) {
  const { g, id } = newGame(seed, 1, diff);
  const out = { g, maxWave: 0, peakUnits: 0, peakLevel: 1, peakItems: 0, sawOver: false, restarted: false, won: false };
  for (let i = 0; i < (minutes * 60) / TICK; i++) {
    botTurn(g, id, opt(g));
    g.step(TICK);
    if (i % 40 === 0) {
      for (const e of g.enemies) assert.ok(Number.isFinite(e.x) && Number.isFinite(e.z) && Number.isFinite(e.hp), 'enemy state is finite');
      assert.ok(Number.isFinite(g.gold) && g.gold >= 0 && Number.isFinite(g.th.hp));
      assert.ok(g.enemies.length < 400, `${g.enemies.length} monsters alive`);
      assert.ok(g.waveT < 240 || g.phase !== 'wave', `wave ${g.wave} has lasted ${g.waveT.toFixed(0)} s`);
      JSON.parse(JSON.stringify(g.snapshot()));
    }
    out.maxWave = Math.max(out.maxWave, g.wave);
    out.peakUnits = Math.max(out.peakUnits, g.units.length);
    out.peakLevel = Math.max(out.peakLevel, g.level);
    out.peakItems = Math.max(out.peakItems, Object.values(g.items).reduce((a, b) => a + b, 0));
    if (g.won) out.won = true;
    if (g.phase === 'over') out.sawOver = true;
    else if (out.sawOver && g.wave === 0) { out.restarted = true; break; }
    if (g.wave >= untilWave && g.phase === 'prep') break;
  }
  return out;
}

test('a commander who never spends loses early and the run restarts from scratch', () => {
  const r = run({ minutes: 15, opt: () => ({ spend: false }) });
  assert.ok(r.sawOver && r.restarted);
  assert.ok(r.maxWave >= 2 && r.maxWave <= 10, `fell on wave ${r.maxWave}`);
  assert.equal(r.g.gold, START_GOLD); assert.equal(r.g.th.hp, r.g.th.max); assert.equal(r.g.units.length, LORDS.marshal.units.length);
});

for (const pick of ['easy', 'hard']) {
  test(`a bot commander on ${pick} waves builds up an army, levels the castle and collects items`, () => {
    const r = run({ minutes: 12, untilWave: 15, seed: 22, opt: () => ({ pick }) });
    assert.ok(r.maxWave >= 9, `reached wave ${r.maxWave}`);
    assert.ok(r.peakUnits >= 10, `peak army ${r.peakUnits}`);
    assert.ok(r.peakLevel >= 5, `castle level ${r.peakLevel}`);
    assert.ok(r.peakItems >= 3, `${r.peakItems} items`);
  });
}

test('a steady commander can win the run and go on into endless mode', () => {
  const r = run({ minutes: 60, untilWave: FINAL_WAVE + 3, seed: 33 });
  assert.ok(r.won, `fell on wave ${r.g.reached}`);
  assert.ok(r.g.endless && r.maxWave > FINAL_WAVE);
});

test('a castle that stops investing falls eventually', () => {
  const r = run({ minutes: 60, seed: 11, opt: (g) => ({ spend: g.wave < 12 }) });
  assert.ok(r.sawOver, `still alive at wave ${r.maxWave}`);
  assert.ok(r.maxWave < 40);
});

test('relaxed is easier than brutal for the same commander', () => {
  const reach = (diff) => run({ minutes: 40, untilWave: 35, seed: 33, diff }).maxWave;
  assert.ok(reach('relaxed') > reach('brutal'));
});
