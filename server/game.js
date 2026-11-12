// Pure game simulation: no network and no timers. step(dt) advances the world,
// snapshot() returns what clients need to draw it. The server owns all rules.
//
// A run is round by round, in the spirit of Brotato and How Many Dudes?:
//   1. Prepare (no clock): pick one of two waves, spend gold in the shop, upgrade the castle.
//   2. The wave plays out on its own.
//   3. Rewards: every castle level gained offers 1 of 4 stat upgrades, then the spoils
//      of the wave offer 1 of 3 cards: a new defender, an item, a turret or a class blessing.
// Defenders are never bought; they arrive as spoils. Wave 30 is the final boss; after the
// victory the run can go on endlessly.

export const TICK = 1 / 20;
export const S = 14;            // half-size of the castle square
const SEG = 4;                  // wall segment length
const WALL_T = 0.7;             // wall half-thickness
const TH_HALF = 3.5;            // keep half-size
const TOWER_R = 2.1;
export const OVER_TIME = 30;
export const START_GOLD = 60;
export const FINAL_WAVE = 30;
export const MAX_COUNT = 110;   // monsters per wave; beyond this they come as fewer, tougher elites
const MAX_ALIVE = 240;          // brood spawns pause above this many living monsters
export const CHARGE_AFTER = 60; // seconds into a wave after which every monster charges

export const DIFFICULTY = {
  relaxed: { hp: 0.7, gold: 1.2 },
  normal: { hp: 1, gold: 1 },
  brutal: { hp: 1.3, gold: 0.9 },
};

// ---- Monsters ----
// `unlock` is the first wave a type can appear in an offer; bosses come every tenth wave in turn.
// points: how much of a wave's budget one monster takes (also the experience it gives).
export const ENEMIES = [
  { key: 'runner', hp: 30, speed: 4.4, dmg: 6, r: 0.6, gold: 1, wallMul: 1, points: 1, unlock: 1 },
  { key: 'brute', hp: 150, speed: 2.3, dmg: 16, r: 1.0, gold: 4, wallMul: 2.5, points: 4, unlock: 2 },
  { key: 'queen', hp: 1000, speed: 1.6, dmg: 35, r: 2.4, gold: 80, wallMul: 3, points: 30, boss: true },
  { key: 'spitter', hp: 45, speed: 3.0, dmg: 5, r: 0.7, gold: 2, wallMul: 1.2, points: 2, unlock: 5, ranged: 8 },
  { key: 'flyer', hp: 24, speed: 5.0, dmg: 5, r: 0.6, gold: 1, wallMul: 0, points: 1.5, unlock: 8, fly: true },
  { key: 'splitter', hp: 90, speed: 2.6, dmg: 8, r: 0.95, gold: 2, wallMul: 1.5, points: 4, unlock: 12, split: 3 },
  { key: 'shellback', hp: 240, speed: 1.8, dmg: 12, r: 1.15, gold: 6, wallMul: 2, points: 6, unlock: 15, armor: 8 },
  { key: 'behemoth', hp: 3200, speed: 1.1, dmg: 50, r: 2.8, gold: 120, wallMul: 5, points: 30, boss: true, armor: 14 },
  { key: 'broodmother', hp: 2600, speed: 1.4, dmg: 35, r: 2.6, gold: 120, wallMul: 3, points: 30, boss: true, brood: 3 },
  { key: 'skytyrant', hp: 2200, speed: 2.0, dmg: 40, r: 2.2, gold: 150, wallMul: 0, points: 30, boss: true, fly: true },
];
export const BOSSES = [2, 7, 9, 8];   // waves 10, 20, 30 (the final boss), then in turn

// Each offer follows a theme: which monsters make up its budget.
export const THEMES = [
  { key: 'swarm', w: { 0: 1 } },
  { key: 'warband', w: { 0: 0.55, 1: 0.45 } },
  { key: 'siege', w: { 1: 0.55, 3: 0.45 } },
  { key: 'spitters', w: { 3: 0.6, 0: 0.4 } },
  { key: 'skyraid', w: { 4: 0.7, 0: 0.3 } },
  { key: 'brood', w: { 5: 0.6, 0: 0.4 } },
  { key: 'ironhide', w: { 6: 0.6, 1: 0.4 } },
  { key: 'horde', w: null, unlock: 6 },
];

// ---- Defenders: fifteen classes in five families ----
// p is damage per hit; for support classes it is the strength of what they do.
export const UNITS = {
  archer: { fam: 'marksmen', p: 10, cd: 1.4, range: 19, kind: 2, speed: 40 },
  crossbow: { fam: 'marksmen', p: 55, cd: 3.0, range: 25, kind: 4, speed: 55, tough: true, pierce: true },
  ranger: { fam: 'marksmen', p: 20, cd: 1.8, range: 28, kind: 2, speed: 50, sky: true, crit: 0.15 },
  mage: { fam: 'arcane', p: 14, cd: 2.4, range: 17, kind: 1, speed: 24, aoe: 3, elem: true },
  frost: { fam: 'arcane', p: 6, cd: 1.8, range: 16, kind: 3, speed: 28, aoe: 2.2, slow: 0.45, elem: true },
  storm: { fam: 'arcane', p: 15, cd: 2.2, range: 18, chain: 4, elem: true },
  pyro: { fam: 'alchemy', p: 8, cd: 1.6, range: 15, kind: 5, speed: 26, aoe: 1.8, burn: 6, elem: true },
  alchemist: { fam: 'alchemy', p: 5, cd: 2.6, range: 16, kind: 6, speed: 20, aoe: 2.6, poison: 5, elem: true },
  bomber: { fam: 'alchemy', p: 30, cd: 3.4, range: 15, kind: 7, speed: 18, aoe: 3.5 },
  cleric: { fam: 'faith', p: 14, cd: 2.0, range: 12, heal: 'walls' },
  priest: { fam: 'faith', p: 30, cd: 3.0, range: 99, heal: 'keep' },
  bard: { fam: 'faith', p: 0.15, cd: 1, range: 9, aura: true },
  spear: { fam: 'wardens', p: 18, cd: 1.0, range: 4.5, melee: true },
  shield: { fam: 'wardens', p: 0.35, cd: 1, range: 0, guard: true },
  hexer: { fam: 'wardens', p: 0.25, cd: 2.0, range: 17, curse: 4 },
};
export const UNIT_KEYS = Object.keys(UNITS);
export const FAMILIES = ['marksmen', 'arcane', 'alchemy', 'faith', 'wardens'];
export const FAMILY_AT = [2, 4, 6];   // defenders of one family needed for each bonus tier
export const RARITY = [
  { key: 'common', mul: 1 },
  { key: 'rare', mul: 1.25 },
  { key: 'epic', mul: 1.6 },
  { key: 'legendary', mul: 2.1 },
];
export const TRAITS = ['eagle', 'quick', 'crit', 'greedy', 'scholar', 'slayer', 'veteran'];
const SUPPORT_TRAITS = ['eagle', 'quick', 'scholar', 'veteran'];
const NAMES = ['Aldric', 'Bryn', 'Cora', 'Dax', 'Edda', 'Finn', 'Greta', 'Hale', 'Ilsa', 'Joren', 'Kara', 'Lio', 'Mira', 'Nils', 'Orla', 'Pim',
  'Quin', 'Rhea', 'Sten', 'Tova', 'Ulf', 'Vera', 'Wren', 'Yara', 'Zane', 'Ada', 'Bo', 'Cyra', 'Dorn', 'Elin', 'Falk', 'Gil', 'Hedda', 'Ivo',
  'Jule', 'Kell', 'Lune', 'Mads', 'Nora', 'Oswin', 'Petra', 'Runa', 'Sol', 'Tam', 'Una', 'Vik', 'Wynn', 'Ysolde', 'Arn', 'Briar'];

// ---- Castle stats: every level-up offers four of these, in four rarities ----
export const STATS = {
  dmg: [5, 8, 12, 16],          // % damage
  aspd: [5, 8, 12, 16],         // % attack speed
  range: [4, 6, 9, 12],         // % range
  crit: [3, 5, 7, 10],          // crit chance, %
  elem: [8, 12, 18, 25],        // % elemental damage (mages, frost, storm, fire, poison)
  eng: [10, 15, 22, 30],        // % turret damage
  wallhp: [8, 12, 18, 25],      // % wall HP
  keephp: [150, 250, 400, 600], // keep HP
  regen: [1, 2, 3, 5],          // wall HP repaired per second during waves (grows with the walls)
  armor: [3, 5, 7, 10],         // damage taken by walls and keep is divided by 1 + armor/50
  harvest: [5, 8, 12, 16],      // gold after every wave; grows 5% each wave
  luck: [5, 10, 15, 20],        // better rarities
  xp: [5, 10, 15, 20],          // % experience
};
export const STAT_KEYS = Object.keys(STATS);

