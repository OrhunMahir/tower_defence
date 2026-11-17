// Every word the player reads, the picture that goes with it, and small helpers for showing numbers.
import { icon as I } from './icons.js';

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
export const fmt = (n) => (Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(Math.abs(n) >= 1e7 ? 0 : 1)}M` : Math.abs(n) >= 1e4 ? `${(n / 1e3).toFixed(Math.abs(n) >= 1e5 ? 0 : 1)}k` : String(Math.round(n)));
export const sign = (v) => (v > 0 ? `+${fmt(v)}` : fmt(v));
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
export const coin = I('coin', 'c');
export const star = I('star', 'c');

export const GAME = 'Hordewall';

// name, plural, what it does
export const MON = {
  runner: ['Runner', 'Runners', 'Fast and fragile.'],
  brute: ['Brute', 'Brutes', 'Slow and tough. Smashes walls.'],
  queen: ['The Queen', 'Queens', 'Boss. Her shriek drives the horde into a frenzy and calls runners to her side.'],
  spitter: ['Spitter', 'Spitters', 'Stops short of the wall and spits acid at it.'],
  flyer: ['Gloomwing', 'Gloomwings', 'Flies over the walls. Spearmen and mines cannot reach it.'],
  splitter: ['Broodsack', 'Broodsacks', 'Bursts into three runners when killed.'],
  shellback: ['Shellback', 'Shellbacks', 'Armoured, so weak hits barely scratch it. Crossbows, muskets and poison get through.'],
  behemoth: ['The Behemoth', 'Behemoths', 'Boss. Marks a wall, then brings most of it down with a quake.'],
  broodmother: ['The Brood Mother', 'Brood Mothers', 'Boss. Keeps spawning runners until slain.'],
  skytyrant: ['The Sky Tyrant', 'Sky Tyrants', 'Boss. Flies for the keep and dives at your defenders, stunning them.'],
  blightling: ['Blightling', 'Blightlings', 'Runs at the wall and bursts against it. Kill it before it arrives.'],
  shaman: ['Shaman', 'Shamans', 'Keeps its distance and mends the monsters around it.'],
  ram: ['Ramhorn', 'Ramhorns', 'Slow and armoured. Breaks walls five times as fast.'],
  burrower: ['Burrower', 'Burrowers', 'Digs under the walls and comes up in the courtyard. Untouchable underground.'],
  wraith: ['Wraith', 'Wraiths', 'Slips past almost half of all shots. Fire and poison always bite.'],
  hurler: ['Hurler', 'Hurlers', 'Lobs boulders at the walls from far away.'],
};
export const CHIPS = { ranged: 'Ranged', fly: 'Flying', split: 'Splits', armor: 'Armour', brood: 'Spawns', boom: 'Explodes', heal: 'Healer', burrow: 'Burrows', dodge: 'Dodges', boss: 'Boss' };
export const THEME_TXT = {
  swarm: 'Swarm', warband: 'Warband', siege: 'Siege', spitters: 'Acid rain', skyraid: 'Sky raid', brood: 'Brood', ironhide: 'Ironhide',
  blight: 'Blight', coven: 'Coven', battering: 'Battering rams', underminers: 'Underminers', haunting: 'Haunting', bombardment: 'Bombardment', horde: 'Horde',
};
export const TIER_TXT = {
  std: ['Standard', 'The ordinary wave.'],
  hard: ['Harder', 'More monsters. Double gold and experience, luckier spoils.'],
  deadly: ['Deadly', 'A huge wave with a modifier. 3.5× gold, 3× experience and the luckiest spoils.'],
};
export const MOD_TXT = {
  frenzied: [I('angry'), 'Frenzied', 'Every monster is 30% faster.'],
  armoured: [I('armoured'), 'Armoured', 'Every monster has extra armour. Piercing shots and poison ignore it.'],
  giants: [I('giants'), 'Giants', 'Half as many monsters, each almost twice as strong.'],
  swarm: [I('swarm'), 'Swarm', 'Half again as many monsters, each a little weaker.'],
  night: [I('moon'), 'Night', 'Your defenders see a fifth less far.'],
  regen: [I('regen'), 'Regenerating', 'Wounded monsters slowly heal. Kill them quickly.'],
};

// name, what it does
export const UNIT_TXT = {
  archer: ['Archer', 'Quick shots at the nearest monster.'],
  crossbow: ['Crossbowman', 'Heavy bolts at the toughest monster. Pierces armour.'],
  ranger: ['Ranger', 'Longest reach; shoots flyers first and often crits.'],
  mage: ['Mage', 'Exploding orbs that hurt whole groups.'],
  frost: ['Frost mage', 'Icy bursts that slow monsters down.'],
  storm: ['Stormcaller', 'Lightning that jumps between monsters.'],
  pyro: ['Pyromancer', 'Fireballs that set monsters burning.'],
  alchemist: ['Alchemist', 'Flasks that leave clouds of poison. Poison ignores armour.'],
  bomber: ['Bombardier', 'Slow, huge explosions.'],
  cleric: ['Cleric', 'Mends damaged walls during battle.'],
  priest: ['Priest', 'Heals the keep while monsters are about.'],
  bard: ['Bard', 'Songs that make nearby defenders attack faster.'],
  spear: ['Spearman', 'Strikes monsters at the foot of the wall. Cannot reach flyers.'],
  shield: ['Shieldbearer', 'Their wall (and its neighbours, less so) takes less damage.'],
  hexer: ['Hexer', 'Curses the toughest monster, so that everyone hurts it more.'],
  tinker: ['Tinker', 'Keeps the turrets oiled. Every turret fires faster.'],
  musketeer: ['Musketeer', 'A slow, heavy shot that pierces armour and splashes.'],
  sapper: ['Sapper', 'Buries mines in front of their wall. Mines cannot hit flyers.'],
  // The classes of the three paths of ages.
  lavamancer: ['Lavamancer', 'Lobs molten rock that leaves a burning pool on the ground.'],
  glaive: ['Glaivemaster', 'Strikes at the foot of the wall and finishes whatever is nearly dead.'],
  prismancer: ['Prismancer', 'A beam on the toughest monster that grows stronger the longer it holds.'],
  shardbow: ['Shardbow', 'Crystal arrows that break into shards and hit the monsters around.'],
  stargazer: ['Stargazer', 'Reads the fate of the toughest monster. The next hits on it are critical.'],
  starforger: ['Starforger', 'Calls a meteor down on the thickest crowd. Cannot hit flyers.'],
  repeater: ['Repeater', 'Looses three bolts in quick succession.'],
  ironclad: ['Ironclad', 'Strikes at the foot of the wall and throws the monster back.'],
  rocketeer: ['Rocketeer', 'Long-range rockets with a wide blast. Goes for flyers first.'],
  artillerist: ['Artillerist', 'A cannonball that flies on through a whole column and pierces armour.'],
  galvanist: ['Galvanist', 'Lightning that jumps between monsters and stuns them for a moment.'],
  wallwright: ['Wallwright', 'Mends walls and, now and then, raises a ruined one again.'],
  runeblade: ['Runeblade', 'Brands monsters at the foot of the wall, so that everyone hurts them more.'],
  runesmith: ['Runesmith', 'Carves runes for the defenders next to them, who hit harder for it.'],
  drakekeeper: ['Drake keeper', 'A young drake breathes fire over everything in front of the wall.'],
  lancer: ['Lancer', 'A heavy lance at the toughest monster that pins it to the ground.'],
  seraph: ['Seraph', 'Heals the keep and smites the monsters nearest to it.'],
  skycaller: ['Skycaller', 'A pillar of light that lands a moment later on everything under it.'],
};
export const FAM_TXT = {
  marksmen: ['Marksmen', 'Marksmen get +10% range and +5% crit per tier.'],
  arcane: ['Arcane', 'Arcane casters deal +15% damage per tier; frost lasts longer.'],
  alchemy: ['Alchemy', 'Bigger blasts (+15%) and stronger burn and poison (+25%) per tier.'],
  faith: ['Faith', 'Healing and songs are 25% stronger per tier.'],
  wardens: ['Wardens', 'Walls and keep take 8% less damage per tier.'],
  engineers: ['Engineers', 'Engineers and every turret deal +15% damage per tier.'],
};
export const TRAIT_TXT = {
  eagle: ['Eagle eye', '+20% range.'], quick: ['Quick hands', 'Attacks 25% faster.'], crit: ['Deadly', '+15% crit chance.'],
  greedy: ['Greedy', 'Extra gold for every kill.'], scholar: ['Scholar', 'Gains 75% more experience.'],
  slayer: ['Giant slayer', '+50% damage to brutes, armoured monsters and bosses.'], veteran: ['Veteran', 'Joined two levels higher.'],
};
// Two paths per class, chosen at level six.
export const SPEC_TXT = {
  longbow: ['Longbowman', '+35% range and +15% damage.'], rapid: ['Rapid shot', 'Reloads 35% faster.'],
  siegebolt: ['Siege bolt', 'Bolts fly on through three more monsters.'], headhunter: ['Headhunter', 'Double damage to bosses, champions and elites.'],
  falconer: ['Falconer', 'Shoots two targets at once; +50% damage to flyers.'], deadeye: ['Deadeye', '+25% crit chance; crits hit three times as hard.'],
  archmage: ['Archmage', 'Blasts are 40% wider.'], battlemage: ['Battle mage', '+35% damage.'],
  blizzard: ['Blizzard', 'Blasts are 50% wider and slow much harder.'], shatter: ['Shatter', '+80% damage, and more still to slowed monsters.'],
  tempest: ['Tempest', 'Lightning jumps to three more monsters.'], thunderlord: ['Thunderlord', '+50% damage.'],
  inferno: ['Inferno', 'Fire burns twice as hot.'], firewall: ['Firewall', 'Fireballs are 60% wider.'],
  plague: ['Plague doctor', 'Poison clouds last twice as long.'], acid: ['Acid', 'Clouds melt armour. Monsters inside take 20% more damage from everyone.'],
  demolition: ['Demolition', '+50% damage.'], cluster: ['Cluster bombs', 'Blasts are 40% wider and thrown 20% faster.'],
  mastermason: ['Master mason', 'Mends 80% more.'], warder: ['Warder', 'Reaches 60% further and mends 30% more.'],
  highpriest: ['High priest', 'Heals 80% more.'], zealot: ['Zealot', 'Prays 40% faster.'],
  wardrummer: ['War drummer', 'The song is half again as strong.'], minstrel: ['Minstrel', 'The song reaches twice as far.'],
  halberd: ['Halberdier', 'Reaches 50% further and sweeps three monsters at once.'], pikeman: ['Pikeman', '+70% damage.'],
  bulwark: ['Bulwark', 'Guards half again as well.'], thornwall: ['Thornwall', 'Monsters hitting the guarded wall hurt themselves.'],
  doom: ['Doomsayer', 'Curses are 60% stronger.'], plaguebringer: ['Plaguebringer', 'Curses three monsters at once.'],
  overclock: ['Overclocker', 'Speeds turrets up 60% more.'], armorer: ['Armourer', 'Every turret deals 15% more damage.'],
  sharpshooter: ['Sharpshooter', '+40% damage and +20% range.'], grapeshot: ['Grapeshot', 'A much wider blast for a little less damage.'],
  minelayer: ['Minelayer', 'Keeps two more mines out and lays them faster.'], bigbang: ['Big bang', 'Mines hit 60% harder over a wider area.'],
  eruption: ['Eruption', 'Pools are 50% wider.'], tarpit: ['Tar pit', 'Pools slow whatever walks through them by a third.'],
  reaper: ['Reaper', 'Finishes monsters below a quarter of their health.'], whirlwind: ['Whirlwind', 'Sweeps four monsters at once.'],
  focus: ['Focus', 'The beam grows to five times its strength instead of three.'], refraction: ['Refraction', 'The beam splits to two more monsters for half the damage.'],
  splinterstorm: ['Splinterstorm', 'Arrows break into six shards.'], diamondtip: ['Diamond tip', 'Pierces armour and hits 30% harder.'],
  constellation: ['Constellation', 'Reads three fates at once.'], doomsayer: ['Dire omen', 'Twice as many fated hits.'],
  twinstars: ['Twin stars', 'Two meteors at once.'], supernova: ['Supernova', '+30% damage over a 50% wider area.'],
  drum: ['Drum magazine', 'Five bolts in a volley.'], steelbolts: ['Steel bolts', 'Bolts pierce armour and hit 25% harder.'],
  ramcharge: ['Ram charge', 'Throws three monsters back, almost twice as far.'], shieldbash: ['Shield bash', 'The blow also stuns for a second.'],
  barrage: ['Barrage', 'Fires at two targets at once.'], incendiary: ['Incendiary', 'Rockets set what they hit on fire.'],
  chainshot: ['Chain shot', 'Flies through twice as many monsters and hits 20% harder.'], heavyball: ['Heavy ball', '+60% damage and knocks monsters back.'],
  overcharge: ['Overcharge', 'Stuns twice as long.'], arcwelder: ['Arc welder', 'Jumps to four more monsters and hits 20% harder.'],
  scaffolders: ['Scaffolders', 'Raises ruins to 60% instead of 30%.'], quickmortar: ['Quick mortar', 'Works 40% faster.'],
  ruin: ['Rune of ruin', 'The brand is twice as strong.'], frostrune: ['Rune of frost', 'Every blow also slows by 40%.'],
  masterrune: ['Master rune', 'Runes are half again as strong.'], wideward: ['Wide ward', 'Runes reach twice as far.'],
  elderdrake: ['Elder drake', 'Breath reaches 40% further and burns 30% hotter.'], wildbreath: ['Wild breath', 'A wider cone and twice the burning.'],
  dragonlance: ['Dragon lance', 'Double damage to bosses, champions and elites.'], barbed: ['Barbed lance', 'Pins twice as long for a little less damage.'],
  judgement: ['Judgement', 'Smites six monsters instead of three.'], mercy: ['Mercy', 'Heals and smites 80% more.'],
  sunbeam: ['Sunbeam', 'The pillar is 50% wider.'], eclipse: ['Eclipse', '+60% damage.'],
};
export const RAR_TXT = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Exalted'];
// name, unit, what it does
export const STAT_TXT = {
  dmg: ['Damage', '%', 'Damage of every defender.'], aspd: ['Attack speed', '%', 'How fast every defender attacks.'],
  range: ['Range', '%', 'How far every defender reaches.'], crit: ['Crit chance', '%', 'Chance to hit for double damage.'],
  elem: ['Elemental', '%', 'Damage of mages, frost, storm, fire and poison.'], eng: ['Engineering', '%', 'Damage of turrets.'],
  wallhp: ['Wall HP', '%', 'Health of every wall segment.'], keephp: ['Keep HP', '', 'Health of the keep.'],
  regen: ['Wall regen', '', 'Wall HP mended per second in battle (grows with the walls).'], armor: ['Armour', '', 'Walls and keep take less damage.'],
  harvest: ['Harvesting', '', 'Gold after every wave. Grows 5% each wave in the first year, half as fast in every year after. More in spring, half in winter.'], luck: ['Luck', '', 'Rarer rewards, items and recruits.'],
  xp: ['Experience', '%', 'Faster levels for the castle and defenders.'],
};
const lower = (t) => (t[1] && t[1] === t[1].toUpperCase() && t[1] !== ' ' ? t : t[0].toLowerCase() + t.slice(1)).replace(/^(\w+) (HP)$/, (_, a, b) => `${a.toLowerCase()} ${b}`);
export const statLine = (k, v) => `${sign(v)}${STAT_TXT[k][1]} ${lower(STAT_TXT[k][0])}`;
export const statTip = (keys) => keys.map((k) => `<b>${STAT_TXT[k][0]}</b>: ${STAT_TXT[k][2]}`).join('<br>');
export const modsLine = (mods) => Object.entries(mods || {}).map(([s, v]) => statLine(s, v)).join(', ');

// icon, name, special rule (stat changes are described from the data)
export const ITEM_TXT = {
  whetstone: [I('whetstone'), 'Whetstone'], fletching: [I('fletching'), 'Fine fletching'], wardrum: [I('wardrum'), 'War drum'], horseshoe: [I('horseshoe'), 'Horseshoe'],
  ledger: [I('ledger'), 'Merchant ledger'], lime: [I('lime'), "Mason's lime"], tome: [I('tome'), 'Old tome'], kindling: [I('kindling'), 'Kindling'],
  toolbox: [I('toolbox'), 'Toolbox'], banner: [I('banner'), 'Banner'], coinpurse: [I('coinpurse'), 'Coin purse'], heavybolts: [I('heavybolts'), 'Heavy bolts'], spyglass: [I('spyglass'), 'Spyglass'],
  grindstone: [I('grindstone'), 'Grindstone'],
  oil: [I('oil'), 'Boiling oil', 'Monsters battering the walls lose 4% of their health each second.'],
  bounty: [I('bounty'), 'Bounty board', '+25% gold for every kill.'],
  piggy: [I('piggy'), 'Piggy bank', 'After each wave, 10% interest on unspent gold.'],
  chimes: [I('chimes'), 'Wind chimes'], grimoire: [I('grimoire'), 'Grimoire'], cogs: [I('cogs'), 'Clockwork cogs'], bells: [I('bells'), 'Watch bells'],
  drillbook: [I('drillbook'), 'Drill book', 'Defenders learn 25% faster.'],
  poster: [I('poster'), 'Recruiting poster', 'Every spoils offers one more choice.'],
  marksflag: [I('marksflag'), 'Marksmen banner', 'Counts as one more Marksman for family bonuses.'],
  arcaneflag: [I('arcaneflag'), 'Arcane banner', 'Counts as one more Arcane caster for family bonuses.'],
  alchemyflag: [I('alchemyflag'), 'Alchemy banner', 'Counts as one more Alchemist for family bonuses.'],
  faithflag: [I('faithflag'), 'Faith banner', 'Counts as one more of the Faith for family bonuses.'],
  wardenflag: [I('wardenflag'), 'Warden banner', 'Counts as one more Warden for family bonuses.'],
  engineerflag: [I('engineerflag'), 'Engineer banner', 'Counts as one more Engineer for family bonuses.'],
  cursedbanner: [I('cursedbanner'), 'Cursed banner'], hourglass: [I('hourglass'), 'Hourglass', 'Monsters are 40% slower for the first 6 seconds of each wave.'],
  thorns: [I('thorns'), 'Thorned walls', 'Monsters hitting a wall lose 15% of their health.'],
  crown: [I('crown'), 'Gilded crown'], quiver: [I('quiver'), 'Endless quiver'],
  stormglass: [I('stormglass'), 'Storm glass', 'Lightning jumps to 2 more monsters.'],
  bellows: [I('bellows'), 'Bellows', 'Burn and poison are 50% stronger.'],
  gearbox: [I('gearbox'), 'Gearbox'], bulwark: [I('bulwark'), 'Bulwark plans'], luckycharm: [I('clover'), 'Lucky charm'], elixir: [I('elixir'), 'Elixir'],
  midas: [I('midas'), 'Midas touch', '10% of kills pay triple gold.'],
  dragonheart: [I('dragonheart'), 'Dragon heart'], aegis: [I('aegis'), 'Aegis'], warhorn: [I('warhorn'), 'War horn'],
  tactics: [I('map'), 'Book of tactics', 'Abilities come back 30% sooner.'],
  kingsbanner: [I('kingsbanner'), "King's banner"],
  queencrown: [I('queencrown'), 'Crown of the Queen', 'Nothing common turns up among the spoils any more.'],
  behemothplate: [I('behemothplate'), 'Behemoth plate'],
  tyrantwing: [I('tyrantwing'), "Tyrant's wing"],
  broodheart: [I('broodheart'), 'Brood heart', 'Every kill mends the keep a little.'],
  warbanner: [I('warbanner'), 'Banner of war'],
  philosopher: [I('philosopher'), "Philosopher's stone"],
  ancienttome: [I('ancienttome'), 'Ancient tome', 'Every castle level offers five upgrades instead of four.'],
  dragonegg: [I('dragonegg'), 'Clockwork dragon'],
  hourglassages: [I('hourglassages'), 'Hourglass of ages', 'Abilities come back 35% sooner.'],
  titanhammer: [I('titanhammer'), "Titan's hammer", 'Critical hits deal triple damage.'],
  phoenix: [I('phoenix'), 'Phoenix feather', 'Once per run, when the keep falls it rises again at half health, ruined walls stand again and fire sweeps the courtyard.'],
  kingsseal: [I('kingsseal'), "King's seal", 'Room for three more defenders.'],
  stormbanner: [I('stormbanner'), 'Storm banner', 'Thunderstorms strike twice as often and never your own towers. Lightning jumps to 2 more monsters.'],
  seedvault: [I('wheat'), 'Seed vault', 'Winter does not halve the harvest, and it keeps growing 5% each wave.'],
  mirrorshard: [I('mirrorshard'), 'Mirror shard', "The horde's resistances are halved."],
  voidlantern: [I('voidlantern'), 'Void lantern', 'Night, fog, snow and blizzards do not shorten your reach.'],
  titanheart: [I('titanheart'), 'Titan heart', 'The keep mends 0.3% of its health every second of a wave.'],
  thorncrown: [I('thorncrown'), 'Crown of thorns', 'Whatever strikes the keep loses 6% of its health.'],
};
// name, what it does, picture
export const TURRET_TXT = {
  bolt: ['Bolt thrower', 'Rapid bolts at the nearest monster.', I('turret')], cannon: ['Cannon', 'Explosive shots.', I('cannon')],
  tesla: ['Tesla coil', 'Lightning that jumps between monsters.', I('tesla')], mortar: ['Mortar', 'Shells the thickest crowd from afar. Cannot hit flyers.', I('mortar')],
  ballista: ['Ballista', 'Huge piercing bolts at the toughest monster.', I('ballista')],
};
// name, icon, how it starts, special rule
export const LORD_TXT = {
  marshal: ['The Marshal', I('medal'), 'A steady start with three archers and a spearman.'],
  merchant: ['The Merchant', I('moneybag'), 'Three archers and a fat purse.'],
  archmage: ['The Archmage', I('wizardhat'), 'Starts with a mage and a frost mage.'],
  engineer: ['The Engineer', I('goldgear'), 'Starts with a bolt thrower and a cleric.'],
  saint: ['The Saint', I('candle'), 'A cleric and a priest keep the castle whole.'],
  warden: ['The Warden', I('wardenshield'), 'Spears and a shieldbearer behind thick walls.'],
  huntress: ['The Huntress', I('bow'), 'A ranger leads her archers. Long reach, thin walls.'],
  gambler: ['The Gambler', I('dice'), 'Luck above all.', 'Every reroll costs half.'],
  architect: ['The Architect', I('setsquare'), 'Builds where others cannot.', 'One more building plot in every age.'],
  hexlord: ['The Hexlord', I('hoodskull'), 'A hexer and a mage. Curses do the work.'],
  seer: ['The Seer', I('eye'), 'A mage and two archers. Luck and foresight.', 'Sees the weather three waves ahead and is offered one more mutation to choose from.'],
  giantslayer: ['The Giant-slayer', I('greatsword'), 'A crossbowman leads the hunt for the bosses.', '+40% damage to bosses and champions; bosses offer one more relic.'],
  druid: ['The Druid', I('sprig'), 'A cleric and a bard keep the old ways.', 'The gift of every season is doubled.'],
  tactician: ['The Tactician', I('rook'), 'An archer, a mage, a pyromancer and a spearman. One of each.', '+4% damage for every family on the walls.'],
  conqueror: ['The Conqueror', I('swords'), 'Spears and archers, and a hunger for glory.', 'Harder waves pay a quarter more; standard waves pay 15% less.'],
};
// icon, name, what it does
export const ABIL_TXT = {
  volley: [I('volley'), 'Volley', 'Rain arrows on a spot you click.'],
  mend: [I('mend'), 'Mend walls', 'Patch every wall and raise the ruins.'],
  rally: [I('rally'), 'Rally', 'Every defender attacks 50% faster for 6 s.'],
  freeze: [I('snow'), 'Deep freeze', 'Every monster is 70% slower for 5 s.'],
  bountyhunt: [I('bountyhunt'), 'Bounty hunt', 'Kills pay double gold and experience for 10 s.'],
  meteor: [I('meteor'), 'Meteor', 'Drops a meteor on a spot you click. It hits like three volleys, over a wider area.'],
  signal: [I('beacon'), 'Signal fire', 'Every defender reaches 30% further for 8 s.'],
  caltrops: [I('caltrops'), 'Caltrops', 'Scatters spikes on a spot you click. For 10 s they slow whatever crosses by half and wound it.'],
  laststand: [I('laststand'), 'Last stand', 'Nothing can hurt the keep for 4 s.'],
};
export const SIEGE_TXT = {
  relaxed: ['Relaxed', 'Weaker monsters and more gold. Renown is halved.'],
  normal: ['Normal', 'The intended challenge.'],
  tough: ['Tough', 'Monsters have 15% more health.'],
  champions: ['Champions', 'Every wave brings a champion, one huge monster worth five.'],
  lean: ['Lean years', '15% less gold.'],
  swift: ['Swift', 'Monsters are 12% faster.'],
  omens: ['Omens', 'Every wave has a modifier.'],
  cruel: ['Cruel', 'Monsters hit 20% harder.'],
  scarce: ['Scarce', 'The spoils offer one choice fewer.'],
  warlords: ['Warlords', 'Bosses have 35% more health.'],
  apocalypse: ['Apocalypse', '25% more health again, and the last wave of every year brings every boss.'],
};
// How a siege level reads inside a sentence: "normal siege", "lean years siege", "siege 14".
export const siegeWords = (s, keys) => (s < keys.length ? `${SIEGE_TXT[keys[s]][0].toLowerCase()} siege` : `siege ${s}`);
export const lowFirst = (t) => t.charAt(0).toLowerCase() + t.slice(1);
// The ladder has no top: above the named levels a siege has a number and what it adds.
export const siegeName = (s, keys) => (s < keys.length ? SIEGE_TXT[keys[s]][0] : `Siege ${s}`);
export const siegeLines = (s, keys) => {
  const out = [];
  for (let i = Math.min(s, keys.length - 1); i >= 2; i--) out.push(SIEGE_TXT[keys[i]][1]);
  if (s < 2) out.push(SIEGE_TXT[keys[s]][1]);
  const extra = s - (keys.length - 1);
  if (extra > 0) {
    out.unshift(`Monsters have ${Math.round((1.06 ** extra - 1) * 100)}% more health and hit ${Math.round((1.03 ** extra - 1) * 100)}% harder.`);
    const muts = Math.min(12, Math.floor(extra / 2));
    if (muts) out.unshift(`The horde starts with ${plural(muts, 'mutation', 'mutations')}.`);
  }
  return out;
};
// name, what the walls look like
export const AGE_TXT = {
  timber: ['Timber Age', 'Wooden palisade'],
  stone: ['Stone Age', 'Stone walls'],
  iron: ['Iron Age', 'Fortress walls'],
  gold: ['Golden Age', 'Marble citadel'],
  obsidian: ['Obsidian Age', 'Walls of black glass'], crystal: ['Crystal Age', 'Crystal spires'], star: ['Star Age', 'A citadel of star-metal'],
  steel: ['Steel Age', 'Riveted steel walls'], powder: ['Powder Age', 'Gun towers'], steam: ['Steam Age', 'Engines and smokestacks'],
  rune: ['Rune Age', 'Rune-carved walls'], dragon: ['Dragonfire Age', 'Dragonbone towers'], celestial: ['Celestial Age', 'A citadel of light'],
};
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
export const roman = (n) => (n <= 10 ? ROMAN[n] : n <= 39 ? 'X'.repeat(Math.floor(n / 10)) + ROMAN[n % 10] : String(n));
// The name of an age; after the third age of a path every ascension adds a numeral.
export const ageName = (key, asc = 0) => `${AGE_TXT[key][0]}${asc > 0 ? ` ${roman(asc + 1)}` : ''}`;
// icon, name, what the path is about
export const PATH_TXT = {
  splendour: [I('sparkgem'), 'Path of Splendour', 'Critical hits and raw power. The castle itself becomes a weapon.'],
  industry: [I('industry'), 'Path of Industry', 'Turrets, guns and sturdy walls. Machines do the work.'],
  legend: [I('dragon'), 'Path of Legend', 'Wards, dragon fire and miracles.'],
};
// The power every age of a path adds for the rest of the run: name, what it does.
export const PERK_TXT = {
  obsidian: ['Razor walls', 'Monsters striking a wall lose 8% of their health. Walls have 20% more HP.'],
  crystal: ['Resonance', '+8% crit chance. Critical hits leap to a second monster for half the damage.'],
  star: ['Starfall', 'Every 8 seconds a star falls on the strongest monster.'],
  steel: ['Plate and rivet', 'Walls and keep take 15% less damage. Repairs cost half.'],
  powder: ['Tower guns', 'Each of the four towers mounts a gun that fires by itself.'],
  steam: ['Engines', 'Turrets fire 30% faster and count one level higher. The shop restocks once a wave for free.'],
  rune: ['Warding runes', 'Walls mend 1% of their health each second. Each wall segment refuses to fall once a wave.'],
  dragon: ['Dragon roost', 'A dragon circles the castle and burns the thickest crowd every 10 seconds.'],
  celestial: ['Grace', 'The keep mends itself during waves and survives one killing blow each wave.'],
};
// icon, name, what it gives the castle, what it gives the horde
export const SEASON_TXT = {
  spring: [I('sprout'), 'Spring', 'Harvest pays 25% more and the free repair mends 15% more.', 'The horde is 8% larger.'],
  summer: [I('sun'), 'Summer', 'Defenders reach 8% further.', 'Monsters are 8% faster.'],
  autumn: [I('leaf'), 'Autumn', 'Waves pay 20% more gold; +15 luck.', 'Monsters are 10% tougher.'],
  winter: [I('snow'), 'Winter', 'Monsters are 12% slower.', 'Harvest pays half.'],
};
// icon, name, what it does
export const WEATHER_TXT = {
  clear: [I('clear'), 'Clear', 'Nothing gets in the way.'],
  rain: [I('rain'), 'Rain', 'Fire burns 40% weaker. Lightning jumps once more. Monsters are 8% slower.'],
  fog: [I('fog'), 'Fog', "Every reach is 20% shorter, the horde's too. The spoils are luckier (+25)."],
  gale: [I('gale'), 'Gale', 'Flying monsters are 30% slower. Poison clouds blow away in half the time.'],
  storm: [I('storm'), 'Thunderstorm', 'Lightning strikes a monster every 5 seconds, and now and then stuns one of your defenders. Lightning jumps once more.'],
  heat: [I('heat'), 'Heatwave', 'Fire burns 50% hotter. Defenders attack 8% slower.'],
  snow: [I('snowfall'), 'Snow', 'Monsters are 15% slower and frost bites 25% harder. Defenders reach 8% less far.'],
  blizzard: [I('blizzard'), 'Blizzard', 'Monsters are 25% slower. Every reach is 15% shorter.'],
};
// The horde's mutations: icon, name, what level l does.
export const MUT_TXT = {
  swell: [I('swell'), 'Swollen ranks', (l) => `The horde is ${10 * l}% larger.`],
  warcry: [I('warcry'), 'Death cry', (l) => `A dying monster hastens those around it for ${1.5 * l} s.`],
  frenzy: [I('frenzy'), 'Frenzy', (l) => `Monsters are ${7 * l}% faster.`],
  champions: [I('champions'), 'Champions', (l) => `Every wave brings ${l} more champion${l > 1 ? 's' : ''}.`],
  escort: [I('escort'), 'Royal guard', (l) => `Every boss comes with ${2 * l} elite brutes.`],
  might: [I('runestone'), 'Ancient power', (l) => `Bosses have ${15 * l}% more health and use their powers ${20 * l}% more often.`],
  hide: [I('hide'), 'Thick hides', (l) => `Every monster has ${3 * l} more armour. Piercing shots and poison ignore it.`],
  shell: [I('shell'), 'Shells', (l) => (l >= 3 ? 'Every monster shrugs off its first direct hit.' : `${l === 1 ? 'A third' : 'Two thirds'} of the monsters shrug off their first direct hit.`)],
  breach: [I('ram'), 'Siegecraft', (l) => `Monsters deal ${15 * l}% more damage to walls.`],
  savage: [I('slashes'), 'Savagery', (l) => `Monsters hit ${10 * l}% harder.`],
  plated: [I('breastplate'), 'Plated vanguard', (l) => `Brutes, ramhorns and shellbacks have ${25 * l}% more health.`],
  rage: [I('rage'), 'Blood rage', (l) => `Below half health a boss moves and strikes ${25 * l}% faster.`],
  spawn: [I('hatchling'), 'Spawnlings', (l) => `${10 * l}% of the monsters split into two runners when they die.`],
  regrow: [I('regen'), 'Regrowth', (l) => `Monsters mend ${0.5 * l}% of their health every second.`],
  volatile: [I('burst'), 'Volatile', (l) => `A monster dying at the foot of a wall bursts against it for ${40 * l}% of its blow.`],
  tunnel: [I('burrow'), 'Tunnelers', (l) => `${8 * l}% of runners and brutes dig under the walls.`],
  twin: [I('twin'), 'Twin lords', (l) => `A second boss of another kind joins every boss wave, at ${25 + 25 * l}% of its health.`],
  undying: [I('undying'), 'Second wind', (l) => `A boss rises once more, with ${20 * l}% of its health.`],
  wings: [I('bat'), 'Winged brood', (l) => `${8 * l}% of the runners come as gloomwings.`],
  raids: [I('raids'), 'Night raids', (l) => `Every ${['fourth', 'third', 'second'][l - 1]} wave is fought at night, when your reach is a fifth shorter.`],
  dread: [I('ghost'), 'Dread aura', (l) => `Defenders near a boss attack ${12 * l}% slower.`],
  thieves: [I('plunder'), 'Plunderers', (l) => `Every blow on the keep steals gold${l > 1 ? ` (×${l})` : ''}.`],
  ward: [I('nazar'), 'Hexward', (l) => `Slows and curses are ${20 * l}% weaker.`],
  venom: [I('venom'), 'Venom', (l) => `A spit that lands on a wall slows the defender on it by ${10 * l}% for 3 s.`],
};
// What the commander gets with a mutation: icon, name.
export const BOON_TXT = {
  gold: [I('coins'), 'Gold'], level: [I('levelup'), 'Castle levels'], item: [I('chest'), 'An item'], stat: [I('statup'), 'A stat upgrade'], promote: [I('chevrons'), 'A promotion'], relic: [I('key'), 'One more relic to choose'],
};
// Titles: a rank from all the renown ever earned. The named ones first, then a numeral without end.
export const TITLES = ['Recruit', 'Watchman', 'Gatekeeper', 'Sergeant', 'Captain', 'Castellan', 'Baron', 'Count', 'Margrave', 'Duke', 'Prince', 'King', 'Emperor'];
export const titleName = (rank) => (rank < TITLES.length ? TITLES[rank] : `Emperor ${roman(rank - TITLES.length + 2)}`);
// icon, name, what it does per level
export const BUILD_TXT = {
  forge: [I('forge'), 'Forge', '+6% damage per level.'],
  barracks: [I('tent'), 'Barracks', 'Recruits join one level higher and defenders learn 15% faster, per level.'],
  chapel: [I('chapel'), 'Chapel', '+1.5 wall regen, and the free repair after a wave mends 8% more, per level.'],
  market: [I('market'), 'Market', 'The shop is 4% cheaper per level. One more offer at levels 1, 3 and 5.'],
  mason: [I('masonblock'), "Mason's yard", '+10% wall HP and +2 armour per level.'],
  workshop: [I('workbench'), 'Workshop', '+12% engineering and one more turret spot per level.'],
  library: [I('books'), 'Library', '+12% experience per level. Reward rerolls are 15% cheaper per level.'],
  watchtower: [I('watchtower'), 'Watchtower', '+4% range per level. Scouts find a third, deadly wave every round.'],
  mint: [I('mint'), 'Mint', '+8 harvesting per level, and 3% interest on unspent gold per level.'],
  tavern: [I('mug'), 'Tavern', '+8 luck per level. One more spoils choice from level 3.'],
};
export const DOC_TXT = {
  volleyfire: [I('twinarrows'), 'Volley fire', 'Marksmen loose a second shot 35% of the time.'],
  overload: [I('orb'), 'Overload', 'Arcane spells echo 25% of the time.'],
  wildfire: [I('wildfire'), 'Wildfire', 'Burn and poison deal double damage; alchemy blasts are wider.'],
  sanctuary: [I('grail'), 'Sanctuary', 'Healing is doubled and songs reach further.'],
  shieldwall: [I('shieldwall'), 'Shield wall', 'Walls and keep take 20% less damage; spearmen hit 50% harder.'],
  clockwork: [I('clock'), 'Clockwork', 'Turrets fire 40% faster, two more turret spots, mines hit twice as hard.'],
  wareconomy: [I('wareconomy'), 'War economy', '40% more gold after each wave and one more shop offer.'],
  conscription: [I('helmet'), 'Conscription', 'Room for four more defenders; recruits join a level higher.'],
  veterans: [I('chevrons'), 'Veterans', 'Every defender gains two levels now and learns 50% faster.'],
  giantkillers: [I('greatsword'), 'Giant killers', '50% more damage to bosses, champions and elites.'],
  moat: [I('moat'), 'Moat', 'Monsters at the foot of the walls are slowed by a quarter.'],
  treasury: [I('treasury'), 'Treasury', '8% interest on unspent gold after each wave.'],
  bloodlust: [I('blooddrop'), 'Bloodlust', 'Every kill speeds up all attacks a little, until the wave ends.'],
  luckystar: [I('shootingstar'), 'Lucky star', '+40 luck and one more spoils choice.'],
  masons: [I('masonblock'), 'Master masons', 'Walls are fully repaired after every wave and have 20% more HP.'],
  highground: [I('mountain'), 'High ground', 'Towers give twice the range bonus; everyone reaches 10% further.'],
};
// icon, title, story; option texts are built in the HUD from EVENT_OPT
export const EVENT_TXT = {
  caravan: [I('wagon'), 'A caravan at the gate', 'Traders ask to pass through your lands. Their best piece is for sale at half price.'],
  deserters: [I('whiteflag'), 'Deserters', 'A soldier who fled another lord asks to stand on your walls.'],
  plague: [I('sick'), 'Sickness in the keep', 'A fever spreads through the cellars.'],
  smith: [I('forge'), 'A wandering smith', 'She offers to sharpen blades or drill the whole garrison.'],
  shrine: [I('shrine'), 'An old shrine', 'A forgotten shrine stands in the woods. The priests want an offering.'],
  gambler: [I('dice'), 'The gambler', 'A grinning stranger offers to double half of your gold, or take it.'],
  refugees: [I('refugees'), 'Refugees', 'Families fleeing the horde ask for shelter. They would work on the walls.'],
  egg: [I('nestegg'), 'A strange egg', 'Your scouts found a warm, heavy egg. Something is moving inside.'],
  mercs: [I('swords'), 'Sellswords', 'Two mercenaries offer their arms for the next wave.'],
  festival: [I('bunting'), 'Harvest festival', 'The folk want to celebrate while they still can.'],
};
export const EVENT_OPT = {
  buy: 'Buy it', toll: 'Charge them a toll', take: 'Let them join', refuse: 'Send them away and drill instead',
  pay: 'Pay the healers', endure: 'Let it pass', hone: 'Hone one blade', drill: 'Drill the garrison', pass: 'Walk on',
  offer: 'Make an offering', pray: 'Pray (half the prayers are heard)', bet: 'Take the bet', shelter: 'Give them shelter', away: 'Turn them away',
  keep: 'Keep the egg warm', sell: 'Sell it', hire: 'Hire them', feast: 'Hold a feast', modest: 'A modest toast',
};
// key: [icon, name, how it is earned, renown]
export const ACH_TXT = {
  first: [I('tower'), 'First watch', 'Finish a run.', 5],
  wave10: [I('tenwaves'), 'Ten waves', 'Clear wave 10.', 5],
  wave20: [I('twentywaves'), 'Twenty waves', 'Clear wave 20.', 10],
  victory: [I('trophy'), 'A year on the walls', 'Hold the castle through the first year (wave 32).', 20],
  endless40: [I('cave'), 'Into the dark', 'Clear wave 40.', 20],
  wave64: [I('twowinters'), 'Two winters', 'Hold the castle through a second year (wave 64).', 40],
  wave100: [I('wreath'), 'A hundred waves', 'Clear wave 100.', 60],
  stone: [I('stonewall'), 'Stone Age', 'Reach the Stone Age.', 5],
  iron: [I('anvil'), 'Iron Age', 'Reach the Iron Age.', 10],
  gold: [I('crown'), 'Golden Age', 'Reach the Golden Age.', 20],
  path: [I('signpost'), 'A road is chosen', 'Reach the first age of a path.', 15],
  lastage: [I('temple'), 'End of the road', 'Reach the third age of a path.', 30],
  ascend: [I('stairs'), 'Ascension', 'Ascend beyond the last age of a path.', 40],
  allpaths: [I('map'), 'Every road', 'Reach the third age on all three paths.', 50],
  siege3: [I('bronze'), 'Champion', 'Hold the first year at siege level 3 or higher.', 15],
  siege6: [I('silver'), 'Omen reader', 'Hold the first year at siege level 6 or higher.', 25],
  siege10: [I('goldmedal'), 'Apocalypse survivor', 'Hold the first year at siege level 10 or higher.', 50],
  siege15: [I('rosette'), 'Above the ladder', 'Hold the first year at siege level 15 or higher.', 75],
  flawless: [I('diamond'), 'Not one stone', 'Hold the first year without losing a single wall segment.', 25],
  hoarder: [I('treasury'), 'Hoarder', 'Hold 20 items in one run.', 10],
  relics: [I('key'), 'Relic hunter', 'Hold 3 relics in one run.', 10],
  legends: [I('goldstar'), 'Hall of legends', 'Field 3 defenders who are legendary or better.', 15],
  family: [I('house'), 'Full house', 'Bring a family to its third tier.', 15],
  specialists: [I('diploma'), 'Specialists', 'Field 6 specialised defenders.', 10],
  engineer: [I('cannon'), 'Arsenal', 'Reach 10 turret levels in one run.', 10],
  builder: [I('village'), 'Master builder', 'Raise 6 buildings in one run.', 10],
  slayer: [I('skull'), 'Thousand cuts', 'Slay 1,000 monsters in one run.', 10],
  butcher: [I('skulls'), 'Butcher of hordes', 'Slay 10,000 monsters in all.', 20],
  mutant: [I('mutant'), 'Unnatural selection', 'Face a horde with 8 mutation levels.', 20],
  swift: [I('hourglass'), 'A swift year', 'Hold the first year with under 25 minutes of battle.', 20],
  lords3: [I('pennants'), 'Many banners', 'Hold the first year with three different lords.', 25],
  daily: [I('bread'), 'Daily bread', 'Finish a daily challenge.', 10],
};

// Plain glyphs for a line of numbers; they take the colour of the text.
export const ICON = {
  dmg: I('dmg', 'g'), spd: I('spd', 'g'), rng: I('rng', 'g'), heal: I('heal', 'g'), hp: I('hp', 'g'), kill: I('kill', 'g'), lock: I('locked', 'g'), xp: I('xp', 'g'), move: I('move', 'g'),
  check: I('check', 'g'), ring: I('ring', 'g'), up: I('up', 'g'), swap: I('swap', 'g'), what: I('what', 'g'), left: I('left', 'g'), right: I('right', 'g'),
};
// Pictures the screens use besides those in the tables above.
export const PIC = {
  luck: I('clover'), night: I('moon'), rally: I('rally'), frozen: I('snow'), bounty: I('bountyhunt'), signal: I('beacon'), laststand: I('laststand'),
  tip: I('quill'), held: I('tower'), retired: I('whiteflag'), fell: I('skull'),
};
