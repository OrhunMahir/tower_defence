// Whole runs played by bot commanders at full speed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TICK, START_GOLD, YEAR_LEN, LORDS, LORD_KEYS, AGES, ITEMS, renownFor } from '../server/game.js';
import { newGame, botTurn } from './bots.js';

// Plays until the castle falls (or a wave/minute limit), checking the state stays sane.
function run({ minutes = 60, untilWave = Infinity, seed = 42, siege = 1, lord = 'marshal', opt = () => ({}) } = {}) {
  const { g, id } = newGame(seed, 1, { siege, lord });
  const out = { g, maxWave: 0, peakUnits: 0, peakLevel: 1, peakItems: 0, peakAge: 0, ageAt: [], sawOver: false, restarted: false, won: false, summary: null, longest: 0 };
  for (let i = 0; i < (minutes * 60) / TICK; i++) {
    botTurn(g, id, opt(g));
    g.step(TICK);
    if (i % 40 === 0) {
      for (const e of g.enemies) assert.ok(Number.isFinite(e.x) && Number.isFinite(e.z) && Number.isFinite(e.hp), 'enemy state is finite');
      assert.ok(Number.isFinite(g.gold) && g.gold >= 0 && Number.isFinite(g.th.hp) && Number.isFinite(g.xp));
      assert.ok(g.enemies.length < 400, `${g.enemies.length} monsters alive`);
      assert.ok(g.waveT < 240 || g.phase !== 'wave', `wave ${g.wave} has lasted ${g.waveT.toFixed(0)} s`);
      assert.ok(g.army().length <= g.capacity(), 'never more defenders than places');
      assert.ok(g.turrets.length <= g.turretSpots() && g.plots.filter(Boolean).length <= g.plotCount());
      JSON.parse(JSON.stringify(g.snapshot()));
    }
    if (g.phase === 'wave') out.longest = Math.max(out.longest, g.waveT);
    out.maxWave = Math.max(out.maxWave, g.wave);
    out.peakUnits = Math.max(out.peakUnits, g.units.length);
    out.peakLevel = Math.max(out.peakLevel, g.level);
    out.peakItems = Math.max(out.peakItems, Object.values(g.items).reduce((a, b) => a + b, 0));
    if (g.age > out.peakAge) { out.peakAge = g.age; out.ageAt[g.age] = g.wave; }
    if (g.wave > YEAR_LEN) { out.year2 = true; out.doctrines = g.doctrines.length; out.age = g.age; out.relics = Object.keys(g.items).filter((k) => ITEMS[k].relic).length; out.muts = Object.values(g.muts).reduce((a, b) => a + b, 0); }
    if (g.phase === 'over') { out.sawOver = true; out.summary = g.summary; } else if (out.sawOver && g.wave === 0) { out.restarted = true; break; }
    if (g.wave > untilWave) break;   // the wave after the last one wanted has just begun
  }
  return out;
}

test('a commander who never spends loses early and the run restarts from scratch', () => {
  const r = run({ minutes: 15, opt: () => ({ spend: false }) });
  assert.ok(r.sawOver && r.restarted);
  assert.ok(r.maxWave >= 2 && r.maxWave <= 12, `fell on wave ${r.maxWave}`);
  assert.equal(r.g.gold, START_GOLD); assert.equal(r.g.th.hp, r.g.th.max); assert.equal(r.g.units.length, LORDS.marshal.units.length);
  assert.equal(r.g.age, 0); assert.deepEqual(r.g.doctrines, []); assert.ok(r.g.plots.every((p) => !p));
});

for (const pick of ['easy', 'hard']) {
  test(`a bot commander on ${pick} waves builds up an army, levels the castle, builds and collects items`, () => {
    const r = run({ minutes: 14, untilWave: 15, seed: 22, siege: 0, opt: () => ({ pick }) });
    assert.ok(r.maxWave >= 12, `reached wave ${r.maxWave}`);
    assert.ok(r.peakUnits >= 8, `peak army ${r.peakUnits}`);
    assert.ok(r.peakLevel >= 8, `castle level ${r.peakLevel}`);
    assert.ok(r.peakItems >= 3, `${r.peakItems} items`);
    assert.ok(r.g.plots.filter(Boolean).length >= 2, 'the courtyard is being built');
    assert.ok(r.peakAge >= 1, 'the Stone Age was reached');
    assert.ok(r.ageAt[1] >= 8, `not before the first boss: wave ${r.ageAt[1]}`);
  });
}

