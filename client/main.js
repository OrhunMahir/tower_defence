// Client: sends the commander's choices and draws whatever the rules say. No game rules live here.
import * as THREE from 'three';
import { makeLook } from './look.js';
import { buildWorld, makeUnit, makeTurret, makeBuilding, makePlot, makeDragon, Horde, hAt, winMat, fireMat, orbMat, frostMat, GLOW, BEAST_SCALE, BEASTS, RARITY_COLORS, mineGeo, mineMat } from './models.js';
import { initAudio, setAudio, setVolume, sfx, setMood } from './audio.js';
import { Game } from './rules/game.js';
import { startLocal, startRemote } from './net.js';
import { S, send, $ } from './state.js';
import { prefs, saveProfile, setSavedRun, runOptions, award, discover } from './profile.js';
import { MON, AGE_TXT, ageName, BUILD_TXT, ITEM_TXT, UNIT_TXT, ACH_TXT, FAM_TXT, MUT_TXT, SEASON_TXT, WEATHER_TXT, fmt } from './text.js';
import { initHud, updateHud, toast, resetHud } from './hud.js';
import { initMenu, showMenu } from './menu.js';

const SNAP_MS = 50;
const QUERY = new URLSearchParams(location.search);
const DEV = QUERY.has('dev'), REMOTE = QUERY.has('server');

// ---- Renderer, scene and light ----
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.prepend(renderer.domElement);
const canvas = renderer.domElement;

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
// ?look=... draws the scene like the pictures of the interface (see look.js); without it nothing changes.
const cartoon = makeLook(QUERY.get('look'), renderer, scene, camera, sun);

// Lighting follows the phase: day while preparing, dusk during a wave, night when the castle falls.
const LOOKS = {
  prep: { sky: 0x8db8dc, fog: 0.0045, hs: 0xcfe4ff, hg: 0x4a5a30, hi: 1.2, sc: 0xfff1d6, si: 6.5, sp: [40, 60, 25], win: 0.1, tor: 0 },
  wave: { sky: 0xd0906a, fog: 0.007, hs: 0xffd2b0, hg: 0x4a4638, hi: 1.5, sc: 0xff9550, si: 6, sp: [62, 28, 18], win: 1, tor: 45 },
  night: { sky: 0x1a2440, fog: 0.0095, hs: 0x6a86c8, hg: 0x1a2028, hi: 0.95, sc: 0x9fb8ff, si: 2.6, sp: [-40, 55, 20], win: 2, tor: 80 },
  over: { sky: 0x0b1424, fog: 0.012, hs: 0x4a6aa8, hg: 0x101820, hi: 0.7, sc: 0x8fb0ff, si: 1.9, sp: [-30, 50, 30], win: 2.2, tor: 90 },
};
LOOKS.reward = LOOKS.prep;
LOOKS.menu = { ...LOOKS.prep, sky: 0xe0a77c, hs: 0xffe0c0, sc: 0xffc58a, si: 5.5, sp: [70, 30, 40], win: 0.8, tor: 20 };
// The weather thickens the air, dims the sun and pulls the sky towards its own colour.
const WEATHER_LOOK = {
  clear: null,
  rain: { fog: 0.003, dim: 0.72, sky: 0x70808e, mix: 0.6 },
  fog: { fog: 0.007, dim: 0.8, sky: 0xb4bcc0, mix: 0.75 },
  gale: { fog: 0.001, dim: 0.95, sky: 0xa8b4bc, mix: 0.25 },
  storm: { fog: 0.004, dim: 0.5, sky: 0x39424f, mix: 0.8 },
  heat: { fog: 0.002, dim: 1.12, sky: 0xf0c890, mix: 0.45 },
  snow: { fog: 0.004, dim: 0.85, sky: 0xccd6e0, mix: 0.6 },
  blizzard: { fog: 0.008, dim: 0.74, sky: 0xcfd8e2, mix: 0.8 },
};
// However thick the weather, the battle has to stay readable.
const FOG_MAX = 0.0125;
// The seasons colour the land: what the ground and the leaves are multiplied by, and how much snow lies.
const SEASON_LOOK = {
  spring: { ground: 0xffffff, leaves: 0xffffff, snow: 0 },
  summer: { ground: 0xfff2c4, leaves: 0xf0f8c8, snow: 0 },
  autumn: { ground: 0xf2c48c, leaves: 0xff9440, snow: 0 },
  winter: { ground: 0xdfe8f8, leaves: 0xd0dce8, snow: 0.42 },
};
const mixHex = (a, b, k) => tmpC.set(a).lerp(tmpC2.set(b), k).getHex();
const look = { ...LOOKS.menu, sky: new THREE.Color(LOOKS.menu.sky), hs: new THREE.Color(LOOKS.menu.hs), hg: new THREE.Color(LOOKS.menu.hg), sc: new THREE.Color(LOOKS.menu.sc), sp: new THREE.Vector3(...LOOKS.menu.sp) };
const tmpC = new THREE.Color(), tmpC2 = new THREE.Color(), tmpV = new THREE.Vector3();
let flash = 0;   // lightning lights the whole scene for an instant
function updateLook(target, k) {
  for (const key of ['sky', 'hs', 'hg', 'sc']) look[key].lerp(tmpC.set(target[key]), k);
  for (const key of ['fog', 'hi', 'si', 'win', 'tor']) look[key] += (target[key] - look[key]) * k;
  look.sp.lerp(tmpV.set(...target.sp), k);
  scene.background.copy(look.sky); scene.fog.color.copy(look.sky); scene.fog.density = look.fog;
  hemi.color.copy(look.hs); hemi.groundColor.copy(look.hg); hemi.intensity = look.hi + flash * 3;
  sun.color.copy(look.sc); sun.intensity = look.si;
  winMat.emissiveIntensity = look.win;
  for (const l of world.torches) l.intensity = look.tor;
}

// ---- The world: built once from the layout, which is the same for every game ----
S.layout = new Game().layout();
const layout = S.layout;
const world = buildWorld(scene, layout);
const horde = new Horde(scene);
const FLY = layout.enemies.map((e) => !!e.fly), BOSS = layout.enemies.map((e) => !!e.boss), GHOST = BEASTS.map((b) => !!b.ghost);
const enemies = new Map(), projs = new Map(), units = new Map(), turrets = new Map(), clouds = new Map(), mines = new Map(), fxs = [];
const plots = layout.plots.map(([x, z]) => { const marker = makePlot(); marker.position.set(x, 0, z); marker.rotation.y = Math.atan2(-x, -z); marker.visible = false; scene.add(marker); return { marker, g: null, ki: -1 }; });
let plotsOpen = 2, shownKey = 'timber', seasonSaid = -1;   // seasonSaid: the last season that was announced
const seasonOf = (n) => layout.seasons[Math.floor((Math.max(1, n) - 1) / layout.seasonLen) % 4];
const yearOf = (n) => Math.floor((Math.max(1, n) - 1) / layout.yearLen) + 1;
// The dragon of the Dragonfire Age circles overhead.
const dragon = makeDragon();
dragon.g.visible = false;
scene.add(dragon.g);

