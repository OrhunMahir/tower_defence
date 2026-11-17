// The tree of ages after the Golden Age: three paths, the power of each of their ages, what an
// ascension brings, and how the new classes join a full garrison.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Game, TICK, S, TOWERS, AGES, PATHS, PATH_KEYS, PATH_AGE, LAST_AGE, PERKS, ageNeed, ageKey, rarityCap, plotsAt, buildLevelReq, buildCostMul, buildingCapAt,
  UNITS, UNIT_KEYS, RARITY, ENEMIES, DOCTRINE_KEYS, CAPACITY, BUILDINGS, TURRETS,
} from '../server/game.js';
import { newGame, steps, seconds, emptyWave, addEnemy, place, card, takeRewards } from './bots.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} is not within ${eps} of ${b}`);
const out = (g, slot, d) => { const p = g.slots[slot]; return Math.abs(p.z) === S ? [p.x, p.z + Math.sign(p.z) * d] : [p.x + Math.sign(p.x) * d, p.z]; };
// A castle that may advance to age `age` + 1 right now.
function ready(age, path = null, seed = 1) {
  const { g, id } = newGame(seed);
  g.age = age; g.path = path; g.bossWaves = age + 1; g.level = ageNeed(age + 1).level; g.gold = ageNeed(age + 1).gold;
  g.doctrines = DOCTRINE_KEYS.slice(0, age);
  g.refreshDerived();
  return { g, id };
}
// A battle in a given age of a path, with nobody on the walls but what the test puts there.
function battle(path = null, age = 3, setup = () => {}) {
  const { g, id } = newGame(1);
  g.path = path; g.age = age;
  setup(g);
  g.refreshDerived();
  emptyWave(g);
  g.units = []; g.refreshDerived();
  return { g, id };
}
const fire = (g, u, dt = 0) => { u.cd = 0; g.updateUnits(dt); };
const land = (g, t = 2) => { for (let i = 0; i < t / TICK; i++) { g.updateProjs(TICK); g.updateTurrets(TICK); g.updateAbilities(TICK); } };

test('three paths lead on from the Golden Age, each with three ages of its own', () => {
  assert.deepEqual(PATH_KEYS, ['splendour', 'industry', 'legend']);
  assert.deepEqual(PATH_KEYS.map((p) => PATHS[p].ages), [['obsidian', 'crystal', 'star'], ['steel', 'powder', 'steam'], ['rune', 'dragon', 'celestial']]);
  assert.equal(LAST_AGE, 6);
  for (const p of PATH_KEYS) for (const k of PATHS[p].ages) assert.ok(PERKS[k], `${k} has a power`);
  assert.deepEqual([4, 5, 6].map(ageNeed), PATH_AGE);
  for (let a = 1; a < 40; a++) assert.ok(ageNeed(a + 1).gold > ageNeed(a).gold && ageNeed(a + 1).level > ageNeed(a).level, `age ${a + 1} asks for more`);
  assert.deepEqual([0, 3, 4, 5, 6, 7, 30].map((a) => ageKey(a, 'legend')), ['timber', 'gold', 'rune', 'dragon', 'celestial', 'celestial', 'celestial']);
  assert.equal(ageKey(5, null), 'gold');
});

test('the fifth age needs the fourth boss and a path; once chosen the path cannot be left', () => {
  const { g, id } = ready(3);
  let r = g.ageReq();
  assert.deepEqual([r.next, r.choose, r.key, r.asc, r.needLevel, r.cost, r.wave, r.bt], [4, true, null, 0, 24, 4000, 32, 9]);
  assert.equal(g.advanceAge(id), false, 'a path has to be named');
  assert.equal(g.advanceAge(id, 'nowhere'), false); assert.equal(g.advanceAge(id, '__proto__'), false);
  g.bossWaves = 3;
  assert.equal(g.advanceAge(id, 'legend'), false, 'the Sky Tyrant has not fallen yet');
  g.bossWaves = 4;
  assert.ok(g.advanceAge(id, 'legend'));
  assert.deepEqual([g.age, g.path, g.gold], [4, 'legend', 0]);
  assert.deepEqual(g.picks.map((p) => p.type), ['muster', 'doctrine']);
  takeRewards(g, id);
  assert.equal(g.phase, 'prep');
  const s = g.snapshot();
  assert.deepEqual([s.age, s.path, s.ak], [4, 'legend', 'rune']);
  r = g.ageReq();
  assert.deepEqual([r.next, r.choose, r.key, r.needLevel, r.cost, r.wave], [5, false, 'dragon', 28, 7000, 40]);
  g.bossWaves = 5; g.level = 28; g.gold = 7000;
  assert.ok(g.advanceAge(id, 'industry'), 'naming another path later changes nothing');
  assert.deepEqual([g.age, g.path, g.snapshot().ak], [5, 'legend', 'dragon']);
  assert.ok(g.perk('rune') && g.perk('dragon') && !g.perk('celestial') && !g.perk('steel') && !g.perk('obsidian'));
  assert.equal(newGame().g.perk('rune'), false);
});

