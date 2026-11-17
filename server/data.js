// Every number and list the rules use. No logic lives here, so the same tables can be
// sent to the client (for its menus) and imported by the simulation.

export const TICK = 1 / 20;
export const S = 14;              // half-size of the castle square
export const SEG = 4;             // wall segment length
export const WALL_T = 0.7;        // wall half-thickness
export const TH_HALF = 3.5;       // keep half-size
export const TOWER_R = 2.1;
export const OVER_TIME = 45;      // seconds the end-of-run summary stays before a new run starts by itself
export const START_GOLD = 60;
// The calendar: a season is eight waves and ends with its boss; a year is four seasons.
// There is no last wave: a run goes on until the keep falls.
export const SEASON_LEN = 8;
export const YEAR_LEN = 4 * SEASON_LEN;
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
export const seasonOf = (n) => Math.floor((Math.max(1, n) - 1) / SEASON_LEN) % 4;
export const yearOf = (n) => Math.floor((Math.max(1, n) - 1) / YEAR_LEN) + 1;
export const MAX_COUNT = 110;     // monsters per wave; beyond this they come as fewer, tougher elites
export const MAX_ALIVE = 240;     // brood spawns pause above this many living monsters
export const CHARGE_AFTER = 60;   // seconds into a wave after which every monster charges
export const FURY_AFTER = 120;    // seconds into a wave after which the horde's blows grow heavier every second
export const FURY_RATE = 0.04;    // how much heavier, per second
export const SPEC_LEVEL = 6;      // defender level at which a specialisation is chosen
export const TOWERS = [[-S, -S], [S, -S], [-S, S], [S, S]];

// ---- Siege levels: 0 is relaxed, 1 is the normal game, every level above adds one rule ----
export const SIEGE = [
  { key: 'relaxed', hp: 0.7, gold: 1.2 },
  { key: 'normal' },
  { key: 'tough' },        // monsters have 15% more health
  { key: 'champions' },    // every wave brings a champion: one huge monster
  { key: 'lean' },         // 15% less gold
  { key: 'swift' },        // monsters are 12% faster
  { key: 'omens' },        // every wave has a modifier
  { key: 'cruel' },        // monsters hit 20% harder
  { key: 'scarce' },       // spoils offer one choice fewer
  { key: 'warlords' },     // bosses have 35% more health
  { key: 'apocalypse' },   // 25% more health again; the last wave of every year brings every boss
];
// Above the last named level the ladder has no top: every level makes the horde tougher,
// and every second one gives it a mutation to start the run with.
export const SIEGE_TOP = SIEGE.length - 1;
export const SIEGE_MAX = 9999;
export const siegeExtra = (s) => Math.max(0, s - SIEGE_TOP);
export const siegeHp = (s) => (SIEGE[Math.min(s, SIEGE_TOP)].hp || 1) * 1.06 ** siegeExtra(s);
export const siegeDmg = (s) => 1.03 ** siegeExtra(s);
export const siegeMuts = (s) => Math.min(12, Math.floor(siegeExtra(s) / 2));
export const siegeRenown = (s) => (s === 0 ? 0.5 : 1 + 0.2 * (s - 1));

// ---- Ages: unlocked by slaying a boss, then bought with gold once the castle level is high enough ----
export const AGES = [
  { key: 'timber', level: 1, gold: 0 },
  { key: 'stone', level: 6, gold: 250 },
  { key: 'iron', level: 12, gold: 800 },
  { key: 'gold', level: 18, gold: 1800 },
];
export const AGE_CAP = 5;                  // keep and wall levels allowed per age
export const PLOTS_BY_AGE = [2, 4, 6, 7];  // building plots open in the courtyard
export const RARITY_CAP = [1, 2, 3, 4];    // best rarity that can appear in each age
// After the Golden Age the castle follows one of three paths. A path is chosen once, with the
// fifth age, and has three ages of its own; the other two paths are closed for the run.
export const PATHS = {
  splendour: { ages: ['obsidian', 'crystal', 'star'] },
  industry: { ages: ['steel', 'powder', 'steam'] },
  legend: { ages: ['rune', 'dragon', 'celestial'] },
};
export const PATH_KEYS = Object.keys(PATHS);
export const PATH_AGE = [{ level: 24, gold: 4000 }, { level: 28, gold: 7000 }, { level: 32, gold: 12000 }];
export const LAST_AGE = AGES.length + 2;   // the third age of a path; every age after it is an ascension
// What reaching age `next` needs: a castle level and gold (its boss must be slain as well).
export const ageNeed = (next) => (next < AGES.length ? AGES[next] : next <= LAST_AGE ? PATH_AGE[next - AGES.length]
  : { level: PATH_AGE[2].level + 5 * (next - LAST_AGE), gold: Math.round(PATH_AGE[2].gold * 1.8 ** (next - LAST_AGE)) });
export const ageKey = (age, path) => (age < AGES.length ? AGES[age].key : path && PATHS[path] ? PATHS[path].ages[Math.min(2, age - AGES.length)] : 'gold');
export const plotsAt = (age) => PLOTS_BY_AGE[Math.min(age, PLOTS_BY_AGE.length - 1)];
export const rarityCap = (age) => (age >= LAST_AGE ? 5 : RARITY_CAP[Math.min(age, RARITY_CAP.length - 1)]);

