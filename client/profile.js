// What the player keeps between runs, in the browser: renown and what it has unlocked, the siege
// ladder, a title, achievements, the codex, records and settings. Nothing here makes the castle
// stronger: renown only buys more variety (lords, classes, items, relics, abilities), and the
// ladder and the title have no top.
import {
  UNITS, UNIT_KEYS, ITEMS, ITEM_KEYS, LORDS, LORD_KEYS, ABILITIES, ABILITY_KEYS, DEFAULT_ABILITIES, SIEGE_MAX, ENEMIES, FAMILIES, MUTATION_KEYS, WEATHER,
  YEAR_LEN, SEASON_LEN, LAST_AGE, PATH_KEYS, titleRank, titleNeed, seededRng,
} from './rules/game.js';

const KEY = 'hordewall.profile.v1', SAVE_KEY = 'hordewall.save.v5';
export const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};

// The tables that can be unlocked, and what each kind is called in the profile.
export const UNLOCKS = {
  lords: [LORDS, LORD_KEYS], classes: [UNITS, UNIT_KEYS], items: [ITEMS, ITEM_KEYS.filter((k) => !ITEMS[k].relic)],
  relics: [ITEMS, ITEM_KEYS.filter((k) => ITEMS[k].relic)], abilities: [ABILITIES, ABILITY_KEYS],
};
const free = (kind) => UNLOCKS[kind][1].filter((k) => !UNLOCKS[kind][0][k].unlock);

function fresh() {
  return {
    renown: 0, earned: 0,
    unlocked: Object.fromEntries(Object.keys(UNLOCKS).map((k) => [k, free(k)])),
    siege: 1,                      // the highest siege level open; the ladder has no top
    best: {},                      // by siege level: { wave, wins } (wins: runs that lasted the first year)
    lordBest: {},                  // by lord: the deepest wave reached
    runs: [], seen: [],            // the last runs, and the ids of every run already counted
    ach: {},                       // achievement key -> date earned
    codex: { mon: [], unit: [], item: [], mut: [], wx: [] },
    wonWith: [],                   // lords who have held the castle through a first year
    paths: [],                     // paths of ages followed to their third age
    totals: { runs: 0, wins: 0, kills: 0, bosses: 0, time: 0, waves: 0 },
    daily: {},                     // date -> { wave }
    prefs: { lord: 'marshal', siege: 1, abilities: [...DEFAULT_ABILITIES], sfx: true, music: true, volume: 0.7, quality: 'high', numbers: true, shake: true, tips: true, tipsSeen: [] },
  };
}

function load() {
  const base = fresh(), p = store.get(KEY);
  if (!p || typeof p !== 'object') return base;
  const out = { ...base, ...p, prefs: { ...base.prefs, ...(p.prefs || {}) }, totals: { ...base.totals, ...(p.totals || {}) }, codex: { ...base.codex, ...(p.codex || {}) } };
  // Whatever is free is always unlocked, also after an update that adds new things.
  out.unlocked = {};
  for (const kind in UNLOCKS) {
    const have = new Set([...(p.unlocked?.[kind] || []), ...free(kind)]);
    out.unlocked[kind] = UNLOCKS[kind][1].filter((k) => have.has(k));
  }
  for (const k of ['runs', 'seen', 'wonWith', 'paths']) if (!Array.isArray(out[k])) out[k] = [];
  for (const k of ['best', 'lordBest', 'ach', 'daily']) if (!out[k] || typeof out[k] !== 'object' || Array.isArray(out[k])) out[k] = {};
  for (const k in base.codex) if (!Array.isArray(out.codex[k])) out.codex[k] = [];
  out.siege = Math.max(1, Math.min(SIEGE_MAX, out.siege | 0));
  out.renown = Number.isFinite(out.renown) ? Math.max(0, out.renown) : 0;
  out.earned = Number.isFinite(out.earned) ? Math.max(out.renown, out.earned) : out.renown;
  return out;
}

export const profile = load();
export const prefs = profile.prefs;
export const saveProfile = () => store.set(KEY, profile);
export const savedRun = () => store.get(SAVE_KEY);
export const setSavedRun = (d) => store.set(SAVE_KEY, d);