test('a path age musters one of its two new classes, also into a full garrison', () => {
  for (const path of PATH_KEYS) {
    const { g, id } = ready(3, null, 3);
    assert.ok(g.advanceAge(id, path));
    const p = g.picks[0];
    assert.equal(p.type, 'muster');
    const want = UNIT_KEYS.filter((k) => UNITS[k].path === path && UNITS[k].age === 5);
    assert.deepEqual(p.opts.map((o) => o.card.k).sort(), [...want].sort());
    for (const o of p.opts) { assert.equal(o.type, 'recruit'); assert.equal(o.swap, undefined); assert.ok(o.card.rar >= 1, 'at least rare'); }
    assert.equal(g.pickView().pass, true);
    const n = g.units.length;
    assert.ok(g.choose(id, 0));
    assert.equal(g.units.length, n + 1); assert.equal(g.units.at(-1).k, p.opts[0].card.k);
  }
  // With full walls the newcomer takes the post of the weakest defender; the muster may also be passed over.
  const { g, id } = ready(3);
  while (g.units.length < g.capacity()) g.units.push(g.newUnit(card('archer', { lv: 10 }), g.freeSlot('archer')));
  assert.ok(g.advanceAge(id, 'industry'));
  const opts = g.picks[0].opts;
  assert.equal(opts.length, 2);
  for (const o of opts) { assert.ok(o.swap && o.out); if (g.wallOnly(o.card.k)) assert.ok(g.slots[g.unit(o.swap).slot].seg >= 0); }
  const n = g.units.length;
  assert.ok(g.skip(id), 'nobody has to be sent home');
  assert.equal(g.units.length, n); assert.equal(g.picks[0].type, 'doctrine');
});

test('recruits come from the chosen path only, and only from the ages reached', () => {
  const classes = (path, age) => { const { g } = newGame(7); g.path = path; g.age = age; g.wave = 50; const seen = new Set(); for (let i = 0; i < 1500; i++) seen.add(g.makeCard().k); return seen; };
  assert.ok([...classes(null, 3)].every((k) => !UNITS[k].path), 'none before a path is chosen');
  const rune = classes('legend', 4);
  assert.ok(rune.has('runeblade') && rune.has('runesmith'));
  assert.ok([...rune].every((k) => !UNITS[k].path || (UNITS[k].path === 'legend' && UNITS[k].age === 5)));
  const all = classes('legend', 6);
  for (const k of ['runeblade', 'runesmith', 'drakekeeper', 'lancer', 'seraph', 'skycaller']) assert.ok(all.has(k), k);
  assert.ok([...all].every((k) => !UNITS[k].path || UNITS[k].path === 'legend'));
  // The classes of the newest age come up more often than the rest.
  const { g } = newGame(7); g.path = 'industry'; g.age = 4; g.wave = 40;
  let fresh = 0;
  for (let i = 0; i < 2000; i++) if (UNITS[g.makeCard().k].age === 5) fresh++;
  assert.ok(fresh / 2000 > 0.12, `${fresh} of 2000 recruits were of the new age`);
});

test('after the third age of the path every boss opens an ascension, without end', () => {
  const { g, id } = ready(6, 'splendour');
  const r = g.ageReq();
  assert.deepEqual([r.next, r.choose, r.key, r.asc, r.needLevel, r.cost, r.wave], [7, false, 'star', 1, 37, 21600, 56]);
  const dmg = g.tot.dmg;
  assert.ok(g.advanceAge(id));
  assert.equal(g.age, 7); assert.equal(g.tot.dmg, dmg + 10);
  assert.deepEqual(g.picks.map((p) => [p.type, p.floor || 0]), [['level', 3], ['level', 3], ['doctrine', 0]]);
  assert.ok(g.picks[0].opts.every((o) => o.r === 3), 'two legendary stat choices');
  assert.equal(g.castleCap(), 40); assert.equal(g.buildingCap(), 9);
  assert.ok(g.perk('obsidian') && g.perk('crystal') && g.perk('star'), 'the powers of the path stay');
  takeRewards(g, id);
  for (let a = 8; a <= 30; a++) {
    g.bossWaves = a; g.level = ageNeed(a).level; g.gold = ageNeed(a).gold;
    assert.ok(g.advanceAge(id), `ascension ${a - 6}`);
    takeRewards(g, id);
  }
  assert.equal(g.age, 30); assert.equal(g.ageReq().asc, 25); assert.equal(g.snapshot().ak, 'star');
  assert.equal(g.doctrines.length, DOCTRINE_KEYS.length, 'every doctrine is followed in the end');
});

test('later ages lift the caps: castle levels, building levels and, in the third age of a path, a sixth rarity', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 9].map(rarityCap), [1, 2, 3, 4, 4, 4, 5, 5]);
  assert.equal(RARITY.length, 6); assert.equal(RARITY[5].key, 'exalted'); assert.ok(RARITY[5].mul > RARITY[4].mul);
  assert.deepEqual([0, 1, 2, 3, 4, 9].map(plotsAt), [2, 4, 6, 7, 7, 7]);
  assert.deepEqual([0, 3, 4, 6, 10].map(buildingCapAt), [2, 5, 6, 8, 12]);
  assert.deepEqual([5, 6, 7, 8].map(buildLevelReq), [20, 25, 30, 35]); assert.deepEqual([5, 6, 7].map(buildCostMul), [18, 36, 72]);
  const roll = (age, n = 4000) => { const { g } = newGame(2); g.path = age > 3 ? 'legend' : null; g.age = age; g.wave = 80; g.st.luck = 300; g.refreshDerived(); let top = 0; for (let i = 0; i < n; i++) top = Math.max(top, g.rollRarity(100)); return top; };
  assert.equal(roll(3), 4); assert.equal(roll(5), 4); assert.equal(roll(6), 5);
  // A building can be raised past level five once the age allows it.
  const { g, id } = newGame();
  g.path = 'industry'; g.age = 4; g.level = 99; g.gold = 1e9;
  assert.ok(g.build(id, 0, 'forge'));
  for (let l = 2; l <= 6; l++) assert.ok(g.upgradeBuilding(id, 0), `level ${l}`);
  assert.equal(g.upgradeBuilding(id, 0), false, 'the Steel Age stops at six');
  assert.equal(g.buildingCost('forge', 6), BUILDINGS.forge.cost * 36);
  assert.equal(g.tot.dmg, LORDS_DMG(g) + 6 * BUILDINGS.forge.mods.dmg + 40);
  assert.deepEqual(g.snapshot().yard.up[0], [g.buildingCost('forge', 7), 30]);
  g.level = 24;
  g.age = 5;
  assert.equal(g.upgradeBuilding(id, 0), false, 'level seven needs castle level 30');
  // A promotion stops at the best rarity of the age.
  const u = g.units[0]; u.rar = 4; const lv = u.lv;
  g.promote(u); assert.equal(u.rar, 4); assert.equal(u.lv, lv + 3);
  g.age = 6; g.promote(u); assert.equal(u.rar, 5);
});
function LORDS_DMG(g) { return g.st.dmg; }

