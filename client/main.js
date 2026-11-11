// Client: sends input, draws whatever the server says. No game rules live here.
import * as THREE from 'three';
import { buildWorld, makeHero, poseHero, makeBeast, hAt, winMat, fireMat, orbMat, TEAM_COLORS, GLOW, BEAST_SCALE, MORTAR_POS, BALLISTA_POS } from './models.js';

const $ = (id) => document.getElementById(id);
const CLASS_TR = { knight: 'Şövalye', archer: 'Okçu', mage: 'Büyücü' };
const SNAP_MS = 50;
const B_KEYS = ['hall', 'walls', 'archers', 'mine', 'smith'];
const B_TR = {
  hall: ['İç kale', 'Can +600 · diğer seviyelerin sınırı · her seviyede özellik seçimi'],
  walls: ['Surlar', 'Sur ve kapı canı +%50, surlar yükselir'],
  archers: ['Okçular', 'Surlara daha çok okçu, daha çok hasar'],
  mine: ['Altın madeni', 'Her dalga sonunda +25 altın'],
  smith: ['Demirci', 'Daha üst kademe silah ve zırhı açar'],
};
const STAT_TR = [['str', 'Güç', 'Hasar +%8'], ['agi', 'Çeviklik', 'Saldırı hızı +%6, hareket +%3'], ['vit', 'Dayanıklılık', 'Can +15'], ['crit', 'Kritik', 'Çift hasar şansı +%5']];
const GEAR_TR = [['wpn', 'Silah', 'Kademe başına hasar +%35', 15], ['arm', 'Zırh', 'Kademe başına alınan hasar -%12', 16]];
const P_TR = {
  mortar: ['Havan', 'Kalabalığın ortasına patlayan gülle atar'],
  ballista: ['Balista', 'En güçlü canavara ağır ok atar'],
  happy: ['Mutlu halk', 'Dalga sonu geliri +%50'],
  sharp: ['Keskin oklar', 'Sur okçuları +%30 hasar'],
  rapid: ['Hızlı yaylar', 'Sur okçuları +%20 hızlı atar'],
  masons: ['Usta taşçılar', 'Onarım %40 ucuzlar'],
};

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
Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 260 });
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.05;
scene.add(hemi, sun, sun.target);

// Lighting follows the phase: day while preparing, dusk during a wave, night when the castle falls.
const LOOKS = {
  prep: { sky: 0x8db8dc, fog: 0.0045, hs: 0xcfe4ff, hg: 0x4a5a30, hi: 1.2, sc: 0xfff1d6, si: 6.5, sp: [40, 60, 25], win: 0.1, tor: 0 },
  wave: { sky: 0xd0906a, fog: 0.007, hs: 0xffd2b0, hg: 0x4a4638, hi: 1.5, sc: 0xff9550, si: 6, sp: [62, 28, 18], win: 1, tor: 45 },
  over: { sky: 0x0b1424, fog: 0.012, hs: 0x4a6aa8, hg: 0x101820, hi: 0.7, sc: 0x8fb0ff, si: 1.9, sp: [-30, 50, 30], win: 2.2, tor: 90 },
};
const look = { ...LOOKS.prep, sky: new THREE.Color(LOOKS.prep.sky), hs: new THREE.Color(LOOKS.prep.hs), hg: new THREE.Color(LOOKS.prep.hg), sc: new THREE.Color(LOOKS.prep.sc), sp: new THREE.Vector3(...LOOKS.prep.sp) };
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

let ws = null, myId = null, world = null, layout = null, snap = null, snapAt = 0;
const players = new Map(), enemies = new Map(), projs = new Map(), fxs = [];

function connect(cls) {
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);
  ws.onopen = () => send({ t: 'join', cls });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.t === 'hello') { myId = m.id; layout = m.layout; world = buildWorld(scene, layout); }
    else if (m.t === 's' && world) onSnap(m);
    else if (m.t === 'full') showOverlay('Oda dolu', 'En fazla 4 oyuncu girebilir.');
  };
  ws.onclose = () => { if (myId) showOverlay('Bağlantı koptu', 'Sayfayı yenileyip yeniden bağlan.'); };
}
const send = (m) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };

function showOverlay(title, text) {
  $('ovTitle').textContent = title; $('ovText').textContent = text;
  $('classes').hidden = true; $('overlay').hidden = false;
}
for (const b of document.querySelectorAll('#classes button')) b.onclick = () => { $('overlay').hidden = true; connect(b.dataset.c); };

let toastTimer = 0;
function toast(text, ms = 1600) {
  $('toast').textContent = text; $('toast').style.opacity = 1;
  clearTimeout(toastTimer);
  if (ms) toastTimer = setTimeout(() => { $('toast').style.opacity = 0; }, ms);
}

// Remember where the entity was drawn, so the next snapshot is blended in without a jump.
function track(o, x, z) { o.px = o.rx ?? x; o.pz = o.rz ?? z; o.cx = x; o.cz = z; }
function place(o, a) { o.rx = o.px + (o.cx - o.px) * a; o.rz = o.pz + (o.cz - o.pz) * a; }
function lerpAngle(a, b, k) { const d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + d * Math.min(1, k); }

const barMat = new THREE.SpriteMaterial({ color: 0xe5484d, depthTest: false });
const ringGeo = new THREE.RingGeometry(0.75, 0.95, 28).rotateX(-Math.PI / 2);
const arrowGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.2, 5).rotateX(Math.PI / 2);
const arrowMat = new THREE.MeshStandardMaterial({ color: 0xd8c9a0, roughness: 0.6 });
const orbGeo = new THREE.SphereGeometry(0.3, 12, 10);
const puffGeo = new THREE.SphereGeometry(1, 14, 10);
const haloGeo = new THREE.TorusGeometry(1, 0.07, 6, 28).rotateX(Math.PI / 2);