// ---- Monsters ----
// `unlock` is the first wave a type can appear in an offer. points: how much of a wave's
// budget one monster takes (also the castle experience it gives).
export const ENEMIES = [
  { key: 'runner', hp: 30, speed: 4.4, dmg: 6, r: 0.6, gold: 1, wallMul: 1, points: 1, unlock: 1 },
  { key: 'brute', hp: 150, speed: 2.3, dmg: 16, r: 1.0, gold: 4, wallMul: 2.5, points: 4, unlock: 2 },
  { key: 'queen', hp: 750, speed: 1.6, dmg: 28, r: 2.4, gold: 80, wallMul: 3, points: 30, boss: true, power: 'shriek', pcd: 9 },
  { key: 'spitter', hp: 45, speed: 3.0, dmg: 5, r: 0.7, gold: 2, wallMul: 1.2, points: 2, unlock: 5, ranged: 8 },
  { key: 'flyer', hp: 24, speed: 5.0, dmg: 5, r: 0.6, gold: 1, wallMul: 0, points: 1.5, unlock: 8, fly: true },
  { key: 'splitter', hp: 90, speed: 2.6, dmg: 8, r: 0.95, gold: 2, wallMul: 1.5, points: 4, unlock: 12, split: 3 },
  { key: 'shellback', hp: 240, speed: 1.8, dmg: 12, r: 1.15, gold: 6, wallMul: 2, points: 6, unlock: 15, armor: 8 },
  { key: 'behemoth', hp: 2800, speed: 1.1, dmg: 45, r: 2.8, gold: 120, wallMul: 4, points: 30, boss: true, armor: 12, power: 'quake', pcd: 9 },
  { key: 'broodmother', hp: 2400, speed: 1.4, dmg: 32, r: 2.6, gold: 120, wallMul: 3, points: 30, boss: true, brood: 3, burst: 10 },
  { key: 'skytyrant', hp: 2000, speed: 2.0, dmg: 36, r: 2.2, gold: 150, wallMul: 0, points: 30, boss: true, fly: true, power: 'dive', pcd: 8 },
  { key: 'blightling', hp: 36, speed: 5.2, dmg: 14, r: 0.65, gold: 2, wallMul: 2.5, points: 2.5, unlock: 9, boom: true },
  { key: 'shaman', hp: 70, speed: 2.8, dmg: 4, r: 0.75, gold: 5, wallMul: 1, points: 4, unlock: 11, ranged: 13, heal: 0.04 },
  { key: 'ram', hp: 420, speed: 1.5, dmg: 30, r: 1.4, gold: 12, wallMul: 5, points: 12, unlock: 14, armor: 6 },
  { key: 'burrower', hp: 110, speed: 2.4, dmg: 14, r: 0.85, gold: 6, wallMul: 0, points: 5, unlock: 18, burrow: true },
  { key: 'wraith', hp: 60, speed: 4.0, dmg: 9, r: 0.7, gold: 4, wallMul: 1, points: 3, unlock: 22, dodge: 0.45 },
  { key: 'hurler', hp: 520, speed: 1.4, dmg: 26, r: 1.6, gold: 16, wallMul: 2.5, points: 10, unlock: 26, ranged: 14, rcd: 3 },
];
// The Queen, the Behemoth, the Brood Mother and the Sky Tyrant: the bosses of spring, summer, autumn and winter.
export const BOSSES = [2, 7, 8, 9];
// Which boss wave wave n is (0 for the first), or -1 when it is an ordinary wave. Every season ends with one.
export const bossIndex = (n) => (n > 0 && n % SEASON_LEN === 0 ? n / SEASON_LEN - 1 : -1);
// The first boss wave at or after wave n.
export const nextBossWave = (n) => Math.ceil(Math.max(1, n) / SEASON_LEN) * SEASON_LEN;

// Each offer follows a theme: which monsters make up its budget.
export const THEMES = [
  { key: 'swarm', w: { 0: 1 } },
  { key: 'warband', w: { 0: 0.55, 1: 0.45 } },
  { key: 'siege', w: { 1: 0.55, 3: 0.45 } },
  { key: 'spitters', w: { 3: 0.6, 0: 0.4 } },
  { key: 'skyraid', w: { 4: 0.7, 0: 0.3 } },
  { key: 'brood', w: { 5: 0.6, 0: 0.4 } },
  { key: 'ironhide', w: { 6: 0.6, 1: 0.4 } },
  { key: 'blight', w: { 10: 0.55, 0: 0.45 } },
  { key: 'coven', w: { 11: 0.25, 1: 0.4, 0: 0.35 } },
  { key: 'battering', w: { 12: 0.5, 0: 0.5 } },
  { key: 'underminers', w: { 13: 0.55, 0: 0.45 } },
  { key: 'haunting', w: { 14: 0.65, 4: 0.35 } },
  { key: 'bombardment', w: { 15: 0.5, 3: 0.5 } },
  { key: 'horde', w: null, unlock: 6 },
];

// Wave modifiers: a twist on the whole wave, for a quarter more gold and experience.
export const MODS = ['frenzied', 'armoured', 'giants', 'swarm', 'night', 'regen'];
// Offer tiers: budget, gold and experience multipliers and the luck bonus of the spoils.
// pts1 is the budget multiplier through the first year, which is the campaign: its harder
// waves are a little smaller. From the second year on they come at full size (pts).
export const TIERS = {
  std: { pts: 1, pts1: 1, gold: 1, xp: 1, luck: 0 },
  hard: { pts: 1.75, pts1: 1.65, gold: 2, xp: 2, luck: 30 },
  deadly: { pts: 2.7, pts1: 2.5, gold: 3.5, xp: 3, luck: 70 },
};