test('Splendour: razor walls of obsidian, the resonance of crystal and falling stars', () => {
  // Obsidian: a fifth more wall health; whatever strikes a wall loses 8% of its health (a boss 1%).
  { const a = battle('splendour', 4).g, b = battle(null, 4).g; near(a.tot.wallhp - b.tot.wallhp, PERKS.obsidian.wallhp);
    const cut = (t) => { const { g } = battle('splendour', 4); const e = addEnemy(g, t, 0, 0, { hp: 10000 }); g.hitWall(g.segs[0], 1, e); return 10000 - e.hp; };
    near(cut(1), 800); near(cut(7), 100);
    const e = addEnemy(b, 1, 0, 0, { hp: 10000 }); b.hitWall(b.segs[0], 1, e); assert.equal(e.hp, 10000); }
  // Crystal: more critical hits, and each one leaps to the nearest other monster for half the damage.
  { const { g } = battle('splendour', 5); assert.equal(g.tot.crit, battle('splendour', 4).g.tot.crit + PERKS.crystal.crit);
    const a = addEnemy(g, 1, 30, 0, { hp: 1e6 }), b = addEnemy(g, 1, 32, 0, { hp: 1e6 }), c = addEnemy(g, 1, 40, 0, { hp: 1e6 });
    g.hurtEnemy(a, 100, null, false, true);
    assert.equal(a.max - a.hp, 100); assert.equal(b.max - b.hp, 50); assert.equal(c.hp, c.max);
    g.hurtEnemy(a, 100); assert.equal(b.max - b.hp, 50, 'an ordinary hit stays where it is'); }
  // Star: every eight seconds a star falls on the strongest monster.
  { const { g } = battle('splendour', 6); const weak = addEnemy(g, 0, 30, 0, { hp: 1e5 }), strong = addEnemy(g, 1, -30, 0, { hp: 1e7 });
    for (let i = 0; i < 7.9 / TICK; i++) { g.updateSky(TICK); g.updateAbilities(TICK); }
    assert.equal(strong.hp, strong.max);
    for (let i = 0; i < 1.2 / TICK; i++) { g.updateSky(TICK); g.updateAbilities(TICK); }
    near(strong.max - strong.hp, g.volleyDamage() * PERKS.star.mul, 1e-6); assert.equal(weak.hp, weak.max);
    assert.ok(g.perk('obsidian') && g.perk('crystal')); }
});

test('Industry: steel plate, guns on the towers and steam engines', () => {
  // Steel: walls and keep take 15% less; repairs cost half.
  { const a = battle('industry', 4).g, b = battle(null, 4).g; near(a.guardMul() / b.guardMul(), 0.85);
    for (const g of [a, b]) g.th.hp = g.th.max - 1000;
    assert.equal(a.repairCost('hall'), 25); assert.equal(b.repairCost('hall'), 50); }
  // Powder: a gun on each tower fires at whatever comes within reach.
  { const { g } = battle('industry', 5);
    for (const [x, z] of TOWERS) addEnemy(g, 1, x * 1.9, z * 1.9, { hp: 1e7 });
    for (let i = 0; i < 4 / TICK; i++) { g.updateTurrets(TICK); g.updateProjs(TICK); }
    assert.ok(g.enemies.every((e) => e.hp < e.max), 'every tower has fired');
    assert.ok(g.dealt.engineers > 0, 'and the guns count as engineers');
    const none = battle('industry', 4).g; addEnemy(none, 1, 20, 20, { hp: 1e7 });
    for (let i = 0; i < 4 / TICK; i++) { none.updateTurrets(TICK); none.updateProjs(TICK); }
    assert.equal(none.enemies[0].hp, 1e7); }
  // Steam: turrets fire faster and count as one level higher; the shop restocks once for nothing.
  { const a = battle('industry', 6).g, b = battle('industry', 5).g;
    for (const g of [a, b]) g.turrets = [{ k: 'bolt', lv: 2, spot: 0, cd: 0 }];
    near(a.turretPower(a.turrets[0]) / b.turretPower(b.turrets[0]), (1 + 0.5 * 2) / (1 + 0.5 * 1));
    for (const g of [a, b]) { addEnemy(g, 1, -20, -4.2, { hp: 1e7 }); g.updateTurrets(0.01); }
    near(b.turrets[0].cd / a.turrets[0].cd, 1.3);
    const { g, id } = ready(5, 'industry'); g.gold = 1e6; g.level = 99;
    assert.ok(g.advanceAge(id)); takeRewards(g, id);
    g.chooseWave(id, 0); g.queue = []; g.enemies = []; steps(g, 1); takeRewards(g, id);
    const gold = g.gold;
    assert.equal(g.snapshot().rr, 0); assert.ok(g.rerollShop(id)); assert.equal(g.gold, gold, 'the first reroll is free');
    assert.ok(g.snapshot().rr > 0); assert.ok(g.rerollShop(id)); assert.ok(g.gold < gold); }
});

