// Pure game simulation: no network and no timers. step(dt) advances the world,
// snapshot() returns what clients need to draw it. The server owns all rules.
//
// A run is round by round, in the spirit of Brotato and How Many Dudes?:
//   1. Prepare (no clock): pick a wave, spend gold in the shop, build in the courtyard,
//      move defenders, and advance to the next age once a boss has fallen.
//   2. The wave plays out on its own; the commander has three castle abilities.
//   3. Rewards: gold and experience (more for a harder wave), a stat choice for every
//      castle level gained, then the spoils: a new defender, an item, a turret or a blessing.
// Defenders are never bought.
//
// A run has no last wave. A season is eight waves and ends with its boss; four seasons make a
// year. Every season and every day's weather bend the rules for both sides, every boss leaves
// the horde a mutation the commander has to choose, and the horde grows a resistance to
// whatever hurt it most. After the Golden Age the castle follows one of three paths of ages.
// The run ends when the keep falls.
import {
  S, SEG, WALL_T, TH_HALF, TOWER_R, OVER_TIME, START_GOLD, SEASON_LEN, YEAR_LEN, SEASONS, seasonOf, yearOf, MAX_COUNT, MAX_ALIVE, CHARGE_AFTER, FURY_AFTER, FURY_RATE, SPEC_LEVEL, TOWERS,
  SIEGE, SIEGE_TOP, SIEGE_MAX, siegeHp, siegeDmg, siegeMuts, AGES, AGE_CAP, PLOTS_BY_AGE, PATHS, PATH_AGE, LAST_AGE, ageNeed, ageKey, plotsAt, rarityCap,
  ENEMIES, BOSSES, bossIndex, nextBossWave, THEMES, MODS, TIERS, UNITS, UNIT_KEYS, FAMILIES, FAMILY_AT, RARITY, TRAITS,
  SUPPORT_TRAITS, NAMES, SPECS, STATS, STAT_KEYS, ITEMS, ITEM_KEYS, ITEM_PRICE, TURRETS, TURRET_KEYS, TURRET_SPOTS, TURRET_BASE, CASTLE, CAPACITY,
  BUILDINGS, BUILDING_KEYS, BUILD_LEVEL_REQ, buildLevelReq, buildCostMul, buildingCapAt, BUILD_AGE_MUL, PLOTS, DOCTRINES, DOCTRINE_KEYS, EVENTS, LORDS, ABILITIES,
  ABILITY_KEYS, DEFAULT_ABILITIES, hpMul, dmgMul, bossHpMul, pctMul, harvestGrowth, goldMul, budget, lvMul, xpNeed, levelNeed, thMax, wallMul, recruitLevel, renownFor,
  SEASON_FX, WEATHER, WEATHER_BY_SEASON, CALM_WAVES, FORECAST, WEATHER_FX, BOLT_STUN, BOLT_MISS, MUTATIONS, MUTATION_KEYS, MUT_MAX, BOONS, ADAPT, PERKS,
} from './data.js';

export * from './data.js';

const MORTAR_R = 3.5;
const REPAIR_HP_PER_GOLD = 20;
const RULE_AT = Object.fromEntries(SIEGE.map((s, i) => [s.key, i]));
const NO_SPEC = {};
// Who dealt the damage when it was no defender: turrets and wall guns count as engineers.
const TURRET_SRC = { school: 'engineers', traits: [] };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;
const has = (u, t) => u.traits.includes(t);
const spec = (u) => (u.spec ? SPECS[u.k][u.spec - 1] : NO_SPEC);

function buildSegs() {
  const segs = [];
  for (let c = -S + SEG / 2; c < S; c += SEG) {
    segs.push({ x: c, z: -S, hw: SEG / 2, hd: WALL_T });
    segs.push({ x: c, z: S, hw: SEG / 2, hd: WALL_T, gate: c === 0 });
    segs.push({ x: -S, z: c, hw: WALL_T, hd: SEG / 2 });
    segs.push({ x: S, z: c, hw: WALL_T, hd: SEG / 2 });
  }
  for (const s of segs) { s.gate = !!s.gate; s.base = s.gate ? 600 : 400; s.max = s.base; s.hp = s.max; }
  return segs;
}

// Pushes circle e (radius r) out of an axis-aligned box. Returns true on contact.
function pushOutBox(e, r, bx, bz, hw, hd) {
  const cx = clamp(e.x, bx - hw, bx + hw), cz = clamp(e.z, bz - hd, bz + hd);
  const dx = e.x - cx, dz = e.z - cz, d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return false;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    e.x = cx + (dx / d) * r; e.z = cz + (dz / d) * r;
  } else {
    const px = hw + r - Math.abs(e.x - bx), pz = hd + r - Math.abs(e.z - bz);
    if (px < pz) e.x = bx + (e.x >= bx ? 1 : -1) * (hw + r);
    else e.z = bz + (e.z >= bz ? 1 : -1) * (hd + r);
  }
  return true;
}

function pushOutCircle(e, r, cx, cz, cr) {
  const dx = e.x - cx, dz = e.z - cz, d = Math.hypot(dx, dz), min = r + cr;
  if (d >= min) return false;
  if (d < 1e-6) { e.x = cx + min; return true; }
  e.x = cx + (dx / d) * min; e.z = cz + (dz / d) * min;
  return true;
}