// ---- Defenders: eighteen classes in six families ----
// p is damage per hit; for support classes it is the strength of what they do.
// age: the age in which recruits of the class start to appear. unlock: renown price (0 = from the start).
export const UNITS = {
  archer: { fam: 'marksmen', age: 1, unlock: 0, p: 12, cd: 1.3, range: 19, kind: 2, speed: 40 },
  crossbow: { fam: 'marksmen', age: 2, unlock: 0, p: 55, cd: 3.0, range: 25, kind: 4, speed: 55, tough: true, pierce: true },
  ranger: { fam: 'marksmen', age: 3, unlock: 25, p: 20, cd: 1.8, range: 28, kind: 2, speed: 50, sky: true, crit: 0.15 },
  mage: { fam: 'arcane', age: 1, unlock: 0, p: 14, cd: 2.4, range: 17, kind: 1, speed: 24, aoe: 3, elem: true },
  frost: { fam: 'arcane', age: 2, unlock: 0, p: 6, cd: 1.8, range: 16, kind: 3, speed: 28, aoe: 2.2, slow: 0.45, elem: true },
  storm: { fam: 'arcane', age: 3, unlock: 30, p: 15, cd: 2.2, range: 18, chain: 4, elem: true },
  pyro: { fam: 'alchemy', age: 2, unlock: 0, p: 8, cd: 1.6, range: 15, kind: 5, speed: 26, aoe: 1.8, burn: 6, elem: true },
  alchemist: { fam: 'alchemy', age: 3, unlock: 30, p: 5, cd: 2.6, range: 16, kind: 6, speed: 20, aoe: 2.6, poison: 5, elem: true },
  bomber: { fam: 'alchemy', age: 3, unlock: 30, p: 30, cd: 3.4, range: 15, kind: 7, speed: 18, aoe: 3.5 },
  cleric: { fam: 'faith', age: 1, unlock: 0, p: 14, cd: 2.0, range: 12, heal: 'walls' },
  priest: { fam: 'faith', age: 2, unlock: 0, p: 30, cd: 3.0, range: 99, heal: 'keep' },
  bard: { fam: 'faith', age: 1, unlock: 15, p: 0.15, cd: 1, range: 9, aura: true },
  spear: { fam: 'wardens', age: 1, unlock: 0, p: 24, cd: 1.0, range: 5.5, melee: true },
  shield: { fam: 'wardens', age: 1, unlock: 0, p: 0.35, cd: 1, range: 0, guard: true },
  hexer: { fam: 'wardens', age: 2, unlock: 20, p: 0.25, cd: 2.0, range: 17, curse: 4 },
  tinker: { fam: 'engineers', age: 2, unlock: 25, p: 0.1, cd: 1, range: 0, tinker: true },
  musketeer: { fam: 'engineers', age: 3, unlock: 40, p: 70, cd: 3.6, range: 22, kind: 8, speed: 80, pierce: true, aoe: 1.2 },
  sapper: { fam: 'engineers', age: 3, unlock: 40, p: 45, cd: 6, range: 0, mine: 3 },
  // Path classes: two for each age of a path, one for every family. They need no renown.
  // Splendour: obsidian, crystal, star.
  lavamancer: { fam: 'alchemy', age: 5, path: 'splendour', unlock: 0, p: 9, cd: 2.8, range: 16, kind: 9, speed: 22, aoe: 2.4, pool: 7, elem: true },
  glaive: { fam: 'wardens', age: 5, path: 'splendour', unlock: 0, p: 34, cd: 1.1, range: 6, melee: true, exec: 0.15 },
  prismancer: { fam: 'arcane', age: 6, path: 'splendour', unlock: 0, p: 10, cd: 0.5, range: 18, beam: true, ramp: 0.15, tough: true, elem: true },
  shardbow: { fam: 'marksmen', age: 6, path: 'splendour', unlock: 0, p: 26, cd: 1.5, range: 24, kind: 10, speed: 50, shards: 3, crit: 0.1 },
  stargazer: { fam: 'faith', age: 7, path: 'splendour', unlock: 0, p: 4, cd: 2.5, range: 20, fate: true },
  starforger: { fam: 'engineers', age: 7, path: 'splendour', unlock: 0, p: 90, cd: 5, range: 30, lob: 3.5 },
  // Industry: steel, powder, steam.
  repeater: { fam: 'marksmen', age: 5, path: 'industry', unlock: 0, p: 11, cd: 1.6, range: 21, kind: 4, speed: 55, burst: 3 },
  ironclad: { fam: 'wardens', age: 5, path: 'industry', unlock: 0, p: 30, cd: 1.4, range: 5.5, melee: true, knock: 2.5 },
  rocketeer: { fam: 'alchemy', age: 6, path: 'industry', unlock: 0, p: 46, cd: 4.2, range: 30, kind: 11, speed: 30, aoe: 3.2, sky: true },
  artillerist: { fam: 'engineers', age: 6, path: 'industry', unlock: 0, p: 60, cd: 4, range: 26, kind: 12, speed: 70, pierce: true, thru: 8 },
  galvanist: { fam: 'arcane', age: 7, path: 'industry', unlock: 0, p: 13, cd: 2.4, range: 17, chain: 3, zap: 0.6, elem: true },
  wallwright: { fam: 'faith', age: 7, path: 'industry', unlock: 0, p: 22, cd: 2.0, range: 14, heal: 'walls', raise: 0.3 },
  // Legend: rune, dragon, celestial.
  runeblade: { fam: 'wardens', age: 5, path: 'legend', unlock: 0, p: 22, cd: 0.9, range: 5.5, melee: true, brand: 0.2 },
  runesmith: { fam: 'engineers', age: 5, path: 'legend', unlock: 0, p: 0.12, cd: 1, range: 6, empower: true },
  drakekeeper: { fam: 'alchemy', age: 6, path: 'legend', unlock: 0, p: 16, cd: 1.8, range: 13, cone: 0.5, burn: 5, elem: true },
  lancer: { fam: 'marksmen', age: 6, path: 'legend', unlock: 0, p: 60, cd: 3.2, range: 22, kind: 13, speed: 60, tough: true, pin: 1.5 },
  seraph: { fam: 'faith', age: 7, path: 'legend', unlock: 0, p: 34, cd: 2.6, range: 99, heal: 'keep', smite: 3 },
  skycaller: { fam: 'arcane', age: 7, path: 'legend', unlock: 0, p: 48, cd: 3.6, range: 22, pillar: 3, elem: true },
};
export const UNIT_KEYS = Object.keys(UNITS);
export const FAMILIES = ['marksmen', 'arcane', 'alchemy', 'faith', 'wardens', 'engineers'];
export const FAMILY_AT = [2, 4, 6];   // defenders of one family needed for each bonus tier
export const RARITY = [
  { key: 'common', mul: 1 },
  { key: 'rare', mul: 1.25 },
  { key: 'epic', mul: 1.6 },
  { key: 'legendary', mul: 2.1 },
  { key: 'mythic', mul: 2.8 },
  { key: 'exalted', mul: 3.7 },   // only in the last age of a path and beyond
];
export const TRAITS = ['eagle', 'quick', 'crit', 'greedy', 'scholar', 'slayer', 'veteran'];
export const SUPPORT_TRAITS = ['eagle', 'quick', 'scholar', 'veteran'];
export const NAMES = ['Aldric', 'Bryn', 'Cora', 'Dax', 'Edda', 'Finn', 'Greta', 'Hale', 'Ilsa', 'Joren', 'Kara', 'Lio', 'Mira', 'Nils', 'Orla', 'Pim',
  'Quin', 'Rhea', 'Sten', 'Tova', 'Ulf', 'Vera', 'Wren', 'Yara', 'Zane', 'Ada', 'Bo', 'Cyra', 'Dorn', 'Elin', 'Falk', 'Gil', 'Hedda', 'Ivo',
  'Jule', 'Kell', 'Lune', 'Mads', 'Nora', 'Oswin', 'Petra', 'Runa', 'Sol', 'Tam', 'Una', 'Vik', 'Wynn', 'Ysolde', 'Arn', 'Briar'];