test('Legend: warding runes, a dragon over the castle and the grace of the heavens', () => {
  // Rune: walls mend 1% a second; each segment refuses to fall once a wave.
  { const { g } = battle('legend', 4); const s = g.segs[0]; addEnemy(g, 1, 60, 60, { hp: 1e9 });
    s.hp = s.max / 2; g.updateSupport(1); near(s.hp, s.max / 2 + s.max * 0.01);
    g.hitWall(s, 1e9);
    assert.equal(s.hp, 1, 'the rune holds'); assert.ok(g.fx.some((f) => f[0] === 56));
    g.hitWall(s, 1e9); assert.equal(s.hp, 1, 'and for a moment nothing can touch it');
    g.updateSupport(PERKS.rune.ward + 0.1);
    g.hitWall(s, 1e9); assert.equal(s.hp, 0, 'but only once a wave'); assert.equal(g.wallsLost, 1);
    const plain = battle(null, 4).g; plain.hitWall(plain.segs[0], 1e9); assert.equal(plain.segs[0].hp, 0); }
  // Dragon: every ten seconds the dragon burns the thickest crowd.
  { const { g } = battle('legend', 5);
    const crowd = [0, 1, 2, 3, 4].map((i) => addEnemy(g, 0, 30 + i * 0.8, 0, { hp: 1e6 })), lone = addEnemy(g, 1, -30, 0, { hp: 1e6 });
    for (let i = 0; i < 10.1 / TICK; i++) g.updateSky(TICK);
    assert.ok(crowd.every((e) => e.hp < e.max && e.burn > 0)); assert.equal(lone.hp, lone.max);
    assert.ok(g.fx.some((f) => f[0] === 44)); }
  // Celestial: the keep mends itself during a wave, and once a wave survives the blow that would fell it.
  { const { g } = battle('legend', 6); addEnemy(g, 1, 60, 60, { hp: 1e9 });
    g.th.hp = 1000; g.updateSupport(1); near(g.th.hp, 1000 + g.th.max * PERKS.celestial.regen);
    g.th.hp = 0; steps(g, 1);
    assert.equal(g.phase, 'wave'); near(g.th.hp, g.th.max * PERKS.celestial.grace, g.th.max * 0.01);
    g.th.hp = 0; steps(g, 1);
    assert.equal(g.phase, 'over', 'the second killing blow of the wave ends the run'); }
});

test('Splendour classes: the lavamancer\'s pools and the glaivemaster\'s finishing blow', () => {
  { const { g } = battle('splendour', 4); const u = place(g, 'lavamancer', 16); const e = addEnemy(g, 1, ...out(g, 16, 8), { hp: 1e6 });
    fire(g, u); assert.equal(g.projs.length, 1); land(g);
    assert.equal(g.clouds.length, 1); assert.equal(g.snapshot().cl[0][4], 1, 'a pool of fire');
    const hp = e.hp; g.updateHazards(1);
    near(hp - e.hp, g.clouds[0].dps, 1e-6); assert.ok(g.clouds[0].dps > 0);
    assert.ok(g.dealt.alchemy > 0);
    g.units = []; seconds(g, 5); assert.equal(g.clouds.length, 0, 'it burns out after five seconds'); }
  { const wide = battle('splendour', 4).g, u = place(wide, 'lavamancer', 16); u.spec = 1; addEnemy(wide, 1, ...out(wide, 16, 8), { hp: 1e6 }); fire(wide, u); near(wide.projs[0].aoe, UNITS.lavamancer.aoe * 1.5 * wide.areaMul()); }
  { const { g } = battle('splendour', 4); const u = place(g, 'lavamancer', 16); u.spec = 2; const e = addEnemy(g, 1, ...out(g, 16, 8), { hp: 1e6 }); fire(g, u); land(g); g.updateHazards(TICK); near(e.slowK, 0.35); }
  // The glaivemaster: whatever is left below 15% of its health dies at once; bosses and champions do not.
  const blow = (hp, { t = 1, champ = false, spec = 0 } = {}) => { const { g } = battle('splendour', 4); const u = place(g, 'glaive', 16); u.spec = spec; const e = addEnemy(g, t, ...out(g, 16, 2), { hp: 1000 }); e.champ = champ; e.hp = hp; fire(g, u); return { e, u, g }; };
  { const { e, u, g } = blow(180); assert.ok(e.hp <= 0); assert.equal(u.kills, 1); assert.ok(g.fx.some((f) => f[0] === 51)); }
  assert.ok(blow(400).e.hp > 300, 'a healthy monster is only wounded');
  assert.ok(blow(180, { t: 7 }).e.hp > 0); assert.ok(blow(180, { champ: true }).e.hp > 0);
  assert.ok(blow(280, { spec: 1 }).e.hp <= 0, 'the reaper finishes at 25%');
  { const { g } = battle('splendour', 4); const u = place(g, 'glaive', 16); u.spec = 2; for (let i = 0; i < 6; i++) addEnemy(g, 0, g.slots[16].x - 2 + i * 0.8, g.slots[16].z - 2, { hp: 1e6 }); fire(g, u); assert.equal(g.enemies.filter((e) => e.hp < e.max).length, 4, 'a whirlwind through four'); }
  assert.ok(newGame().g.wallOnly('glaive'));
});

