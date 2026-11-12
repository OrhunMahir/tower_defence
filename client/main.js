// Client: sends the commander's choices, draws whatever the server says. No game rules live here.
import * as THREE from 'three';
import { buildWorld, makeUnit, makeBeast, hAt, winMat, fireMat, orbMat, GLOW, BEAST_SCALE, MORTAR_POS, TOWER_TOP } from './models.js';

const $ = (id) => document.getElementById(id);
const SNAP_MS = 50;
const MONSTERS = [['Runner', 'Runners'], ['Brute', 'Brutes'], ['Queen', 'Queens']];
const UNIT_TXT = {
  archer: ['Archer', 'Fast shots at the nearest monster'],
  spear: ['Spearman', 'Stabs monsters at the foot of his wall'],
  mage: ['Mage', 'Exploding orbs, area damage'],
  crossbow: ['Crossbowman', 'Slow heavy bolts at the toughest monster'],
};
const B_KEYS = ['hall', 'walls', 'barracks', 'mine'];
const B_TXT = {
  hall: ['Keep', '+600 HP · caps every other level · a perk choice per level'],
  walls: ['Walls', '+50% wall HP · room for more defenders'],
  barracks: ['Barracks', '+25% damage for all defenders · unlocks promotions'],
  mine: ['Gold mine', '+25 gold after every wave'],
};
const P_TXT = {
  mortar: ['Mortar', 'Lobs exploding shells into the thickest crowd'],
  ballista: ['Ballista', 'Fires heavy bolts at the toughest monster'],
  happy: ['Happy citizens', '+50% income after each wave'],
  sharp: ['Sharp arrows', 'Archers deal +30% damage'],
  rapid: ['Rapid reload', 'All defenders attack 20% faster'],
  masons: ['Master masons', 'Repairs cost 40% less'],
};
const ERRORS = { noroom: 'No room with that code.', full: 'That room is full (4 commanders).', busy: 'The server is full. Try again later.' };

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

let ws = null, joined = false, world = null, layout = null, snap = null, snapAt = 0;
const enemies = new Map(), projs = new Map(), units = new Map(), fxs = [];

// ---- Start menu and connection ----
function connect(mode, code) {
  $('ovErr').textContent = '';
  if (ws) ws.close();
  const sock = ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);
  sock.onopen = () => send({ t: 'join', mode, code });
  sock.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.t === 'hello') {
      joined = true; layout = m.layout; world = buildWorld(scene, layout);
      $('overlay').hidden = true;
      for (const id of ['left', 'help']) $(id).hidden = false;
      $('roomRow').hidden = !m.room;
      $('roomCode').textContent = m.room || '';
    } else if (m.t === 's' && world) onSnap(m);
    else if (m.t === 'err') $('ovErr').textContent = ERRORS[m.why] || 'Could not join.';
  };
  sock.onclose = () => {
    if (sock !== ws || !joined) return;
    $('ovTitle').textContent = 'Connection lost';
    $('ovText').textContent = 'Reload the page to start again.';
    $('menu').hidden = true; $('overlay').hidden = false;
  };
}
const send = (m) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };
$('playSolo').onclick = () => connect('solo');
$('playCreate').onclick = () => connect('create');
$('playJoin').onsubmit = (e) => { e.preventDefault(); const code = $('code').value.trim(); if (code) connect('join', code); else $('ovErr').textContent = 'Enter a room code.'; };