function onSnap(m) {
  const prevPhase = snap && snap.ph;
  snap = m; snapAt = performance.now();

  const seen = new Set();
  m.pl.forEach((row, slot) => {
    const [id, cls, x, z, aim, , , , , , dead, atkN] = row;
    seen.add(id);
    let o = players.get(id);
    if (!o) {
      o = { id, rot: aim, swing: 0, atkN };
      o.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: id === myId ? 0xffffff : TEAM_COLORS[slot % 4], transparent: true, opacity: 0.75, depthTest: false }));
      o.ring.renderOrder = 5;
      scene.add(o.ring);
      players.set(id, o);
    }
    if (o.cls !== cls) {
      if (o.h) scene.remove(o.h.g);
      o.cls = cls; o.h = makeHero(cls, TEAM_COLORS[slot % 4]);
      scene.add(o.h.g);
    }
    if (atkN !== o.atkN) { o.swing = 1; o.atkN = atkN; }
    o.aim = aim; o.dead = dead; o.row = row;
    track(o, x, z);
  });
  for (const [id, o] of players) if (!seen.has(id)) { scene.remove(o.h.g, o.ring); players.delete(id); }

  seen.clear();
  let boss = null;
  for (const [id, t, x, z, hp] of m.en) {
    seen.add(id);
    let o = enemies.get(id);
    if (!o) {
      o = { id, t, rot: Math.atan2(-x, -z), ...makeBeast(t) };
      scene.add(o.g);
      enemies.set(id, o);
    }
    o.hp = hp;
    if (t === 2) boss = hp;
    else if (hp < 100 && !o.bar) { o.bar = new THREE.Sprite(barMat); scene.add(o.bar); }
    track(o, x, z);
  }
  for (const [id, o] of enemies) if (!seen.has(id)) { scene.remove(o.g); if (o.bar) scene.remove(o.bar); enemies.delete(id); }

  seen.clear();
  for (const [id, kind, x, z, ang] of m.pr) {
    seen.add(id);
    let o = projs.get(id);
    if (!o) {
      o = { m: new THREE.Mesh(kind === 1 ? orbGeo : arrowGeo, kind === 1 ? orbMat : arrowMat), y: kind === 2 ? 4 : kind === 4 ? 5 : 1.5 };
      o.m.rotation.y = ang;
      if (kind === 4) { o.m.scale.setScalar(2.4); world.ballista.rotation.y = ang; }
      scene.add(o.m);
      projs.set(id, o);
    }
    track(o, x, z);
  }
  for (const [id, o] of projs) if (!seen.has(id)) { scene.remove(o.m); projs.delete(id); }

  for (const [kind, x, z, v] of m.fx) {
    if (kind === 0) addFx(puffGeo, GLOW[v], x, 0.8 * BEAST_SCALE[v], z, BEAST_SCALE[v] * 1.3, 0.35);
    else if (kind === 1) addFx(puffGeo, 0x6fdcff, x, 1, z, v, 0.3);
    else if (kind === 2) { addFx(haloGeo, 0xffd75a, x, 0.3, z, 1.3, 0.9, 3); if (v === myId) toast('Seviye atladın · 1 stat puanı'); }
    else if (kind === 3) addFx(puffGeo, 0xe5484d, x, 1, z, 1.6, 0.5);
    else if (kind === 4) toast(`${B_TR[v][0]} yükseltildi`);
    else if (kind === 5) addFx(orbGeo, 0x222222, MORTAR_POS[0], 2, MORTAR_POS[2], 1.6, v, 0, [x, z]);
    else if (kind === 6) toast(`Yeni özellik: ${P_TR[v][0]}`);
  }

  const [bHall, bWalls, bArchers, bMine, bSmith] = m.b, grow = 1 + 0.12 * (bWalls - 1);
  m.sg.forEach((v, i) => { const g = world.segs[i]; g.visible = v > 0; g.scale.y = (0.55 + 0.45 * (v / 100)) * grow; });
  for (const g of world.towers) g.scale.y = 1 + 0.1 * (bWalls - 1);
  world.hall.scale.y = 1 + 0.08 * (bHall - 1);
  world.mine.visible = bMine > 0; world.smith.visible = bSmith > 0;
  world.mortar.visible = m.pk[0] > 0; world.ballista.visible = m.pk[1] > 0;
  world.guards.forEach((g, i) => {
    if (!g) return;
    g.visible = i < layout.archerCount[bArchers] && m.sg[layout.posts[i][2]] > 0;
    g.position.y = world.wallH * grow * (0.55 + 0.45 * (m.sg[layout.posts[i][2]] / 100));
  });
  if (prevPhase !== m.ph && m.ph === 'wave') toast(m.wave % 10 === 0 ? `Dalga ${m.wave} · Kraliçe geliyor` : `Dalga ${m.wave}`);
  updateHud(m, boss);
}

function addFx(geo, color, x, y, z, size, dur, rise = 0, to = null) {
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false }));
  m.position.set(x, y, z);
  scene.add(m);
  if (to) { m.material.opacity = 1; m.scale.setScalar(size); }
  fxs.push({ m, t: 0, dur, size, rise, to, from: [x, z] });
}

