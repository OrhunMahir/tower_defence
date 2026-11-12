// Defenders: recruits, placement, training, experience, families and how each class fights.
import test from 'node:test';
import assert from 'node:assert/strict';
import { S, UNITS, UNIT_KEYS, FAMILIES, CAPACITY, RARITY, TRAITS, xpNeed, recruitLevel, wallMul, thMax } from '../server/game.js';
import { newGame, steps, seconds, emptyWave, addEnemy, card } from './bots.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} is not within ${eps} of ${b}`);
// A game whose only defender is one unit of the given class on the south wall, x = 8.
function lone(k, setup = () => {}, extra = {}) {
  const { g, id } = newGame();
  g.st.dmg = 0; g.st.armor = 0;
  const slot = g.slots.findIndex((s) => s.x === 8 && s.z === S);
  g.units = [g.newUnit(card(k, extra), slot)];
  setup(g);
  g.refreshDerived();
  emptyWave(g);
  return { g, id, u: g.units[0], post: g.slots[slot], seg: g.segs[g.slots[slot].seg] };
}
// Hires a defender of class k through a spoils choice.
function recruit(g, id, k, extra) {
  g.phase = 'reward';
  g.picks = [{ type: 'spoils', opts: [{ type: 'recruit', card: card(k, extra) }] }];
  return g.choose(id, 0);
}

test('fifteen classes in five families of three', () => {
  assert.equal(UNIT_KEYS.length, 15);
  for (const f of FAMILIES) assert.equal(UNIT_KEYS.filter((k) => UNITS[k].fam === f).length, 3, f);
});

test('recruits come with a class, rarity, name, rolled stats and traits', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const { g } = newGame(seed);
    for (let i = 0; i < 20; i++) {
      const c = g.makeCard();
      assert.ok(UNIT_KEYS.includes(c.k) && c.rar >= 0 && c.rar < RARITY.length && c.name);
      assert.ok(c.traits.every((t) => TRAITS.includes(t)));
      assert.equal(c.traits.length, [0, 1, 1, 2][c.rar], 'rarer recruits have traits');
      const base = UNITS[c.k].p * RARITY[c.rar].mul;
      assert.ok(c.p <= base * 1.12 + 0.01 && c.p >= base * 0.88 - 0.01);
    }
  }
});

test('later waves bring higher-level recruits; luck brings rarer ones', () => {
  const { g } = newGame(5);
  g.wave = 40;
  assert.ok(g.makeCard().lv >= recruitLevel(41));
  const avg = (luck) => { const { g: h } = newGame(6); h.wave = 15; h.st.luck = luck; h.refreshDerived(); let s = 0; for (let i = 0; i < 800; i++) s += h.rollRarity(); return s / 800; };
  assert.ok(avg(100) > avg(0) + 0.2);
});

test('half of the recruits come from families already on the walls', () => {
  const { g } = newGame(8);
  g.units = g.units.filter((u) => u.k === 'archer');
  let kin = 0;
  for (let i = 0; i < 600; i++) if (UNITS[g.makeCard().k].fam === 'marksmen') kin++;
  assert.ok(kin > 600 * (0.5 + 0.5 / 5) * 0.85, `${kin} of 600 are marksmen`);
});

test('the walls hold a limited number of defenders; taller walls hold more', () => {
  const { g, id } = newGame();
  while (g.units.length < CAPACITY[1]) assert.ok(recruit(g, id, 'archer'));
  assert.equal(recruit(g, id, 'archer'), false, 'full');
  g.b.hall = 10; g.b.walls = 10;
  while (recruit(g, id, 'mage'));
  assert.equal(g.units.length, CAPACITY[10]);
  assert.equal(new Set(g.units.map((u) => u.slot)).size, g.units.length, 'one defender per slot');
});

test('new defenders spread out over all four walls; spearmen and shieldbearers never stand in towers', () => {
  const { g, id } = newGame();
  g.units = [];
  for (let i = 0; i < 4; i++) recruit(g, id, 'archer');
  let closest = Infinity;
  for (const a of g.units) for (const b of g.units) if (a !== b) closest = Math.min(closest, Math.hypot(g.slots[a.slot].x - g.slots[b.slot].x, g.slots[a.slot].z - g.slots[b.slot].z));
  assert.ok(closest >= 2 * S - 0.1, `the first four stand in the four corners (${closest})`);
  for (let i = 0; i < 8; i++) { recruit(g, id, 'spear'); recruit(g, id, 'shield'); }
  assert.ok(g.units.filter((u) => u.k === 'spear' || u.k === 'shield').every((u) => g.slots[u.slot].seg >= 0));
});