// ---- Weather in the air: rain falls as streaks, snow and wind-blown leaves as flecks ----
const AIR_N = 1300, flecks = new Float32Array(AIR_N * 3), streaks = new Float32Array(AIR_N * 6);
for (let i = 0; i < AIR_N; i++) { flecks[i * 3] = (Math.random() - 0.5) * 150; flecks[i * 3 + 1] = Math.random() * 46; flecks[i * 3 + 2] = (Math.random() - 0.5) * 150; }
const fleckGeo = new THREE.BufferGeometry(), streakGeo = new THREE.BufferGeometry();
fleckGeo.setAttribute('position', new THREE.BufferAttribute(flecks, 3));
streakGeo.setAttribute('position', new THREE.BufferAttribute(streaks, 3));
const fleckMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.4, transparent: true, opacity: 0, depthWrite: false });
const streakMat = new THREE.LineBasicMaterial({ color: 0xa8c0dc, transparent: true, opacity: 0, depthWrite: false });
const fleckMesh = new THREE.Points(fleckGeo, fleckMat), streakMesh = new THREE.LineSegments(streakGeo, streakMat);
for (const o of [fleckMesh, streakMesh]) { o.frustumCulled = false; o.visible = false; scene.add(o); }
// fall and drift in metres a second; rain: drawn as streaks.
const AIR = {
  rain: { fall: 60, drift: 7, rain: true, op: 0.5 }, storm: { fall: 70, drift: 18, rain: true, op: 0.6 },
  snow: { fall: 7, drift: 3, size: 0.42, color: 0xffffff, op: 0.85 }, blizzard: { fall: 13, drift: 32, size: 0.5, color: 0xffffff, op: 0.9 },
  gale: { fall: 3, drift: 36, size: 0.3, color: 0xcdb878, op: 0.55 },
};
let airNow = null;
function updateAir(dt, weather) {
  const a = AIR[weather] || null;
  if (a) airNow = a;
  const wantF = a && !a.rain ? a.op : 0, wantS = a && a.rain ? a.op : 0, k = Math.min(1, dt * 2.5);
  fleckMat.opacity += (wantF - fleckMat.opacity) * k; streakMat.opacity += (wantS - streakMat.opacity) * k;
  fleckMesh.visible = fleckMat.opacity > 0.02; streakMesh.visible = streakMat.opacity > 0.02;
  if (!airNow || (!fleckMesh.visible && !streakMesh.visible)) return;
  if (!airNow.rain) { fleckMat.size = airNow.size; fleckMat.color.set(airNow.color); }
  const cx = S.joined ? focus.x : 0, cz = S.joined ? focus.z : 0, fall = airNow.fall * dt, drift = airNow.drift * dt;
  for (let i = 0; i < AIR_N; i++) {
    let x = flecks[i * 3] + drift, y = flecks[i * 3 + 1] - fall, z = flecks[i * 3 + 2];
    if (y < 0) { y += 46; x = cx + (Math.random() - 0.5) * 150; z = cz + (Math.random() - 0.5) * 150; }
    if (x > cx + 75) x -= 150;
    flecks[i * 3] = x; flecks[i * 3 + 1] = y; flecks[i * 3 + 2] = z;
    streaks[i * 6] = x; streaks[i * 6 + 1] = y; streaks[i * 6 + 2] = z;
    streaks[i * 6 + 3] = x - airNow.drift * 0.025; streaks[i * 6 + 4] = y + airNow.fall * 0.025; streaks[i * 6 + 5] = z;
  }
  (airNow.rain ? streakGeo : fleckGeo).attributes.position.needsUpdate = true;
}
// The land follows the season.
function updateSeason(dt, season, weather) {
  const sl = SEASON_LOOK[season] || SEASON_LOOK.spring, k = Math.min(1, dt * 0.6);
  const snow = Math.min(0.66, sl.snow + (weather === 'snow' ? 0.2 : weather === 'blizzard' ? 0.24 : 0));
  world.leaves.material.color.lerp(tmpC.set(sl.leaves), k);
  // Grass, tufts and trodden earth take the colour of the season; snow lies thinner where people walk.
  for (const [mat, lies] of [[world.ground.material, 1], [world.tufts.material, 1], ...world.earth.map((m) => [m, 0.6])]) {
    mat.color.lerp(tmpC.set(sl.ground), k);
    mat.emissiveIntensity += (snow * lies - mat.emissiveIntensity) * k;
  }
  world.flowers.visible = season === 'spring' || season === 'summer';
}

function applySettings() {
  const high = prefs.quality !== 'low';
  renderer.setPixelRatio(high ? Math.min(devicePixelRatio, 2) : 1);
  renderer.shadowMap.enabled = high;
  sun.castShadow = high;
  horde.setShadows(high);
  if (cartoon) cartoon.resize();
  scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  setAudio('sfx', prefs.sfx); setAudio('music', prefs.music); setVolume(prefs.volume);
  $('dmg').hidden = !prefs.numbers;
}

// ---- Starting and leaving a run ----
function clearScene() {
  for (const o of units.values()) scene.remove(o.m);
  for (const o of turrets.values()) scene.remove(o.g);
  for (const o of projs.values()) scene.remove(o.m);
  for (const c of clouds.values()) scene.remove(c);
  for (const c of mines.values()) scene.remove(c);
  for (const f of fxs) scene.remove(f.m);
  for (const p of plots) { if (p.g) scene.remove(p.g); p.g = null; p.ki = -1; p.marker.visible = false; }
  for (const m of [enemies, projs, units, turrets, clouds, mines]) m.clear();
  fxs.length = 0;
  horde.begin(); horde.end();
  setAiming(null); setMoving(null);
  world.setAge(0, 'timber'); shownKey = 'timber'; seasonSaid = -1;
  dragon.g.visible = false;
  for (const g of world.segs) { g.visible = true; g.scale.y = 1; }
}

// run: { save } continues a saved run, { daily } starts today's challenge, {} starts a run with the menu's choices.
function startRun(run = {}) {
  initAudio({ sfx: prefs.sfx, music: prefs.music, volume: prefs.volume });
  if (S.net) S.net.close();
  S.snap = null; S.award = null; S.joined = false;
  clearScene(); resetHud();
  const save = run.save || null;
  const opts = save ? { siege: save.siege, lord: save.lord, classes: save.classes, items: save.pool, relics: save.relics, abilities: save.loadout, daily: save.daily } : run.daily ? run.daily.opts : runOptions();
  S.run = { daily: run.daily || null };
  saveProfile();
  S.net = (REMOTE ? startRemote : startLocal)({ opts, save, seed: run.daily && !save ? run.daily.seed : null, dev: DEV }, {
    hello() {
      S.joined = true;
      $('overlay').hidden = true;
      for (const id of ['status', 'help', 'speed']) $(id).hidden = false;
      focus.set(0, 0, 4); zoom = 1;
    },
    snap: onSnap,
    save: setSavedRun,
    error(why) {
      if (why === 'badsave') { setSavedRun(null); toast('Save could not be loaded', 'Starting a fresh run instead'); return; }
      leaveRun(why === 'lost' ? 'The connection to the server was lost. Your run is saved after every wave.' : 'Could not reach the game server.');
    },
  });
}
function leaveRun(message = '') {
  if (S.net) S.net.close();
  S.net = null; S.joined = false; S.snap = null;
  clearScene(); resetHud();
  for (const id of ['status', 'help', 'speed', 'shop', 'waves', 'abilities', 'modal', 'advice', 'boss']) $(id).hidden = true;
  setMood('calm');
  $('toast').style.opacity = 0; $('tip').hidden = true;
  for (const n of nums.splice(0)) n.el.remove();
  showMenu(message);
}
S.hooks.restart = () => startRun(S.run && S.run.daily ? { daily: S.run.daily } : {});
S.hooks.leave = leaveRun;
// Giving the castle up ends the run where it stands: it is counted like any other.
S.hooks.abandon = () => send({ t: 'retire' });
S.hooks.applySettings = applySettings;