// Specialisations: at SPEC_LEVEL every defender picks one of two paths.
// pm power, cdm reload, rm range and am blast-radius multipliers; the rest are special rules.
export const SPECS = {
  archer: [{ key: 'longbow', rm: 1.35, pm: 1.15 }, { key: 'rapid', cdm: 0.65 }],
  crossbow: [{ key: 'siegebolt', thru: 3 }, { key: 'headhunter', boss: 2 }],
  ranger: [{ key: 'falconer', multi: 2, sky: 1.5 }, { key: 'deadeye', cr: 0.25, cx: 3 }],
  mage: [{ key: 'archmage', am: 1.4 }, { key: 'battlemage', pm: 1.35 }],
  frost: [{ key: 'blizzard', am: 1.5, slow: 0.65 }, { key: 'shatter', pm: 1.8, frozen: 1.3 }],
  storm: [{ key: 'tempest', ch: 3 }, { key: 'thunderlord', pm: 1.5 }],
  pyro: [{ key: 'inferno', dm: 2 }, { key: 'firewall', am: 1.6 }],
  alchemist: [{ key: 'plague', cloud: 2 }, { key: 'acid', melt: 0.2 }],
  bomber: [{ key: 'demolition', pm: 1.5 }, { key: 'cluster', am: 1.4, cdm: 0.8 }],
  cleric: [{ key: 'mastermason', pm: 1.8 }, { key: 'warder', rm: 1.6, pm: 1.3 }],
  priest: [{ key: 'highpriest', pm: 1.8 }, { key: 'zealot', cdm: 0.6 }],
  bard: [{ key: 'wardrummer', pm: 1.5 }, { key: 'minstrel', rm: 2 }],
  spear: [{ key: 'halberd', rm: 1.5, cleave: 3 }, { key: 'pikeman', pm: 1.7 }],
  shield: [{ key: 'bulwark', pm: 1.5 }, { key: 'thornwall', thorns: 0.5 }],
  hexer: [{ key: 'doom', pm: 1.6 }, { key: 'plaguebringer', multi: 3 }],
  tinker: [{ key: 'overclock', pm: 1.6 }, { key: 'armorer', tdmg: 0.15 }],
  musketeer: [{ key: 'sharpshooter', pm: 1.4, rm: 1.2 }, { key: 'grapeshot', am: 2.4, pm: 0.8 }],
  sapper: [{ key: 'minelayer', mines: 2, cdm: 0.7 }, { key: 'bigbang', pm: 1.6, am: 1.4 }],
  lavamancer: [{ key: 'eruption', am: 1.5 }, { key: 'tarpit', tar: 0.35 }],
  glaive: [{ key: 'reaper', exec: 0.25 }, { key: 'whirlwind', cleave: 4 }],
  prismancer: [{ key: 'focus', rampMax: 4 }, { key: 'refraction', multi: 2 }],
  shardbow: [{ key: 'splinterstorm', shards: 6 }, { key: 'diamondtip', pierce: true, pm: 1.3 }],
  stargazer: [{ key: 'constellation', multi: 3 }, { key: 'doomsayer', pm: 2 }],
  starforger: [{ key: 'twinstars', multi: 2 }, { key: 'supernova', am: 1.5, pm: 1.3 }],
  repeater: [{ key: 'drum', burst: 5 }, { key: 'steelbolts', pierce: true, pm: 1.25 }],
  ironclad: [{ key: 'ramcharge', knock: 4.5, cleave: 3 }, { key: 'shieldbash', stun: 1 }],
  rocketeer: [{ key: 'barrage', multi: 2 }, { key: 'incendiary', burn: 8 }],
  artillerist: [{ key: 'chainshot', thru: 16, pm: 1.2 }, { key: 'heavyball', pm: 1.6, knock: 3 }],
  galvanist: [{ key: 'overcharge', zap: 1.2 }, { key: 'arcwelder', ch: 4, pm: 1.2 }],
  wallwright: [{ key: 'scaffolders', raise: 0.6 }, { key: 'quickmortar', cdm: 0.6 }],
  runeblade: [{ key: 'ruin', brand: 0.4 }, { key: 'frostrune', slow: 0.4 }],
  runesmith: [{ key: 'masterrune', pm: 1.5 }, { key: 'wideward', rm: 2 }],
  drakekeeper: [{ key: 'elderdrake', rm: 1.4, pm: 1.3 }, { key: 'wildbreath', dm: 2, am: 1.4 }],
  lancer: [{ key: 'dragonlance', boss: 2 }, { key: 'barbed', pin: 3, pm: 0.9 }],
  seraph: [{ key: 'judgement', smite: 6 }, { key: 'mercy', pm: 1.8 }],
  skycaller: [{ key: 'sunbeam', am: 1.5 }, { key: 'eclipse', pm: 1.6 }],
};

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