test('training raises one defender a level and costs more each time', () => {
  const { g, id } = newGame();
  g.gold = 1e5;
  const u = g.units[0], c1 = g.trainCost(u);
  assert.ok(g.train(id, u.uid));
  assert.equal(u.lv, 2); assert.equal(g.gold, 1e5 - c1);
  assert.ok(g.trainCost(u) > c1);
  assert.equal(g.units[1].lv, 1, 'the others are untouched');
  assert.equal(g.train(id, 12345), false, 'unknown defender');
  assert.equal(g.train(id, '1'), false);
  g.gold = 0;
  assert.equal(g.train(id, u.uid), false, 'no gold');
});

test('dismissing a defender pays a little and frees the place; the last one stays', () => {
  const { g, id } = newGame();
  g.gold = 0;
  const u = g.units[0];
  assert.ok(g.dismiss(id, u.uid));
  assert.equal(g.gold, g.refund(u));
  assert.ok(!g.units.includes(u));
  assert.equal(g.dismiss(id, u.uid), false);
  while (g.units.length > 1) g.dismiss(id, g.units[0].uid);
  assert.equal(g.dismiss(id, g.units[0].uid), false, 'the castle needs someone');
});

test('kills give experience and defenders level up on their own', () => {
  const { g, u } = lone('archer');
  g.wave = 1;
  for (let i = 0; i < 8; i++) g.hurtEnemy(addEnemy(g, 1, 30, 30, { hp: 1 }), 5, u);
  assert.equal(u.kills, 8);
  assert.ok(u.lv >= 2, `level ${u.lv}`);
  assert.ok(u.xp < xpNeed(u.lv));
  assert.ok(g.snapshot().fx.some((f) => f[0] === 9), 'level-up effect');
});

test('scholars and the experience stat learn faster', () => {
  const xp = (traits, stat = 0) => { const { g, u } = lone('archer', (h) => { h.st.xp = stat; }, { traits }); g.giveXp(u, 4); return u.xp; };
  near(xp([]), 4); near(xp(['scholar']), 7); near(xp([], 50), 6);
});

test('an archer shoots the nearest monster in range and holds fire otherwise', () => {
  const { g, post } = lone('archer');
  const nearE = addEnemy(g, 0, post.x, post.z + 10, { hp: 500 }), farE = addEnemy(g, 0, post.x + 12, post.z + 12, { hp: 500 });
  const out = addEnemy(g, 0, post.x, post.z + 40, { hp: 500 });
  steps(g, 1);
  assert.equal(g.projs.length, 1);
  seconds(g, 0.6);
  assert.equal(nearE.hp, 500 - UNITS.archer.p);
  assert.equal(farE.hp, 500); assert.equal(out.hp, 500);
});

test('nobody shoots at monsters out of range; eagle eyes and the range stat see further', () => {
  const shots = (setup, extra) => { const { g, post } = lone('archer', setup, extra); addEnemy(g, 0, post.x, post.z + 22, { hp: 500 }); steps(g, 1); return g.projs.length; };
  assert.equal(shots(() => {}), 0);
  assert.equal(shots(() => {}, { traits: ['eagle'] }), 1);
  assert.equal(shots((g) => { g.st.range = 20; }), 1);
});

test('a crossbow goes for the toughest monster and pierces armour', () => {
  const { g, post } = lone('crossbow');
  const runner = addEnemy(g, 0, post.x, post.z + 6, { hp: 30 }), shell = addEnemy(g, 6, post.x + 3, post.z + 18, { hp: 400 });
  seconds(g, 1);
  assert.equal(shell.hp, 400 - UNITS.crossbow.p);
  assert.equal(runner.hp, 30);
});

test('a ranger shoots flyers first', () => {
  const { g, post } = lone('ranger');
  const ground = addEnemy(g, 0, post.x - 3, post.z + 5, { hp: 500 }), flyer = addEnemy(g, 4, post.x + 12, post.z + 14, { hp: 500 });
  seconds(g, 1);
  assert.ok(flyer.hp < 500); assert.equal(ground.hp, 500);
});

test('a mage orb explodes and hurts the whole group', () => {
  const { g, post } = lone('mage');
  const a = addEnemy(g, 1, post.x, post.z + 10, { hp: 500 }), b = addEnemy(g, 1, post.x + 2, post.z + 10.5, { hp: 500 }), c = addEnemy(g, 1, post.x - 9, post.z + 10, { hp: 500 });
  seconds(g, 1);
  assert.equal(a.hp, 500 - UNITS.mage.p); assert.equal(b.hp, 500 - UNITS.mage.p); assert.equal(c.hp, 500);
});