// Remember where an entity was drawn, so the next snapshot is blended in without a jump.
function track(o, x, z) { o.px = o.rx ?? x; o.pz = o.rz ?? z; o.cx = x; o.cz = z; }
function place(o, a) { o.rx = o.px + (o.cx - o.px) * a; o.rz = o.pz + (o.cz - o.pz) * a; }
function lerpAngle(a, b, k) { const d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + d * Math.min(1, k); }

const arrowGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.2, 5).rotateX(Math.PI / 2);
const arrowMat = new THREE.MeshStandardMaterial({ color: 0xd8c9a0, roughness: 0.6 });
const orbGeo = new THREE.SphereGeometry(0.3, 12, 10);
const shardGeo = new THREE.OctahedronGeometry(0.32, 0);
const rockGeo = new THREE.DodecahedronGeometry(0.5, 0);
const fireMat2 = new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0xff5a00, emissiveIntensity: 2.4 });
const flaskMat = new THREE.MeshStandardMaterial({ color: 0x7dff5a, emissive: 0x3aaa2a, emissiveIntensity: 1.2 });
const bombMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
const ballMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, emissive: 0xff8a3a, emissiveIntensity: 0.8 });
const puffGeo = new THREE.SphereGeometry(1, 14, 10);
const haloGeo = new THREE.TorusGeometry(1, 0.07, 6, 28).rotateX(Math.PI / 2);
const cloudGeo = new THREE.CylinderGeometry(1, 1, 0.5, 24, 1, true);
const cloudMat = new THREE.MeshBasicMaterial({ color: 0x7dff5a, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
const lavaMat = new THREE.MeshStandardMaterial({ color: 0xff6a1a, emissive: 0xff4a00, emissiveIntensity: 2.6, flatShading: true });
const crystalMat = new THREE.MeshStandardMaterial({ color: 0xcff6ff, emissive: 0x6fd8ff, emissiveIntensity: 1.6 });
const rocketGeo = new THREE.ConeGeometry(0.16, 1.1, 7).rotateX(Math.PI / 2), rocketMat = new THREE.MeshStandardMaterial({ color: 0xd8301a, emissive: 0xff7a2a, emissiveIntensity: 0.9 });
const lanceGeo = new THREE.CylinderGeometry(0.02, 0.07, 3.2, 6).rotateX(Math.PI / 2), boneMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc4, roughness: 0.6 });
const pillarGeo = new THREE.CylinderGeometry(1, 1, 34, 18, 1, true);
// What lies on the ground: poison, a pool of lava, caltrops.
const poolMat = new THREE.MeshBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide });
const spikeMat = new THREE.MeshBasicMaterial({ color: 0x8a8e96, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
const GROUND_MATS = [cloudMat, poolMat, spikeMat];
const PROJ = {
  1: [orbGeo, orbMat], 3: [shardGeo, frostMat], 5: [orbGeo, fireMat2], 6: [orbGeo, flaskMat], 7: [orbGeo, bombMat], 8: [orbGeo, ballMat],
  9: [rockGeo, lavaMat], 10: [shardGeo, crystalMat], 11: [rocketGeo, rocketMat], 12: [orbGeo, bombMat], 13: [lanceGeo, boneMat],
};

const flatRing = (inner, color, opacity) => { const m = new THREE.Mesh(new THREE.RingGeometry(inner, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false })); m.visible = false; scene.add(m); return m; };
// The reach of a hovered defender, and the target of an aimed ability.
const rangeRing = flatRing(0.97, 0xffd75a, 0.6), aimRing = flatRing(0.9, 0xff5a3a, 0.85);
// Places on the walls, shown while a defender is being moved.
const slotMats = [0x56c271, 0xf3cd68].map((c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9, depthTest: false }));
const slotMarks = layout.slots.map(() => { const m = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.09, 6, 20).rotateX(Math.PI / 2), slotMats[0]); m.visible = false; m.renderOrder = 4; scene.add(m); return m; });

function slotPos(slot, m) {
  const [x, z, seg] = layout.slots[slot];
  return [x, seg < 0 ? world.towerTop : world.wallH * (0.55 + 0.45 * (m.sg[seg] / 100)), z, seg];
}

// ---- Juice: sounds per effect, floating damage numbers, camera shake ----
const FX_SOUND = {
  0: 'kill', 3: 'ice', 5: 'thump', 7: 'hit', 8: 'chime', 9: 'up', 10: 'spit', 12: 'zap', 17: 'spit', 18: 'fire', 19: 'volley', 20: 'mend', 21: 'rally', 24: 'shriek', 25: 'rumble', 26: 'quake', 27: 'stun', 28: 'dig', 29: 'build', 30: 'age', 31: 'mine', 32: 'relic', 33: 'phoenix', 36: 'freeze', 37: 'bounty',
  39: 'fire', 40: 'beam', 42: 'fire', 43: 'ice', 44: 'fire', 45: 'year', 46: 'event', 47: 'mutate', 48: 'roar', 49: 'zap', 50: 'chime', 51: 'crit', 52: 'gun', 53: 'thunder', 54: 'volley', 55: 'phoenix', 56: 'ice', 57: 'mine', 58: 'rally', 59: 'mend', 60: 'mend', 61: 'thump',
};
const nums = [], projV = new THREE.Vector3();
function damageNumber(x, z, v, kind) {
  if (!prefs.numbers) return;
  if (nums.length > 45) nums.shift().el.remove();
  const el = document.createElement('div');
  el.className = kind === 1 ? 'dn crit' : kind >= 2 ? 'dn miss' : 'dn';
  el.textContent = kind === 2 ? 'miss' : kind === 3 ? 'shell' : `${fmt(v)}${kind === 1 ? '!' : ''}`;
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
function shake(a) { if (prefs.shake) shakeAmt = Math.min(1.5, Math.max(shakeAmt, a)); }

function addFx(geo, color, x, y, z, size, dur, rise = 0, to = null, arc = 0) {
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false }));
  m.position.set(x, y, z);
  if (to) { m.material.opacity = 1; m.scale.setScalar(size * (geo === orbGeo || geo === rockGeo ? 1 : 0.3)); }
  scene.add(m);
  fxs.push({ m, t: 0, dur, size, rise, to, from: [x, z], y0: y, arc });
}
// A ring on the ground that grows to its full size, or shrinks onto a marked spot.
function addRing(color, x, y, z, size, dur, shrink = false) {
  const m = new THREE.Mesh(haloGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
  m.position.set(x, y, z);
  scene.add(m);
  fxs.push({ m, t: 0, dur, size, ring: shrink ? -1 : 1 });
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

// A straight, short-lived line: a beam, a shard, a critical hit leaping on.
function addBeam(x1, y1, z1, x2, y2, z2, color, dur = 0.14) {
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x2, y2, z2)]), new THREE.LineBasicMaterial({ color, transparent: true }));
  scene.add(line);
  fxs.push({ m: line, t: 0, dur, line: true });
}
// Lightning from the sky to a spot on the ground.
function addSkyBolt(x, z) {
  const pts = [];
  let px = x + (Math.random() - 0.5) * 14, pz = z + (Math.random() - 0.5) * 14;
  for (let i = 0; i <= 9; i++) {
    const k = i / 9;
    pts.push(new THREE.Vector3(px + (x - px) * k + (i && i < 9 ? (Math.random() - 0.5) * 3 : 0), 60 * (1 - k), pz + (z - pz) * k + (i && i < 9 ? (Math.random() - 0.5) * 3 : 0)));
  }
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xeaf6ff, transparent: true }));
  scene.add(line);
  fxs.push({ m: line, t: 0, dur: 0.3, line: true });
  flash = 1;
}