// ---- Items: bought in the shop or found as spoils. Many trade one thing for another. ----
export const ITEMS = {
  whetstone: { r: 0, mods: { dmg: 6 } },
  fletching: { r: 0, mods: { range: 6 } },
  wardrum: { r: 0, mods: { aspd: 6 } },
  horseshoe: { r: 0, mods: { luck: 10 } },
  ledger: { r: 0, mods: { harvest: 8, dmg: -2 } },
  lime: { r: 0, mods: { wallhp: 10 } },
  tome: { r: 0, mods: { xp: 15 } },
  kindling: { r: 0, mods: { elem: 10 } },
  toolbox: { r: 0, mods: { eng: 15 } },
  banner: { r: 0, mods: { keephp: 250 } },
  heavybolts: { r: 1, mods: { dmg: 15, aspd: -6 } },
  spyglass: { r: 1, mods: { range: 10, crit: 4 } },
  oil: { r: 1, fx: 'oil', unique: true },
  bounty: { r: 1, fx: 'bounty' },
  piggy: { r: 1, fx: 'interest', unique: true },
  chimes: { r: 1, mods: { regen: 2, armor: 3 } },
  grimoire: { r: 1, mods: { elem: 20, dmg: -4 } },
  cogs: { r: 1, mods: { eng: 20, aspd: 3 } },
  bells: { r: 1, mods: { keephp: 500, armor: 2 } },
  poster: { r: 1, fx: 'choices', unique: true },
  marksflag: { r: 1, fx: 'fam:marksmen' },
  arcaneflag: { r: 1, fx: 'fam:arcane' },
  alchemyflag: { r: 1, fx: 'fam:alchemy' },
  faithflag: { r: 1, fx: 'fam:faith' },
  wardenflag: { r: 1, fx: 'fam:wardens' },
  cursedbanner: { r: 2, mods: { dmg: 30, wallhp: -15 } },
  hourglass: { r: 2, fx: 'hourglass', unique: true },
  thorns: { r: 2, fx: 'thorns', unique: true },
  crown: { r: 2, mods: { luck: 25, harvest: 10 } },
  quiver: { r: 2, mods: { aspd: 15, crit: 5 } },
  stormglass: { r: 2, fx: 'chain' },
  bellows: { r: 2, fx: 'burn' },
  midas: { r: 3, fx: 'midas', unique: true },
  dragonheart: { r: 3, mods: { dmg: 20, elem: 20, aspd: 10 } },
  aegis: { r: 3, mods: { wallhp: 40, armor: 10, regen: 3 } },
  warhorn: { r: 3, mods: { aspd: 25, dmg: 10, range: -8 } },
};
export const ITEM_KEYS = Object.keys(ITEMS);
const ITEM_PRICE = [20, 45, 90, 180];

// ---- Turrets: stand on fixed spots in the courtyard; another copy raises the level ----
export const TURRETS = {
  bolt: { p: 12, cd: 0.8, range: 20, kind: 2, speed: 45, price: 40 },
  cannon: { p: 45, cd: 2.6, range: 18, kind: 7, speed: 22, aoe: 2.6, price: 70 },
  tesla: { p: 16, cd: 1.4, range: 15, chain: 3, price: 80 },
  mortar: { p: 60, cd: 4, range: 34, lob: true, aoe: 3.5, price: 90 },
  ballista: { p: 140, cd: 3, range: 32, kind: 4, speed: 60, tough: true, pierce: true, price: 110 },
};
export const TURRET_KEYS = Object.keys(TURRETS);
export const TURRET_SPOTS = [[-8, -8], [8, -8], [-8, 8], [8, 8], [-9.5, 0], [9.5, 0]];

// ---- Lords: chosen before a run. Each starts differently and trades one strength for a weakness. ----
export const LORDS = {
  marshal: { units: ['archer', 'archer', 'spear', 'archer'], mods: { dmg: 8, armor: 4 } },
  archmage: { units: ['mage', 'frost', 'archer'], mods: { elem: 30, wallhp: -10 } },
  merchant: { units: ['archer', 'archer', 'archer'], mods: { harvest: 12, luck: 20, dmg: -8 }, gold: 80 },
  engineer: { units: ['archer', 'archer', 'cleric'], mods: { eng: 40, aspd: -5 }, turret: 'bolt' },
  saint: { units: ['cleric', 'priest', 'archer', 'archer'], mods: { regen: 3, keephp: 400, dmg: -6 } },
};
export const LORD_KEYS = Object.keys(LORDS);

// ---- Castle abilities: the commander's own moves during a wave ----
export const ABILITIES = {
  volley: { cd: 20, r: 5 },   // a rain of arrows on a chosen spot
  mend: { cd: 35 },           // every wall is patched up, ruins are raised again
  rally: { cd: 30, t: 6 },    // every defender attacks 50% faster for a few seconds
};
export const ABILITY_KEYS = Object.keys(ABILITIES);

// cost[level] is the price of going from that level to the next one.
const costs = (base, growth, max, start) => Array.from({ length: max }, (_, l) => (l < start ? 0 : Math.round(base * growth ** (l - start))));
export const BUILDINGS = {
  hall: { start: 1, max: 20, cost: costs(90, 1.55, 20, 1) },
  walls: { start: 1, max: 20, cost: costs(60, 1.52, 20, 1) },
};
export const CAPACITY = [0, 10, 13, 16, 19, 22, 25, 28, 30, ...Array(12).fill(32)];   // defenders the walls hold, by wall level
const MORTAR_R = 3.5;
const REPAIR_HP_PER_GOLD = 20;

// Growth curves. n is the wave number.
export const hpMul = (n) => 1 + 0.18 * (n - 1) + 0.012 * (n - 1) ** 2 + 0.0005 * (n - 1) ** 3;
export const dmgMul = (n) => 1 + 0.06 * (n - 1) + 0.0015 * (n - 1) ** 2;
export const goldMul = (n) => 1 + 0.07 * (n - 1);
export const budget = (n) => 5 + 3 * n + (n >= 3 ? Math.min(n - 2, 40) * 3.2 : 0);
export const lvMul = (lv) => 1 + 0.12 * (lv - 1);
export const xpNeed = (lv) => Math.round(12 * lv ** 1.5);       // a defender's next level
export const levelNeed = (lv) => (lv + 3) ** 2;                   // the castle's next level
export const thMax = (l) => 1500 + 700 * (l - 1);
export const wallMul = (l) => 1 + 0.5 * (l - 1);
export const recruitLevel = (n) => 1 + Math.floor((n - 1) / 4);

const TOWERS = [[-S, -S], [S, -S], [-S, S], [S, S]];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;
const has = (u, t) => u.traits.includes(t);

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

export class Game {
  constructor(rng = Math.random, diff = 'normal', lord = 'marshal') {
    this.rng = rng;
    this.diff = Object.hasOwn(DIFFICULTY, diff) ? diff : 'normal';
    this.lord = Object.hasOwn(LORDS, lord) ? lord : 'marshal';
    this.players = new Set();
    this.nextId = 1;
    this.reset();
  }

  reset() {
    this.wave = 0;
    this.phase = 'prep';
    this.timer = 0;
    const lord = LORDS[this.lord];
    this.gold = START_GOLD + (lord.gold || 0);
    this.b = Object.fromEntries(Object.entries(BUILDINGS).map(([k, d]) => [k, d.start]));
    this.st = Object.fromEntries(STAT_KEYS.map((k) => [k, lord.mods[k] || 0]));
    this.items = {};
    this.bless = Object.fromEntries(UNIT_KEYS.map((k) => [k, 0]));
    this.turrets = [];
    this.level = 1;
    this.xp = 0;
    this.th = { hp: thMax(1), max: thMax(1) };
    this.segs = buildSegs();
    // A slot is a place a defender can stand: the four towers, then every wall segment.
    this.slots = [...TOWERS.map(([x, z]) => ({ x, z, seg: -1 })), ...this.segs.map((s, i) => ({ x: s.x, z: s.z, seg: i }))];
    this.units = [];
    for (const k of lord.units) this.units.push(this.newUnit(this.baseCard(k), this.freeSlot(k)));
    if (lord.turret) this.turrets.push({ k: lord.turret, lv: 1, spot: 0, cd: 0 });
    this.abil = Object.fromEntries(ABILITY_KEYS.map((k) => [k, 0]));
    this.rallyT = 0;
    this.rains = [];
    this.enemies = [];
    this.later = [];
    this.projs = [];
    this.clouds = [];
    this.fx = [];
    this.queue = [];
    this.spawnT = 0;
    this.spawnGap = 1;
    this.waveT = 0;
    this.reached = 0;
    this.hpMul = 1;
    this.dmgMul = 1;
    this.goldMul = 1;
    this.armorMul = 1;
    this.hx = 1;
    this.reward = 0;
    this.hardWave = false;
    this.shells = [];
    this.picks = [];
    this.rerolls = 0;
    this.pickRerolls = 0;
    this.shop = [];
    this.won = false;
    this.endless = false;
    this.stats = { kills: 0, earned: 0, bosses: 0 };
    this.best = null;
    this.refreshDerived();
    this.makeWaveOffers();
    this.makeShop();
  }