test('a frost mage slows the group it hits', () => {
  const { g, post } = lone('frost');
  const a = addEnemy(g, 1, post.x, post.z + 10, { hp: 500 }), b = addEnemy(g, 1, post.x + 1.5, post.z + 10, { hp: 500 });
  seconds(g, 1);
  assert.ok(a.slow > 0 && b.slow > 0);
  assert.equal(a.slowK, UNITS.frost.slow);
  assert.ok(g.snapshot().en.some((e) => e[5] & 1), 'the client sees who is slowed');
});

test('a stormcaller chains lightning across a line of monsters', () => {
  const { g, post } = lone('storm');
  const line = [0, 1, 2, 3, 4].map((i) => addEnemy(g, 1, post.x, post.z + 8 + i * 3, { hp: 500 }));
  steps(g, 1);
  assert.equal(line[0].hp, 500 - UNITS.storm.p);
  near(line[1].hp, 500 - UNITS.storm.p * 0.8);
  assert.ok(line.every((e) => e.hp < 500), 'four jumps reach all five');
});

test('a pyromancer sets monsters burning', () => {
  const { g, post } = lone('pyro');
  const e = addEnemy(g, 1, post.x, post.z + 8, { hp: 500 });
  seconds(g, 0.7);
  assert.ok(e.burn > 0);
  const hp = e.hp;
  for (const u of g.units) u.cd = 99;
  seconds(g, 1);
  assert.ok(e.hp < hp, 'it keeps burning');
  assert.ok(g.snapshot().en[0][5] & 2);
});

test('an alchemist leaves a poison cloud that ignores armour and spares flyers', () => {
  const { g, post } = lone('alchemist');
  const shell = addEnemy(g, 6, post.x, post.z + 8, { hp: 500 }), fly = addEnemy(g, 4, post.x + 0.5, post.z + 8, { hp: 500 });
  seconds(g, 1);
  assert.equal(g.clouds.length, 1);
  for (const u of g.units) u.cd = 99;
  const hp = shell.hp;
  seconds(g, 1);
  near(hp - shell.hp, UNITS.alchemist.poison, 0.01);
  assert.equal(fly.hp, 500);
});

test('a bombardier blasts a wide area', () => {
  const { g, post } = lone('bomber');
  const a = addEnemy(g, 1, post.x, post.z + 8, { hp: 500 }), b = addEnemy(g, 1, post.x + 3, post.z + 8, { hp: 500 });
  seconds(g, 1);
  assert.equal(a.hp, 500 - UNITS.bomber.p); assert.equal(b.hp, 500 - UNITS.bomber.p);
});

test('a spearman stabs only what is at the foot of his wall', () => {
  const { g, post } = lone('spear');
  const close = addEnemy(g, 1, post.x, post.z + 2, { hp: 500 }), away = addEnemy(g, 1, post.x, post.z + 8, { hp: 500 });
  steps(g, 1);
  assert.equal(close.hp, 500 - UNITS.spear.p, 'hit at once, no projectile');
  assert.equal(away.hp, 500); assert.equal(g.projs.length, 0);
});

test('a cleric mends the most damaged wall in reach during battle', () => {
  const { g, post, seg } = lone('cleric');
  const other = g.segs.find((s) => s !== seg && Math.hypot(s.x - post.x, s.z - post.z) < 6);
  const far = g.segs.find((s) => Math.hypot(s.x - post.x, s.z - post.z) > 20);
  addEnemy(g, 0, 50, 50, { hp: 1e6 });
  seg.hp -= 100; other.hp -= 200; far.hp -= 300;
  steps(g, 1);
  assert.equal(other.hp, other.max - 200 + UNITS.cleric.p * wallMul(1));
  assert.equal(seg.hp, seg.max - 100); assert.equal(far.hp, far.max - 300);
});

test('a priest heals the keep while monsters are about', () => {
  const { g } = lone('priest');
  addEnemy(g, 0, 50, 50, { hp: 1e6 });
  g.th.hp = 1000;
  steps(g, 1);
  assert.equal(g.th.hp, 1000 + UNITS.priest.p);
  assert.ok(g.th.hp <= thMax(1));
});

test('a bard makes nearby defenders attack faster', () => {
  const reload = (withBard) => {
    const { g, post } = lone('crossbow', (h) => {
      if (withBard) h.units.push(h.newUnit(card('bard'), h.slots.findIndex((s) => s.x === 4 && s.z === S)));
    });
    addEnemy(g, 1, post.x, post.z + 10, { hp: 1e6 });
    steps(g, 1);
    return g.units[0].cd;
  };
  const plain = reload(false), sung = reload(true);
  assert.ok(sung < plain * 0.95, `${sung} vs ${plain}`);
});