function playFx(f, m) {
  const [kind, x, z, v] = f;
  const sound = FX_SOUND[kind];
  if (sound) sfx(sound);
  if (kind === 22) { damageNumber(x, z, v, f[4]); if (f[4] === 1) sfx('crit'); else if (f[4] === 2) sfx('miss'); return; }
  if (kind >= 39) { playNewFx(f, m); return; }
  if (kind === 0) addFx(puffGeo, GLOW[v], x, 0.8 * BEAST_SCALE[v] + (FLY[v] ? 5 : 0), z, BEAST_SCALE[v] * 1.3, 0.35);
  else if (kind === 1) {
    const big = f[4] === 1, blight = f[4] === 2, pillar = f[4] === 3, starfall = f[4] === 4;
    sfx('boom');
    addFx(puffGeo, big ? 0xff8a2a : blight ? 0xb6ff2a : pillar || starfall ? 0xfff2b0 : 0x6fdcff, x, 1, z, v, big ? 0.6 : 0.3);
    if (pillar) { const col = new THREE.Mesh(pillarGeo, new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide })); col.position.set(x, 17, z); col.scale.set(v * 0.8, 1, v * 0.8); scene.add(col); fxs.push({ m: col, t: 0, dur: 0.35, fade: 0.7 }); }
    if (big) { addRing(0xffc060, x, 0.3, z, v * 1.4, 0.7); shake(0.9); } else if (starfall) { addRing(0xfff0a0, x, 0.3, z, v * 1.3, 0.5); shake(0.3); } else if (v >= 3.4) shake(0.25);
  } else if (kind === 3) addFx(puffGeo, 0xdff6ff, x, 1, z, v, 0.45);
  else if (kind === 4) toast(`${v === 'hall' ? 'Keep' : 'Walls'} upgraded`);
  else if (kind === 5) { const [sx, sz] = layout.turretSpots[v] || [0, 0]; addFx(orbGeo, 0x222222, sx, 2, sz, 1.6, 1.1, 0, [x, z], 14); }
  else if (kind === 7) addFx(puffGeo, 0xffffff, x, 1, z, 0.7, 0.15);
  else if (kind === 8) addFx(haloGeo, RARITY_COLORS[v] ?? 0xffffff, x, world.wallH + 0.2, z, 1.3, 0.9, 3);
  else if (kind === 9) addFx(haloGeo, 0x8fd0ff, x, world.wallH + 0.4, z, 0.9, 0.7, 4);
  else if (kind === 10) {
    const to = v >= 0 ? [layout.segs[v].x, layout.segs[v].z] : [0, 0];
    if (f[4]) addFx(rockGeo, 0x8a8880, x, 2.5, z, 1.3, 0.9, 0, to, 9); else addFx(orbGeo, 0x9dff3a, x, 1.2, z, 0.8, 0.6, 0, to, 3);
  } else if (kind === 11) addFx(haloGeo, 0x9dffb0, x, world.wallH * 0.6, z, 1.4, 0.6, 2);
  else if (kind === 12) addBolt(f[1], f[2], f[3], f[4]);
  else if (kind === 13) addFx(puffGeo, 0xb04bff, x, 1.5, z, 1, 0.4);
  else if (kind === 14) addFx(haloGeo, 0xffe08a, 0, 6, 0, 4.5, 0.8, 2);
  else if (kind === 15) toast(`Castle level ${v}`, 'A new upgrade waits after the wave', 1500);
  else if (kind === 17) addFx(puffGeo, 0x7dff5a, x, 0.6, z, v, 0.4);
  else if (kind === 18) addFx(puffGeo, 0xff8a3a, x, 1, z, v, 0.35);
  else if (kind === 19) { addRing(f[4] ? 0xff8a2a : 0xff5a3a, x, 0.3, z, v, f[4] ? 1.5 : 0.8, true); if (f[4]) addFx(orbGeo, 0xffb050, x + 14, 40, z - 10, 3, 1.5, 0, [x, z], 0); }
  else if (kind === 20) { toast('Walls mended'); for (const s of layout.segs) addFx(haloGeo, 0x9dffb0, s.x, world.wallH * 0.6, s.z, 1.2, 0.6, 2); }
  else if (kind === 21) toast('Rally!', 'Every defender attacks faster');
  else if (kind === 23) { for (const o of units.values()) if (o.slot === x) o.kick = 0.14; }
  else if (kind === 24) { addRing(0xff2a6a, x, 0.4, z, v, 0.8); toast('The Queen shrieks!', 'The horde around her speeds up', 1400); shake(0.4); }
  else if (kind === 25) addRing(0xff3a1a, x, world.wallH + 0.3, z, 3.2, v, true);
  else if (kind === 26) { addFx(puffGeo, 0xb8a080, x, 1.5, z, 4.5, 0.7); shake(1.3); }
  else if (kind === 27) { addRing(0xb04bff, x, world.wallH + 0.5, z, v, 0.7); toast('The Sky Tyrant dives!', 'Defenders nearby are stunned', 1400); shake(0.6); }
  else if (kind === 28) addFx(puffGeo, 0x8a6a48, x, 0.5, z, 1.8, 0.5);
  else if (kind === 29) { addFx(haloGeo, 0xffd75a, x, 0.5, z, 3, 1, 3); if (BUILD_TXT[v]) toast(BUILD_TXT[v][1], 'The courtyard grows'); }
  else if (kind === 30) {
    const key = m.ak, asc = Math.max(0, v - layout.lastAge);
    toast(ageName(key, asc), asc ? 'An ascension, with higher caps and two great upgrades' : `${AGE_TXT[key][1]}, new recruits and a doctrine`, 3600);
    for (let i = 0; i < 4; i++) addRing(0xffd75a, 0, 0.5 + i * 2.5, 0, 10 + i * 9, 1.4 + i * 0.25);
    shake(0.8);
  } else if (kind === 32) toast('The egg has hatched!', ITEM_TXT[v] ? `${ITEM_TXT[v][1]} joins your treasures` : '', 3000);
  else if (kind === 33) { toast('The phoenix rises', 'The keep stands again and fire sweeps the courtyard', 3200); for (let i = 0; i < 3; i++) addRing(0xff8a2a, 0, 0.5, 0, 6 + i * 5, 0.8 + i * 0.3); shake(1.2); }
  else if (kind === 34) { toast(v ? 'The prayer was heard' : 'Only silence answers', v && UNIT_TXT[v] ? `${UNIT_TXT[v][0]}s are blessed` : ''); sfx(v ? 'relic' : 'deny'); }
  else if (kind === 35) { toast(v > 0 ? 'The dice are kind' : 'The gambler grins', v > 0 ? `+${fmt(v)} gold` : `${fmt(v)} gold`); sfx(v > 0 ? 'bounty' : 'deny'); }
  else if (kind === 36) { toast('Deep freeze', 'Every monster is slowed'); for (let i = 0; i < 3; i++) addRing(0xaee8ff, 0, 0.4, 0, 22 + i * 12, 0.9 + i * 0.2); }
  else if (kind === 37) toast('Bounty hunt', 'Kills pay double gold and experience');
  void m;
}

