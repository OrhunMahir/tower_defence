// Ages: unlocked by a boss, bought with gold at a high enough castle level; and the doctrines they bring.
import test from 'node:test';
import assert from 'node:assert/strict';
import { AGES, AGE_CAP, PLOTS_BY_AGE, RARITY_CAP, UNITS, UNIT_KEYS, TURRETS, DOCTRINES, DOCTRINE_KEYS, LORDS } from '../server/game.js';
import { newGame, steps, seconds, emptyWave, addEnemy, card, takeRewards } from './bots.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} is not within ${eps} of ${b}`);
// A game that may advance to the next age right now.
function ready() {
  const { g, id } = newGame();
  g.bossWaves = 1; g.level = AGES[1].level; g.gold = AGES[1].gold;
  return { g, id };
}

test('four ages; each needs its boss wave won, a castle level and gold', () => {
  assert.deepEqual(AGES.map((a) => a.key), ['timber', 'stone', 'iron', 'gold']);
  const { g, id } = newGame();
  g.gold = 1e6; g.level = 99;
  assert.deepEqual([g.ageReq().boss, g.ageReq().level, g.ageReq().gold], [false, true, true]);
  assert.equal(g.advanceAge(id), false, 'no boss has fallen yet: an age cannot be rushed');
  g.bossWaves = 1; g.level = AGES[1].level - 1;
  assert.equal(g.advanceAge(id), false, 'the castle level is too low');
  g.level = AGES[1].level; g.gold = AGES[1].gold - 1;
  assert.equal(g.advanceAge(id), false, 'not enough gold');
  g.gold = AGES[1].gold;
  assert.equal(g.advanceAge(999), false);
  assert.ok(g.advanceAge(id));
  assert.equal(g.age, 1); assert.equal(g.gold, 0);
  assert.ok(g.snapshot().fx.some((f) => f[0] === 30 && f[3] === 1));
  for (let i = 1; i < AGES.length; i++) assert.ok(AGES[i].gold > AGES[i - 1].gold && AGES[i].level > AGES[i - 1].level);
});

test('winning a boss wave opens the next age, however many bosses it held', () => {
  const { g, id } = newGame();
  g.wave = 23; g.bossWaves = 2; g.age = 2; g.makeWaveOffers();
  const hard = g.waves.findIndex((w) => w.hard);
  assert.equal(g.waves[hard].c[8], 2, 'the hard offer of wave 24 holds two Brood Mothers');
  g.chooseWave(id, hard); g.queue = []; g.enemies = [];
  steps(g, 1);
  assert.equal(g.bossWaves, 3);
  g.stats.bosses = 9;
  assert.equal(g.ageReq().next, 3);
  takeRewards(g, id);
  g.level = 99; g.gold = 1e6;
  assert.ok(g.advanceAge(id));
  takeRewards(g, id);
  const r = g.ageReq();
  assert.deepEqual([r.next, r.choose, r.key, r.asc, r.wave, r.bt], [4, true, null, 0, 32, 9], 'after the Golden Age a path has to be chosen, once the Sky Tyrant has fallen');
  const early = newGame().g;
  early.bossWaves = 1; early.age = 1;
  assert.equal(early.ageReq().boss, false, 'the Iron Age needs the second boss wave');
  assert.deepEqual([early.ageReq().wave, early.ageReq().bt], [16, 7], 'which is the Behemoth, on wave 16');
});

test('a new age offers a doctrine and then returns to the same preparation', () => {
  const { g, id } = ready();
  const offers = JSON.stringify(g.waves), shop = JSON.stringify(g.shop);
  g.advanceAge(id);
  assert.equal(g.phase, 'reward');
  assert.equal(g.picks[0].type, 'doctrine');
  assert.equal(g.picks[0].opts.length, 3);
  assert.equal(new Set(g.picks[0].opts.map((o) => o.key)).size, 3);
  for (const o of g.picks[0].opts) assert.ok(DOCTRINE_KEYS.includes(o.key));
  assert.equal(g.rerollPick(id), false, 'a doctrine cannot be rerolled');
  assert.equal(g.skip(id), false);
  const key = g.picks[0].opts[1].key;
  assert.ok(g.choose(id, 1));
  assert.deepEqual(g.doctrines, [key]);
  assert.equal(g.phase, 'prep');
  assert.equal(JSON.stringify(g.waves), offers, 'the wave offers are untouched');
  assert.equal(JSON.stringify(g.shop), shop, 'so is the shop: no free reroll');
});

test('each age raises the caps, opens plots, and brings better arms and stonework', () => {
  const { g, id } = ready();
  const wall = g.segs[0].max;
  g.advanceAge(id); takeRewards(g, id);
  assert.equal(g.castleCap(), 2 * AGE_CAP);
  assert.equal(g.plotCount(), PLOTS_BY_AGE[1]);
  assert.equal(g.buildingCap(), 3);
  const doc = g.doctrines[0], extra = doc === 'masons' ? 20 : 0;
  assert.equal(g.tot.dmg, LORDS.marshal.mods.dmg + 10);
  assert.equal(g.tot.wallhp, 10 + extra);
  near(g.segs[0].max, Math.round(wall * (1 + (10 + extra) / 100)), 1);
  assert.equal(g.snapshot().age, 1);
});