test('a shieldbearer guards his wall and, less so, its neighbours', () => {
  const hurt = (dx) => {
    const { g, post } = lone('shield');
    const seg = g.segs.find((s) => s.z === S && s.x === post.x + dx);
    addEnemy(g, 1, seg.x, S + 1.6, { hp: 1e6, cd: 0 });
    steps(g, 1);
    return seg.max - seg.hp;
  };
  const full = 16 * 2.5;
  near(hurt(0), full * (1 - UNITS.shield.p));
  near(hurt(4), full * (1 - UNITS.shield.p / 2));
  near(hurt(-12), full);
});

test('a hexer curses the toughest monster: everyone hurts it more', () => {
  const { g, post } = lone('hexer');
  const big = addEnemy(g, 1, post.x, post.z + 10, { hp: 900 }), small = addEnemy(g, 0, post.x + 2, post.z + 8, { hp: 30 });
  steps(g, 1);
  assert.ok(big.curse > 0); assert.equal(small.curse, 0);
  g.hurtEnemy(big, 100);
  assert.equal(big.hp, 900 - 100 * (1 + UNITS.hexer.p));
});

test('a defender is out of action while his wall segment is down', () => {
  const { g, post, seg } = lone('archer');
  addEnemy(g, 0, post.x, post.z + 30, { hp: 500 });
  seg.hp = 0;
  seconds(g, 2);
  assert.equal(g.projs.length, 0);
  seg.hp = 50;
  for (const e of g.enemies) { e.x = post.x; e.z = post.z + 12; }
  steps(g, 1);
  assert.equal(g.projs.length, 1, 'back in action once the wall stands again');
});

test('the damage stat, levels, blessings and the elemental stat multiply damage', () => {
  const dmg = (k, setup, extra) => { const { g, post } = lone(k, setup, extra); addEnemy(g, 1, post.x, post.z + (k === 'spear' ? 2 : 10), { hp: 9999 }); g.units[0].traits = []; for (let i = 0; i < 40 && !g.projs.length && g.enemies[0].hp === 9999; i++) steps(g, 1); return k === 'spear' ? 9999 - g.enemies[0].hp : g.projs[0].dmg; };
  const crit = (g) => { g.st.crit = -1000; };
  near(dmg('archer', (g) => { crit(g); g.st.dmg = 40; }), UNITS.archer.p * 1.4);
  near(dmg('archer', crit, { lv: 3 }), UNITS.archer.p * 1.24);
  near(dmg('archer', (g) => { crit(g); g.bless.archer = 2; }), UNITS.archer.p * 1.4);
  near(dmg('archer', (g) => { crit(g); g.st.elem = 50; }), UNITS.archer.p, 1e-6);
  near(dmg('mage', (g) => { crit(g); g.st.elem = 50; }), UNITS.mage.p * 1.5);
  near(dmg('spear', (g) => { crit(g); g.st.dmg = 20; }, { lv: 2 }), UNITS.spear.p * 1.2 * 1.12);
});

test('crits hit for double damage', () => {
  const { g, post } = lone('archer', (h) => { h.st.crit = 100; });
  addEnemy(g, 1, post.x, post.z + 10, { hp: 1e9 });
  steps(g, 1);
  assert.equal(g.projs[0].dmg, UNITS.archer.p * 2);
});

test('the attack speed stat shortens every reload', () => {
  const reload = (setup, extra) => { const { g, post } = lone('crossbow', setup, extra); addEnemy(g, 1, post.x, post.z + 10, { hp: 9999 }); steps(g, 1); return g.units[0].cd; };
  const base = reload(() => {}), quick = reload((g) => { g.st.aspd = 100; }), hands = reload(() => {}, { traits: ['quick'] });
  assert.ok(base >= UNITS.crossbow.cd * 0.9 - 0.06 && base <= UNITS.crossbow.cd * 1.1);
  assert.ok(quick <= (UNITS.crossbow.cd / 2) * 1.1);
  assert.ok(hands <= (UNITS.crossbow.cd / 1.25) * 1.1);
});

test('family bonuses: two, four and six of a family raise its tier', () => {
  const { g, id } = newGame();
  g.units = []; g.st.armor = 0;
  g.b.hall = 5; g.b.walls = 5;
  const tiers = [];
  for (let i = 0; i < 6; i++) { recruit(g, id, ['archer', 'crossbow', 'ranger'][i % 3]); tiers.push(g.famTier.marksmen); }
  assert.deepEqual(tiers, [0, 1, 1, 2, 2, 3]);
  const archer = g.units[0];
  near(g.unitRange(archer), archer.range * 1.3);
  near(g.unitCrit(archer), 0.15);
  g.addItem('wardenflag'); g.addItem('wardenflag');
  assert.equal(g.famTier.wardens, 1, 'a banner counts as one more of the family');
  near(g.guardMul(), 1 - 0.08);
});
