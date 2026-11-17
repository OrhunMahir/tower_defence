// Rewards between waves (level-ups and spoils), items with special effects and the castle abilities.
import test from 'node:test';
import assert from 'node:assert/strict';
import { STATS, STAT_KEYS, ITEMS, ITEM_KEYS, CAPACITY, ABILITIES, ABILITY_KEYS, DEFAULT_ABILITIES, ENEMIES, RARITY, EVENTS, UNITS, levelNeed, goldMul, budget } from '../server/game.js';
import { newGame, steps, seconds, emptyWave, addEnemy, card, takeRewards } from './bots.js';

// Ends an empty wave and returns the game in its reward phase (or prep when nothing is due).
function cleared(g, setup = () => {}) {
  emptyWave(g);
  setup(g);
  steps(g, 1);
  return g;
}

test('castle levels come from kills and each one queues a choice of four stat upgrades', () => {
  const { g, id } = newGame();
  emptyWave(g);
  g.castleXp(levelNeed(1) + levelNeed(2));
  assert.equal(g.level, 3);
  assert.deepEqual(g.picks.map((p) => p.type), ['level', 'level']);
  assert.equal(g.phase, 'wave', 'choices wait until the wave is over');
  steps(g, 1);
  assert.equal(g.phase, 'reward');
  assert.deepEqual(g.picks.map((p) => p.type), ['level', 'level', 'spoils'], 'level-ups first, then the spoils');
  const p = g.picks[0];
  assert.equal(p.opts.length, 4);
  assert.equal(new Set(p.opts.map((o) => o.stat)).size, 4, 'four different stats');
  for (const o of p.opts) assert.ok(STAT_KEYS.includes(o.stat) && o.r >= 0 && o.r < 4);
  const o = p.opts[1], before = g.tot[o.stat];
  assert.ok(g.choose(id, 1));
  assert.equal(g.tot[o.stat], before + STATS[o.stat][o.r]);
  assert.equal(g.picks.length, 2);
  for (const bad of [-1, 4, 'x', null, 1.5]) assert.equal(g.choose(id, bad), false, String(bad));
  assert.equal(g.choose(999, 0), false, 'unknown player');
});

test('every fifth castle level is at least rare', () => {
  const { g } = newGame(3);
  for (let i = 0; i < 30; i++) { g.level = 5; assert.ok(g.levelOptions().every((o) => o.r >= 1)); }
});

test('the spoils always offer a recruit; on full walls a promotion or a newcomer for the weakest post', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const { g } = newGame(seed);
    const opts = g.spoilsOptions();
    assert.equal(opts.length, 3);
    assert.equal(opts[0].type, 'recruit'); assert.equal(opts[0].swap, undefined);
    for (const o of opts) assert.ok(['recruit', 'promote', 'item', 'turret', 'bless'].includes(o.type));
  }
  const seen = new Set();
  for (let seed = 1; seed <= 30; seed++) {
    const { g, id } = newGame(seed);
    while (g.units.length < CAPACITY[1]) g.units.push(g.newUnit(card('archer'), g.freeSlot('archer')));
    g.units[3].lv = 9;
    const o = g.spoilsOptions()[0];
    seen.add(o.type);
    if (o.type === 'promote') continue;
    // A newcomer for full walls names who leaves: the weakest defender who stands where they may stand.
    const weak = g.unit(o.swap);
    assert.ok(weak && weak.lv === 1 && weak !== g.units[3]);
    assert.deepEqual(o.out, { k: weak.k, name: weak.name, rar: weak.rar, lv: weak.lv });
    if (g.wallOnly(o.card.k)) assert.ok(g.slots[weak.slot].seg >= 0, 'a spearman never takes a tower');
    const slot = weak.slot, n = g.units.length;
    g.phase = 'reward'; g.picks = [{ type: 'spoils', opts: [o] }];
    assert.ok(g.choose(id, 0));
    assert.equal(g.units.length, n, 'one in, one out');
    assert.equal(g.unit(o.swap), undefined);
    assert.equal(g.units.at(-1).slot, slot); assert.equal(g.units.at(-1).k, o.card.k);
  }
  assert.deepEqual([...seen].sort(), ['promote', 'recruit']);
  // The newcomer inherits four fifths of the levels of the one who leaves.
  const { g } = newGame();
  while (g.units.length < CAPACITY[1]) g.units.push(g.newUnit(card('archer'), g.freeSlot('archer')));
  for (const u of g.units) u.lv = 20;
  assert.equal(g.swapOption(card('mage')).card.lv, 16);
  assert.equal(g.swapOption(card('mage', { lv: 30 })).card.lv, 30);
});