let toastTimer = 0;
function toast(text, ms = 1600) {
  $('toast').textContent = text; $('toast').style.opacity = 1;
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
const puffGeo = new THREE.SphereGeometry(1, 14, 10);
const haloGeo = new THREE.TorusGeometry(1, 0.07, 6, 28).rotateX(Math.PI / 2);

function onSnap(m) {
  const prevPhase = snap && snap.ph;
  snap = m; snapAt = performance.now();
  const [bHall, bWalls, , bMine] = m.b, grow = 1 + 0.12 * (bWalls - 1), towerGrow = 1 + 0.1 * (bWalls - 1);

  m.sg.forEach((v, i) => { const g = world.segs[i]; g.visible = v > 0; g.scale.y = (0.55 + 0.45 * (v / 100)) * grow; });
  for (const g of world.towers) g.scale.y = towerGrow;
  world.hall.scale.y = 1 + 0.08 * (bHall - 1);
  world.mine.visible = bMine > 0;
  world.mortar.visible = m.pk[0] > 0; world.ballista.visible = m.pk[1] > 0;

  // Defenders stand on their slot: a tower top or a wall segment.
  const seen = new Set();
  for (const [slot, ki] of m.un) {
    seen.add(slot);
    const [x, z, seg] = layout.slots[slot], k = layout.units[ki];
    let o = units.get(slot);
    if (!o || o.k !== k) {
      if (o) scene.remove(o.m);
      o = { k, x, z, m: makeUnit(k), rot: Math.atan2(x, z) };
      scene.add(o.m);
      units.set(slot, o);
    }
    o.m.visible = seg < 0 || m.sg[seg] > 0;
    o.m.position.set(x, seg < 0 ? TOWER_TOP * towerGrow : world.wallH * grow * (0.55 + 0.45 * (m.sg[seg] / 100)), z);
  }
  for (const [slot, o] of units) if (!seen.has(slot)) { scene.remove(o.m); units.delete(slot); }

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
    if (t === 2) boss = Math.max(boss ?? 0, hp);
    else if (hp < 100 && !o.bar) { o.bar = new THREE.Sprite(barMat); scene.add(o.bar); }
    track(o, x, z);
  }
  for (const [id, o] of enemies) if (!seen.has(id)) { scene.remove(o.g); if (o.bar) scene.remove(o.bar); enemies.delete(id); }

  seen.clear();
  for (const [id, kind, x, z, ang] of m.pr) {
    seen.add(id);
    let o = projs.get(id);
    if (!o) {
      o = { m: new THREE.Mesh(kind === 1 ? orbGeo : arrowGeo, kind === 1 ? orbMat : arrowMat), y: kind === 4 ? 4.5 : 4 };
      o.m.rotation.y = ang;
      if (kind === 4) o.m.scale.setScalar(2.2);
      if (kind === 4 && Math.hypot(x, z) < 4) world.ballista.rotation.y = ang;
      scene.add(o.m);
      projs.set(id, o);
    }
    track(o, x, z);
  }
  for (const [id, o] of projs) if (!seen.has(id)) { scene.remove(o.m); projs.delete(id); }

  for (const [kind, x, z, v] of m.fx) {
    if (kind === 0) addFx(puffGeo, GLOW[v], x, 0.8 * BEAST_SCALE[v], z, BEAST_SCALE[v] * 1.3, 0.35);
    else if (kind === 1) addFx(puffGeo, 0x6fdcff, x, 1, z, v, 0.3);
    else if (kind === 4) toast(`${B_TXT[v][0]} upgraded`);
    else if (kind === 5) addFx(orbGeo, 0x222222, MORTAR_POS[0], 2, MORTAR_POS[2], 1.6, v, 0, [x, z]);
    else if (kind === 6) toast(`New perk: ${P_TXT[v][0]}`);
    else if (kind === 7) addFx(puffGeo, 0xffffff, x, 1, z, 0.7, 0.15);
    else if (kind === 8) addFx(haloGeo, 0xffd75a, x, world.wallH * grow, z, 1.2, 0.8, 3);
    else if (kind === 9) toast(`${UNIT_TXT[v][0]} promoted`);
  }
  if (prevPhase !== m.ph && m.ph === 'wave') toast(m.wave % 10 === 0 ? `Wave ${m.wave} · The Queen is coming` : `Wave ${m.wave}`);
  if (prevPhase === 'wave' && m.ph === 'prep') toast(`Wave ${m.wave} cleared`);
  updateHud(m, boss);
}

function addFx(geo, color, x, y, z, size, dur, rise = 0, to = null) {
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false }));
  m.position.set(x, y, z);
  if (to) { m.material.opacity = 1; m.scale.setScalar(size); }
  scene.add(m);
  fxs.push({ m, t: 0, dur, size, rise, to, from: [x, z] });
}

