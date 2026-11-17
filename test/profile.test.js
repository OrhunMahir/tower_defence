// What the player keeps between runs (renown, unlocks, siege levels, achievements, the codex),
// and that every thing in the rules has words to show for it. The client modules are loaded
// in Node with a stand-in for the browser's storage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import * as G from '../server/game.js';

globalThis.localStorage = { d: {}, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = String(v); }, removeItem(k) { delete this.d[k]; } };
// In the browser the rules are served under ./rules/; on disk they live in ../server/.
registerHooks({ resolve: (s, c, next) => next(s.startsWith('./rules/') ? new URL(`../server/${s.slice(8)}`, c.parentURL).href : s, c) });
const P = await import('../client/profile.js');
const T = await import('../client/text.js');
const { profile, prefs } = P;

// The summary of a finished run, as Game.fall() builds it.
let runs = 0;
const summary = (extra = {}) => {
  const s = { id: `run-${++runs}`, wave: 12, cleared: 11, seasons: 1, year: 1, retired: false, kills: 300, bosses: 1, earned: 4000, age: 1, path: null, ageKey: 'stone', muts: 1, siege: 1, lord: 'marshal', level: 9, daily: false, time: 600, items: 5, relics: 1, legends: 0, specs: 1, units: 12, famTiers: [1, 0, 0, 0, 0, 0], wallsLost: 2, turrets: 2, buildings: 2, doctrines: 1, topKills: 80, ...extra };
  return { ...s, renown: G.renownFor(s) };
};
const reward = (k) => T.ACH_TXT[k][3];

test('a new player starts with what is free and nothing else', () => {
  assert.equal(profile.renown, 0); assert.equal(profile.siege, 1);
  assert.deepEqual(profile.unlocked.lords, ['marshal', 'merchant']);
  assert.deepEqual(profile.unlocked.abilities, G.DEFAULT_ABILITIES);
  assert.deepEqual(profile.unlocked.classes, G.UNIT_KEYS.filter((k) => !G.UNITS[k].unlock));
  assert.ok(profile.unlocked.items.every((k) => !G.ITEMS[k].unlock && !G.ITEMS[k].relic));
  assert.equal(profile.unlocked.relics.length, 12); assert.ok(profile.unlocked.relics.every((k) => G.ITEMS[k].relic && !G.ITEMS[k].unlock));
  assert.deepEqual(P.title(), { rank: 0, from: 0, next: G.titleNeed(1), earned: 0 });
  assert.ok(profile.unlocked.classes.length >= 9 && profile.unlocked.items.length >= 25, 'enough to play with from the first run');
  const [have, all] = P.unlockProgress();
  assert.ok(have < all);
  // Every age has at least two free classes, so a new player always has recruits to find.
  assert.ok(profile.unlocked.classes.filter((k) => G.UNITS[k].age === 1).length >= 4);
});

test('a finished run is counted once: renown, records, totals, achievements', () => {
  const s = summary();
  const a = P.award(s, reward);
  assert.deepEqual(a.ach, ['first', 'wave10', 'stone']);
  assert.equal(a.renown, s.renown + 5 + 5 + 5);
  assert.equal(profile.renown, a.renown); assert.ok(a.record);
  assert.deepEqual(profile.best[1], { wave: 12, wins: 0 });
  assert.deepEqual([profile.totals.runs, profile.totals.kills, profile.totals.wins], [1, 300, 0]);
  assert.equal(profile.runs.length, 1); assert.equal(profile.runs[0].wave, 12); assert.equal(profile.runs[0].held, false);
  assert.equal(profile.lordBest.marshal, 12); assert.equal(profile.totals.waves, 11);
  assert.equal(profile.earned, a.renown); assert.equal(a.rank, P.title().rank, 'the first title is earned'); assert.ok(a.rank >= 1);
  assert.equal(P.award(s, reward), null, 'the same run is not counted twice');
  assert.equal(profile.renown, a.renown);
  const b = P.award(summary({ wave: 8, cleared: 7, seasons: 0 }), reward);
  assert.equal(b.record, false); assert.deepEqual(b.ach, [], 'achievements are earned once');
  assert.equal(profile.best[1].wave, 12);
  assert.equal(P.award(null, reward), null);
});