const pct = (a, b) => `${Math.max(0, Math.min(100, (a / b) * 100))}%`;
function updateHud(m, boss) {
  const me = players.get(myId), row = me && me.row;
  if (m.ph === 'prep') {
    const next = m.wave + 1;
    $('phase').textContent = `Hazırlık · ${m.tm} sn`;
    $('sub').textContent = `Sıradaki: Dalga ${next}${next % 10 === 0 ? ' (Kraliçe)' : ''}${row && row[12] && m.pl.length > 1 ? ' · Hazırsın, diğerleri bekleniyor' : ''}`;
  } else if (m.ph === 'wave') {
    $('phase').textContent = `Dalga ${m.wave}`;
    $('sub').textContent = `${m.left} canavar kaldı`;
  } else {
    $('phase').textContent = 'Kale düştü';
    $('sub').textContent = `Ulaştığın dalga: ${m.reached} · ${m.tm} sn sonra baştan başlıyor`;
  }
  $('ready').hidden = !(m.ph === 'prep' && row && !row[12]);
  $('boss').hidden = boss === null;
  if (boss !== null) { $('bossBar').style.width = `${boss}%`; $('bossTxt').textContent = `%${boss}`; }
  $('thBar').style.width = pct(m.th[0], m.th[1]);
  $('thTxt').textContent = `${m.th[0]} / ${m.th[1]}`;
  $('gold').textContent = m.gold;
  renderBuild(m);
  $('team').replaceChildren(...m.pl.map((r) => {
    const d = document.createElement('div'), a = document.createElement('span'), b = document.createElement('span');
    a.textContent = `${CLASS_TR[r[1]]}${r[0] === myId ? ' (sen)' : ''}`;
    b.textContent = r[10] ? `${r[10]} sn` : `Sv ${r[7]} · ${r[5]} can`;
    d.append(a, b);
    return d;
  }));
  if (!row) return;
  $('meName').textContent = CLASS_TR[row[1]];
  $('hpTxt').textContent = `${row[5]} / ${row[6]}`;
  $('hpBar').style.width = pct(row[5], row[6]);
  $('lvl').textContent = `Seviye ${row[7]}`;
  $('xpTxt').textContent = `${row[8]} / ${row[9]} XP`;
  $('xpBar').style.width = pct(row[8], row[9]);
  if (row[10]) toast(`Yeniden doğuyorsun: ${row[10]}`, 700);
  const sig = JSON.stringify([row[13], row[14], row[15], row[16]]);
  if (sig === statSig) return;
  statSig = sig;
  $('stats').innerHTML = `<div class="lbl"><span>Silah K${row[15]} · Zırh K${row[16]}</span><span>${row[13] ? `${row[13]} stat puanı` : ''}</span></div>`
    + STAT_TR.map(([k, n, d], i) => `<button data-stat="${k}" title="${d}" ${row[13] ? '' : 'disabled'}>${n} ${row[14][i]}${row[13] ? ' +' : ''}</button>`).join('');
}