// ---- HUD ----
const pct = (a, b) => `${Math.max(0, Math.min(100, (a / b) * 100))}%`;
const plural = (n, [one, many]) => `${n} ${n === 1 ? one : many}`;
function updateHud(m, boss) {
  if (m.ph === 'prep') {
    $('phase').textContent = 'Preparation';
    $('sub').textContent = m.wave ? `Wave ${m.wave} cleared · take your time` : 'Recruit, upgrade, then choose a wave';
  } else if (m.ph === 'wave') {
    $('phase').textContent = `Wave ${m.wave}`;
    $('sub').textContent = `${plural(m.left, ['monster', 'monsters'])} left`;
  } else {
    $('phase').textContent = 'The castle has fallen';
    $('sub').textContent = `You reached wave ${m.reached} · restarting in ${m.tm} s`;
  }
  $('boss').hidden = boss === null;
  if (boss !== null) { $('bossBar').style.width = `${boss}%`; $('bossTxt').textContent = `${boss}%`; }
  $('thBar').style.width = pct(m.th[0], m.th[1]);
  $('thTxt').textContent = `${m.th[0]} / ${m.th[1]}`;
  $('gold').textContent = m.gold;
  $('army').textContent = `${m.un.length} / ${m.cap}`;
  $('roomPlayers').textContent = plural(m.np, ['commander', 'commanders']);
  renderWaves(m);
  renderShop(m);
}

let wavesSig = '', shopSig = '';
function renderWaves(m) {
  const sig = JSON.stringify([m.ph, m.wv, m.wave]);
  if (sig === wavesSig) return;
  wavesSig = sig;
  const show = m.ph === 'prep' && m.wv.length === 2;
  $('waves').hidden = !show;
  if (!show) return;
  $('waves').innerHTML = `<h3>Wave ${m.wave + 1}: choose what to face</h3><div class="cards">${m.wv.map((w, i) => {
    const mons = w.c.map((n, t) => (n ? `<b>${n}</b> ${MONSTERS[t][n === 1 ? 0 : 1]}` : '')).filter(Boolean).join('<br>');
    return `<button class="${w.hard ? 'hard' : ''}" data-wave="${i}"><span class="tag">${w.hard ? 'Harder · double reward' : 'Standard'}</span><div class="mons">${mons}</div><div class="gold">Reward: ${w.gold} gold</div></button>`;
  }).join('')}</div>`;
}
$('waves').onclick = (e) => { const b = e.target.closest('button'); if (b) send({ t: 'wave', i: Number(b.dataset.wave) }); };

function renderShop(m) {
  const prep = m.ph === 'prep', show = prep || (m.of && m.ph !== 'over');
  const sig = JSON.stringify([show, prep, m.b, m.rc, m.pk, m.of, m.gold, m.uc, m.ut, m.un.length, m.cap]);
  if (sig === shopSig) return;
  shopSig = sig;
  $('shop').hidden = !show;
  if (!show) return;
  let h = '';
  if (m.of) {
    h += '<h3>Choose a perk</h3>';
    for (const k of m.of) h += `<button class="perk" data-perk="${k}"><b>${P_TXT[k][0]}</b><span>${P_TXT[k][1]}</span></button>`;
  }
  if (prep) {
    const full = m.un.length >= m.cap, counts = layout.units.map((_, i) => m.un.filter((u) => u[1] === i).length);
    h += `<h3>Recruit · ${m.un.length} / ${m.cap} on the walls</h3>`;
    layout.units.forEach((k, i) => {
      const t = m.ut[i], pc = layout.promote[t];
      let pLabel = `Promote · ${pc}`, pOff = m.gold < pc || !counts[i];
      if (t >= layout.promote.length) { pLabel = 'Top tier'; pOff = true; }
      else if (m.b[2] < t) { pLabel = `Barracks Lv ${t}`; pOff = true; }
      h += `<div class="row"><div><b>${UNIT_TXT[k][0]} <i>×${counts[i]} · tier ${t}</i></b><span>${UNIT_TXT[k][1]}</span></div><div class="btns"><button data-buy="${k}" ${full || m.gold < m.uc[i] ? 'disabled' : ''}>${full ? 'Walls full' : `Recruit · ${m.uc[i]}`}</button><button class="alt" data-promote="${k}" ${pOff ? 'disabled' : ''}>${pLabel}</button></div></div>`;
    });
    h += '<h3>Castle</h3>';
    B_KEYS.forEach((k, i) => {
      const l = m.b[i], d = layout.buildings[k], cost = d.cost[l];
      let label = `${l ? 'Upgrade' : 'Build'} · ${cost}`, off = m.gold < cost;
      if (l >= d.max) { label = 'Max level'; off = true; }
      else if (k !== 'hall' && l >= m.b[0]) { label = `Keep Lv ${l + 1}`; off = true; }
      else if (k === 'hall' && m.of) { label = 'Pick a perk first'; off = true; }
      h += `<div class="row"><div><b>${B_TXT[k][0]} <i>${l ? `Lv ${l}` : 'not built'}</i></b><span>${B_TXT[k][1]}</span></div><button data-up="${k}" ${off ? 'disabled' : ''}>${label}</button></div>`;
    });
    if (m.rc[0] > 0) h += `<div class="row"><div><b>Repair walls</b></div><button data-repair="walls" ${m.gold ? '' : 'disabled'}>${m.rc[0]} gold</button></div>`;
    if (m.rc[1] > 0) h += `<div class="row"><div><b>Repair keep</b></div><button data-repair="hall" ${m.gold ? '' : 'disabled'}>${m.rc[1]} gold</button></div>`;
  }
  const owned = layout.perks.map((k, i) => (m.pk[i] ? `${P_TXT[k][0]}${m.pk[i] > 1 ? ` ×${m.pk[i]}` : ''}` : '')).filter(Boolean);
  if (owned.length) h += `<p>Perks: ${owned.join(', ')}</p>`;
  const y = $('shop').scrollTop;
  $('shop').innerHTML = h;
  $('shop').scrollTop = y;
}
$('shop').onclick = (e) => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  const d = b.dataset;
  if (d.buy) send({ t: 'buy', k: d.buy });
  else if (d.promote) send({ t: 'promote', k: d.promote });
  else if (d.up) send({ t: 'up', b: d.up });
  else if (d.repair) send({ t: 'repair', what: d.repair });
  else if (d.perk) send({ t: 'perk', k: d.perk });
};