// ---- Items ----
// r: rarity 0-3 (4 = boss relic). mods: stat changes. fx: a special rule. unlock: renown price.
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
  coinpurse: { r: 0, mods: { harvest: 5 } },
  heavybolts: { r: 1, mods: { dmg: 15, aspd: -6 } },
  spyglass: { r: 1, mods: { range: 10, crit: 4 } },
  grindstone: { r: 1, mods: { crit: 6 } },
  oil: { r: 1, fx: 'oil', unique: true },
  bounty: { r: 1, fx: 'bounty' },
  piggy: { r: 1, fx: 'interest', unique: true },
  chimes: { r: 1, mods: { regen: 2, armor: 3 } },
  grimoire: { r: 1, mods: { elem: 20, dmg: -4 } },
  cogs: { r: 1, mods: { eng: 20, aspd: 3 } },
  bells: { r: 1, mods: { keephp: 500, armor: 2 } },
  drillbook: { r: 1, fx: 'unitxp', unlock: 10 },
  poster: { r: 1, fx: 'choices', unique: true, unlock: 15 },
  marksflag: { r: 1, fx: 'fam:marksmen', unlock: 10 },
  arcaneflag: { r: 1, fx: 'fam:arcane', unlock: 10 },
  alchemyflag: { r: 1, fx: 'fam:alchemy', unlock: 10 },
  faithflag: { r: 1, fx: 'fam:faith', unlock: 10 },
  wardenflag: { r: 1, fx: 'fam:wardens', unlock: 10 },
  engineerflag: { r: 1, fx: 'fam:engineers', unlock: 10 },
  cursedbanner: { r: 2, mods: { dmg: 30, wallhp: -15 } },
  hourglass: { r: 2, fx: 'hourglass', unique: true, unlock: 20 },
  thorns: { r: 2, fx: 'thorns', unique: true, unlock: 20 },
  crown: { r: 2, mods: { luck: 25, harvest: 10 } },
  quiver: { r: 2, mods: { aspd: 15, crit: 5 } },
  stormglass: { r: 2, fx: 'chain', unlock: 15 },
  bellows: { r: 2, fx: 'burn', unlock: 15 },
  gearbox: { r: 2, mods: { eng: 35, aspd: -4 } },
  bulwark: { r: 2, mods: { armor: 8, wallhp: 15, dmg: -5 } },
  luckycharm: { r: 2, mods: { luck: 20, crit: 4 } },
  elixir: { r: 2, mods: { elem: 30, range: -5 } },
  midas: { r: 3, fx: 'midas', unique: true, unlock: 30 },
  dragonheart: { r: 3, mods: { dmg: 20, elem: 20, aspd: 10 }, unlock: 30 },
  aegis: { r: 3, mods: { wallhp: 40, armor: 10, regen: 3 }, unlock: 30 },
  warhorn: { r: 3, mods: { aspd: 25, dmg: 10, range: -8 }, unlock: 30 },
  tactics: { r: 3, fx: 'abil', unique: true, unlock: 30 },
  kingsbanner: { r: 3, mods: { dmg: 15, aspd: 15, wallhp: 15 }, unlock: 35 },
  // Boss relics: one of three is offered after every boss. All are unique.
  queencrown: { r: 4, relic: true, unique: true, mods: { luck: 30 }, fx: 'rarefloor' },
  behemothplate: { r: 4, relic: true, unique: true, mods: { wallhp: 40, armor: 8 } },
  tyrantwing: { r: 4, relic: true, unique: true, mods: { range: 15, aspd: 10 } },
  broodheart: { r: 4, relic: true, unique: true, fx: 'lifesteal' },
  warbanner: { r: 4, relic: true, unique: true, mods: { dmg: 25 } },
  philosopher: { r: 4, relic: true, unique: true, mods: { harvest: 30, luck: 10 } },
  ancienttome: { r: 4, relic: true, unique: true, mods: { xp: 40 }, fx: 'choice5' },
  dragonegg: { r: 4, relic: true, unique: true, mods: { eng: 60 } },
  hourglassages: { r: 4, relic: true, unique: true, fx: 'abil2' },
  titanhammer: { r: 4, relic: true, unique: true, mods: { crit: 10 }, fx: 'crit3' },
  phoenix: { r: 4, relic: true, unique: true, fx: 'phoenix' },
  kingsseal: { r: 4, relic: true, unique: true, fx: 'cap3' },
  // Relics that renown adds to what the bosses can leave behind.
  stormbanner: { r: 4, relic: true, unique: true, unlock: 30, fx: 'stormlord' },   // storms strike twice as often and never your own towers
  seedvault: { r: 4, relic: true, unique: true, unlock: 30, fx: 'seedvault' },     // winter does not halve the harvest, which keeps growing as in the first year
  mirrorshard: { r: 4, relic: true, unique: true, unlock: 35, fx: 'mirror' },      // the horde's resistances are halved
  voidlantern: { r: 4, relic: true, unique: true, unlock: 30, fx: 'lantern' },     // night, fog, snow and blizzards do not shorten your ranges
  titanheart: { r: 4, relic: true, unique: true, unlock: 35, mods: { keephp: 1500 }, fx: 'heart' },   // the keep mends 0.3% of its health every second of a wave
  thorncrown: { r: 4, relic: true, unique: true, unlock: 35, fx: 'keepthorns' },   // whatever strikes the keep loses 6% of its health
};
export const ITEM_KEYS = Object.keys(ITEMS);
export const ITEM_PRICE = [20, 45, 90, 180];

// ---- Turrets: stand on fixed spots in the courtyard; another copy raises the level ----
export const TURRETS = {
  bolt: { age: 1, p: 12, cd: 0.8, range: 20, kind: 2, speed: 45, price: 40 },
  cannon: { age: 2, p: 45, cd: 2.6, range: 18, kind: 7, speed: 22, aoe: 2.6, price: 70 },
  mortar: { age: 2, p: 60, cd: 4, range: 34, lob: true, aoe: 3.5, price: 90 },
  tesla: { age: 3, p: 16, cd: 1.4, range: 15, chain: 3, price: 80 },
  ballista: { age: 3, p: 140, cd: 3, range: 32, kind: 4, speed: 60, tough: true, pierce: true, price: 110 },
};
export const TURRET_KEYS = Object.keys(TURRETS);
export const TURRET_SPOTS = [[-12, -4.2], [12, -4.2], [-12, 4.6], [12, 4.6], [-4.4, -12], [4.4, -12], [-4.2, 12], [4.2, 12]];
export const TURRET_BASE = 2;   // spots open without a workshop