export const has = (kind, key) => profile.unlocked[kind].includes(key);
export const price = (kind, key) => UNLOCKS[kind][0][key].unlock || 0;
// Spends renown on something new. Returns false when it is too dear or already owned.
export function unlock(kind, key) {
  if (!UNLOCKS[kind] || !UNLOCKS[kind][1].includes(key) || has(kind, key) || profile.renown < price(kind, key)) return false;
  profile.renown -= price(kind, key);
  profile.unlocked[kind] = UNLOCKS[kind][1].filter((k) => k === key || has(kind, k));
  saveProfile();
  return true;
}
// How much there is left to unlock, for the menu badge.
export function unlockProgress() {
  let have = 0, all = 0;
  for (const kind in UNLOCKS) { all += UNLOCKS[kind][1].length; have += profile.unlocked[kind].length; }
  return [have, all];
}

// What a new run may use, from the choices in the menu.
export function runOptions() {
  if (!has('lords', prefs.lord)) prefs.lord = 'marshal';
  prefs.siege = Math.max(0, Math.min(profile.siege, prefs.siege | 0));
  const abil = [...new Set((prefs.abilities || []).filter((k) => has('abilities', k)))].slice(0, 3);
  for (const k of DEFAULT_ABILITIES) if (abil.length < 3 && !abil.includes(k)) abil.push(k);
  prefs.abilities = abil;
  return { siege: prefs.siege, lord: prefs.lord, classes: profile.unlocked.classes, items: profile.unlocked.items, relics: profile.unlocked.relics, abilities: abil };
}

// The title: a rank from all the renown ever earned. It has no top and gives no power.
// Returns the rank, the renown it began at and the renown the next one needs.
export function title(earned = profile.earned) {
  const rank = titleRank(earned);
  return { rank, from: titleNeed(rank), next: titleNeed(rank + 1), earned };
}

// ---- The daily challenge: everyone gets the same seed, lord and siege level, with everything unlocked ----
export const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function dailyRun(date = today()) {
  const seed = Number(date.replaceAll('-', ''));
  const next = seededRng(seed ^ 0x5bd1e995);
  for (let i = 0; i < 4; i++) next();
  const lord = LORD_KEYS[Math.floor(next() * LORD_KEYS.length)];
  const siege = 1 + Math.floor(next() * 4);
  const pool = [...ABILITY_KEYS], abilities = [];
  while (abilities.length < 3) abilities.push(pool.splice(Math.floor(next() * pool.length), 1)[0]);
  return { date, seed, opts: { siege, lord, classes: UNIT_KEYS, items: UNLOCKS.items[1], relics: UNLOCKS.relics[1], abilities, daily: true } };
}

// ---- Achievements: each is checked against the summary of a finished run and the profile ----
// A run has no victory any more; what counts is how deep it went. `year` says whether it lasted
// the first year (the fourth boss, on wave 32).
const year = (s) => s.cleared >= YEAR_LEN;
const ACH = {
  first: () => true,
  wave10: (s) => s.cleared >= 10,
  wave20: (s) => s.cleared >= 20,
  victory: (s) => year(s),
  endless40: (s) => s.cleared >= 40,
  wave64: (s) => s.cleared >= 2 * YEAR_LEN,
  wave100: (s) => s.cleared >= 100,
  stone: (s) => s.age >= 1,
  iron: (s) => s.age >= 2,
  gold: (s) => s.age >= 3,
  path: (s) => s.age >= 4,
  lastage: (s) => s.age >= LAST_AGE,
  ascend: (s) => s.age > LAST_AGE,
  allpaths: (s, p) => PATH_KEYS.every((k) => p.paths.includes(k)),
  siege3: (s) => year(s) && s.siege >= 3,
  siege6: (s) => year(s) && s.siege >= 6,
  siege10: (s) => year(s) && s.siege >= 10,
  siege15: (s) => year(s) && s.siege >= 15,
  flawless: (s) => year(s) && s.wallsLost === 0,
  hoarder: (s) => s.items >= 20,
  relics: (s) => s.relics >= 3,
  legends: (s) => s.legends >= 3,
  family: (s) => s.famTiers.some((t) => t >= 3),
  specialists: (s) => s.specs >= 6,
  engineer: (s) => s.turrets >= 10,
  builder: (s) => s.buildings >= 6,
  slayer: (s) => s.kills >= 1000,
  butcher: (s, p) => p.totals.kills >= 10000,
  mutant: (s) => s.muts >= 8,
  swift: (s) => year(s) && s.time < 25 * 60,
  lords3: (s, p) => p.wonWith.length >= 3,
  daily: (s) => s.daily,
};
export const ACH_KEYS = Object.keys(ACH);