test('taking a recruit puts a new defender on the walls', () => {
  const { g, id } = newGame();
  cleared(g);
  g.picks[0].opts[0] = { type: 'recruit', card: card('pyro', { rar: 2, name: 'Edda' }) };
  assert.ok(g.choose(id, 0));
  const u = g.units.at(-1);
  assert.deepEqual([u.k, u.rar, u.name], ['pyro', 2, 'Edda']);
  assert.equal(g.phase, 'prep');
});

test('a promotion raises a defender a rarity, or three levels once legendary', () => {
  const { g, id } = newGame();
  const u = g.units[0], p = u.p;
  cleared(g);
  g.picks[0].opts[0] = { type: 'promote', uid: u.uid };
  assert.ok(g.choose(id, 0));
  assert.equal(u.rar, 1); assert.ok(Math.abs(u.p - p * RARITY[1].mul) < 0.01);
  u.rar = 3;
  cleared(g);
  g.picks[0].opts[0] = { type: 'promote', uid: u.uid };
  g.choose(id, 0);
  assert.equal(u.rar, 3); assert.equal(u.lv, 4);
});

test('a blessing makes every defender of a class stronger', () => {
  const { g, id } = newGame();
  const u = g.units[0], before = g.unitPower(u);
  cleared(g);
  g.picks[0].opts[0] = { type: 'bless', k: 'archer', v: 2 };
  g.choose(id, 0);
  assert.ok(Math.abs(g.unitPower(u) - before * 1.4) < 1e-9);
});

test('skipping the spoils pays gold; rerolling costs more each time and resets after a pick', () => {
  const { g, id } = newGame();
  cleared(g);
  g.gold = 1000;
  const c1 = g.pickRerollCost();
  assert.ok(g.rerollPick(id));
  assert.equal(g.gold, 1000 - c1);
  assert.ok(g.pickRerollCost() > c1);
  g.gold = 0;
  assert.equal(g.rerollPick(id), false, 'no gold');
  const skip = g.skipGold();
  assert.ok(g.skip(id));
  assert.equal(g.gold, skip);
  assert.equal(g.skip(id), false, 'nothing left to skip');
  assert.equal(g.pickRerolls, 0);
});

test('a boss wave gives luckier spoils and a relic; a hard wave makes the spoils luckier still', () => {
  for (const hard of [false, true]) {
    const { g, id } = newGame();
    g.wave = 7; g.makeWaveOffers();
    g.chooseWave(id, g.waves.findIndex((w) => w.hard === hard)); g.queue = []; g.enemies = [];
    steps(g, 1);
    const spoils = g.picks.filter((p) => p.type === 'spoils');
    assert.equal(spoils.length, 1);
    assert.equal(spoils[0].luck, hard ? 90 : 60);
    assert.equal(g.picks.filter((p) => p.type === 'relic').length, 1);
  }
});

test('the recruiting poster adds a fourth choice to the spoils, once', () => {
  const { g } = newGame();
  g.addItem('poster');
  assert.equal(g.spoilsOptions().length, 4);
  for (let i = 0; i < 50; i++) { const o = g.itemOption(500); assert.ok(!o || o.key !== 'poster', 'unique items are not offered twice'); }
});