test('Splendour classes: the prismancer\'s beam and the shardbow\'s splinters', () => {
  { const { g } = battle('splendour', 5); const u = place(g, 'prismancer', 16); const big = addEnemy(g, 1, ...out(g, 16, 8), { hp: 1e9 }), small = addEnemy(g, 0, ...out(g, 16, 5), { hp: 1e6 });
    const hits = [];
    for (let i = 0; i < 20; i++) { const before = big.hp; g.rng = () => 0.5; fire(g, u); hits.push(before - big.hp); }
    assert.equal(small.hp, small.max, 'the beam stays on the strongest monster');
    near(hits[1] / hits[0], 1.15); near(hits[2] / hits[0], 1.3); near(hits.at(-1) / hits[0], 3, 1e-6);
    assert.ok(g.fx.some((f) => f[0] === 40)); assert.equal(g.projs.length, 0, 'a beam is no arrow');
    // On a new target the beam starts over.
    g.enemies = g.enemies.filter((e) => e !== big);
    const first = small.hp; g.rng = () => 0.5; fire(g, u); const second = first - small.hp;
    near(second, hits[0], 1e-6);
    g.rng = () => 0.5; const before = small.hp; fire(g, u);
    near((before - small.hp) / second, 1.15, 1e-6); }
  { const { g } = battle('splendour', 5); const u = place(g, 'prismancer', 16); u.spec = 1; const e = addEnemy(g, 1, ...out(g, 16, 8), { hp: 1e9 }); const hits = []; for (let i = 0; i < 40; i++) { const b = e.hp; g.rng = () => 0.5; fire(g, u); hits.push(b - e.hp); } near(hits.at(-1) / hits[0], 5, 1e-6); }
  { const { g } = battle('splendour', 5); const u = place(g, 'prismancer', 16); u.spec = 2; const [x, z] = out(g, 16, 8); const e = addEnemy(g, 1, x, z, { hp: 1e9 }); const near1 = addEnemy(g, 0, x + 2, z, { hp: 1e6 }), near2 = addEnemy(g, 0, x - 2, z, { hp: 1e6 }), far = addEnemy(g, 0, x + 9, z - 9, { hp: 1e6 });
    g.rng = () => 0.5; fire(g, u); const d = e.max - e.hp; near(near1.max - near1.hp, d / 2); near(near2.max - near2.hp, d / 2); assert.equal(far.hp, far.max); }
  // The shardbow: the arrow breaks into three shards for half the damage.
  const volley = (spec, n = 8) => { const { g } = battle('splendour', 5); const u = place(g, 'shardbow', 16); u.spec = spec; const [x, z] = out(g, 16, 8); const first = addEnemy(g, 1, x, z, { hp: 1e6 }); const rest = []; for (let i = 0; i < n; i++) rest.push(addEnemy(g, 1, x + (i % 2 ? 1 : -1) * (1.5 + i * 0.3), z - 2.5, { hp: 1e6 })); g.rng = () => 0.5; fire(g, u); land(g); return { first, rest, g }; };
  { const { first, rest } = volley(0); const d = first.max - first.hp; assert.ok(d > 0); const hit = rest.filter((e) => e.hp < e.max); assert.equal(hit.length, 3); for (const e of hit) near(e.max - e.hp, d / 2); }
  assert.equal(volley(1).rest.filter((e) => e.hp < e.max).length, 6);
  { const { g } = battle('splendour', 5); const u = place(g, 'shardbow', 16); u.spec = 2; const e = addEnemy(g, 6, ...out(g, 16, 8), { hp: 1e6 }); g.rng = () => 0.5; fire(g, u); land(g); near(e.max - e.hp, g.unitPower(u), 1e-6); }
});

test('Splendour classes: the stargazer\'s fate and the starforger\'s meteors', () => {
  { const { g } = battle('splendour', 6); const u = place(g, 'stargazer', 16); const big = addEnemy(g, 1, ...out(g, 16, 10), { hp: 1e7 }), small = addEnemy(g, 0, ...out(g, 16, 6), { hp: 1e5 });
    fire(g, u);
    assert.equal(big.fate, 4); assert.equal(small.fate, 0); assert.equal(g.snapshot().en.find((e) => e[0] === big.id)[5] & 256, 256);
    for (let i = 0; i < 4; i++) { const b = big.hp; g.hurtEnemy(big, 100); assert.equal(b - big.hp, 200, 'a fated hit is critical'); }
    const b = big.hp; g.hurtEnemy(big, 100); assert.equal(b - big.hp, 100, 'after four the fate is spent');
    fire(g, u); g.hurtEnemy(big, 100, null, false, false, false); assert.equal(big.fate, 4, 'burning does not spend it');
    assert.ok(g.support('stargazer')); assert.ok(u.xp > 0); }
  { const { g } = battle('splendour', 6); const u = place(g, 'stargazer', 16); u.spec = 1; const es = [0, 1, 2, 3].map((i) => addEnemy(g, 1, g.slots[16].x - 3 + 2 * i, g.slots[16].z - 8, { hp: 1e6 + i })); fire(g, u); assert.equal(es.filter((e) => e.fate > 0).length, 3); }
  { const { g } = battle('splendour', 6); const u = place(g, 'stargazer', 16); u.spec = 2; const e = addEnemy(g, 1, ...out(g, 16, 8), { hp: 1e6 }); fire(g, u); assert.equal(e.fate, 8); }
  // The starforger shells the thickest crowd on the ground; what flies is not hit.
  { const { g } = battle('splendour', 6); const u = place(g, 'starforger', 16); const [x, z] = out(g, 16, 16);
    const crowd = [0, 1, 2, 3, 4].map((i) => addEnemy(g, 0, x + i * 0.7, z, { hp: 1e6 })), lone = addEnemy(g, 1, x - 12, z, { hp: 1e6 }), flyer = addEnemy(g, 4, x + 1, z, { hp: 1e6 });
    fire(g, u); assert.equal(g.shells.length, 1); assert.ok(g.fx.some((f) => f[0] === 61));
    land(g, 1.3);
    assert.ok(crowd.every((e) => e.max - e.hp > 0)); near(crowd[0].max - crowd[0].hp, g.unitPower(u), 1e-6);
    assert.equal(lone.hp, lone.max); assert.equal(flyer.hp, flyer.max); assert.ok(g.dealt.engineers > 0); assert.equal(u.kills, 0); }
  { const { g } = battle('splendour', 6); const u = place(g, 'starforger', 16); u.spec = 1; const [x, z] = out(g, 16, 16); addEnemy(g, 1, x - 9, z, { hp: 1e6 }); addEnemy(g, 1, x + 9, z, { hp: 1e6 }); fire(g, u); assert.equal(g.shells.length, 2, 'twin stars'); land(g, 1.3); assert.ok(g.enemies.every((e) => e.hp < e.max)); }
});