test('the fourth boss at the highest open siege level opens the next one, and every boss after it one more', () => {
  const year = { wave: 33, cleared: 32, seasons: 4 };
  { const r = P.award(summary({ ...year, siege: 0 }), reward); assert.equal(r.siege, 0, 'not from relaxed'); assert.deepEqual(r.ach, ['wave20', 'victory', 'swift'], 'but the first year counts all the same (and ten minutes of battle is swift)'); }
  assert.equal(P.award(summary({ wave: 32, cleared: 31, seasons: 3 }), reward).siege, 0, 'the Sky Tyrant has to fall');
  const a = P.award(summary({ ...year, siege: 1, age: 3 }), reward);
  assert.equal(a.siege, 2); assert.equal(a.opened, 1); assert.equal(profile.siege, 2);
  assert.deepEqual(a.ach, ['iron', 'gold'], 'the ages reached on the way');
  assert.equal(P.award(summary({ ...year, siege: 1 }), reward).siege, 0, 'level 1 again opens nothing new');
  assert.equal(P.award(summary({ ...year, siege: 2, daily: true }), reward).siege, 0, 'a daily run does not count');
  const deep = P.award(summary({ wave: 50, cleared: 49, seasons: 6, siege: 2 }), reward);
  assert.equal(deep.opened, 3); assert.equal(profile.siege, 5, 'three bosses past the third: three levels at once');
  profile.siege = 10;
  assert.equal(P.award(summary({ ...year, siege: 10 }), reward).siege, 11, 'the ladder goes on above ten');
  profile.siege = G.SIEGE_MAX;
  assert.equal(P.award(summary({ ...year, siege: G.SIEGE_MAX }), reward).siege, 0);
  profile.siege = 11;
  assert.equal(profile.wonWith.length, 1); assert.ok(profile.totals.wins >= 5);
  assert.equal(profile.best[1].wins, 2); assert.equal(profile.best[0].wins, 1); assert.equal(profile.runs[0].held, true);
});

test('every achievement can be earned', () => {
  const all = summary({ wave: 101, cleared: 100, seasons: 12, siege: 15, age: 8, path: 'legend', ageKey: 'celestial', muts: 9, wallsLost: 0, items: 25, relics: 3, legends: 4, specs: 7, turrets: 12, buildings: 7, kills: 1500, time: 20 * 60, famTiers: [3, 0, 0, 0, 0, 0], daily: true, lord: 'saint' });
  profile.totals.kills = 9000;
  P.award(summary({ wave: 33, cleared: 32, seasons: 4, lord: 'merchant' }), reward);
  P.award(summary({ wave: 50, cleared: 49, seasons: 6, age: 6, path: 'splendour' }), reward);
  P.award(summary({ wave: 50, cleared: 49, seasons: 6, age: 6, path: 'industry' }), reward);
  assert.deepEqual(profile.paths, ['splendour', 'industry']); assert.equal(profile.ach.allpaths, undefined);
  P.award(all, reward);
  assert.deepEqual(P.ACH_KEYS.filter((k) => !profile.ach[k]), []);
  assert.equal(P.ACH_KEYS.length, 32);
  assert.equal(P.ACH_KEYS.length, Object.keys(T.ACH_TXT).length);
  for (const k of P.ACH_KEYS) { assert.ok(T.ACH_TXT[k] && T.ACH_TXT[k][3] > 0, k); }
  assert.ok(P.title().rank >= 5, 'all that renown has earned a title');
  assert.ok(P.title().next > profile.earned && P.title().from <= profile.earned);
});