  layout() {
    return {
      S,
      segs: this.segs.map((s) => ({ x: s.x, z: s.z, hw: s.hw, hd: s.hd, gate: s.gate })),
      towers: TOWERS,
      thHalf: TH_HALF,
      slots: this.slots.map((p) => [p.x, p.z, p.seg]),
      turretSpots: TURRET_SPOTS,
      buildings: Object.fromEntries(Object.entries(BUILDINGS).map(([k, d]) => [k, { start: d.start, max: d.max }])),
      units: UNIT_KEYS,
      unitStats: UNITS,
      families: FAMILIES,
      familyAt: FAMILY_AT,
      rarity: RARITY.map((r) => r.key),
      traits: TRAITS,
      stats: STATS,
      items: ITEMS,
      turrets: TURRETS,
      enemies: ENEMIES,
      bosses: BOSSES,
      themes: THEMES.map((t) => t.key),
      capacity: CAPACITY,
      finalWave: FINAL_WAVE,
      diffs: Object.keys(DIFFICULTY),
      lords: LORDS,
      abilities: ABILITIES,
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
    if (this.phase !== 'over' || !this.players.has(id)) return false;
    this.reset();
    return true;
  }

  can(id) { return this.players.has(id); }
  count(key) { return this.items[key] || 0; }
  fxCount(fx) { let n = 0; for (const k in this.items) if (ITEMS[k].fx === fx) n += this.items[k]; return n; }

  // ---- Derived numbers: stats from picks and items, family bonuses ----

  // Recomputes everything that depends on stats, items and the army.
  refreshDerived() {
    const tot = { ...this.st };
    for (const k in this.items) for (const [s, v] of Object.entries(ITEMS[k].mods || {})) tot[s] += v * this.items[k];
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
    if (seg >= 0 && this.guard) m *= 1 - (this.guard[seg] || 0);
    return m;
  }

  // ---- Rarity: better with the wave, luck and a hard wave ----
  rollRarity(bonus = 0) {
    const n = this.wave + 1, luck = 1 + Math.max(-90, this.tot.luck + bonus) / 100;
    const leg = Math.min(0.15, Math.max(0, (n - 8) / 150)) * luck;
    const epic = Math.min(0.3, Math.max(0, (n - 3) / 60)) * luck;
    const rare = Math.min(0.6, 0.12 + n / 40) * luck;
    const r = this.rng();
    return r < leg ? 3 : r < leg + epic ? 2 : r < leg + epic + rare ? 1 : 0;
  }

  // ---- Waves: two offers, the commander picks one ----

  // Both offers are built from the same budget with different themes; one is harder and pays double.
  makeWaveOffers() {
    const n = this.wave + 1, rng = this.rng;
    const open = THEMES.filter((th) => (th.w ? Object.keys(th.w).every((t) => ENEMIES[t].unlock <= n) : n >= th.unlock));
    const pick = [];
    while (pick.length < 2) {
      const th = open[Math.floor(rng() * open.length)];
      if (!pick.includes(th) || open.length < 2) pick.push(th);
    }
    const hardMul = (n < 6 ? 1.3 : 1.5) + rng() * 0.4, hardFirst = rng() < 0.5;
    const regular = ENEMIES.map((e, t) => t).filter((t) => !ENEMIES[t].boss && ENEMIES[t].unlock <= n);
    this.waves = pick.map((th, i) => {
      const hard = hardFirst ? i === 0 : i === 1, pts = budget(n) * (hard ? hardMul : 1);
      const w = th.w || Object.fromEntries(regular.map((t) => [t, 1 / regular.length]));
      const c = ENEMIES.map(() => 0);
      for (const t in w) c[t] = Math.max(1, Math.round((pts * w[t]) / ENEMIES[t].points));
      if (c[0] && c.reduce((a, b) => a + b, 0) < 3) c[0] = 3;
      // A huge wave comes as fewer elites with the same total strength.
      const total = c.reduce((a, b) => a + b, 0), hx = total > MAX_COUNT ? total / MAX_COUNT : 1;
      if (hx > 1) for (const t in c) if (c[t]) c[t] = Math.max(1, Math.round(c[t] / hx));
      if (n % 10 === 0) c[BOSSES[(n / 10 - 1) % BOSSES.length]] = hard && n >= 20 ? 2 : 1;
      const gold = Math.round((20 + 6 * n) * goldMul(n) * DIFFICULTY[this.diff].gold * (hard ? 2 : 1));
      return { c, gold, hard, th: th.key, hx: r2(hx) };
    });
  }

  chooseWave(id, i) {
    if (this.phase !== 'prep' || !this.can(id) || !Number.isInteger(i) || !this.waves[i]) return false;
    this.startWave(this.waves[i]);
    return true;
  }

  startWave(offer) {
    const n = ++this.wave;
    this.phase = 'wave';
    this.reward = offer.gold;
    this.hardWave = offer.hard;
    this.hx = offer.hx || 1;
    const types = [], bosses = [];
    offer.c.forEach((count, t) => { for (let i = 0; i < count; i++) (ENEMIES[t].boss ? bosses : types).push(t); });
    for (let i = types.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [types[i], types[j]] = [types[j], types[i]];
    }
    for (const t of bosses) types.splice(Math.floor(types.length * 0.4), 0, t);
    const dirs = [];
    for (let i = 1 + (n >= 4) + (n >= 8) + (n >= 25); i > 0; i--) dirs.push(this.rng() * Math.PI * 2);
    this.hpMul = hpMul(n) * DIFFICULTY[this.diff].hp;
    this.dmgMul = dmgMul(n);
    this.goldMul = goldMul(n) * DIFFICULTY[this.diff].gold;
    this.armorMul = 1 + 0.03 * (n - 1);
    this.queue = types.map((t) => ({ t, a: dirs[Math.floor(this.rng() * dirs.length)] + (this.rng() - 0.5) * 0.7 }));
    this.spawnGap = Math.max(0.12, 0.9 - n * 0.05);
    this.spawnT = 0;
    this.waveT = 0;
    this.waves = [];
    for (const u of this.units) u.cd = 0;
    for (const k of ABILITY_KEYS) this.abil[k] = 0;
    this.rallyT = 0;
    this.rains = [];
  }

  // A monster of type t at (x, z). Bosses grow more slowly than the horde; elites are stronger.
  makeEnemy(t, x, z, scale = 1) {
    const d = ENEMIES[t], elite = d.boss ? 1 : this.hx;
    const hp = Math.max(1, Math.round(d.hp * (d.boss ? this.hpMul ** 0.85 : this.hpMul) * elite * scale));
    return { id: this.nextId++, t, x, z, hp, max: hp, cd: this.rng(), slow: 0, slowK: 0, burn: 0, burnDps: 0, curse: 0, curseK: 0, hold: -2, bt: 2, hx: elite * scale };
  }

  spawn({ t, a }) {
    const dist = 52 + this.rng() * 8;
    this.enemies.push(this.makeEnemy(t, Math.sin(a) * dist, Math.cos(a) * dist));
  }

  harvestGold() { return Math.max(0, Math.round(this.tot.harvest)); }

  endWave() {
    const n = this.wave, prevGold = this.gold;
    let income = this.reward + this.harvestGold();
    // Piggy bank: interest on unspent gold, capped by the wave.
    if (this.count('piggy')) income += Math.min(Math.round(prevGold * 0.1), Math.round(15 * n * goldMul(n)));
    this.gold += income;
    this.stats.earned += income;
    // Harvesting grows 5% after every wave.
    if (this.st.harvest > 0) this.st.harvest = r1(this.st.harvest * 1.05);
    for (const u of this.units) this.giveXp(u, n * 0.6);
    this.projs = []; this.shells = []; this.later = []; this.clouds = [];
    // Between waves the castle folk patch things up for free: half of the damage, ruins raised to a third.
    for (const s of this.segs) s.hp = s.hp > 0 ? s.hp + (s.max - s.hp) * 0.5 : s.max / 3;
    this.th.hp += (this.th.max - this.th.hp) * 0.5;
    // Rewards: level-ups first, then the spoils of the wave (two after a boss).
    const boss = n % 10 === 0;
    for (let i = 0; i < (boss ? 2 : 1); i++) this.picks.push({ type: 'spoils', luck: (this.hardWave ? 30 : 0) + (boss ? 60 : 0) });
    if (n === FINAL_WAVE && !this.won) { this.won = true; this.picks.unshift({ type: 'victory' }); }
    this.pickRerolls = 0;
    this.nextPick();
  }

  // ---- Rewards between waves ----

  // Moves on to the next pending choice, or to preparation when there is none.
  nextPick() {
    while (this.picks.length && this.picks[0].opts == null && this.picks[0].type !== 'victory') {
      const p = this.picks[0];
      p.opts = p.type === 'level' ? this.levelOptions() : this.spoilsOptions(p.luck);
    }
    if (this.picks.length) { this.phase = 'reward'; return; }
    this.phase = 'prep';
    this.rerolls = 0;
    this.makeWaveOffers();
    this.makeShop();
  }

  levelOptions() {
    const keys = [...STAT_KEYS], opts = [];
    // Every fifth level is guaranteed to be rare or better.
    const floor = this.level % 5 === 0 ? 1 : 0;
    while (opts.length < 4) {
      const s = keys.splice(Math.floor(this.rng() * keys.length), 1)[0];
      opts.push({ stat: s, r: Math.max(floor, this.rollRarity()) });
    }
    return opts;
  }

  // Spoils: a new defender (or a promotion when the walls are full), an item, a turret or a blessing.
  spoilsOptions(luck = 0) {
    const n = 3 + Math.min(1, this.count('poster')), opts = [this.recruitOption(luck)];
    while (opts.length < n) {
      const r = this.rng();
      let o;
      if (r < 0.4) o = this.itemOption(luck);
      else if (r < 0.62) o = this.turretOption();
      else if (r < 0.8) o = this.blessOption(luck);
      else o = this.recruitOption(luck);
      if (o && !opts.some((x) => JSON.stringify(x) === JSON.stringify(o))) opts.push(o);
    }
    return opts;
  }

  recruitOption(luck) {
    if (this.units.length >= CAPACITY[this.b.walls]) {
      const u = this.units[Math.floor(this.rng() * this.units.length)];
      return { type: 'promote', uid: u.uid, k: u.k, name: u.name, rar: u.rar };
    }
    return { type: 'recruit', card: this.makeCard(luck) };
  }

  itemOption(luck) {
    const rar = this.rollRarity(luck);
    const pool = ITEM_KEYS.filter((k) => ITEMS[k].r === rar && !(ITEMS[k].unique && this.items[k]));
    return pool.length ? { type: 'item', key: pool[Math.floor(this.rng() * pool.length)] } : null;
  }

  turretOption() {
    const k = TURRET_KEYS[Math.floor(this.rng() * TURRET_KEYS.length)];
    if (!this.turrets.some((t) => t.k === k) && this.turrets.length >= TURRET_SPOTS.length) return null;
    return { type: 'turret', k };
  }

  blessOption(luck) {
    const present = [...new Set(this.units.map((u) => u.k))];
    if (!present.length) return null;
    const k = present[Math.floor(this.rng() * present.length)];
    return { type: 'bless', k, v: [1, 1, 2, 3][this.rollRarity(luck)] };
  }

  // A random defender with their own rolled stats.
  makeCard(luck = 0) {
    const n = this.wave + 1, rng = this.rng;
    // Half the time the recruit comes from a family already on the walls, so builds can grow.
    const owned = new Set(this.units.map((u) => UNITS[u.k].fam)), kin = UNIT_KEYS.filter((c) => owned.has(UNITS[c].fam));
    const pool = kin.length && rng() < 0.5 ? kin : UNIT_KEYS;
    const k = pool[Math.floor(rng() * pool.length)], d = UNITS[k];
    const rar = this.rollRarity(luck);
    const support = d.heal || d.aura || d.guard || d.curse;
    const tpool = support ? SUPPORT_TRAITS : TRAITS, traits = [];
    for (let want = [0, 1, 1, 2][rar]; traits.length < want;) {
      const t = tpool[Math.floor(rng() * tpool.length)];
      if (!traits.includes(t)) traits.push(t);
    }
    return {
      k, rar, traits,
      lv: recruitLevel(n) + (traits.includes('veteran') ? 2 : 0),
      name: NAMES[Math.floor(rng() * NAMES.length)],
      p: Math.round(d.p * RARITY[rar].mul * (0.88 + rng() * 0.24) * 1000) / 1000,
      cd: r2(d.cd * (0.9 + rng() * 0.2)),
      range: r1(d.range * (0.93 + rng() * 0.14)),
    };
  }

  baseCard(k) { const d = UNITS[k]; return { k, rar: 0, lv: 1, p: d.p, cd: d.cd, range: d.range, traits: [] }; }

  pickRerollCost() { return Math.round((4 + 2 * this.wave) * (1 + 0.5 * this.pickRerolls)); }

  // Chooses option i of the pending reward.
  choose(id, i) {
    const p = this.picks[0];
    if (this.phase !== 'reward' || !p || !this.can(id) || !Number.isInteger(i)) return false;
    if (p.type === 'victory') {
      if (i === 0) { this.endless = true; this.picks.shift(); this.nextPick(); return true; }
      if (i === 1) { this.fall(true); return true; }
      return false;
    }
    const o = p.opts[i];
    if (!o) return false;
    if (p.type === 'level') this.st[o.stat] += STATS[o.stat][o.r];
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
      const slot = this.freeSlot(o.card.k);
      if (slot < 0 || this.units.length >= CAPACITY[this.b.walls]) return false;
      this.units.push(this.newUnit(o.card, slot));
      this.fx.push([8, this.slots[slot].x, this.slots[slot].z, o.card.rar]);
    } else if (o.type === 'promote') {
      const u = this.unit(o.uid);
      if (!u) return false;
      if (u.rar < 3) { u.p = Math.round(u.p * (RARITY[u.rar + 1].mul / RARITY[u.rar].mul) * 1000) / 1000; u.rar++; } else u.lv += 3;
      this.fx.push([9, this.slots[u.slot].x, this.slots[u.slot].z, u.rar]);
    } else if (o.type === 'item') this.addItem(o.key);
    else if (o.type === 'turret') { if (!this.addTurret(o.k)) return false; }
    else if (o.type === 'bless') this.bless[o.k] += o.v;
    return true;
  }