test('items with trade-offs change several stats, and stack', () => {
  const { g } = newGame();
  const dmg = g.tot.dmg, aspd = g.tot.aspd;
  g.addItem('heavybolts'); g.addItem('heavybolts');
  assert.equal(g.tot.dmg, dmg + 2 * ITEMS.heavybolts.mods.dmg);
  assert.equal(g.tot.aspd, aspd + 2 * ITEMS.heavybolts.mods.aspd);
});

test('boiling oil and thorned walls hurt monsters at the walls', () => {
  for (const item of ['oil', 'thorns']) {
    const { g } = newGame();
    g.units = [];
    g.addItem(item);
    emptyWave(g);
    const e = addEnemy(g, 1, 0, -14 - 1.6, { hp: 1000, cd: 0 });
    seconds(g, 1.5);
    assert.ok(e.hp < 1000, item);
  }
});

test('the hourglass slows every monster at the start of a wave', () => {
  const walk = (item) => {
    const { g } = newGame();
    g.units = [];
    if (item) g.addItem('hourglass');
    emptyWave(g);
    const e = addEnemy(g, 0, 0, -50, { hp: 1e6 });
    seconds(g, 2);
    return 50 + e.z;
  };
  assert.ok(Math.abs(walk(true) - walk(false) * 0.6) < 0.1);
});

test('the bounty board and Midas touch add to kill gold', () => {
  const { g } = newGame();
  g.gold = 0; g.addItem('bounty');
  g.hurtEnemy(addEnemy(g, 1, 30, 30, { hp: 1 }), 5);
  assert.equal(g.gold, Math.round(ENEMIES[1].gold * 1.25));
});

test('volley: arrows fall on the chosen spot a moment later', () => {
  const { g, id } = newGame();
  g.units = [];
  emptyWave(g);
  const inside = addEnemy(g, 1, 30, 0, { hp: 1e6 }), outside = addEnemy(g, 1, 30, 15, { hp: 1e6 });
  assert.equal(g.ability(id, 'volley', 'a', 0), false);
  assert.ok(g.ability(id, 'volley', 30, 0));
  assert.equal(g.ability(id, 'volley', 30, 0), false, 'on cooldown');
  assert.equal(inside.hp, 1e6, 'not yet');
  inside.x = outside.x = 30; inside.z = 0; outside.z = 15;
  for (const e of [inside, outside]) e.cd = 99;
  g.enemies.forEach((e) => { e.speed = 0; });
  seconds(g, 1);
  assert.ok(inside.hp < 1e6);
  assert.equal(outside.hp, 1e6);
  assert.ok(g.abil.volley > 0 && g.abil.volley <= ABILITIES.volley.cd);
});

test('mend patches every wall and raises ruins; rally speeds everyone up', () => {
  const { g, id } = newGame();
  emptyWave(g);
  addEnemy(g, 0, 50, 50, { hp: 1e6 });
  g.segs[0].hp = 0; g.segs[1].hp = 10;
  assert.ok(g.ability(id, 'mend'));
  assert.equal(g.segs[0].hp, g.segs[0].max * 0.2);
  assert.equal(g.segs[1].hp, 10 + g.segs[1].max * 0.25);
  const u = g.units[0], slow = g.unitReload(u);
  assert.ok(g.ability(id, 'rally'));
  assert.ok(Math.abs(g.unitReload(u) - slow / (1 + 0.5 / (1 + g.tot.aspd / 100))) < 0.2 * slow);
  assert.ok(g.unitReload(u) < slow);
  assert.equal(g.ability(id, 'nope'), false);
});

test('abilities only work during a wave and are ready again at the start of the next', () => {
  const { g, id } = newGame();
  assert.equal(g.ability(id, 'mend'), false);
  emptyWave(g);
  addEnemy(g, 0, 50, 50, { hp: 1 });
  g.ability(id, 'mend');
  g.enemies = [];
  steps(g, 1);
  while (g.phase === 'reward') g.choose(id, 0) || g.skip(id);
  g.chooseWave(id, 0);
  assert.equal(g.abil.mend, 0);
});