// The effects of the endless update: the new classes, the weather, the powers of the path ages.
function playNewFx(f, m) {
  const [kind, x, z, v] = f, keep = () => { for (let i = 0; i < 3; i++) addRing(0xfff2b0, 0, 0.5, 0, 5 + i * 4, 0.7 + i * 0.25); };
  if (kind === 39) addFx(puffGeo, 0xff6a1a, x, 0.6, z, v, 0.4);
  else if (kind === 40) { const [sx, sy, sz] = slotPos(x, m); addBeam(sx, sy + 2.2, sz, z, 1.4, v, 0x9ff6ff); addFx(puffGeo, 0xbff6ff, z, 1.4, v, 0.7, 0.15); }
  else if (kind === 41) addBeam(f[1], 1.5, f[2], f[3], 1.5, f[4], 0xdff6ff);
  else if (kind === 42) {
    const [sx, sy, sz] = slotPos(x, m), ang = f[2], range = f[3], half = f[4];
    for (let i = 0; i < 7; i++) { const a = ang + (Math.random() - 0.5) * 2 * half, d = range * (0.25 + 0.75 * Math.random()); addFx(puffGeo, i % 2 ? 0xff7a1a : 0xffc040, sx + Math.sin(a) * d, sy * 0.4 + 0.8, sz + Math.cos(a) * d, 1.7, 0.3 + Math.random() * 0.2); }
  } else if (kind === 43) addRing(0xfff2a0, x, 0.3, z, v, 0.8, true);
  else if (kind === 44) {
    addFx(puffGeo, 0xff7a1a, x, 1.2, z, v * 1.2, 0.6); addRing(0xff8a2a, x, 0.3, z, v, 0.6); shake(0.35);
    if (dragon.g.visible) for (let i = 0; i < 3; i++) addFx(orbGeo, 0xff8a2a, dragon.g.position.x, dragon.g.position.y, dragon.g.position.z, 1.4 + i * 0.4, 0.3 + i * 0.08, 0, [x, z], 0);
  } else if (kind === 45) { toast(`Year ${v} is over`, 'The castle still stands. The horde will come back stronger.', 4600); for (let i = 0; i < 5; i++) addRing(0xffd75a, 0, 0.5 + i * 2.5, 0, 10 + i * 9, 1.4 + i * 0.25); }
  else if (kind === 46) toast('The horde adapts', v && FAM_TXT[v] ? `It resists your ${FAM_TXT[v][0]} more` : 'It found no pattern in your defence', 3400);
  else if (kind === 47) { if (MUT_TXT[v]) toast(MUT_TXT[v][1], 'The horde has changed for good', 2800); discover('mut', [v]); }
  else if (kind === 48) { addRing(0xb04bff, x, 0.4, z, 6, 0.9); toast('It rises again!', 'Second wind', 1600); shake(0.6); }
  else if (kind === 49) { addBeam(x, 14, z, x, 0.5, z, 0xfff6c8, 0.2); addFx(puffGeo, 0xfff2b0, x, 1, z, 1, 0.2); }
  else if (kind === 50) addFx(haloGeo, 0xfff2c0, x, 2.6, z, 1.2, 0.6, 2);
  else if (kind === 51) addFx(puffGeo, 0xb04bff, x, 1.2, z, 1.5, 0.25);
  else if (kind === 52) { const [tx, tz] = layout.towers[x] || [0, 0]; addFx(puffGeo, 0xd8d8d8, tx * 1.1, world.towerTop + 1.2, tz * 1.1, 1.7, 0.45); }
  else if (kind === 53) { addSkyBolt(x, z); addFx(puffGeo, 0xeaf6ff, x, 1, z, 2, 0.25); shake(0.3); if (v) toast('Lightning strikes the walls', 'A defender is stunned', 1500); }
  else if (kind === 54) { addRing(0xfff0a0, x, 0.3, z, v, 0.6, true); addFx(orbGeo, 0xfff6c0, x + 12, 46, z - 9, 2.2, 0.6, 0, [x, z], 0); }
  else if (kind === 55) { toast('Grace', 'The keep is spared the killing blow', 3000); keep(); shake(0.8); }
  else if (kind === 56) addRing(0x5fd0ff, x, world.wallH + 0.3, z, 2.6, 0.8);
  else if (kind === 57) addRing(0xb8bcc4, x, 0.3, z, v, 0.6);
  else if (kind === 58) { toast('Signal fire', 'Every defender reaches further'); for (let i = 0; i < 3; i++) addRing(0xffa040, 0, 9, 0, 6 + i * 6, 0.8 + i * 0.2); }
  else if (kind === 59) { toast('Last stand', 'Nothing can hurt the keep'); keep(); }
  else if (kind === 60) addFx(haloGeo, 0x9dffb0, x, world.wallH * 0.6, z, 2.4, 0.9, 2);
  else if (kind === 61) { addRing(0xffb050, x, 0.3, z, v, 1.1, true); addFx(orbGeo, 0xffb050, x + 9, 42, z - 7, 2.4, 1.1, 0, [x, z], 0); }
}