// A small seeded generator, so a daily challenge deals everyone the same run.
export function seededRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export class Game {
  // opts: siege (0 and up), lord, classes, items and relics (what the player has unlocked), abilities (three), daily.
  constructor(rng = Math.random, opts = {}) {
    this.rng = rng;
    this.siege = Number.isInteger(opts.siege) && opts.siege >= 0 && opts.siege <= SIEGE_MAX ? opts.siege : 1;
    this.lord = Object.hasOwn(LORDS, opts.lord) ? opts.lord : 'marshal';
    const classes = Array.isArray(opts.classes) ? opts.classes.filter((k) => Object.hasOwn(UNITS, k)) : [];
    this.classes = new Set(classes.length ? classes : UNIT_KEYS);
    const items = Array.isArray(opts.items) ? opts.items.filter((k) => Object.hasOwn(ITEMS, k)) : [];
    this.itemPool = new Set((items.length ? items : ITEM_KEYS).filter((k) => !ITEMS[k].relic));
    // Boss relics: the ones every castle knows, and those the player has unlocked (all of them when not told).
    const relics = Array.isArray(opts.relics) ? opts.relics : null;
    this.relicPool = new Set(ITEM_KEYS.filter((k) => ITEMS[k].relic && (!ITEMS[k].unlock || !relics || relics.includes(k))));
    const abil = Array.isArray(opts.abilities) ? [...new Set(opts.abilities.filter((k) => Object.hasOwn(ABILITIES, k)))].slice(0, 3) : [];
    this.loadout = abil.length === 3 ? abil : [...DEFAULT_ABILITIES];
    this.daily = !!opts.daily;
    this.players = new Set();
    this.nextId = 1;
    this.reset();
  }

  reset() {
    const lord = LORDS[this.lord];
    this.runId = `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
    this.wave = 0;
    this.phase = 'prep';
    this.timer = 0;
    this.gold = START_GOLD + (lord.gold || 0);
    this.age = 0;
    this.path = null;     // the path of ages chosen after the Golden Age
    this.muts = {};       // the horde's mutations: key -> level
    this.adapt = Object.fromEntries(FAMILIES.map((f) => [f, 0]));   // the horde's resistance to each family's damage, in percent
    this.dealt = Object.fromEntries(FAMILIES.map((f) => [f, 0]));   // damage dealt by each family this season
    this.lastAdapt = null;
    this.weather = 'clear'; this.forecast = []; this.dark = false;
    this.b = { hall: 1, walls: 1 };
    this.st = Object.fromEntries(STAT_KEYS.map((k) => [k, lord.mods[k] || 0]));
    this.items = {};
    this.bless = Object.fromEntries(UNIT_KEYS.map((k) => [k, 0]));
    this.turrets = [];
    this.plots = PLOTS.map(() => null);
    this.doctrines = [];
    this.level = 1;
    this.xp = 0;
    this.th = { hp: thMax(1), max: thMax(1) };
    this.segs = buildSegs();
    // A slot is a place a defender can stand: the four towers, then every wall segment.
    this.slots = [...TOWERS.map(([x, z]) => ({ x, z, seg: -1 })), ...this.segs.map((s, i) => ({ x: s.x, z: s.z, seg: i }))];
    this.units = [];
    for (const k of lord.units) this.units.push(this.newUnit(this.baseCard(k), this.freeSlot(k)));
    if (lord.turret) this.turrets.push({ k: lord.turret, lv: 1, spot: 0, cd: 0 });
    this.abil = Object.fromEntries(this.loadout.map((k) => [k, 0]));
    this.rallyT = 0; this.freezeT = 0; this.bountyT = 0; this.signalT = 0; this.standT = 0;
    this.rains = [];
    this.guns = TOWERS.map(() => ({ cd: 0 }));
    this.boltT = 0; this.starT = 0; this.roostT = 0; this.graceUsed = false; this.freeRolls = 0; this.leaping = false;
    this.enemies = []; this.later = []; this.projs = []; this.clouds = []; this.mines = []; this.shells = [];
    this.fx = [];
    this.queue = [];
    this.spawnT = 0; this.spawnGap = 1; this.waveT = 0; this.battleT = 0;
    this.reached = 0;
    this.hpMul = 1; this.bossMul = 1; this.dmgMul = 1; this.goldMul = 1; this.armorMul = 1; this.speedMul = 1; this.wallDmg = 1; this.pct = 1; this.hx = 1;
    this.mod = null;
    this.reward = 0; this.rewardXp = 0; this.spoilLuck = 0;
    this.picks = [];
    this.resume = false;
    this.rerolls = 0; this.pickRerolls = 0;
    this.shop = [];
    this.capBonus = 0; this.eggAt = 0; this.lust = 0; this.phoenixUsed = false; this.wallsLost = 0;
    this.lastEvent = null; this.scouted = false;
    this.stats = { kills: 0, earned: 0, bosses: 0 };
    this.bossWaves = 0;   // boss waves cleared: each one opens the next age
    this.best = null; this.summary = null;
    this.haste = {}; this.guard = {}; this.thornSeg = {}; this.empower = {}; this.dread = {}; this.tinkerSpeed = 0;
    // High on the siege ladder the horde starts the run with mutations of its own.
    for (let i = siegeMuts(this.siege); i > 0; i--) {
      const pool = MUTATION_KEYS.filter((k) => this.mut(k) < MUT_MAX);
      const k = pool[Math.floor(this.rng() * pool.length)];
      this.muts[k] = this.mut(k) + 1;
    }
    this.fillForecast();
    this.e = this.env(1, this.forecast[0]);
    this.refreshDerived();
    this.makeWaveOffers();
    this.makeShop();
  }

  // Everything the client needs to name and draw things. The same for every game.
  layout() {
    return {
      S,
      segs: this.segs.map((s) => ({ x: s.x, z: s.z, hw: s.hw, hd: s.hd, gate: s.gate })),
      towers: TOWERS,
      thHalf: TH_HALF,
      slots: this.slots.map((p) => [p.x, p.z, p.seg]),
      turretSpots: TURRET_SPOTS,
      plots: PLOTS,
      castle: Object.fromEntries(Object.entries(CASTLE).map(([k, d]) => [k, { max: d.max }])),
      ages: AGES, ageCap: AGE_CAP, plotsByAge: PLOTS_BY_AGE, paths: PATHS, pathAge: PATH_AGE, lastAge: LAST_AGE, perks: PERKS,
      seasonLen: SEASON_LEN, yearLen: YEAR_LEN, seasons: SEASONS, seasonFx: SEASON_FX, weather: WEATHER, weatherFx: WEATHER_FX,
      mutations: MUTATIONS, mutMax: MUT_MAX, adapt: ADAPT, siegeTop: SIEGE_TOP,
      units: UNIT_KEYS, unitStats: UNITS, specs: SPECS, specLevel: SPEC_LEVEL,
      families: FAMILIES, familyAt: FAMILY_AT,
      rarity: RARITY.map((r) => r.key), traits: TRAITS,
      stats: STATS, items: ITEMS, turrets: TURRETS, turretKeys: TURRET_KEYS,
      buildings: BUILDINGS, buildingKeys: BUILDING_KEYS, buildLevelReq: BUILD_LEVEL_REQ,
      doctrines: DOCTRINES, events: EVENTS,
      enemies: ENEMIES, bosses: BOSSES, themes: THEMES.map((t) => t.key), mods: MODS, tiers: TIERS,
      capacity: CAPACITY.slice(0, 21),
      siege: SIEGE.map((s) => s.key), lords: LORDS, abilities: ABILITIES,
    };
  }

  addPlayer() {
    const id = this.nextId++;
    this.players.add(id);
    return id;
  }

  removePlayer(id) {
    this.players.delete(id);
    if (this.players.size === 0) this.reset();
  }

  // Starts a fresh run once the castle has fallen, without waiting for the timer.
  restart(id) {
    if (this.phase !== 'over' || !this.can(id)) return false;
    this.reset();
    return true;
  }

  can(id) { return this.players.has(id); }
  count(key) { return this.items[key] || 0; }
  fxCount(fx) { let n = 0; for (const k in this.items) if (ITEMS[k].fx === fx) n += this.items[k]; return n; }
  doc(key) { return this.doctrines.includes(key); }
  rule(key) { return this.siege >= RULE_AT[key]; }
  lordRule(key) { return LORDS[this.lord].rule === key; }
  bLv(key) { const p = this.plots.find((x) => x && x.k === key); return p ? p.lv : 0; }
  army() { return this.units.filter((u) => !u.temp); }
  mut(key) { return this.muts[key] || 0; }
  // Whether the power of a path age is at work: every age reached on the chosen path keeps its power.
  perk(key) { return !!this.path && PATHS[this.path].ages.indexOf(key) >= 0 && this.age - AGES.length >= PATHS[this.path].ages.indexOf(key); }
  critMul() { return this.count('titanhammer') ? 3 : 2; }
  // Slows and curses lose strength against a warded horde; frost bites harder in the snow.
  wardMul() { return Math.max(0.2, 1 - 0.2 * this.mut('ward')); }
  slowMul() { return this.wardMul() * this.e.frost; }

  // ---- The calendar: seasons and weather ----

  // The season and the weather of wave n, as the numbers the rules use. A season's gift is
  // doubled for the druid; its burden is not.
  env(n, weather = 'clear') {
    const sf = SEASON_FX[SEASONS[seasonOf(n)]], wf = WEATHER_FX[weather] || {}, twice = this.lordRule('seasons') ? 2 : 1;
    const gift = (v) => 1 + (v - 1) * twice;
    const lantern = this.fxCount('lantern') > 0;
    return {
      harvest: !sf.harvest ? 1 : sf.harvest > 1 ? gift(sf.harvest) : this.fxCount('seedvault') ? 1 : sf.harvest,
      repair: (sf.repair || 0) * twice,
      gold: sf.gold ? gift(sf.gold) : 1,
      luck: (sf.luck || 0) * twice + (wf.luck || 0),
      horde: sf.horde || 1,
      hp: sf.hp || 1,
      speed: (!sf.speed ? 1 : sf.speed < 1 ? gift(sf.speed) : sf.speed) * (wf.speed || 1),
      range: (sf.range ? gift(sf.range) : 1) * (lantern ? 1 : wf.range || 1),
      foeRange: wf.range || 1,
      burn: wf.burn || 1, chain: wf.chain || 0, fly: wf.fly || 1, cloud: wf.cloud || 1, bolt: wf.bolt || 0, reload: wf.reload || 1, frost: wf.frost || 1,
    };
  }

  rollWeather(n) {
    if (n <= CALM_WAVES) return 'clear';
    const w = WEATHER_BY_SEASON[seasonOf(n)];
    let r = this.rng() * w.reduce((a, b) => a + b, 0), i = 0;
    while (i < w.length - 1 && r >= w[i]) { r -= w[i]; i++; }
    return WEATHER[i];
  }

  // The weather of the coming waves is always known a few waves ahead.
  fillForecast() { while (this.forecast.length < FORECAST) this.forecast.push(this.rollWeather(this.wave + 1 + this.forecast.length)); }

  // Moves the run to just before wave n (for tests and the testing shortcuts).
  jump(n) {
    this.wave = Math.max(0, n - 1);
    this.forecast = []; this.fillForecast();
    this.e = this.env(this.wave + 1, this.forecast[0]);
    this.makeWaveOffers(); this.makeShop();
  }

  // ---- Derived numbers: stats from picks, items, buildings, the age and doctrines ----

  // Recomputes everything that depends on stats, items, buildings and the army.
  refreshDerived() {
    const tot = { ...this.st };
    for (const k in this.items) for (const [s, v] of Object.entries(ITEMS[k].mods || {})) tot[s] += v * this.items[k];
    for (const p of this.plots) if (p) for (const [s, v] of Object.entries(BUILDINGS[p.k].mods || {})) tot[s] += v * p.lv;
    // Every age brings better arms and stonework.
    tot.dmg += 10 * this.age; tot.wallhp += 10 * this.age;
    if (this.perk('obsidian')) tot.wallhp += PERKS.obsidian.wallhp;
    if (this.perk('crystal')) tot.crit += PERKS.crystal.crit;
    if (this.doc('luckystar')) tot.luck += 40;
    if (this.doc('masons')) tot.wallhp += 20;
    if (this.doc('highground')) tot.range += 10;
    this.tot = tot;
    const fam = Object.fromEntries(FAMILIES.map((f) => [f, this.fxCount(`fam:${f}`)]));
    for (const u of this.units) fam[UNITS[u.k].fam]++;
    this.famCount = fam;
    this.famTier = Object.fromEntries(FAMILIES.map((f) => [f, FAMILY_AT.filter((n) => fam[f] >= n).length]));
    // Walls and keep follow their stats at once, keeping the damage they have taken.
    const wm = wallMul(this.b.walls) * Math.max(0.2, 1 + tot.wallhp / 100);
    for (const s of this.segs) { const m = Math.round(s.base * wm); if (s.hp > 0) s.hp = Math.max(1, s.hp + m - s.max); s.max = m; }
    const km = Math.max(100, thMax(this.b.hall) + tot.keephp);
    if (this.th) { this.th.hp = Math.max(1, this.th.hp + km - this.th.max); this.th.max = km; }
  }

  // How much damage reaching walls and keep is reduced.
  guardMul(seg = -1) {
    let m = 1 / (1 + Math.max(0, this.tot.armor) / 50);
    m *= 1 - 0.08 * this.famTier.wardens;
    if (this.doc('shieldwall')) m *= 0.8;
    if (this.perk('steel')) m *= PERKS.steel.guard;
    if (seg >= 0) m *= 1 - (this.guard[seg] || 0);
    return m;
  }

  capacity() { return Math.min(this.slots.length, CAPACITY[this.b.walls] + (this.doc('conscription') ? 4 : 0) + (this.count('kingsseal') ? 3 : 0) + this.capBonus); }
  turretSpots() { return Math.min(TURRET_SPOTS.length, TURRET_BASE + this.bLv('workshop') + (this.doc('clockwork') ? 2 : 0)); }
  shopSize() { const m = this.bLv('market'); return Math.min(8, 4 + (m >= 1) + (m >= 3) + (m >= 5) + (this.doc('wareconomy') ? 1 : 0)); }
  plotCount() { return Math.min(PLOTS.length, plotsAt(this.age) + (this.lordRule('builder') ? 1 : 0)); }
  buildingCap() { return buildingCapAt(this.age); }
  castleCap() { return AGE_CAP * (this.age + 1); }
  siegeGold() { return (SIEGE[Math.min(this.siege, SIEGE_TOP)].gold || 1) * (this.rule('lean') ? 0.85 : 1); }

  // ---- Rarity: better with the wave, luck and a harder wave; capped by the age ----
  rollRarity(bonus = 0, floor = 0) {
    const n = this.wave + 1, luck = 1 + Math.max(-90, this.tot.luck + bonus) / 100;
    const top = this.age >= LAST_AGE ? Math.min(0.04, Math.max(0, (n - 44) / 500)) * luck : 0;
    const myth = top + (this.age >= 3 ? Math.min(0.06, Math.max(0, (n - 28) / 300)) * luck : 0);
    const leg = Math.min(0.15, Math.max(0, (n - 8) / 150)) * luck;
    const epic = Math.min(0.3, Math.max(0, (n - 3) / 60)) * luck;
    const rare = Math.min(0.6, 0.12 + n / 40) * luck;
    const r = this.rng();
    const got = r < top ? 5 : r < myth ? 4 : r < myth + leg ? 3 : r < myth + leg + epic ? 2 : r < myth + leg + epic + rare ? 1 : 0;
    return Math.min(rarityCap(this.age), Math.max(floor, got));
  }

  // ---- Ages ----

  // What the next age needs: its boss slain, a castle level and gold. The fifth age also needs a
  // path to be chosen; after the third age of the path every step is an ascension (asc counts them).
  ageReq() {
    const next = this.age + 1, a = ageNeed(next);
    return {
      next, boss: this.bossWaves >= next, level: this.level >= a.level, needLevel: a.level, cost: a.gold, gold: this.gold >= a.gold,
      wave: next * SEASON_LEN, bt: BOSSES[(next - 1) % BOSSES.length], choose: next === AGES.length, asc: Math.max(0, next - LAST_AGE),
      key: next < AGES.length ? AGES[next].key : this.path ? ageKey(next, this.path) : null,
    };
  }

  advanceAge(id, path) {
    const r = this.ageReq();
    if (this.phase !== 'prep' || !this.can(id) || !r.boss || !r.level || !r.gold) return false;
    if (r.choose && !Object.hasOwn(PATHS, path)) return false;
    this.gold -= r.cost;
    if (r.choose) this.path = path;
    this.age = r.next;
    this.refreshDerived();
    this.fx.push([30, 0, 0, this.age]);
    // A path age musters one of its two new classes; an ascension brings two great stat choices.
    if (this.age > LAST_AGE) this.picks.push({ type: 'level', floor: 3 }, { type: 'level', floor: 3 });
    else if (this.age >= AGES.length) this.picks.push({ type: 'muster' });
    this.picks.push({ type: 'doctrine' });
    this.resume = true;   // come back to this same preparation afterwards
    this.nextPick();
    return true;
  }

  // ---- Waves: two or three offers, the commander picks one ----

  // Every offer has a tier (standard, hard, deadly), a theme and sometimes a modifier.
  // Harder tiers bring more monsters and pay more gold, more experience and luckier spoils.
  // Through the first year they are a little smaller than afterwards (TIERS.pts1).
  makeWaveOffers() {
    const n = this.wave + 1, rng = this.rng, env = this.env(n, this.forecast[0]);
    const open = THEMES.filter((th) => (th.w ? Object.keys(th.w).every((t) => ENEMIES[t].unlock <= n) : n >= th.unlock));
    const tiers = ['std', 'hard'];
    if (this.bLv('watchtower') || this.scouted) tiers.push('deadly');
    for (let i = tiers.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [tiers[i], tiers[j]] = [tiers[j], tiers[i]]; }
    const pick = [];
    while (pick.length < tiers.length) {
      const th = open[Math.floor(rng() * open.length)];
      if (!pick.includes(th) || open.length < tiers.length) pick.push(th);
    }
    const regular = ENEMIES.map((e, t) => t).filter((t) => !ENEMIES[t].boss && ENEMIES[t].unlock <= n);
    const bi = bossIndex(n), bossWave = bi >= 0;
    // Mutations: a larger horde, more champions, a second boss, raids by night.
    const swell = env.horde * (1 + 0.1 * this.mut('swell'));
    const champs = bossWave || n < 6 ? 0 : (this.rule('champions') ? 1 : 0) + this.mut('champions');
    const twin = bossWave && this.mut('twin') ? BOSSES[(bi + 1) % BOSSES.length] : -1;
    const night = this.mut('raids') > 0 && n % (5 - this.mut('raids')) === 0;
    const glory = (tier) => (!this.lordRule('glory') ? 1 : tier === 'std' ? 0.85 : 1.25);
    this.waves = pick.map((th, i) => {
      const tier = tiers[i], T = TIERS[tier];
      const jitter = tier === 'std' ? 1 : (n < 6 ? 0.87 : 1) + rng() * 0.27;
      const chance = n < 8 ? 0 : this.rule('omens') ? 1 : tier === 'std' ? 0.2 : tier === 'hard' ? 0.4 : 1;
      const mod = rng() < chance ? MODS[Math.floor(rng() * MODS.length)] : null;
      const pts = budget(n) * (n <= YEAR_LEN ? T.pts1 : T.pts) * jitter * swell * (bossWave ? 0.6 : 1) * (mod === 'swarm' ? 1.5 : mod === 'giants' ? 0.55 : 1);
      const w = th.w || Object.fromEntries(regular.map((t) => [t, 1 / regular.length]));
      const c = ENEMIES.map(() => 0);
      for (const t in w) c[t] = Math.max(1, Math.round((pts * w[t]) / ENEMIES[t].points));
      if (c[0] && c.reduce((a, b) => a + b, 0) < 3) c[0] = 3;
      // A huge wave comes as fewer elites with the same total strength.
      const total = c.reduce((a, b) => a + b, 0);
      let hx = total > MAX_COUNT ? total / MAX_COUNT : 1;
      if (hx > 1) for (const t in c) if (c[t]) c[t] = Math.max(1, Math.round(c[t] / hx));
      if (mod === 'swarm') hx *= 0.7; else if (mod === 'giants') hx *= 1.9;
      if (bossWave) {
        if (n % YEAR_LEN === 0 && this.rule('apocalypse')) for (const b of BOSSES) c[b] = 1;
        else c[BOSSES[bi % BOSSES.length]] = tier === 'deadly' || (tier === 'hard' && bi >= 2) ? 2 : 1;   // two at once on the harder offers, later on
      }
      let champ = -1;
      if (champs) { let bw = 0; for (const t in w) if (w[t] > bw) { bw = w[t]; champ = Number(t); } }
      const bonus = (mod ? 1.25 : 1) * glory(tier);
      return {
        c, tier, hard: tier !== 'std', th: th.key, hx: r2(hx), mod, champ, champs: champ >= 0 ? champs : 0, twin, night, luck: T.luck + env.luck,
        gold: Math.round((20 + 6 * n) * goldMul(n) * this.siegeGold() * T.gold * bonus * env.gold),
        xp: Math.round(budget(n) * 0.5 * T.xp * bonus),
      };
    });
    this.scouted = false;
  }

  chooseWave(id, i) {
    if (this.phase !== 'prep' || !this.can(id) || !Number.isInteger(i) || !this.waves[i]) return false;
    this.startWave(this.waves[i]);
    return true;
  }

  startWave(offer) {
    const n = ++this.wave;
    this.phase = 'wave';
    this.weather = this.forecast.shift() || 'clear';
    this.fillForecast();
    const env = this.e = this.env(n, this.weather);
    this.reward = offer.gold; this.rewardXp = offer.xp || 0; this.spoilLuck = offer.luck || 0;
    this.hx = offer.hx || 1;
    this.mod = offer.mod || null;
    this.dark = this.mod === 'night' || !!offer.night;
    const types = [], bosses = [];
    offer.c.forEach((count, t) => { for (let i = 0; i < count; i++) (ENEMIES[t].boss ? bosses : types).push({ t }); });
    // Winged brood: some of the runners hatch as gloomwings.
    const wings = 0.08 * this.mut('wings');
    if (wings) for (const q of types) if (q.t === 0 && this.rng() < wings) q.t = 4;
    for (let i = types.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [types[i], types[j]] = [types[j], types[i]];
    }
    // Twin lords: a second boss of another kind. The royal guard: elite brutes at each boss's side.
    if (offer.twin >= 0) bosses.push({ t: offer.twin, scale: 0.25 + 0.25 * this.mut('twin') });
    for (const b of bosses) {
      types.splice(Math.floor(types.length * 0.4), 0, b);
      for (let i = 2 * this.mut('escort'); i > 0; i--) types.splice(Math.floor(types.length * 0.4), 0, { t: 1, scale: 2 });
    }
    const champs = offer.champ >= 0 ? offer.champs || 1 : 0;
    for (let i = 0; i < champs; i++) types.splice(Math.floor(types.length * Math.max(0.1, 0.5 - 0.12 * i)), 0, { t: offer.champ, champ: true });
    const dirs = [];
    for (let i = 1 + (n >= 4) + (n >= 8) + (n >= 25); i > 0; i--) dirs.push(this.rng() * Math.PI * 2);
    const tough = this.siegeTough() * env.hp;
    this.hpMul = hpMul(n) * tough;
    this.bossMul = bossHpMul(n) * tough ** 0.85 * this.bossTough();
    this.dmgMul = dmgMul(n) * this.siegeCruel();
    this.speedMul = (this.rule('swift') ? 1.12 : 1) * (this.mod === 'frenzied' ? 1.3 : 1) * env.speed * (1 + 0.07 * this.mut('frenzy'));
    this.wallDmg = 1 + 0.15 * this.mut('breach');
    this.pct = pctMul(n);
    this.goldMul = goldMul(n) * this.siegeGold();
    this.armorMul = 1 + 0.03 * (n - 1);
    this.queue = types.map((q) => ({ ...q, a: dirs[Math.floor(this.rng() * dirs.length)] + (this.rng() - 0.5) * 0.7 }));
    this.spawnGap = Math.max(0.12, 0.9 - n * 0.05);
    this.spawnT = 0;
    this.waveT = 0;
    this.lust = 0;
    this.waves = [];
    for (const u of this.units) { u.cd = 0; u.stun = 0; u.sick = 0; u.bl = 0; u.ramp = 0; u.last = 0; u.rt = 0; }
    for (const s of this.segs) { s.ward = this.perk('rune'); s.wardT = 0; }
    this.guns.forEach((g, i) => { g.cd = 0.6 * i; });
    for (const k of this.loadout) this.abil[k] = 0;
    this.rallyT = 0; this.freezeT = 0; this.bountyT = 0; this.signalT = 0; this.standT = 0;
    this.boltT = env.bolt; this.starT = PERKS.star.every; this.roostT = PERKS.dragon.every; this.graceUsed = false;
    this.rains = []; this.mines = [];
  }

  // How much tougher and crueller the siege level makes the horde.
  siegeTough() { return siegeHp(this.siege) * (this.rule('tough') ? 1.15 : 1) * (this.rule('apocalypse') ? 1.25 : 1); }
  siegeCruel() { return siegeDmg(this.siege) * (this.rule('cruel') ? 1.2 : 1) * (1 + 0.1 * this.mut('savage')); }
  bossTough() { return (this.rule('warlords') ? 1.35 : 1) * (1 + 0.15 * this.mut('might')); }

  // A monster of type t at (x, z). Bosses grow more slowly than the horde; elites are stronger.
  makeEnemy(t, x, z, scale = 1, champ = false) {
    const d = ENEMIES[t], elite = d.boss ? 1 : this.hx;
    const grow = d.boss ? this.bossMul : this.hpMul;
    const plated = t === 1 || t === 6 || t === 12 ? 1 + 0.25 * this.mut('plated') : 1;
    const hp = Math.max(1, Math.round(d.hp * grow * elite * scale * (champ ? 5 : 1) * plated));
    return {
      id: this.nextId++, t, x, z, hp, max: hp, cd: this.rng(), slow: 0, slowK: 0, burn: 0, burnDps: 0, curse: 0, curseK: 0, haste: 0,
      hold: -2, bt: 2, pt: d.pcd ? d.pcd * 0.6 : 0, mark: -1, markT: 0, hx: elite * scale, champ, under: !!d.burrow,
      stun: 0, shell: this.mut('shell') && this.rng() < 0.34 * this.mut('shell') ? 1 : 0, fate: 0, risen: false,
    };
  }

  spawn({ t, a, champ, scale }) {
    const dist = 52 + this.rng() * 8;
    const e = this.makeEnemy(t, Math.sin(a) * dist, Math.cos(a) * dist, scale || 1, !!champ);
    // Tunnelers: some runners and brutes dig under the walls, as burrowers do.
    if ((t === 0 || t === 1) && !champ && this.mut('tunnel') && this.rng() < 0.08 * this.mut('tunnel')) e.under = true;
    this.enemies.push(e);
  }

  // Gold from harvesting after wave n: more in spring, half in winter.
  harvestGold(n = this.wave) { return Math.max(0, Math.round(this.tot.harvest * this.env(Math.max(1, n)).harvest)); }

  // Interest on unspent gold from the piggy bank, the mint and the treasury doctrine, each with its own cap.
  interest(gold) {
    const n = this.wave, cap = 15 * n * goldMul(n);
    let sum = 0;
    if (this.count('piggy')) sum += Math.min(gold * 0.1, cap);
    const mint = this.bLv('mint');
    if (mint) sum += Math.min(gold * 0.03 * mint, cap * mint * 0.5);
    if (this.doc('treasury')) sum += Math.min(gold * 0.08, cap);
    return Math.round(sum);
  }

  // How much of the damage the castle folk mend for free after a wave.
  freeRepair() { return this.doc('masons') ? 1 : Math.min(0.95, 0.5 + 0.08 * this.bLv('chapel') + this.e.repair); }

  endWave() {
    const n = this.wave;
    const income = Math.round(this.reward * (this.doc('wareconomy') ? 1.4 : 1)) + this.harvestGold(n) + this.interest(this.gold);
    this.gold += income;
    this.stats.earned += income;
    // Harvesting grows after every wave: 5% in the first year, half as fast in each year after it.
    if (this.st.harvest > 0) this.st.harvest = r1(this.st.harvest * (1 + (this.fxCount('seedvault') ? 0.05 : harvestGrowth(n))));
    this.units = this.units.filter((u) => !u.temp);
    for (const u of this.units) this.giveXp(u, n * 0.6);
    this.projs = []; this.shells = []; this.later = []; this.clouds = []; this.mines = []; this.rains = [];
    const f = this.freeRepair();
    for (const s of this.segs) s.hp = s.hp > 0 ? s.hp + (s.max - s.hp) * f : s.max * (f >= 1 ? 1 : 1 / 3);
    this.th.hp += (this.th.max - this.th.hp) * f;
    // Rewards, in order: level-ups, the spoils, a boss relic, the horde's mutation, an event.
    this.castleXp(this.rewardXp);
    const boss = bossIndex(n) >= 0;
    if (boss) this.bossWaves++;
    this.picks.push({ type: 'spoils', luck: this.spoilLuck + (boss ? 60 : 0) });
    if (boss) {
      // A season ends with its boss: the horde learns from it and keeps one new trait.
      this.picks.push({ type: 'relic' });
      this.adaptNow();
      this.picks.push({ type: 'mutation', boss: bossIndex(n) % BOSSES.length });
      if (n % YEAR_LEN === 0) this.fx.push([45, 0, 0, yearOf(n)]);
    }
    if (n % 4 === 2 && !boss) this.picks.push({ type: 'event' });
    if (this.eggAt && n >= this.eggAt) {
      const pool = [...this.itemPool].filter((k) => ITEMS[k].r === 3 && !(ITEMS[k].unique && this.items[k]));
      const k = pool.length ? pool[Math.floor(this.rng() * pool.length)] : 'kingsbanner';
      this.addItem(k);
      this.fx.push([32, 0, 0, k]);
      this.eggAt = 0;
    }
    this.pickRerolls = 0;
    this.refreshDerived();
    this.nextPick();
  }

  // The horde learns from the season that has just ended: it resists the family that hurt it
  // most a little more, and forgets a little of what it knew about the others.
  adaptNow() {
    const total = FAMILIES.reduce((a, f) => a + this.dealt[f], 0);
    let top = null;
    if (this.bossWaves >= ADAPT.from) {
      for (const f of FAMILIES) if (this.dealt[f] > 0 && (!top || this.dealt[f] > this.dealt[top])) top = f;
      if (top && this.dealt[top] / total < ADAPT.share) top = null;
      for (const f of FAMILIES) this.adapt[f] = f === top ? Math.min(ADAPT.cap, this.adapt[f] + ADAPT.gain) : Math.max(ADAPT.floor, this.adapt[f] - ADAPT.fade);
      this.fx.push([46, 0, 0, top || '']);
    }
    this.lastAdapt = top;
    for (const f of FAMILIES) this.dealt[f] = 0;
  }

  // ---- Rewards between waves ----

  // Moves on to the next pending choice, or to preparation when there is none.
  nextPick() {
    while (this.picks.length) {
      const p = this.picks[0];
      if (p.opts) break;
      p.opts = this.optionsFor(p);
      if (p.opts.length) break;
      this.picks.shift();   // nothing to offer (every relic owned, say): skip it
    }
    if (this.picks.length) { this.phase = 'reward'; return; }
    this.phase = 'prep';
    if (this.resume) { this.resume = false; return; }   // back to the preparation we came from
    this.rerolls = 0;
    this.freeRolls = this.perk('steam') ? PERKS.steam.rolls : 0;
    this.e = this.env(this.wave + 1, this.forecast[0]);   // what the panels show is for the coming wave
    this.makeWaveOffers();
    this.makeShop();
  }

  optionsFor(p) {
    if (p.type === 'level') return this.levelOptions(p.floor || 0);
    if (p.type === 'spoils') return this.spoilsOptions(p.luck);
    if (p.type === 'relic') return this.relicOptions();
    if (p.type === 'doctrine') return this.doctrineOptions();
    if (p.type === 'event') return this.eventOptions(p);
    if (p.type === 'mutation') return this.mutationOptions(p);
    if (p.type === 'muster') return this.musterOptions();
    return [];
  }

  levelOptions(least = 0) {
    const keys = [...STAT_KEYS], opts = [];
    // Every fifth level is guaranteed to be rare or better.
    const floor = Math.max(least, this.level % 5 === 0 ? 1 : 0), want = 4 + (this.count('ancienttome') ? 1 : 0);
    while (opts.length < want) {
      const s = keys.splice(Math.floor(this.rng() * keys.length), 1)[0];
      opts.push({ stat: s, r: Math.min(3, Math.max(floor, this.rollRarity())) });
    }
    return opts;
  }

  // Spoils: a new defender (or a promotion when the walls are full), an item, a turret or a blessing.
  spoilsOptions(luck = 0) {
    const want = clamp(3 + (this.count('poster') ? 1 : 0) + (this.bLv('tavern') >= 3 ? 1 : 0) + (this.doc('luckystar') ? 1 : 0) - (this.rule('scarce') ? 1 : 0), 2, 6);
    const floor = this.count('queencrown') ? 1 : 0, opts = [this.recruitOption(luck, floor)];
    for (let tries = 0; opts.length < want && tries < 60; tries++) {
      const r = this.rng();
      let o;
      if (r < 0.4) o = this.itemOption(luck, floor);
      else if (r < 0.62) o = this.turretOption();
      else if (r < 0.8) o = this.blessOption(luck);
      else o = this.recruitOption(luck, floor);
      if (o && !opts.some((x) => JSON.stringify(x) === JSON.stringify(o))) opts.push(o);
    }
    return opts;
  }

  recruitOption(luck, floor = 0) {
    const army = this.army();
    if (army.length < this.capacity()) return { type: 'recruit', card: this.makeCard(luck, floor) };
    // The walls are full: either one of the garrison is promoted, or a newcomer offers to take
    // the place of the weakest defender.
    if (this.rng() < 0.5) {
      const u = army[Math.floor(this.rng() * army.length)];
      return { type: 'promote', uid: u.uid, k: u.k, name: u.name, rar: u.rar };
    }
    return this.swapOption(this.makeCard(luck, floor)) || { type: 'promote', uid: army[0].uid, k: army[0].k, name: army[0].name, rar: army[0].rar };
  }

  // The weakest defender who stands where a newcomer of class k may stand.
  weakest(k) {
    let weak = null, ws = Infinity;
    for (const u of this.army()) {
      if (this.wallOnly(k) && this.slots[u.slot].seg < 0) continue;
      const s = RARITY[u.rar].mul * lvMul(u.lv) * (u.spec ? 1.15 : 1);
      if (s < ws) { ws = s; weak = u; }
    }
    return weak;
  }

  // A recruit for full walls: they take the post of the weakest defender and inherit most of their experience.
  swapOption(card) {
    const weak = this.weakest(card.k);
    if (!weak) return null;
    return { type: 'recruit', card: { ...card, lv: Math.max(card.lv, Math.round(weak.lv * 0.8)) }, swap: weak.uid, out: { k: weak.k, name: weak.name, rar: weak.rar, lv: weak.lv } };
  }

  // A new age of the path musters one of its two new classes.
  musterOptions() {
    const full = this.army().length >= this.capacity(), opts = [];
    for (const k of UNIT_KEYS) {
      if (UNITS[k].path !== this.path || UNITS[k].age !== this.age + 1) continue;
      const card = this.makeCard(60, 1, k), o = full ? this.swapOption(card) : { type: 'recruit', card };
      if (o) opts.push(o);
    }
    return opts;
  }

  // ---- Mutations: the horde's legacy from every boss ----

  // Three mutations the horde does not have in full yet: two from the legacy of the boss that
  // has just fallen and one from another. Each comes with a boon for the commander.
  mutationOptions(p) {
    const open = MUTATION_KEYS.filter((k) => this.mut(k) < MUT_MAX), want = 3 + (this.lordRule('foresight') ? 1 : 0);
    const own = open.filter((k) => MUTATIONS[k].from === p.boss), other = open.filter((k) => MUTATIONS[k].from !== p.boss);
    const take = (pool) => pool.splice(Math.floor(this.rng() * pool.length), 1)[0];
    const keys = [];
    while (keys.length < want - 1 && own.length) keys.push(take(own));
    while (keys.length < want && other.length) keys.push(take(other));
    while (keys.length < want && own.length) keys.push(take(own));
    // Each option comes with a different kind of boon, so the choice is never between two of the same.
    const used = new Set();
    return keys.map((key) => { const boon = this.rollBoon(MUTATIONS[key].sev, used); used.add(boon.k); return { key, lv: this.mut(key) + 1, boon }; });
  }

  // What the commander gets with a mutation. The harsher ones (sev 2) pay double.
  // used: kinds of boon the other options of the same choice already carry.
  rollBoon(sev, used = new Set()) {
    const gold = { k: 'gold', v: Math.round(60 * goldMul(this.wave + 1) * sev) };
    const pool = BOONS.filter((b) => !used.has(b) && (b !== 'relic' || (sev > 1 && this.relicsLeft().length)) && (b !== 'promote' || this.army().length));
    if (!pool.length) return gold;
    const k = pool[Math.floor(this.rng() * pool.length)];
    if (k === 'level') return { k, v: sev };
    if (k === 'item') { const key = this.itemOfRarity(1 + sev); return key ? { k, key } : gold; }
    if (k === 'stat') return { k, stat: STAT_KEYS[Math.floor(this.rng() * STAT_KEYS.length)], r: 1 + sev };
    if (k === 'promote') return { k, v: sev };
    if (k === 'relic') return { k };
    return gold;
  }

  applyBoon(b) {
    if (b.k === 'gold') { this.gold += b.v; this.stats.earned += b.v; }
    else if (b.k === 'level') for (let i = 0; i < b.v; i++) { this.level++; this.picks.push({ type: 'level' }); }
    else if (b.k === 'item') this.addItem(b.key);
    else if (b.k === 'stat') this.st[b.stat] += STATS[b.stat][b.r];
    else if (b.k === 'promote') [...this.army()].sort((x, y) => y.kills - x.kills).slice(0, b.v).forEach((u) => this.promote(u));
    else if (b.k === 'relic') this.picks.push({ type: 'relic' });
  }

  // One rarity up; a defender at the top rarity of the age gains three levels instead.
  promote(u) {
    if (u.rar < rarityCap(this.age)) { u.p = r3(u.p * (RARITY[u.rar + 1].mul / RARITY[u.rar].mul)); u.rar++; } else u.lv += 3;
    this.fx.push([9, this.slots[u.slot].x, this.slots[u.slot].z, u.rar]);
  }

  // An item of the given rarity (or the next one below that the castle may still take).
  itemOfRarity(rar) {
    for (; rar >= 0; rar--) {
      const pool = [...this.itemPool].filter((k) => ITEMS[k].r === rar && !(ITEMS[k].unique && this.items[k]));
      if (pool.length) return pool[Math.floor(this.rng() * pool.length)];
    }
    return null;
  }

  relicsLeft() { return [...this.relicPool].filter((k) => !this.items[k]); }

  itemOption(luck, floor = 0) {
    for (let rar = Math.min(3, this.rollRarity(luck, floor)); rar >= 0; rar--) {
      const pool = [...this.itemPool].filter((k) => ITEMS[k].r === rar && !(ITEMS[k].unique && this.items[k]));
      if (pool.length) return { type: 'item', key: pool[Math.floor(this.rng() * pool.length)] };
    }
    return null;
  }

  turretOption() {
    const pool = TURRET_KEYS.filter((k) => TURRETS[k].age <= this.age + 1);
    const k = pool[Math.floor(this.rng() * pool.length)];
    if (!this.turrets.some((t) => t.k === k) && this.turrets.length >= this.turretSpots()) return null;
    return { type: 'turret', k };
  }

  blessOption(luck) {
    const present = [...new Set(this.army().map((u) => u.k))];
    if (!present.length) return null;
    const k = present[Math.floor(this.rng() * present.length)];
    return { type: 'bless', k, v: [1, 1, 2, 3, 3][this.rollRarity(luck)] };
  }

  relicOptions() {
    const pool = this.relicsLeft(), opts = [], want = 3 + (this.lordRule('trophy') ? 1 : 0);
    while (opts.length < want && pool.length) opts.push({ type: 'item', key: pool.splice(Math.floor(this.rng() * pool.length), 1)[0] });
    return opts;
  }

  // Three doctrines the castle does not follow yet; those of families on the walls come up more often.
  doctrineOptions() {
    const pool = DOCTRINE_KEYS.filter((k) => !this.doc(k)).map((k) => {
      const f = DOCTRINES[k].fam;
      return [k, f ? (this.famCount[f] ? 3 : 0.5) : 2];
    });
    const opts = [];
    while (opts.length < 3 && pool.length) {
      let r = this.rng() * pool.reduce((a, p) => a + p[1], 0), i = 0;
      while (i < pool.length - 1 && r >= pool[i][1]) { r -= pool[i][1]; i++; }
      opts.push({ key: pool.splice(i, 1)[0][0] });
    }
    return opts;
  }

  // An event is a short story with two or three ways out; each option says what it costs and gives.
  eventOptions(p) {
    const n = this.wave + 1, g = goldMul(n), rng = this.rng;
    const pool = EVENTS.filter((e) => e !== this.lastEvent && !(e === 'egg' && this.eggAt));
    const ev = pool[Math.floor(rng() * pool.length)];
    p.ev = ev;
    this.lastEvent = ev;
    const army = this.army();
    if (ev === 'caravan') {
      const o = this.itemOption(200, 2);
      return [...(o ? [{ k: 'buy', item: o.key, gold: Math.round(this.priceOf(o) * 0.5) }] : []), { k: 'toll', gain: Math.round(30 * g) }];
    }
    if (ev === 'deserters') return [{ k: 'take', card: this.makeCard(80, 1) }, { k: 'refuse', xp: Math.round(budget(n) * 0.4) }];
    if (ev === 'plague') return [{ k: 'pay', gold: Math.round(25 * g) }, { k: 'endure', hp: Math.round(this.th.max * 0.15) }];
    if (ev === 'smith') {
      const u = army[Math.floor(rng() * army.length)];
      return [{ k: 'hone', gold: Math.round(30 * g), uid: u.uid, name: u.name, unit: u.k }, { k: 'drill', gold: Math.round(90 * g) }, { k: 'pass' }];
    }
    if (ev === 'shrine') {
      const s = STAT_KEYS[Math.floor(rng() * STAT_KEYS.length)];
      return [{ k: 'offer', gold: Math.round(35 * g), stat: s, r: Math.min(3, this.rollRarity(100, 1)) }, { k: 'pray' }, { k: 'pass' }];
    }
    if (ev === 'gambler') return [{ k: 'bet', gold: Math.floor(this.gold / 2) }, { k: 'pass' }];
    if (ev === 'refugees') return [{ k: 'shelter', gold: Math.round(20 * g) }, { k: 'away', gain: Math.round(25 * g) }];
    if (ev === 'egg') return [{ k: 'keep', wave: this.wave + 5 }, { k: 'sell', gain: Math.round(60 * g) }];
    if (ev === 'mercs') return [{ k: 'hire', gold: Math.round(40 * g) }, { k: 'pass' }];
    return [{ k: 'feast', gold: Math.round(40 * g) }, { k: 'modest' }];   // festival
  }

  // Applies one event option. Returns false when it cannot be afforded or done.
  applyEvent(o) {
    if (o.gold && this.gold < o.gold) return false;
    const army = this.army();
    if (o.k === 'buy') this.addItem(o.item);
    else if (o.k === 'toll' || o.k === 'away' || o.k === 'sell') { this.gold += o.gain; this.stats.earned += o.gain; }
    else if (o.k === 'take') {
      const slot = this.freeSlot(o.card.k);
      if (slot < 0 || army.length >= this.capacity()) return false;
      this.units.push(this.newUnit(o.card, slot));
      this.fx.push([8, this.slots[slot].x, this.slots[slot].z, o.card.rar]);
    } else if (o.k === 'refuse') this.castleXp(o.xp);
    else if (o.k === 'endure') this.th.hp = Math.max(1, this.th.hp - o.hp);
    else if (o.k === 'hone') { const u = this.unit(o.uid); if (!u) return false; u.lv += 3; }
    else if (o.k === 'drill' || o.k === 'feast') { for (const u of army) u.lv++; }
    else if (o.k === 'offer') this.st[o.stat] += STATS[o.stat][o.r];
    else if (o.k === 'pray') {
      const present = [...new Set(army.map((u) => u.k))];
      if (this.rng() < 0.5 && present.length) { const k = present[Math.floor(this.rng() * present.length)]; this.bless[k]++; this.fx.push([34, 0, 0, k]); } else this.fx.push([34, 0, 0, '']);
    } else if (o.k === 'bet') {
      if (this.rng() < 0.5) { this.gold += o.gold * 2; this.fx.push([35, 0, 0, o.gold]); } else this.fx.push([35, 0, 0, -o.gold]);
    } else if (o.k === 'shelter') this.capBonus = Math.min(4, this.capBonus + 1);
    else if (o.k === 'keep') this.eggAt = o.wave;
    else if (o.k === 'hire') {
      // Two sellswords stand on the walls for the next wave only.
      for (let i = 0; i < 2; i++) {
        const k = ['archer', 'crossbow', 'mage'][Math.floor(this.rng() * 3)], slot = this.freeSlot(k);
        if (slot < 0) break;
        const d = UNITS[k];
        const u = this.newUnit({ k, rar: 2, lv: recruitLevel(this.wave + 1) + 2, p: r3(d.p * RARITY[2].mul), cd: d.cd, range: d.range, traits: [], name: 'Sellsword' }, slot);
        u.temp = true;
        this.units.push(u);
      }
    } else if (o.k === 'modest') this.st.luck += 8;
    if (o.gold) this.gold -= o.gold;
    return true;
  }

  // A random defender with their own rolled stats, from the classes of this age and earlier.
  // `only` asks for one class (the muster of a new age).
  makeCard(luck = 0, floor = 0, only = null) {
    const n = this.wave + 1, rng = this.rng;
    const open = UNIT_KEYS.filter((c) => UNITS[c].age <= this.age + 1 && (!UNITS[c].path || UNITS[c].path === this.path) && this.classes.has(c));
    const all = open.length ? open : ['archer'];
    // Half the time the recruit comes from a family already on the walls, so builds can grow.
    const owned = new Set(this.units.map((u) => UNITS[u.k].fam)), kin = all.filter((c) => owned.has(UNITS[c].fam));
    const pool = kin.length && rng() < 0.5 ? kin : all;
    // Fighters come up twice as often as support classes, so an army can always hurt something.
    // The classes of the newest age of the path come up twice as often again.
    const weight = (c) => (this.support(c) ? 1 : 2) * (UNITS[c].path && UNITS[c].age === this.age + 1 ? 2 : 1);
    let roll = rng() * pool.reduce((a, c) => a + weight(c), 0), pi = 0;
    while (pi < pool.length - 1 && roll >= weight(pool[pi])) { roll -= weight(pool[pi]); pi++; }
    const k = only || pool[pi], d = UNITS[k];
    const rar = this.rollRarity(luck, floor);
    const tpool = this.support(k) ? SUPPORT_TRAITS : TRAITS, traits = [];
    for (let want = [0, 1, 1, 2, 2, 2][rar]; traits.length < want;) {
      const t = tpool[Math.floor(rng() * tpool.length)];
      if (!traits.includes(t)) traits.push(t);
    }
    return {
      k, rar, traits,
      lv: recruitLevel(n) + (traits.includes('veteran') ? 2 : 0) + this.bLv('barracks') + (this.doc('conscription') ? 1 : 0),
      name: NAMES[Math.floor(rng() * NAMES.length)],
      p: r3(d.p * RARITY[rar].mul * (0.88 + rng() * 0.24)),
      cd: r2(d.cd * (0.9 + rng() * 0.2)),
      range: r1(d.range * (0.93 + rng() * 0.14)),
    };
  }

  baseCard(k) { const d = UNITS[k]; return { k, rar: 0, lv: 1, p: d.p, cd: d.cd, range: d.range, traits: [] }; }
  // Classes that help others rather than hurt monsters.
  support(k) { const d = UNITS[k]; return !!(d.heal || d.aura || d.guard || d.curse || d.tinker || d.empower || d.fate); }

  rollMul() { return this.lordRule('cheaprolls') ? 0.5 : 1; }
  pickRerollCost() { return Math.round((4 + 2 * this.wave) * (1 + 0.5 * this.pickRerolls) * Math.max(0.25, 1 - 0.15 * this.bLv('library')) * this.rollMul()); }

  // Chooses option i of the pending reward.
  choose(id, i) {
    const p = this.picks[0];
    if (this.phase !== 'reward' || !p || !this.can(id) || !Number.isInteger(i)) return false;
    const o = p.opts[i];
    if (!o) return false;
    if (p.type === 'level') this.st[o.stat] += STATS[o.stat][o.r];
    else if (p.type === 'mutation') {
      this.muts[o.key] = this.mut(o.key) + 1;
      this.applyBoon(o.boon);
      this.fx.push([47, 0, 0, o.key]);
    } else if (p.type === 'doctrine') {
      this.doctrines.push(o.key);
      if (o.key === 'veterans') for (const u of this.army()) u.lv += 2;
    } else if (p.type === 'event') { if (!this.applyEvent(o)) return false; }
    else if (!this.applySpoil(o)) return false;
    this.fx.push([6, 0, 0, p.type]);
    this.picks.shift();
    this.pickRerolls = 0;
    this.refreshDerived();
    this.nextPick();
    return true;
  }

  applySpoil(o) {
    if (o.type === 'recruit') {
      let slot;
      if (o.swap) {
        // The newcomer takes over the post of the defender who leaves.
        const old = this.unit(o.swap);
        if (!old || (this.wallOnly(o.card.k) && this.slots[old.slot].seg < 0)) return false;
        slot = old.slot;
        this.units = this.units.filter((u) => u !== old);
      } else {
        slot = this.freeSlot(o.card.k);
        if (slot < 0 || this.army().length >= this.capacity()) return false;
      }
      this.units.push(this.newUnit(o.card, slot));
      this.fx.push([8, this.slots[slot].x, this.slots[slot].z, o.card.rar]);
    } else if (o.type === 'promote') {
      const u = this.unit(o.uid);
      if (!u) return false;
      this.promote(u);
    } else if (o.type === 'item') this.addItem(o.key);
    else if (o.type === 'turret') { if (!this.addTurret(o.k)) return false; }
    else if (o.type === 'bless') this.bless[o.k] += o.v;
    return true;
  }

  // Skipping the spoils pays a little gold instead.
  skipGold() { return Math.round(10 * goldMul(this.wave + 1)); }

  skip(id) {
    const p = this.picks[0];
    if (this.phase !== 'reward' || !p || (p.type !== 'spoils' && p.type !== 'muster') || !this.can(id)) return false;
    if (p.type === 'spoils') this.gold += this.skipGold();
    this.picks.shift();
    this.pickRerolls = 0;
    this.nextPick();
    return true;
  }

  rerollPick(id) {
    const p = this.picks[0];
    if (this.phase !== 'reward' || !p || (p.type !== 'level' && p.type !== 'spoils') || !this.can(id)) return false;
    const cost = this.pickRerollCost();
    if (this.gold < cost) return false;
    this.gold -= cost;
    this.pickRerolls++;
    p.opts = this.optionsFor(p);
    return true;
  }

  addItem(k) {
    this.items[k] = (this.items[k] || 0) + 1;
    this.refreshDerived();
  }

  addTurret(k) {
    const t = this.turrets.find((x) => x.k === k);
    if (t) { t.lv++; this.fx.push([9, TURRET_SPOTS[t.spot][0], TURRET_SPOTS[t.spot][1], 1]); return true; }
    if (this.turrets.length >= this.turretSpots()) return false;
    const used = new Set(this.turrets.map((x) => x.spot));
    const spot = TURRET_SPOTS.findIndex((_, i) => !used.has(i));
    this.turrets.push({ k, lv: 1, spot, cd: 0 });
    this.fx.push([8, TURRET_SPOTS[spot][0], TURRET_SPOTS[spot][1], 1]);
    return true;
  }

  // ---- The shop: offers of items and turrets, lockable, rerollable ----

  priceOf(o) {
    const n = this.wave + 1, base = o.type === 'item' ? ITEM_PRICE[ITEMS[o.key].r] : TURRETS[o.k].price;
    return Math.round(base * goldMul(n) * (1 + 0.1 * n + 0.002 * n * n) * Math.max(0.5, 1 - 0.04 * this.bLv('market')));
  }

  shopOffer() {
    if (this.rng() < 0.25) return this.turretOption() || this.itemOption(0);
    return this.itemOption(0) || this.turretOption();
  }

  // Fills every unlocked place with a new offer; locked offers stay, at their old price.
  makeShop() {
    const old = this.shop || [], seen = new Set();
    const id = (o) => o.key || o.k;
    for (const o of old) if (o && o.locked) seen.add(id(o));
    this.shop = Array.from({ length: this.shopSize() }, (_, i) => {
      if (old[i] && old[i].locked) return old[i];
      // No offer twice in one shop.
      let o = null;
      for (let tries = 0; tries < 12 && (!o || seen.has(id(o))); tries++) o = this.shopOffer();
      if (!o || seen.has(id(o))) return null;
      seen.add(id(o));
      return { ...o, price: this.priceOf(o), locked: false };
    });
  }

  // The steam engines restock the shop once a wave for nothing.
  shopRerollCost() { return this.freeRolls > 0 ? 0 : Math.round((5 + 2 * this.wave) * (1 + 0.5 * this.rerolls) * this.rollMul()); }

  rerollShop(id) {
    if (this.phase !== 'prep' || !this.can(id)) return false;
    const cost = this.shopRerollCost();
    if (this.gold < cost) return false;
    this.gold -= cost;
    if (this.freeRolls > 0) this.freeRolls--; else this.rerolls++;
    this.makeShop();
    return true;
  }

  lock(id, i) {
    if (this.phase !== 'prep' || !this.can(id) || !Number.isInteger(i) || !this.shop[i]) return false;
    this.shop[i].locked = !this.shop[i].locked;
    return true;
  }

  buy(id, i) {
    if (this.phase !== 'prep' || !this.can(id) || !Number.isInteger(i) || !this.shop[i]) return false;
    const o = this.shop[i];
    if (this.gold < o.price) return false;
    if (o.type === 'turret' && !this.turrets.some((t) => t.k === o.k) && this.turrets.length >= this.turretSpots()) return false;
    this.gold -= o.price;
    if (o.type === 'item') this.addItem(o.key); else this.addTurret(o.k);
    this.shop[i] = null;
    return true;
  }

  // ---- Defenders ----

  newUnit(card, slot) {
    return {
      uid: this.nextId++, slot, k: card.k, name: card.name || NAMES[Math.floor(this.rng() * NAMES.length)], rar: card.rar, lv: card.lv, xp: 0,
      p: card.p, rcd: card.cd, range: card.range, traits: [...card.traits], kills: 0, cd: 0, spec: 0, stun: 0,
    };
  }

  // Spearmen, shieldbearers and sappers belong on the walls, not in the towers.
  wallOnly(k) { const d = UNITS[k]; return !!(d.melee || d.guard || d.mine); }

  // A new defender takes the free slot furthest from everyone else, so the walls fill evenly.
  freeSlot(k) {
    const used = new Set(this.units.map((u) => u.slot)), wallOnly = this.wallOnly(k);
    let best = -1, bd = -1;
    this.slots.forEach((s, i) => {
      if (used.has(i) || (wallOnly && s.seg < 0)) return;
      let d = Infinity;
      for (const u of this.units) { const o = this.slots[u.slot]; d = Math.min(d, Math.hypot(o.x - s.x, o.z - s.z)); }
      if (d > bd) { bd = d; best = i; }
    });
    return best;
  }

  unit(uid) { return this.units.find((u) => u.uid === uid); }

  // Moves a defender to another place on the walls; whoever stands there swaps over.
  move(id, uid, slot) {
    const u = this.unit(uid);
    if (!u || this.phase !== 'prep' || !this.can(id) || !Number.isInteger(slot) || !this.slots[slot] || u.slot === slot) return false;
    if (this.wallOnly(u.k) && this.slots[slot].seg < 0) return false;
    const other = this.units.find((o) => o.slot === slot);
    if (other && this.wallOnly(other.k) && this.slots[u.slot].seg < 0) return false;
    if (other) other.slot = u.slot;
    u.slot = slot;
    return true;
  }

  // At SPEC_LEVEL a defender picks one of the two paths of their class, once.
  canSpecialize(u) { return !u.spec && !u.temp && u.lv >= SPEC_LEVEL; }

  specialize(id, uid, branch) {
    const u = this.unit(uid);
    if (!u || (this.phase !== 'prep' && this.phase !== 'reward') || !this.can(id) || !this.canSpecialize(u) || (branch !== 1 && branch !== 2)) return false;
    u.spec = branch;
    this.fx.push([9, this.slots[u.slot].x, this.slots[u.slot].z, 3]);
    return true;
  }

  trainCost(u) { return Math.round(22 * (1 + 0.5 * u.rar) * u.lv ** 1.15); }

  train(id, uid) {
    const u = this.unit(uid);
    if (!u || u.temp || this.phase !== 'prep' || !this.can(id)) return false;
    const cost = this.trainCost(u);
    if (this.gold < cost) return false;
    this.gold -= cost;
    u.lv++;
    this.fx.push([9, this.slots[u.slot].x, this.slots[u.slot].z, u.rar]);
    return true;
  }

  refund(u) { return Math.round(4 * u.lv * (1 + u.rar)); }

  // Sends a defender home for a little gold, freeing their place on the walls.
  dismiss(id, uid) {
    const u = this.unit(uid);
    if (!u || u.temp || this.phase !== 'prep' || !this.can(id) || this.army().length <= 1) return false;
    this.gold += this.refund(u);
    this.units = this.units.filter((o) => o !== u);
    this.refreshDerived();
    return true;
  }

  giveXp(u, xp) {
    if (u.temp) return;
    u.xp += xp * (has(u, 'scholar') ? 1.75 : 1) * (1 + this.tot.xp / 100) * (1 + 0.15 * this.bLv('barracks'))
      * (this.doc('veterans') ? 1.5 : 1) * (1 + 0.25 * this.count('drillbook'));
    while (u.xp >= xpNeed(u.lv)) {
      u.xp -= xpNeed(u.lv);
      u.lv++;
      this.fx.push([9, this.slots[u.slot].x, this.slots[u.slot].z, u.rar]);
    }
  }

  // Castle experience from kills and cleared waves; every level queues a stat choice.
  castleXp(pts) {
    this.xp += pts * (1 + this.tot.xp / 100) * (this.bountyT > 0 ? 2 : 1);
    while (this.xp >= levelNeed(this.level)) {
      this.xp -= levelNeed(this.level);
      this.level++;
      this.picks.push({ type: 'level' });
      this.fx.push([15, 0, 0, this.level]);
    }
  }

  // Effective stats, with every bonus applied.
  supportPower(u) {
    const d = UNITS[u.k];
    return u.p * (spec(u).pm || 1) * (1 + 0.06 * (u.lv - 1)) * (1 + 0.2 * this.bless[u.k])
      * (d.fam === 'faith' ? (1 + 0.25 * this.famTier.faith) * (this.doc('sanctuary') ? 1.3 : 1) : 1);
  }

  unitPower(u) {
    const d = UNITS[u.k], sp = spec(u), m = lvMul(u.lv) * (1 + 0.2 * this.bless[u.k]) * (sp.pm || 1);
    const faith = (1 + 0.25 * this.famTier.faith) * (this.doc('sanctuary') ? 2 : 1);
    if (d.heal === 'walls') return u.p * m * wallMul(this.b.walls) * Math.max(0.2, 1 + this.tot.wallhp / 100) * faith;
    if (d.heal === 'keep') return u.p * m * (1 + 0.3 * (this.b.hall - 1)) * faith;
    if (d.aura || d.guard || d.curse || d.tinker || d.empower || d.fate) return this.supportPower(u);
    let v = u.p * m * Math.max(0.1, 1 + this.tot.dmg / 100);
    if (d.elem) v *= Math.max(0.1, 1 + this.tot.elem / 100);
    if (d.fam === 'arcane') v *= 1 + 0.15 * this.famTier.arcane;
    if (d.fam === 'engineers') v *= (1 + 0.15 * this.famTier.engineers) * (d.mine && this.doc('clockwork') ? 2 : 1);
    if (d.melee && this.doc('shieldwall')) v *= 1.5;
    if (this.lordRule('mixed')) v *= 1 + 0.04 * FAMILIES.filter((f) => this.famCount[f] > 0).length;
    return v * (1 + (this.empower[u.slot] || 0));
  }
  // What a seraph's smite does to a monster: their prayer turned into a weapon.
  smitePower(u) { return u.p * lvMul(u.lv) * (1 + 0.2 * this.bless[u.k]) * (spec(u).pm || 1) * Math.max(0.1, 1 + this.tot.dmg / 100); }
  unitReload(u) {
    const haste = Math.max(0.25, 1 + this.tot.aspd / 100 + (this.haste[u.slot] || 0) + (this.rallyT > 0 ? 0.5 : 0)
      + (this.doc('bloodlust') ? Math.min(0.6, this.lust * 0.004) : 0));
    const slowed = this.e.reload * (1 + (this.dread[u.slot] || 0)) * (u.sick > 0 ? 1 + 0.1 * this.mut('venom') : 1);
    return (u.rcd * (spec(u).cdm || 1) * slowed) / (haste * (has(u, 'quick') ? 1.25 : 1));
  }
  unitRange(u) {
    const d = UNITS[u.k], tower = this.slots[u.slot].seg < 0 && !d.melee ? (this.doc('highground') ? 0.3 : 0.15) : 0;
    const fam = d.fam === 'marksmen' ? 0.1 * this.famTier.marksmen : 0;
    const song = d.aura && this.doc('sanctuary') ? 1.5 : 1;
    return u.range * (spec(u).rm || 1) * song * Math.max(0.3, 1 + this.tot.range / 100 + fam + tower) * (has(u, 'eagle') ? 1.2 : 1) * this.reach();
  }
  // What the season, the weather and a signal fire do to every defender's and turret's reach.
  reach() { return this.e.range * (this.signalT > 0 ? 1.3 : 1); }
  // Night shortens every range unless the void lantern burns.
  nightMul() { return this.dark && !this.fxCount('lantern') ? 0.8 : 1; }
  unitCrit(u) {
    const d = UNITS[u.k];
    return Math.min(1, Math.max(0, this.tot.crit / 100 + (d.crit || 0) + (spec(u).cr || 0) + (has(u, 'crit') ? 0.15 : 0) + (d.fam === 'marksmen' ? 0.05 * this.famTier.marksmen : 0)));
  }
  areaMul() { return (1 + 0.15 * this.famTier.alchemy) * (this.doc('wildfire') ? 1.2 : 1); }
  dotMul() { return (1 + 0.25 * this.famTier.alchemy + 0.5 * this.fxCount('burn')) * (this.doc('wildfire') ? 2 : 1); }

  turretPower(t) {
    const armorers = this.units.filter((u) => u.k === 'tinker' && spec(u).tdmg).length;
    const lv = t.lv + (this.perk('steam') ? PERKS.steam.levels : 0);
    return TURRETS[t.k].p * (1 + 0.5 * (lv - 1)) * Math.max(0.1, 1 + this.tot.eng / 100) * (1 + 0.15 * this.famTier.engineers) * (1 + 0.15 * armorers);
  }

  // ---- The castle: keep and walls ----

  upgrade(id, key) {
    if (!Object.hasOwn(CASTLE, key) || this.phase !== 'prep' || !this.can(id)) return false;
    const d = CASTLE[key], l = this.b[key];
    if (l >= d.max || l >= this.castleCap() || (key !== 'hall' && l >= this.b.hall) || this.gold < d.cost[l]) return false;
    this.gold -= d.cost[l];
    this.b[key] = l + 1;
    this.refreshDerived();
    this.fx.push([4, 0, 0, key]);
    return true;
  }

  repairCost(what) {
    const missing = what === 'hall' ? this.th.max - this.th.hp : this.segs.reduce((a, s) => a + s.max - s.hp, 0);
    return Math.ceil((missing / REPAIR_HP_PER_GOLD) * (this.perk('steel') ? PERKS.steel.repair : 1));
  }

  // Repairs as much as the gold allows, spread evenly over the damage.
  repair(id, what) {
    if ((what !== 'hall' && what !== 'walls') || this.phase !== 'prep' || !this.can(id)) return false;
    const cost = this.repairCost(what);
    if (cost <= 0 || this.gold <= 0) return false;
    const pay = Math.min(cost, this.gold), f = pay / cost;
    this.gold -= pay;
    if (what === 'hall') this.th.hp = Math.min(this.th.max, this.th.hp + (this.th.max - this.th.hp) * f);
    else for (const s of this.segs) s.hp = Math.min(s.max, s.hp + (s.max - s.hp) * f);
    return true;
  }

  // ---- Courtyard buildings: each needs gold and a castle level, and a plot to stand on ----

  buildingCost(k, lv) {
    return Math.round(BUILDINGS[k].cost * BUILD_AGE_MUL[BUILDINGS[k].age - 1] * buildCostMul(lv) * (this.lordRule('builder') ? 0.75 : 1));
  }

  build(id, plot, k) {
    if (this.phase !== 'prep' || !this.can(id) || !Number.isInteger(plot) || plot < 0 || plot >= this.plotCount() || this.plots[plot]) return false;
    if (!Object.hasOwn(BUILDINGS, k) || BUILDINGS[k].age > this.age + 1 || this.bLv(k) || this.level < BUILD_LEVEL_REQ[1]) return false;
    const cost = this.buildingCost(k, 1);
    if (this.gold < cost) return false;
    this.gold -= cost;
    this.plots[plot] = { k, lv: 1, paid: cost };
    this.refreshDerived();
    this.fx.push([29, PLOTS[plot][0], PLOTS[plot][1], k]);
    return true;
  }

  upgradeBuilding(id, plot) {
    const p = Number.isInteger(plot) ? this.plots[plot] : null;
    if (this.phase !== 'prep' || !this.can(id) || !p || p.lv >= this.buildingCap() || this.level < buildLevelReq(p.lv + 1)) return false;
    const cost = this.buildingCost(p.k, p.lv + 1);
    if (this.gold < cost) return false;
    this.gold -= cost;
    p.lv++;
    p.paid += cost;
    this.refreshDerived();
    this.fx.push([29, PLOTS[plot][0], PLOTS[plot][1], p.k]);
    return true;
  }

  // Pulls a building down for half of what it cost, freeing the plot.
  demolish(id, plot) {
    const p = Number.isInteger(plot) ? this.plots[plot] : null;
    if (this.phase !== 'prep' || !this.can(id) || !p) return false;
    this.gold += Math.floor(p.paid / 2);
    this.plots[plot] = null;
    this.refreshDerived();
    return true;
  }

  // ---- Castle abilities ----

  abilityCd(k) { return ABILITIES[k].cd * (this.count('tactics') ? 0.7 : 1) * (this.count('hourglassages') ? 0.65 : 1); }

  ability(id, k, x = 0, z = 0) {
    if (this.phase !== 'wave' || !this.can(id) || !Object.hasOwn(this.abil, k) || this.abil[k] > 0) return false;
    if (k === 'volley' || k === 'meteor' || k === 'caltrops') {
      if (typeof x !== 'number' || typeof z !== 'number' || !Number.isFinite(x) || !Number.isFinite(z)) return false;
      x = clamp(x, -60, 60); z = clamp(z, -60, 60);
      const big = k === 'meteor';
      if (k === 'caltrops') {
        // A field of spikes: whatever walks across it is slowed by half and bleeds.
        this.clouds.push({ id: this.nextId++, x, z, r: ABILITIES[k].r, t: ABILITIES[k].t, dps: this.volleyDamage() * 0.15, u: null, spike: true });
        this.fx.push([57, r2(x), r2(z), ABILITIES[k].r]);
      } else {
        this.rains.push({ x, z, t: big ? 1.5 : 0.8, r: ABILITIES[k].r, dmg: this.volleyDamage() * (big ? 3 : 1), big });
        this.fx.push([19, r2(x), r2(z), ABILITIES[k].r, big ? 1 : 0]);
      }
    } else if (k === 'signal') {
      this.signalT = ABILITIES.signal.t;
      this.fx.push([58, 0, 0, 0]);
    } else if (k === 'laststand') {
      this.standT = ABILITIES.laststand.t;
      this.fx.push([59, 0, 0, 0]);
    } else if (k === 'mend') {
      for (const s of this.segs) s.hp = s.hp > 0 ? Math.min(s.max, s.hp + s.max * 0.25) : s.max * 0.2;
      this.fx.push([20, 0, 0, 0]);
    } else if (k === 'rally') {
      this.rallyT = ABILITIES.rally.t;
      this.fx.push([21, 0, 0, 0]);
    } else if (k === 'freeze') {
      this.freezeT = ABILITIES.freeze.t;
      this.fx.push([36, 0, 0, 0]);
    } else if (k === 'bountyhunt') {
      this.bountyT = ABILITIES.bountyhunt.t;
      this.fx.push([37, 0, 0, 0]);
    }
    this.abil[k] = this.abilityCd(k);
    return true;
  }

  // The volley lands a moment after it is called, hitting everything under it.
  volleyDamage() { return 40 * this.hpMul * this.pct * Math.sqrt(Math.max(0.1, 1 + this.tot.dmg / 100)); }

  updateAbilities(dt) {
    for (const k of this.loadout) this.abil[k] = Math.max(0, this.abil[k] - dt);
    this.rallyT = Math.max(0, this.rallyT - dt);
    this.freezeT = Math.max(0, this.freezeT - dt);
    this.bountyT = Math.max(0, this.bountyT - dt);
    this.signalT = Math.max(0, this.signalT - dt);
    this.standT = Math.max(0, this.standT - dt);
    // Whatever was called down from the sky lands: arrows, meteors, a skycaller's pillar, a falling star.
    for (const r of this.rains) {
      r.t -= dt;
      if (r.t > 0) continue;
      this.fx.push([1, r2(r.x), r2(r.z), r.r, r.pillar ? 3 : r.star ? 4 : r.big ? 1 : 0]);
      for (const e of this.enemies) if (!e.under && Math.hypot(e.x - r.x, e.z - r.z) < r.r + ENEMIES[e.t].r) this.hurtEnemy(e, r.dmg, r.u || null, !!r.pierce);
    }
    this.rains = this.rains.filter((r) => r.t > 0);
  }

  // ---- Simulation ----

  step(dt) {
    if (this.players.size === 0) return;
    if (this.phase === 'over') {
      this.timer -= dt;
      if (this.timer <= 0) this.reset();
      return;
    }
    if (this.phase !== 'wave') return;   // preparation and rewards have no clock
    this.waveT += dt;
    this.battleT += dt;
    this.spawnT -= dt;
    while (this.spawnT <= 0 && this.queue.length) { this.spawn(this.queue.pop()); this.spawnT += this.spawnGap; }
    this.updateAbilities(dt);
    this.updateSupport(dt);
    this.updateEnemies(dt);
    this.updateUnits(dt);
    this.updateTurrets(dt);
    this.updateProjs(dt);
    this.updateHazards(dt);
    this.updateSky(dt);
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    if (this.later.length) { this.enemies.push(...this.later); this.later = []; }
    if (this.th.hp <= 0 && this.perk('celestial') && !this.graceUsed) {
      // Grace: once a wave the keep survives the blow that would have felled it.
      this.graceUsed = true;
      this.th.hp = this.th.max * PERKS.celestial.grace;
      this.fx.push([55, 0, 0, 0]);
    }
    if (this.th.hp <= 0 && this.count('phoenix') && !this.phoenixUsed) {
      // The phoenix: the keep rises from the ashes, ruined walls stand again and the fire
      // sweeps the courtyard clean (bosses are only singed).
      this.phoenixUsed = true;
      this.th.hp = this.th.max * 0.5;
      for (const sg of this.segs) if (sg.hp <= 0) sg.hp = sg.max * 0.5;
      for (const e of this.enemies) {
        if (e.hp > 0 && !e.under && Math.max(Math.abs(e.x), Math.abs(e.z)) < S) this.hurtEnemy(e, e.max * (ENEMIES[e.t].boss ? 0.15 : 1), null, true, false, false);
      }
      this.enemies = this.enemies.filter((e) => e.hp > 0);
      this.fx.push([33, 0, 0, 0]);
    }
    if (this.th.hp <= 0) this.fall();
    else if (!this.queue.length && !this.enemies.length) this.endWave();
  }

  // Gives the castle up before it falls. The run ends and counts as it stands.
  retire(id) {
    if (this.phase === 'over' || !this.can(id)) return false;
    this.fall(true);
    return true;
  }

  // The end of a run: the keep has fallen, or the commander has given the castle up. The summary
  // is what the player's profile is built from: renown, records and achievements.
  // wave is the wave the run ended on, cleared the waves won, seasons the boss waves among them.
  fall(retired = false) {
    const cleared = this.phase === 'wave' ? this.wave - 1 : this.wave;
    if (!retired) this.th.hp = 0;
    this.phase = 'over'; this.timer = OVER_TIME; this.reached = this.wave;
    const army = this.army(), top = [...army].sort((a, b) => b.kills - a.kills)[0];
    this.best = top ? { name: top.name, k: top.k, kills: top.kills, lv: top.lv } : null;
    const s = {
      id: this.runId, wave: this.wave, cleared, seasons: this.bossWaves, year: yearOf(Math.max(1, this.wave)), retired,
      kills: this.stats.kills, bosses: this.stats.bosses, earned: Math.round(this.stats.earned),
      age: this.age, path: this.path, ageKey: ageKey(this.age, this.path), muts: Object.values(this.muts).reduce((a, b) => a + b, 0),
      siege: this.siege, lord: this.lord, level: this.level, daily: this.daily, time: Math.round(this.battleT),
      items: Object.values(this.items).reduce((a, b) => a + b, 0), relics: Object.keys(this.items).filter((k) => ITEMS[k].relic).length,
      legends: army.filter((u) => u.rar >= 3).length, specs: army.filter((u) => u.spec).length, units: army.length,
      famTiers: FAMILIES.map((f) => this.famTier[f]), wallsLost: this.wallsLost, turrets: this.turrets.reduce((a, t) => a + t.lv, 0),
      buildings: this.plots.filter(Boolean).length, doctrines: this.doctrines.length, topKills: top ? top.kills : 0,
    };
    s.renown = renownFor(s);
    this.summary = s;
    this.enemies = []; this.queue = []; this.projs = []; this.shells = []; this.later = []; this.clouds = []; this.mines = []; this.rains = []; this.picks = [];
  }

  // Bards hasten, runesmiths empower, shieldbearers guard, tinkers speed up turrets, and walls
  // and keep mend themselves. A boss's dread slows the defenders near it.
  updateSupport(dt) {
    this.haste = {}; this.guard = {}; this.thornSeg = {}; this.empower = {}; this.dread = {};
    let tink = 0;
    for (const u of this.units) {
      const d = UNITS[u.k], post = this.slots[u.slot];
      if (u.stun > 0 || (post.seg >= 0 && this.segs[post.seg].hp <= 0)) continue;
      if (d.aura || d.empower) {
        const p = this.supportPower(u), r = this.unitRange(u), to = d.aura ? this.haste : this.empower;
        for (const o of this.units) if (o !== u && Math.hypot(this.slots[o.slot].x - post.x, this.slots[o.slot].z - post.z) <= r) to[o.slot] = Math.min(0.6, (to[o.slot] || 0) + p);
      } else if (d.guard && post.seg >= 0) {
        const p = Math.min(0.7, this.supportPower(u)), thorns = spec(u).thorns || 0;
        this.segs.forEach((s, i) => {
          const q = Math.hypot(s.x - post.x, s.z - post.z);
          const g = i === post.seg ? p : q < SEG + 0.1 ? p / 2 : 0;
          if (g > (this.guard[i] || 0)) this.guard[i] = g;
        });
        if (thorns) this.thornSeg[post.seg] = Math.max(this.thornSeg[post.seg] || 0, thorns);
      } else if (d.tinker) tink += this.supportPower(u);
    }
    this.tinkerSpeed = Math.min(1, tink);
    const dread = 0.12 * this.mut('dread');
    if (dread) {
      for (const e of this.enemies) {
        if (!ENEMIES[e.t].boss || e.hp <= 0) continue;
        for (const u of this.units) if (Math.hypot(this.slots[u.slot].x - e.x, this.slots[u.slot].z - e.z) < 12) this.dread[u.slot] = dread;
      }
    }
    const regen = this.tot.regen * wallMul(this.b.walls) * dt, rune = this.perk('rune') ? PERKS.rune.regen * dt : 0;
    for (const s of this.segs) {
      if (s.wardT > 0) s.wardT -= dt;
      if ((regen > 0 || rune) && s.hp > 0 && s.hp < s.max) s.hp = Math.min(s.max, s.hp + regen + s.max * rune);
    }
    const mend = (this.perk('celestial') ? PERKS.celestial.regen : 0) + (this.fxCount('heart') ? 0.003 : 0);
    if (mend && this.th.hp > 0) this.th.hp = Math.min(this.th.max, this.th.hp + this.th.max * mend * dt);
  }

  // Deals damage, after curses, the horde's adaptation and armour. u is the defender who dealt
  // it, if any (turrets pass a stand-in so their damage counts for the engineers).
  // Direct hits are reported to the client as damage numbers; burning, poison and oil are not.
  hurtEnemy(e, dmg, u = null, pierce = false, crit = false, show = true) {
    if (e.hp <= 0 || e.under) return;
    const d = ENEMIES[e.t];
    if (show && d.dodge && this.rng() < d.dodge) { this.fx.push([22, r1(e.x), r1(e.z), 0, 2]); return; }
    // A shell shrugs off a direct hit.
    if (show && e.shell > 0 && dmg >= 1) { e.shell--; this.fx.push([22, r1(e.x), r1(e.z), 0, 3]); return; }
    const big = d.boss || e.champ || e.hx > 1.01;
    if (u) {
      const sp = spec(u);
      if (has(u, 'slayer') && (d.boss || d.armor || e.t === 1)) dmg *= 1.5;
      if (sp.boss && big) dmg *= sp.boss;
      if (sp.frozen && e.slow > 0) dmg *= sp.frozen;
      if (sp.sky && d.fly) dmg *= sp.sky;
    }
    // A fated monster turns ordinary hits into critical ones.
    if (show && e.fate > 0 && !crit && dmg >= 1) { e.fate--; crit = true; dmg *= this.critMul(); }
    if (big && this.doc('giantkillers')) dmg *= 1.5;
    if ((d.boss || e.champ) && this.lordRule('trophy')) dmg *= 1.4;
    if (e.curse > 0) dmg *= 1 + e.curseK;
    const school = u ? u.school || UNITS[u.k].fam : null;
    if (school) {
      const a = this.adapt[school] * (this.adapt[school] > 0 && this.fxCount('mirror') ? 0.5 : 1);
      if (a) dmg *= 1 - a / 100;
    }
    const armor = (d.armor || 0) + (this.mod === 'armoured' ? 5 : 0) + 3 * this.mut('hide');
    if (armor && !pierce) dmg = Math.max(dmg * 0.25, dmg - armor * this.armorMul);
    if (school) this.dealt[school] += Math.min(dmg, e.hp);
    e.hp -= dmg;
    if (show && dmg >= 1) this.fx.push([22, r1(e.x), r1(e.z), Math.round(dmg), crit ? 1 : 0]);
    if (crit && show && !this.leaping && this.perk('crystal')) {
      // Resonance: a critical hit leaps to the nearest other monster for half the damage.
      let next = null, bd = PERKS.crystal.reach;
      for (const o of this.enemies) { if (o === e || o.hp <= 0 || o.under) continue; const q = Math.hypot(o.x - e.x, o.z - e.z); if (q < bd) { bd = q; next = o; } }
      if (next) {
        this.fx.push([41, r2(e.x), r2(e.z), r2(next.x), r2(next.z)]);
        this.leaping = true;
        this.hurtEnemy(next, dmg * PERKS.crystal.splinter, u, pierce, false);
        this.leaping = false;
      }
    }
    if (e.hp <= 0) this.onKill(e, u);
  }

  onKill(e, u) {
    const d = ENEMIES[e.t], mult = e.champ ? 5 : 1;
    // Second wind: a boss rises once more.
    if (d.boss && !e.risen && this.mut('undying')) {
      e.risen = true;
      e.hp = Math.max(1, Math.round(e.max * 0.2 * this.mut('undying')));
      this.fx.push([48, r2(e.x), r2(e.z), 0]);
      return;
    }
    let gold = d.gold * this.goldMul * e.hx * mult * (1 + 0.25 * this.count('bounty')) * (this.bountyT > 0 ? 2 : 1);
    if (u && has(u, 'greedy')) gold += 2 * this.goldMul;
    if (this.count('midas') && this.rng() < 0.1) gold *= 3;
    gold = Math.round(gold);
    this.gold += gold;
    this.stats.earned += gold;
    this.stats.kills++;
    if (d.boss) this.stats.bosses++;
    this.castleXp(d.points * mult);
    if (u && u.uid) { u.kills++; this.giveXp(u, d.points * mult * (1 + 0.1 * this.wave)); }
    if (this.count('broodheart')) this.th.hp = Math.min(this.th.max, this.th.hp + this.th.max * 0.0015);
    this.lust++;
    this.fx.push([0, r2(e.x), r2(e.z), e.t]);
    // Death cry: the dying monster hastens those around it.
    const cry = 1.5 * this.mut('warcry');
    if (cry) for (const o of this.enemies) if (o !== e && o.hp > 0 && Math.hypot(o.x - e.x, o.z - e.z) < 5) o.haste = Math.max(o.haste, cry);
    // Volatile: dying at the foot of a wall, it bursts against it.
    if (this.mut('volatile') && !d.boom && !d.fly) {
      let seg = null, bd = 3 + d.r;
      for (const s of this.segs) { const q = Math.hypot(s.x - e.x, s.z - e.z); if (s.hp > 0 && q < bd) { bd = q; seg = s; } }
      if (seg) {
        this.hitWall(seg, d.dmg * this.dmgMul * e.hx * 0.4 * this.mut('volatile'));
        this.fx.push([1, r2(e.x), r2(e.z), 2, 2]);
      }
    }
    // Splitters and brood mothers burst into runners; with spawnlings, so do some of the others.
    let young = d.split || d.burst || 0;
    if (!young && !d.boss && e.t !== 0 && this.mut('spawn') && this.rng() < 0.1 * this.mut('spawn')) young = 2;
    for (let i = 0; i < young && this.enemies.length + this.later.length < MAX_ALIVE; i++) {
      const a = this.rng() * Math.PI * 2, far = d.burst ? 2.5 : 1.2;
      this.later.push(this.makeEnemy(0, e.x + Math.sin(a) * far, e.z + Math.cos(a) * far, 0.6));
    }
  }

  // Picks a target for an attacker at (x, z) with the given range and preferences.
  target(x, z, range, { melee = false, tough = false, sky = false, skip = null } = {}) {
    let best = null, score = -Infinity;
    for (const e of this.enemies) {
      const ed = ENEMIES[e.t];
      if (e.hp <= 0 || e.under || (melee && ed.fly) || (skip && skip(e))) continue;
      const q = Math.hypot(e.x - x, e.z - z);
      if (q > range + ed.r) continue;
      const s = tough ? e.hp : (sky && ed.fly ? 1000 : 0) - q;
      if (s > score) { score = s; best = e; }
    }
    return best;
  }

  // Lightning that jumps from monster to monster, weaker with each jump. zap stuns whatever it touches.
  chain(first, dmg, jumps, u, crit = false, from = null, zap = 0) {
    const hit = new Set([first]);
    let cur = first;
    if (from) this.fx.push([12, r2(from[0]), r2(from[1]), r2(cur.x), r2(cur.z)]);
    for (let i = 0; cur && i <= jumps; i++) {
      this.hurtEnemy(cur, dmg, u, false, crit && i === 0);
      if (zap && cur.hp > 0) this.stun(cur, zap);
      dmg *= 0.8;
      let next = null, bd = 6;
      for (const e of this.enemies) { if (hit.has(e) || e.hp <= 0 || e.under) continue; const q = Math.hypot(e.x - cur.x, e.z - cur.z); if (q < bd) { bd = q; next = e; } }
      if (next) { hit.add(next); this.fx.push([12, r2(cur.x), r2(cur.z), r2(next.x), r2(next.z)]); }
      cur = next;
    }
  }

  shoot(x, z, target, d, range, dmg, u, extra = {}) {
    const dist = Math.hypot(target.x - x, target.z - z) || 1, dx = (target.x - x) / dist, dz = (target.z - z) / dist;
    this.projs.push({
      id: this.nextId++, kind: d.kind, x: x + dx, z: z + dz, vx: dx * d.speed, vz: dz * d.speed, ttl: ((range * 1.6) / d.speed) * 1.2,
      r: ENEMIES[target.t].fly ? 0.9 : 0.4, aoe: d.aoe || 0, dmg, u, pierce: !!d.pierce, slow: 0, slowT: 2, thru: 0, ...extra,
    });
  }

  // Defenders on the walls. A unit is out of action while stunned or while its wall segment is down.
  updateUnits(dt) {
    const chainBonus = 2 * this.count('stormglass') + this.e.chain + (this.fxCount('stormlord') ? 2 : 0), night = this.nightMul(), critMul = this.critMul();
    for (const u of this.units) {
      const post = this.slots[u.slot], d = UNITS[u.k], sp = spec(u);
      if (u.sick > 0) u.sick -= dt;
      if (u.stun > 0) { u.stun -= dt; continue; }
      const down = post.seg >= 0 && this.segs[post.seg].hp <= 0;
      if (u.bl > 0 && !down) {
        // The rest of a repeater's volley follows at once.
        u.bt -= dt;
        if (u.bt <= 0) {
          const reach = this.unitRange(u) * night, again = this.target(post.x, post.z, reach);
          if (again) { this.shoot(post.x, post.z, again, d, reach, u.bdmg, u, sp.pierce ? { pierce: true } : {}); u.bl--; u.bt = 0.12; } else u.bl = 0;
        }
      }
      u.cd -= dt;
      if (u.cd > 0 || d.aura || d.guard || d.tinker || d.empower || down) continue;
      const range = this.unitRange(u) * night;
      if (d.heal === 'walls') {
        // A wallwright first raises a ruined wall within reach, now and then.
        if (d.raise && (u.rt || 0) <= this.waveT) {
          const ruin = this.segs.find((s) => s.hp <= 0 && Math.hypot(s.x - post.x, s.z - post.z) <= range);
          if (ruin) {
            ruin.hp = ruin.max * (sp.raise || d.raise);
            u.rt = this.waveT + 12; u.cd = this.unitReload(u);
            this.giveXp(u, 3);
            this.fx.push([60, r2(ruin.x), r2(ruin.z), 0]);
            continue;
          }
        }
        // Clerics mend the most damaged standing wall within reach.
        let best = null, bm = 0;
        for (const s of this.segs) {
          const miss = s.max - s.hp;
          if (s.hp > 0 && miss > bm && Math.hypot(s.x - post.x, s.z - post.z) <= range) { bm = miss; best = s; }
        }
        if (!best) continue;
        u.cd = this.unitReload(u);
        const amt = Math.min(bm, this.unitPower(u));
        best.hp += amt;
        this.giveXp(u, amt / 40);
        this.fx.push([11, r2(best.x), r2(best.z), 0]);
        continue;
      }
      if (d.heal === 'keep') {
        // Priests pray for the keep while monsters are about. A seraph's prayer also smites the monsters nearest the keep.
        const foes = d.smite ? this.nearKeep(sp.smite || d.smite) : [], hurt = this.th.hp < this.th.max && this.enemies.length > 0;
        if (!hurt && !foes.length) continue;
        u.cd = this.unitReload(u);
        if (hurt) {
          const amt = Math.min(this.th.max - this.th.hp, this.unitPower(u));
          this.th.hp += amt;
          this.giveXp(u, amt / 40);
          this.fx.push([14, 0, 0, 0]);
        }
        if (foes.length) {
          const smite = this.smitePower(u);
          for (const e of foes) { this.fx.push([49, r2(e.x), r2(e.z), 0]); this.hurtEnemy(e, smite, u, true); }
        }
        continue;
      }
      if (d.curse) {
        // Hexers curse the toughest monsters that are not cursed yet: they take more damage.
        let done = 0;
        for (let i = 0; i < (sp.multi || 1); i++) {
          const e = this.target(post.x, post.z, range, { tough: true, skip: (m) => m.curse > 0.5 });
          if (!e) break;
          e.curse = d.curse; e.curseK = Math.max(e.curseK, Math.min(1, this.unitPower(u)) * this.wardMul());
          this.fx.push([13, r2(e.x), r2(e.z), 0]);
          done++;
        }
        if (!done) continue;
        u.cd = this.unitReload(u);
        this.giveXp(u, 0.5 * done);
        continue;
      }
      if (d.fate) {
        // Stargazers read the fate of the toughest monsters: the next hits on them are critical.
        const hits = Math.max(1, Math.round(this.unitPower(u)));
        let done = 0;
        for (let i = 0; i < (sp.multi || 1); i++) {
          const e = this.target(post.x, post.z, range, { tough: true, skip: (m) => m.fate > 0 });
          if (!e) break;
          e.fate = hits;
          this.fx.push([50, r2(e.x), r2(e.z), 0]);
          done++;
        }
        if (!done) continue;
        u.cd = this.unitReload(u);
        this.giveXp(u, 0.5 * done);
        continue;
      }
      if (d.mine) {
        // Sappers bury mines in front of their wall while monsters are about.
        if (!this.enemies.length || this.mines.filter((m) => m.u === u).length >= d.mine + (sp.mines || 0)) { u.cd = 0.5; continue; }
        const nx = Math.abs(post.x) === S ? Math.sign(post.x) : 0, nz = nx ? 0 : Math.sign(post.z);
        const out = 3 + this.rng() * 5, side = (this.rng() - 0.5) * 5;
        const mx = post.x + nx * out + (nx ? 0 : side), mz = post.z + nz * out + (nz ? 0 : side);
        this.mines.push({ id: this.nextId++, x: mx, z: mz, dmg: this.unitPower(u), r: 2.6 * (sp.am || 1), u });
        u.cd = this.unitReload(u);
        this.fx.push([31, r2(mx), r2(mz), 0]);
        continue;
      }
      if (d.lob) {
        // Starforgers bring a meteor down on the thickest crowd on the ground.
        const r = d.lob * (sp.am || 1), spots = this.crowds(post.x, post.z, range, sp.multi || 1, r);
        if (!spots.length) continue;
        u.cd = this.unitReload(u);
        const dmg = this.unitPower(u);
        this.fx.push([23, u.slot, 0, 0]);
        for (const [x, z] of spots) { this.shells.push({ x, z, t: 1.1, dmg, r, u }); this.fx.push([61, r2(x), r2(z), r2(r)]); }
        continue;
      }
      const best = this.target(post.x, post.z, range, { melee: d.melee, tough: d.tough, sky: d.sky });
      if (!best) { u.ramp = 0; continue; }
      u.cd = this.unitReload(u) * (0.9 + this.rng() * 0.2);
      let dmg = this.unitPower(u);
      const crit = this.rng() < this.unitCrit(u);
      if (crit) dmg *= sp.cx || critMul;
      this.fx.push([23, u.slot, 0, 0]);
      if (d.beam) {
        // A prismancer's beam grows stronger the longer it stays on the same monster.
        u.ramp = u.last === best.id ? Math.min((sp.rampMax || 2) / d.ramp, (u.ramp || 0) + 1) : 0;
        u.last = best.id;
        const hit = dmg * (1 + d.ramp * u.ramp);
        this.fx.push([40, u.slot, r2(best.x), r2(best.z)]);
        this.hurtEnemy(best, hit, u, false, crit);
        if (sp.multi) {
          const near = this.enemies.filter((e) => e !== best && e.hp > 0 && !e.under && Math.hypot(e.x - best.x, e.z - best.z) < 6)
            .sort((a, b) => Math.hypot(a.x - best.x, a.z - best.z) - Math.hypot(b.x - best.x, b.z - best.z)).slice(0, sp.multi);
          for (const e of near) { this.fx.push([41, r2(best.x), r2(best.z), r2(e.x), r2(e.z)]); this.hurtEnemy(e, hit * 0.5, u); }
        }
        continue;
      }
      if (d.cone) {
        // A drake's breath burns everything in a cone towards the target.
        const ang = Math.atan2(best.x - post.x, best.z - post.z), half = d.cone * (sp.am || 1);
        const burn = d.burn * (dmg / u.p) * this.dotMul() * (sp.dm || 1) * this.e.burn;
        this.fx.push([42, u.slot, r2(ang), r2(range), r2(half)]);
        for (const e of this.enemies) {
          if (e.hp <= 0 || e.under || Math.hypot(e.x - post.x, e.z - post.z) > range + ENEMIES[e.t].r) continue;
          let off = Math.abs(Math.atan2(e.x - post.x, e.z - post.z) - ang);
          if (off > Math.PI) off = 2 * Math.PI - off;
          if (off > half) continue;
          e.burn = 3; e.burnDps = Math.max(e.burnDps, burn); e.burnU = u;
          this.hurtEnemy(e, dmg, u, false, crit && e === best);
        }
        continue;
      }
      if (d.pillar) {
        // A skycaller's pillar of light lands a moment later and spares nothing under it.
        const r = d.pillar * (sp.am || 1);
        this.rains.push({ x: best.x, z: best.z, t: 0.8, r, dmg, u, pierce: true, pillar: true });
        this.fx.push([43, r2(best.x), r2(best.z), r2(r)]);
        continue;
      }
      if (d.melee) {
        // A halberd or a glaive sweeps through several monsters at the foot of the wall.
        const victims = sp.cleave
          ? this.enemies.filter((e) => e.hp > 0 && !e.under && !ENEMIES[e.t].fly && Math.hypot(e.x - post.x, e.z - post.z) <= range + ENEMIES[e.t].r).slice(0, sp.cleave)
          : [best];
        for (const e of victims) {
          this.fx.push([7, r2(e.x), r2(e.z), 0]);
          this.hurtEnemy(e, dmg, u, false, crit);
          if (e.hp <= 0) continue;
          const lord = ENEMIES[e.t].boss || e.champ;
          // A glaivemaster finishes whatever is nearly dead.
          if (d.exec && !lord && e.hp <= e.max * (sp.exec || d.exec)) { this.fx.push([51, r2(e.x), r2(e.z), 0]); this.hurtEnemy(e, e.hp + 1, u, true, false, false); continue; }
          // A runeblade's brand makes the monster take more damage from everyone.
          if (d.brand) { e.curse = Math.max(e.curse, 4); e.curseK = Math.max(e.curseK, (sp.brand || d.brand) * this.wardMul()); }
          if (d.brand && sp.slow) { e.slow = Math.max(e.slow, 2); e.slowK = Math.max(e.slowK, sp.slow * this.slowMul()); }
          // An ironclad throws the monster back from the wall.
          if (d.knock) { this.knock(e, sp.knock || d.knock); if (sp.stun) this.stun(e, sp.stun); }
        }
        continue;
      }
      if (d.chain) {
        const jumps = d.chain + chainBonus + (sp.ch || 0), zap = d.zap ? sp.zap || d.zap : 0;
        this.chain(best, dmg, jumps, u, crit, [post.x, post.z], zap);
        if (this.doc('overload') && this.rng() < 0.25 && best.hp > 0) this.chain(best, dmg * 0.6, jumps, u, false, [post.x, post.z], zap);
        continue;
      }
      const extra = { crit, aoe: (d.aoe || 0) * (sp.am || 1) * (d.fam === 'alchemy' ? this.areaMul() : 1), thru: sp.thru ?? d.thru ?? 0 };
      if (sp.pierce) extra.pierce = true;
      if (d.slow) { extra.slow = Math.min(0.9, (sp.slow || d.slow) * this.slowMul()); extra.slowT = 2 * (1 + 0.25 * this.famTier.arcane); }
      if (d.burn || sp.burn) extra.burn = (sp.burn || d.burn) * (dmg / u.p) * this.dotMul() * (sp.dm || 1) * this.e.burn;
      if (d.poison) { extra.poison = d.poison * (dmg / u.p) * this.dotMul(); extra.cloudT = 4 * (sp.cloud || 1) * this.e.cloud; extra.melt = sp.melt || 0; }
      if (d.pool) { extra.pool = d.pool * (dmg / u.p) * this.dotMul() * this.e.burn; extra.tar = sp.tar || 0; }
      if (d.shards) extra.shards = sp.shards || d.shards;
      if (d.pin) extra.pin = sp.pin || d.pin;
      if (sp.knock) extra.knock = sp.knock;
      this.shoot(post.x, post.z, best, d, range, dmg, u, extra);
      if (d.burst) { u.bl = (sp.burst || d.burst) - 1; u.bt = 0.12; u.bdmg = dmg; }
      if (sp.multi) {
        const second = this.target(post.x, post.z, range, { sky: d.sky, skip: (m) => m === best });
        if (second) this.shoot(post.x, post.z, second, d, range, dmg, u, extra);
      }
      // Doctrines: marksmen sometimes loose a second arrow, arcane spells sometimes echo.
      if ((d.fam === 'marksmen' && this.doc('volleyfire') && this.rng() < 0.35) || (d.fam === 'arcane' && this.doc('overload') && this.rng() < 0.25)) {
        this.shoot(post.x, post.z, best, d, range, dmg * 0.6, u, { ...extra, crit: false });
      }
    }
  }

  // Turrets in the courtyard. They grow with their level and the engineering stat.
  updateTurrets(dt) {
    const speed = 1 + this.tinkerSpeed + (this.doc('clockwork') ? 0.4 : 0) + (this.perk('steam') ? PERKS.steam.speed : 0), reach = this.reach();
    for (const t of this.turrets) {
      const d = TURRETS[t.k], [x, z] = TURRET_SPOTS[t.spot];
      t.cd -= dt;
      if (t.cd > 0) continue;
      const dmg = this.turretPower(t);
      if (d.lob) {
        // The mortar shells the thickest crowd outside the walls, leading moving targets.
        let best = null, score = 0;
        for (const e of this.enemies) {
          if (Math.hypot(e.x, e.z) > d.range * reach || ENEMIES[e.t].fly || e.under) continue;
          let c = 0;
          for (const o of this.enemies) if (Math.hypot(o.x - e.x, o.z - e.z) < MORTAR_R) c += ENEMIES[o.t].points;
          if (c > score) { score = c; best = e; }
        }
        if (!best) continue;
        t.cd = d.cd / speed;
        const dd = Math.hypot(best.x, best.z), edge = Math.max(Math.abs(best.x), Math.abs(best.z));
        const lead = Math.min(ENEMIES[best.t].speed * 1.1, Math.max(0, dd * (1 - (S + 1) / edge)));
        const tx = best.x * (1 - lead / dd), tz = best.z * (1 - lead / dd);
        this.shells.push({ x: tx, z: tz, t: 1.1, dmg, r: MORTAR_R, u: TURRET_SRC });
        this.fx.push([5, r2(tx), r2(tz), t.spot]);
        continue;
      }
      const best = this.target(x, z, d.range * reach, { tough: d.tough });
      if (!best) continue;
      t.cd = d.cd / speed;
      this.fx.push([16, t.spot, 0, 0]);
      if (d.chain) this.chain(best, dmg, d.chain + Math.floor(t.lv / 2) + this.e.chain, TURRET_SRC, false, [x, z]);
      else this.shoot(x, z, best, d, d.range * reach, dmg, TURRET_SRC);
    }
    if (this.perk('powder')) {
      // The Powder Age mounts a gun on each of the four towers; they grow with the walls.
      const g = PERKS.powder, lv = 1 + Math.floor(this.b.walls / 3);
      const dmg = g.p * (1 + 0.5 * (lv - 1)) * Math.max(0.1, 1 + this.tot.eng / 100) * (1 + 0.15 * this.famTier.engineers);
      this.guns.forEach((gun, i) => {
        gun.cd -= dt;
        if (gun.cd > 0) return;
        const [x, z] = TOWERS[i], best = this.target(x, z, g.range * reach);
        if (!best) return;
        gun.cd = g.cd / speed;
        this.fx.push([52, i, 0, 0]);
        this.shoot(x, z, best, { kind: 7, speed: 26, aoe: g.aoe }, g.range * reach, dmg, TURRET_SRC);
      });
    }
    for (const sh of this.shells) sh.t -= dt;
    for (const sh of this.shells) {
      if (sh.t > 0) continue;
      this.fx.push([1, r2(sh.x), r2(sh.z), r2(sh.r)]);
      for (const e of this.enemies) if (!ENEMIES[e.t].fly && Math.hypot(e.x - sh.x, e.z - sh.z) < sh.r + ENEMIES[e.t].r) this.hurtEnemy(e, sh.dmg, sh.u);
    }
    this.shells = this.shells.filter((sh) => sh.t > 0);
  }

  updateProjs(dt) {
    const keep = [];
    for (const b of this.projs) {
      let hit = null;
      for (let i = 0; i < 2 && !hit; i++) {
        b.x += b.vx * dt * 0.5; b.z += b.vz * dt * 0.5;
        for (const e of this.enemies) {
          if (e.hp > 0 && !e.under && !(b.seen && b.seen.has(e)) && Math.hypot(e.x - b.x, e.z - b.z) < b.r + ENEMIES[e.t].r) { hit = e; break; }
        }
      }
      b.ttl -= dt;
      if (!hit && b.ttl > 0) { keep.push(b); continue; }
      if (b.poison) {
        // The flask breaks and leaves a poison cloud on the ground.
        this.clouds.push({ id: this.nextId++, x: b.x, z: b.z, r: b.aoe, t: b.cloudT || 4, dps: b.poison, u: b.u, melt: b.melt || 0 });
        this.fx.push([17, r2(b.x), r2(b.z), r2(b.aoe)]);
        continue;
      }
      const victims = b.aoe ? this.enemies.filter((e) => !e.under && Math.hypot(e.x - b.x, e.z - b.z) < b.aoe + ENEMIES[e.t].r) : hit ? [hit] : [];
      if (b.aoe) this.fx.push([b.slow ? 3 : b.burn || b.pool ? 18 : 1, r2(b.x), r2(b.z), r2(b.aoe)]);
      for (const e of victims) {
        if (b.slow) { e.slow = Math.max(e.slow, b.slowT); e.slowK = Math.max(e.slowK, b.slow); }
        if (b.burn) { e.burn = 3; e.burnDps = Math.max(e.burnDps, b.burn); e.burnU = b.u; }
        this.hurtEnemy(e, b.dmg, b.u, b.pierce, b.crit);
        if (e.hp > 0 && b.pin) this.stun(e, b.pin);
        if (e.hp > 0 && b.knock) this.knock(e, b.knock);
      }
      // A lavamancer's glob leaves a burning pool where it lands.
      if (b.pool) {
        this.clouds.push({ id: this.nextId++, x: b.x, z: b.z, r: b.aoe, t: 5, dps: b.pool, u: b.u, fire: true, tar: b.tar || 0 });
        this.fx.push([39, r2(b.x), r2(b.z), r2(b.aoe)]);
      }
      // A shardbow's arrow breaks into shards that fly on to the nearest monsters.
      if (hit && b.shards) {
        const near = this.enemies.filter((e) => e !== hit && e.hp > 0 && !e.under && Math.hypot(e.x - hit.x, e.z - hit.z) < 6)
          .sort((p, q) => Math.hypot(p.x - hit.x, p.z - hit.z) - Math.hypot(q.x - hit.x, q.z - hit.z)).slice(0, b.shards);
        for (const e of near) { this.fx.push([41, r2(hit.x), r2(hit.z), r2(e.x), r2(e.z)]); this.hurtEnemy(e, b.dmg * 0.5, b.u, b.pierce, false); }
      }
      // A siege bolt or a cannonball flies on through the monster it hit.
      if (hit && b.thru > 0 && b.ttl > 0 && !b.aoe) { b.thru--; (b.seen ??= new Set()).add(hit); keep.push(b); }
    }
    this.projs = keep;
  }

  // Burning and cursed monsters, what lies on the ground, buried mines and regenerating hordes.
  updateHazards(dt) {
    const tired = this.waveT > 2 * CHARGE_AFTER;   // a long fight wears the horde down: no more mending
    const regrow = (this.mod === 'regen' ? 0.012 : 0) + 0.005 * this.mut('regrow');
    for (const e of this.enemies) {
      if (e.burn > 0) { e.burn -= dt; this.hurtEnemy(e, e.burnDps * dt, e.burnU, false, false, false); if (e.burn <= 0) e.burnDps = 0; }
      if (e.curse > 0) { e.curse -= dt; if (e.curse <= 0) e.curseK = 0; }
      if (regrow && !tired && !ENEMIES[e.t].boss && e.hp > 0 && e.hp < e.max) e.hp = Math.min(e.max, e.hp + e.max * regrow * dt);
    }
    // Poison clouds, lava pools and caltrops: whatever walks through them suffers.
    for (const c of this.clouds) {
      c.t -= dt;
      for (const e of this.enemies) {
        if (ENEMIES[e.t].fly || e.under || Math.hypot(e.x - c.x, e.z - c.z) >= c.r + ENEMIES[e.t].r) continue;
        if (c.melt) { e.curse = Math.max(e.curse, 1); e.curseK = Math.max(e.curseK, c.melt * this.wardMul()); }
        const slow = c.spike ? 0.5 : c.tar ? c.tar * this.slowMul() : 0;
        if (slow) { e.slow = Math.max(e.slow, 0.5); e.slowK = Math.max(e.slowK, slow); }
        this.hurtEnemy(e, c.dps * dt, c.u, true, false, false);
      }
    }
    this.clouds = this.clouds.filter((c) => c.t > 0);
    for (const m of this.mines) {
      if (!this.enemies.some((e) => e.hp > 0 && !e.under && !ENEMIES[e.t].fly && Math.hypot(e.x - m.x, e.z - m.z) < 1.6 + ENEMIES[e.t].r)) continue;
      m.done = true;
      this.fx.push([1, r2(m.x), r2(m.z), r2(m.r)]);
      for (const e of this.enemies) if (!ENEMIES[e.t].fly && Math.hypot(e.x - m.x, e.z - m.z) < m.r + ENEMIES[e.t].r) this.hurtEnemy(e, m.dmg, m.u);
    }
    this.mines = this.mines.filter((m) => !m.done);
  }

  // Lightning from a storm, the falling stars of the Star Age and the dragon of the roost.
  updateSky(dt) {
    if (this.e.bolt) {
      const lord = this.fxCount('stormlord') > 0;
      this.boltT -= dt * (lord ? 2 : 1);
      if (this.boltT <= 0) {
        this.boltT = this.e.bolt;
        const live = this.enemies.filter((e) => e.hp > 0 && !e.under);
        if (!lord && this.units.length && this.rng() < BOLT_MISS) {
          // Now and then the lightning strikes the castle instead and stuns a defender.
          const u = this.units[Math.floor(this.rng() * this.units.length)], p = this.slots[u.slot];
          u.stun = Math.max(u.stun, BOLT_STUN);
          this.fx.push([53, r2(p.x), r2(p.z), 1]);
        } else if (live.length) {
          const e = live[Math.floor(this.rng() * live.length)];
          this.fx.push([53, r2(e.x), r2(e.z), 0]);
          this.hurtEnemy(e, this.volleyDamage() * 2, null, true);
        }
      }
    }
    if (this.perk('star')) {
      this.starT -= dt;
      if (this.starT <= 0) {
        this.starT = PERKS.star.every;
        const e = this.target(0, 0, 60, { tough: true });
        if (e) {
          this.rains.push({ x: e.x, z: e.z, t: 0.6, r: PERKS.star.r, dmg: this.volleyDamage() * PERKS.star.mul, pierce: true, star: true });
          this.fx.push([54, r2(e.x), r2(e.z), PERKS.star.r]);
        }
      }
    }
    if (this.perk('dragon')) {
      this.roostT -= dt;
      if (this.roostT <= 0) {
        this.roostT = PERKS.dragon.every;
        const spot = this.crowds(0, 0, 45, 1, PERKS.dragon.r)[0];
        if (spot) {
          const dmg = this.volleyDamage() * PERKS.dragon.mul;
          this.fx.push([44, r2(spot[0]), r2(spot[1]), PERKS.dragon.r]);
          for (const e of this.enemies) {
            if (e.under || Math.hypot(e.x - spot[0], e.z - spot[1]) >= PERKS.dragon.r + ENEMIES[e.t].r) continue;
            e.burn = 3; e.burnDps = Math.max(e.burnDps, dmg * 0.1 * this.e.burn); e.burnU = null;
            this.hurtEnemy(e, dmg);
          }
        }
      }
    }
  }

  // The thickest crowds of walking monsters within reach of (x, z): up to `count` spots, well apart.
  crowds(x, z, range, count, r) {
    const scored = [];
    for (const e of this.enemies) {
      if (e.hp <= 0 || e.under || ENEMIES[e.t].fly || Math.hypot(e.x - x, e.z - z) > range) continue;
      let c = 0;
      for (const o of this.enemies) if (!o.under && Math.hypot(o.x - e.x, o.z - e.z) < r) c += ENEMIES[o.t].points;
      scored.push([c, e]);
    }
    scored.sort((a, b) => b[0] - a[0]);
    const out = [];
    for (const [, e] of scored) {
      if (out.length >= count) break;
      if (out.every(([ox, oz]) => Math.hypot(ox - e.x, oz - e.z) > r * 1.5)) out.push([e.x, e.z]);
    }
    return out;
  }

  // The monsters nearest the keep, for a seraph to smite.
  nearKeep(count) {
    return this.enemies.filter((e) => e.hp > 0 && !e.under && Math.hypot(e.x, e.z) < 26)
      .sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z)).slice(0, count);
  }

  // Stuns or pins a monster. Bosses and champions shake it off sooner.
  stun(e, t) { e.stun = Math.max(e.stun, t * (ENEMIES[e.t].boss ? 0.25 : e.champ ? 0.5 : 1)); }

  // Pushes a monster away from the castle. Bosses and champions barely give ground.
  knock(e, k) {
    const len = Math.hypot(e.x, e.z) || 1, far = k * (ENEMIES[e.t].boss ? 0.2 : e.champ ? 0.5 : 1);
    e.x += (e.x / len) * far; e.z += (e.z / len) * far;
  }

  collideStatic(e, r) {
    let hit = null;
    for (const s of this.segs) if (s.hp > 0 && pushOutBox(e, r, s.x, s.z, s.hw, s.hd)) hit = s;
    for (const [tx, tz] of TOWERS) pushOutCircle(e, r, tx, tz, TOWER_R);
    const th = pushOutBox(e, r, 0, 0, TH_HALF, TH_HALF);
    return { seg: hit, th };
  }

  // Damage to a wall segment, after armour, wardens and shieldbearers. Thorns bite the attacker.
  hitWall(seg, dmg, attacker = null) {
    if (seg.hp <= 0 || seg.wardT > 0) return;
    const i = this.segs.indexOf(seg);
    let left = seg.hp - dmg * this.guardMul(i);
    if (left <= 0 && seg.ward) {
      // A warding rune: once a wave the segment refuses to fall and stands untouchable for a moment.
      seg.ward = false; seg.wardT = PERKS.rune.ward; left = 1;
      this.fx.push([56, r2(seg.x), r2(seg.z), 0]);
    }
    seg.hp = Math.max(0, left);
    if (seg.hp <= 0) this.wallsLost++;
    if (!attacker || attacker.hp <= 0) return;
    const boss = ENEMIES[attacker.t].boss;
    if (this.count('thorns')) this.hurtEnemy(attacker, attacker.max * (boss ? 0.015 : 0.15) * this.pct);
    if (this.thornSeg[i] && attacker.hp > 0) this.hurtEnemy(attacker, attacker.max * 0.12 * this.thornSeg[i] * (boss ? 0.1 : 1) * this.pct);
    // Obsidian walls cut whatever strikes them.
    if (this.perk('obsidian') && attacker.hp > 0) this.hurtEnemy(attacker, attacker.max * (boss ? PERKS.obsidian.razorBoss : PERKS.obsidian.razor) * this.pct, null, true, false, false);
  }

  // Damage to the keep, after armour. Plunderers steal with every blow; a crown of thorns bites back.
  hitKeep(dmg, attacker = null) {
    if (this.standT > 0) return;
    this.th.hp -= dmg * this.guardMul();
    const steal = this.mut('thieves');
    if (steal) this.gold = Math.max(0, this.gold - steal * this.goldMul);
    if (attacker && attacker.hp > 0 && this.fxCount('keepthorns')) this.hurtEnemy(attacker, attacker.max * (ENEMIES[attacker.t].boss ? 0.006 : 0.06) * this.pct, null, true, false, false);
  }

  // What makes each boss more than a big monster.
  bossPower(e, d, dt) {
    if (e.markT > 0) {
      // The Behemoth's quake lands on the wall it marked a moment ago.
      e.markT -= dt;
      if (e.markT <= 0 && e.mark >= 0) {
        const s = this.segs[e.mark];
        this.hitWall(s, s.max * 0.6);
        this.fx.push([26, r2(s.x), r2(s.z), 0]);
        e.mark = -1;
      }
    }
    e.pt -= dt;
    if (e.pt > 0) return;
    e.pt = d.pcd * Math.max(0.4, 1 - 0.2 * this.mut('might'));
    if (d.power === 'shriek') {
      // The Queen's shriek drives every monster near her into a frenzy and calls runners to her side.
      for (const o of this.enemies) if (o !== e && Math.hypot(o.x - e.x, o.z - e.z) < 16) o.haste = 3;
      for (let i = 0; i < 2 && this.enemies.length + this.later.length < MAX_ALIVE; i++) {
        const a = this.rng() * Math.PI * 2;
        this.later.push(this.makeEnemy(0, e.x + Math.sin(a) * 3, e.z + Math.cos(a) * 3, 0.6));
      }
      this.fx.push([24, r2(e.x), r2(e.z), 16]);
    } else if (d.power === 'quake') {
      let best = -1, bd = 26;
      this.segs.forEach((s, i) => { const q = Math.hypot(s.x - e.x, s.z - e.z); if (s.hp > 0 && q < bd) { bd = q; best = i; } });
      if (best < 0) { e.pt = 1; return; }
      e.mark = best; e.markT = 2.5;
      this.fx.push([25, r2(this.segs[best].x), r2(this.segs[best].z), 2.5]);
    } else if (d.power === 'dive') {
      // The Sky Tyrant swoops at one defender and stuns everyone around them.
      const army = this.units.filter((u) => this.slots[u.slot].seg < 0 || this.segs[this.slots[u.slot].seg].hp > 0);
      if (!army.length) return;
      const p = this.slots[army[Math.floor(this.rng() * army.length)].slot];
      for (const u of this.units) if (Math.hypot(this.slots[u.slot].x - p.x, this.slots[u.slot].z - p.z) < 5.5) u.stun = 3;
      this.fx.push([27, r2(p.x), r2(p.z), 5.5]);
    }
  }

  // Monsters walk at the keep, break whatever wall is in the way and pour through breaches.
  // Flyers go straight over the walls, burrowers under them; spitters and hurlers stop short.
  updateEnemies(dt) {
    const breaches = this.segs.filter((s) => s.hp <= 0);
    const es = this.enemies;
    const hourglass = this.count('hourglass') && this.waveT < 6 ? 0.4 : 0, frozen = this.freezeT > 0 ? 0.7 : 0, moat = this.doc('moat');
    // Stragglers charge once the whole wave is out and a minute has passed, so no wave can stall.
    const charge = !this.queue.length && this.waveT > CHARGE_AFTER;
    const quick = Math.max(0.4, 1 - 0.2 * this.mut('might')), rage = 1 + 0.25 * this.mut('rage');
    // A wave that drags on turns into a fury: every blow lands heavier by the second, so no siege can be sat out.
    const fury = 1 + FURY_RATE * Math.max(0, this.waveT - FURY_AFTER);
    for (const e of es) {
      const d = ENEMIES[e.t];
      if (e.slow > 0) { e.slow -= dt; if (e.slow <= 0) e.slowK = 0; }
      if (e.haste > 0) e.haste -= dt;
      e.hold = -2;
      // A stunned or pinned monster neither moves nor does anything else.
      if (e.stun > 0) { e.stun -= dt; continue; }
      const edge = Math.max(Math.abs(e.x), Math.abs(e.z));
      if (d.ranged && !charge) {
        const reach = d.ranged * this.e.foeRange;
        if (edge > S + 0.8) {
          let bd = reach;
          this.segs.forEach((s, i) => { const q = Math.hypot(s.x - e.x, s.z - e.z); if (s.hp > 0 && q < bd) { bd = q; e.hold = i; } });
        } else if (edge < TH_HALF + reach * 0.6) e.hold = -1;
      }
      if (d.brood) {
        e.bt -= dt;
        if (e.bt <= 0) {
          e.bt = 3 * quick;
          for (let i = 0; i < d.brood && es.length + this.later.length < MAX_ALIVE; i++) {
            const a = this.rng() * Math.PI * 2;
            this.later.push(this.makeEnemy(0, e.x + Math.sin(a) * 2.5, e.z + Math.cos(a) * 2.5, 0.7));
          }
        }
      }
      if (d.heal) {
        // Shamans knit the wounds of every monster around them; two shamans do not heal twice.
        for (const o of es) {
          if (this.waveT > 2 * CHARGE_AFTER || o === e || o.hp <= 0 || o.hp >= o.max || o.mended === this.waveT || Math.hypot(o.x - e.x, o.z - e.z) >= 7) continue;
          o.mended = this.waveT;
          o.hp = Math.min(o.max, o.hp + o.max * d.heal * (ENEMIES[o.t].boss ? 0.25 : 1) * dt);
        }
      }
      if (d.power) this.bossPower(e, d, dt);
      if (e.hold !== -2) continue;
      let tx = 0, tz = 0;
      if (!d.fly && !e.under && (Math.abs(e.x) > S - 1 || Math.abs(e.z) > S - 1)) {
        let bd = 14;
        for (const s of breaches) { const q = Math.hypot(s.x - e.x, s.z - e.z); if (q < bd) { bd = q; tx = s.x; tz = s.z; } }
        if (bd < 1.5) { tx = 0; tz = 0; }   // standing in the breach: carry on to the keep
      }
      let slow = Math.max(e.slowK, hourglass, frozen);
      if (moat && edge > S && edge < S + 4.5) slow = Math.max(slow, 0.25);
      const dx = tx - e.x, dz = tz - e.z, len = Math.hypot(dx, dz);
      const spd = d.speed * this.speedMul * (d.fly ? this.e.fly : 1) * (1 - slow) * (charge ? 1.4 : 1) * (e.haste > 0 ? 1.35 : 1) * (d.boss && e.hp < e.max / 2 ? rage : 1);
      if (len > 0.01) { e.x += (dx / len) * spd * dt; e.z += (dz / len) * spd * dt; }
      if (e.under && Math.max(Math.abs(e.x), Math.abs(e.z)) < S - 2.5) { e.under = false; this.fx.push([28, r2(e.x), r2(e.z), 0]); }
    }
    for (let i = 0; i < es.length; i++) {
      const a = es[i], ad = ENEMIES[a.t], ar = ad.r;
      if (a.under) continue;
      for (let j = i + 1; j < es.length; j++) {
        const b = es[j], bdf = ENEMIES[b.t];
        if (b.under || !!ad.fly !== !!bdf.fly) continue;
        const min = (ar + bdf.r) * 0.9;
        const dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz;
        if (d2 >= min * min || d2 < 1e-9) continue;
        const dist = Math.sqrt(d2), push = min - dist, wa = ar >= bdf.r ? 0.3 : 0.7;
        a.x -= (dx / dist) * push * wa; a.z -= (dz / dist) * push * wa;
        b.x += (dx / dist) * push * (1 - wa); b.z += (dz / dist) * push * (1 - wa);
      }
    }
    const oil = this.count('oil') ? 0.04 : 0, venom = this.mut('venom') > 0;
    for (const e of es) {
      const d = ENEMIES[e.t];
      if (e.under) continue;
      const c = d.fly ? { seg: null, th: pushOutBox(e, d.r, 0, 0, TH_HALF, TH_HALF) } : this.collideStatic(e, d.r);
      const nearTH = c.th || (Math.abs(e.x) < TH_HALF + d.r + 0.4 && Math.abs(e.z) < TH_HALF + d.r + 0.4);
      if (oil && c.seg) this.hurtEnemy(e, oil * e.max * (d.boss ? 0.25 : 1) * this.pct * dt, null, false, false, false);
      if (e.hp <= 0 || e.stun > 0) continue;
      const hit = d.dmg * this.dmgMul * e.hx * (e.champ ? 2 : 1) * fury, wallHit = hit * d.wallMul * this.wallDmg;
      if (d.boom && (c.seg || nearTH)) {
        // A blightling bursts against the first thing it reaches.
        if (nearTH) this.hitKeep(hit); else this.hitWall(c.seg, wallHit);
        this.fx.push([1, r2(e.x), r2(e.z), 2.4, 2]);
        e.hp = 0;
        continue;
      }
      e.cd -= dt * (d.boss && e.hp < e.max / 2 ? rage : 1);
      if (e.cd > 0) continue;
      if (e.hold >= 0) {
        e.cd = d.rcd || 2;
        this.hitWall(this.segs[e.hold], wallHit);
        // Venom: the spit sickens whoever stands on that wall.
        if (venom) for (const u of this.units) if (this.slots[u.slot].seg === e.hold) u.sick = 3;
        this.fx.push([10, r2(e.x), r2(e.z), e.hold, d.rcd ? 1 : 0]);
      } else if (e.hold === -1 || nearTH) {
        e.cd = e.hold === -1 ? (d.rcd || 2) : 1;
        this.hitKeep(hit, e.hold === -1 ? null : e);
        if (e.hold === -1) this.fx.push([10, r2(e.x), r2(e.z), -1, d.rcd ? 1 : 0]);
      } else if (c.seg) {
        e.cd = 1;
        this.hitWall(c.seg, wallHit, e);
      }
    }
  }

  // Scaled stats of every monster type for the coming wave, for the offer cards.
  nextStats() {
    const n = this.wave + 1, tough = this.siegeTough() * this.env(n, this.forecast[0]).hp;
    const h = hpMul(n) * tough, bh = bossHpMul(n) * tough ** 0.85 * this.bossTough(), m = dmgMul(n) * this.siegeCruel();
    const plated = 1 + 0.25 * this.mut('plated');
    return ENEMIES.map((d, t) => [Math.round(d.hp * (d.boss ? bh : h) * (t === 1 || t === 6 || t === 12 ? plated : 1)), Math.round(d.dmg * m)]);
  }

  // The next boss wave and which boss it brings.
  nextBoss() {
    const at = nextBossWave(this.wave + (this.phase === 'wave' ? 0 : 1));
    return [at, BOSSES[bossIndex(at) % BOSSES.length]];
  }

  // The current pending reward, as the client shows it.
  pickView() {
    const p = this.picks[0];
    if (!p) return null;
    const rr = p.type === 'level' || p.type === 'spoils';
    return {
      type: p.type, ev: p.ev, boss: p.boss, left: this.picks.length, rr: rr ? this.pickRerollCost() : -1,
      skip: p.type === 'spoils' ? this.skipGold() : 0, pass: p.type === 'muster',
      opts: p.opts.map((o) => {
        if (o.type === 'promote') { const u = this.unit(o.uid); return { ...o, lv: u ? u.lv : 1 }; }
        if (o.type === 'turret') { const t = this.turrets.find((x) => x.k === o.k); return { ...o, lv: t ? t.lv + 1 : 1 }; }
        return o;
      }),
    };
  }

  snapshot() {
    const fx = this.fx, calm = this.phase !== 'wave';
    this.fx = [];
    const ck = Object.keys(CASTLE);
    const s = {
      t: 's', ph: this.phase, wave: this.wave, tm: Math.ceil(this.timer), gold: Math.floor(this.gold), sv: this.siege, lord: this.lord, age: this.age,
      path: this.path, ak: ageKey(this.age, this.path), daily: this.daily, mod: this.mod, dk: this.dark ? 1 : 0,
      now: this.weather, wx: this.forecast, mu: this.muts,
      ab: this.loadout.map((k) => [k, Math.ceil(this.abil[k])]), ral: this.rallyT > 0 ? 1 : 0, frz: this.freezeT > 0 ? 1 : 0, bty: this.bountyT > 0 ? 1 : 0,
      sig: this.signalT > 0 ? 1 : 0, lst: this.standT > 0 ? 1 : 0,
      th: [Math.round(this.th.hp), this.th.max], reached: this.reached,
      left: this.queue.length + this.enemies.length, np: this.players.size, nb: this.nextBoss(),
      lv: [this.level, Math.floor((this.xp / levelNeed(this.level)) * 100)],
      b: ck.map((k) => this.b[k]),
      bc: ck.map((k) => (this.b[k] >= CASTLE[k].max ? -1 : this.b[k] >= this.castleCap() ? -2 : CASTLE[k].cost[this.b[k]])),
      rc: [this.repairCost('walls'), this.repairCost('hall')],
      wv: this.waves,
      un: this.units.map((u) => [u.uid, u.slot, UNIT_KEYS.indexOf(u.k), u.rar, (u.stun > 0 ? 1 : 0) | (u.temp ? 2 : 0) | (this.canSpecialize(u) ? 4 : 0)]),
      tu: this.turrets.map((t) => [TURRET_KEYS.indexOf(t.k), t.spot, t.lv]),
      pl: this.plots.map((p) => (p ? [BUILDING_KEYS.indexOf(p.k), p.lv] : null)),
      cap: this.capacity(),
      sg: this.segs.map((sg) => Math.round((sg.hp / sg.max) * 100)),
      en: this.enemies.map((e) => [e.id, e.t, r2(e.x), r2(e.z), Math.max(1, Math.round((e.hp / e.max) * 100)),
        (e.slow > 0 ? 1 : 0) | (e.burn > 0 ? 2 : 0) | (e.curse > 0 ? 4 : 0) | (e.under ? 8 : 0) | (e.champ ? 16 : 0) | (e.haste > 0 ? 32 : 0)
        | (e.stun > 0 ? 64 : 0) | (e.shell > 0 ? 128 : 0) | (e.fate > 0 ? 256 : 0)]),
      pr: this.projs.map((b) => [b.id, b.kind, r2(b.x), r2(b.z), r2(Math.atan2(b.vx, b.vz))]),
      cl: this.clouds.map((c) => [c.id, r2(c.x), r2(c.z), r2(c.r), c.fire ? 1 : c.spike ? 2 : 0]),
      mn: this.mines.map((m) => [m.id, r2(m.x), r2(m.z)]),
      st: [this.stats.kills, Math.round(this.stats.earned), this.stats.bosses],
      fx,
    };
    if (calm) {
      // Everything the panels show between waves.
      s.ro = this.units.map((u) => [u.uid, UNIT_KEYS.indexOf(u.k), u.rar, u.lv, Math.floor((u.xp / xpNeed(u.lv)) * 100), u.name,
        r1(this.unitPower(u) * 100) / 100, r2(this.unitReload(u)), r1(this.unitRange(u)), u.kills, this.trainCost(u), this.refund(u),
        u.traits.map((t) => TRAITS.indexOf(t)), r2(this.unitCrit(u)), u.slot, u.spec, this.canSpecialize(u) ? 1 : 0, u.temp ? 1 : 0]);
      s.tot = this.tot;
      s.items = this.items;
      s.bless = this.bless;
      s.fam = [FAMILIES.map((f) => this.famCount[f]), FAMILIES.map((f) => this.famTier[f])];
      s.hv = this.harvestGold(this.wave + 1);
      s.tp = this.turrets.map((t) => Math.round(this.turretPower(t)));
      s.pick = this.pickView();
      s.dc = this.doctrines;
      s.ar = this.ageReq();
      // The horde's adaptation: its resistance to each family, what each dealt this season, and what it learnt last.
      s.ad = FAMILIES.map((f) => this.adapt[f]);
      s.ds = FAMILIES.map((f) => Math.round(this.dealt[f]));
      s.la = this.lastAdapt;
      s.yard = {
        plots: this.plotCount(), cap: this.buildingCap(), spots: this.turretSpots(), ccap: this.castleCap(), free: Math.round(this.freeRepair() * 100),
        up: this.plots.map((p) => (p ? [this.buildingCost(p.k, p.lv + 1), buildLevelReq(p.lv + 1)] : null)),
        cost: BUILDING_KEYS.map((k) => this.buildingCost(k, 1)),
      };
    }
    if (this.phase === 'prep') {
      s.shop = this.shop;
      s.rr = this.shopRerollCost();
      s.ns = this.nextStats();
    }
    if (this.phase === 'over') { s.best = this.best; s.sum = this.summary; }
    return s;
  }

  // ---- Saving: a run can be continued later ----

  save() {
    return {
      v: 5, siege: this.siege, lord: this.lord, classes: [...this.classes], pool: [...this.itemPool], relics: [...this.relicPool], loadout: this.loadout, daily: this.daily, runId: this.runId,
      wave: this.wave, gold: Math.floor(this.gold), age: this.age, path: this.path, b: { ...this.b }, st: { ...this.st }, items: { ...this.items }, bless: { ...this.bless },
      turrets: this.turrets.map((t) => ({ k: t.k, lv: t.lv, spot: t.spot })), plots: this.plots.map((p) => (p ? { ...p } : null)),
      doctrines: [...this.doctrines], level: this.level, xp: this.xp, th: Math.round(this.th.hp),
      segs: this.segs.map((s) => Math.round(s.hp)), stats: { ...this.stats },
      bossWaves: this.bossWaves, capBonus: this.capBonus, eggAt: this.eggAt, phoenixUsed: this.phoenixUsed, wallsLost: this.wallsLost, battleT: Math.round(this.battleT),
      muts: { ...this.muts }, adapt: { ...this.adapt }, dealt: Object.fromEntries(FAMILIES.map((f) => [f, Math.round(this.dealt[f])])), lastAdapt: this.lastAdapt,
      forecast: [...this.forecast],
      picks: this.picks.map((p) => ({ type: p.type, luck: p.luck || 0, boss: p.boss || 0, floor: p.floor || 0 })),
      shop: this.shop.map((o) => (o && o.locked ? { type: o.type, key: o.key, k: o.k } : null)),
      units: this.army().map((u) => ({ slot: u.slot, k: u.k, name: u.name, rar: u.rar, lv: u.lv, xp: Math.floor(u.xp), p: u.p, rcd: u.rcd, range: u.range, traits: u.traits, kills: u.kills, spec: u.spec })),
    };
  }

  // Restores a saved run between waves. Anything malformed is rejected as a whole.
  load(s) {
    try {
      const bad = () => { throw new Error('bad save'); };
      const int = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : bad());
      const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : bad());
      const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : bad());
      const list = (v, max) => (Array.isArray(v) && v.length <= max ? v : bad());
      if (!s || typeof s !== 'object' || s.v !== 5 || !Object.hasOwn(LORDS, s.lord)) bad();
      const siege = int(s.siege, 0, SIEGE_MAX), age = int(s.age, 0, 500);
      const path = s.path == null ? null : Object.hasOwn(PATHS, s.path) ? s.path : bad();
      if ((age >= AGES.length) !== !!path) bad();   // a path is chosen with the fifth age, never before
      const classes = list(s.classes, 128).filter((k) => Object.hasOwn(UNITS, k));
      const pool = list(s.pool, 256).filter((k) => Object.hasOwn(ITEMS, k) && !ITEMS[k].relic);
      const relics = list(s.relics ?? [], 64).filter((k) => Object.hasOwn(ITEMS, k) && ITEMS[k].relic);
      const loadout = [...new Set(list(s.loadout, 3).filter((k) => Object.hasOwn(ABILITIES, k)))];
      if (!classes.length || !pool.length || loadout.length !== 3) bad();
      const b = {}, st = {}, items = {}, bless = {}, muts = {}, adapt = {}, dealt = {};
      for (const k in CASTLE) b[k] = int(s.b?.[k], 1, Math.min(CASTLE[k].max, AGE_CAP * (age + 1)));
      if (b.walls > b.hall) bad();
      for (const k of STAT_KEYS) st[k] = num(s.st?.[k] ?? 0, -1000, 1e9);
      for (const [k, v] of Object.entries(obj(s.items))) { if (!Object.hasOwn(ITEMS, k)) bad(); items[k] = int(v, 1, ITEMS[k].unique ? 1 : 9999); }
      for (const k of UNIT_KEYS) bless[k] = int(s.bless?.[k] ?? 0, 0, 9999);
      for (const [k, v] of Object.entries(obj(s.muts ?? {}))) { if (!Object.hasOwn(MUTATIONS, k)) bad(); muts[k] = int(v, 1, MUT_MAX); }
      for (const f of FAMILIES) { adapt[f] = num(s.adapt?.[f] ?? 0, ADAPT.floor, ADAPT.cap); dealt[f] = num(s.dealt?.[f] ?? 0, 0, 1e18); }
      const lastAdapt = s.lastAdapt == null ? null : FAMILIES.includes(s.lastAdapt) ? s.lastAdapt : bad();
      const forecast = list(s.forecast, FORECAST);
      if (forecast.length !== FORECAST || forecast.some((w) => !WEATHER.includes(w))) bad();
      const doctrines = [...new Set(list(s.doctrines, DOCTRINE_KEYS.length))];
      if (doctrines.some((k) => !Object.hasOwn(DOCTRINES, k)) || doctrines.length > age) bad();
      if (!Array.isArray(s.segs) || s.segs.length !== this.segs.length) bad();
      const used = new Set();
      const units = list(s.units, this.slots.length).map((u) => {
        if (!u || !Object.hasOwn(UNITS, u.k) || (UNITS[u.k].path && UNITS[u.k].path !== path)) bad();
        const slot = int(u.slot, 0, this.slots.length - 1);
        if (used.has(slot) || (this.wallOnly(u.k) && this.slots[slot].seg < 0)) bad();
        used.add(slot);
        const traits = Array.isArray(u.traits) ? [...new Set(u.traits.filter((t) => TRAITS.includes(t)))].slice(0, 2) : [];
        return {
          uid: 0, slot, k: u.k, name: String(u.name || 'Nameless').replace(/[^A-Za-z]/g, '').slice(0, 12) || 'Nameless', rar: int(u.rar, 0, RARITY.length - 1), lv: int(u.lv, 1, 99999),
          xp: num(u.xp, 0, 1e12), p: num(u.p, 0.001, 1e9), rcd: num(u.rcd, 0.1, 20), range: num(u.range, 0, 200), traits, kills: int(u.kills, 0, 1e12),
          spec: int(u.spec ?? 0, 0, 2), cd: 0, stun: 0,
        };
      });
      if (!units.length) bad();
      const spots = new Set(), kinds = new Set();
      const turrets = list(s.turrets, TURRET_SPOTS.length).map((t) => {
        if (!t || !Object.hasOwn(TURRETS, t.k) || kinds.has(t.k)) bad();
        const spot = int(t.spot, 0, TURRET_SPOTS.length - 1);
        if (spots.has(spot)) bad();
        spots.add(spot); kinds.add(t.k);
        return { k: t.k, lv: int(t.lv, 1, 99999), spot, cd: 0 };
      });
      const built = new Set();
      const plots = list(s.plots, PLOTS.length).map((p) => {
        if (!p) return null;
        if (!Object.hasOwn(BUILDINGS, p.k) || built.has(p.k) || BUILDINGS[p.k].age > age + 1) bad();
        built.add(p.k);
        return { k: p.k, lv: int(p.lv, 1, buildingCapAt(age)), paid: num(p.paid ?? 0, 0, 1e15) };
      });
      while (plots.length < PLOTS.length) plots.push(null);
      const picks = list(Array.isArray(s.picks) ? s.picks : [], 300).map((p) => {
        if (!p || !['level', 'spoils', 'relic', 'event', 'doctrine', 'mutation', 'muster'].includes(p.type)) bad();
        const q = { type: p.type, luck: num(p.luck ?? 0, 0, 1000) };
        if (p.type === 'mutation') q.boss = int(p.boss ?? 0, 0, BOSSES.length - 1);
        if (p.type === 'level') q.floor = int(p.floor ?? 0, 0, 3);
        if (p.type === 'muster' && !path) bad();
        return q;
      });
      const shop = list(Array.isArray(s.shop) ? s.shop : [], 8).map((o) => {
        if (!o) return null;
        if (o.type === 'item' && Object.hasOwn(ITEMS, o.key) && !ITEMS[o.key].relic) return { type: 'item', key: o.key, locked: true };
        if (o.type === 'turret' && Object.hasOwn(TURRETS, o.k)) return { type: 'turret', k: o.k, locked: true };
        return bad();
      });
      const wave = int(s.wave, 0, 1000000), gold = num(s.gold, 0, 1e15), level = int(s.level, 1, 1000000), xp = num(s.xp, 0, 1e15);
      const segHp = s.segs.map((v) => num(v, 0, 1e12)), keepHp = num(s.th, 1, 1e12);
      const stats = { kills: int(s.stats?.kills ?? 0, 0, 1e12), earned: num(s.stats?.earned ?? 0, 0, 1e18), bosses: int(s.stats?.bosses ?? 0, 0, 1e9) };
      const extra = {
        bossWaves: int(s.bossWaves ?? 0, 0, 1e6), capBonus: int(s.capBonus ?? 0, 0, 4), eggAt: int(s.eggAt ?? 0, 0, 2000000), phoenixUsed: !!s.phoenixUsed,
        wallsLost: int(s.wallsLost ?? 0, 0, 1e9), battleT: num(s.battleT ?? 0, 0, 1e9),
      };
      if (extra.bossWaves < age) bad();   // every age needs its boss
      if (units.length > Math.min(this.slots.length, CAPACITY[b.walls] + 4 + 3 + extra.capBonus)) bad();
      // Everything checked: apply it.
      const relicPool = new Set(ITEM_KEYS.filter((k) => ITEMS[k].relic && (!ITEMS[k].unlock || relics.includes(k))));
      Object.assign(this, { siege, lord: s.lord, classes: new Set(classes), itemPool: new Set(pool), relicPool, loadout, daily: !!s.daily });
      this.reset();
      Object.assign(this, { wave, gold, age, path, b, st, items, bless, turrets, plots, doctrines, level, xp, stats, muts, adapt, dealt, lastAdapt, forecast, ...extra });
      if (typeof s.runId === 'string' && /^[a-z0-9-]{1,40}$/.test(s.runId)) this.runId = s.runId;
      this.units = units.map((u) => ({ ...u, uid: this.nextId++ }));
      this.th = { hp: 1, max: 1 };
      this.e = this.env(wave + 1, forecast[0]);
      this.refreshDerived();
      this.th.hp = Math.min(this.th.max, keepHp);
      this.segs.forEach((sg, i) => { sg.hp = Math.min(sg.max, segHp[i]); });
      this.shop = Array.from({ length: this.shopSize() }, (_, i) => (shop[i] ? { ...shop[i], price: this.priceOf(shop[i]) } : null));
      this.picks = picks;
      this.makeWaveOffers();
      this.nextPick();
      return true;
    } catch {
      return false;
    }
  }
}