test('the first daily run of a day pays a bonus', () => {
  delete profile.daily[P.today()];
  const a = P.award(summary({ daily: true, wave: 9 }), reward), b = P.award(summary({ daily: true, wave: 14 }), reward);
  assert.equal(a.daily, 15); assert.equal(b.daily, 0);
  assert.deepEqual(profile.daily[P.today()], { wave: 14 }, 'the best attempt of the day is kept');
});

test('renown buys new lords, classes, items and abilities, and nothing twice', () => {
  profile.renown = 40;
  assert.equal(P.price('lords', 'archmage'), G.LORDS.archmage.unlock);
  assert.equal(P.unlock('lords', 'hexlord'), false, 'too dear');
  assert.ok(P.unlock('lords', 'archmage'));
  assert.equal(profile.renown, 40 - G.LORDS.archmage.unlock);
  assert.ok(P.has('lords', 'archmage'));
  assert.equal(P.unlock('lords', 'archmage'), false, 'already owned');
  assert.equal(P.unlock('lords', 'nobody'), false); assert.equal(P.unlock('dragons', 'smaug'), false);
  assert.deepEqual(profile.unlocked.lords, ['marshal', 'merchant', 'archmage'], 'kept in table order');
  profile.renown = 3000;
  for (const kind in P.UNLOCKS) for (const k of P.UNLOCKS[kind][1]) if (!P.has(kind, k)) assert.ok(P.unlock(kind, k), `${kind} ${k}`);
  const [have, all] = P.unlockProgress();
  assert.equal(have, all);
  const spent = 3000 - profile.renown + G.LORDS.archmage.unlock;
  assert.ok(spent > 1200 && spent < 2000, `everything costs ${spent} renown: many runs, but not forever`);
  assert.ok(P.UNLOCKS.items[1].every((k) => !G.ITEMS[k].relic), 'relics are kept apart from the items of the shop');
  assert.equal(P.UNLOCKS.relics[1].length, 18); assert.equal(P.UNLOCKS.relics[1].filter((k) => G.ITEMS[k].unlock).length, 6, 'six relics are bought with renown');
});

test('a run starts with what the menu chose, as long as it is unlocked', () => {
  const p2 = JSON.parse(localStorage.getItem('hordewall.profile.v1'));
  assert.equal(p2.renown, profile.renown, 'the profile is saved as it changes');
  profile.unlocked.lords = ['marshal', 'merchant']; profile.unlocked.abilities = ['volley', 'mend', 'rally', 'freeze']; profile.siege = 3;
  Object.assign(prefs, { lord: 'hexlord', siege: 9, abilities: ['meteor', 'freeze', 'freeze'] });
  const o = P.runOptions();
  assert.equal(o.lord, 'marshal'); assert.equal(o.siege, 3);
  assert.equal(o.abilities.length, 3); assert.equal(new Set(o.abilities).size, 3);
  assert.ok(o.abilities.includes('freeze') && !o.abilities.includes('meteor'));
  assert.deepEqual(o.classes, profile.unlocked.classes); assert.deepEqual(o.relics, profile.unlocked.relics);
  const g = new G.Game(Math.random, o);
  assert.deepEqual(g.loadout, o.abilities); assert.equal(g.siege, 3);
  assert.equal(g.relicPool.size, profile.unlocked.relics.length);
  // The ladder goes on above the named levels.
  profile.siege = 14; prefs.siege = 14;
  assert.equal(new G.Game(Math.random, P.runOptions()).siege, 14);
  prefs.siege = 99; assert.equal(P.runOptions().siege, 14);
});