function onSnap(m) {
  const prev = S.snap;
  S.snap = m; snapAt = performance.now();
  if (m.ak !== shownKey || !prev) { world.setAge(m.age, m.ak); shownKey = m.ak; }
  m.sg.forEach((v, i) => { const g = world.segs[i]; g.visible = v > 0; g.scale.y = 0.55 + 0.45 * (v / 100); });
  if (prev && m.ph === 'wave') {
    if (m.sg.some((v, i) => v === 0 && prev.sg[i] > 0)) { sfx('crumble'); shake(0.9); }
    if (m.th[0] < prev.th[0] - prev.th[1] * 0.004) { sfx('keep'); shake(0.35); }
  }
  const bHall = m.b[0];
  world.hall.scale.set(1 + 0.012 * (bHall - 1), 1 + 0.03 * (bHall - 1), 1 + 0.012 * (bHall - 1));

  // Defenders stand on their slot: a tower top or a wall segment.
  const seen = new Set();
  for (const [uid, slot, ki, rar, flags] of m.un) {
    seen.add(uid);
    const k = layout.units[ki];
    let o = units.get(uid);
    if (!o || o.rar !== rar) {
      if (o) scene.remove(o.m);
      const [x, , z] = slotPos(slot, m);
      o = { uid, k, rar, x, z, m: makeUnit(k, rar), rot: o ? o.rot : Math.atan2(x, z), kick: 0 };
      o.base = o.m.scale.x;
      scene.add(o.m);
      units.set(uid, o);
    }
    const [x, y, z, seg] = slotPos(slot, m);
    o.x = x; o.y = y; o.z = z; o.slot = slot; o.stun = !!(flags & 1);
    o.m.visible = seg < 0 || m.sg[seg] > 0;
  }
  for (const [uid, o] of units) if (!seen.has(uid)) { scene.remove(o.m); units.delete(uid); if (S.moving === uid) setMoving(null); }

  // Turrets on their courtyard spots, a little bigger with each level.
  seen.clear();
  for (const [ki, spot, lv] of m.tu) {
    seen.add(spot);
    let o = turrets.get(spot);
    if (!o || o.ki !== ki) {
      if (o) scene.remove(o.g);
      o = { ki, g: makeTurret(layout.turretKeys[ki]) };
      const [x, z] = layout.turretSpots[spot];
      o.g.position.set(x, 0, z);
      o.g.rotation.y = Math.atan2(x, z);
      scene.add(o.g);
      turrets.set(spot, o);
    }
    o.g.scale.setScalar(Math.min(1.5, 1 + 0.06 * (lv - 1)));
  }
  for (const [spot, o] of turrets) if (!seen.has(spot)) { scene.remove(o.g); turrets.delete(spot); }

  // Courtyard buildings on their plots; open, empty plots are staked out.
  if (m.yard) plotsOpen = m.yard.plots;
  m.pl.forEach((b, i) => {
    const p = plots[i], ki = b ? b[0] : -1;
    if (p.ki !== ki) {
      if (p.g) scene.remove(p.g);
      p.g = null; p.ki = ki;
      if (b) { p.g = makeBuilding(layout.buildingKeys[ki]); p.g.position.copy(p.marker.position); p.g.rotation.y = p.marker.rotation.y; scene.add(p.g); }
    }
    if (p.g) p.g.userData.setLevel(b[1]);
    p.marker.visible = !b && i < plotsOpen && m.ph !== 'over';
  });

  seen.clear();
  let boss = null;
  for (const [id, t, x, z, hp, flags] of m.en) {
    seen.add(id);
    let o = enemies.get(id);
    if (!o) {
      o = { id, t, rot: Math.atan2(-x, -z), hitT: 0, size: 0.92 + ((id * 37) % 17) / 100 };
      if (BOSS[t]) { sfx('roar'); shake(1.2); }
      enemies.set(id, o);
    }
    if (o.hp !== undefined && hp < o.hp) o.hitT = 0.12;
    o.hp = hp; o.flags = flags;
    if (BOSS[t] && (!boss || hp > boss.hp)) boss = { t, hp };
    track(o, x, z);
  }
  for (const id of enemies.keys()) if (!seen.has(id)) enemies.delete(id);

  seen.clear();
  for (const [id, kind, x, z, ang] of m.pr) {
    seen.add(id);
    let o = projs.get(id);
    if (!o) {
      const [geo, mat] = PROJ[kind] || [arrowGeo, arrowMat];
      o = { m: new THREE.Mesh(geo, mat), y: kind === 4 || kind === 13 ? 4.5 : 4, kind };
      sfx(kind === 8 || kind === 12 ? 'gun' : kind === 7 || kind === 5 || kind === 9 || kind === 11 ? 'thump' : 'shoot');
      o.m.rotation.y = ang;
      if (kind === 4) o.m.scale.setScalar(2.2);
      if (kind === 7) o.m.scale.setScalar(1.4);
      if (kind === 8) o.m.scale.setScalar(0.6);
      if (kind === 9) o.m.scale.setScalar(0.9);
      if (kind === 10) o.m.scale.set(0.5, 0.5, 1.6);
      if (kind === 12) o.m.scale.setScalar(1.25);
      scene.add(o.m);
      projs.set(id, o);
    }
    track(o, x, z);
  }
  for (const [id, o] of projs) if (!seen.has(id)) { scene.remove(o.m); projs.delete(id); }

  seen.clear();
  for (const [id, x, z, r, sort] of m.cl) {
    seen.add(id);
    if (!clouds.has(id)) { const c = new THREE.Mesh(cloudGeo, GROUND_MATS[sort] || cloudMat); c.position.set(x, sort ? 0.12 : 0.25, z); c.scale.set(r, sort ? 0.4 : 1, r); scene.add(c); clouds.set(id, c); }
  }
  for (const [id, c] of clouds) if (!seen.has(id)) { scene.remove(c); clouds.delete(id); }

  seen.clear();
  for (const [id, x, z] of m.mn) {
    seen.add(id);
    if (!mines.has(id)) { const c = new THREE.Mesh(mineGeo, mineMat); c.position.set(x, 0.1, z); c.castShadow = true; scene.add(c); mines.set(id, c); }
  }
  for (const [id, c] of mines) if (!seen.has(id)) { scene.remove(c); mines.delete(id); }

  for (const f of m.fx) playFx(f, m);

  if (prev && prev.ph !== m.ph) {
    setMood(m.ph);
    if (m.ph === 'reward' && m.pick) sfx({ level: 'level', relic: 'relic', event: 'event', doctrine: 'relic', mutation: 'mutate', muster: 'chime' }[m.pick.type] || 'chime');
    if (m.ph === 'wave') {
      sfx('horn');
      const bt = m.nb[0] === m.wave ? layout.enemies[m.nb[1]].key : null;
      toast(`Wave ${m.wave}`, bt ? `${MON[bt][0]} is coming` : m.dk ? 'A raid by night' : m.now !== 'clear' ? WEATHER_TXT[m.now][1] : '');
      discover('wx', [m.now]);
    }
    if (prev.ph === 'wave' && m.ph !== 'over') { toast(`Wave ${m.wave} cleared`, m.gold > prev.gold ? `+${fmt(m.gold - prev.gold)} gold` : ''); sfx('coin'); }
    // A new season is announced when the preparation for its first wave begins.
    // (Once: advancing an age in the same preparation brings the castle back here.)
    if (m.ph === 'prep' && prev.ph !== 'prep' && m.wave > 0 && m.wave % layout.seasonLen === 0 && seasonSaid !== m.wave) {
      seasonSaid = m.wave;
      const s = SEASON_TXT[seasonOf(m.wave + 1)];
      toast(`${s[1]}, year ${yearOf(m.wave + 1)}`, s[2], 4200, s[0]);
    }
    if (m.ph === 'over') {
      // The run is counted once: renown, records, the siege ladder, achievements.
      S.award = award(m.sum, (k) => ACH_TXT[k][3]);
      sfx('defeat');
    }
    if (m.ph !== 'prep') setMoving(null);
  } else if (prev && m.ph === 'reward' && prev.pick && m.pick && prev.pick.type !== m.pick.type) sfx({ level: 'level', relic: 'relic', event: 'event', mutation: 'mutate' }[m.pick.type] || 'chime');
  if (prev && m.gold < prev.gold && m.ph === 'prep') sfx('coin');
  if (m.ph !== 'wave') setAiming(null);

  // The codex remembers what has been met.
  // Mutations a high siege level starts with are met at once; the others as they are taken.
  if (!prev || Object.keys(m.mu).length !== Object.keys(prev.mu).length) discover('mut', Object.keys(m.mu));
  if (m.en.length && (!prev || m.en.length !== prev.en.length)) discover('mon', [...new Set(m.en.map((e) => layout.enemies[e[1]].key))]);
  if (m.ro && (!prev || !prev.ro || prev.ro.length !== m.ro.length)) discover('unit', [...new Set(m.ro.map((r) => layout.units[r[1]]))]);
  if (m.items && (!prev || !prev.items || Object.keys(prev.items).length !== Object.keys(m.items).length)) discover('item', Object.keys(m.items));

  updateHud(m, boss);
  updateSlotMarks();
}