test('recruits, turrets and rarities follow the age', () => {
  const { g } = newGame(3);
  g.wave = 40; g.st.luck = 300; g.refreshDerived();
  for (let age = 0; age < 4; age++) {
    g.age = age;
    const seen = new Set();
    let top = 0;
    for (let i = 0; i < 400; i++) { const c = g.makeCard(); seen.add(c.k); top = Math.max(top, c.rar); }
    for (const k of seen) assert.ok(UNITS[k].age <= age + 1, `${k} in age ${age + 1}`);
    assert.equal(seen.size, UNIT_KEYS.filter((k) => UNITS[k].age <= age + 1).length, 'every class of the age turns up');
    assert.equal(top, RARITY_CAP[age], 'the best rarity of the age');
    for (let i = 0; i < 60; i++) { const o = g.turretOption(); if (o) assert.ok(TURRETS[o.k].age <= age + 1); }
  }
});

test('only unlocked classes are recruited', () => {
  const { g } = newGame(4, 1, { classes: ['archer', 'mage'] });
  g.age = 3;
  for (let i = 0; i < 200; i++) assert.ok(['archer', 'mage'].includes(g.makeCard().k));
});

test('doctrines of families on the walls are offered more often', () => {
  const { g } = newGame(5);
  let fam = 0, other = 0;
  for (let i = 0; i < 400; i++) for (const o of g.doctrineOptions()) { const f = DOCTRINES[o.key].fam; if (f === 'marksmen' || f === 'wardens') fam++; else if (f) other++; }
  assert.ok(fam > other, `${fam} vs ${other}: the marshal fields marksmen and wardens`);
  g.doctrines = DOCTRINE_KEYS.slice(0, DOCTRINE_KEYS.length - 2);
  assert.equal(g.doctrineOptions().length, 2, 'never one the castle already follows');
});

test('doctrines change the rules', () => {
  const withDoc = (k, f) => { const { g, id } = newGame(); g.st.dmg = 0; g.st.armor = 0; if (k) g.doctrines.push(k); g.refreshDerived(); return f(g, id); };
  // conscription: four more places; recruits a level higher
  assert.equal(withDoc('conscription', (g) => g.capacity()) - withDoc(null, (g) => g.capacity()), 4);
  assert.equal(withDoc('conscription', (g) => g.makeCard().lv) - withDoc(null, (g) => g.makeCard().lv), 1);
  // war economy: 40% more wave gold and a fifth shop offer
  const income = (g, id) => { g.gold = 0; const i = g.waves.findIndex((w) => !w.hard), r = g.waves[i].gold; g.chooseWave(id, i); g.queue = []; steps(g, 1); return g.gold / r; };
  near(withDoc('wareconomy', income), 1.4, 0.03);
  assert.equal(withDoc('wareconomy', (g) => g.shopSize()), 5);
  // shield wall: a fifth less damage to walls and keep
  near(withDoc('shieldwall', (g) => g.guardMul()), 0.8);
  // lucky star: luck and one more spoils choice
  assert.equal(withDoc('luckystar', (g) => g.tot.luck), 40);
  assert.equal(withDoc('luckystar', (g) => g.spoilsOptions().length), 4);
  // high ground: towers give twice the range bonus and everyone reaches further
  const reach = (g) => g.unitRange(g.units.find((u) => g.slots[u.slot].seg < 0)) / UNITS.archer.range;
  near(withDoc('highground', reach) - withDoc(null, reach), 0.25);
  // clockwork: faster turrets and two more spots
  assert.equal(withDoc('clockwork', (g) => g.turretSpots()) - withDoc(null, (g) => g.turretSpots()), 2);
  // giant killers: half as much damage again to bosses
  const bossHit = (g) => { const e = addEnemy(g, 2, 30, 0, { hp: 1000 }); g.hurtEnemy(e, 100); return 1000 - e.hp; };
  assert.equal(withDoc('giantkillers', bossHit), 150);
  // veterans: two levels at once
  const { g, id } = ready();
  g.advanceAge(id);
  g.picks[0].opts[0] = { key: 'veterans' };
  g.choose(id, 0);
  assert.ok(g.units.every((u) => u.lv === 3));
});

test('volley fire and overload sometimes loose a second shot', () => {
  const shots = (k, doc) => {
    const { g } = newGame(7);
    g.units = [g.newUnit(card(k), 5)];
    if (doc) g.doctrines.push(doc);
    g.refreshDerived();
    emptyWave(g);
    const p = g.slots[5];
    let n = 0;
    for (let i = 0; i < 200; i++) { addEnemy(g, 1, p.x, p.z + (p.z > 0 ? 9 : -9), { hp: 1e9 }); g.units[0].cd = 0; g.projs = []; g.updateUnits(0); n += g.projs.length; g.enemies = []; }
    return n;
  };
  assert.equal(shots('archer'), 200);
  const more = shots('archer', 'volleyfire');
  assert.ok(more > 240 && more < 310, `${more} arrows from 200 shots`);
  assert.equal(shots('archer', 'overload'), 200, 'overload is for the arcane');
  assert.ok(shots('mage', 'overload') > 225);
});

test('the moat slows monsters at the foot of the walls; bloodlust speeds up the killers', () => {
  const walk = (doc) => {
    const { g } = newGame();
    g.units = []; if (doc) g.doctrines.push(doc);
    emptyWave(g);
    const e = addEnemy(g, 1, 0, -18.4, { hp: 1e9 });
    seconds(g, 0.5);
    return 18.4 + e.z;
  };
  near(walk('moat'), walk(null) * 0.75, 0.02);
  const { g } = newGame();
  g.doctrines.push('bloodlust');
  const u = g.units[0], slow = g.unitReload(u);
  g.lust = 100;
  near(g.unitReload(u), slow / 1.4, 0.001);
  g.lust = 1e6;
  near(g.unitReload(u), slow / 1.6, 0.001);
});
