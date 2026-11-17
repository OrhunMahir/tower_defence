// The endless run: the calendar, seasons and weather, the siege ladder, renown without a top,
// and the lords, abilities and relics that came with them.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TICK, S, ENEMIES, SEASONS, SEASON_FX, WEATHER, WEATHER_FX, WEATHER_BY_SEASON, CALM_WAVES, FORECAST, BOLT_STUN, seasonOf, yearOf,
  SIEGE, SIEGE_TOP, SIEGE_MAX, siegeHp, siegeDmg, siegeMuts, siegeRenown, MUT_MAX, MUTATION_KEYS, LORDS, ABILITIES, ITEMS, FAMILIES,
  hpMul, dmgMul, goldMul, budget, pctMul, titleNeed, titleRank, FURY_AFTER, FURY_RATE, STATS,
} from '../server/game.js';
import { newGame, steps, seconds, emptyWave, addEnemy, place, card, takeRewards } from './bots.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} is not within ${eps} of ${b}`);
// A point d away from a wall slot, straight out from the castle.
const out = (g, slot, d) => { const p = g.slots[slot]; return Math.abs(p.z) === S ? [p.x, p.z + Math.sign(p.z) * d] : [p.x + Math.sign(p.x) * d, p.z]; };
// A battle with nobody on the walls but what the test puts there.
function battle({ weather = 'clear', wave = 1, opts = {}, setup = () => {} } = {}) {
  const { g, id } = newGame(1, 1, opts);
  if (wave > 1) g.jump(wave);
  setup(g);
  emptyWave(g, weather);
  g.units = []; g.refreshDerived();
  return { g, id };
}

test('the calendar: eight waves to a season, four seasons to a year, a boss at the end of each season', () => {
  assert.deepEqual(SEASONS, ['spring', 'summer', 'autumn', 'winter']);
  assert.deepEqual([1, 8, 9, 16, 17, 24, 25, 32, 33, 64, 65].map(seasonOf), [0, 0, 1, 1, 2, 2, 3, 3, 0, 3, 0]);
  assert.deepEqual([1, 32, 33, 64, 65, 320].map(yearOf), [1, 1, 2, 2, 3, 10]);
  const { g } = newGame();
  assert.equal(g.layout().seasonLen, 8); assert.equal(g.layout().yearLen, 32);
  for (const k of ['seasons', 'seasonFx', 'weather', 'weatherFx', 'mutations', 'mutMax', 'paths', 'lastAge', 'perks', 'adapt', 'siegeTop']) assert.ok(k in g.layout(), k);
  assert.equal(g.layout().finalWave, undefined, 'there is no last wave');
});

test('every season helps both sides; the druid doubles what it gives but not what it takes', () => {
  const { g } = newGame();
  const of = (n) => g.env(n);
  assert.deepEqual([of(1).harvest, of(1).repair, of(1).horde], [1.25, 0.15, 1.08]);
  assert.deepEqual([of(9).range, of(9).speed], [SEASON_FX.summer.range, SEASON_FX.summer.speed]);
  assert.deepEqual([of(17).gold, of(17).luck, of(17).hp], [1.2, 15, SEASON_FX.autumn.hp]);
  assert.deepEqual([of(25).speed, of(25).harvest], [0.88, 0.5]);
  assert.deepEqual(of(33), of(1), 'the second spring is like the first');
  for (const n of [1, 9, 17, 25]) for (const k of ['harvest', 'repair', 'gold', 'luck', 'horde', 'hp', 'speed', 'range', 'foeRange', 'burn', 'chain', 'fly', 'cloud', 'bolt', 'reload', 'frost']) assert.ok(Number.isFinite(of(n)[k]), `${k} on wave ${n}`);
  const d = newGame(1, 1, { lord: 'druid' }).g;
  near(d.env(1).harvest, 1.5); near(d.env(1).repair, 0.3); assert.equal(d.env(1).horde, 1.08);
  near(d.env(9).range, 1.16); assert.equal(d.env(9).speed, SEASON_FX.summer.speed);
  near(d.env(17).gold, 1.4); assert.equal(d.env(17).luck, 30); assert.equal(d.env(17).hp, SEASON_FX.autumn.hp);
  near(d.env(25).speed, 0.76); assert.equal(d.env(25).harvest, 0.5);
});