  // Skipping the spoils pays a little gold instead.
  skipGold() { return Math.round(10 * goldMul(this.wave + 1)); }

  skip(id) {
    const p = this.picks[0];
    if (this.phase !== 'reward' || !p || p.type !== 'spoils' || !this.can(id)) return false;
    this.gold += this.skipGold();
    this.picks.shift();
    this.pickRerolls = 0;
    this.nextPick();
    return true;
  }

  rerollPick(id) {
    const p = this.picks[0];
    if (this.phase !== 'reward' || !p || p.type === 'victory' || !this.can(id)) return false;
    const cost = this.pickRerollCost();
    if (this.gold < cost) return false;
    this.gold -= cost;
    this.pickRerolls++;
    p.opts = p.type === 'level' ? this.levelOptions() : this.spoilsOptions(p.luck);
    return true;
  }

  addItem(k) {
    this.items[k] = (this.items[k] || 0) + 1;
    this.refreshDerived();
  }

  addTurret(k) {
    const t = this.turrets.find((x) => x.k === k);
    if (t) { t.lv++; this.fx.push([9, TURRET_SPOTS[t.spot][0], TURRET_SPOTS[t.spot][1], 1]); return true; }
    if (this.turrets.length >= TURRET_SPOTS.length) return false;
    const used = new Set(this.turrets.map((x) => x.spot));
    const spot = TURRET_SPOTS.findIndex((_, i) => !used.has(i));
    this.turrets.push({ k, lv: 1, spot, cd: 0 });
    this.fx.push([8, TURRET_SPOTS[spot][0], TURRET_SPOTS[spot][1], 1]);
    return true;
  }

  // ---- The shop: four offers of items and turrets, lockable, rerollable ----

  priceOf(o) {
    const n = this.wave + 1, base = o.type === 'item' ? ITEM_PRICE[ITEMS[o.key].r] : TURRETS[o.k].price;
    return Math.round(base * goldMul(n) * (1 + 0.1 * n + 0.002 * n * n));
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
    this.shop = Array.from({ length: 4 }, (_, i) => {
      if (old[i] && old[i].locked) return old[i];
      // No offer twice in one shop.
      let o = null;
      for (let tries = 0; tries < 12 && (!o || seen.has(id(o))); tries++) o = this.shopOffer();
      if (!o || seen.has(id(o))) return null;
      seen.add(id(o));
      return { ...o, price: this.priceOf(o), locked: false };
    });
  }

  shopRerollCost() { return Math.round((5 + 2 * this.wave) * (1 + 0.5 * this.rerolls)); }

  rerollShop(id) {
    if (this.phase !== 'prep' || !this.can(id)) return false;
    const cost = this.shopRerollCost();
    if (this.gold < cost) return false;
    this.gold -= cost;
    this.rerolls++;
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
    if (o.type === 'turret' && !this.turrets.some((t) => t.k === o.k) && this.turrets.length >= TURRET_SPOTS.length) return false;
    this.gold -= o.price;
    if (o.type === 'item') this.addItem(o.key); else this.addTurret(o.k);
    this.shop[i] = null;
    return true;
  }

  // ---- Defenders ----

