// The horde's mutations (one after every boss, chosen by the commander) and its adaptation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TICK, S, ENEMIES, BOSSES, MUTATIONS, MUTATION_KEYS, MUT_MAX, BOONS, ADAPT, FAMILIES, ITEMS, STATS, STAT_KEYS, RARITY,
  hpMul, dmgMul, bossHpMul, goldMul, budget,
} from '../server/game.js';
import { newGame, steps, seconds, emptyWave, addEnemy, place, card, takeRewards } from './bots.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} is not within ${eps} of ${b}`);
const out = (g, slot, d) => { const p = g.slots[slot]; return Math.abs(p.z) === S ? [p.x, p.z + Math.sign(p.z) * d] : [p.x + Math.sign(p.x) * d, p.z]; };
// A battle on wave `wave` with the given mutations and nobody on the walls.
function battle(muts = {}, { wave = 9, opts = {}, pick = (w) => !w.hard } = {}) {
  const { g, id } = newGame(1, 1, opts);
  g.muts = { ...muts };
  g.jump(wave);
  g.forecast[0] = 'clear'; g.makeWaveOffers();
  g.chooseWave(id, g.waves.findIndex(pick));
  const queue = g.queue;
  g.queue = []; g.enemies = [];
  g.units = []; g.refreshDerived();
  return { g, id, queue };
}
const points = (w) => w.c.reduce((a, n, t) => a + (ENEMIES[t].boss ? 0 : n * ENEMIES[t].points), 0);

test('twenty-four mutations: six from the legacy of each boss, each with three levels', () => {
  assert.equal(MUTATION_KEYS.length, 24); assert.equal(MUT_MAX, 3);
  for (let b = 0; b < BOSSES.length; b++) assert.equal(MUTATION_KEYS.filter((k) => MUTATIONS[k].from === b).length, 6, ENEMIES[BOSSES[b]].key);
  for (const k of MUTATION_KEYS) assert.ok([1, 2].includes(MUTATIONS[k].sev), k);
  assert.equal(MUTATION_KEYS.filter((k) => MUTATIONS[k].boss).length, 6, 'six of them change the bosses');
  assert.deepEqual(BOONS, ['gold', 'level', 'item', 'stat', 'promote', 'relic']);
});

test('after every boss the commander has to accept one of three mutations, each with a boon', () => {
  const { g, id } = newGame(4);
  g.jump(8);
  g.chooseWave(id, g.waves.findIndex((w) => !w.hard)); g.queue = []; g.enemies = [];
  steps(g, 1);
  while (g.picks[0].type !== 'mutation') assert.ok(g.choose(id, 0));
  const p = g.picks[0];
  assert.equal(p.boss, 0, 'the Queen has fallen');
  assert.equal(p.opts.length, 3); assert.equal(new Set(p.opts.map((o) => o.key)).size, 3);
  assert.equal(p.opts.filter((o) => MUTATIONS[o.key].from === 0).length, 2, 'two from her legacy');
  assert.equal(p.opts.filter((o) => MUTATIONS[o.key].from !== 0).length, 1, 'and one from another boss');
  for (const o of p.opts) { assert.equal(o.lv, 1); assert.ok(BOONS.includes(o.boon.k)); }
  assert.equal(g.skip(id), false, 'a mutation cannot be skipped'); assert.equal(g.rerollPick(id), false, 'nor rerolled');
  const view = g.pickView();
  assert.equal(view.type, 'mutation'); assert.equal(view.boss, 0); assert.equal(view.rr, -1); assert.equal(view.skip, 0); assert.equal(view.pass, false);
  const key = p.opts[1].key;
  assert.ok(g.choose(id, 1));
  assert.deepEqual(g.muts, { [key]: 1 });
  assert.deepEqual(g.snapshot().mu, { [key]: 1 });
  // A mutation at its top level is not offered again; when few are left the choice shrinks.
  const full = newGame(5).g;
  for (const k of MUTATION_KEYS) full.muts[k] = MUT_MAX;
  assert.deepEqual(full.mutationOptions({ boss: 1 }), []);
  full.muts.hide = 1; full.muts.frenzy = 2;
  assert.deepEqual(full.mutationOptions({ boss: 1 }).map((o) => [o.key, o.lv]).sort(), [['frenzy', 3], ['hide', 2]]);
  full.phase = 'reward'; full.muts.hide = 3; full.muts.frenzy = 3; full.picks = [{ type: 'mutation', boss: 2 }]; full.nextPick();
  assert.equal(full.phase, 'prep', 'with every mutation at its top the choice is skipped');
});