test('the daily challenge is the same for everyone on a day, and different the next', () => {
  const a = P.dailyRun('2026-11-16'), b = P.dailyRun('2026-11-16'), c = P.dailyRun('2026-11-17');
  assert.deepEqual(a, b); assert.notDeepEqual(a.opts, c.opts);
  assert.equal(a.seed, 20261116); assert.ok(a.opts.daily);
  const lords = new Set(), sieges = new Set();
  for (let d = 1; d <= 28; d++) {
    const r = P.dailyRun(`2026-02-${String(d).padStart(2, '0')}`);
    assert.ok(G.LORD_KEYS.includes(r.opts.lord) && r.opts.siege >= 1 && r.opts.siege <= 4);
    assert.equal(new Set(r.opts.abilities).size, 3);
    assert.deepEqual(r.opts.classes, G.UNIT_KEYS, 'everything is unlocked in the daily'); assert.equal(r.opts.relics.length, 18);
    lords.add(r.opts.lord); sieges.add(r.opts.siege);
  }
  assert.ok(lords.size >= 6 && sieges.size === 4, 'the days differ');
  assert.match(P.today(new Date(2026, 0, 5)), /^2026-01-05$/);
});

test('the codex remembers what has been met', () => {
  assert.ok(P.discover('mon', ['runner', 'brute']));
  assert.equal(P.discover('mon', ['runner']), false);
  assert.equal(P.discover('mon', ['dragon']), false, 'only real monsters');
  P.discover('unit', ['archer']); P.discover('item', ['whetstone', 'phoenix']);
  assert.ok(P.discover('mut', ['hide', 'nope'])); assert.ok(P.discover('wx', ['fog']));
  const [have, all] = P.codexProgress();
  assert.equal(have, 7); assert.equal(all, G.ENEMIES.length + G.UNIT_KEYS.length + G.ITEM_KEYS.length + G.MUTATION_KEYS.length + G.WEATHER.length);
});

test('progress survives a reload, and can be erased', async () => {
  const again = await import('../client/profile.js?reload');
  assert.equal(again.profile.renown, profile.renown);
  assert.deepEqual(again.profile.ach, profile.ach);
  assert.deepEqual(again.profile.codex, profile.codex);
  P.setSavedRun({ v: 4 });
  assert.deepEqual(P.savedRun(), { v: 4 });
  prefs.volume = 0.3;
  P.resetProfile();
  assert.equal(profile.renown, 0); assert.deepEqual(profile.ach, {}); assert.equal(P.savedRun(), null);
  assert.equal(P.prefs, profile.prefs, 'the settings object is still the one everyone holds');
  assert.equal(prefs.volume, 0.3, 'sound settings are kept'); assert.equal(prefs.lord, 'marshal');
  // A damaged or foreign profile falls back to a fresh one.
  localStorage.setItem('hordewall.profile.v1', '{"renown":"lots","unlocked":{"lords":["nobody"]},"siege":99');
  const broken = await import('../client/profile.js?broken');
  assert.equal(broken.profile.renown, 0);
  localStorage.setItem('hordewall.profile.v1', JSON.stringify({ renown: 7, unlocked: { lords: ['nobody', 'saint'] }, siege: 99999, codex: { mon: ['runner'] }, best: [] }));
  const odd = await import('../client/profile.js?odd');
  assert.deepEqual(odd.profile.unlocked.lords, ['marshal', 'merchant', 'saint']); assert.equal(odd.profile.siege, G.SIEGE_MAX);
  // A profile from before this version gets what is new: the free relics, the new codex pages, a title from its renown.
  assert.equal(odd.profile.unlocked.relics.length, 12); assert.deepEqual(odd.profile.codex.mut, []); assert.deepEqual(odd.profile.codex.mon, ['runner']);
  assert.deepEqual(odd.profile.best, {}); assert.equal(odd.profile.earned, 7); assert.deepEqual(odd.profile.paths, []);
});