// ---- The castle itself: keep and walls. cost[level] is the price of the next level. ----
const costs = (base, growth, max) => Array.from({ length: max }, (_, l) => (l < 1 ? 0 : Math.round(base * growth ** (l - 1))));
export const CASTLE = {
  hall: { max: 400, cost: costs(90, 1.55, 400) },
  walls: { max: 400, cost: costs(60, 1.52, 400) },
};
export const CAPACITY = [0, 10, 13, 16, 19, 22, 25, 28, 30, ...Array(392).fill(32)];   // defenders the walls hold, by wall level

// ---- Courtyard buildings: built on plots, each raised level by level with gold and castle level ----
export const BUILDINGS = {
  forge: { age: 1, cost: 80, mods: { dmg: 6 } },
  barracks: { age: 1, cost: 70 },                         // recruits +1 level, defenders learn 15% faster
  chapel: { age: 1, cost: 70, mods: { regen: 1.5 } },     // the free repair after a wave mends 8% more
  market: { age: 1, cost: 90 },                           // 4% cheaper shop; +1 offer at levels 1, 3 and 5
  mason: { age: 2, cost: 75, mods: { wallhp: 10, armor: 2 } },
  workshop: { age: 2, cost: 90, mods: { eng: 12 } },      // +1 turret spot per level
  library: { age: 2, cost: 85, mods: { xp: 12 } },        // reward rerolls 15% cheaper
  watchtower: { age: 3, cost: 110, mods: { range: 4 } },  // a third, deadly wave offer
  mint: { age: 3, cost: 120, mods: { harvest: 8 } },      // 3% interest on unspent gold
  tavern: { age: 3, cost: 110, mods: { luck: 8 } },       // +1 spoils choice at level 3
};
export const BUILDING_KEYS = Object.keys(BUILDINGS);
export const BUILD_MAX = 5;                               // the top level through the Golden Age; every later age allows one more
export const BUILD_LEVEL_REQ = [0, 2, 6, 10, 15, 20];     // castle level needed for building level i
export const BUILD_COST_MUL = [0, 1, 2.2, 4.5, 9, 18];
export const buildLevelReq = (i) => (i < BUILD_LEVEL_REQ.length ? BUILD_LEVEL_REQ[i] : 20 + 5 * (i - BUILD_MAX));
export const buildCostMul = (i) => (i < BUILD_COST_MUL.length ? BUILD_COST_MUL[i] : 18 * 2 ** (i - BUILD_MAX));
export const buildingCapAt = (age) => age + 2;
export const BUILD_AGE_MUL = [1, 2.5, 6];                  // buildings of a later age cost more
export const PLOTS = [[-8, -8], [8, -8], [-9, 0.5], [9, 0.5], [-8, 8.3], [8, 8.3], [0, -9.2]];

// ---- Doctrines: one of three is chosen with every new age ----
export const DOCTRINES = {
  volleyfire: { fam: 'marksmen' },   // marksmen fire a second shot 35% of the time
  overload: { fam: 'arcane' },       // arcane spells echo 25% of the time
  wildfire: { fam: 'alchemy' },      // burn and poison deal double damage; bigger blasts
  sanctuary: { fam: 'faith' },       // healing is doubled; songs reach further
  shieldwall: { fam: 'wardens' },    // walls and keep take 20% less damage; spearmen hit 50% harder
  clockwork: { fam: 'engineers' },   // turrets attack 40% faster; two more turret spots; mines hit twice as hard
  wareconomy: {},                    // 40% more gold after each wave; one more shop offer
  conscription: {},                  // room for four more defenders; recruits come a level higher
  veterans: {},                      // every defender gains two levels now and learns 50% faster
  giantkillers: {},                  // 50% more damage to bosses, champions and elites
  moat: {},                          // monsters near the walls are slowed by a quarter
  treasury: {},                      // 8% interest on unspent gold after each wave
  bloodlust: {},                     // every kill speeds up all attacks a little, for the rest of the wave
  luckystar: {},                     // +40 luck and one more spoils choice
  masons: {},                        // the free repair after a wave is complete; walls have 20% more HP
  highground: {},                    // towers give twice the range bonus; everyone reaches 10% further
};
export const DOCTRINE_KEYS = Object.keys(DOCTRINES);

// ---- Events: a short story with a choice, every few waves ----
export const EVENTS = ['caravan', 'deserters', 'plague', 'smith', 'shrine', 'gambler', 'refugees', 'egg', 'mercs', 'festival'];