test('Industry classes: the repeater\'s volley and the ironclad who throws monsters back', () => {
  const shots = (spec) => { const { g } = battle('industry', 4); const u = place(g, 'repeater', 16); u.spec = spec; addEnemy(g, 1, ...out(g, 16, 12), { hp: 1e9 }); g.rng = () => 0.5; fire(g, u); let n = g.projs.length; for (let i = 0; i < 20; i++) { const b = g.projs.length; g.updateUnits(TICK); n += g.projs.length - b; } return { n, g }; };
  assert.equal(shots(0).n, 3); assert.equal(shots(1).n, 5);
  { const { g } = shots(2); assert.ok(g.projs.every((b) => b.pierce), 'steel bolts pierce armour'); }
  // The ironclad: the blow throws the monster back from the wall; a boss hardly moves.
  const thrown = (t, spec = 0) => { const { g } = battle('industry', 4); const u = place(g, 'ironclad', 16); u.spec = spec; const [x, z] = out(g, 16, 2); const e = addEnemy(g, t, x, z, { hp: 1e6 }); fire(g, u); return { d: Math.hypot(e.x, e.z) - Math.hypot(x, z), e, g }; };
  near(thrown(1).d, 2.5, 0.01); near(thrown(7).d, 0.5, 0.01); near(thrown(1, 1).d, 4.5, 0.01);
  { const { e, g } = thrown(1, 2); near(e.stun, 1); assert.equal(g.snapshot().en[0][5] & 64, 64);
    const x = e.x, z = e.z; e.cd = 0; g.updateEnemies(0.5); assert.deepEqual([e.x, e.z], [x, z], 'a stunned monster stands still');
    g.updateEnemies(0.6); g.updateEnemies(0.5); assert.ok(Math.hypot(e.x, e.z) < Math.hypot(x, z), 'and then walks on'); }
  assert.ok(newGame().g.wallOnly('ironclad'));
});

test('Industry classes: the rocketeer\'s long reach and the artillerist\'s cannonball', () => {
  { const { g } = battle('industry', 5); const u = place(g, 'rocketeer', 16); const [x, z] = out(g, 16, 26);
    // The walker stands out of reach of the tower guns of the Powder Age.
    const ground = addEnemy(g, 1, x + 12, z + 2, { hp: 1e6 }), flyer = addEnemy(g, 4, x, z, { hp: 1e6 }), beside = addEnemy(g, 4, x + 2, z, { hp: 1e6 });
    fire(g, u); land(g, 2.5);
    assert.ok(flyer.hp < flyer.max, 'it goes for what flies'); assert.ok(beside.hp < beside.max, 'and the blast reaches the air around it'); assert.equal(ground.hp, ground.max);
    assert.ok(g.unitRange(u) > 28); }
  { const { g } = battle('industry', 5); const u = place(g, 'rocketeer', 16); u.spec = 1; const [x, z] = out(g, 16, 20); addEnemy(g, 1, x - 8, z, { hp: 1e6 }); addEnemy(g, 1, x + 8, z, { hp: 1e6 }); fire(g, u); assert.equal(g.projs.length, 2, 'a barrage at two targets'); }
  { const { g } = battle('industry', 5); const u = place(g, 'rocketeer', 16); u.spec = 2; const e = addEnemy(g, 1, ...out(g, 16, 12), { hp: 1e6 }); fire(g, u); land(g, 2); assert.ok(e.burn > 0 && e.burnDps > 0); }
  // The artillerist: one ball through a whole column, armour or not.
  // (The tower guns of the Powder Age are kept quiet so that only the ball counts.)
  const column = (spec, n = 20) => { const { g } = battle('industry', 5); g.guns.forEach((gun) => { gun.cd = 99; }); const u = place(g, 'artillerist', 16); u.spec = spec; const es = []; for (let i = 0; i < n; i++) es.push(addEnemy(g, 6, ...out(g, 16, 4 + i * 2.5), { hp: 1e6 })); g.rng = () => 0.5; fire(g, u); land(g, 2); return { es, u, g }; };
  { const { es, u, g } = column(0); assert.equal(es.filter((e) => e.hp < e.max).length, 9, 'the first and eight more'); near(es[0].max - es[0].hp, g.unitPower(u), 1e-6); }
  { const n = column(1).es.filter((e) => e.hp < e.max).length; assert.ok(n > 12 && n <= 17, `chain shot went through ${n}`); }
  { const { es } = column(2, 3); assert.ok(es[0].z < -S - 4 - 2.5, 'a heavy ball knocks them back'); }
});

