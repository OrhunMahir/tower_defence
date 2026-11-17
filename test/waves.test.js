// Wave offers, the battle itself and how a run ends.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TICK, S, ENEMIES, BOSSES, SEASON_LEN, YEAR_LEN, SEASON_FX, bossIndex, nextBossWave, THEMES, MODS, TIERS, SIEGE, SIEGE_MAX, MAX_COUNT, OVER_TIME, START_GOLD, CHARGE_AFTER, HP_GROW, DMG_GROW, hpMul, dmgMul, bossHpMul, pctMul, harvestGrowth, goldMul, budget, levelNeed } from '../server/game.js';
import { newGame, steps, seconds, emptyWave, addEnemy, place, takeRewards } from './bots.js';

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

test('every season ends with its boss: one every eighth wave, the same four in turn, for ever; harder offers bring two from the third on', () => {
  assert.equal(SEASON_LEN, 8); assert.equal(YEAR_LEN, 32);
  assert.deepEqual(BOSSES.map((t) => ENEMIES[t].key), ['queen', 'behemoth', 'broodmother', 'skytyrant']);
  assert.deepEqual([0, 1, 8, 9, 10, 16, 20, 24, 30, 32, 35, 40, 80, 800].map(bossIndex), [-1, -1, 0, -1, -1, 1, -1, 2, -1, 3, -1, 4, 9, 99]);
  assert.deepEqual([1, 8, 9, 17, 25, 31, 33, 40, 41].map(nextBossWave), [8, 8, 16, 24, 32, 32, 40, 40, 48]);
  { const { g } = newGame(); assert.deepEqual(g.snapshot().nb, [8, 2]); g.wave = 8; assert.deepEqual(g.snapshot().nb, [16, 7]); g.wave = 32; assert.deepEqual(g.snapshot().nb, [40, 2]); }
  for (const [n, t] of [[8, 2], [16, 7], [24, 8], [32, 9], [40, 2], [48, 7], [56, 8], [64, 9], [72, 2]]) {
    const ws = offersAt(n);
    assert.ok(ws.every((w) => w.c[t] >= 1), `wave ${n}`);
    assert.ok(ws.every((w) => BOSSES.every((b) => b === t || w.c[b] === 0)));
  }
  const ws = offersAt(24);
  assert.equal(ws.find((w) => w.hard).c[8], 2);
  assert.equal(ws.find((w) => !w.hard).c[8], 1);
  assert.equal(offersAt(16).find((w) => w.hard).c[7], 1, 'one Behemoth is enough');
  for (const n of [9, 10, 20, 30, 31, 33]) assert.ok(offersAt(n).every((w) => BOSSES.every((b) => w.c[b] === 0)), `wave ${n}`);
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

test('monsters spawn far outside the walls and get tougher each wave; after the first year by a fixed share, without end', () => {
  const { g, id } = newGame();
  g.wave = 10; g.makeWaveOffers(); g.chooseWave(id, 0);
  seconds(g, 3);
  assert.ok(g.enemies.length > 0);
  const e = g.enemies.find((m) => !ENEMIES[m.t].boss);
  assert.equal(e.max, Math.round(ENEMIES[e.t].hp * hpMul(11)));
  const boss = g.makeEnemy(2, 50, 0);
  assert.ok(Math.abs(boss.max - ENEMIES[2].hp * hpMul(11) ** 0.85) <= 1, 'bosses grow more slowly through the first year');
  // The curve of the first year runs smoothly into the growth of the years after it.
  for (const f of [hpMul, dmgMul]) {
    const grow = f === hpMul ? HP_GROW : DMG_GROW;
    for (let n = 2; n <= 32; n++) assert.ok(f(n) > f(n - 1));
    for (const n of [33, 50, 100, 400]) assert.ok(Math.abs(f(n) / f(n - 1) - grow) < 1e-9, `wave ${n}`);
    assert.ok(Math.abs(f(32) / f(31) - grow) < 0.06, 'no sudden wall at the turn of the year');
  }
  assert.ok(HP_GROW > 1.05 && DMG_GROW >= HP_GROW - 1e-9, 'the horde always outgrows the castle in the end, and its blows keep pace with its hide');
  // Bosses keep pace with the horde after the first year.
  assert.ok(Math.abs(bossHpMul(64) / bossHpMul(32) - hpMul(64) / hpMul(32)) < 1e-6);
  assert.ok(Number.isFinite(hpMul(2000)) && Number.isFinite(dmgMul(2000)));
  // What hurts by a share of a monster's health fades after the first year, half as fast as health grows.
  assert.equal(pctMul(20), 1); assert.equal(pctMul(32), 1);
  assert.ok(Math.abs(pctMul(34) - 1 / HP_GROW) < 1e-9);
  const late = newGame().g;
  late.jump(48); late.chooseWave([...late.players][0], 0);
  assert.ok(Math.abs(late.volleyDamage() / (40 * late.hpMul * pctMul(48) * Math.sqrt(1 + late.tot.dmg / 100)) - 1) < 1e-9);
});

test('siege levels: relaxed is softer and richer; every level above normal adds one rule', () => {
  assert.equal(SIEGE.length, 11);
  const at = (siege, n = 7) => { const { g, id } = newGame(1, 1, { siege }); g.wave = n - 1; g.makeWaveOffers(); const w = g.waves.find((o) => !o.hard); g.chooseWave(id, g.waves.indexOf(w)); return { g, w }; };
  const brute = (siege) => at(siege).g.makeEnemy(1, 50, 0).max;
  assert.ok(brute(0) < brute(1) && brute(1) < brute(2), 'relaxed < normal < tough');
  assert.equal(brute(2), Math.round(ENEMIES[1].hp * hpMul(7) * 1.15));
  assert.equal(brute(5), brute(2));
  assert.ok(at(0).w.gold > at(1).w.gold && at(1).w.gold > at(4).w.gold, 'relaxed pays more, lean pays 15% less');
  assert.equal(at(2).w.champ, -1); assert.ok(at(3).w.champ >= 0, 'champions from siege 3');
  assert.equal(at(3, 5).w.champ, -1, 'but not in the first five waves');
  assert.equal(at(4).g.speedMul, 1); assert.equal(at(5).g.speedMul, 1.12);
  for (let seed = 1; seed <= 10; seed++) { const { g } = newGame(seed, 1, { siege: 6 }); g.wave = 11; g.makeWaveOffers(); assert.ok(g.waves.every((w) => w.mod), 'omens: every wave has a modifier'); }
  assert.ok(Math.abs(at(7).g.dmgMul / at(6).g.dmgMul - 1.2) < 1e-9);
  const spoils = (siege) => newGame(1, 1, { siege }).g.spoilsOptions().length;
  assert.equal(spoils(7), 3); assert.equal(spoils(8), 2);
  const queen = (siege) => { const { g } = at(siege, 8); return g.makeEnemy(2, 50, 0).max; };
  assert.ok(Math.abs(queen(9) / queen(8) - 1.35) < 0.01);
  for (const n of [YEAR_LEN, 2 * YEAR_LEN]) { const { g } = newGame(1, 1, { siege: 10 }); g.jump(n); assert.ok(g.waves.every((w) => BOSSES.every((b) => w.c[b] === 1)), 'the last wave of every year brings every boss'); }
  { const { g } = newGame(1, 1, { siege: 10 }); g.jump(40); assert.ok(g.waves.every((w) => BOSSES.filter((b) => w.c[b]).length === 1), 'the other boss waves bring their own'); }
  assert.equal(newGame(1, 1, { siege: -1 }).g.siege, 1); assert.equal(newGame(1, 1, { siege: '3' }).g.siege, 1); assert.equal(newGame(1, 1, { siege: SIEGE_MAX + 1 }).g.siege, 1);
});

test('harder tiers bring more monsters and pay more gold, more experience and luckier spoils', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const { g } = newGame(seed);
    g.wave = 5; g.scouted = true; g.makeWaveOffers();
    assert.deepEqual(g.waves.map((w) => w.tier).sort(), ['deadly', 'hard', 'std']);
    assert.equal(new Set(g.waves.map((w) => w.th)).size, 3, 'three different themes');
    const by = Object.fromEntries(g.waves.map((w) => [w.tier, w]));
    assert.ok(points(by.hard) > points(by.std) * 1.3 && points(by.deadly) > points(by.hard) * 1.1, `seed ${seed}`);
    for (const t of ['hard', 'deadly']) {
      assert.ok(Math.abs(by[t].gold - by.std.gold * TIERS[t].gold) <= 2);
      assert.ok(Math.abs(by[t].xp - by.std.xp * TIERS[t].xp) <= 2);
      assert.equal(by[t].luck, TIERS[t].luck);
    }
    assert.equal(g.scouted, false, 'a scouting report lasts one round');
  }
  const { g } = newGame();
  assert.equal(g.waves.length, 2, 'without scouts or a watchtower there is no deadly offer');
  g.plots[0] = { k: 'watchtower', lv: 1 }; g.makeWaveOffers();
  assert.equal(g.waves.length, 3);
});