// ---- Lords: chosen before a run. Each starts differently and trades one strength for a weakness. ----
export const LORDS = {
  marshal: { unlock: 0, units: ['archer', 'archer', 'spear', 'archer'], mods: { dmg: 10, armor: 5 } },
  merchant: { unlock: 0, units: ['archer', 'archer', 'archer'], mods: { harvest: 12, luck: 20, dmg: -8 }, gold: 80 },
  archmage: { unlock: 15, units: ['mage', 'frost', 'archer'], mods: { elem: 30, wallhp: -10 } },
  engineer: { unlock: 15, units: ['archer', 'archer', 'cleric'], mods: { eng: 40, aspd: -5 }, turret: 'bolt' },
  saint: { unlock: 20, units: ['cleric', 'priest', 'archer', 'archer'], mods: { regen: 3, keephp: 400, dmg: -6 } },
  warden: { unlock: 25, units: ['spear', 'shield', 'spear', 'archer'], mods: { armor: 8, wallhp: 10, aspd: -8 } },
  huntress: { unlock: 30, units: ['ranger', 'archer', 'archer'], mods: { range: 10, crit: 5, wallhp: -12 } },
  gambler: { unlock: 35, units: ['archer', 'archer', 'mage'], mods: { luck: 40, dmg: -6 }, gold: 30, rule: 'cheaprolls' },
  architect: { unlock: 40, units: ['archer', 'archer', 'cleric'], mods: { wallhp: 10, dmg: -8 }, rule: 'builder' },
  hexlord: { unlock: 45, units: ['hexer', 'mage', 'archer'], mods: { elem: 15, keephp: -300 } },
  seer: { unlock: 50, units: ['mage', 'archer', 'archer'], mods: { luck: 15, dmg: -5 }, rule: 'foresight' },              // one more mutation to choose from; sees the weather three waves ahead
  giantslayer: { unlock: 55, units: ['crossbow', 'archer', 'spear'], mods: { crit: 6, wallhp: -12 }, rule: 'trophy' },     // 40% more damage to bosses and champions; one more relic to choose from
  druid: { unlock: 60, units: ['cleric', 'archer', 'archer', 'bard'], mods: { regen: 2, harvest: 10, aspd: -6 }, rule: 'seasons' },   // the gift of every season is doubled
  tactician: { unlock: 65, units: ['archer', 'mage', 'pyro', 'spear'], mods: { xp: 15, dmg: -8 }, rule: 'mixed' },         // 4% more damage for every family on the walls
  conqueror: { unlock: 70, units: ['spear', 'spear', 'archer', 'archer'], mods: { dmg: 12, keephp: -300 }, rule: 'glory' },   // harder waves pay a quarter more, standard waves 15% less
};
export const LORD_KEYS = Object.keys(LORDS);

// ---- Castle abilities: the commander's own moves during a wave. Three are taken into a run. ----
export const ABILITIES = {
  volley: { unlock: 0, cd: 20, r: 5 },      // a rain of arrows on a chosen spot
  mend: { unlock: 0, cd: 35 },              // every wall is patched up, ruins are raised again
  rally: { unlock: 0, cd: 30, t: 6 },       // every defender attacks 50% faster for a few seconds
  freeze: { unlock: 20, cd: 40, t: 5 },     // every monster is slowed by 70% for a few seconds
  bountyhunt: { unlock: 25, cd: 50, t: 10 },// kills pay double gold and experience for a while
  meteor: { unlock: 30, cd: 45, r: 7 },     // a meteor on a chosen spot: three times a volley
  signal: { unlock: 35, cd: 45, t: 8 },     // a signal fire: every defender reaches 30% further for a while
  caltrops: { unlock: 40, cd: 40, r: 6, t: 10 },   // a field of spikes on a chosen spot: slows by half and wounds whatever crosses it
  laststand: { unlock: 45, cd: 75, t: 4 },  // the keep cannot be hurt for a few seconds
};
export const ABILITY_KEYS = Object.keys(ABILITIES);
export const DEFAULT_ABILITIES = ['volley', 'mend', 'rally'];

// Growth curves. n is the wave number.
// Health grows gently through the first two ages and steeply from the Iron Age on.
// After the first year both grow by a fixed share every wave, so the horde always outgrows the castle in the end.
export const HP_GROW = 1.12;
export const DMG_GROW = 1.12;
const hpBase = (n) => (1 + 0.15 * (n - 1) + 0.012 * (n - 1) ** 2 + 0.0005 * (n - 1) ** 3) * (1 + 0.085 * Math.max(0, n - 12));
const dmgBase = (n) => (1 + 0.05 * (n - 1) + 0.003 * (n - 1) ** 2) * (1 + 0.03 * Math.max(0, n - 12));
const late = (n) => Math.max(0, n - YEAR_LEN);
export const hpMul = (n) => hpBase(Math.min(n, YEAR_LEN)) * HP_GROW ** late(n);
export const dmgMul = (n) => dmgBase(Math.min(n, YEAR_LEN)) * DMG_GROW ** late(n);
// Bosses grow more slowly than the horde through the first year and keep pace with it afterwards.
export const bossHpMul = (n) => hpBase(Math.min(n, YEAR_LEN)) ** 0.85 * HP_GROW ** late(n);
// Whatever hurts a monster by a share of its own health (thorns, oil, razor walls), and the
// castle's own strikes from the sky, keep pace with the horde through the first year only:
// afterwards they grow half as fast as its health, so they fade but never vanish.
export const pctMul = (n) => HP_GROW ** (-late(n) / 2);
// Harvesting grows after every wave: 5% in the first year, half as fast in every year after it.
export const harvestGrowth = (n) => 0.05 / 2 ** (yearOf(n) - 1);
export const goldMul = (n) => 1 + 0.07 * (n - 1);
export const budget = (n) => 5 + 3 * n + (n >= 3 ? Math.min(n - 2, 40) * 3.2 : 0);
export const lvMul = (lv) => 1 + 0.12 * (lv - 1);
export const xpNeed = (lv) => Math.round(12 * lv ** 1.5);     // a defender's next level
export const levelNeed = (lv) => (lv + 3) ** 2;                // the castle's next level
export const thMax = (l) => 1500 + 700 * (l - 1);
export const wallMul = (l) => 1 + 0.5 * (l - 1);
export const recruitLevel = (n) => 1 + Math.floor((n - 1) / 4);

// Renown for a finished run: the only thing that carries over, and it only unlocks new content.
// cleared: waves cleared. seasons: boss waves cleared. Every full year pays a little extra.
export const renownFor = ({ cleared, seasons, age, siege }) =>
  Math.round((cleared + 8 * seasons + 5 * age + 20 * Math.floor(seasons / 4)) * siegeRenown(siege));
// All the renown ever earned also counts towards a title: a rank with no top that gives no power.
export const titleNeed = (rank) => Math.round(30 * rank ** 1.9);
export const titleRank = (earned) => { let r = 0; while (titleNeed(r + 1) <= earned) r++; return r; };

// ---- Seasons: each lasts eight waves and helps both sides ----
// harvest and gold: income. repair: added to the free repair. range: defenders. horde: wave size.
// speed and hp: monsters. luck: spoils.
export const SEASON_FX = {
  spring: { harvest: 1.25, repair: 0.15, horde: 1.08 },
  summer: { range: 1.08, speed: 1.08 },
  autumn: { gold: 1.2, luck: 15, hp: 1.1 },
  winter: { speed: 0.88, harvest: 0.5 },
};