test('the boons: gold, castle levels, an item, a stat, a promotion or one more relic; harsher mutations pay double', () => {
  const { g } = newGame(2);
  g.jump(17);
  const seen = new Set();
  for (let i = 0; i < 300; i++) {
    for (const sev of [1, 2]) {
      const b = g.rollBoon(sev);
      seen.add(b.k);
      if (b.k === 'gold') assert.equal(b.v, Math.round(60 * goldMul(17) * sev));
      if (b.k === 'level' || b.k === 'promote') assert.equal(b.v, sev);
      if (b.k === 'item') assert.equal(ITEMS[b.key].r, 1 + sev);
      if (b.k === 'stat') { assert.ok(STAT_KEYS.includes(b.stat)); assert.equal(b.r, 1 + sev); }
      if (b.k === 'relic') assert.equal(sev, 2, 'only the harsher ones bring a relic');
    }
  }
  assert.deepEqual([...seen].sort(), [...BOONS].sort());
  const gold = g.gold, level = g.level;
  g.applyBoon({ k: 'gold', v: 100 }); assert.equal(g.gold, gold + 100);
  g.applyBoon({ k: 'level', v: 2 }); assert.equal(g.level, level + 2); assert.equal(g.picks.filter((p) => p.type === 'level').length, 2);
  g.applyBoon({ k: 'item', key: 'whetstone' }); assert.equal(g.items.whetstone, 1);
  const dmg = g.st.dmg; g.applyBoon({ k: 'stat', stat: 'dmg', r: 3 }); assert.equal(g.st.dmg, dmg + STATS.dmg[3]);
  g.units[1].kills = 50; const p = g.units[1].p;
  g.applyBoon({ k: 'promote', v: 1 }); assert.equal(g.units[1].rar, 1); near(g.units[1].p, p * RARITY[1].mul, 0.01);
  g.applyBoon({ k: 'relic' }); assert.equal(g.picks.at(-1).type, 'relic');
});

test('the Queen\'s legacy: a larger horde, a death cry, frenzy, champions, a royal guard and ancient power', () => {
  const offers = (muts, wave = 12) => { const { g } = newGame(3); g.muts = muts; g.jump(wave); g.forecast[0] = 'clear'; g.makeWaveOffers(); return g.waves; };
  // A wave too large for the field comes as fewer, tougher elites, so its size is its points times their strength.
  const size = (muts) => offers(muts).reduce((a, w) => a + points(w) * w.hx, 0);
  assert.ok(size({ swell: 3 }) / size({}) > 1.22 && size({ swell: 3 }) / size({}) < 1.38);
  // Death cry: a dying monster hastens those within five paces.
  { const { g } = battle({ warcry: 2 }); const a = addEnemy(g, 0, 30, 0, { hp: 10 }), b = addEnemy(g, 0, 33, 0), c = addEnemy(g, 0, 40, 0); g.hurtEnemy(a, 100); assert.equal(b.haste, 3); assert.equal(c.haste, 0); }
  near(battle({ frenzy: 3 }).g.speedMul / battle().g.speedMul, 1.21);
  // Champions: one more with every level; never on a boss wave.
  assert.ok(offers({}).every((w) => w.champs === 0 && w.champ === -1));
  assert.ok(offers({ champions: 2 }).every((w) => w.champs === 2 && w.champ >= 0));
  assert.ok(offers({ champions: 2 }, 16).every((w) => w.champs === 0));
  { const { queue } = battle({ champions: 3 }, { wave: 12 }); assert.equal(queue.filter((q) => q.champ).length, 3); }
  { const { g } = newGame(3, 1, { siege: 3 }); g.muts = { champions: 1 }; g.jump(12); assert.ok(g.waves.every((w) => w.champs === 2), 'on top of the siege rule'); }
  // The royal guard: two elite brutes with every boss, for each level.
  { const { queue } = battle({ escort: 2 }, { wave: 8 }); assert.equal(queue.filter((q) => q.t === 1 && q.scale === 2).length, 4); assert.equal(queue.filter((q) => ENEMIES[q.t].boss).length, 1); }
  { const { queue } = battle({ escort: 2 }, { wave: 9 }); assert.equal(queue.filter((q) => q.scale === 2).length, 0, 'only with a boss'); }
  // Ancient power: bosses are tougher and use their powers more often.
  { const a = battle({ might: 2 }, { wave: 8 }).g, b = battle({}, { wave: 8 }).g; near(a.bossMul / b.bossMul, 1.3); near(a.hpMul, b.hpMul);
    const q = a.makeEnemy(2, 0, 30); q.pt = 0; a.enemies.push(q); a.bossPower(q, ENEMIES[2], TICK); near(q.pt, ENEMIES[2].pcd * 0.6); }
});