// ---- Build panel: upgrades, repairs and the perk choice ----
let buildSig = '', statSig = '';
$('stats').onclick = (e) => { const b = e.target.closest('button'); if (b && !b.disabled) send({ t: 'stat', k: b.dataset.stat }); };
function renderBuild(m) {
  const prep = m.ph === 'prep', show = prep || (m.of && m.ph !== 'over');
  const me = players.get(myId), r = me && me.row;
  const sig = JSON.stringify([show, prep, m.b, m.rc, m.pk, m.of, m.gold, r && r[15], r && r[16]]);
  if (sig === buildSig) return;
  buildSig = sig;
  $('build').hidden = !show;
  if (!show) return;
  let h = '';
  if (m.of) {
    h += '<h3>Özellik seç</h3>';
    for (const k of m.of) h += `<button class="row perk" data-perk="${k}"><b>${P_TR[k][0]}</b><span>${P_TR[k][1]}</span></button>`;
  }
  if (prep) {
    h += '<h3>Kale</h3>';
    B_KEYS.forEach((k, i) => {
      const l = m.b[i], d = layout.buildings[k], cost = d.cost[l];
      let label = `${cost} altın`, off = m.gold < cost;
      if (l >= d.max) { label = 'En üst seviye'; off = true; }
      else if (k !== 'hall' && l >= m.b[0]) { label = `İç kale Sv ${l + 1} gerekli`; off = true; }
      else if (k === 'hall' && m.of) { label = 'Önce özellik seç'; off = true; }
      h += `<div class="row"><div><b>${B_TR[k][0]} <i>${l ? `Sv ${l}` : 'yok'}</i></b><span>${B_TR[k][1]}</span></div><button data-up="${k}" ${off ? 'disabled' : ''}>${l ? label : label.replace('altın', 'altın · kur')}</button></div>`;
    });
    if (m.rc[0] > 0) h += `<div class="row"><div><b>Surları onar</b></div><button data-repair="walls" ${m.gold ? '' : 'disabled'}>${m.rc[0]} altın</button></div>`;
    if (m.rc[1] > 0) h += `<div class="row"><div><b>İç kaleyi onar</b></div><button data-repair="hall" ${m.gold ? '' : 'disabled'}>${m.rc[1]} altın</button></div>`;
  }
  if (prep && r) {
    h += '<h3>Demirci</h3>';
    if (!m.b[4]) h += '<p>Silah ve zırh almak için önce demirciyi kur.</p>';
    else for (const [kind, name, desc, idx] of GEAR_TR) {
      const t = r[idx], costs = layout.gear[kind];
      let label = `${costs[t]} altın`, off = m.gold < costs[t];
      if (t >= costs.length) { label = 'En üst kademe'; off = true; }
      else if (m.b[4] < t) { label = `Demirci Sv ${t} gerekli`; off = true; }
      h += `<div class="row"><div><b>${name} <i>Kademe ${t}</i></b><span>${desc}</span></div><button data-gear="${kind}" ${off ? 'disabled' : ''}>${label}</button></div>`;
    }
  }
  const owned = layout.perks.map((k, i) => (m.pk[i] ? `${P_TR[k][0]}${m.pk[i] > 1 ? ` ×${m.pk[i]}` : ''}` : '')).filter(Boolean);
  if (owned.length) h += `<p>Özellikler: ${owned.join(', ')}</p>`;
  $('build').innerHTML = h;
}
$('build').onclick = (e) => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  if (b.dataset.up) send({ t: 'up', b: b.dataset.up });
  else if (b.dataset.repair) send({ t: 'repair', what: b.dataset.repair });
  else if (b.dataset.perk) send({ t: 'perk', k: b.dataset.perk });
  else if (b.dataset.gear) send({ t: 'gear', k: b.dataset.gear });
};

// ---- Input ----
const keys = new Set(), mouse = new THREE.Vector2(), ray = new THREE.Raycaster(), aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1), aimPt = new THREE.Vector3();
let mouseDown = false, localAim = 0, zoom = 1;
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'Space') { e.preventDefault(); send({ t: 'ready' }); }
  const dev = { KeyG: 'gold', KeyH: 'boss', KeyK: 'hurt' }[e.code];   // only honoured by a server started with --dev
  if (dev) send({ t: 'dev', k: dev });
  const cls = { Digit1: 'knight', Digit2: 'archer', Digit3: 'mage' }[e.code];
  if (cls) send({ t: 'cls', cls });
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); mouseDown = false; });
addEventListener('mousemove', (e) => mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1));
renderer.domElement.addEventListener('mousedown', (e) => { if (e.button === 0) mouseDown = true; });
addEventListener('mouseup', () => { mouseDown = false; });
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('wheel', (e) => { zoom = Math.min(1.5, Math.max(0.4, zoom * (1 + e.deltaY * 0.001))); }, { passive: true });
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
$('ready').onclick = () => send({ t: 'ready' });
const down = (...c) => c.some((k) => keys.has(k));
setInterval(() => {
  if (!myId) return;
  send({ t: 'in', mx: down('KeyD', 'ArrowRight') - down('KeyA', 'ArrowLeft'), mz: down('KeyS', 'ArrowDown') - down('KeyW', 'ArrowUp'), aim: Math.round(localAim * 100) / 100, atk: mouseDown });
}, SNAP_MS);