test('the seasons show in the battle: a larger spring horde, a longer summer reach, a richer autumn, a slower winter', () => {
  // The weather is set to clear so that only the season is at work.
  const clear = (g, n) => { g.jump(n); g.forecast[0] = 'clear'; g.makeWaveOffers(); return g; };
  const offer = (n, seed = 1) => clear(newGame(seed).g, n).waves.find((w) => w.tier === 'std' && !w.mod);
  assert.equal(offer(1).c[0], Math.round((5 + 3) * 1.08), 'wave 1: nine runners instead of eight');
  const started = (n) => { const { g, id } = newGame(); clear(g, n); g.chooseWave(id, g.waves.findIndex((w) => !w.hard)); return g; };
  const summer = started(9), winter = started(25), autumn = started(17);
  near(summer.speedMul, SEASON_FX.summer.speed); near(winter.speedMul, 0.88);
  near(autumn.hpMul, hpMul(17) * SEASON_FX.autumn.hp);
  { const u = summer.units[0], spring = started(1); near(summer.unitRange(u) / spring.unitRange(spring.units[0]), SEASON_FX.summer.range); }
  for (let seed = 1; seed <= 12; seed++) {
    const o = offer(17, seed);
    if (!o) continue;
    assert.equal(o.gold, Math.round((20 + 6 * 17) * goldMul(17) * 1.2)); assert.equal(o.luck, 15);
  }
});

test('the weather is rolled from the season and known three waves ahead; the first waves are clear', () => {
  assert.deepEqual(WEATHER, ['clear', 'rain', 'fog', 'gale', 'storm', 'heat', 'snow', 'blizzard']);
  for (const w of WEATHER) assert.ok(WEATHER_FX[w], w);
  for (const row of WEATHER_BY_SEASON) { assert.equal(row.length, WEATHER.length); assert.equal(row.reduce((a, b) => a + b, 0), 100); }
  const { g, id } = newGame(5);
  assert.deepEqual(g.forecast, ['clear', 'clear', 'clear']); assert.equal(FORECAST, 3); assert.equal(CALM_WAVES, 3);
  assert.deepEqual(g.snapshot().wx, g.forecast);
  for (let n = 1; n <= 12; n++) {
    const coming = [...g.forecast];
    g.chooseWave(id, 0);
    assert.equal(g.weather, coming[0], `wave ${n} has the weather that was forecast`);
    assert.deepEqual(g.forecast.slice(0, 2), coming.slice(1), 'and the forecast moves on by one wave');
    assert.equal(g.forecast.length, 3);
    assert.equal(g.snapshot().now, g.weather);
    g.queue = []; g.enemies = []; steps(g, 1); takeRewards(g, id);
  }
  // What can fall from the sky depends on the season: no snow in summer, no heat in winter.
  const seen = SEASONS.map(() => new Set());
  for (let n = 4; n <= 3200; n++) seen[seasonOf(n)].add(g.rollWeather(n));
  WEATHER.forEach((w, i) => SEASONS.forEach((s, si) => assert.equal(seen[si].has(w), WEATHER_BY_SEASON[si][i] > 0, `${w} in ${s}`)));
  for (let n = 1; n <= CALM_WAVES; n++) assert.equal(g.rollWeather(n), 'clear');
});