test('the Behemoth\'s legacy: thick hides, shells, siegecraft, savagery, plated brutes and blood rage', () => {
  // Thick hides: three more armour for each level, on everything.
  const hit = (muts) => { const { g } = battle(muts); const e = addEnemy(g, 0, 30, 0, { hp: 1000 }); g.hurtEnemy(e, 50); return (1000 - e.hp) / 1; };
  near(hit({}) - hit({ hide: 2 }), 6 * battle().g.armorMul);
  // Shells: about a third of the monsters, for each level, shrug off their first direct hit; burning ignores it.
  const shelled = (lv) => { const { g } = battle({ shell: lv }); let n = 0; for (let i = 0; i < 600; i++) if (g.makeEnemy(0, 40, 0).shell) n++; return n / 600; };
  assert.equal(shelled(0), 0); assert.ok(Math.abs(shelled(1) - 0.34) < 0.07); assert.ok(shelled(3) > 0.99);
  { const { g } = battle({ shell: 3 }); const e = g.makeEnemy(1, 40, 0); g.enemies.push(e);
    g.hurtEnemy(e, 50, null, false, false, false); assert.equal(e.max - e.hp, 50); assert.equal(e.shell, 1, 'fire and poison do not break it');
    g.hurtEnemy(e, 50); assert.equal(e.max - e.hp, 50, 'the first direct hit bounces off'); assert.equal(e.shell, 0);
    g.hurtEnemy(e, 50); assert.equal(e.max - e.hp, 100);
    assert.ok(g.snapshot().en.length === 1); }
  { const { g } = battle({ shell: 3 }); const e = g.makeEnemy(0, 40, 0); g.enemies.push(e); assert.equal(g.snapshot().en[0][5] & 128, 128, 'the client is told'); }
  // Siegecraft: 15% more damage to walls for each level; savagery: 10% more damage to everything.
  const wall = (muts) => { const { g } = battle(muts); const e = addEnemy(g, 1, 0, S + 1.2, { hp: 1e6, cd: 0 }); const s = g.segs.find((x) => x.gate); const before = s.hp; g.updateEnemies(TICK); return before - s.hp; };
  near(wall({ breach: 2 }) / wall({}), 1.3); near(wall({ savage: 2 }) / wall({}), 1.2);
  const keep = (muts) => { const { g } = battle(muts); addEnemy(g, 1, 0, 4.2, { hp: 1e6, cd: 0 }); const before = g.th.hp; g.updateEnemies(TICK); return before - g.th.hp; };
  near(keep({ savage: 3 }) / keep({}), 1.3); near(keep({ breach: 3 }) / keep({}), 1, 1e-9);
  // Plated: brutes, rams and shellbacks only.
  { const a = battle({ plated: 2 }).g, b = battle().g;
    for (const t of [1, 6, 12]) near(a.makeEnemy(t, 40, 0).max / b.makeEnemy(t, 40, 0).max, 1.5, 0.01);
    assert.equal(a.makeEnemy(0, 40, 0).max, b.makeEnemy(0, 40, 0).max);
    assert.equal(a.nextStats()[1][0] > b.nextStats()[1][0], true); }
  // Blood rage: below half health a boss moves faster.
  const step = (muts, hp) => { const { g } = battle(muts, { wave: 8 }); const e = addEnemy(g, 7, 0, 40, { hp: 1000 }); e.hp = hp; g.updateEnemies(1); return 40 - e.z; };
  near(step({ rage: 2 }, 400) / step({}, 400), 1.5); near(step({ rage: 2 }, 600) / step({}, 600), 1);
});