test('Industry classes: the galvanist\'s stunning lightning and the wallwright who raises ruins', () => {
  { const { g } = battle('industry', 6); const u = place(g, 'galvanist', 16); const es = [0, 1, 2, 3, 4, 5].map((i) => addEnemy(g, i === 0 ? 7 : 1, ...out(g, 16, 5 + 3 * i), { hp: 1e6 }));
    g.rng = () => 0.5; fire(g, u);
    const hit = es.filter((e) => e.hp < e.max);
    assert.equal(hit.length, 4, 'the first and three jumps'); near(es[1].stun, 0.6); near(es[0].stun, 0.15, 1e-9); }
  { const { g } = battle('industry', 6); const u = place(g, 'galvanist', 16); u.spec = 1; const e = addEnemy(g, 1, ...out(g, 16, 5), { hp: 1e6 }); g.rng = () => 0.5; fire(g, u); near(e.stun, 1.2); }
  { const { g } = battle('industry', 6); const u = place(g, 'galvanist', 16); u.spec = 2; for (let i = 0; i < 12; i++) addEnemy(g, 1, ...out(g, 16, 5 + 3 * i), { hp: 1e6 }); g.rng = () => 0.5; fire(g, u); assert.equal(g.enemies.filter((e) => e.hp < e.max).length, 8); }
  // The wallwright mends walls as a cleric does, and now and then raises a ruined segment.
  { const { g } = battle('industry', 6); const u = place(g, 'wallwright', 16); const seg = g.slots[16].seg; addEnemy(g, 1, 60, 60, { hp: 1e9 });
    const beside = g.segs.findIndex((s, i) => i !== seg && Math.hypot(s.x - g.slots[16].x, s.z - g.slots[16].z) < 5);
    g.segs[beside].hp = 0;
    fire(g, u);
    near(g.segs[beside].hp, g.segs[beside].max * 0.3); assert.ok(g.fx.some((f) => f[0] === 60));
    g.segs[beside].hp = 0; g.segs[seg].hp = g.segs[seg].max / 2;
    fire(g, u);
    assert.equal(g.segs[beside].hp, 0, 'not again so soon'); assert.ok(g.segs[seg].hp > g.segs[seg].max / 2, 'meanwhile it mends');
    g.waveT += 12.1; fire(g, u); assert.ok(g.segs[beside].hp > 0); }
  { const { g } = battle('industry', 6); const u = place(g, 'wallwright', 16); u.spec = 1; addEnemy(g, 1, 60, 60, { hp: 1e9 }); const s = g.segs.find((x, i) => i !== g.slots[16].seg && Math.hypot(x.x - g.slots[16].x, x.z - g.slots[16].z) < 5); s.hp = 0; fire(g, u); near(s.hp, s.max * 0.6); }
  assert.ok(newGame().g.support('wallwright'));
});

test('Legend classes: the runeblade\'s brand and the runesmith\'s runes', () => {
  { const { g } = battle('legend', 4); const u = place(g, 'runeblade', 16); const e = addEnemy(g, 1, ...out(g, 16, 2), { hp: 1e6 });
    g.rng = () => 0.5; fire(g, u);
    assert.equal(e.curse, 4); near(e.curseK, 0.2);
    const b = e.hp; g.hurtEnemy(e, 100); near(b - e.hp, 120);
    g.units = []; seconds(g, 4.2); assert.equal(e.curseK, 0, 'the brand fades'); }
  { const { g } = battle('legend', 4); const u = place(g, 'runeblade', 16); u.spec = 1; const e = addEnemy(g, 1, ...out(g, 16, 2), { hp: 1e6 }); g.rng = () => 0.5; fire(g, u); near(e.curseK, 0.4); }
  { const { g } = battle('legend', 4); const u = place(g, 'runeblade', 16); u.spec = 2; const e = addEnemy(g, 1, ...out(g, 16, 2), { hp: 1e6 }); g.rng = () => 0.5; fire(g, u); near(e.slowK, 0.4); assert.ok(e.slow > 0); }
  // The runesmith: the defenders next to them hit harder; they do not fight themselves.
  { const { g } = battle('legend', 4); const smith = place(g, 'runesmith', 16), a = place(g, 'archer', 12), far = place(g, 'archer', 5);
    const base = g.unitPower(a);
    addEnemy(g, 1, 60, 60, { hp: 1e9 }); g.updateSupport(TICK);
    near(g.unitPower(a) / base, 1.12); near(g.unitPower(far) / base, 1, 1e-9);
    g.updateUnits(1); assert.equal(g.projs.filter((b) => b.u === smith).length, 0);
    smith.spec = 1; g.updateSupport(TICK); near(g.unitPower(a) / base, 1.18);
    for (let i = 0; i < 8; i++) place(g, 'runesmith', 17 + i === 12 ? 30 : 17 + i);
    g.units.filter((x) => x.k === 'runesmith').forEach((x) => { x.slot = 16; });
    g.updateSupport(TICK); near(g.unitPower(a) / base, 1.6, 1e-9); }
  assert.ok(newGame().g.support('runesmith')); assert.equal(newGame().g.wallOnly('runesmith'), false);
});