test('rain damps fire, feeds lightning and slows the horde; a heatwave fans fire and tires the defenders', () => {
  const burn = (weather) => { const { g } = battle({ weather }); place(g, 'pyro', 16); addEnemy(g, 1, ...out(g, 16, 6), { hp: 1e6 }); g.updateUnits(0); return g.projs[0].burn; };
  near(burn('rain') / burn('clear'), 0.6); near(burn('heat') / burn('clear'), 1.5);
  const jumps = (weather) => {
    const { g } = battle({ weather });
    place(g, 'storm', 16);
    for (let i = 0; i < 9; i++) addEnemy(g, 0, ...out(g, 16, 5 + 3 * i), { hp: 1e6 });
    g.updateUnits(0);
    return g.enemies.filter((e) => e.hp < e.max).length;
  };
  assert.equal(jumps('clear'), 5, 'a stormcaller hits five'); assert.equal(jumps('rain'), 6); assert.equal(jumps('storm'), 6);
  near(battle({ weather: 'rain' }).g.speedMul, 0.92);
  const reload = (weather) => { const { g } = battle({ weather }); const u = place(g, 'archer', 16); return g.unitReload(u); };
  near(reload('heat') / reload('clear'), 1.08);
});

test('fog shortens every reach, the horde\'s too, and makes the spoils luckier; the void lantern sees through it', () => {
  const reach = (weather, setup) => { const { g } = battle({ weather, setup }); const u = place(g, 'archer', 16); return g.unitRange(u); };
  near(reach('fog') / reach('clear'), 0.8); near(reach('blizzard') / reach('clear'), 0.85); near(reach('snow') / reach('clear'), 0.92);
  for (const w of ['fog', 'snow', 'blizzard']) near(reach(w, (g) => { g.items.voidlantern = 1; }) / reach('clear'), 1);
  // A spitter stops closer to the wall in fog.
  const holdsAt = (weather, d) => { const { g } = battle({ weather }); const e = addEnemy(g, 3, ...out(g, 16, d), { hp: 1e6 }); g.updateEnemies(TICK); return e.hold >= 0; };
  assert.ok(holdsAt('clear', 7.5)); assert.ok(!holdsAt('fog', 7.5)); assert.ok(holdsAt('fog', 6));
  // Turrets are fogged in as well.
  const turret = (weather) => { const { g } = battle({ weather }); g.turrets = [{ k: 'bolt', lv: 1, spot: 0, cd: 0 }]; addEnemy(g, 1, -12 - 18, -4.2, { hp: 1e6 }); g.updateTurrets(0.01); return g.projs.length; };
  assert.equal(turret('clear'), 1); assert.equal(turret('fog'), 0);
  const { g } = newGame(); g.forecast[0] = 'fog'; g.makeWaveOffers();
  assert.ok(g.waves.every((w) => w.luck === (w.hard ? 30 : 0) + 25));
});

test('a gale slows what flies and blows poison away; snow and blizzards slow the horde and sharpen the frost', () => {
  const flown = (weather) => { const { g } = battle({ weather }); const e = addEnemy(g, 4, 0, 40, { hp: 1e6 }); g.updateEnemies(1); return 40 - e.z; };
  near(flown('gale') / flown('clear'), 0.7);
  const walked = (weather) => { const { g } = battle({ weather }); const e = addEnemy(g, 0, 0, 40, { hp: 1e6 }); g.updateEnemies(1); return 40 - e.z; };
  near(walked('gale') / walked('clear'), 1); near(walked('snow') / walked('clear'), 0.85); near(walked('blizzard') / walked('clear'), 0.75);
  const cloud = (weather) => { const { g } = battle({ weather }); place(g, 'alchemist', 16); addEnemy(g, 1, ...out(g, 16, 6), { hp: 1e6 }); g.updateUnits(0); return g.projs[0].cloudT; };
  assert.equal(cloud('clear'), 4); assert.equal(cloud('gale'), 2);
  const frost = (weather) => { const { g } = battle({ weather }); place(g, 'frost', 16); addEnemy(g, 1, ...out(g, 16, 6), { hp: 1e6 }); g.updateUnits(0); return g.projs[0].slow; };
  near(frost('snow') / frost('clear'), 1.25);
});