test('the Brood Mother\'s legacy: spawnlings, regrowth, volatile deaths, tunnelers, twin lords and a second wind', () => {
  // Spawnlings: some monsters split into two runners; runners themselves and bosses never do.
  { const { g } = battle({ spawn: 1 }); g.rng = () => 0;
    const b = addEnemy(g, 1, 40, 0, { hp: 10 }); g.hurtEnemy(b, 100); assert.equal(g.later.length, 2); assert.ok(g.later.every((e) => e.t === 0));
    const r = addEnemy(g, 0, 40, 5, { hp: 10 }); g.hurtEnemy(r, 100); assert.equal(g.later.length, 2); }
  { const { g } = battle({ spawn: 1 }); g.rng = () => 0.5; const b = addEnemy(g, 1, 40, 0, { hp: 10 }); g.hurtEnemy(b, 100); assert.equal(g.later.length, 0, 'only one in ten'); }
  // Regrowth: half a percent of their health every second, for each level; never a boss.
  const heals = (muts, t = 1) => { const { g } = battle(muts); const e = addEnemy(g, t, 40, 0, { hp: 1000 }); e.hp = 500; g.updateHazards(1); return e.hp - 500; };
  near(heals({ regrow: 2 }), 10); assert.equal(heals({}), 0); assert.equal(heals({ regrow: 2 }, 2), 0);
  // Volatile: dying within three paces of a wall, a monster bursts against it.
  { const { g } = battle({ volatile: 2 }); const s = g.segs.find((x) => x.gate);
    const far = addEnemy(g, 1, 0, S + 8, { hp: 10 }); g.hurtEnemy(far, 100); assert.equal(s.hp, s.max);
    const at = addEnemy(g, 1, 0, S + 1.5, { hp: 10 }); g.hurtEnemy(at, 100);
    near(s.max - s.hp, ENEMIES[1].dmg * g.dmgMul * 0.8 * g.guardMul(g.segs.indexOf(s)), 1e-6); }
  // Tunnelers: some runners and brutes dig under the walls and come up in the courtyard.
  { const { g } = battle({ tunnel: 3 }); g.rng = () => 0.1; g.spawn({ t: 0, a: 0 }); g.spawn({ t: 3, a: 0 }); assert.equal(g.enemies[0].under, true); assert.equal(g.enemies[1].under, false, 'spitters do not dig');
    const e = g.enemies[0]; e.x = 0; e.z = S - 3; g.updateEnemies(TICK); assert.equal(e.under, false, 'it surfaces inside the walls'); }
  { const { g } = battle({}); g.rng = () => 0.1; g.spawn({ t: 0, a: 0 }); assert.equal(g.enemies[0].under, false); }
  // Twin lords: a second boss of the next kind, at half strength on the first level.
  { const { g } = newGame(3); g.muts = { twin: 1 }; g.jump(8); assert.ok(g.waves.every((w) => w.twin === 7)); g.jump(9); assert.ok(g.waves.every((w) => w.twin === -1)); }
  { const { queue } = battle({ twin: 1 }, { wave: 8 }); const bosses = queue.filter((q) => ENEMIES[q.t].boss); assert.deepEqual(bosses.map((q) => [q.t, q.scale]).sort(), [[2, undefined], [7, 0.5]]); }
  { const { queue } = battle({ twin: 3 }, { wave: 32 }); assert.ok(queue.some((q) => q.t === 2 && q.scale === 1), 'after the Sky Tyrant comes the Queen again'); }
  // Second wind: a boss rises once, with a fifth of its health for each level.
  { const { g } = battle({ undying: 2 }, { wave: 8 }); const q = addEnemy(g, 2, 40, 0, { hp: 1000 });
    g.hurtEnemy(q, 5000); assert.equal(q.hp, 400); assert.equal(g.stats.bosses, 0); assert.ok(g.fx.some((f) => f[0] === 48));
    g.hurtEnemy(q, 5000); assert.ok(q.hp <= 0); assert.equal(g.stats.bosses, 1); assert.equal(g.stats.kills, 1); }
});