test('the first year is the campaign: its harder waves are a little smaller, and full size from the second year on', () => {
  assert.equal(TIERS.std.pts, 1); assert.equal(TIERS.std.pts1, 1);
  for (const t of ['hard', 'deadly']) assert.ok(TIERS[t].pts1 < TIERS[t].pts && TIERS[t].pts1 > TIERS[t].pts * 0.85, `${t}: smaller, but not by much`);
  assert.ok(TIERS.deadly.pts1 > TIERS.hard.pts1 * 1.4, 'a deadly wave stays well above a hard one');
  // How many times the standard budget a hard offer without a modifier brings, averaged over many rolls.
  const size = (n) => {
    let sum = 0, k = 0;
    for (let seed = 1; seed <= 80; seed++) {
      const { g } = newGame(seed);
      g.wave = n - 1; g.makeWaveOffers();
      const w = g.waves.find((o) => o.tier === 'hard');
      if (w.mod) continue;
      sum += points(w) * w.hx / (budget(n) * g.env(n, g.forecast[0]).horde); k++;
    }
    return sum / k;
  };
  const roll = 1.135;   // a harder offer is rolled between 1 and 1.27 times its size
  for (const n of [7, 20, YEAR_LEN - 1]) assert.ok(Math.abs(size(n) / (TIERS.hard.pts1 * roll) - 1) < 0.04, `wave ${n}: ${size(n).toFixed(3)}`);
  for (const n of [YEAR_LEN + 1, 2 * YEAR_LEN + 5]) assert.ok(Math.abs(size(n) / (TIERS.hard.pts * roll) - 1) < 0.04, `wave ${n}: ${size(n).toFixed(3)}`);
});