test('a thunderstorm strikes the horde every few seconds and now and then a defender; the storm banner tames it', () => {
  const run = (setup = () => {}) => {
    const { g } = battle({ weather: 'storm', setup });
    for (let i = 0; i < 8; i++) place(g, 'archer', 4 + i, { p: 0.0001 });
    for (let i = 0; i < 30; i++) addEnemy(g, 1, 40 + (i % 6), -40 + i, { hp: 1e9 });
    let bolts = 0, own = 0, stunned = 0;
    for (let t = 0; t < 62 / TICK; t++) {
      g.updateSky(TICK);
      for (const f of g.fx) if (f[0] === 53) { bolts++; if (f[3] === 1) own++; }
      g.fx.length = 0;
      stunned = Math.max(stunned, g.units.filter((u) => u.stun > 0).length);
    }
    return { g, bolts, own, stunned, hurt: g.enemies.filter((e) => e.hp < e.max).length };
  };
  const wild = run();
  assert.equal(wild.bolts, 12, 'one bolt every five seconds');
  assert.ok(wild.own >= 1 && wild.own <= 6, `${wild.own} bolts struck the castle`);
  assert.ok(wild.stunned >= 1); assert.ok(wild.hurt >= 4);
  assert.ok(BOLT_STUN > 1);
  const tame = run((g) => { g.items.stormbanner = 1; });
  assert.equal(tame.bolts, 24, 'twice as often'); assert.equal(tame.own, 0); assert.equal(tame.stunned, 0);
  const calm = battle({ weather: 'clear' }).g;
  addEnemy(calm, 1, 40, 0, { hp: 1e9 });
  for (let t = 0; t < 600; t++) calm.updateSky(TICK);
  assert.equal(calm.fx.filter((f) => f[0] === 53).length, 0);
});

test('a wave that drags on turns into a fury: the horde hits harder by the second', () => {
  const blow = (waveT) => {
    const { g } = battle();
    const e = addEnemy(g, 1, 0, 5, { hp: 1e9, cd: 0 });
    g.waveT = waveT;
    const before = g.th.hp;
    g.updateEnemies(TICK);
    return before - g.th.hp;
  };
  const base = blow(10);
  assert.ok(base > 0);
  near(blow(FURY_AFTER) / base, 1); near(blow(FURY_AFTER + 25) / base, 1 + FURY_RATE * 25, 1e-6);
});

test('the siege ladder has no top: above ten every level toughens the horde and every second one adds a mutation', () => {
  assert.equal(SIEGE_TOP, 10); assert.equal(SIEGE.length, 11);
  assert.deepEqual([0, 1, 10, 11, 12, 13, 14, 40].map(siegeMuts), [0, 0, 0, 0, 1, 1, 2, 12]);
  near(siegeHp(0), 0.7); near(siegeHp(10), 1); near(siegeHp(13), 1.06 ** 3); near(siegeDmg(13), 1.03 ** 3); near(siegeDmg(10), 1);
  for (let s = 1; s <= 60; s++) assert.ok(siegeRenown(s + 1) > siegeRenown(s));
  assert.equal(siegeRenown(0), 0.5); near(siegeRenown(21), 5);
  for (const s of [11, 14, 25, SIEGE_MAX]) assert.equal(newGame(1, 1, { siege: s }).g.siege, s);
  const { g, id } = newGame(3, 1, { siege: 14 });
  assert.equal(Object.values(g.muts).reduce((a, b) => a + b, 0), 2, 'the horde starts with two mutations');
  for (const k in g.muts) assert.ok(MUTATION_KEYS.includes(k) && g.muts[k] <= MUT_MAX);
  for (const rule of SIEGE.slice(2).map((s) => s.key)) assert.ok(g.rule(rule), rule);
  g.jump(7); g.muts = {};
  g.chooseWave(id, g.waves.findIndex((w) => !w.hard));
  near(g.hpMul, hpMul(7) * 1.15 * 1.25 * 1.06 ** 4); near(g.dmgMul, dmgMul(7) * 1.2 * 1.03 ** 4);
  assert.deepEqual(newGame(3, 1, { siege: 40 }).g.muts, newGame(3, 1, { siege: 40 }).g.muts, 'the same seed starts with the same mutations');
  assert.equal(g.snapshot().sv, 14);
});