test('everything in the rules has words to show for it', () => {
  const has = (table, keys, name, n) => { for (const k of keys) { assert.ok(Array.isArray(table[k]) && table[k].length >= n && table[k][0] !== '' && table[k].every((x) => x != null), `${name}: ${k}`); } assert.deepEqual(Object.keys(table).filter((k) => !keys.includes(k)), [], `${name}: no text without a thing`); };
  has(T.MON, G.ENEMIES.map((e) => e.key), 'monster', 3);
  has(T.UNIT_TXT, G.UNIT_KEYS, 'class', 2);
  has(T.FAM_TXT, G.FAMILIES, 'family', 2);
  has(T.TRAIT_TXT, G.TRAITS, 'trait', 2);
  has(T.SPEC_TXT, Object.values(G.SPECS).flat().map((s) => s.key), 'specialisation', 2);
  has(T.STAT_TXT, G.STAT_KEYS, 'stat', 3);
  has(T.ITEM_TXT, G.ITEM_KEYS, 'item', 2);
  has(T.TURRET_TXT, G.TURRET_KEYS, 'turret', 2);
  has(T.LORD_TXT, G.LORD_KEYS, 'lord', 3);
  has(T.ABIL_TXT, G.ABILITY_KEYS, 'ability', 3);
  has(T.SIEGE_TXT, G.SIEGE.map((s) => s.key), 'siege level', 2);
  has(T.AGE_TXT, [...G.AGES.map((a) => a.key), ...G.PATH_KEYS.flatMap((p) => G.PATHS[p].ages)], 'age', 2);
  has(T.PATH_TXT, G.PATH_KEYS, 'path', 3);
  has(T.PERK_TXT, Object.keys(G.PERKS), 'age power', 2);
  has(T.SEASON_TXT, G.SEASONS, 'season', 4);
  has(T.WEATHER_TXT, G.WEATHER, 'weather', 3);
  has(T.MUT_TXT, G.MUTATION_KEYS, 'mutation', 3);
  has(T.BOON_TXT, G.BOONS, 'boon', 2);
  for (const k of G.MUTATION_KEYS) {
    const lines = [1, 2, 3].map((l) => T.MUT_TXT[k][2](l));
    assert.ok(lines.every((t) => typeof t === 'string' && t.length > 10), k);
    assert.equal(new Set(lines).size, 3, `every level of ${k} reads differently`);
  }
  // Titles and the siege ladder have words without end.
  assert.equal(T.titleName(0), 'Recruit'); assert.equal(T.titleName(12), 'Emperor'); assert.equal(T.titleName(13), 'Emperor II');
  assert.equal(new Set(Array.from({ length: 60 }, (_, r) => T.titleName(r))).size, 60);
  const sk = G.SIEGE.map((s) => s.key);
  assert.equal(T.siegeName(1, sk), 'Normal'); assert.equal(T.siegeName(10, sk), 'Apocalypse'); assert.equal(T.siegeName(14, sk), 'Siege 14');
  assert.deepEqual(T.siegeLines(1, sk), [T.SIEGE_TXT.normal[1]]); assert.equal(T.siegeLines(10, sk).length, 9);
  assert.ok(T.siegeLines(14, sk)[0].includes('2 mutations') && T.siegeLines(14, sk)[1].includes('26%'));
  assert.equal(T.ageName('gold'), 'Golden Age'); assert.equal(T.ageName('steam', 3), 'Steam Age IV');
  has(T.BUILD_TXT, G.BUILDING_KEYS, 'building', 3);
  has(T.DOC_TXT, G.DOCTRINE_KEYS, 'doctrine', 3);
  has(T.EVENT_TXT, G.EVENTS, 'event', 3);
  has(T.MOD_TXT, G.MODS, 'modifier', 3);
  has(T.TIER_TXT, Object.keys(G.TIERS), 'tier', 2);
  for (const th of G.THEMES) assert.ok(T.THEME_TXT[th.key], `theme: ${th.key}`);
  assert.equal(T.RAR_TXT.length, G.RARITY.length);
  // An item must say what it does: stat changes, a described rule, or both.
  for (const k of G.ITEM_KEYS) assert.ok(G.ITEMS[k].mods || T.ITEM_TXT[k][2], `item ${k} has an effect nobody explains`);
  for (const k of G.ITEM_KEYS) if (G.ITEMS[k].fx && !G.ITEMS[k].fx.startsWith('fam:')) assert.ok(T.ITEM_TXT[k][2], `the special rule of ${k} is explained`);
  // Every answer an event can offer has a label.
  const g = new G.Game(G.seededRng(1));
  const seen = new Set();
  for (let i = 0; i < 400; i++) { g.phase = 'reward'; g.picks = [{ type: 'event' }]; g.eggAt = 0; g.nextPick(); for (const o of g.picks[0].opts) seen.add(o.k); }
  for (const k of seen) assert.ok(T.EVENT_OPT[k], `event answer ${k}`);
  assert.deepEqual(Object.keys(T.EVENT_OPT).filter((k) => !seen.has(k)), []);
  assert.equal(T.fmt(1234), '1234'); assert.equal(T.fmt(12345), '12.3k'); assert.equal(T.fmt(2500000), '2.5M'); assert.equal(T.sign(5), '+5'); assert.equal(T.sign(-5), '-5');
  assert.equal(T.statLine('wallhp', 10), '+10% wall HP'); assert.equal(T.esc('<b>"x"</b>'), '&#60;b&#62;&#34;x&#34;&#60;/b&#62;');
});

