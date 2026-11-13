// Client: sends the commander's choices, draws whatever the server says. No game rules live here.
import * as THREE from 'three';
import { buildWorld, makeUnit, makeBeast, makeTurret, hAt, winMat, fireMat, orbMat, frostMat, GLOW, BEAST_SCALE, TIERS, wallTier, keepTier, portrait } from './models.js';
import { initAudio, setAudio, sfx, setMood } from './audio.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const SNAP_MS = 50;
const SAVE_KEY = 'castle-defense.save.v3', BEST_KEY = 'castle-defense.best.v3', PREFS_KEY = 'castle-defense.prefs';

// ---- Words ----
const MON = {
  runner: ['Runner', 'Runners', 'Fast and fragile.'],
  brute: ['Brute', 'Brutes', 'Slow and tough. Smashes walls.'],
  queen: ['The Queen', 'Queens', 'Boss. Huge and relentless.'],
  spitter: ['Spitter', 'Spitters', 'Stops short of the wall and spits acid at it.'],
  flyer: ['Gloomwing', 'Gloomwings', 'Flies over the walls. Spearmen cannot reach it.'],
  splitter: ['Broodsack', 'Broodsacks', 'Bursts into three runners when killed.'],
  shellback: ['Shellback', 'Shellbacks', 'Armoured: weak hits barely scratch it. Crossbows and poison pierce.'],
  behemoth: ['The Behemoth', 'Behemoths', 'Boss. An armoured colossus that flattens walls.'],
  broodmother: ['The Brood Mother', 'Brood Mothers', 'Boss. Keeps spawning runners until slain.'],
  skytyrant: ['The Sky Tyrant', 'Sky Tyrants', 'Boss. Flies straight for the keep.'],
};
const CHIPS = { ranged: 'Ranged', fly: 'Flying', split: 'Splits', armor: 'Armour', brood: 'Spawns', boss: 'Boss' };
const THEME_TXT = { swarm: 'Swarm', warband: 'Warband', siege: 'Siege', spitters: 'Acid rain', skyraid: 'Sky raid', brood: 'Brood', ironhide: 'Ironhide', horde: 'Horde' };
const UNIT_TXT = {
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
  shield: ['Shieldbearer', 'His wall (and its neighbours, less so) takes less damage.'],
  hexer: ['Hexer', 'Curses the toughest monster: it takes more damage from everyone.'],
};
const FAM_TXT = {
  marksmen: ['Marksmen', 'Marksmen get +10% range and +5% crit per tier.'],
  arcane: ['Arcane', 'Arcane casters deal +15% damage per tier; frost lasts longer.'],
  alchemy: ['Alchemy', 'Bigger blasts (+15%) and stronger burn and poison (+25%) per tier.'],
  faith: ['Faith', 'Healing and songs are 25% stronger per tier.'],
  wardens: ['Wardens', 'Walls and keep take 8% less damage per tier.'],
};
const TRAIT_TXT = {
  eagle: ['Eagle eye', '+20% range.'], quick: ['Quick hands', 'Attacks 25% faster.'], crit: ['Deadly', '+15% crit chance.'],
  greedy: ['Greedy', 'Extra gold for every kill.'], scholar: ['Scholar', 'Gains 75% more experience.'],
  slayer: ['Giant slayer', '+50% damage to brutes, armoured monsters and bosses.'], veteran: ['Veteran', 'Joined two levels higher.'],
};
const RAR_TXT = ['Common', 'Rare', 'Epic', 'Legendary'];
const STAT_TXT = {
  dmg: ['Damage', '%', 'Damage of every defender.'], aspd: ['Attack speed', '%', 'How fast every defender attacks.'],
  range: ['Range', '%', 'How far every defender reaches.'], crit: ['Crit chance', '%', 'Chance to hit for double damage.'],
  elem: ['Elemental', '%', 'Damage of mages, frost, storm, fire and poison.'], eng: ['Engineering', '%', 'Damage of turrets.'],
  wallhp: ['Wall HP', '%', 'Health of every wall segment.'], keephp: ['Keep HP', '', 'Health of the keep.'],
  regen: ['Wall regen', '', 'Wall HP mended per second in battle (grows with the walls).'], armor: ['Armour', '', 'Walls and keep take less damage.'],
  harvest: ['Harvesting', '', 'Gold after every wave. Grows 5% each wave.'], luck: ['Luck', '', 'Rarer rewards, items and recruits.'],
  xp: ['Experience', '%', 'Faster levels for the castle and defenders.'],
};
const ITEM_TXT = {
  whetstone: ['🪨', 'Whetstone'], fletching: ['🪶', 'Fine fletching'], wardrum: ['🥁', 'War drum'], horseshoe: ['🍀', 'Horseshoe'],
  ledger: ['📒', 'Merchant ledger'], lime: ['🧱', "Mason's lime"], tome: ['📘', 'Old tome'], kindling: ['🔥', 'Kindling'],
  toolbox: ['🧰', 'Toolbox'], banner: ['🚩', 'Banner'], heavybolts: ['🔩', 'Heavy bolts'], spyglass: ['🔭', 'Spyglass'],
  oil: ['🫕', 'Boiling oil', 'Monsters battering the walls lose 4% of their health each second.'],
  bounty: ['💰', 'Bounty board', '+25% gold for every kill.'],
  piggy: ['🐷', 'Piggy bank', 'After each wave, 10% interest on unspent gold.'],
  chimes: ['🎐', 'Wind chimes'], grimoire: ['📕', 'Grimoire'], cogs: ['⚙️', 'Clockwork cogs'], bells: ['🔔', 'Watch bells'],
  poster: ['📜', 'Recruiting poster', 'Every spoils offers one more choice.'],
  marksflag: ['🏹', 'Marksmen banner', 'Counts as one more Marksman for family bonuses.'],
  arcaneflag: ['🔮', 'Arcane banner', 'Counts as one more Arcane caster for family bonuses.'],
  alchemyflag: ['⚗️', 'Alchemy banner', 'Counts as one more Alchemist for family bonuses.'],
  faithflag: ['✨', 'Faith banner', 'Counts as one more of the Faith for family bonuses.'],
  wardenflag: ['🛡️', 'Warden banner', 'Counts as one more Warden for family bonuses.'],
  cursedbanner: ['☠️', 'Cursed banner'], hourglass: ['⏳', 'Hourglass', 'Monsters are 40% slower for the first 6 seconds of each wave.'],
  thorns: ['🌵', 'Thorned walls', 'Monsters hitting a wall lose 15% of their health.'],
  crown: ['👑', 'Gilded crown'], quiver: ['🎯', 'Endless quiver'],
  stormglass: ['⚡', 'Storm glass', 'Lightning jumps to 2 more monsters.'],
  bellows: ['🌬️', 'Bellows', 'Burn and poison are 50% stronger.'],
  midas: ['🪙', 'Midas touch', '10% of kills pay triple gold.'],
  dragonheart: ['❤️‍🔥', 'Dragon heart'], aegis: ['🛡', 'Aegis'], warhorn: ['📯', 'War horn'],
};
const TURRET_TXT = {
  bolt: ['Bolt thrower', 'Rapid bolts at the nearest monster.'], cannon: ['Cannon', 'Explosive shots.'],
  tesla: ['Tesla coil', 'Lightning that jumps between monsters.'], mortar: ['Mortar', 'Shells the thickest crowd from afar. Cannot hit flyers.'],
  ballista: ['Ballista', 'Huge piercing bolts at the toughest monster.'],
};
const LORD_TXT = {
  marshal: ['The Marshal', '🎖️', 'A steady start: three archers and a spearman.', '+8% damage, +4 armour'],
  archmage: ['The Archmage', '🔮', 'Starts with a mage and a frost mage.', '+30% elemental, −10% wall HP'],
  merchant: ['The Merchant', '💰', 'Three archers and a fat purse.', '+12 harvesting, +20 luck, +80 gold, −8% damage'],
  engineer: ['The Engineer', '⚙️', 'Starts with a bolt thrower and a cleric.', '+40% engineering, −5% attack speed'],
  saint: ['The Saint', '✨', 'A cleric and a priest keep the castle whole.', '+3 wall regen, +400 keep HP, −6% damage'],
};
const ABIL_TXT = {
  volley: ['🏹', 'Volley', 'Rain arrows on a spot you click.'],
  mend: ['🧱', 'Mend walls', 'Patch every wall and raise the ruins.'],
  rally: ['📣', 'Rally', 'Every defender attacks 50% faster for 6 s.'],
};
const DIFF_TXT = { relaxed: ['Relaxed', 'Weaker monsters, more gold. A gentle first castle.'], normal: ['Normal', 'The intended challenge.'], brutal: ['Brutal', 'Much tougher monsters and less gold. For veterans.'] };
const ICON = {
  dmg: '<svg class="ic" viewBox="0 0 16 16"><path fill="currentColor" d="M14 1.5h-3.2L4.4 7.9l-1.5-1.5-1.1 1.1 2 2-2.3 2.3 1.6 1.6L5.4 11l2 2 1.1-1.1-1.5-1.5 6.4-6.4V1.5z"/></svg>',
  spd: '<svg class="ic" viewBox="0 0 16 16"><circle cx="8" cy="9" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 9V5.8M8 9l2.2 1.4M6 1.5h4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>',
  rng: '<svg class="ic" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="2.8" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r=".9" fill="currentColor"/></svg>',
  heal: '<svg class="ic" viewBox="0 0 16 16"><path fill="currentColor" d="M6.3 1.5h3.4v4.8h4.8v3.4H9.7v4.8H6.3V9.7H1.5V6.3h4.8z"/></svg>',
  hp: '<svg class="ic" viewBox="0 0 16 16"><path fill="currentColor" d="M8 14.2S1.5 10.3 1.5 5.6A3.4 3.4 0 0 1 8 4a3.4 3.4 0 0 1 6.5 1.6c0 4.7-6.5 8.6-6.5 8.6z"/></svg>',
  kill: '<svg class="ic" viewBox="0 0 16 16"><path fill="currentColor" d="M8 1.5c-3.4 0-5.8 2.3-5.8 5.4 0 1.9.9 3.2 2.1 4v2.6h7.4v-2.6c1.2-.8 2.1-2.1 2.1-4 0-3.1-2.4-5.4-5.8-5.4zM5.6 8.9a1.4 1.4 0 1 1 0-2.8 1.4 1.4 0 0 1 0 2.8zm4.8 0a1.4 1.4 0 1 1 0-2.8 1.4 1.4 0 0 1 0 2.8z"/></svg>',
  lock: '<svg class="ic" viewBox="0 0 16 16"><rect x="3" y="7" width="10" height="7.5" rx="1.5" fill="currentColor"/><path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
};
const coin = '<i class="coin"></i>';
const fmt = (n) => (Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(Math.abs(n) >= 1e7 ? 0 : 1)}M` : Math.abs(n) >= 1e4 ? `${(n / 1e3).toFixed(Math.abs(n) >= 1e5 ? 0 : 1)}k` : String(Math.round(n)));
const sign = (v) => (v > 0 ? `+${fmt(v)}` : fmt(v));
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const lower = (t) => (t[1] && t[1] === t[1].toUpperCase() && t[1] !== ' ' ? t : t[0].toLowerCase() + t.slice(1)).replace(/^(\w+) (HP)$/, (_, a, b) => `${a.toLowerCase()} ${b}`);
const statLine = (k, v) => `${sign(v)}${STAT_TXT[k][1]} ${lower(STAT_TXT[k][0])}`;
const statTip = (keys) => keys.map((k) => `<b>${STAT_TXT[k][0]}</b>: ${STAT_TXT[k][2]}`).join('<br>');

// ---- Renderer, scene and light ----
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8db8dc);
scene.fog = new THREE.FogExp2(0x8db8dc, 0.0045);
const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 1, 700);
const hemi = new THREE.HemisphereLight(0xcfe4ff, 0x4a5a30, 1.2);
const sun = new THREE.DirectionalLight(0xfff1d6, 6.5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 280 });
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.05;
scene.add(hemi, sun, sun.target);

// Lighting follows the phase: day while preparing, dusk during a wave, night when the castle falls.
const LOOKS = {
  prep: { sky: 0x8db8dc, fog: 0.0045, hs: 0xcfe4ff, hg: 0x4a5a30, hi: 1.2, sc: 0xfff1d6, si: 6.5, sp: [40, 60, 25], win: 0.1, tor: 0 },
  wave: { sky: 0xd0906a, fog: 0.007, hs: 0xffd2b0, hg: 0x4a4638, hi: 1.5, sc: 0xff9550, si: 6, sp: [62, 28, 18], win: 1, tor: 45 },
  over: { sky: 0x0b1424, fog: 0.012, hs: 0x4a6aa8, hg: 0x101820, hi: 0.7, sc: 0x8fb0ff, si: 1.9, sp: [-30, 50, 30], win: 2.2, tor: 90 },
};
LOOKS.reward = LOOKS.prep;
LOOKS.menu = { ...LOOKS.prep, sky: 0xe0a77c, hs: 0xffe0c0, sc: 0xffc58a, si: 5.5, sp: [70, 30, 40], win: 0.8, tor: 20 };
LOOKS.won = { ...LOOKS.prep, sky: 0xf2c98a, hs: 0xfff0d0, sc: 0xffd28a, si: 7, sp: [50, 45, 30], win: 1.2, tor: 30 };
const look = { ...LOOKS.menu, sky: new THREE.Color(LOOKS.menu.sky), hs: new THREE.Color(LOOKS.menu.hs), hg: new THREE.Color(LOOKS.menu.hg), sc: new THREE.Color(LOOKS.menu.sc), sp: new THREE.Vector3(...LOOKS.menu.sp) };
const tmpC = new THREE.Color(), tmpV = new THREE.Vector3();
function updateLook(target, k) {
  for (const key of ['sky', 'hs', 'hg', 'sc']) look[key].lerp(tmpC.set(target[key]), k);
  for (const key of ['fog', 'hi', 'si', 'win', 'tor']) look[key] += (target[key] - look[key]) * k;
  look.sp.lerp(tmpV.set(...target.sp), k);
  scene.background.copy(look.sky); scene.fog.color.copy(look.sky); scene.fog.density = look.fog;
  hemi.color.copy(look.hs); hemi.groundColor.copy(look.hg); hemi.intensity = look.hi;
  sun.color.copy(look.sc); sun.intensity = look.si;
  winMat.emissiveIntensity = look.win;
  if (world) for (const l of world.torches) l.intensity = look.tor;
}

let ws = null, joined = false, world = null, layout = null, snap = null, snapAt = 0;
const enemies = new Map(), projs = new Map(), units = new Map(), turrets = new Map(), clouds = new Map(), fxs = [];
let FLY = [], BOSS = [];

function setLayout(l) {
  layout = l;
  FLY = l.enemies.map((e) => !!e.fly);
  BOSS = l.enemies.map((e) => !!e.boss);
  if (!world) world = buildWorld(scene, l);
}
fetch('/layout.json').then((r) => r.json()).then((l) => { setLayout(l); renderMenu(); }).catch(() => {});

// ---- Local records, preferences and the saved run ----
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};
const prefs = { diff: 'normal', lord: 'marshal', sfx: true, music: true, tips: true, seen: [], ...(store.get(PREFS_KEY) || {}) };
if (!DIFF_TXT[prefs.diff]) prefs.diff = 'normal';
if (!LORD_TXT[prefs.lord]) prefs.lord = 'marshal';
function renderMenu() {
  $('diff').innerHTML = Object.entries(DIFF_TXT).map(([k, [name]]) => `<button data-diff="${k}" class="${k === prefs.diff ? 'on' : ''}">${name}</button>`).join('');
  $('diffTxt').textContent = DIFF_TXT[prefs.diff][1];
  $('lords').innerHTML = Object.entries(LORD_TXT).map(([k, [name, icon, desc, mods]]) => {
    const tip = layout ? statTip(Object.keys(layout.lords[k].mods)) : '';
    return `<button data-lord="${k}" class="lord ${k === prefs.lord ? 'on' : ''}" ${tip ? `data-tip="${esc(tip)}"` : ''}><span class="li">${icon}</span><b>${name}</b><span>${desc}</span><em>${mods}</em></button>`;
  }).join('');
  const save = store.get(SAVE_KEY);
  $('playCont').hidden = !save;
  if (save) $('contTxt').textContent = `Wave ${save.wave + 1} next · ${LORD_TXT[save.lord]?.[0] || ''} · ${DIFF_TXT[save.diff]?.[0] || ''}`;
  const best = store.get(BEST_KEY) || {};
  const rec = Object.keys(DIFF_TXT).filter((k) => best[k]).map((k) => `${DIFF_TXT[k][0]}: wave <b>${best[k].wave}</b>${best[k].wins ? ` · ${plural(best[k].wins, 'victory', 'victories')}` : ''}`);
  $('records').innerHTML = rec.length ? `Best runs · ${rec.join(' · ')}` : '';
}
$('diff').onclick = (e) => { const b = e.target.closest('button'); if (b) { prefs.diff = b.dataset.diff; store.set(PREFS_KEY, prefs); renderMenu(); } };
$('lords').onclick = (e) => { const b = e.target.closest('button'); if (b) { prefs.lord = b.dataset.lord; store.set(PREFS_KEY, prefs); renderMenu(); } };
renderMenu();

// ---- Connection ----
function connect(save) {
  $('ovErr').textContent = '';
  if (ws) ws.close();
  const sock = ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);
  sock.onopen = () => send({ t: 'join', mode: 'solo', diff: save ? save.diff : prefs.diff, lord: save ? save.lord : prefs.lord, save });
  sock.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.t === 'hello') {
      joined = true;
      setLayout(m.layout);
      $('overlay').hidden = true;
      for (const id of ['status', 'help', 'speed']) $(id).hidden = false;
      focus.set(0, 0, 4); zoom = 1;
    } else if (m.t === 's' && world) onSnap(m);
    else if (m.t === 'save') store.set(SAVE_KEY, m.d);
    else if (m.t === 'err') {
      if (m.why === 'badsave') { store.set(SAVE_KEY, null); toast('Save could not be loaded', 'Starting a fresh run instead'); }
      else $('ovErr').textContent = m.why === 'busy' ? 'The server is full. Try again later.' : 'Could not start the game.';
    }
  };
  sock.onclose = () => {
    if (sock !== ws || !joined) return;
    $('ovTitle').textContent = 'Connection lost';
    $('ovText').textContent = 'Reload the page to continue. Your run is saved after every wave.';
    $('menuBody').hidden = true; $('overlay').hidden = false;
  };
}
const send = (m) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };
const startAudio = () => initAudio({ sfx: prefs.sfx, music: prefs.music });
$('playCont').onclick = () => { startAudio(); connect(store.get(SAVE_KEY)); };
$('playNew').onclick = () => { startAudio(); if (!store.get(SAVE_KEY) || confirm('Start a new run? Your saved run will be replaced.')) { store.set(SAVE_KEY, null); connect(null); } };

let toastTimer = 0;
function toast(text, small = '', ms = 1800) {
  $('toast').innerHTML = `${esc(text)}${small ? `<small>${esc(small)}</small>` : ''}`; $('toast').style.opacity = 1;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').style.opacity = 0; }, ms);
}

// Remember where an entity was drawn, so the next snapshot is blended in without a jump.
function track(o, x, z) { o.px = o.rx ?? x; o.pz = o.rz ?? z; o.cx = x; o.cz = z; }
function place(o, a) { o.rx = o.px + (o.cx - o.px) * a; o.rz = o.pz + (o.cz - o.pz) * a; }
function lerpAngle(a, b, k) { const d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + d * Math.min(1, k); }

const barMat = new THREE.SpriteMaterial({ color: 0xe5484d, depthTest: false });
const arrowGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.2, 5).rotateX(Math.PI / 2);
const arrowMat = new THREE.MeshStandardMaterial({ color: 0xd8c9a0, roughness: 0.6 });
const orbGeo = new THREE.SphereGeometry(0.3, 12, 10);
const shardGeo = new THREE.OctahedronGeometry(0.32, 0);
const fireMat2 = new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0xff5a00, emissiveIntensity: 2.4 });
const flaskMat = new THREE.MeshStandardMaterial({ color: 0x7dff5a, emissive: 0x3aaa2a, emissiveIntensity: 1.2 });
const bombMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
const puffGeo = new THREE.SphereGeometry(1, 14, 10);
const haloGeo = new THREE.TorusGeometry(1, 0.07, 6, 28).rotateX(Math.PI / 2);
const ringGeo = new THREE.TorusGeometry(0.8, 0.08, 6, 20).rotateX(Math.PI / 2);
const STATUS_MATS = [0xaee8ff, 0xff8a3a, 0xc06bff].map((c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.8 }));
const cloudGeo = new THREE.CylinderGeometry(1, 1, 0.5, 24, 1, true);
const cloudMat = new THREE.MeshBasicMaterial({ color: 0x7dff5a, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
const RAR_HEX = [0xdde3ea, 0x4ea8ff, 0xb46bff, 0xffc340];
const PROJ = { 1: [orbGeo, orbMat], 3: [shardGeo, frostMat], 5: [orbGeo, fireMat2], 6: [orbGeo, flaskMat], 7: [orbGeo, bombMat] };

// The range ring shown when a defender is hovered in the army panel.
const rangeRing = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd75a, transparent: true, opacity: 0.6, depthWrite: false }));
rangeRing.visible = false;
scene.add(rangeRing);
// The target ring while aiming a volley.
const aimRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff5a3a, transparent: true, opacity: 0.85, depthWrite: false }));
aimRing.visible = false;
scene.add(aimRing);

// ---- Juice: sounds per effect, floating damage numbers, camera shake ----
const FX_SOUND = { 0: 'kill', 3: 'ice', 5: 'thump', 7: 'hit', 8: 'chime', 9: 'up', 10: 'spit', 12: 'zap', 17: 'spit', 18: 'fire', 19: 'volley', 20: 'mend', 21: 'rally' };
const nums = [], projV = new THREE.Vector3();
function damageNumber(x, z, v, crit) {
  if (nums.length > 45) nums.shift().el.remove();
  const el = document.createElement('div');
  el.className = crit ? 'dn crit' : 'dn';
  el.textContent = `${fmt(v)}${crit ? '!' : ''}`;
  $('dmg').appendChild(el);
  nums.push({ el, x: x + (Math.random() - 0.5) * 0.8, z, t: 0 });
}
function updateNumbers(dt) {
  for (let i = nums.length - 1; i >= 0; i--) {
    const n = nums[i];
    n.t += dt;
    if (n.t > 0.8) { n.el.remove(); nums.splice(i, 1); continue; }
    projV.set(n.x, 3 + n.t * 2.2, n.z).project(camera);
    if (projV.z > 1) { n.el.style.opacity = 0; continue; }
    n.el.style.transform = `translate(${(projV.x * 0.5 + 0.5) * innerWidth}px,${(-projV.y * 0.5 + 0.5) * innerHeight}px) translate(-50%,-50%) scale(${n.t < 0.1 ? 0.6 + n.t * 4 : 1})`;
    n.el.style.opacity = String(1 - (n.t / 0.8) ** 2);
  }
}
let shakeAmt = 0;
function shake(a) { shakeAmt = Math.min(1.5, Math.max(shakeAmt, a)); }

// ---- Tips for the first runs: one at a time, each shown once ----
const TIPS = [
  ['start', (m) => m.ph === 'prep' && m.wave === 0, 'Pick one of the two waves at the bottom to begin. The harder wave pays double gold and better spoils, but it is a gamble.'],
  ['battle', (m) => m.ph === 'wave' && m.wave <= 2, 'Your defenders fight on their own. Help them: press <b>1</b> and click the ground for a Volley, <b>2</b> mends the walls, <b>3</b> rallies everyone. <b>Space</b> pauses; the buttons at the top speed things up.'],
  ['level', (m) => m.ph === 'reward' && m.pick?.type === 'level', 'Castle level up! Kills give the castle experience. Each level lets you pick one upgrade for the whole castle.'],
  ['spoils', (m) => m.ph === 'reward' && m.pick?.type === 'spoils', 'Spoils of the wave: take a new defender, an item, a turret or a blessing. Defenders cannot be bought; they only come from here.'],
  ['shop', (m) => m.ph === 'prep' && m.wave >= 1, 'Spend gold in the <b>Shop</b> on the right. The lock keeps an offer for later. The <b>Castle</b> tab upgrades the keep and walls; the <b>Stats</b> tab explains every number.'],
  ['family', (m) => m.ph === 'prep' && m.fam && m.fam[1].some((t) => t > 0), 'Family bonus! Two defenders of the same family make that family stronger, four and six even more. See the <b>Army</b> tab.'],
  ['boss', (m) => m.ph === 'prep' && (m.wave + 1) % 10 === 0, 'A boss attacks next wave. Repair and upgrade your walls before you start it.'],
  ['full', (m) => m.ph === 'prep' && m.un.length >= m.cap, 'The walls are full. Upgrade the walls in the <b>Castle</b> tab to make room; until then new defenders come as promotions.'],
];
let tipNow = null;
const savePrefs = () => store.set(PREFS_KEY, prefs);
function markSeen(id) { if (!prefs.seen.includes(id)) { prefs.seen.push(id); savePrefs(); } }
function updateTips(m) {
  if (!prefs.tips) { $('advice').hidden = true; return; }
  if (tipNow && TIPS.find((t) => t[0] === tipNow)[1](m)) return;
  if (tipNow) { markSeen(tipNow); tipNow = null; }
  const t = TIPS.find(([id, when]) => !prefs.seen.includes(id) && when(m));
  $('advice').hidden = !t;
  if (!t) return;
  tipNow = t[0];
  $('advice').innerHTML = `<span class="ai">💡</span><div>${t[2]}</div><button class="btn" data-ok>Got it</button><button class="btn alt" data-off>No tips</button>`;
}
$('advice').onclick = (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.off !== undefined) { prefs.tips = false; savePrefs(); }
  else if (tipNow) markSeen(tipNow);
  tipNow = null; $('advice').hidden = true;
};

function slotPos(slot, m) {
  const [x, z, seg] = layout.slots[slot];
  return [x, seg < 0 ? world.towerTop : world.wallH * (0.55 + 0.45 * (m.sg[seg] / 100)), z, seg];
}

function onSnap(m) {
  const prev = snap;
  snap = m; snapAt = performance.now();
  const [bHall, bWalls] = m.b;

  const tier = wallTier(bWalls);
  if (world.setWallTier(tier) && prev) toast(TIERS[tier].name, 'The walls have been rebuilt', 2600);
  world.setKeepTier(keepTier(bHall));
  m.sg.forEach((v, i) => { const g = world.segs[i]; g.visible = v > 0; g.scale.y = 0.55 + 0.45 * (v / 100); });
  if (prev && m.ph === 'wave') {
    if (m.sg.some((v, i) => v === 0 && prev.sg[i] > 0)) { sfx('crumble'); shake(0.9); }
    if (m.th[0] < prev.th[0] - prev.th[1] * 0.004) { sfx('keep'); shake(0.35); }
  }
  world.hall.scale.set(1 + 0.012 * (bHall - 1), 1 + 0.03 * (bHall - 1), 1 + 0.012 * (bHall - 1));

  // Defenders stand on their slot: a tower top or a wall segment.
  const seen = new Set();
  for (const [uid, slot, ki, rar] of m.un) {
    seen.add(uid);
    const k = layout.units[ki];
    let o = units.get(uid);
    if (!o || o.rar !== rar) {
      if (o) scene.remove(o.m);
      const [x, , z] = slotPos(slot, m);
      o = { k, rar, x, z, m: makeUnit(k, rar), rot: o ? o.rot : Math.atan2(x, z) };
      scene.add(o.m);
      units.set(uid, o);
    }
    const [x, y, z, seg] = slotPos(slot, m);
    o.x = x; o.z = z; o.slot = slot;
    o.m.visible = seg < 0 || m.sg[seg] > 0;
    o.m.position.set(x, y, z);
  }
  for (const [uid, o] of units) if (!seen.has(uid)) { scene.remove(o.m); units.delete(uid); }

  // Turrets on their courtyard spots, a little bigger with each level.
  seen.clear();
  for (const [ki, spot, lv] of m.tu) {
    seen.add(spot);
    let o = turrets.get(spot);
    if (!o || o.ki !== ki) {
      if (o) scene.remove(o.g);
      o = { ki, g: makeTurret(layout.turrets ? Object.keys(layout.turrets)[ki] : 'bolt') };
      const [x, z] = layout.turretSpots[spot];
      o.g.position.set(x, 0, z);
      o.g.rotation.y = Math.atan2(x, z);
      scene.add(o.g);
      turrets.set(spot, o);
    }
    o.g.scale.setScalar(Math.min(1.5, 1 + 0.06 * (lv - 1)));
  }
  for (const [spot, o] of turrets) if (!seen.has(spot)) { scene.remove(o.g); turrets.delete(spot); }

  seen.clear();
  let boss = null;
  for (const [id, t, x, z, hp, flags] of m.en) {
    seen.add(id);
    let o = enemies.get(id);
    if (!o) {
      o = { id, t, rot: Math.atan2(-x, -z), rings: [], hitT: 0, ...makeBeast(t) };
      o.base = o.g.scale.x;
      if (BOSS[t]) { sfx('roar'); shake(1.2); }
      scene.add(o.g);
      enemies.set(id, o);
    }
    if (o.hp !== undefined && hp < o.hp) o.hitT = 0.12;
    o.hp = hp;
    if (BOSS[t]) { if (!boss || hp > boss.hp) boss = { t, hp }; }
    else if (hp < 100 && !o.bar) { o.bar = new THREE.Sprite(barMat); scene.add(o.bar); }
    // Status rings: slowed, burning, cursed.
    for (let b = 0; b < 3; b++) {
      const on = !!(flags & (1 << b));
      if (on && !o.rings[b]) { o.rings[b] = new THREE.Mesh(ringGeo, STATUS_MATS[b]); o.rings[b].position.y = 0.15 + b * 0.18; o.g.add(o.rings[b]); }
      else if (!on && o.rings[b]) { o.g.remove(o.rings[b]); o.rings[b] = null; }
    }
    track(o, x, z);
  }
  for (const [id, o] of enemies) if (!seen.has(id)) { scene.remove(o.g); if (o.bar) scene.remove(o.bar); enemies.delete(id); }

  seen.clear();
  for (const [id, kind, x, z, ang] of m.pr) {
    seen.add(id);
    let o = projs.get(id);
    if (!o) {
      const [geo, mat] = PROJ[kind] || [arrowGeo, arrowMat];
      o = { m: new THREE.Mesh(geo, mat), y: kind === 4 ? 4.5 : 4, kind };
      sfx(kind === 7 || kind === 5 ? 'thump' : 'shoot');
      o.m.rotation.y = ang;
      if (kind === 4) o.m.scale.setScalar(2.2);
      if (kind === 7) o.m.scale.setScalar(1.4);
      scene.add(o.m);
      projs.set(id, o);
    }
    track(o, x, z);
  }
  for (const [id, o] of projs) if (!seen.has(id)) { scene.remove(o.m); projs.delete(id); }

  seen.clear();
  for (const [id, x, z, r] of m.cl) {
    seen.add(id);
    if (!clouds.has(id)) { const c = new THREE.Mesh(cloudGeo, cloudMat); c.position.set(x, 0.25, z); c.scale.set(r, 1, r); scene.add(c); clouds.set(id, c); }
  }
  for (const [id, c] of clouds) if (!seen.has(id)) { scene.remove(c); clouds.delete(id); }

  for (const f of m.fx) {
    const [kind, x, z, v] = f;
    const s2 = FX_SOUND[kind];
    if (s2) sfx(s2);
    if (kind === 1 && v >= 3.4) shake(0.25);
    if (kind === 22) { damageNumber(x, z, v, f[4]); if (f[4]) sfx('crit'); continue; }
    if (kind === 0) addFx(puffGeo, GLOW[v], x, 0.8 * BEAST_SCALE[v] + (FLY[v] ? 5 : 0), z, BEAST_SCALE[v] * 1.3, 0.35);
    else if (kind === 1) addFx(puffGeo, 0x6fdcff, x, 1, z, v, 0.3);
    else if (kind === 3) addFx(puffGeo, 0xdff6ff, x, 1, z, v, 0.45);
    else if (kind === 4) toast(`${v === 'hall' ? 'Keep' : 'Walls'} upgraded`);
    else if (kind === 5) { const [sx, sz] = layout.turretSpots[v] || [0, 0]; addFx(orbGeo, 0x222222, sx, 2, sz, 1.6, 1.1, 0, [x, z], 14); }
    else if (kind === 7) addFx(puffGeo, 0xffffff, x, 1, z, 0.7, 0.15);
    else if (kind === 8) addFx(haloGeo, RAR_HEX[v], x, world.wallH + 0.2, z, 1.3, 0.9, 3);
    else if (kind === 9) addFx(haloGeo, 0x8fd0ff, x, world.wallH + 0.4, z, 0.9, 0.7, 4);
    else if (kind === 10) addFx(orbGeo, 0x9dff3a, x, 1.2, z, 0.8, 0.6, 0, v >= 0 ? [layout.segs[v].x, layout.segs[v].z] : [0, 0], 3);
    else if (kind === 11) addFx(haloGeo, 0x9dffb0, x, world.wallH * 0.6, z, 1.4, 0.6, 2);
    else if (kind === 12) addBolt(f[1], f[2], f[3], f[4]);
    else if (kind === 13) addFx(puffGeo, 0xb04bff, x, 1.5, z, 1, 0.4);
    else if (kind === 14) addFx(haloGeo, 0xffe08a, 0, 6, 0, 4.5, 0.8, 2);
    else if (kind === 15) toast(`Castle level ${v}`, 'A new upgrade waits after the wave', 1500);
    else if (kind === 17) addFx(puffGeo, 0x7dff5a, x, 0.6, z, v, 0.4);
    else if (kind === 18) addFx(puffGeo, 0xff8a3a, x, 1, z, v, 0.35);
    else if (kind === 19) addFx(haloGeo, 0xff5a3a, x, 0.3, z, v, 0.8);
    else if (kind === 20) { toast('Walls mended'); for (const s of layout.segs) addFx(haloGeo, 0x9dffb0, s.x, world.wallH * 0.6, s.z, 1.2, 0.6, 2); }
    else if (kind === 21) toast('Rally!', 'Every defender attacks faster');
  }
  if (prev && prev.ph !== m.ph) { setMood(m.ph); if (m.ph === 'reward' && m.pick) sfx(m.pick.type === 'level' ? 'level' : m.pick.type === 'victory' ? 'victory' : 'chime'); }
  if (prev && prev.ph !== m.ph && m.ph === 'wave') {
    sfx('horn');
    const bt = m.wave % 10 === 0 ? layout.enemies[layout.bosses[(m.wave / 10 - 1) % layout.bosses.length]].key : null;
    toast(`Wave ${m.wave}${m.wave === layout.finalWave ? ' · the final battle' : ''}`, bt ? `${MON[bt][0]} is coming` : '');
  }
  if (prev && prev.ph === 'wave' && m.ph !== 'wave' && m.ph !== 'over') { toast(`Wave ${m.wave} cleared`, m.gold > prev.gold ? `+${fmt(m.gold - prev.gold)} gold` : ''); sfx('coin'); }
  else if (prev && prev.ph === 'reward' && m.ph === 'reward' && prev.pick && m.pick && JSON.stringify(prev.pick.opts) !== JSON.stringify(m.pick.opts) && prev.pick.type !== m.pick.type) sfx(m.pick.type === 'level' ? 'level' : 'chime');
  if (prev && prev.ph !== 'over' && m.ph === 'over') { recordRun(m); sfx(m.victory ? 'victory' : 'defeat'); }
  if (prev && m.gold < prev.gold && m.ph === 'prep') sfx('coin');
  if (m.ph !== 'wave') setAiming(false);
  updateHud(m, boss);
  updateTips(m);
}

let newRecord = false;
function recordRun(m) {
  const best = store.get(BEST_KEY) || {}, b = best[m.diff] || { wave: 0, wins: 0 };
  newRecord = m.reached > b.wave;
  best[m.diff] = { wave: Math.max(b.wave, m.reached), wins: b.wins + (m.victory ? 1 : 0) };
  store.set(BEST_KEY, best);
}

function addFx(geo, color, x, y, z, size, dur, rise = 0, to = null, arc = 0) {
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false }));
  m.position.set(x, y, z);
  if (to) { m.material.opacity = 1; m.scale.setScalar(size * (geo === orbGeo ? 1 : 0.3)); }
  scene.add(m);
  fxs.push({ m, t: 0, dur, size, rise, to, from: [x, z], y0: y, arc });
}

// A short-lived jagged line of lightning.
function addBolt(x1, z1, x2, z2) {
  const pts = [];
  for (let i = 0; i <= 6; i++) {
    const k = i / 6, j = i === 0 || i === 6 ? 0 : 0.5;
    pts.push(new THREE.Vector3(x1 + (x2 - x1) * k + (Math.random() - 0.5) * j, 3 + Math.sin(k * Math.PI) * 1.2 + (Math.random() - 0.5) * j, z1 + (z2 - z1) * k + (Math.random() - 0.5) * j));
  }
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xbfe8ff, transparent: true }));
  scene.add(line);
  fxs.push({ m: line, t: 0, dur: 0.18, line: true });
}

// ---- HUD ----
const pct = (a, b) => `${Math.max(0, Math.min(100, (a / b) * 100))}%`;
function nextBoss(m) {
  const n = m.wave + (m.ph === 'wave' ? 0 : 1), at = Math.ceil(n / 10) * 10;
  return { at, key: layout.enemies[layout.bosses[(at / 10 - 1) % layout.bosses.length]].key };
}
function updateHud(m, boss) {
  const final = layout.finalWave;
  if (m.ph === 'prep') {
    $('phase').textContent = `Wave ${m.wave + 1}${m.endless ? ' · endless' : ` of ${final}`}`;
    $('sub').textContent = m.wave ? 'Prepare as long as you like' : 'Choose a wave to begin';
  } else if (m.ph === 'reward') {
    $('phase').textContent = `Wave ${m.wave} cleared`;
    $('sub').textContent = 'Choose your rewards';
  } else if (m.ph === 'wave') {
    $('phase').textContent = `Wave ${m.wave}${m.endless ? ' · endless' : ` of ${final}`}`;
    $('sub').textContent = `${plural(m.left, 'monster', 'monsters')} left`;
  } else {
    $('phase').textContent = m.victory ? 'Victory' : 'The castle has fallen';
    $('sub').textContent = `Reached wave ${m.reached}`;
  }
  $('boss').hidden = !boss;
  if (boss) { $('bossBar').style.width = `${boss.hp}%`; $('bossTxt').textContent = `${boss.hp}%`; $('bossName').textContent = MON[layout.enemies[boss.t].key][0]; }
  $('thBar').style.width = pct(m.th[0], m.th[1]);
  $('thTxt').textContent = `${fmt(m.th[0])} / ${fmt(m.th[1])}`;
  $('lvTxt').textContent = `Lv ${m.lv[0]}`;
  $('lvBar').style.width = `${m.lv[1]}%`;
  $('goldTxt').innerHTML = `${coin}${fmt(m.gold)}`;
  $('army').textContent = `${m.un.length} / ${m.cap}`;
  $('wallName').textContent = `${TIERS[wallTier(m.b[1])].name} · Lv ${m.b[1]}`;
  $('lordName').textContent = `${LORD_TXT[m.lord][0]} · ${DIFF_TXT[m.diff][0]}`;
  const nb = nextBoss(m);
  $('bossNext').textContent = m.ph === 'over' ? '' : nb.at === m.wave + 1 && m.ph !== 'wave' ? `${MON[nb.key][0]} attacks next wave!` : `${MON[nb.key][0]} on wave ${nb.at}`;
  for (const b of $('speed').children) b.classList.toggle('on', Number(b.dataset.spd) === m.spd);
  renderAbilities(m);
  renderWaves(m);
  renderShop(m);
  renderModal(m);
}

// ---- Abilities during a wave ----
let aiming = false;
function setAiming(on) { aiming = on; aimRing.visible = on; document.body.style.cursor = on ? 'crosshair' : ''; }
let abilSig = '';
function renderAbilities(m) {
  const show = m.ph === 'wave';
  const sig = JSON.stringify([show, m.ab, aiming, m.ral]);
  if (sig === abilSig) return;
  abilSig = sig;
  $('abilities').hidden = !show;
  if (!show) return;
  $('abilities').innerHTML = layout && Object.keys(layout.abilities).map((k, i) => {
    const cd = m.ab[i], [icon, name, desc] = ABIL_TXT[k];
    return `<button class="abil ${aiming && k === 'volley' ? 'aim' : ''}" data-abil="${k}" ${cd ? 'disabled' : ''} data-tip="${esc(`<b>${name}</b><br>${desc}`)}"><span class="ai">${icon}</span><span class="an">${name}</span>${cd ? `<span class="acd">${cd}</span>` : ''}<span class="kbd">${i + 1}</span></button>`;
  }).join('');
}
function useAbility(k) {
  if (!snap || snap.ph !== 'wave') return;
  const i = Object.keys(layout.abilities).indexOf(k);
  if (snap.ab[i]) return;
  if (k === 'volley') { setAiming(!aiming); abilSig = ''; renderAbilities(snap); return; }
  send({ t: 'ability', k });
}
$('abilities').onclick = (e) => { const b = e.target.closest('button'); if (b && !b.disabled) useAbility(b.dataset.abil); };
const ray = new THREE.Raycaster(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), mouse = new THREE.Vector2(), hit = new THREE.Vector3();
function groundAt(e) {
  mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(mouse, camera);
  return ray.ray.intersectPlane(ground, hit);
}
renderer.domElement.addEventListener('mousemove', (e) => { if (aiming && groundAt(e)) { aimRing.position.set(hit.x, 0.3, hit.z); aimRing.scale.setScalar(layout.abilities.volley.r); } });
renderer.domElement.addEventListener('click', (e) => {
  if (!aiming || !groundAt(e)) return;
  send({ t: 'ability', k: 'volley', x: Math.round(hit.x * 10) / 10, z: Math.round(hit.z * 10) / 10 });
  setAiming(false); abilSig = '';
});
renderer.domElement.addEventListener('contextmenu', (e) => { if (aiming) { e.preventDefault(); setAiming(false); abilSig = ''; } });

function renderSound() { for (const b of $('speed').querySelectorAll('[data-snd]')) b.classList.toggle('off', !prefs[b.dataset.snd]); }
$('speed').onclick = (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.snd) { prefs[b.dataset.snd] = !prefs[b.dataset.snd]; setAudio(b.dataset.snd, prefs[b.dataset.snd]); savePrefs(); renderSound(); return; }
  send({ t: 'speed', v: Number(b.dataset.spd) });
};
renderSound();
// A soft click for every button.
document.addEventListener('click', (e) => { if (e.target.closest?.('.btn, .choice, .wcard, .lord, #tabs button, #speed button, .abil')) sfx('click'); }, true);

// ---- Wave choice ----
const monStats = (m, t) => {
  const e = layout.enemies[t], ns = m.ns ? m.ns[t] : [e.hp, e.dmg];
  const chips = Object.keys(CHIPS).filter((k) => e[k]).map((k) => `<span class="chip ${k === 'boss' ? 'boss' : ''}">${CHIPS[k]}</span>`).join('');
  return { e, ns, chips };
};
let wavesSig = '';
function renderWaves(m) {
  const sig = JSON.stringify([m.ph, m.wv, m.wave, !!m.ns]);
  if (sig === wavesSig) return;
  wavesSig = sig;
  const show = m.ph === 'prep' && m.wv.length === 2;
  $('waves').hidden = !show;
  if (!show) return;
  $('waves').innerHTML = `<h3>Wave ${m.wave + 1} · choose what you face</h3><div class="cards">${m.wv.map((w, i) => {
    const mons = w.c.map((n, t) => {
      if (!n) return '';
      const { e, ns, chips } = monStats(m, t), hx = BOSS[t] ? 1 : w.hx;
      return `<div class="mon" data-mon="${t}"><img src="${portrait('beast', t)}" alt=""><div><b>${n}</b> ${n === 1 ? MON[e.key][0] : MON[e.key][1]}${chips}<div class="ms">${ICON.hp}${fmt(ns[0] * hx)} &nbsp;${ICON.dmg}${fmt(ns[1] * hx)}</div></div></div>`;
    }).join('');
    return `<button class="wcard ${w.hard ? 'hard' : ''}" data-wave="${i}"><div class="hd"><span class="th">${THEME_TXT[w.th] || ''}</span><span class="tag">${w.hard ? 'Harder · ×2 gold · better spoils' : 'Standard'}</span></div>${mons}${w.hx > 1 ? `<div class="ms" style="color:#ffb0b3">Elite pack: fewer, tougher monsters (×${w.hx})</div>` : ''}<div class="gold">${coin}${fmt(w.gold)} reward <span class="kbd" style="float:right">${i + 1}</span></div></button>`;
  }).join('')}</div>`;
}
$('waves').onclick = (e) => { const b = e.target.closest('button'); if (b) send({ t: 'wave', i: Number(b.dataset.wave) }); };

// ---- Cards shared by the shop and the rewards ----
const rc = (r) => `--rc:var(--r${r})`;
const traitChips = (ts) => ts.map((t) => { const k = typeof t === 'number' ? layout.traits[t] : t; return `<span class="trait" data-tip="${esc(`<b>${TRAIT_TXT[k][0]}</b><br>${TRAIT_TXT[k][1]}`)}">${TRAIT_TXT[k][0]}</span>`; }).join('');
function itemDesc(key) {
  const d = layout.items[key], parts = Object.entries(d.mods || {}).map(([s, v]) => statLine(s, v));
  if (ITEM_TXT[key][2]) parts.push(ITEM_TXT[key][2]);
  return parts.join(', ') + (d.unique ? ' (one per run)' : '');
}
function unitStatsHtml(k, p, cd, range) {
  const d = layout.unitStats[k];
  if (d.aura) return `<div class="stats one"><span><small>Song</small>+${Math.round(p * 100)}% attack speed nearby</span></div>`;
  if (d.guard) return `<div class="stats one"><span><small>Guard</small>−${Math.round(Math.min(0.7, p) * 100)}% damage to his wall</span></div>`;
  if (d.curse) return `<div class="stats one"><span><small>Curse</small>+${Math.round(Math.min(1, p) * 100)}% damage taken</span></div>`;
  return `<div class="stats"><span><small>${d.heal ? 'Heal' : 'Damage'}</small>${d.heal ? ICON.heal : ICON.dmg}${fmt(p)}</span><span><small>Reload</small>${ICON.spd}${cd.toFixed(1)}s</span><span><small>Range</small>${ICON.rng}${d.heal === 'keep' ? '∞' : Math.round(range)}</span></div>`;
}
function recruitCard(c, footer) {
  const fam = layout.unitStats[c.k].fam;
  return `<div class="card r${c.rar}" style="${rc(c.rar)}"><div class="top"><img class="pic" src="${portrait('unit', c.k, c.rar)}" alt=""><div><span class="rar">${RAR_TXT[c.rar]} · new defender</span><div class="nm">${esc(c.name)}</div><div class="cl"><span class="lv">${c.lv}</span>${UNIT_TXT[c.k][0]} <span class="fam fam-${fam}">${FAM_TXT[fam][0]}</span></div></div></div>${unitStatsHtml(c.k, c.p * (1 + 0.12 * (c.lv - 1)), c.cd, c.range)}<div class="traits">${traitChips(c.traits)}</div><div class="desc">${UNIT_TXT[c.k][1]}</div>${footer}</div>`;
}
function optionCard(o, footer) {
  if (o.type === 'recruit') return recruitCard(o.card, footer);
  if (o.type === 'promote') {
    const up = o.rar < 3 ? `${RAR_TXT[o.rar]} → <b>${RAR_TXT[o.rar + 1]}</b>` : '+3 levels';
    return `<div class="card r${Math.min(3, o.rar + 1)}" style="${rc(Math.min(3, o.rar + 1))}"><div class="top"><img class="pic" src="${portrait('unit', o.k, o.rar)}" alt=""><div><span class="rar">Promotion</span><div class="nm">${esc(o.name)}</div><div class="cl"><span class="lv">${o.lv}</span>${UNIT_TXT[o.k][0]}</div></div></div><div class="desc big">${up}<br>The walls are full, so a veteran grows stronger instead.</div>${footer}</div>`;
  }
  if (o.type === 'item') {
    const d = layout.items[o.key];
    return `<div class="card r${d.r}" style="${rc(d.r)}"><div class="top"><div class="pic emo">${ITEM_TXT[o.key][0]}</div><div><span class="rar">${RAR_TXT[d.r]} item</span><div class="nm">${ITEM_TXT[o.key][1]}</div></div></div><div class="desc big" ${d.mods ? `data-tip="${esc(statTip(Object.keys(d.mods)))}"` : ''}>${itemDesc(o.key)}</div>${footer}</div>`;
  }
  if (o.type === 'turret') {
    const d = layout.turrets[o.k], lv = o.lv || 1;
    return `<div class="card r1" style="${rc(1)}"><div class="top"><div class="pic emo">🏰</div><div><span class="rar">Turret${lv > 1 ? ` · level ${lv}` : ''}</span><div class="nm">${TURRET_TXT[o.k][0]}</div></div></div><div class="stats"><span><small>Damage</small>${ICON.dmg}${fmt(d.p * (1 + 0.5 * (lv - 1)))}</span><span><small>Reload</small>${ICON.spd}${d.cd}s</span><span><small>Range</small>${ICON.rng}${d.range}</span></div><div class="desc">${TURRET_TXT[o.k][1]} ${lv > 1 ? 'Upgrades the one you have.' : 'Built in the courtyard.'}</div>${footer}</div>`;
  }
  if (o.type === 'bless') {
    const r = Math.min(3, o.v);
    return `<div class="card r${r}" style="${rc(r)}"><div class="top"><img class="pic" src="${portrait('unit', o.k, 0)}" alt=""><div><span class="rar">Blessing</span><div class="nm">${UNIT_TXT[o.k][0]}s</div></div></div><div class="desc big">Every ${UNIT_TXT[o.k][0].toLowerCase()} gets <b>+${20 * o.v}%</b> power, now and later.</div>${footer}</div>`;
  }
  return '';
}

// ---- The right-hand panel: shop, army, castle, stats ----
let tab = 'shop', shopSig = '', confirmUid = null;
function shopHtml(m) {
  let h = `<div class="sec"><span>Items and turrets. <b>Lock</b> an offer to keep it.</span><button class="btn alt" data-reroll ${m.gold < m.rr ? 'disabled' : ''}>Reroll · ${coin}${fmt(m.rr)}</button></div><div class="cards2">`;
  m.shop.forEach((o, i) => {
    if (!o) { h += '<div class="card gone">Sold</div>'; return; }
    const lv = o.type === 'turret' ? (m.tu.find((t) => Object.keys(layout.turrets)[t[0]] === o.k)?.[2] || 0) + 1 : 0;
    const full = o.type === 'turret' && lv === 1 && m.tu.length >= layout.turretSpots.length;
    h += optionCard({ ...o, lv }, `<div class="row2"><button class="btn" data-buy="${i}" ${m.gold < o.price || full ? 'disabled' : ''}>${full ? 'No free spot' : `Buy · ${coin}${fmt(o.price)}`}</button><button class="btn ${o.locked ? '' : 'alt'} lockb" data-lock="${i}" data-tip="${o.locked ? 'Locked: stays in the shop' : 'Lock to keep it for later'}">${ICON.lock}</button></div>`);
  });
  return `${h}</div>`;
}

function famHtml(m) {
  return `<div class="fams">${layout.families.map((f, i) => {
    const n = m.fam[0][i], t = m.fam[1][i];
    const pips = layout.familyAt.map((need) => `<i class="${n >= need ? 'on' : ''}"></i>`).join('');
    return `<div class="famrow fam-${f} ${t ? 'act' : ''}" data-tip="${esc(`<b>${FAM_TXT[f][0]}</b> · ${layout.familyAt.join(' / ')} defenders<br>${FAM_TXT[f][1]}`)}"><b>${FAM_TXT[f][0]}</b><span>${n}</span><div class="pips">${pips}</div></div>`;
  }).join('')}</div>`;
}

function armyHtml(m) {
  let h = famHtml(m) + `<div class="sec"><span><b>${m.un.length}</b> of ${m.cap} places taken</span><span>Hover to see reach</span></div>`;
  const ro = [...m.ro].sort((a, b) => b[3] - a[3] || b[2] - a[2]);
  for (const [uid, ki, rar, lv, xp, name, p, cd, range, kills, tc, refund, traits, crit] of ro) {
    const k = layout.units[ki], d = layout.unitStats[k], sure = confirmUid === uid;
    const main = d.aura ? `+${Math.round(p * 100)}% speed` : d.guard ? `−${Math.round(Math.min(0.7, p) * 100)}% damage` : d.curse ? `+${Math.round(Math.min(1, p) * 100)}% curse` : `${d.heal ? ICON.heal : ICON.dmg}${fmt(p)}`;
    const extra = d.aura || d.guard || d.curse ? '' : `<span>${ICON.spd}${cd.toFixed(1)}s</span><span>${ICON.rng}${d.heal === 'keep' ? '∞' : Math.round(range)}</span>${crit > 0 && !d.heal ? `<span>${Math.round(crit * 100)}% crit</span>` : ''}`;
    h += `<div class="unit" data-uid="${uid}" style="${rc(rar)}"><img class="pic" src="${portrait('unit', k, rar)}" alt=""><div><div class="nm"><span class="lv">${lv}</span>${esc(name)} <i>${UNIT_TXT[k][0]}</i></div><div class="meta"><span>${main}</span>${extra}<span>${ICON.kill}${fmt(kills)}</span></div>${traits.length ? `<div class="traits" style="margin-top:3px;min-height:0">${traitChips(traits)}</div>` : ''}<div class="xp"><i style="width:${xp}%"></i></div></div><div class="btns"><button class="btn" data-train="${uid}" ${m.gold < tc || m.ph !== 'prep' ? 'disabled' : ''}>Train · ${coin}${fmt(tc)}</button><button class="btn ${sure ? 'warn' : 'alt'}" data-dismiss="${uid}" ${m.ph !== 'prep' ? 'disabled' : ''}>${sure ? `Sure? +${fmt(refund)}` : 'Dismiss'}</button></div></div>`;
  }
  return h;
}

function castleHtml(m) {
  let h = '';
  [['hall', 'Keep', '+700 keep HP. The walls cannot be taller than the keep.'], ['walls', 'Walls', '+50% wall HP and room for more defenders. New look at Lv 3, 6 and 10.']].forEach(([k, name, desc], i) => {
    const l = m.b[i], max = layout.buildings[k].max, cost = m.bc[i];
    let label = `Upgrade · ${coin}${fmt(cost)}`, off = m.gold < cost;
    if (cost < 0) { label = 'Max level'; off = true; } else if (k !== 'hall' && l >= m.b[0]) { label = `Needs keep Lv ${l + 1}`; off = true; }
    const pips = Array.from({ length: max }, (_, j) => `<i class="${j < l ? 'on' : ''}"></i>`).join('');
    h += `<div class="row"><div><b>${name}<i>Lv ${l}</i></b><span>${desc}</span><div class="pips">${pips}</div></div><button class="btn" data-up="${k}" ${off ? 'disabled' : ''}>${label}</button></div>`;
  });
  h += `<div class="row"><div><b>Repair walls</b><span>Half the damage is mended for free after every wave.</span></div><button class="btn" data-repair="walls" ${m.gold && m.rc[0] ? '' : 'disabled'}>${m.rc[0] ? `${coin}${fmt(m.rc[0])}` : 'Intact'}</button></div>`;
  h += `<div class="row"><div><b>Repair keep</b><span>${m.rc[1] ? `${fmt(m.th[1] - m.th[0])} HP missing.` : 'Unharmed.'}</span></div><button class="btn" data-repair="hall" ${m.gold && m.rc[1] ? '' : 'disabled'}>${m.rc[1] ? `${coin}${fmt(m.rc[1])}` : 'Intact'}</button></div>`;
  h += `<div class="row" style="display:block"><b>Turrets <i>${m.tu.length} / ${layout.turretSpots.length} spots</i></b>`;
  h += m.tu.length ? `<div class="perkList">${m.tu.map(([ki, , lv], i) => { const k = Object.keys(layout.turrets)[ki]; return `<span class="trait" data-tip="${esc(`<b>${TURRET_TXT[k][0]}</b> · level ${lv}<br>${TURRET_TXT[k][1]}<br>Damage ${fmt(m.tp[i])}`)}">${TURRET_TXT[k][0]} · Lv ${lv}</span>`; }).join('')}</div>` : '<span>Found in the shop and among the spoils. Another copy raises the level.</span>';
  return `${h}</div>`;
}

function statsHtml(m) {
  let h = `<div class="statgrid">${Object.keys(STAT_TXT).map((k) => {
    const v = Math.round(m.tot[k] * 10) / 10;
    return `<div class="stat ${v > 0 ? 'pos' : v < 0 ? 'neg' : ''}" data-tip="${esc(`<b>${STAT_TXT[k][0]}</b><br>${STAT_TXT[k][2]}`)}"><span>${STAT_TXT[k][0]}</span><b>${sign(v)}${STAT_TXT[k][1]}</b></div>`;
  }).join('')}</div><div class="sec" style="margin-top:10px"><span>Harvesting pays <b>${coin}${fmt(m.hv)}</b> after the next wave</span></div>`;
  const items = Object.entries(m.items);
  h += `<div class="row" style="display:block"><b>Items <i>${items.reduce((a, [, n]) => a + n, 0)}</i></b>${items.length ? `<div class="items">${items.map(([k, n]) => `<span class="item r${layout.items[k].r}" style="${rc(layout.items[k].r)}" data-tip="${esc(`<b>${ITEM_TXT[k][1]}</b>${n > 1 ? ` ×${n}` : ''}<br>${itemDesc(k)}`)}">${ITEM_TXT[k][0]}${n > 1 ? `<i>${n}</i>` : ''}</span>`).join('')}</div>` : '<span>None yet. Buy them in the shop or find them among the spoils.</span>'}</div>`;
  const bl = Object.entries(m.bless).filter(([, v]) => v);
  if (bl.length) h += `<div class="row" style="display:block"><b>Blessings</b><div class="perkList">${bl.map(([k, v]) => `<span class="trait">${UNIT_TXT[k][0]}s +${20 * v}%</span>`).join('')}</div></div>`;
  return h;
}

function renderShop(m) {
  const show = m.ph === 'prep';
  const sig = JSON.stringify([show, tab, confirmUid, m.b, m.bc, m.rc, m.gold, m.un.length, m.cap, m.shop, m.rr, m.ro, m.tot, m.items, m.tu, m.fam]);
  if (sig === shopSig) return;
  shopSig = sig;
  $('shop').hidden = !show;
  if (!show) { rangeRing.visible = false; return; }
  for (const b of $('tabs').children) {
    b.classList.toggle('on', b.dataset.tab === tab);
    const extra = { shop: m.shop.filter(Boolean).length, army: m.un.length, castle: '', stats: m.lv[0] }[b.dataset.tab];
    b.innerHTML = `${{ shop: 'Shop', army: 'Army', castle: 'Castle', stats: 'Stats' }[b.dataset.tab]}<i>${extra}</i>`;
  }
  const body = $('tabBody'), y = body.scrollTop;
  body.innerHTML = tab === 'shop' ? shopHtml(m) : tab === 'army' ? armyHtml(m) : tab === 'castle' ? castleHtml(m) : statsHtml(m);
  body.scrollTop = y;
}
$('tabs').onclick = (e) => { const b = e.target.closest('button'); if (b) { tab = b.dataset.tab; confirmUid = null; $('tabBody').scrollTop = 0; if (snap) renderShop(snap); } };
$('tabBody').onclick = (e) => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  const d = b.dataset;
  if (d.buy) send({ t: 'buy', i: Number(d.buy) });
  else if (d.lock) send({ t: 'lock', i: Number(d.lock) });
  else if (d.reroll !== undefined) send({ t: 'reroll' });
  else if (d.train) send({ t: 'train', u: Number(d.train) });
  else if (d.dismiss) {
    const uid = Number(d.dismiss);
    if (confirmUid === uid) { send({ t: 'dismiss', u: uid }); confirmUid = null; } else confirmUid = uid;
    if (snap) renderShop(snap);
  } else if (d.up) send({ t: 'up', b: d.up });
  else if (d.repair) send({ t: 'repair', what: d.repair });
};
// Hovering a defender shows how far they reach.
$('tabBody').addEventListener('mouseover', (e) => {
  const row = e.target.closest('[data-uid]');
  if (!row || !snap || !snap.ro) { rangeRing.visible = false; return; }
  const r = snap.ro.find((x) => x[0] === Number(row.dataset.uid)), o = units.get(Number(row.dataset.uid));
  if (!r || !o || !r[8]) { rangeRing.visible = false; return; }
  rangeRing.position.set(o.x, 0.2, o.z); rangeRing.scale.setScalar(r[8]); rangeRing.visible = true;
});
$('tabBody').addEventListener('mouseleave', () => { rangeRing.visible = false; });

// ---- Modals: rewards, victory and the end of a run ----
let modalSig = '', pickAt = 0, lastPick = '';
function renderModal(m) {
  const sig = JSON.stringify([m.ph, m.pick, m.gold >= (m.pick?.rr ?? Infinity), m.ph === 'over' && [m.reached, m.st, m.best, m.tm, m.victory]]);
  if (sig === modalSig) return;
  modalSig = sig;
  let h = '';
  if (m.ph === 'over') {
    const b = m.best, k = b && b.k;
    h = `<div class="panel">${newRecord ? '<div class="record">New record</div>' : ''}<h2>${m.victory ? 'The siege is broken' : 'The castle has fallen'}</h2><p>${LORD_TXT[m.lord][0]} · ${DIFF_TXT[m.diff][0]} · a new run begins in ${m.tm} s</p>
      <div class="sum"><div><b>${m.reached}</b><small>wave reached</small></div><div><b>${fmt(m.st[0])}</b><small>monsters slain</small></div><div><b>${fmt(m.st[1])}</b><small>gold earned</small></div><div><b>${m.st[2]}</b><small>bosses felled</small></div></div>
      ${b ? `<div class="hero"><img src="${portrait('unit', k)}" alt=""><div><small style="color:var(--dim)">Hero of the run</small><br><b style="font-size:16px">${esc(b.name)}</b> · ${UNIT_TXT[k][0]} Lv ${b.lv}<br><span style="color:var(--dim)">${fmt(b.kills)} kills</span></div></div>` : ''}
      <button class="btn" data-restart style="padding:10px 22px;font-size:14px">Start a new run</button> <button class="btn alt" data-menu style="padding:10px 22px;font-size:14px">Main menu</button></div>`;
  } else if (m.ph === 'reward' && m.pick) {
    const p = m.pick;
    if (p.type === 'victory') {
      h = `<div class="panel"><div class="record">Victory</div><h2>The siege is broken!</h2><p>You held the castle through all ${layout.finalWave} waves. Keep going in endless mode to see how long it can stand, or end the run here.</p><button class="btn" data-pick="0" style="padding:10px 22px;font-size:14px">Keep going · endless</button> <button class="btn alt" data-pick="1" style="padding:10px 22px;font-size:14px">End the run</button></div>`;
    } else {
      const reroll = `<button class="btn alt" data-repick ${m.gold < p.rr ? 'disabled' : ''}>Reroll · ${coin}${fmt(p.rr)}</button>`;
      const more = p.left > 1 ? `<span class="left">${p.left - 1} more after this</span>` : '';
      if (p.type === 'level') {
        h = `<div class="panel wide"><h2>Castle level up</h2><p>Choose one upgrade for the whole castle. ${more}</p><div class="choices">${p.opts.map((o, i) => `<button class="choice r${o.r}" style="${rc(o.r)}" data-pick="${i}"><span class="rar">${RAR_TXT[o.r]}</span><b>${STAT_TXT[o.stat][0]}</b><em>${sign(layout.stats[o.stat][o.r])}${STAT_TXT[o.stat][1]}</em><span class="desc">${STAT_TXT[o.stat][2]}</span><span class="now">Now ${sign(Math.round(m.tot[o.stat] * 10) / 10)}${STAT_TXT[o.stat][1]}</span></button>`).join('')}</div><div class="foot">${reroll}<span class="kbd">1</span>–<span class="kbd">4</span> to choose</div></div>`;
      } else {
        h = `<div class="panel wide"><h2>Spoils of the wave</h2><p>Choose one. ${more}</p><div class="choices">${p.opts.map((o, i) => `<div class="pickwrap">${optionCard(o, `<button class="btn" data-pick="${i}">Take</button>`)}</div>`).join('')}</div><div class="foot">${reroll}<button class="btn alt" data-skip>Skip · +${coin}${fmt(p.skip)}</button></div></div>`;
      }
    }
  }
  // A new choice ignores number keys for a moment, so a key meant for the battle cannot pick a reward.
  const pk = m.ph === 'reward' && m.pick ? `${m.pick.type}:${m.pick.left}:${JSON.stringify(m.pick.opts || [])}` : '';
  if (pk && pk !== lastPick) pickAt = performance.now();
  lastPick = pk;
  $('modal').hidden = !h;
  $('modal').innerHTML = h;
}
$('modal').onclick = (e) => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  if (b.dataset.pick !== undefined) send({ t: 'pick', i: Number(b.dataset.pick) });
  else if (b.dataset.skip !== undefined) send({ t: 'skip' });
  else if (b.dataset.repick !== undefined) send({ t: 'repick' });
  else if (b.dataset.restart !== undefined) { newRecord = false; send({ t: 'restart' }); }
  else if (b.dataset.menu !== undefined) location.reload();
};

// Tooltips for anything with data-tip.
document.addEventListener('mousemove', (e) => {
  const el = e.target.closest?.('[data-tip]'), tip = $('tip');
  if (!el) { tip.hidden = true; return; }
  tip.innerHTML = el.dataset.tip; tip.hidden = false;
  tip.style.left = `${Math.min(innerWidth - 250, e.clientX + 14)}px`; tip.style.top = `${Math.min(innerHeight - 90, e.clientY + 16)}px`;
});
document.addEventListener('mouseover', (e) => {
  const mon = e.target.closest?.('[data-mon]');
  if (!mon) return;
  const t = Number(mon.dataset.mon), en = layout.enemies[t];
  mon.dataset.tip = `<b>${MON[en.key][0]}</b><br>${MON[en.key][2]}<br><span style="color:var(--dim)">Speed ${en.speed}${en.armor ? ` · armour ${en.armor}` : ''}</span>`;
});

// ---- Camera and keys ----
const keys = new Set(), focus = new THREE.Vector3(0, 0, 4);
let zoom = 1;
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  keys.add(e.code);
  if (!joined || !snap) return;
  const digit = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 }[e.code];
  if (digit !== undefined) {
    if (snap.ph === 'prep' && digit < 2) send({ t: 'wave', i: digit });
    else if (snap.ph === 'reward' && snap.pick && snap.pick.type !== 'victory' && performance.now() - pickAt > 800) send({ t: 'pick', i: digit });
    else if (snap.ph === 'wave' && digit < 3) useAbility(Object.keys(layout.abilities)[digit]);
  }
  if (e.code === 'Escape' && aiming) { setAiming(false); abilSig = ''; }
  if (e.code === 'KeyM') { prefs.music = !prefs.music; setAudio('music', prefs.music); savePrefs(); renderSound(); }
  if (e.code === 'Space') { e.preventDefault(); send({ t: 'speed', v: snap.spd ? 0 : 1 }); }
  if (e.code === 'Tab') {
    e.preventDefault();
    const order = ['shop', 'army', 'castle', 'stats'];
    tab = order[(order.indexOf(tab) + (e.shiftKey ? 3 : 1)) % 4]; confirmUid = null; $('tabBody').scrollTop = 0;
    renderShop(snap);
  }
  const dev = { KeyG: 'gold', KeyH: 'boss', KeyK: 'hurt', KeyJ: 'skip', KeyL: 'level', KeyV: 'victory' }[e.code];   // only honoured by a server started with --dev
  if (dev) send({ t: 'dev', k: dev });
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
addEventListener('wheel', (e) => { if (joined && !e.target.closest('#shop, #modal')) zoom = Math.min(1.6, Math.max(0.4, zoom * (1 + e.deltaY * 0.001))); }, { passive: true });
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
const down = (...c) => c.some((k) => keys.has(k));

// ---- Render loop ----
let last = performance.now(), t = 0;
function frame() {
  requestAnimationFrame(frame);
  const now = performance.now(), dt = Math.min((now - last) / 1000, 0.05);
  last = now; t += dt;
  if (world && snap) {
    const a = Math.min(1, (now - snapAt) / SNAP_MS);
    for (const o of enemies.values()) {
      place(o, a);
      const dx = o.cx - o.px, dz = o.cz - o.pz, moving = Math.hypot(dx, dz) > 0.02;
      if (moving) o.rot = lerpAngle(o.rot, Math.atan2(dx, dz), dt * 8);
      const w = Math.sin(t * (o.t === 0 ? 14 : 8) + o.id) * (moving ? 0.7 : 0.12);
      o.legs.forEach((l, i) => { l.rotation.x = (i === 0 || i === 3 ? 1 : -1) * w; });
      const flap = Math.sin(t * 9 + o.id) * 0.7;
      o.wings.forEach((wg) => { wg.rotation.z = (wg.scale.x > 0 ? 1 : -1) * flap; });
      const fly = FLY[o.t] ? 5 + Math.sin(t * 2 + o.id) * 0.4 : 0;
      o.g.position.set(o.rx, hAt(o.rx, o.rz) + fly + Math.abs(w) * 0.08 * o.g.scale.y, o.rz);
      o.g.rotation.y = o.rot;
      if (o.hitT > 0) { o.hitT -= dt; o.g.scale.setScalar(o.base * (1 + 0.18 * Math.max(0, o.hitT) / 0.12)); }
      if (o.bar) { const s = BEAST_SCALE[o.t]; o.bar.position.set(o.rx, 2.2 * s + fly, o.rz); o.bar.scale.set(1.6 * s * (o.hp / 100), 0.14, 1); }
    }
    // Defenders and turrets turn towards the nearest monster, or look outwards when all is quiet.
    for (const o of units.values()) {
      let aim = Math.atan2(o.x, o.z), bd = 30;
      for (const e of enemies.values()) { const d = Math.hypot(e.rx - o.x, e.rz - o.z); if (d < bd) { bd = d; aim = Math.atan2(e.rx - o.x, e.rz - o.z); } }
      o.rot = lerpAngle(o.rot, aim, dt * 6);
      o.m.rotation.y = o.rot;
    }
    for (const o of turrets.values()) {
      const p = o.g.position, top = o.g.userData.top;
      let aim = null, bd = 34;
      for (const e of enemies.values()) { const d = Math.hypot(e.rx - p.x, e.rz - p.z); if (d < bd) { bd = d; aim = Math.atan2(e.rx - p.x, e.rz - p.z); } }
      if (aim !== null) top.rotation.y = lerpAngle(top.rotation.y, aim - o.g.rotation.y, dt * 6);
    }
    for (const o of projs.values()) { place(o, a); o.m.position.set(o.rx, o.y, o.rz); if (o.kind === 3) o.m.rotation.x += dt * 8; }
    for (const c of clouds.values()) c.rotation.y += dt * 0.5;
  }
  if (world) world.flag.rotation.y = Math.sin(t * 2.2) * 0.35;
  for (let i = fxs.length - 1; i >= 0; i--) {
    const f = fxs[i], k = (f.t += dt) / f.dur;
    if (k >= 1) { scene.remove(f.m); f.m.material.dispose(); if (f.line) f.m.geometry.dispose(); fxs.splice(i, 1); continue; }
    if (f.line) { f.m.material.opacity = 1 - k; continue; }
    if (f.to) { f.m.position.set(f.from[0] + (f.to[0] - f.from[0]) * k, f.y0 + Math.sin(k * Math.PI) * f.arc, f.from[1] + (f.to[1] - f.from[1]) * k); continue; }
    f.m.scale.setScalar(f.size * (0.3 + 0.7 * k));
    f.m.position.y += f.rise * dt;
    f.m.material.opacity = 0.7 * (1 - k);
  }
  const phase = !joined || !snap ? 'menu' : snap.ph === 'over' && snap.victory ? 'won' : snap.ph;
  updateLook(LOOKS[phase], Math.min(1, dt * 0.9));
  fireMat.emissiveIntensity = 1.8 + Math.sin(t * 17) * 0.3 + Math.sin(t * 7.3) * 0.3;
  orbMat.emissiveIntensity = 2.2 + Math.sin(t * 4) * 0.8;
  if (joined) {
    const pan = 40 * zoom * dt;
    focus.x = Math.max(-60, Math.min(60, focus.x + (down('KeyD', 'ArrowRight') - down('KeyA', 'ArrowLeft')) * pan));
    focus.z = Math.max(-60, Math.min(60, focus.z + (down('KeyS', 'ArrowDown') - down('KeyW', 'ArrowUp')) * pan));
    camera.position.set(focus.x, 62 * zoom, focus.z + 44 * zoom);
    camera.lookAt(focus.x, 1, focus.z);
    if (shakeAmt > 0) {
      camera.position.x += (Math.random() - 0.5) * shakeAmt * 1.4;
      camera.position.y += (Math.random() - 0.5) * shakeAmt * 1.0;
      shakeAmt = Math.max(0, shakeAmt - dt * 2.5);
    }
  } else {
    // The start menu circles slowly around the castle.
    const ang = t * 0.06;
    camera.position.set(Math.sin(ang) * 58, 26, Math.cos(ang) * 58);
    camera.lookAt(0, 3, 0);
  }
  sun.target.position.copy(joined ? focus : tmpV.set(0, 0, 0));
  sun.position.copy(look.sp).normalize().multiplyScalar(110).add(sun.target.position);
  updateNumbers(dt);
  renderer.render(scene, camera);
}
frame();