test('wave experience raises the castle level; a harder wave teaches more', () => {
  const run = (tier) => {
    const { g, id } = newGame(3);
    const i = g.waves.findIndex((w) => w.tier === tier), xp = g.waves[i].xp;
    g.chooseWave(id, i); g.queue = [];
    steps(g, 1);
    return { g, xp };
  };
  const std = run('std'), hard = run('hard');
  assert.equal(std.xp, Math.round(budget(1) * 0.5)); assert.equal(hard.xp, std.xp * 2);
  assert.equal(std.g.xp, std.xp); assert.equal(std.g.level, 1);
  assert.ok(hard.xp < levelNeed(1));
  const { g, id } = newGame(3);
  g.xp = levelNeed(1) - 1;
  g.chooseWave(id, 0); g.queue = []; steps(g, 1);
  assert.equal(g.level, 2);
  assert.deepEqual(g.picks.map((p) => p.type), ['level', 'spoils'], 'the level-up comes before the spoils');
});

test('wave modifiers appear from wave 8 and pay a quarter more', () => {
  for (let seed = 1; seed <= 20; seed++) { const { g } = newGame(seed); g.wave = 6; g.makeWaveOffers(); assert.ok(g.waves.every((w) => !w.mod)); }
  const seen = new Set();
  let withMod = 0, total = 0;
  for (let seed = 1; seed <= 150; seed++) {
    const { g } = newGame(seed); g.wave = 14; g.scouted = true; g.makeWaveOffers();
    for (const w of g.waves) {
      total++;
      if (!w.mod) continue;
      withMod++; seen.add(w.mod);
      const plain = Math.round((20 + 6 * 15) * goldMul(15) * TIERS[w.tier].gold);
      assert.ok(Math.abs(w.gold - plain * 1.25) <= 1);
      if (w.tier === 'deadly') assert.ok(w.mod);
    }
    assert.ok(g.waves.find((w) => w.tier === 'deadly').mod, 'a deadly wave always has one');
  }
  assert.deepEqual([...seen].sort(), [...MODS].sort());
  assert.ok(withMod / total > 0.4 && withMod / total < 0.7, `${withMod} of ${total}`);
});