test('every picture is drawn by hand: nothing is missing, nothing is unused and no emoji is left', async () => {
  const fs = await import('node:fs');
  const I = await import('../client/icons.js');
  const have = new Set(I.PICTURES);
  assert.equal(have.size, I.PICTURES.length, 'no picture is drawn twice');
  // The sheet builds: every stroke of every picture can be read.
  const sheet = I.sheet();
  for (const name of I.PICTURES) assert.ok(sheet.includes(`id="i-${name}"`), name);
  assert.throws(() => I.icon('no-such-picture'), /no picture called/);
  // Whatever the screens point at exists, and every picture is pointed at from somewhere.
  const sources = ['text.js', 'hud.js', 'menu.js', 'main.js', 'index.html'].map((f) => fs.readFileSync(new URL(`../client/${f}`, import.meta.url), 'utf8')).join('\n');
  const named = new Set([...sources.matchAll(/\bI\('([a-z0-9]+)'/g), ...sources.matchAll(/#i-([a-z0-9]+)/g)].map((m) => m[1]));
  for (const n of named) assert.ok(have.has(n), `the picture "${n}" is not drawn`);
  assert.deepEqual(I.PICTURES.filter((n) => !named.has(n)), [], 'pictures nobody uses');
  // Every thing with a picture in the tables has one.
  const pic = /^<svg class="ico[^"]*" aria-hidden="true"><use href="#i-[a-z0-9]+"\/><\/svg>$/;
  for (const [table, at] of [['ITEM_TXT', 0], ['LORD_TXT', 1], ['ABIL_TXT', 0], ['MOD_TXT', 0], ['PATH_TXT', 0], ['SEASON_TXT', 0], ['WEATHER_TXT', 0], ['MUT_TXT', 0], ['BOON_TXT', 0], ['BUILD_TXT', 0], ['DOC_TXT', 0], ['EVENT_TXT', 0], ['ACH_TXT', 0], ['TURRET_TXT', 2]]) {
    for (const [k, v] of Object.entries(T[table])) assert.match(v[at], pic, `${table}.${k}`);
  }
  // No emoji anywhere in what the browser loads.
  const emoji = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/u;
  for (const f of fs.readdirSync(new URL('../client/', import.meta.url))) {
    const hit = fs.readFileSync(new URL(`../client/${f}`, import.meta.url), 'utf8').match(emoji);
    assert.equal(hit, null, `${f} still has the emoji ${hit && hit[0]}`);
  }
});