// ---- New in the ages update ----

const RELICS = ITEM_KEYS.filter((k) => ITEMS[k].relic);
// A game waiting on a relic choice.
function relicPick(seed = 1) {
  const { g, id } = newGame(seed);
  g.phase = 'reward'; g.picks = [{ type: 'relic' }]; g.nextPick();
  return { g, id };
}

test('eighteen relics, six of them unlocked with renown: three are offered after a boss, never one already owned, never in the shop or the spoils', () => {
  assert.equal(RELICS.length, 18);
  assert.equal(RELICS.filter((k) => ITEMS[k].unlock > 0).length, 6);
  assert.equal(newGame(1, 1, { relics: [] }).g.relicPool.size, 12, 'a new player knows the twelve free relics');
  assert.deepEqual([...newGame(1, 1, { relics: ['seedvault', 'whetstone', 'nope'] }).g.relicPool].filter((k) => ITEMS[k].unlock), ['seedvault']);
  assert.equal(newGame().g.relicPool.size, 18, 'with nothing said every relic is known');
  assert.equal(newGame(1, 1, { relics: [], lord: 'giantslayer' }).g.relicOptions().length, 4, 'the giant-slayer is offered one more');
  const { g, id } = relicPick();
  const opts = g.picks[0].opts;
  assert.equal(opts.length, 3); assert.equal(new Set(opts.map((o) => o.key)).size, 3);
  assert.ok(opts.every((o) => ITEMS[o.key].relic));
  assert.equal(g.skip(id), false, 'a relic is not skipped'); assert.equal(g.rerollPick(id), false, 'nor rerolled');
  const key = opts[0].key;
  assert.ok(g.choose(id, 0));
  assert.equal(g.items[key], 1);
  for (let i = 0; i < 30; i++) assert.ok(g.relicOptions().every((o) => o.key !== key));
  for (const k of RELICS.slice(0, 16)) g.items[k] = 1;
  assert.equal(g.relicOptions().length, 2);
  for (const k of RELICS) g.items[k] = 1;
  g.phase = 'reward'; g.picks = [{ type: 'relic' }]; g.nextPick();
  assert.equal(g.phase, 'prep', 'with every relic owned the choice is skipped');
  const fresh = newGame(3).g;
  fresh.wave = 60; fresh.st.luck = 500; fresh.age = 3; fresh.refreshDerived();
  for (let i = 0; i < 300; i++) { const o = fresh.itemOption(500, 3); assert.ok(!ITEMS[o.key].relic); }
  for (let i = 0; i < 40; i++) { fresh.makeShop(); assert.ok(fresh.shop.every((o) => !o || o.type !== 'item' || !ITEMS[o.key].relic)); }
});