test('each modifier changes the battle', () => {
  const battle = (mod, n = 12) => {
    const { g, id } = newGame(2);
    g.wave = n - 1; g.makeWaveOffers();
    const w = g.waves.find((o) => o.tier === 'std');
    w.mod = mod;
    g.chooseWave(id, g.waves.indexOf(w)); g.queue = []; g.enemies = [];
    return g;
  };
  // Wave 12 is a summer wave: monsters are a little faster and defenders see a little further.
  assert.ok(Math.abs(battle('frenzied').speedMul - 1.3 * SEASON_FX.summer.speed) < 1e-9);
  // armoured: five more armour on everything
  const hit = (mod) => { const g = battle(mod); g.st.dmg = 0; g.refreshDerived(); const e = addEnemy(g, 0, 30, 0, { hp: 1000 }); g.hurtEnemy(e, 20); return (1000 - e.hp) / g.armorMul; };
  assert.equal(hit(null), 20 / battle(null).armorMul); assert.ok(Math.abs(hit(null) - hit('armoured') - 5) < 1e-9);
  // night: defenders see a fifth less far
  const sees = (mod, dist) => { const g = battle(mod); g.units = []; const u = place(g, 'archer', 5); u.range = 10; const p = g.slots[5]; addEnemy(g, 0, p.x, p.z + (p.z > 0 ? dist : -dist), { hp: 1e6 }); g.updateUnits(0); return g.projs.length; };
  const reach = 10 * (1 + newGame(2).g.tot.range / 100) * SEASON_FX.summer.range;
  assert.equal(sees(null, reach * 0.98), 1); assert.equal(sees('night', reach * 0.98), 0); assert.equal(sees('night', reach * 0.7), 1);
  // regenerating: wounds close, but never a boss's, and not once the wave drags on
  const heals = (mod, t = 1, waveT = 0) => { const g = battle(mod); g.units = []; const e = addEnemy(g, t, 40, 0, { hp: 1000 }); e.hp = 500; g.waveT = waveT; g.updateHazards(1); return e.hp - 500; };
  assert.equal(heals(null), 0); assert.ok(Math.abs(heals('regen') - 12) < 1e-6); assert.equal(heals('regen', 2), 0);
  assert.equal(heals('regen', 1, 3 * CHARGE_AFTER), 0);
  // swarm and giants trade numbers for size
  const size = (mod) => {
    let count = 0, hx = 0;
    for (let seed = 1; seed <= 300; seed++) { const { g } = newGame(seed, 1, { siege: 6 }); g.wave = 11; g.makeWaveOffers(); for (const w of g.waves) if (w.mod === mod && w.tier === 'std') { count += w.c.reduce((a, b) => a + b, 0); hx += w.hx; return [count, hx]; } }
    return [count, hx];
  };
  const [swarmN, swarmHx] = size('swarm'), [giantN, giantHx] = size('giants');
  assert.ok(swarmN > giantN * 1.8, `${swarmN} against ${giantN}`);
  assert.equal(swarmHx, 0.7); assert.equal(giantHx, 1.9);
});

test('a champion is one huge monster worth five', () => {
  const { g, id } = newGame(4, 1, { siege: 3 });
  g.wave = 8; g.makeWaveOffers();
  const w = g.waves[0];
  assert.ok(w.champ >= 0 && !ENEMIES[w.champ].boss);
  g.chooseWave(id, 0);
  const champs = g.queue.filter((q) => q.champ);
  assert.equal(champs.length, 1); assert.equal(champs[0].t, w.champ);
  const e = g.makeEnemy(0, 30, 0, 1, true), plain = g.makeEnemy(0, 30, 0);
  assert.ok(Math.abs(e.max - plain.max * 5) <= 3, 'five times the health');
  g.queue = []; g.enemies = [e, plain];
  assert.equal(g.snapshot().en[0][5] & 16, 16);
  const gold = g.gold; g.hurtEnemy(e, 1e9);
  const paid = g.gold - gold; g.hurtEnemy(plain, 1e9);
  assert.ok(Math.abs(paid - 5 * (g.gold - gold - paid)) <= 3, 'five times the gold');
  g.wave = 15; g.phase = 'prep'; g.makeWaveOffers();
  assert.ok(g.waves.every((o) => o.champ === -1), 'a boss wave has no champion');
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
    assert.equal(g.xp, g.rewardXp + 1, 'the experience of the wave and of the kill');
    assert.equal(g.picks.length, 1); assert.equal(g.picks[0].type, 'spoils');
    assert.equal(g.picks[0].luck, hard ? 30 : 0, 'a hard wave brings luckier spoils');
    assert.ok(g.units.every((u) => u.xp > 0), 'everyone learned something');
    assert.ok(g.skip(id));
    assert.equal(g.phase, 'prep');
    assert.equal(g.waves.length, 2, 'offers for wave 2');
  }
});