// ---- Render loop ----
const focus = new THREE.Vector3(0, 0, 8);
let last = performance.now(), t = 0;
function frame() {
  requestAnimationFrame(frame);
  const now = performance.now(), dt = Math.min((now - last) / 1000, 0.05);
  last = now; t += dt;
  if (world && snap) {
    const a = Math.min(1, (performance.now() - snapAt) / SNAP_MS);
    const me = players.get(myId);
    if (me && !me.dead) {
      ray.setFromCamera(mouse, camera);
      if (ray.ray.intersectPlane(aimPlane, aimPt)) localAim = Math.atan2(aimPt.x - (me.rx ?? me.cx), aimPt.z - (me.rz ?? me.cz));
      me.aim = localAim;
    }
    for (const o of players.values()) {
      place(o, a);
      const walk = Math.min(1, Math.hypot(o.cx - o.px, o.cz - o.pz) / (SNAP_MS / 1000) / 6);
      o.swing = Math.max(0, o.swing - dt * 4);
      o.rot = lerpAngle(o.rot, o.aim, dt * 20);
      o.h.g.visible = o.ring.visible = !o.dead;
      o.h.g.position.set(o.rx, 0, o.rz);
      o.h.g.rotation.y = o.rot;
      o.ring.position.set(o.rx, 0.06, o.rz);
      poseHero(o.h, walk, o.swing, t + o.id);
    }
    for (const o of enemies.values()) {
      place(o, a);
      const dx = o.cx - o.px, dz = o.cz - o.pz, moving = Math.hypot(dx, dz) > 0.02;
      if (moving) o.rot = lerpAngle(o.rot, Math.atan2(dx, dz), dt * 8);
      const w = Math.sin(t * (o.t === 0 ? 14 : 8) + o.id) * (moving ? 0.7 : 0.12);
      o.legs.forEach((l, i) => { l.rotation.x = (i === 0 || i === 3 ? 1 : -1) * w; });
      o.g.position.set(o.rx, hAt(o.rx, o.rz) + Math.abs(w) * 0.08 * o.g.scale.y, o.rz);
      o.g.rotation.y = o.rot;
      if (o.bar) { const s = BEAST_SCALE[o.t]; o.bar.position.set(o.rx, 2.2 * s, o.rz); o.bar.scale.set(1.6 * s * (o.hp / 100), 0.14, 1); }
    }
    for (const o of projs.values()) { place(o, a); o.m.position.set(o.rx, o.y, o.rz); }
    if (me) focus.lerp(tmpV.set(me.rx, 0, me.rz), Math.min(1, dt * 7));
    world.flag.rotation.y = Math.sin(t * 2.2) * 0.35;
  }
  for (let i = fxs.length - 1; i >= 0; i--) {
    const f = fxs[i], k = (f.t += dt) / f.dur;
    if (k >= 1) { scene.remove(f.m); f.m.material.dispose(); fxs.splice(i, 1); continue; }
    if (f.to) { f.m.position.set(f.from[0] + (f.to[0] - f.from[0]) * k, 2 + Math.sin(k * Math.PI) * 14, f.from[1] + (f.to[1] - f.from[1]) * k); continue; }
    f.m.scale.setScalar(f.size * (0.3 + 0.7 * k));
    f.m.position.y += f.rise * dt;
    f.m.material.opacity = 0.7 * (1 - k);
  }
  updateLook(LOOKS[snap ? snap.ph : 'prep'], Math.min(1, dt * 0.9));
  fireMat.emissiveIntensity = 1.8 + Math.sin(t * 17) * 0.3 + Math.sin(t * 7.3) * 0.3;
  orbMat.emissiveIntensity = 2.2 + Math.sin(t * 4) * 0.8;
  camera.position.set(focus.x, 56 * zoom, focus.z + 40 * zoom);
  camera.lookAt(focus.x, 1, focus.z);
  sun.target.position.copy(focus);
  sun.position.copy(look.sp).normalize().multiplyScalar(110).add(focus);
  renderer.render(scene, camera);
}
frame();