test('what the relics do', () => {
  const withRelic = (k, f) => { const { g, id } = newGame(); g.st.dmg = 0; g.st.armor = 0; if (k) g.addItem(k); return f(g, id); };
  // crown of the Queen: luck, and nothing common in the spoils
  assert.equal(withRelic('queencrown', (g) => g.tot.luck), 30);
  withRelic('queencrown', (g) => { for (let i = 0; i < 40; i++) for (const o of g.spoilsOptions()) { if (o.type === 'recruit') assert.ok(o.card.rar >= 1); if (o.type === 'item') assert.ok(ITEMS[o.key].r >= 1); } });
  // Behemoth plate, Tyrant wing, war banner, philosopher's stone, dragon egg: plain stats
  assert.deepEqual(withRelic('behemothplate', (g) => [g.tot.wallhp, g.tot.armor]), [40, 8]);
  assert.deepEqual(withRelic('tyrantwing', (g) => [g.tot.range, g.tot.aspd]), [15, 10]);
  assert.equal(withRelic('warbanner', (g) => g.tot.dmg), 25);
  assert.deepEqual(withRelic('philosopher', (g) => [g.tot.harvest, g.tot.luck]), [30, 10]);
  assert.equal(withRelic('dragonegg', (g) => g.tot.eng), 60);
  // brood heart: every kill mends the keep a little
  withRelic('broodheart', (g) => { emptyWave(g); g.th.hp = 100; const e = addEnemy(g, 0, 30, 0, { hp: 1 }); g.hurtEnemy(e, 5); assert.ok(Math.abs(g.th.hp - 100 - g.th.max * 0.0015) < 1e-9); });
  // ancient tome: experience, and five stats to choose from
  assert.equal(withRelic('ancienttome', (g) => g.levelOptions().length), 5);
  assert.equal(withRelic(null, (g) => g.levelOptions().length), 4);
  // hourglass of ages: abilities come back much sooner
  assert.ok(Math.abs(withRelic('hourglassages', (g) => g.abilityCd('volley')) - ABILITIES.volley.cd * 0.65) < 1e-9);
  // titan's hammer: crits hit three times as hard
  const crit = (k) => withRelic(k, (g) => { g.units = [g.units[0]]; g.st.crit = 100; g.refreshDerived(); emptyWave(g); const p = g.slots[g.units[0].slot]; addEnemy(g, 1, p.x, p.z + (p.z > 0 ? 4 : -4), { hp: 1e6 }); g.updateUnits(0); return g.projs[0].dmg / g.unitPower(g.units[0]); });
  assert.equal(crit(null), 2); assert.equal(crit('titanhammer'), 3);
  // king's seal: three more places on the walls
  assert.equal(withRelic('kingsseal', (g) => g.capacity()) - withRelic(null, (g) => g.capacity()), 3);
});

test('the phoenix feather saves the castle once', () => {
  const { g } = newGame();
  g.addItem('phoenix');
  emptyWave(g);
  const outside = addEnemy(g, 1, 60, 60, { hp: 1e9 }), inside = addEnemy(g, 1, 5, 5, { hp: 1e9 }), boss = addEnemy(g, 2, -6, 6, { hp: 1000 });
  g.segs[0].hp = 0;
  g.th.hp = 0;
  steps(g, 1);
  assert.equal(g.phase, 'wave', 'the run goes on');
  assert.ok(!g.enemies.includes(inside), 'the fire sweeps the courtyard');
  assert.equal(outside.hp, 1e9); assert.equal(boss.hp, 850, 'a boss is only singed');
  assert.equal(g.th.hp, g.th.max * 0.5); assert.equal(g.segs[0].hp, g.segs[0].max * 0.5, 'ruined walls stand again');
  assert.ok(g.fx.some((f) => f[0] === 33));
  g.th.hp = 0;
  steps(g, 1);
  assert.equal(g.phase, 'over', 'but only once');
});

test('an event comes after every fourth wave and is never the same twice in a row', () => {
  assert.equal(EVENTS.length, 10);
  const { g, id } = newGame(8);
  const seen = new Set();
  let last = null;
  for (let i = 0; i < 200; i++) {
    g.phase = 'reward'; g.picks = [{ type: 'event' }]; g.nextPick();
    const p = g.picks[0];
    assert.ok(EVENTS.includes(p.ev)); assert.notEqual(p.ev, last);
    assert.ok(p.opts.length >= 2 && p.opts.length <= 3);
    assert.equal(g.pickView().ev, p.ev);
    assert.equal(g.skip(id), false); assert.equal(g.rerollPick(id), false);
    last = p.ev; seen.add(p.ev);
    g.picks = [];
  }
  assert.equal(seen.size, EVENTS.length, 'every event turns up');
});