// ---- Aiming an ability at the ground ----
function setAiming(k) {
  S.aiming = k;
  aimRing.visible = !!k;
  if (k) aimRing.scale.setScalar(layout.abilities[k].r);
  document.body.style.cursor = k ? 'crosshair' : '';
}
S.hooks.setAiming = setAiming;
const ray = new THREE.Raycaster(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), mouse = new THREE.Vector2(), hit = new THREE.Vector3();
function groundAt(e) {
  mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(mouse, camera);
  return ray.ray.intersectPlane(ground, hit);
}

// ---- Moving defenders: click one in the Army tab or on the wall, then click the place they should stand ----
function setMoving(uid) {
  S.moving = uid;
  updateSlotMarks();
  if (S.snap) updateHud(S.snap, null, true);
}
S.hooks.setMoving = setMoving;
function updateSlotMarks() {
  const m = S.snap, u = m && S.moving != null ? units.get(S.moving) : null;
  const wallOnly = u && (layout.unitStats[u.k].melee || layout.unitStats[u.k].guard || layout.unitStats[u.k].mine);
  const taken = new Map();
  if (u) for (const o of units.values()) taken.set(o.slot, o);
  slotMarks.forEach((mk, i) => {
    const [x, y, z, seg] = u ? slotPos(i, m) : [0, 0, 0, 0];
    const other = taken.get(i), otherWallOnly = other && (layout.unitStats[other.k].melee || layout.unitStats[other.k].guard || layout.unitStats[other.k].mine);
    const ok = u && i !== u.slot && !(wallOnly && seg < 0) && !(otherWallOnly && layout.slots[u.slot][2] < 0);
    mk.visible = !!ok;
    if (ok) { mk.position.set(x, y + 0.25, z); mk.material = slotMats[other ? 1 : 0]; }
  });
  S.hooks.showRange(u ? u.uid : null);
}
// The slot nearest to a click, within a few pixels.
function slotAt(e) {
  let best = -1, bd = 34;
  layout.slots.forEach((_, i) => {
    const [x, y, z] = slotPos(i, S.snap);
    projV.set(x, y + 0.8, z).project(camera);
    const d = Math.hypot((projV.x * 0.5 + 0.5) * innerWidth - e.clientX, (-projV.y * 0.5 + 0.5) * innerHeight - e.clientY);
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}
S.hooks.showRange = (uid) => {
  const m = S.snap, r = uid != null && m && m.ro ? m.ro.find((x) => x[0] === uid) : null, o = r ? units.get(uid) : null;
  if (!r || !o || !r[8]) { rangeRing.visible = false; return; }
  rangeRing.position.set(o.x, 0.2, o.z); rangeRing.scale.setScalar(r[8]); rangeRing.visible = true;
};

let dragging = null;
canvas.addEventListener('mousemove', (e) => {
  if (S.aiming && groundAt(e)) aimRing.position.set(hit.x, 0.3, hit.z);
  if (dragging) { focus.x = clamp(dragging.fx - (e.clientX - dragging.x) * 0.11 * zoom, -60, 60); focus.z = clamp(dragging.fz - (e.clientY - dragging.y) * 0.15 * zoom, -60, 60); }
});
canvas.addEventListener('mousedown', (e) => { if (e.button === 2 && S.joined && !S.aiming && S.moving == null) dragging = { x: e.clientX, y: e.clientY, fx: focus.x, fz: focus.z }; });
addEventListener('mouseup', () => { dragging = null; });
canvas.addEventListener('click', (e) => {
  const m = S.snap;
  if (!S.joined || !m) return;
  if (S.aiming) {
    if (!groundAt(e)) return;
    send({ t: 'ability', k: S.aiming, x: Math.round(hit.x * 10) / 10, z: Math.round(hit.z * 10) / 10 });
    setAiming(null);
    return;
  }
  if (m.ph !== 'prep') return;
  const slot = slotAt(e);
  if (slot < 0) { if (S.moving != null) setMoving(null); return; }
  const there = [...units.values()].find((o) => o.slot === slot);
  if (S.moving != null) {
    if (there && there.uid === S.moving) { setMoving(null); return; }
    send({ t: 'move', u: S.moving, s: slot });
    sfx('click');
    setMoving(null);
  } else if (there && !(m.un.find((u) => u[0] === there.uid)[4] & 2)) { setMoving(there.uid); sfx('click'); }
});
canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); if (S.aiming) setAiming(null); if (S.moving != null) setMoving(null); });

// ---- Camera and keys ----
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const keys = new Set(), focus = new THREE.Vector3(0, 0, 4);
let zoom = 1, snapAt = 0;
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  keys.add(e.code);
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
addEventListener('wheel', (e) => { if (S.joined && !e.target.closest?.('#shop, #modal, #overlay')) zoom = clamp(zoom * (1 + e.deltaY * 0.001), 0.4, 1.6); }, { passive: true });
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); if (cartoon) cartoon.resize(); });
const down = (...c) => c.some((k) => keys.has(k));