test('Legend classes: the drake\'s breath and the lancer\'s pin', () => {
  { const { g } = battle('legend', 5); const u = place(g, 'drakekeeper', 16); const [x, z] = out(g, 16, 8);
    const ahead = addEnemy(g, 1, x, z, { hp: 1e6 }), beside = addEnemy(g, 0, x + 2, z - 1, { hp: 1e6 }), wide = addEnemy(g, 0, x + 9, z + 5, { hp: 1e6 }), far = addEnemy(g, 0, x, z - 12, { hp: 1e6 });
    g.rng = () => 0.5; fire(g, u);
    assert.ok(ahead.hp < ahead.max && beside.hp < beside.max, 'everything in the cone burns'); assert.ok(ahead.burn > 0 && beside.burn > 0);
    assert.equal(wide.hp, wide.max, 'not what stands to the side'); assert.equal(far.hp, far.max, 'nor what is out of reach');
    assert.ok(g.fx.some((f) => f[0] === 42)); assert.equal(g.projs.length, 0); }
  { const { g } = battle('legend', 5); const u = place(g, 'drakekeeper', 16); u.spec = 1; near(g.unitRange(u) / UNITS.drakekeeper.range, 1.4 * g.unitRange(place(g, 'drakekeeper', 17)) / UNITS.drakekeeper.range, 1e-6); }
  // The lancer goes for the toughest monster and pins it to the ground.
  { const { g } = battle('legend', 5); const u = place(g, 'lancer', 16); const tough = addEnemy(g, 1, ...out(g, 16, 14), { hp: 1e7 }), close = addEnemy(g, 0, g.slots[16].x + 5, g.slots[16].z - 3, { hp: 1e5 });
    g.rng = () => 0.5; fire(g, u); land(g, 0.5);
    assert.ok(tough.hp < tough.max); assert.equal(close.hp, close.max); assert.ok(tough.stun > 0.9 && tough.stun <= 1.5); }
  const pin = (t, spec = 0) => { const { g } = battle('legend', 5); const u = place(g, 'lancer', 16); u.spec = spec; const e = addEnemy(g, t, ...out(g, 16, 6), { hp: 1e7 }); g.rng = () => 0.5; fire(g, u); for (let i = 0; i < 40 && e.hp === e.max; i++) g.updateProjs(TICK); return { stun: e.stun, dmg: e.max - e.hp }; };
  near(pin(1).stun, 1.5); near(pin(7).stun, 0.375); near(pin(1, 2).stun, 3);
  near(pin(2, 1).dmg / pin(2).dmg, 2, 1e-6);
});

test('Legend classes: the seraph\'s smite and the skycaller\'s pillar of light', () => {
  { const { g } = battle('legend', 6); const u = place(g, 'seraph', 16);
    const foes = [6, 8, 10, 12, 30].map((d) => addEnemy(g, 1, 0, d, { hp: 1e6 }));
    g.th.hp = g.th.max - 500;
    fire(g, u);
    assert.ok(g.th.hp > g.th.max - 500, 'the prayer heals the keep');
    assert.deepEqual(foes.map((e) => e.hp < e.max), [true, true, true, false, false], 'and smites the three monsters nearest to it');
    near(foes[0].max - foes[0].hp, g.smitePower(u), 1e-6); assert.ok(g.dealt.faith > 0);
    g.th.hp = g.th.max; const b = foes[0].hp; fire(g, u); assert.ok(foes[0].hp < b, 'with the keep whole the smiting goes on'); }
  { const { g } = battle('legend', 6); const u = place(g, 'seraph', 16); u.spec = 1; for (let i = 0; i < 9; i++) addEnemy(g, 1, 0, 6 + i * 2, { hp: 1e6 }); fire(g, u); assert.equal(g.enemies.filter((e) => e.hp < e.max).length, 6); }
  { const { g } = battle('legend', 6); const u = place(g, 'seraph', 16); addEnemy(g, 1, 60, 60, { hp: 1e9 }); g.th.hp = g.th.max; fire(g, u); assert.ok(u.cd <= 0, 'nothing to do: she waits'); }
  // The skycaller: a pillar of light lands a moment later on everything under it, flying or armoured.
  { const { g } = battle('legend', 6); const u = place(g, 'skycaller', 16); const [x, z] = out(g, 16, 12);
    const a = addEnemy(g, 6, x, z, { hp: 1e6 }), fly = addEnemy(g, 4, x + 2, z, { hp: 1e5 }), far = addEnemy(g, 0, x + 6, z, { hp: 1e5 });
    g.rng = () => 0.5; fire(g, u);
    assert.equal(a.hp, a.max, 'not yet'); assert.equal(g.rains.length, 1); assert.ok(g.fx.some((f) => f[0] === 43));
    land(g, 1);
    near(a.max - a.hp, g.unitPower(u), 1e-6); assert.ok(fly.hp < fly.max); assert.equal(far.hp, far.max); assert.ok(g.dealt.arcane > 0); }
  { const { g } = battle('legend', 6); const u = place(g, 'skycaller', 16); u.spec = 1; addEnemy(g, 1, ...out(g, 16, 12), { hp: 1e6 }); g.rng = () => 0.5; fire(g, u); near(g.rains[0].r, 4.5); }
});

test('a run on a path is saved and restored with its age, its classes and its powers', () => {
  const { g, id } = ready(4, 'industry', 5);
  g.gold = 1e6; g.level = 60;
  assert.ok(g.advanceAge(id)); takeRewards(g, id);
  g.units.push(g.newUnit(card('rocketeer', { rar: 3, lv: 12 }), g.freeSlot('rocketeer')));
  g.muts = { shell: 1 }; g.adapt.marksmen = 24;
  const save = JSON.parse(JSON.stringify(g.save()));
  assert.equal(save.v, 5); assert.equal(save.path, 'industry'); assert.equal(save.age, 5);
  const h = new Game();
  assert.ok(h.load(save));
  assert.deepEqual([h.age, h.path, h.snapshot().ak], [5, 'industry', 'powder']);
  assert.ok(h.perk('steel') && h.perk('powder') && !h.perk('steam'));
  assert.ok(h.units.some((u) => u.k === 'rocketeer' && u.rar === 3 && u.lv === 12));
  assert.deepEqual(h.tot, g.tot);
  assert.equal(new Game().load({ ...save, path: 'legend' }), false, 'a rocketeer does not serve on another path');
  assert.equal(new Game().load({ ...save, path: null }), false);
  assert.equal(new Game().load({ ...save, age: 3 }), false, 'nor a path before the fifth age');
});