test('every event has a way out that costs nothing, so no run can get stuck on one', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const { g, id } = newGame(seed);
    g.gold = 0; g.b.walls = 1;
    while (g.army().length < g.capacity()) g.units.push(g.newUnit(card('archer'), g.freeSlot('archer')));
    g.phase = 'reward'; g.picks = [{ type: 'event' }]; g.nextPick();
    const ev = g.picks[0].ev, n = g.picks[0].opts.length;
    let ok = false;
    for (let i = n - 1; i >= 0 && !ok; i--) ok = g.choose(id, i);
    assert.ok(ok, `${ev} with no gold and full walls`);
    assert.equal(g.phase, 'prep');
  }
});

test('what the events do', () => {
  // Runs the named event in a fresh game and returns it, waiting on the choice.
  const event = (ev, setup = () => {}) => {
    for (let seed = 1; seed < 400; seed++) {
      const { g, id } = newGame(seed);
      g.gold = 1000; setup(g);
      g.phase = 'reward'; g.picks = [{ type: 'event' }]; g.nextPick();
      if (g.picks[0].ev === ev) return { g, id, opts: g.picks[0].opts };
    }
    throw new Error(`no seed gives ${ev}`);
  };
  const by = (opts, k) => opts.findIndex((o) => o.k === k);
  { // caravan: a good item at half price, or a toll
    const { g, id, opts } = event('caravan', (x) => { x.age = 2; });
    const o = opts[by(opts, 'buy')];
    assert.ok(ITEMS[o.item].r >= 2); assert.equal(o.gold, Math.round(g.priceOf({ type: 'item', key: o.item }) * 0.5));
    assert.ok(g.choose(id, by(opts, 'buy'))); assert.equal(g.items[o.item], 1); assert.equal(g.gold, 1000 - o.gold);
    const t = event('caravan'); t.g.choose(t.id, by(t.opts, 'toll')); assert.equal(t.g.gold, 1000 + Math.round(30 * goldMul(1)));
  }
  { // deserters: a rare recruit for free, or experience
    const { g, id, opts } = event('deserters');
    const n = g.units.length;
    assert.ok(opts[0].card.rar >= 1);
    assert.ok(g.choose(id, 0)); assert.equal(g.units.length, n + 1);
    const t = event('deserters'); t.g.choose(t.id, 1); assert.ok(t.g.xp > 0 || t.g.level > 1);
  }
  { // plague: pay the healers or lose some of the keep
    const { g, id, opts } = event('plague');
    g.choose(id, by(opts, 'endure')); assert.equal(g.th.hp, g.th.max - Math.round(g.th.max * 0.15));
    const t = event('plague'); t.g.choose(t.id, by(t.opts, 'pay')); assert.equal(t.g.th.hp, t.g.th.max); assert.equal(t.g.gold, 1000 - Math.round(25 * goldMul(1)));
  }
  { // smith: three levels for one defender, or one for all
    const { g, id, opts } = event('smith');
    const o = opts[by(opts, 'hone')], u = g.unit(o.uid);
    g.choose(id, by(opts, 'hone')); assert.equal(u.lv, 4);
    const t = event('smith'); t.g.choose(t.id, by(t.opts, 'drill')); assert.ok(t.g.units.every((x) => x.lv === 2));
    const p = event('smith'); p.g.choose(p.id, by(p.opts, 'pass')); assert.equal(p.g.gold, 1000);
  }
  { // shrine: buy a rare stat, or pray for a blessing
    const { g, id, opts } = event('shrine');
    const o = opts[by(opts, 'offer')], before = g.st[o.stat];
    assert.ok(o.r >= 1);
    g.choose(id, by(opts, 'offer')); assert.equal(g.st[o.stat], before + STATS[o.stat][o.r]);
    let blessed = 0;
    for (let i = 0; i < 40; i++) { const t = event('shrine', (x) => { for (let j = 0; j < i; j++) x.rng(); }); t.g.choose(t.id, by(t.opts, 'pray')); if (Object.values(t.g.bless).some((v) => v > 0)) blessed++; assert.equal(t.g.gold, 1000); }
    assert.ok(blessed > 8 && blessed < 32, `${blessed} of 40 prayers were heard`);
  }
  { // gambler: half the gold, doubled or gone
    const res = new Set();
    for (let i = 0; i < 30; i++) { const t = event('gambler', (x) => { for (let j = 0; j < i; j++) x.rng(); }); assert.equal(t.opts[0].gold, 500); t.g.choose(t.id, 0); res.add(t.g.gold); }
    assert.deepEqual([...res].sort((a, b) => a - b), [500, 1500]);
  }
  { // refugees: one more place on the walls (four at most), or their coin
    const { g, id, opts } = event('refugees');
    const cap = g.capacity();
    g.choose(id, by(opts, 'shelter')); assert.equal(g.capacity(), cap + 1);
    g.capBonus = 4; g.applyEvent({ k: 'shelter' }); assert.equal(g.capBonus, 4);
  }
  { // egg: it hatches into a legendary item five waves later
    const { g, id, opts } = event('egg');
    g.choose(id, by(opts, 'keep')); assert.equal(g.eggAt, g.wave + 5);
    const items = Object.keys(g.items).length;
    g.wave = g.eggAt - 1; g.makeWaveOffers(); g.chooseWave(id, 0); g.queue = []; g.enemies = [];
    steps(g, 1);
    const got = Object.keys(g.items).filter((k) => ITEMS[k].r === 3);
    assert.equal(Object.keys(g.items).length, items + 1); assert.equal(got.length, 1); assert.equal(g.eggAt, 0);
    assert.ok(g.fx.some((f) => f[0] === 32 && f[3] === got[0]));
    for (let i = 0; i < 60; i++) { g.phase = 'reward'; g.picks = [{ type: 'event' }]; g.eggAt = 5; g.nextPick(); assert.notEqual(g.picks[0].ev, 'egg', 'one egg at a time'); }
  }
  { // mercenaries: two sellswords for the next wave
    const { g, id, opts } = event('mercs');
    g.choose(id, by(opts, 'hire')); assert.equal(g.units.filter((u) => u.temp).length, 2);
  }
  { // festival: a level for everyone, or a little luck for free
    const { g, id, opts } = event('festival');
    g.choose(id, by(opts, 'feast')); assert.ok(g.units.every((u) => u.lv === 2));
    const t = event('festival'); t.g.choose(t.id, by(t.opts, 'modest')); assert.equal(t.g.st.luck, 8); assert.equal(t.g.gold, 1000);
  }
});