test('harvesting pays after every wave and grows 5% each time in the first year; the piggy bank pays interest', () => {
  const income = (setup, wave = 9) => {
    const { g, id } = newGame(9);
    g.jump(wave);
    g.gold = 0;
    const i = g.waves.findIndex((w) => !w.hard);
    setup(g); g.refreshDerived();
    const pay = g.waves[i].gold;
    g.chooseWave(id, i); g.queue = [];
    steps(g, 1);
    return { g, pay };
  };
  // Wave 9 is a summer wave: nothing touches the harvest there.
  { const { g, pay } = income(() => {}); assert.equal(g.gold, pay); assert.ok(pay >= Math.round((20 + 6 * 9) * goldMul(9))); }
  const h = income((g) => { g.st.harvest = 20; });
  assert.equal(h.g.gold, h.pay + 20);
  assert.equal(h.g.st.harvest, 21);
  { const { g, pay } = income((x) => { x.items.piggy = 1; x.gold = 100; }); assert.equal(g.gold, 100 + pay + 10); }
  // Spring pays a quarter more, winter half; the growth halves with every year.
  assert.equal(income((g) => { g.st.harvest = 20; }, 1).g.gold, 26 + 25);
  { const w = income((g) => { g.st.harvest = 20; }, 25); assert.equal(w.g.gold, w.pay + 10); }
  assert.deepEqual([1, 32, 33, 64, 65].map(harvestGrowth), [0.05, 0.05, 0.025, 0.025, 0.0125]);
  assert.equal(income((g) => { g.st.harvest = 200; }, 41).g.st.harvest, 205);
  assert.equal(income((g) => { g.st.harvest = 200; g.items.seedvault = 1; }, 41).g.st.harvest, 210, 'the seed vault keeps the first year\'s pace');
  { const w = income((g) => { g.st.harvest = 20; g.items.seedvault = 1; }, 25); assert.equal(w.g.gold, w.pay + 20, 'and winter does not halve it'); }
});