// ---- Render loop ----
let last = performance.now(), t = 0;
function loop() { requestAnimationFrame(loop); draw(); }
function draw() {
  const now = performance.now(), dt = Math.max(0, Math.min((now - last) / 1000, 0.05));
  last = now; t += dt;
  const m = S.snap;
  horde.begin();
  if (m) {
    const a = Math.min(1, (now - snapAt) / SNAP_MS);
    for (const o of enemies.values()) {
      place(o, a);
      const dx = o.cx - o.px, dz = o.cz - o.pz, moving = Math.hypot(dx, dz) > 0.02;
      if (moving) o.rot = lerpAngle(o.rot, Math.atan2(dx, dz), dt * 8);
      const champ = o.flags & 16;
      if (o.hitT > 0) o.hitT -= dt;
      const s = BEAST_SCALE[o.t] * o.size * (champ ? 1.6 : 1), scale = s * (1 + 0.18 * Math.max(0, o.hitT) / 0.12);
      if (o.flags & 8) { horde.mound(o.rx, o.rz, 0.9 * s + Math.sin(t * 9 + o.id) * 0.06); continue; }
      const w = Math.sin(t * (o.t === 0 ? 14 : 8) + o.id) * (moving ? 0.7 : 0.12);
      const fly = FLY[o.t] ? 5 + Math.sin(t * 2 + o.id) * 0.4 : GHOST[o.t] ? 0.7 + Math.sin(t * 2.4 + o.id) * 0.2 : 0;
      horde.add(o.t, o.rx, hAt(o.rx, o.rz) + fly + Math.abs(w) * 0.08 * scale, o.rz, o.rot, scale, w, Math.sin(t * 9 + o.id) * 0.7);
      if (o.hp < 100 && !BOSS[o.t]) horde.bar(o.rx, 2.2 * s + fly, o.rz, 1.6 * s * (o.hp / 100), camera.quaternion);
      for (let b = 0; b < 3; b++) if (o.flags & (1 << b)) horde.ring(b, o.rx, 0.15 + b * 0.18 + fly, o.rz, s);
      if (o.flags & 32) horde.ring(3, o.rx, 0.7 + fly, o.rz, s * 0.8);
      if (o.flags & 64) horde.ring(4, o.rx, 1.9 * s + fly + Math.sin(t * 12 + o.id) * 0.08, o.rz, s * 0.55);   // stunned: stars round its head
      if (o.flags & 256) horde.ring(5, o.rx, 2.5 * s + fly, o.rz, s * 0.4);   // fated
      if (o.flags & 128) horde.ring(6, o.rx, 0.95 * s + fly, o.rz, s * 1.15);   // a shell
      if (champ) horde.crown(o.rx, 2.5 * s + fly, o.rz, s, t * 2);
    }
    // Defenders and turrets turn towards the nearest monster, or look outwards when all is quiet.
    for (const o of units.values()) {
      let aim = Math.atan2(o.x, o.z), bd = 30;
      for (const e of enemies.values()) { if (e.flags & 8) continue; const d = Math.hypot(e.rx - o.x, e.rz - o.z); if (d < bd) { bd = d; aim = Math.atan2(e.rx - o.x, e.rz - o.z); } }
      o.rot = lerpAngle(o.rot, aim, dt * 6);
      if (o.kick > 0) o.kick -= dt;
      const k = Math.max(0, o.kick) / 0.14, sel = S.moving === o.uid ? 0.25 + Math.sin(t * 6) * 0.12 : 0;
      o.m.position.set(o.x, o.y + k * 0.14 + sel, o.z);
      o.m.scale.setScalar(o.base * (1 + 0.1 * k));
      o.m.rotation.set(0, o.rot + (o.stun ? t * 7 : 0), o.stun ? 0.35 : 0);
    }
    for (const o of turrets.values()) {
      const p = o.g.position, top = o.g.userData.top;
      let aim = null, bd = 34;
      for (const e of enemies.values()) { if (e.flags & 8) continue; const d = Math.hypot(e.rx - p.x, e.rz - p.z); if (d < bd) { bd = d; aim = Math.atan2(e.rx - p.x, e.rz - p.z); } }
      if (aim !== null) top.rotation.y = lerpAngle(top.rotation.y, aim - o.g.rotation.y, dt * 6);
    }
    for (const o of projs.values()) { place(o, a); o.m.position.set(o.rx, o.y, o.rz); if (o.kind === 3) o.m.rotation.x += dt * 8; }
    for (const c of clouds.values()) c.rotation.y += dt * 0.5;
    for (const mk of slotMarks) if (mk.visible) mk.rotation.y = t * 1.5;
  }
  horde.end();
  world.flag.rotation.y = Math.sin(t * 2.2) * 0.35;
  mineMat.emissiveIntensity = 0.4 + Math.max(0, Math.sin(t * 5)) * 1.6;
  for (let i = fxs.length - 1; i >= 0; i--) {
    const f = fxs[i], k = (f.t += dt) / f.dur;
    if (k >= 1) { scene.remove(f.m); f.m.material.dispose(); if (f.line) f.m.geometry.dispose(); fxs.splice(i, 1); continue; }
    if (f.line) { f.m.material.opacity = 1 - k; continue; }
    if (f.fade) { f.m.material.opacity = f.fade * (1 - k); continue; }
    if (f.ring) { f.m.scale.setScalar(f.size * (f.ring > 0 ? 0.1 + 0.9 * k : 1.6 - 0.6 * k)); f.m.material.opacity = f.ring > 0 ? 0.9 * (1 - k) : 0.4 + 0.5 * Math.abs(Math.sin(k * 20)); continue; }
    if (f.to) { f.m.position.set(f.from[0] + (f.to[0] - f.from[0]) * k, f.y0 * (f.arc ? 1 : 1 - k) + Math.sin(k * Math.PI) * f.arc, f.from[1] + (f.to[1] - f.from[1]) * k); continue; }
    f.m.scale.setScalar(f.size * (0.3 + 0.7 * k));
    f.m.position.y += f.rise * dt;
    f.m.material.opacity = 0.7 * (1 - k);
  }
  const phase = !S.joined || !m ? 'menu' : m.ph === 'wave' && m.dk ? 'night' : m.ph;
  // The weather of the wave being fought, or of the one that is coming; the season of that wave.
  const inRun = S.joined && m && m.ph !== 'over', weather = !inRun ? 'clear' : m.ph === 'wave' ? m.now : m.wx[0] || 'clear';
  const season = !S.joined || !m ? 'spring' : seasonOf(m.ph === 'wave' || m.ph === 'over' ? m.wave : m.wave + 1);
  const base = LOOKS[phase], wl = WEATHER_LOOK[weather];
  updateLook(wl ? { ...base, fog: Math.min(FOG_MAX, base.fog + wl.fog), si: base.si * wl.dim, hi: base.hi * (0.6 + 0.4 * wl.dim), sky: mixHex(base.sky, wl.sky, wl.mix) } : base, Math.min(1, dt * 0.9));
  if (flash > 0) flash = Math.max(0, flash - dt * 5);
  updateAir(dt, weather);
  updateSeason(dt, season, weather);
  // The dragon keeps watch in the Dragonfire Age and after it.
  const roost = !!(S.joined && m && m.path === 'legend' && m.age >= 5);
  dragon.g.visible = roost;
  if (roost) {
    const a = t * 0.32, r = 25;
    dragon.g.position.set(Math.cos(a) * r, 19 + Math.sin(t * 1.3) * 1.4, Math.sin(a) * r);
    dragon.g.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a));
    dragon.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * (0.2 + Math.sin(t * 4.2) * 0.5); });
  }
  fireMat.emissiveIntensity = 1.8 + Math.sin(t * 17) * 0.3 + Math.sin(t * 7.3) * 0.3;
  orbMat.emissiveIntensity = 2.2 + Math.sin(t * 4) * 0.8;
  if (S.joined) {
    const pan = 40 * zoom * dt;
    focus.x = clamp(focus.x + (down('KeyD', 'ArrowRight') - down('KeyA', 'ArrowLeft')) * pan, -60, 60);
    focus.z = clamp(focus.z + (down('KeyS', 'ArrowDown') - down('KeyW', 'ArrowUp')) * pan, -60, 60);
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
  sun.target.position.copy(S.joined ? focus : tmpV.set(0, 0, 0));
  sun.position.copy(look.sp).normalize().multiplyScalar(110).add(sun.target.position);
  updateNumbers(dt);
  if (cartoon) cartoon.render(); else renderer.render(scene, camera);
}

applySettings();
initHud({ dev: DEV, keys });
initMenu({ startRun, applySettings });
loop();
// For tests and debugging from the console.
window.hordewall = { S, startRun, leaveRun, draw, units, enemies, turrets, plots, world, horde, dragon, renderer, scene, camera };