test('an event the commander cannot pay for is refused, and the choice stays open', () => {
  const { g, id } = newGame();
  g.gold = 5; g.phase = 'reward';
  g.picks = [{ type: 'event', ev: 'festival', opts: [{ k: 'feast', gold: 40 }, { k: 'modest' }] }];
  assert.equal(g.choose(id, 0), false);
  assert.equal(g.phase, 'reward'); assert.equal(g.gold, 5);
  assert.ok(g.choose(id, 1));
});

test('nine abilities; a commander takes three into a run', () => {
  assert.equal(ABILITY_KEYS.length, 9);
  assert.deepEqual(newGame().g.loadout, DEFAULT_ABILITIES);
  assert.deepEqual(newGame(1, 1, { abilities: ['meteor', 'freeze', 'bountyhunt'] }).g.loadout, ['meteor', 'freeze', 'bountyhunt']);
  for (const bad of [['meteor', 'freeze'], ['meteor', 'meteor', 'freeze'], ['meteor', 'freeze', 'nope'], 'volley', null]) assert.deepEqual(newGame(1, 1, { abilities: bad }).g.loadout, DEFAULT_ABILITIES);
  const { g, id } = newGame(1, 1, { abilities: ['meteor', 'freeze', 'bountyhunt'] });
  emptyWave(g);
  addEnemy(g, 1, 60, 60, { hp: 1e9 });
  assert.equal(g.ability(id, 'volley', 0, 0), false, 'not in this loadout');
  assert.deepEqual(g.snapshot().ab.map((a) => a[0]), ['meteor', 'freeze', 'bountyhunt']);
});