test('titles: all the renown ever earned counts towards a rank that never ends and gives nothing', () => {
  assert.equal(titleRank(0), 0); assert.equal(titleRank(titleNeed(1) - 1), 0); assert.equal(titleRank(titleNeed(1)), 1);
  for (let r = 1; r < 200; r++) { assert.ok(titleNeed(r + 1) > titleNeed(r)); assert.equal(titleRank(titleNeed(r)), r); assert.equal(titleRank(titleNeed(r + 1) - 1), r); }
  assert.ok(titleNeed(12) > 3000 && titleNeed(12) < 4000, 'the last named title takes a few dozen runs');
});

test('the seer sees further and is offered one more mutation; the tactician fights best with every family', () => {
  for (const k of ['seer', 'giantslayer', 'druid', 'tactician', 'conqueror']) { assert.ok(LORDS[k].unlock >= 50, k); assert.ok(LORDS[k].rule, k); }
  const seer = newGame(1, 1, { lord: 'seer' }).g;
  assert.equal(seer.mutationOptions({ boss: 0 }).length, 4); assert.equal(newGame().g.mutationOptions({ boss: 0 }).length, 3);
  const power = (lord, classes) => { const { g } = battle({ opts: { lord } }); const us = classes.map((k, i) => place(g, k, 8 + i)); return g.unitPower(us[0]); };
  near(power('tactician', ['archer']) / power('marshal', ['archer']), (1 + 0.04) * (1 - 0.08) / (1 + 0.1) * 1, 1e-6);
  near(power('tactician', ['archer', 'mage', 'pyro', 'cleric', 'spear', 'tinker']) / power('tactician', ['archer']), (1 + 0.24) / (1 + 0.04), 1e-6);
});

test('the giant-slayer hurts bosses and champions more; the conqueror is paid for harder waves', () => {
  const hit = (lord, t, champ) => { const { g } = battle({ opts: { lord } }); const e = addEnemy(g, t, 40, 0, { hp: 1e6 }); e.champ = champ; g.hurtEnemy(e, 100); return 1e6 - e.hp; };
  near(hit('giantslayer', 2, false) / hit('marshal', 2, false), 1.4); near(hit('giantslayer', 0, true) / hit('marshal', 0, true), 1.4);
  near(hit('giantslayer', 0, false) / hit('marshal', 0, false), 1);
  for (let seed = 1; seed <= 10; seed++) {
    const a = newGame(seed, 1, { lord: 'conqueror' }).g, b = newGame(seed).g;
    a.jump(5); b.jump(5);
    a.waves.forEach((w, i) => { near(w.gold / b.waves[i].gold, w.hard ? 1.25 : 0.85, 0.02); });
  }
});