// ---- Weather: rolled for every wave from the season's table; the next waves are forecast ----
export const WEATHER = ['clear', 'rain', 'fog', 'gale', 'storm', 'heat', 'snow', 'blizzard'];
export const WEATHER_BY_SEASON = [
  [40, 30, 15, 12, 3, 0, 0, 0],    // spring
  [45, 8, 0, 10, 20, 17, 0, 0],    // summer
  [35, 25, 25, 15, 0, 0, 0, 0],    // autumn
  [35, 0, 10, 10, 0, 0, 30, 15],   // winter
];
export const CALM_WAVES = 3;       // the first waves of a run are always clear
export const FORECAST = 3;         // waves of weather known ahead (this one and the next two)
// burn: fire damage. chain: extra lightning jumps. speed: monsters. range: everyone's reach.
// luck: spoils. fly: flying monsters' speed. cloud: how long poison lingers. bolt: seconds between
// lightning strikes. reload: defenders' reload time. frost: strength of slows.
export const WEATHER_FX = {
  clear: {},
  rain: { burn: 0.6, chain: 1, speed: 0.92 },
  fog: { range: 0.8, luck: 25 },
  gale: { fly: 0.7, cloud: 0.5 },
  storm: { bolt: 5, chain: 1 },
  heat: { burn: 1.5, reload: 1.08 },
  snow: { speed: 0.85, frost: 1.25, range: 0.92 },
  blizzard: { speed: 0.75, range: 0.85 },
};
export const BOLT_STUN = 2.5;      // seconds a defender is stunned when lightning strikes their post
export const BOLT_MISS = 0.2;      // how often a bolt strikes the castle instead of the horde

// ---- Mutations: after every boss the horde keeps one new trait for the rest of the run ----
// from: the boss whose legacy it is (index into BOSSES). sev: 2 for the harsher ones, which come
// with twice the boon. boss: it only changes bosses. Every mutation can be taken MUT_MAX times.
export const MUTATIONS = {
  swell: { from: 0, sev: 1 },                // the horde is 10% larger
  warcry: { from: 0, sev: 1 },               // a dying monster hastens those around it for 1.5 s
  frenzy: { from: 0, sev: 2 },               // monsters are 7% faster
  champions: { from: 0, sev: 2 },            // every wave brings one more champion
  escort: { from: 0, sev: 1, boss: true },   // bosses come with two elite guards
  might: { from: 0, sev: 1, boss: true },    // boss powers come 20% more often; bosses have 15% more health
  hide: { from: 1, sev: 2 },                 // +3 armour for every monster
  shell: { from: 1, sev: 2 },                // a third of the monsters shrug off their first direct hit
  breach: { from: 1, sev: 1 },               // 15% more damage to walls
  savage: { from: 1, sev: 2 },               // monsters hit 10% harder
  plated: { from: 1, sev: 1 },               // brutes, rams and shellbacks have 25% more health
  rage: { from: 1, sev: 1, boss: true },     // below half health a boss is 25% faster
  spawn: { from: 2, sev: 1 },                // 10% of the monsters split into two runners when they die
  regrow: { from: 2, sev: 2 },               // monsters mend 0.5% of their health every second
  volatile: { from: 2, sev: 1 },             // a monster dying at the foot of a wall bursts against it
  tunnel: { from: 2, sev: 2 },               // 8% of runners and brutes dig under the walls
  twin: { from: 2, sev: 2, boss: true },     // a second, different boss joins every boss wave
  undying: { from: 2, sev: 1, boss: true },  // a boss rises once more, with 20% of its health
  wings: { from: 3, sev: 1 },                // 8% of the runners come as gloomwings
  raids: { from: 3, sev: 2 },                // every fourth, then third, then second wave is fought at night
  dread: { from: 3, sev: 1, boss: true },    // defenders near a boss attack 12% slower
  thieves: { from: 3, sev: 1 },              // every blow on the keep steals gold
  ward: { from: 3, sev: 1 },                 // slows and curses are 20% weaker
  venom: { from: 3, sev: 1 },                // a spit that lands on a wall slows the defender on it
};
export const MUTATION_KEYS = Object.keys(MUTATIONS);
export const MUT_MAX = 3;
// What the commander gets for accepting a mutation. Harsher mutations pay double.
export const BOONS = ['gold', 'level', 'item', 'stat', 'promote', 'relic'];

// ---- Adaptation: the horde grows a resistance to whatever hurt it most ----
// After every boss from the second one on, the family that dealt the largest share of the
// season's damage is resisted `gain`% more (up to `cap`); every other family is resisted
// `fade`% less, down to `floor` (a weakness). Below `share` of the damage nothing is learnt.
export const ADAPT = { gain: 8, fade: 4, cap: 40, floor: -24, share: 0.3, from: 2 };

// ---- Age powers: what each age of a path adds for the rest of the run ----
export const PERKS = {
  obsidian: { razor: 0.08, razorBoss: 0.01, wallhp: 20 },   // a monster striking a wall loses 8% of its health
  crystal: { crit: 8, splinter: 0.5, reach: 4 },             // critical hits leap to a second monster for half damage
  star: { every: 8, r: 3, mul: 1.5 },                        // a star falls on the strongest monster
  steel: { guard: 0.85, repair: 0.5 },                       // walls and keep take 15% less; repairs cost half
  powder: { p: 50, cd: 3, range: 22, aoe: 2.2 },             // a gun on each of the four towers
  steam: { speed: 0.3, levels: 1, rolls: 1 },                // faster, stronger turrets; a free shop reroll each wave
  rune: { regen: 0.01, ward: 2 },                            // walls mend themselves; each segment refuses to fall once a wave
  dragon: { every: 10, r: 5, mul: 1.2 },                     // a dragon burns the thickest crowd
  celestial: { regen: 0.006, grace: 0.3 },                   // the keep mends itself and survives one killing blow a wave
};