test('the Sky Tyrant\'s legacy: winged brood, night raids, dread, plunderers, a hexward and venom', () => {
  { const { queue } = battle({ wings: 3 }, { wave: 4, pick: (w) => w.th === 'swarm' || true }); assert.ok(queue.some((q) => q.t === 4), 'some runners came as gloomwings'); }
  { const { g, id } = newGame(1); g.muts = { wings: 3 }; g.jump(2); g.rng = () => 0; g.chooseWave(id, 0); assert.ok(g.queue.every((q) => q.t !== 0)); }
  // Night raids: every fourth wave on the first level, every second on the third.
  const nights = (lv) => { const out = []; for (let n = 9; n <= 16; n++) { const { g } = newGame(1); g.muts = lv ? { raids: lv } : {}; g.jump(n); if (g.waves.every((w) => w.night)) out.push(n); } return out; };
  assert.deepEqual(nights(0), []); assert.deepEqual(nights(1), [12, 16]); assert.deepEqual(nights(2), [9, 12, 15]); assert.deepEqual(nights(3), [10, 12, 14, 16]);
  { const { g } = battle({ raids: 1 }, { wave: 12 }); assert.equal(g.dark, true); assert.equal(g.nightMul(), 0.8); assert.equal(g.snapshot().dk, 1); }
  // Dread: defenders within twelve paces of a boss attack more slowly.
  { const { g } = battle({ dread: 2 }, { wave: 8 }); const u = place(g, 'archer', 16), v = place(g, 'archer', 17); const base = g.unitReload(u);
    addEnemy(g, 7, ...out(g, 16, 6), { hp: 1e6 }); g.updateSupport(TICK);
    near(g.unitReload(u) / base, 1.24); near(g.unitReload(v) / base, 1, 1e-9); }
  // Plunderers: every blow on the keep steals gold.
  { const { g } = battle({ thieves: 2 }); g.gold = 100; addEnemy(g, 1, 0, 4.2, { hp: 1e6, cd: 0 }); g.updateEnemies(TICK); near(g.gold, 100 - 2 * g.goldMul); }
  // Hexward: slows and curses are a fifth weaker for each level.
  const slow = (muts) => { const { g } = battle(muts); place(g, 'frost', 16); addEnemy(g, 1, ...out(g, 16, 6), { hp: 1e6 }); g.updateUnits(0); return g.projs[0].slow; };
  near(slow({ ward: 2 }) / slow({}), 0.6);
  const curse = (muts) => { const { g } = battle(muts); place(g, 'hexer', 16); const e = addEnemy(g, 1, ...out(g, 16, 6), { hp: 1e6 }); g.updateUnits(0); return e.curseK; };
  near(curse({ ward: 3 }) / curse({}), 0.4);
  // Venom: a spit that lands on a wall slows whoever stands on it for three seconds.
  { const { g } = battle({ venom: 2 }); const u = place(g, 'archer', 16), v = place(g, 'archer', 17); const base = g.unitReload(u);
    const e = addEnemy(g, 3, ...out(g, 16, 5), { hp: 1e6, cd: 0 }); g.updateEnemies(TICK);
    assert.equal(e.hold, g.slots[16].seg); near(g.unitReload(u) / base, 1.2); near(g.unitReload(v) / base, 1, 1e-9);
    g.updateUnits(3.1); near(g.unitReload(u) / base, 1, 1e-9); }
});