// ---- Camera and keys ----
const keys = new Set(), focus = new THREE.Vector3(0, 0, 4);
let zoom = 1;
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  keys.add(e.code);
  if (e.code === 'Digit1' || e.code === 'Digit2') send({ t: 'wave', i: e.code === 'Digit1' ? 0 : 1 });
  const dev = { KeyG: 'gold', KeyH: 'boss', KeyK: 'hurt' }[e.code];   // only honoured by a server started with --dev
  if (dev) send({ t: 'dev', k: dev });
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
addEventListener('wheel', (e) => { if (!e.target.closest('#shop')) zoom = Math.min(1.6, Math.max(0.4, zoom * (1 + e.deltaY * 0.001))); }, { passive: true });
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
const down = (...c) => c.some((k) => keys.has(k));

// ---- Render loop ----
let last = performance.now(), t = 0;
function frame() {
  requestAnimationFrame(frame);
  const now = performance.now(), dt = Math.min((now - last) / 1000, 0.05);
  last = now; t += dt;
  const pan = 40 * zoom * dt;
  focus.x = Math.max(-60, Math.min(60, focus.x + (down('KeyD', 'ArrowRight') - down('KeyA', 'ArrowLeft')) * pan));
  focus.z = Math.max(-60, Math.min(60, focus.z + (down('KeyS', 'ArrowDown') - down('KeyW', 'ArrowUp')) * pan));
  if (world && snap) {
    const a = Math.min(1, (now - snapAt) / SNAP_MS);
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
    // Defenders turn towards the nearest monster, or look outwards when all is quiet.
    for (const o of units.values()) {
      let aim = Math.atan2(o.x, o.z), bd = 30;
      for (const e of enemies.values()) { const d = Math.hypot(e.rx - o.x, e.rz - o.z); if (d < bd) { bd = d; aim = Math.atan2(e.rx - o.x, e.rz - o.z); } }
      o.rot = lerpAngle(o.rot, aim, dt * 6);
      o.m.rotation.y = o.rot;
    }
    for (const o of projs.values()) { place(o, a); o.m.position.set(o.rx, o.y, o.rz); }
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
  camera.position.set(focus.x, 62 * zoom, focus.z + 44 * zoom);
  camera.lookAt(focus.x, 1, focus.z);
  sun.target.position.copy(focus);
  sun.position.copy(look.sp).normalize().multiplyScalar(110).add(focus);
  renderer.render(scene, camera);
}
frame();