test('meteor: three volleys in one, on a wider spot, a little later', () => {
  const { g, id } = newGame(1, 1, { abilities: ['meteor', 'volley', 'mend'] });
  g.units = []; g.st.dmg = 0; g.refreshDerived();
  emptyWave(g);
  const a = addEnemy(g, 1, 30, 0, { hp: 1e6 }), b = addEnemy(g, 1, 30 + 6.5, 0, { hp: 1e6 }), c = addEnemy(g, 1, -30, 0, { hp: 1e6 });
  assert.ok(g.ability(id, 'meteor', 30, 0)); assert.ok(g.ability(id, 'volley', -30, 0));
  seconds(g, 1);
  assert.equal(a.hp, 1e6, 'the meteor is still falling'); assert.ok(c.hp < 1e6, 'the arrows have landed');
  seconds(g, 0.6);
  assert.ok(Math.abs((1e6 - a.hp) - 3 * (1e6 - c.hp)) < 1e-6);
  assert.equal(b.hp, a.hp, 'a radius of seven');
  assert.equal(g.abil.meteor > ABILITIES.volley.cd, true);
});

test('freeze slows every monster; a bounty hunt doubles gold and experience', () => {
  const walk = (frozen) => {
    const { g, id } = newGame(1, 1, { abilities: ['freeze', 'bountyhunt', 'mend'] });
    g.units = []; emptyWave(g);
    const e = addEnemy(g, 1, 0, -45, { hp: 1e6 });
    if (frozen) assert.ok(g.ability(id, 'freeze'));
    seconds(g, 1);
    return 45 + e.z;
  };
  assert.ok(Math.abs(walk(true) / walk(false) - 0.3) < 0.02);
  const kill = (hunt) => {
    const { g, id } = newGame(1, 1, { abilities: ['freeze', 'bountyhunt', 'mend'] });
    g.units = []; emptyWave(g);
    addEnemy(g, 1, 60, 60, { hp: 1e9 });
    if (hunt) { assert.ok(g.ability(id, 'bountyhunt')); assert.ok(g.snapshot().bty > 0); }
    const gold = g.gold, e = addEnemy(g, 1, 30, 0, { hp: 1 });
    g.hurtEnemy(e, 5);
    return [g.gold - gold, g.xp];
  };
  const [gold, xp] = kill(false), [gold2, xp2] = kill(true);
  assert.equal(gold2, gold * 2); assert.equal(xp2, xp * 2);
  const { g, id } = newGame(1, 1, { abilities: ['freeze', 'bountyhunt', 'mend'] });
  emptyWave(g); addEnemy(g, 1, 60, 60, { hp: 1e9 });
  g.ability(id, 'bountyhunt');
  seconds(g, ABILITIES.bountyhunt.t + 0.2);
  assert.equal(g.bountyT, 0);
});

test('only unlocked items are offered', () => {
  const pool = ['whetstone', 'fletching', 'mortar'].filter((k) => ITEMS[k]);
  const some = pool.length ? pool : ITEM_KEYS.filter((k) => !ITEMS[k].relic).slice(0, 3);
  const { g } = newGame(2, 1, { items: some });
  g.wave = 30; g.st.luck = 200; g.refreshDerived();
  for (let i = 0; i < 200; i++) { const o = g.itemOption(100); if (o) assert.ok(some.includes(o.key), o.key); }
  assert.ok(ITEM_KEYS.filter((k) => ITEMS[k].unlock > 0).length >= 8, 'some items have to be unlocked first');
  assert.equal(ITEM_KEYS.length, 64);
});