test('three more abilities: a signal fire, caltrops and a last stand', () => {
  for (const k of ['signal', 'caltrops', 'laststand']) assert.ok(ABILITIES[k].unlock > 0 && ABILITIES[k].cd > 0, k);
  const { g, id } = newGame(1, 1, { abilities: ['signal', 'caltrops', 'laststand'] });
  emptyWave(g);
  const u = g.units[0], far = g.unitRange(u);
  const e = addEnemy(g, 1, 0, 30, { hp: 1e9, cd: 0 });
  assert.ok(g.ability(id, 'signal'));
  near(g.unitRange(u) / far, 1.3); assert.equal(g.snapshot().sig, 1);
  seconds(g, ABILITIES.signal.t + 0.2);
  near(g.unitRange(u), far); assert.equal(g.snapshot().sig, 0);
  // Caltrops: a field on the ground that slows by half and wounds.
  assert.equal(g.ability(id, 'caltrops', NaN, 0), false, 'it needs a place');
  g.units = [];
  e.x = 0; e.z = 30; e.hp = e.max;
  assert.ok(g.ability(id, 'caltrops', 0, 30));
  assert.equal(g.clouds.length, 1); assert.equal(g.snapshot().cl[0][4], 2);
  seconds(g, 1);
  assert.ok(e.slowK >= 0.5 && e.hp < e.max);
  assert.ok(30 - e.z < ENEMIES[1].speed * 0.6, 'it has covered about half the ground');
  seconds(g, ABILITIES.caltrops.t);
  assert.equal(g.clouds.length, 0);
  // Last stand: nothing hurts the keep for a few seconds.
  e.x = 0; e.z = 4.2; e.cd = 0;
  seconds(g, 1.2);
  const hurt = g.th.hp;
  assert.ok(hurt < g.th.max);
  assert.ok(g.ability(id, 'laststand')); assert.equal(g.snapshot().lst, 1);
  seconds(g, ABILITIES.laststand.t - 0.2);
  assert.equal(g.th.hp, hurt);
  seconds(g, 2);
  assert.ok(g.th.hp < hurt, 'and then it does again');
});

test('six relics that renown adds: against the weather, the winter, the adaptation, the night and for the keep', () => {
  for (const k of ['stormbanner', 'seedvault', 'mirrorshard', 'voidlantern', 'titanheart', 'thorncrown']) { assert.ok(ITEMS[k].relic && ITEMS[k].unique && ITEMS[k].unlock >= 30, k); }
  // The mirror shard halves what the horde has learnt, but not what it has forgotten.
  const dealt = (setup) => { const { g } = battle({ setup }); const u = place(g, 'archer', 16); const e = addEnemy(g, 0, 40, 0, { hp: 1e6 }); g.adapt.marksmen = 40; g.adapt.arcane = -20; g.hurtEnemy(e, 100, u); const m = place(g, 'mage', 17); const f = addEnemy(g, 0, 40, 5, { hp: 1e6 }); g.hurtEnemy(f, 100, m); return [1e6 - e.hp, 1e6 - f.hp]; };
  const [a, b] = dealt(() => {}), [c, d] = dealt((g) => { g.items.mirrorshard = 1; });
  near(a, 60); near(b, 120); near(c, 80); near(d, 120);
  // The titan heart: 1500 more health and the keep mends itself during a wave.
  { const { g } = battle({ setup: (x) => { x.items.titanheart = 1; x.refreshDerived(); } }); assert.equal(g.th.max, 3000); addEnemy(g, 1, 60, 60, { hp: 1e9 }); g.th.hp = 1000; g.updateSupport(1); near(g.th.hp, 1000 + 3000 * 0.003); }
  // The crown of thorns: whatever strikes the keep loses 6% of its health (bosses a tenth of that).
  const thorn = (t) => { const { g } = battle({ setup: (x) => { x.items.thorncrown = 1; } }); const e = addEnemy(g, t, 0, 4.2, { hp: 10000, cd: 0 }); g.updateEnemies(TICK); return 10000 - e.hp; };
  near(thorn(1), 600); near(thorn(2), 60);
  // The void lantern: the night does not shorten the reach.
  const night = (lantern) => { const { g } = battle({ setup: (x) => { if (lantern) x.items.voidlantern = 1; } }); g.dark = true; return g.nightMul(); };
  assert.equal(night(false), 0.8); assert.equal(night(true), 1);
});

test('what hurts by a share of a monster\'s health fades after the first year', () => {
  const thorns = (wave) => { const { g } = battle({ wave, setup: (x) => { x.items.thorns = 1; } }); const e = addEnemy(g, 1, 0, 0, { hp: 10000 }); g.hitWall(g.segs[0], 1, e); return 10000 - e.hp; };
  near(thorns(20), 1500); near(thorns(32), 1500); near(thorns(48), 1500 * pctMul(48), 1e-6);
  assert.ok(pctMul(48) < 0.5 && pctMul(48) > 0.3);
});