// Counts a finished run once: renown, records, totals, the siege ladder, the title and achievements.
// `reward` says how much renown each new achievement is worth. Returns what is new, for the summary screen.
export function award(s, reward = () => 0) {
  if (!s || profile.seen.includes(s.id)) return null;
  profile.seen.push(s.id);
  if (profile.seen.length > 300) profile.seen.shift();
  const out = { renown: s.renown, ach: [], record: false, siege: 0, opened: 0, daily: 0, rank: 0 };
  const before = titleRank(profile.earned);
  const best = profile.best[s.siege] || { wave: 0, wins: 0 }, held = year(s);
  out.record = s.wave > best.wave;
  profile.best[s.siege] = { wave: Math.max(best.wave, s.wave), wins: best.wins + (held ? 1 : 0) };
  profile.lordBest[s.lord] = Math.max(profile.lordBest[s.lord] || 0, s.wave);
  const t = profile.totals;
  t.runs++; t.kills += s.kills; t.bosses += s.bosses; t.time += s.time; t.waves = (t.waves || 0) + s.cleared;
  if (held) { t.wins++; if (!profile.wonWith.includes(s.lord)) profile.wonWith.push(s.lord); }
  if (s.path && s.age >= LAST_AGE && !profile.paths.includes(s.path)) profile.paths.push(s.path);
  // The ladder: the fourth boss at the highest open siege level opens the next one, and every boss
  // after it in the same run opens one more (daily runs do not count).
  const opened = Math.floor(s.cleared / SEASON_LEN) - 3;
  if (opened > 0 && !s.daily && s.siege >= profile.siege && profile.siege < SIEGE_MAX) {
    profile.siege = Math.min(SIEGE_MAX, s.siege + opened);
    out.siege = profile.siege; out.opened = opened;
  }
  if (s.daily) {
    const d = today(), old = profile.daily[d];
    if (!old) out.daily = 15;   // the first daily run of the day pays a little extra
    if (!old || s.wave > old.wave) profile.daily[d] = { wave: s.wave };
    const days = Object.keys(profile.daily).sort();
    while (days.length > 40) delete profile.daily[days.shift()];
  }
  for (const k of ACH_KEYS) {
    if (profile.ach[k] || !ACH[k](s, profile)) continue;
    profile.ach[k] = today();
    out.ach.push(k);
    out.renown += reward(k);
  }
  out.renown += out.daily;
  profile.renown += out.renown; profile.earned += out.renown;
  if (titleRank(profile.earned) > before) out.rank = titleRank(profile.earned);
  profile.runs.unshift({ wave: s.wave, held, siege: s.siege, lord: s.lord, renown: out.renown, age: s.age, ageKey: s.ageKey || null, daily: !!s.daily, retired: !!s.retired, date: today() });
  profile.runs.length = Math.min(profile.runs.length, 12);
  saveProfile();
  return out;
}

// ---- The codex: what the player has met so far ----
export const CODEX = { mon: ENEMIES.map((e) => e.key), unit: UNIT_KEYS, item: ITEM_KEYS, mut: MUTATION_KEYS, wx: WEATHER };
export function discover(kind, keys) {
  let changed = false;
  for (const k of keys) if (CODEX[kind].includes(k) && !profile.codex[kind].includes(k)) { profile.codex[kind].push(k); changed = true; }
  if (changed) saveProfile();
  return changed;
}
export const codexProgress = () => [Object.keys(CODEX).reduce((a, k) => a + profile.codex[k].length, 0), Object.keys(CODEX).reduce((a, k) => a + CODEX[k].length, 0)];

export function resetProfile() {
  // The settings object is shared with the rest of the client, so it is refilled rather than replaced.
  const f = fresh(), keep = { sfx: prefs.sfx, music: prefs.music, volume: prefs.volume, quality: prefs.quality, numbers: prefs.numbers, shake: prefs.shake };
  for (const k of Object.keys(prefs)) delete prefs[k];
  Object.assign(prefs, f.prefs, keep);
  Object.assign(profile, f, { prefs });
  saveProfile();
  setSavedRun(null);
}
export { FAMILIES };