test('there is no last wave: the first year ends with its boss and the run goes on', () => {
  const { g, id } = newGame();
  g.jump(YEAR_LEN);
  g.chooseWave(id, g.waves.findIndex((w) => !w.hard)); g.queue = []; g.enemies = [];
  steps(g, 1);
  assert.equal(g.phase, 'reward');
  const rest = g.picks.filter((p) => p.type !== 'level');
  assert.deepEqual(rest.map((p) => p.type), ['spoils', 'relic', 'mutation'], 'the spoils, a relic and a mutation follow a boss wave');
  assert.equal(rest[0].luck, 60);
  assert.ok(g.snapshot().fx.some((f) => f[0] === 45 && f[3] === 1), 'the end of the first year is announced');
  takeRewards(g, id);
  assert.equal(g.phase, 'prep'); assert.equal(g.wave, YEAR_LEN);
  assert.equal(g.waves.length, 2, 'and the next wave is on offer');
  const s = g.snapshot();
  assert.equal(s.won, undefined); assert.equal(s.endless, undefined);
  // Giving the castle up ends the run where it stands; the keep falling ends it too.
  assert.equal(g.retire(99), false);
  assert.ok(g.retire(id));
  assert.equal(g.phase, 'over');
  assert.deepEqual([g.summary.wave, g.summary.cleared, g.summary.seasons, g.summary.retired, g.summary.year], [32, 32, 1, true, 1], "one boss wave was fought in this run");
  assert.equal(g.retire(id), false, 'a run ends once');
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
  for (const k of ['ph', 'wave', 'gold', 'sv', 'lord', 'age', 'daily', 'mod', 'ab', 'ral', 'frz', 'bty', 'th', 'left', 'np', 'lv', 'b', 'bc', 'rc', 'wv', 'un', 'tu', 'pl', 'cap', 'sg', 'en', 'pr', 'cl', 'mn', 'st', 'fx',
    'path', 'ak', 'dk', 'now', 'wx', 'mu', 'sig', 'lst', 'nb',
    'ro', 'tot', 'items', 'bless', 'fam', 'hv', 'tp', 'dc', 'ar', 'ad', 'ds', 'la', 'yard', 'shop', 'rr', 'ns']) assert.ok(k in prep, k);
  assert.deepEqual([prep.path, prep.ak, prep.dk, prep.now, prep.wx, prep.mu], [null, 'timber', 0, 'clear', ['clear', 'clear', 'clear'], {}]);
  assert.deepEqual(prep.ad, [0, 0, 0, 0, 0, 0]); assert.deepEqual(prep.ds, [0, 0, 0, 0, 0, 0]); assert.equal(prep.la, null);
  assert.equal(prep.ro.length, 4); assert.equal(prep.ro[0].length, 18); assert.equal(prep.shop.length, 4); assert.equal(prep.fam.length, 2);
  assert.equal(prep.ns.length, ENEMIES.length);
  assert.equal(prep.wv.length, 2);
  for (const w of prep.wv) for (const k of ['c', 'tier', 'th', 'hx', 'mod', 'champ', 'champs', 'twin', 'night', 'luck', 'gold', 'xp']) assert.ok(k in w, k);
  assert.deepEqual(prep.ar, { next: 1, boss: false, level: false, needLevel: 6, cost: 250, gold: false, wave: 8, bt: 2, choose: false, asc: 0, key: 'stone' });
  assert.deepEqual(prep.nb, [8, 2]);
  for (const k of ['plots', 'cap', 'spots', 'ccap', 'free', 'up', 'cost']) assert.ok(k in prep.yard, k);
  assert.equal(prep.pl.length, 7);
  g.chooseWave(id, 0);
  seconds(g, 4);
  const s = JSON.parse(JSON.stringify(g.snapshot()));
  assert.equal(s.sg.length, 28); assert.equal(s.un.length, 4); assert.equal(s.un[0].length, 5); assert.equal(s.b.length, 2);
  assert.ok(s.en.length > 0 && s.en[0].length === 6);
  assert.equal(s.ro, undefined, 'the full roster is only sent between waves');
  assert.equal(s.yard, undefined); assert.equal(s.shop, undefined);
  g.fx.length = 0; g.fx.push([1, 0, 0, 1]);
  assert.equal(g.snapshot().fx.length, 1);
  assert.equal(g.snapshot().fx.length, 0, 'effects are sent once');
});

test('rewards after a wave come in a fixed order: level-ups, spoils, a relic and a mutation after a boss, an event every fourth wave', () => {
  const after = (n, extra = () => {}) => {
    const { g, id } = newGame(6);
    g.wave = n - 1; g.makeWaveOffers(); extra(g);
    g.chooseWave(id, 0); g.queue = []; g.enemies = [];
    steps(g, 1);
    return g.picks.map((p) => p.type).filter((t, i, all) => t !== 'level' || n === 1);
  };
  assert.deepEqual(after(1), ['spoils']);
  assert.deepEqual(after(2), ['spoils', 'event']);
  assert.deepEqual(after(6), ['spoils', 'event']);
  assert.deepEqual(after(10), ['spoils', 'event']);
  assert.deepEqual(after(8), ['spoils', 'relic', 'mutation']);
  assert.deepEqual(after(40), ['spoils', 'relic', 'mutation']);
  assert.deepEqual(after(32), ['spoils', 'relic', 'mutation'], 'the end of a year is a boss wave like the others');
  assert.deepEqual(after(30), ['spoils', 'event']);
  assert.deepEqual(after(1, (g) => { g.xp = levelNeed(1) + levelNeed(2) - 1; }), ['level', 'level', 'spoils']);
});