test('a steady commander survives the first year, passes through the ages and fights on: there is no last wave', () => {
  const r = run({ minutes: 80, untilWave: YEAR_LEN + 3, seed: 33, siege: 0 });
  assert.ok(r.year2 && r.maxWave === YEAR_LEN + 4, `fell on wave ${r.g.reached}`);
  assert.equal(r.g.phase, 'wave', 'the run simply goes on');
  assert.ok(!r.sawOver);
  assert.ok(r.peakAge >= 3, `age ${r.peakAge}`);
  assert.ok(r.ageAt[1] >= 8 && r.ageAt[2] >= 16 && r.ageAt[3] >= 24 && (r.ageAt[4] ?? 32) >= 32, `ages at waves ${r.ageAt}`);
  assert.equal(r.doctrines, r.age, 'one doctrine for every age');
  assert.ok(r.relics >= 2, 'the bosses left relics');
  assert.equal(r.muts, 4, 'and the horde kept one mutation from each of the four');
  assert.ok(r.longest < 200, `the longest wave took ${r.longest.toFixed(0)} s`);
});

test('a castle that stops investing falls eventually, and the summary says how it went', () => {
  const r = run({ minutes: 60, seed: 11, opt: (g) => ({ spend: g.wave < 12 }) });
  assert.ok(r.sawOver, `still alive at wave ${r.maxWave}`);
  assert.ok(r.maxWave < 40);
  const s = r.summary;
  assert.equal(s.wave, r.maxWave); assert.equal(s.retired, false); assert.equal(s.siege, 1); assert.equal(s.lord, 'marshal');
  assert.equal(s.cleared, s.wave - 1, 'the wave the keep fell on was not cleared');
  assert.equal(s.seasons, Math.floor(s.cleared / 8)); assert.equal(s.year, 1);
  for (const k of ['id', 'kills', 'bosses', 'earned', 'age', 'path', 'ageKey', 'muts', 'level', 'time', 'items', 'relics', 'legends', 'specs', 'units', 'famTiers', 'wallsLost', 'turrets', 'buildings', 'doctrines', 'topKills', 'renown']) assert.ok(k in s, k);
  assert.equal(s.renown, renownFor(s)); assert.ok(s.renown > 0);
  assert.ok(s.kills > 100 && s.time > 60);
});

test('renown grows with the waves cleared, the seasons, full years, the age and the siege level, without end', () => {
  const base = { cleared: 12, seasons: 1, age: 1, siege: 1 };
  assert.equal(renownFor(base), 12 + 8 + 5);
  assert.ok(renownFor({ ...base, cleared: 20 }) > renownFor(base));
  assert.equal(renownFor({ cleared: 32, seasons: 4, age: 3, siege: 1 }), 32 + 32 + 15 + 20, 'a full year pays 20 more');
  assert.equal(renownFor({ cleared: 64, seasons: 8, age: 6, siege: 1 }), 64 + 64 + 30 + 40);
  assert.ok(renownFor({ ...base, siege: 0 }) < renownFor(base), 'relaxed pays half');
  for (let s = 2; s <= 40; s++) assert.ok(renownFor({ ...base, siege: s }) > renownFor({ ...base, siege: s - 1 }), 'the ladder has no top');
});

test('relaxed is easier than a high siege for the same commander', () => {
  const reach = (siege) => [33, 44].map((seed) => run({ minutes: 40, untilWave: 31, seed, siege }).maxWave).reduce((a, b) => a + b);
  const easy = reach(0), hard = reach(6);
  assert.ok(easy > hard, `relaxed ${easy}, omens ${hard}`);
});

test('every lord can play the opening waves', () => {
  assert.equal(LORD_KEYS.length, 15);
  for (const lord of LORD_KEYS) {
    const r = run({ minutes: 8, untilWave: 6, seed: 5, siege: 0, lord });
    assert.ok(r.maxWave >= 6, `${lord} fell on wave ${r.maxWave}`);
  }
  assert.ok(AGES.length === 4);
});