test('the horde adapts: it resists the family that hurt it most and forgets the others', () => {
  assert.deepEqual(ADAPT, { gain: 8, fade: 4, cap: 40, floor: -24, share: 0.3, from: 2 });
  const { g } = battle();
  // Damage is booked to the family of whoever dealt it; turrets count as engineers, abilities as nobody.
  const a = place(g, 'archer', 16), m = place(g, 'mage', 17), e = addEnemy(g, 1, 40, 0, { hp: 1e6 });
  g.hurtEnemy(e, 100, a); g.hurtEnemy(e, 40, m); g.hurtEnemy(e, 999);
  g.turrets = [{ k: 'bolt', lv: 1, spot: 0, cd: 0 }]; e.x = -20; e.z = -4.2; g.updateTurrets(0.01); for (let i = 0; i < 20; i++) g.updateProjs(TICK);
  assert.equal(g.dealt.marksmen, 100); assert.equal(g.dealt.arcane, 40); assert.ok(g.dealt.engineers > 0);
  assert.equal(FAMILIES.reduce((s, f) => s + g.dealt[f], 0), 140 + g.dealt.engineers);
  // Overkill is not counted.
  const weak = addEnemy(g, 0, 40, 5, { hp: 30 }); g.hurtEnemy(weak, 500, m); assert.equal(g.dealt.arcane, 70);
  // Nothing is learnt before the second boss.
  g.bossWaves = 1; g.adaptNow();
  assert.deepEqual(Object.values(g.adapt), [0, 0, 0, 0, 0, 0]); assert.deepEqual(Object.values(g.dealt), [0, 0, 0, 0, 0, 0]); assert.equal(g.lastAdapt, null);
  // From the second boss on: +8 for the family that dealt most, -4 for every other.
  g.bossWaves = 2; g.dealt.marksmen = 600; g.dealt.arcane = 300; g.dealt.wardens = 100;
  g.adaptNow();
  assert.deepEqual(g.adapt, { marksmen: 8, arcane: -4, alchemy: -4, faith: -4, wardens: -4, engineers: -4 }); assert.equal(g.lastAdapt, 'marksmen');
  assert.ok(g.fx.some((f) => f[0] === 46 && f[3] === 'marksmen'));
  // The resistance and the weakness both count from then on.
  const f = addEnemy(g, 1, 40, 10, { hp: 1e6 });
  g.hurtEnemy(f, 100, a); near(f.max - f.hp, 92);
  g.hurtEnemy(f, 100, m); near(f.max - f.hp, 92 + 104);
  g.hurtEnemy(f, 100); near(f.max - f.hp, 92 + 104 + 100, 1e-9);
  // It stops at the cap and at the floor.
  for (let i = 0; i < 12; i++) { g.dealt.marksmen = 1000; g.adaptNow(); }
  assert.equal(g.adapt.marksmen, ADAPT.cap); assert.equal(g.adapt.arcane, ADAPT.floor);
  // An army that spreads its damage gives the horde nothing to learn: everything fades.
  for (const k of FAMILIES) g.dealt[k] = 100;
  g.dealt.faith = 0;
  g.adaptNow();
  assert.equal(g.lastAdapt, null); assert.equal(g.adapt.marksmen, ADAPT.cap - ADAPT.fade); assert.equal(g.adapt.arcane, ADAPT.floor);
  const s = g.snapshot();
  assert.equal(s.ad, undefined, 'the adaptation is only sent between waves');
});

test('the adaptation happens when a season ends and is shown between waves', () => {
  const { g, id } = newGame(2);
  g.jump(16); g.bossWaves = 1;
  g.chooseWave(id, g.waves.findIndex((w) => !w.hard)); g.queue = []; g.enemies = [];
  g.dealt.marksmen = 900; g.dealt.wardens = 100;
  steps(g, 1);
  assert.equal(g.bossWaves, 2); assert.equal(g.adapt.marksmen, 8); assert.equal(g.adapt.wardens, -4);
  const s = g.snapshot();
  assert.deepEqual(s.ad, [8, -4, -4, -4, -4, -4]); assert.deepEqual(s.ds, [0, 0, 0, 0, 0, 0]); assert.equal(s.la, 'marksmen');
  // An ordinary wave changes nothing.
  takeRewards(g, id);
  g.chooseWave(id, 0); g.queue = []; g.enemies = []; g.dealt.arcane = 500;
  steps(g, 1);
  assert.equal(g.adapt.marksmen, 8); assert.equal(g.dealt.arcane, 500, 'the season\'s tally goes on');
});