  newUnit(card, slot) {
    return {
      uid: this.nextId++, slot, k: card.k, name: card.name || NAMES[Math.floor(this.rng() * NAMES.length)], rar: card.rar, lv: card.lv, xp: 0,
      p: card.p, rcd: card.cd, range: card.range, traits: [...card.traits], kills: 0, cd: 0,
    };
  }

  // A new defender takes the free slot furthest from everyone else, so the walls fill evenly.
  // Spearmen and shieldbearers belong on the walls, not in the towers.
  freeSlot(k) {
    const used = new Set(this.units.map((u) => u.slot)), wallOnly = UNITS[k].melee || UNITS[k].guard;
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

  trainCost(u) { return Math.round(22 * (1 + 0.5 * u.rar) * u.lv ** 1.15); }

  train(id, uid) {
    const u = this.unit(uid);
    if (!u || this.phase !== 'prep' || !this.can(id)) return false;
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
    if (!u || this.phase !== 'prep' || !this.can(id) || this.units.length <= 1) return false;
    this.gold += this.refund(u);
    this.units = this.units.filter((o) => o !== u);
    this.refreshDerived();
    return true;
  }

  giveXp(u, xp) {
    u.xp += xp * (has(u, 'scholar') ? 1.75 : 1) * (1 + this.tot.xp / 100);
    while (u.xp >= xpNeed(u.lv)) {
      u.xp -= xpNeed(u.lv);
      u.lv++;
      this.fx.push([9, this.slots[u.slot].x, this.slots[u.slot].z, u.rar]);
    }
  }

  // Castle experience from kills; every level queues a stat choice for after the wave.
  castleXp(pts) {
    this.xp += pts * (1 + this.tot.xp / 100);
    while (this.xp >= levelNeed(this.level)) {
      this.xp -= levelNeed(this.level);
      this.level++;
      this.picks.push({ type: 'level' });
      this.fx.push([15, 0, 0, this.level]);
    }
  }

  // Effective stats, with every bonus applied.
  supportPower(u) { return u.p * (1 + 0.06 * (u.lv - 1)) * (1 + 0.2 * this.bless[u.k]) * (UNITS[u.k].fam === 'faith' ? 1 + 0.25 * this.famTier.faith : 1); }

  unitPower(u) {
    const d = UNITS[u.k], m = lvMul(u.lv) * (1 + 0.2 * this.bless[u.k]);
    if (d.heal === 'walls') return u.p * m * wallMul(this.b.walls) * Math.max(0.2, 1 + this.tot.wallhp / 100) * (1 + 0.25 * this.famTier.faith);
    if (d.heal === 'keep') return u.p * m * (1 + 0.3 * (this.b.hall - 1)) * (1 + 0.25 * this.famTier.faith);
    if (d.aura || d.guard || d.curse) return this.supportPower(u);
    let v = u.p * m * Math.max(0.1, 1 + this.tot.dmg / 100);
    if (d.elem) v *= Math.max(0.1, 1 + this.tot.elem / 100);
    if (d.fam === 'arcane') v *= 1 + 0.15 * this.famTier.arcane;
    return v;
  }
  unitReload(u) {
    const haste = Math.max(0.25, 1 + this.tot.aspd / 100 + (this.haste ? this.haste[u.slot] || 0 : 0) + (this.rallyT > 0 ? 0.5 : 0));
    return u.rcd / (haste * (has(u, 'quick') ? 1.25 : 1));
  }
  unitRange(u) {
    const fam = UNITS[u.k].fam === 'marksmen' ? 0.1 * this.famTier.marksmen : 0;
    return u.range * Math.max(0.3, 1 + this.tot.range / 100 + fam) * (has(u, 'eagle') ? 1.2 : 1);
  }
  unitCrit(u) {
    return Math.min(1, this.tot.crit / 100 + (UNITS[u.k].crit || 0) + (has(u, 'crit') ? 0.15 : 0) + (UNITS[u.k].fam === 'marksmen' ? 0.05 * this.famTier.marksmen : 0));
  }
  areaMul() { return 1 + 0.15 * this.famTier.alchemy; }
  dotMul() { return 1 + 0.25 * this.famTier.alchemy + 0.5 * this.fxCount('burn'); }

  turretPower(t) { return TURRETS[t.k].p * (1 + 0.5 * (t.lv - 1)) * Math.max(0.1, 1 + this.tot.eng / 100); }

  // ---- Castle abilities ----

  ability(id, k, x = 0, z = 0) {
    if (this.phase !== 'wave' || !this.can(id) || !Object.hasOwn(ABILITIES, k) || this.abil[k] > 0) return false;
    if (k === 'volley') {
      if (typeof x !== 'number' || typeof z !== 'number' || !Number.isFinite(x) || !Number.isFinite(z)) return false;
      x = clamp(x, -60, 60); z = clamp(z, -60, 60);
      this.rains.push({ x, z, t: 0.8 });
      this.fx.push([19, r2(x), r2(z), ABILITIES.volley.r]);
    } else if (k === 'mend') {
      for (const s of this.segs) s.hp = s.hp > 0 ? Math.min(s.max, s.hp + s.max * 0.25) : s.max * 0.2;
      this.fx.push([20, 0, 0, 0]);
    } else if (k === 'rally') {
      this.rallyT = ABILITIES.rally.t;
      this.fx.push([21, 0, 0, 0]);
    }
    this.abil[k] = ABILITIES[k].cd;
    return true;
  }

  // The volley lands a moment after it is called, hitting everything under it.
  volleyDamage() { return 40 * this.hpMul * Math.sqrt(Math.max(0.1, 1 + this.tot.dmg / 100)); }

  updateAbilities(dt) {
    for (const k of ABILITY_KEYS) this.abil[k] = Math.max(0, this.abil[k] - dt);
    this.rallyT = Math.max(0, this.rallyT - dt);
    for (const r of this.rains) {
      r.t -= dt;
      if (r.t > 0) continue;
      this.fx.push([1, r2(r.x), r2(r.z), ABILITIES.volley.r]);
      for (const e of this.enemies) if (Math.hypot(e.x - r.x, e.z - r.z) < ABILITIES.volley.r + ENEMIES[e.t].r) this.hurtEnemy(e, this.volleyDamage());
    }
    this.rains = this.rains.filter((r) => r.t > 0);
  }

  // ---- Buildings ----

  upgrade(id, key) {
    if (!Object.hasOwn(BUILDINGS, key) || this.phase !== 'prep' || !this.can(id)) return false;
    const d = BUILDINGS[key], l = this.b[key];
    if (l >= d.max || (key !== 'hall' && l >= this.b.hall) || this.gold < d.cost[l]) return false;
    this.gold -= d.cost[l];
    this.b[key] = l + 1;
    this.refreshDerived();
    this.fx.push([4, 0, 0, key]);
    return true;
  }

  repairCost(what) {
    const missing = what === 'hall' ? this.th.max - this.th.hp : this.segs.reduce((a, s) => a + s.max - s.hp, 0);
    return Math.ceil(missing / REPAIR_HP_PER_GOLD);
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
    this.spawnT -= dt;
    while (this.spawnT <= 0 && this.queue.length) { this.spawn(this.queue.pop()); this.spawnT += this.spawnGap; }
    this.updateAbilities(dt);
    this.updateSupport(dt);
    this.updateEnemies(dt);
    this.updateUnits(dt);
    this.updateTurrets(dt);
    this.updateProjs(dt);
    this.updateClouds(dt);
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    if (this.later.length) { this.enemies.push(...this.later); this.later = []; }
    if (this.th.hp <= 0) this.fall();
    else if (!this.queue.length && !this.enemies.length) this.endWave();
  }

  fall(victory = false) {
    if (!victory) this.th.hp = 0;
    this.phase = 'over'; this.timer = OVER_TIME; this.reached = this.wave; this.victory = victory || this.won;
    const top = [...this.units].sort((a, b) => b.kills - a.kills)[0];
    this.best = top ? { name: top.name, k: top.k, kills: top.kills, lv: top.lv } : null;
    this.enemies = []; this.queue = []; this.projs = []; this.shells = []; this.later = []; this.clouds = []; this.picks = [];
  }

  // Bards hasten, shieldbearers guard and walls mend themselves.
  updateSupport(dt) {
    this.haste = {};
    this.guard = {};
    for (const u of this.units) {
      const d = UNITS[u.k], post = this.slots[u.slot];
      if (post.seg >= 0 && this.segs[post.seg].hp <= 0) continue;
      if (d.aura) {
        const p = this.supportPower(u), r = this.unitRange(u);
        for (const o of this.units) if (o !== u && Math.hypot(this.slots[o.slot].x - post.x, this.slots[o.slot].z - post.z) <= r) this.haste[o.slot] = Math.min(0.6, (this.haste[o.slot] || 0) + p);
      } else if (d.guard && post.seg >= 0) {
        const p = Math.min(0.7, this.supportPower(u));
        this.segs.forEach((s, i) => {
          const q = Math.hypot(s.x - post.x, s.z - post.z);
          const g = i === post.seg ? p : q < SEG + 0.1 ? p / 2 : 0;
          if (g > (this.guard[i] || 0)) this.guard[i] = g;
        });
      }
    }
    const regen = this.tot.regen * wallMul(this.b.walls) * dt;
    if (regen > 0) for (const s of this.segs) if (s.hp > 0 && s.hp < s.max) s.hp = Math.min(s.max, s.hp + regen);
  }

  // Deals damage, after curses and armour. u is the defender who dealt it, if any.
  hurtEnemy(e, dmg, u = null, pierce = false) {
    if (e.hp <= 0) return;
    const d = ENEMIES[e.t];
    if (u && has(u, 'slayer') && (d.boss || d.armor || e.t === 1)) dmg *= 1.5;
    if (e.curse > 0) dmg *= 1 + e.curseK;
    if (d.armor && !pierce) dmg = Math.max(dmg * 0.25, dmg - d.armor * this.armorMul);
    e.hp -= dmg;
    if (e.hp > 0) return;
    let gold = d.gold * this.goldMul * e.hx * (1 + 0.25 * this.fxCount('bounty'));
    if (u && has(u, 'greedy')) gold += 2 * this.goldMul;
    if (this.count('midas') && this.rng() < 0.1) gold *= 3;
    gold = Math.round(gold);
    this.gold += gold;
    this.stats.earned += gold;
    this.stats.kills++;
    if (d.boss) this.stats.bosses++;
    this.castleXp(d.points);
    if (u && u.uid) { u.kills++; this.giveXp(u, d.points * (1 + 0.1 * this.wave)); }
    this.fx.push([0, r2(e.x), r2(e.z), e.t]);
    if (d.split) {
      for (let i = 0; i < d.split; i++) {
        const a = this.rng() * Math.PI * 2;
        this.later.push(this.makeEnemy(0, e.x + Math.sin(a) * 1.2, e.z + Math.cos(a) * 1.2, 0.6));
      }
    }
  }

  // Picks a target for an attacker at (x, z) with the given range and preferences.
  target(x, z, range, { melee = false, tough = false, sky = false, ground = false, skip = null } = {}) {
    let best = null, score = -Infinity;
    for (const e of this.enemies) {
      const ed = ENEMIES[e.t];
      if (e.hp <= 0 || (melee && ed.fly) || (ground && ed.fly) || (skip && skip(e))) continue;
      const q = Math.hypot(e.x - x, e.z - z);
      if (q > range + ed.r) continue;
      const s = tough ? e.hp : (sky && ed.fly ? 1000 : 0) - q;
      if (s > score) { score = s; best = e; }
    }
    return best;
  }

  // Lightning that jumps from monster to monster, weaker with each jump.
  chain(first, dmg, jumps, u) {
    const hit = new Set([first]);
    let cur = first, from = u ? this.slots[u.slot] : null;
    if (from) this.fx.push([12, r2(from.x), r2(from.z), r2(cur.x), r2(cur.z)]);
    for (let i = 0; cur && i <= jumps; i++) {
      this.hurtEnemy(cur, dmg, u);
      dmg *= 0.8;
      let next = null, bd = 6;
      for (const e of this.enemies) { if (hit.has(e) || e.hp <= 0) continue; const q = Math.hypot(e.x - cur.x, e.z - cur.z); if (q < bd) { bd = q; next = e; } }
      if (next) { hit.add(next); this.fx.push([12, r2(cur.x), r2(cur.z), r2(next.x), r2(next.z)]); }
      cur = next;
    }
  }

  shoot(x, z, target, spec, dmg, u, extra = {}) {
    const dist = Math.hypot(target.x - x, target.z - z) || 1, dx = (target.x - x) / dist, dz = (target.z - z) / dist;
    this.projs.push({
      id: this.nextId++, kind: spec.kind, x: x + dx, z: z + dz, vx: dx * spec.speed, vz: dz * spec.speed, ttl: ((spec.range * 1.6) / spec.speed) * 1.2,
      r: ENEMIES[target.t].fly ? 0.9 : 0.4, aoe: (spec.aoe || 0) * (spec.burn || spec.poison || spec.kind === 7 ? this.areaMul() : 1), dmg, u,
      pierce: !!spec.pierce, slow: spec.slow || 0, slowT: 2, ...extra,
    });
  }

  // Defenders on the walls. A unit is out of action while its wall segment is down.
  updateUnits(dt) {
    const chainBonus = 2 * this.fxCount('chain');
    for (const u of this.units) {
      const post = this.slots[u.slot], d = UNITS[u.k];
      u.cd -= dt;
      if (u.cd > 0 || d.aura || d.guard || (post.seg >= 0 && this.segs[post.seg].hp <= 0)) continue;
      const range = this.unitRange(u);
      if (d.heal === 'walls') {
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
        // Priests pray for the keep while monsters are about.
        if (this.th.hp >= this.th.max || !this.enemies.length) continue;
        u.cd = this.unitReload(u);
        const amt = Math.min(this.th.max - this.th.hp, this.unitPower(u));
        this.th.hp += amt;
        this.giveXp(u, amt / 40);
        this.fx.push([14, 0, 0, 0]);
        continue;
      }
      if (d.curse) {
        // Hexers curse the toughest monster that is not cursed yet: it takes more damage.
        const e = this.target(post.x, post.z, range, { tough: true, skip: (m) => m.curse > 0.5 });
        if (!e) continue;
        u.cd = this.unitReload(u);
        e.curse = d.curse; e.curseK = Math.max(e.curseK, Math.min(1, this.unitPower(u)));
        this.giveXp(u, 0.5);
        this.fx.push([13, r2(e.x), r2(e.z), 0]);
        continue;
      }
      const best = this.target(post.x, post.z, range, { melee: d.melee, tough: d.tough, sky: d.sky });
      if (!best) continue;
      u.cd = this.unitReload(u) * (0.9 + this.rng() * 0.2);
      let dmg = this.unitPower(u);
      if (this.rng() < this.unitCrit(u)) dmg *= 2;
      if (d.melee) { this.hurtEnemy(best, dmg, u); this.fx.push([7, r2(best.x), r2(best.z), 0]); continue; }
      if (d.chain) { this.chain(best, dmg, d.chain + chainBonus, u); continue; }
      const extra = {};
      if (d.slow) extra.slowT = 2 * (1 + 0.25 * this.famTier.arcane);
      if (d.burn) extra.burn = d.burn * (dmg / u.p) * this.dotMul();
      if (d.poison) extra.poison = d.poison * (dmg / u.p) * this.dotMul();
      this.shoot(post.x, post.z, best, { ...d, range }, dmg, u, extra);
    }
  }

  // Turrets in the courtyard. They grow with their level and the engineering stat.
  updateTurrets(dt) {
    for (const t of this.turrets) {
      const d = TURRETS[t.k], [x, z] = TURRET_SPOTS[t.spot];
      t.cd -= dt;
      if (t.cd > 0) continue;
      const dmg = this.turretPower(t);
      if (d.lob) {
        // The mortar shells the thickest crowd outside the walls, leading moving targets.
        let best = null, score = 0;
        for (const e of this.enemies) {
          if (Math.hypot(e.x, e.z) > d.range || ENEMIES[e.t].fly) continue;
          let c = 0;
          for (const o of this.enemies) if (Math.hypot(o.x - e.x, o.z - e.z) < MORTAR_R) c += ENEMIES[o.t].points;
          if (c > score) { score = c; best = e; }
        }
        if (!best) continue;
        t.cd = d.cd;
        const dd = Math.hypot(best.x, best.z), edge = Math.max(Math.abs(best.x), Math.abs(best.z));
        const lead = Math.min(ENEMIES[best.t].speed * 1.1, Math.max(0, dd * (1 - (S + 1) / edge)));
        const tx = best.x * (1 - lead / dd), tz = best.z * (1 - lead / dd);
        this.shells.push({ x: tx, z: tz, t: 1.1, dmg });
        this.fx.push([5, r2(tx), r2(tz), t.spot]);
        continue;
      }
      const best = this.target(x, z, d.range, { tough: d.tough });
      if (!best) continue;
      t.cd = d.cd;
      this.fx.push([16, t.spot, 0, 0]);
      if (d.chain) this.chain(best, dmg, d.chain + Math.floor(t.lv / 2), null);
      else this.shoot(x, z, best, d, dmg, null);
    }
    for (const sh of this.shells) sh.t -= dt;
    for (const sh of this.shells) {
      if (sh.t > 0) continue;
      this.fx.push([1, r2(sh.x), r2(sh.z), MORTAR_R]);
      for (const e of this.enemies) if (!ENEMIES[e.t].fly && Math.hypot(e.x - sh.x, e.z - sh.z) < MORTAR_R + ENEMIES[e.t].r) this.hurtEnemy(e, sh.dmg);
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
          if (e.hp > 0 && Math.hypot(e.x - b.x, e.z - b.z) < b.r + ENEMIES[e.t].r) { hit = e; break; }
        }
      }
      b.ttl -= dt;
      if (!hit && b.ttl > 0) { keep.push(b); continue; }
      if (b.poison) {
        // The flask breaks and leaves a poison cloud on the ground.
        this.clouds.push({ id: this.nextId++, x: b.x, z: b.z, r: b.aoe, t: 4, dps: b.poison, u: b.u });
        this.fx.push([17, r2(b.x), r2(b.z), r2(b.aoe)]);
        continue;
      }
      const victims = b.aoe ? this.enemies.filter((e) => Math.hypot(e.x - b.x, e.z - b.z) < b.aoe + ENEMIES[e.t].r) : hit ? [hit] : [];
      if (b.aoe) this.fx.push([b.slow ? 3 : b.burn ? 18 : 1, r2(b.x), r2(b.z), r2(b.aoe)]);
      for (const e of victims) {
        if (b.slow) { e.slow = Math.max(e.slow, b.slowT); e.slowK = Math.max(e.slowK, b.slow); }
        if (b.burn) { e.burn = 3; e.burnDps = Math.max(e.burnDps, b.burn); e.burnU = b.u; }
        this.hurtEnemy(e, b.dmg, b.u, b.pierce);
      }
    }
    this.projs = keep;
  }

  // Burning monsters and poison clouds.
  updateClouds(dt) {
    for (const e of this.enemies) {
      if (e.burn > 0) { e.burn -= dt; this.hurtEnemy(e, e.burnDps * dt, e.burnU); if (e.burn <= 0) e.burnDps = 0; }
      if (e.curse > 0) { e.curse -= dt; if (e.curse <= 0) e.curseK = 0; }
    }
    for (const c of this.clouds) {
      c.t -= dt;
      for (const e of this.enemies) if (!ENEMIES[e.t].fly && Math.hypot(e.x - c.x, e.z - c.z) < c.r + ENEMIES[e.t].r) this.hurtEnemy(e, c.dps * dt, c.u, true);
    }
    this.clouds = this.clouds.filter((c) => c.t > 0);
  }

  collideStatic(e, r) {
    let hit = null;
    for (const s of this.segs) if (s.hp > 0 && pushOutBox(e, r, s.x, s.z, s.hw, s.hd)) hit = s;
    for (const [tx, tz] of TOWERS) pushOutCircle(e, r, tx, tz, TOWER_R);
    const th = pushOutBox(e, r, 0, 0, TH_HALF, TH_HALF);
    return { seg: hit, th };
  }

  // Monsters walk at the keep, break whatever wall is in the way and pour through breaches.
  // Flyers go straight over the walls; spitters stop short and spit from range.
  updateEnemies(dt) {
    const breaches = this.segs.filter((s) => s.hp <= 0);
    const es = this.enemies;
    const hourglass = this.count('hourglass') && this.waveT < 6 ? 0.4 : 0;
    // Stragglers charge once the whole wave is out and a minute has passed, so no wave can stall.
    const charge = !this.queue.length && this.waveT > CHARGE_AFTER;
    for (const e of es) {
      const d = ENEMIES[e.t];
      if (e.slow > 0) { e.slow -= dt; if (e.slow <= 0) e.slowK = 0; }
      e.hold = -2;
      if (d.ranged && !charge) {
        if (Math.max(Math.abs(e.x), Math.abs(e.z)) > S + 0.8) {
          let bd = d.ranged;
          this.segs.forEach((s, i) => { const q = Math.hypot(s.x - e.x, s.z - e.z); if (s.hp > 0 && q < bd) { bd = q; e.hold = i; } });
        } else if (Math.max(Math.abs(e.x), Math.abs(e.z)) < TH_HALF + d.ranged * 0.6) e.hold = -1;
      }
      if (d.brood) {
        e.bt -= dt;
        if (e.bt <= 0) {
          e.bt = 3;
          for (let i = 0; i < d.brood && es.length + this.later.length < MAX_ALIVE; i++) {
            const a = this.rng() * Math.PI * 2;
            this.later.push(this.makeEnemy(0, e.x + Math.sin(a) * 2.5, e.z + Math.cos(a) * 2.5, 0.7));
          }
        }
      }
      if (e.hold !== -2) continue;
      let tx = 0, tz = 0;
      if (!d.fly && (Math.abs(e.x) > S - 1 || Math.abs(e.z) > S - 1)) {
        let bd = 14;
        for (const s of breaches) { const q = Math.hypot(s.x - e.x, s.z - e.z); if (q < bd) { bd = q; tx = s.x; tz = s.z; } }
        if (bd < 1.5) { tx = 0; tz = 0; }   // standing in the breach: carry on to the keep
      }
      const dx = tx - e.x, dz = tz - e.z, len = Math.hypot(dx, dz), spd = d.speed * (1 - Math.max(e.slowK, hourglass)) * (charge ? 1.4 : 1);
      if (len > 0.01) { e.x += (dx / len) * spd * dt; e.z += (dz / len) * spd * dt; }
    }
    for (let i = 0; i < es.length; i++) {
      const a = es[i], ad = ENEMIES[a.t], ar = ad.r;
      for (let j = i + 1; j < es.length; j++) {
        const b = es[j], bdf = ENEMIES[b.t];
        if (!!ad.fly !== !!bdf.fly) continue;
        const min = (ar + bdf.r) * 0.9;
        const dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz;
        if (d2 >= min * min || d2 < 1e-9) continue;
        const dist = Math.sqrt(d2), push = min - dist, wa = ar >= bdf.r ? 0.3 : 0.7;
        a.x -= (dx / dist) * push * wa; a.z -= (dz / dist) * push * wa;
        b.x += (dx / dist) * push * (1 - wa); b.z += (dz / dist) * push * (1 - wa);
      }
    }
    const oil = this.count('oil') ? 0.04 : 0, thorns = this.count('thorns') ? 0.15 : 0;
    for (const e of es) {
      const d = ENEMIES[e.t];
      const c = d.fly ? { seg: null, th: pushOutBox(e, d.r, 0, 0, TH_HALF, TH_HALF) } : this.collideStatic(e, d.r);
      const nearTH = c.th || (Math.abs(e.x) < TH_HALF + d.r + 0.4 && Math.abs(e.z) < TH_HALF + d.r + 0.4);
      if (oil && c.seg) this.hurtEnemy(e, oil * e.max * (d.boss ? 0.25 : 1) * dt);
      e.cd -= dt;
      if (e.cd > 0 || e.hp <= 0) continue;
      const hit = d.dmg * this.dmgMul * e.hx;
      if (e.hold >= 0) {
        e.cd = 2;
        const s = this.segs[e.hold];
        s.hp = Math.max(0, s.hp - hit * d.wallMul * this.guardMul(e.hold));
        this.fx.push([10, r2(e.x), r2(e.z), e.hold]);
      } else if (e.hold === -1 || nearTH) {
        e.cd = e.hold === -1 ? 2 : 1;
        this.th.hp -= hit * this.guardMul();
        if (e.hold === -1) this.fx.push([10, r2(e.x), r2(e.z), -1]);
      } else if (c.seg) {
        e.cd = 1;
        c.seg.hp = Math.max(0, c.seg.hp - hit * d.wallMul * this.guardMul(this.segs.indexOf(c.seg)));
        if (thorns) this.hurtEnemy(e, thorns * e.max * (d.boss ? 0.1 : 1));
      }
    }
  }

  // Scaled stats of every monster type for the coming wave, for the offer cards.
  nextStats() {
    const n = this.wave + 1, h = hpMul(n) * DIFFICULTY[this.diff].hp, m = dmgMul(n);
    return ENEMIES.map((d) => [Math.round(d.hp * (d.boss ? h ** 0.85 : h)), Math.round(d.dmg * m)]);
  }

  // The current pending reward, as the client shows it.
  pickView() {
    const p = this.picks[0];
    if (!p) return null;
    if (p.type === 'victory') return { type: 'victory' };
    return {
      type: p.type, left: this.picks.length, rr: this.pickRerollCost(), skip: p.type === 'spoils' ? this.skipGold() : 0,
      opts: p.opts.map((o) => {
        if (o.type === 'recruit') return { ...o, card: { ...o.card, k: o.card.k } };
        if (o.type === 'promote') { const u = this.unit(o.uid); return { ...o, lv: u ? u.lv : 1 }; }
        if (o.type === 'turret') { const t = this.turrets.find((x) => x.k === o.k); return { ...o, lv: t ? t.lv + 1 : 1 }; }
        return o;
      }),
    };
  }

  snapshot() {
    const fx = this.fx, calm = this.phase !== 'wave';
    this.fx = [];
    const s = {
      t: 's', ph: this.phase, wave: this.wave, tm: Math.ceil(this.timer), gold: Math.floor(this.gold), diff: this.diff, lord: this.lord,
      ab: ABILITY_KEYS.map((k) => Math.ceil(this.abil[k])), ral: this.rallyT > 0 ? 1 : 0,
      th: [Math.round(this.th.hp), this.th.max], reached: this.reached, won: this.won, endless: this.endless,
      left: this.queue.length + this.enemies.length, np: this.players.size,
      lv: [this.level, Math.floor((this.xp / levelNeed(this.level)) * 100)],
      b: Object.keys(BUILDINGS).map((k) => this.b[k]),
      bc: Object.keys(BUILDINGS).map((k) => (this.b[k] >= BUILDINGS[k].max ? -1 : BUILDINGS[k].cost[this.b[k]])),
      rc: [this.repairCost('walls'), this.repairCost('hall')],
      wv: this.waves,
      un: this.units.map((u) => [u.uid, u.slot, UNIT_KEYS.indexOf(u.k), u.rar]),
      tu: this.turrets.map((t) => [TURRET_KEYS.indexOf(t.k), t.spot, t.lv]),
      cap: CAPACITY[this.b.walls],
      sg: this.segs.map((sg) => Math.round((sg.hp / sg.max) * 100)),
      en: this.enemies.map((e) => [e.id, e.t, r2(e.x), r2(e.z), Math.max(1, Math.round((e.hp / e.max) * 100)), (e.slow > 0 ? 1 : 0) | (e.burn > 0 ? 2 : 0) | (e.curse > 0 ? 4 : 0)]),
      pr: this.projs.map((b) => [b.id, b.kind, r2(b.x), r2(b.z), r2(Math.atan2(b.vx, b.vz))]),
      cl: this.clouds.map((c) => [c.id, r2(c.x), r2(c.z), r2(c.r)]),
      st: [this.stats.kills, this.stats.earned, this.stats.bosses],
      fx,
    };
    if (calm) {
      // Everything the panels show between waves.
      s.ro = this.units.map((u) => [u.uid, UNIT_KEYS.indexOf(u.k), u.rar, u.lv, Math.floor((u.xp / xpNeed(u.lv)) * 100), u.name,
        r1(this.unitPower(u) * 100) / 100, r2(this.unitReload(u)), r1(this.unitRange(u)), u.kills, this.trainCost(u), this.refund(u), u.traits.map((t) => TRAITS.indexOf(t)), r2(this.unitCrit(u))]);
      s.tot = this.tot;
      s.items = this.items;
      s.bless = this.bless;
      s.fam = [FAMILIES.map((f) => this.famCount[f]), FAMILIES.map((f) => this.famTier[f])];
      s.hv = this.harvestGold();
      s.tp = this.turrets.map((t) => Math.round(this.turretPower(t)));
      s.pick = this.pickView();
    }
    if (this.phase === 'prep') {
      s.shop = this.shop;
      s.rr = this.shopRerollCost();
      s.ns = this.nextStats();
    }
    if (this.phase === 'over') { s.best = this.best; s.victory = this.victory; }
    return s;
  }

  // ---- Saving: a solo run can be continued later ----

  save() {
    return {
      v: 3, diff: this.diff, lord: this.lord, wave: this.wave, gold: Math.floor(this.gold), b: { ...this.b }, st: { ...this.st }, items: { ...this.items }, bless: { ...this.bless },
      turrets: this.turrets.map((t) => ({ k: t.k, lv: t.lv, spot: t.spot })), level: this.level, xp: this.xp, th: Math.round(this.th.hp),
      segs: this.segs.map((s) => Math.round(s.hp)), stats: { ...this.stats }, won: this.won, endless: this.endless,
      picks: this.picks.map((p) => ({ type: p.type, luck: p.luck || 0 })),
      shop: this.shop.map((o) => (o && o.locked ? { type: o.type, key: o.key, k: o.k } : null)),
      units: this.units.map((u) => ({ slot: u.slot, k: u.k, name: u.name, rar: u.rar, lv: u.lv, xp: Math.floor(u.xp), p: u.p, rcd: u.rcd, range: u.range, traits: u.traits, kills: u.kills })),
    };
  }

  // Restores a saved run between waves. Anything malformed is rejected as a whole.
  load(s) {
    try {
      const bad = () => { throw new Error('bad save'); };
      const int = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : bad());
      const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : bad());
      const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : bad());
      if (!s || typeof s !== 'object' || s.v !== 3 || !Object.hasOwn(DIFFICULTY, s.diff)) bad();
      const b = {}, st = {}, items = {}, bless = {};
      for (const k in BUILDINGS) b[k] = int(s.b?.[k], BUILDINGS[k].start, BUILDINGS[k].max);
      if (b.walls > b.hall) bad();
      for (const k of STAT_KEYS) st[k] = num(s.st?.[k] ?? 0, -1000, 1e6);
      for (const [k, v] of Object.entries(obj(s.items))) { if (!Object.hasOwn(ITEMS, k)) bad(); items[k] = int(v, 1, 999); }
      for (const k of UNIT_KEYS) bless[k] = int(s.bless?.[k] ?? 0, 0, 999);
      if (!Array.isArray(s.segs) || s.segs.length !== this.segs.length || !Array.isArray(s.units) || !Array.isArray(s.turrets)) bad();
      if (s.units.length < 1 || s.units.length > CAPACITY[b.walls] || s.turrets.length > TURRET_SPOTS.length) bad();
      const used = new Set();
      const units = s.units.map((u) => {
        if (!u || !Object.hasOwn(UNITS, u.k)) bad();
        const slot = int(u.slot, 0, this.slots.length - 1);
        if (used.has(slot) || ((UNITS[u.k].melee || UNITS[u.k].guard) && this.slots[slot].seg < 0)) bad();
        used.add(slot);
        const traits = Array.isArray(u.traits) ? [...new Set(u.traits.filter((t) => TRAITS.includes(t)))].slice(0, 2) : [];
        return {
          uid: 0, slot, k: u.k, name: String(u.name || 'Nameless').replace(/[^A-Za-z]/g, '').slice(0, 12) || 'Nameless', rar: int(u.rar, 0, 3), lv: int(u.lv, 1, 9999),
          xp: num(u.xp, 0, 1e9), p: num(u.p, 0.001, 1e6), rcd: num(u.rcd, 0.1, 20), range: num(u.range, 0, 60), traits, kills: int(u.kills, 0, 1e9), cd: 0,
        };
      });
      const spots = new Set(), kinds = new Set();
      const turrets = s.turrets.map((t) => {
        if (!t || !Object.hasOwn(TURRETS, t.k) || kinds.has(t.k)) bad();
        const spot = int(t.spot, 0, TURRET_SPOTS.length - 1);
        if (spots.has(spot)) bad();
        spots.add(spot); kinds.add(t.k);
        return { k: t.k, lv: int(t.lv, 1, 9999), spot, cd: 0 };
      });
      const picks = (Array.isArray(s.picks) ? s.picks : []).slice(0, 200).map((p) => {
        if (!p || !['level', 'spoils', 'victory'].includes(p.type)) bad();
        return { type: p.type, luck: num(p.luck ?? 0, 0, 1000) };
      });
      const shop = (Array.isArray(s.shop) ? s.shop : []).slice(0, 4).map((o) => {
        if (!o) return null;
        if (o.type === 'item' && Object.hasOwn(ITEMS, o.key)) return { type: 'item', key: o.key, locked: true };
        if (o.type === 'turret' && Object.hasOwn(TURRETS, o.k)) return { type: 'turret', k: o.k, locked: true };
        return bad();
      });
      const wave = int(s.wave, 0, 100000), gold = num(s.gold, 0, 1e13), level = int(s.level, 1, 100000), xp = num(s.xp, 0, 1e12);
      const segHp = s.segs.map((v) => num(v, 0, 1e9)), keepHp = num(s.th, 1, 1e9);
      const stats = { kills: int(s.stats?.kills ?? 0, 0, 1e12), earned: num(s.stats?.earned ?? 0, 0, 1e15), bosses: int(s.stats?.bosses ?? 0, 0, 1e9) };
      // Everything checked: apply it.
      this.diff = s.diff;
      this.lord = Object.hasOwn(LORDS, s.lord) ? s.lord : 'marshal';
      this.reset();
      Object.assign(this, { wave, gold, b, st, items, bless, turrets, level, xp, stats, won: !!s.won, endless: !!s.endless });
      this.units = units.map((u) => ({ ...u, uid: this.nextId++ }));
      this.th = { hp: 1, max: 1 };
      this.refreshDerived();
      this.th.hp = Math.min(this.th.max, keepHp);
      this.segs.forEach((sg, i) => { sg.hp = Math.min(sg.max, segHp[i]); });
      this.shop = shop.map((o) => (o ? { ...o, price: this.priceOf(o) } : null));
      while (this.shop.length < 4) this.shop.push(null);
      this.picks = picks;
      this.nextPick();
      if (this.phase === 'prep') this.makeShop();
      return true;
    } catch {
      return false;
    }
  }
}
