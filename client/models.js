// Everything that is drawn: terrain, castle, defenders and monsters. No game rules here.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const { PI } = Math;
const rnd = (() => { let s = 1234567; return () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
const std = (o) => new THREE.MeshStandardMaterial(o);

function mesh(geo, mat, x, y, z, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

function canvasTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
const speckle = (g, s, n, a) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * a})`; g.fillRect(rnd() * s, rnd() * s, 2, 2); } };
// Rough fieldstone for the first stone walls.
const brickTex = canvasTex(256, (g, s) => {
  g.fillStyle = '#4a4742'; g.fillRect(0, 0, s, s);
  for (let r = 0; r < 8; r++) { const off = r % 2 ? 32 : 0; for (let c = -1; c < 4; c++) { const v = (120 + rnd() * 50) | 0; g.fillStyle = `rgb(${v + 8},${v + 4},${v - 6})`; g.fillRect(c * 64 + off + 2, r * 32 + 2, 60, 28); } }
  speckle(g, s, 3500, 0.14);
});
// Large dressed sandstone blocks for the fortress.
const ashlarTex = canvasTex(256, (g, s) => {
  g.fillStyle = '#7a6a52'; g.fillRect(0, 0, s, s);
  for (let r = 0; r < 4; r++) { const off = r % 2 ? 64 : 0; for (let c = -1; c < 3; c++) { const v = (178 + rnd() * 34) | 0; g.fillStyle = `rgb(${v + 12},${v},${v - 28})`; g.fillRect(c * 128 + off + 3, r * 64 + 3, 122, 58); } }
  speckle(g, s, 2500, 0.08);
});
// Polished pale marble with faint veins for the citadel.
const marbleTex = canvasTex(256, (g, s) => {
  g.fillStyle = '#b9b6ad'; g.fillRect(0, 0, s, s);
  for (let r = 0; r < 4; r++) { const off = r % 2 ? 64 : 0; for (let c = -1; c < 3; c++) { const v = (226 + rnd() * 22) | 0; g.fillStyle = `rgb(${v},${v - 2},${v - 8})`; g.fillRect(c * 128 + off + 2, r * 64 + 2, 124, 60); } }
  g.strokeStyle = 'rgba(120,120,135,.22)'; g.lineWidth = 1.2;
  for (let i = 0; i < 14; i++) { g.beginPath(); let x = rnd() * s, y = rnd() * s; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (rnd() - 0.4) * 40; y += (rnd() - 0.5) * 30; g.lineTo(x, y); } g.stroke(); }
});
const woodTex = canvasTex(128, (g, s) => {
  for (let i = 0; i < 8; i++) { const v = (70 + rnd() * 30) | 0; g.fillStyle = `rgb(${v + 35},${v},${v - 35})`; g.fillRect(i * 16, 0, 15, s); }
  g.fillStyle = 'rgba(0,0,0,.4)'; for (let i = 0; i < 8; i++) g.fillRect(i * 16 + 15, 0, 1, s);
});
const roofTex = canvasTex(128, (g, s) => {
  g.fillStyle = '#555'; g.fillRect(0, 0, s, s);
  for (let r = 0; r < 8; r++) for (let c = 0; c < 9; c++) { const v = (150 + rnd() * 70) | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(c * 16 + (r % 2 ? 8 : 0) - 8, r * 16, 15, 14); }
});
function texMat(tex, rx, ry, extra = {}) { const t = tex.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return std({ map: t, roughness: 0.92, ...extra }); }
function roofMat(color, rx, ry) { const t = roofTex.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return std({ map: t, color, roughness: 0.8, flatShading: true }); }

const stonePlain = std({ color: 0x8f8b84, roughness: 0.95 });
const sandPlain = std({ color: 0xb8a684, roughness: 0.9 });
const sandDark = std({ color: 0x7d6e58, roughness: 0.95 });
const marblePlain = std({ color: 0xe8e4da, roughness: 0.55 });
const goldMat = std({ color: 0xf0c040, metalness: 0.85, roughness: 0.3, emissive: 0x3a2800, emissiveIntensity: 0.4 });
const woodMat = std({ map: woodTex, roughness: 0.85 });
const trunkMat = std({ color: 0x5a3d24, roughness: 1 });
const ironMat = std({ color: 0x2b2b2e, metalness: 0.8, roughness: 0.45 });
const logMat = std({ vertexColors: true, roughness: 0.9 });
const bannerMats = [std({ color: 0xb3242a, side: THREE.DoubleSide, roughness: 0.8 }), std({ color: 0x2a4fb3, side: THREE.DoubleSide, roughness: 0.7 })];
export const winMat = std({ color: 0x2a2418, emissive: 0xffb347, emissiveIntensity: 0.1 });
export const fireMat = std({ color: 0xff7a1a, emissive: 0xff6a00, emissiveIntensity: 2 });

// Visual terrain height. The simulation is flat; hills only start outside the play area.
export function hAt(x, z) {
  const d = Math.hypot(x, z), k = Math.min(1, Math.max(0, (d - 62) / 20));
  return (Math.sin(x * 0.13) * Math.cos(z * 0.11) * 1.6 + Math.sin(x * 0.31 + z * 0.2) * 0.5 + Math.cos(z * 0.27 - x * 0.17) * 0.4) * k * 2;
}

function buildGround(scene, S) {
  const geo = new THREE.PlaneGeometry(360, 360, 180, 180);
  geo.rotateX(-PI / 2);
  const p = geo.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, hAt(x, z));
    const d = Math.max(Math.abs(x), Math.abs(z)), v = rnd() * 0.08;
    const patch = Math.sin(x * 0.09) * Math.cos(z * 0.07) * 0.03;
    let r = 0.07 + v * 0.5 + patch, g = 0.17 + v + patch, b = 0.04 + v * 0.3;
    const dirt = Math.max(Math.min(1, (S + 3 - d) / 4), Math.abs(x) < 2.4 && z > S ? 1 : 0, 0);
    r += (0.2 + v - r) * dirt; g += (0.15 + v - g) * dirt; b += (0.09 + v - b) * dirt;
    col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, std({ vertexColors: true, roughness: 1, flatShading: true }));
  m.receiveShadow = true;
  scene.add(m);
}

function buildForest(scene, S) {
  const spots = [], rocks = [];
  for (let i = 0; i < 900; i++) {
    const x = (rnd() - 0.5) * 300, z = (rnd() - 0.5) * 300, d = Math.hypot(x, z);
    if (d < S + 20 || (Math.abs(x) < 9 && z > 0 && z < 70)) continue;
    if (d < 62 && rnd() < 0.8) continue;      // keep the fighting ground mostly open
    (rnd() < 0.12 ? rocks : spots).push([x, hAt(x, z), z, 0.8 + rnd() * 0.9]);
  }
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), C = new THREE.Color();
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.28, 1.6, 6), trunkMat, spots.length);
  const leaves = new THREE.InstancedMesh(new THREE.ConeGeometry(1.5, 2, 7), std({ roughness: 1, flatShading: true }), spots.length * 3);
  const greens = [0x2f5a2a, 0x3a6b2e, 0x27492a, 0x466f33];
  spots.forEach(([x, y, z, s], i) => {
    trunks.setMatrixAt(i, M.compose(V.set(x, y + 0.8 * s, z), Q, new THREE.Vector3(s, s, s)));
    C.set(greens[(rnd() * 4) | 0]);
    for (let k = 0; k < 3; k++) {
      const w = (1 - k * 0.23) * s;
      leaves.setMatrixAt(i * 3 + k, M.compose(V.set(x, y + (2.2 + k * 1.1) * s, z), Q, new THREE.Vector3(w, s, w)));
      leaves.setColorAt(i * 3 + k, C);
    }
  });
  const rockMesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), std({ color: 0x777a7d, roughness: 1, flatShading: true }), rocks.length);
  rocks.forEach(([x, y, z, s], i) => rockMesh.setMatrixAt(i, M.compose(V.set(x, y + 0.2, z), Q.setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3)), new THREE.Vector3(s, s * 0.8, s))));
  for (const m of [trunks, leaves, rockMesh]) { m.castShadow = m.receiveShadow = true; scene.add(m); }
}

// ---- The walls change look as they are upgraded: palisade, stone, fortress, citadel ----
export const TIERS = [
  { name: 'Wooden palisade', wallH: 2.9, towerTop: 5.3 },
  { name: 'Stone walls', wallH: 3.4, towerTop: 6.6 },
  { name: 'Fortress walls', wallH: 4.0, towerTop: 7.6 },
  { name: 'Marble citadel', wallH: 4.6, towerTop: 8.6 },
];
export const wallTier = (level) => (level <= 2 ? 0 : level <= 5 ? 1 : level <= 9 ? 2 : 3);
export const keepTier = (level) => (level <= 3 ? 0 : level <= 7 ? 1 : level <= 12 ? 2 : 3);

// Merges a set of vertex-coloured parts into one mesh.
class Parts {
  constructor() { this.groups = {}; }
  add(key, geo, color, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1], parent = null) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), _q.setFromEuler(_e.set(...rot)), new THREE.Vector3(...scale));
    if (parent) m.premultiply(parent);
    geo.applyMatrix4(m);
    _c.set(color);
    const n = geo.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (geo.index) geo = geo.toNonIndexed();
    (this.groups[key] ??= []).push(geo);
  }
  build(key) { return mergeGeometries(this.groups[key]); }
}
const _c = new THREE.Color(), _e = new THREE.Euler(), _q = new THREE.Quaternion();
const LOGS = [0x7a5634, 0x6b4a2a, 0x845e3a, 0x5f4226];

function palisadeGeo(L, gate) {
  const P = new Parts(), n = Math.round(L / 0.46);
  for (let i = 0; i < n; i++) {
    const x = -L / 2 + (i + 0.5) * (L / n);
    if (gate && Math.abs(x) < 1.2) continue;
    const h = 2.55 + rnd() * 0.35, col = LOGS[(rnd() * 4) | 0];
    P.add('w', new THREE.CylinderGeometry(0.22, 0.24, h, 7), col, [x, h / 2, 0]);
    P.add('w', new THREE.ConeGeometry(0.22, 0.45, 7), col, [x, h + 0.22, 0]);
  }
  for (const y of [0.8, 1.9]) P.add('w', new THREE.BoxGeometry(L, 0.16, 0.14), 0x4a3320, [0, y, -0.3]);
  P.add('w', new THREE.BoxGeometry(L, 0.12, 0.8), 0x5c4128, [0, 2.45, -0.6]);   // walkway
  if (gate) {
    for (const s of [-1, 1]) P.add('w', new THREE.BoxGeometry(0.4, 3.6, 0.4), 0x4a3320, [s * 1.25, 1.8, 0]);
    P.add('w', new THREE.BoxGeometry(2.9, 0.4, 0.45), 0x4a3320, [0, 3.5, 0]);
    for (const s of [-1, 1]) P.add('w', new THREE.BoxGeometry(1.0, 2.6, 0.18), 0x6b4a2a, [s * 0.55, 1.3, 0]);
  }
  return P.build('w');
}

function buildSegment(parent, s, tier, idx) {
  const g = new THREE.Group();
  g.position.set(s.x, 0, s.z);
  parent.add(g);
  const alongX = s.hw > s.hd, L = Math.max(s.hw, s.hd) * 2, T = Math.min(s.hw, s.hd) * 2;
  // Rotate so that local +z always points out of the castle.
  g.rotation.y = alongX ? (s.z > 0 ? 0 : PI) : (s.x > 0 ? PI / 2 : -PI / 2);
  const H = TIERS[tier].wallH;
  if (tier === 0) {
    mesh(palisadeGeo(L, s.gate), logMat, 0, 0, 0, g);
    return g;
  }
  const body = tier === 1 ? texMat(brickTex, L / 4, H / 4) : tier === 2 ? texMat(ashlarTex, L / 4, H / 4) : texMat(marbleTex, L / 4, H / 4, { roughness: 0.5 });
  const trim = tier === 1 ? stonePlain : tier === 2 ? sandPlain : marblePlain;
  if (s.gate) {
    mesh(new THREE.BoxGeometry(L, 1.1, T + 0.3), body, 0, H - 0.3, 0, g);
    const door = tier === 3 ? std({ color: 0x6a4a2a, roughness: 0.6 }) : woodMat;
    for (const k of [-1, 1]) mesh(new THREE.BoxGeometry(L / 2 - 0.05, H - 0.9, 0.3), door, (k * L) / 4, (H - 0.9) / 2, 0, g);
    for (const k of [-1, 0, 1]) mesh(new THREE.BoxGeometry(L, 0.14, 0.38), tier === 3 ? goldMat : ironMat, 0, 1.25 + k * 0.8, 0, g);
    if (tier >= 2) for (let i = -3; i <= 3; i++) mesh(new THREE.BoxGeometry(0.08, H - 1, 0.08), ironMat, i * 0.55, (H - 1) / 2, T / 2 + 0.2, g);
  } else {
    mesh(new THREE.BoxGeometry(L, H, T), body, 0, H / 2, 0, g);
    if (tier >= 2) mesh(new THREE.BoxGeometry(L, 0.9, T + 0.45), tier === 2 ? sandDark : marblePlain, 0, 0.45, 0, g);   // plinth
    if (tier >= 2) for (const x of [-1, 1]) mesh(new THREE.BoxGeometry(0.12, 0.9, 0.05), ironMat, x * 0.9, H * 0.55, T / 2 + 0.01, g);   // arrow slits
  }
  if (tier >= 2) mesh(new THREE.BoxGeometry(L, 0.22, T + 0.2), tier === 3 ? goldMat : sandDark, 0, H, 0, g);   // coping
  const mw = tier === 1 ? 0.8 : 0.9, mh = tier === 1 ? 0.7 : 0.85;
  for (let i = 0; i < 3; i++) for (const k of [-1, 1]) {
    const x = -L / 2 + 0.67 + i * 1.33;
    mesh(new THREE.BoxGeometry(mw, mh, 0.35), trim, x, H + mh / 2 + 0.05, k * (T / 2 - 0.18), g);
    if (tier === 3) mesh(new THREE.BoxGeometry(mw + 0.06, 0.08, 0.41), goldMat, x, H + mh + 0.09, k * (T / 2 - 0.18), g);
  }
  if (tier >= 2 && !s.gate && idx % 2 === 0) {
    const banner = mesh(new THREE.PlaneGeometry(0.9, 1.7), bannerMats[tier - 2], 0, H - 1.0, T / 2 + 0.04, g);
    banner.castShadow = false;
  }
  return g;
}

function buildTower(parent, x, z, tier) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = Math.atan2(x, z);
  parent.add(g);
  const top = TIERS[tier].towerTop - 0.4;
  if (tier === 0) {
    // A wooden watchtower: four posts, braces and a fighting platform.
    const P = new Parts();
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.add('t', new THREE.CylinderGeometry(0.2, 0.24, top, 7), LOGS[0], [a * 1.3, top / 2, b * 1.3]);
    for (const y of [1.4, 3.2]) for (const r of [0, PI / 2]) for (const s of [-1, 1]) {
      const m = new THREE.Matrix4().makeRotationY(r);
      P.add('t', new THREE.BoxGeometry(2.8, 0.14, 0.14), 0x4a3320, [0, y, s * 1.3], [0, 0, 0.5], [1, 1, 1], m);
    }
    P.add('t', new THREE.BoxGeometry(3.4, 0.3, 3.4), 0x5c4128, [0, top + 0.15, 0]);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) P.add('t', new THREE.CylinderGeometry(0.09, 0.09, 0.8, 6), LOGS[2], [a * 1.6, top + 0.7, b * 1.6]);
    mesh(P.build('t'), logMat, 0, 0, 0, g);
    return g;
  }
  const body = tier === 1 ? texMat(brickTex, 4, 2) : tier === 2 ? texMat(ashlarTex, 4, 2) : texMat(marbleTex, 4, 2, { roughness: 0.5 });
  const trim = tier === 1 ? stonePlain : tier === 2 ? sandPlain : marblePlain;
  mesh(new THREE.CylinderGeometry(1.9, 2.1, top, 14), body, 0, top / 2, 0, g);
  if (tier >= 2) mesh(new THREE.CylinderGeometry(2.4, 2.5, 1.2, 14), tier === 2 ? sandDark : marblePlain, 0, 0.6, 0, g);
  mesh(new THREE.CylinderGeometry(2.25 + (tier >= 2 ? 0.2 : 0), 2.1, 0.6, 14), tier === 3 ? goldMat : trim, 0, top + 0.1, 0, g);
  const n = tier === 1 ? 8 : 10, R = tier === 1 ? 2.05 : 2.25;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * PI * 2;
    mesh(new THREE.BoxGeometry(0.8, 0.75, 0.4), trim, Math.cos(a) * R, top + 0.75, Math.sin(a) * R, g).rotation.y = -a + PI / 2;
    if (tier === 3) mesh(new THREE.BoxGeometry(0.86, 0.08, 0.46), goldMat, Math.cos(a) * R, top + 1.16, Math.sin(a) * R, g).rotation.y = -a + PI / 2;
  }
  if (tier >= 2) {
    mesh(new THREE.PlaneGeometry(1.1, 2.4), bannerMats[tier - 2], 0, top - 1.6, 2.2, g).castShadow = false;
    mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 6), tier === 3 ? goldMat : trunkMat, 1.6, top + 1.9, -1.2, g);
    const fg = new THREE.PlaneGeometry(1.3, 0.8, 4, 1); fg.translate(0.65, 0, 0);
    mesh(fg, bannerMats[tier - 2], 1.6, top + 3.1, -1.2, g).castShadow = false;
  }
  return g;
}

// ---- The keep grows turrets, then a slate roof, then gold as it is upgraded ----
function buildTownHall(scene) {
  const g = new THREE.Group();
  scene.add(g);
  const stone = texMat(brickTex, 2, 1.5), upper = texMat(brickTex, 1.2, 1);
  mesh(new THREE.BoxGeometry(7, 5.5, 7), stone, 0, 2.75, 0, g);
  for (let i = 0; i < 5; i++) for (const s of [-1, 1]) {
    mesh(new THREE.BoxGeometry(0.8, 0.7, 0.4), stonePlain, -2.8 + i * 1.4, 5.85, s * 3.3, g);
    mesh(new THREE.BoxGeometry(0.4, 0.7, 0.8), stonePlain, s * 3.3, 5.85, -2.8 + i * 1.4, g);
  }
  mesh(new THREE.BoxGeometry(4.4, 4, 4.4), upper, 0, 7.5, 0, g);
  const roof = roofMat(0x8a3a2e, 4, 2);
  mesh(new THREE.ConeGeometry(3.6, 3.4, 4), roof, 0, 11.2, 0, g).rotation.y = PI / 4;
  mesh(new THREE.BoxGeometry(1.6, 2.6, 0.2), woodMat, 0, 1.3, 3.55, g);
  for (const x of [-2.2, 2.2]) mesh(new THREE.BoxGeometry(0.6, 1, 0.1), winMat, x, 3.4, 3.52, g);
  for (const x of [-1, 1]) mesh(new THREE.BoxGeometry(0.5, 0.9, 0.1), winMat, x, 8, 2.22, g);
  mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 6), trunkMat, 0, 14.2, 0, g);
  const fg = new THREE.PlaneGeometry(1.8, 1.1, 6, 1);
  fg.translate(0.9, 0, 0);
  const flagMat = std({ color: 0xb3242a, side: THREE.DoubleSide, roughness: 0.8 });
  const flag = mesh(fg, flagMat, 0, 15, 0, g);
  // Corner turrets appear with the second keep tier.
  const turrets = new THREE.Group(), turretRoof = roofMat(0x8a3a2e, 2, 1);
  g.add(turrets);
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    mesh(new THREE.CylinderGeometry(0.9, 1, 7.4, 10), stone, a * 3.5, 3.7, b * 3.5, turrets);
    mesh(new THREE.ConeGeometry(1.25, 2.2, 10), turretRoof, a * 3.5, 8.5, b * 3.5, turrets);
  }
  const spire = new THREE.Group();
  g.add(spire);
  mesh(new THREE.ConeGeometry(0.5, 2, 8), goldMat, 0, 13.6, 0, spire);
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(new THREE.SphereGeometry(0.28, 10, 8), goldMat, a * 3.5, 9.75, b * 3.5, spire);
  const setTier = (t) => {
    turrets.visible = t >= 1;
    spire.visible = t >= 3;
    const rc = [0x8a3a2e, 0x8a3a2e, 0x3c4d6e, 0xd8a838][t];
    roof.color.set(rc); turretRoof.color.set(rc);
    roof.metalness = turretRoof.metalness = t === 3 ? 0.6 : 0;
    stone.color.set(t >= 2 ? 0xfff2dc : 0xffffff); upper.color.set(t >= 2 ? 0xfff2dc : 0xffffff);
    flagMat.color.set(t >= 2 ? 0x2a4fb3 : 0xb3242a);
  };
  setTier(0);
  return { g, flag, setTier };
}

// ---- Turrets: built on fixed spots in the courtyard ----
const copperMat = std({ color: 0xc87533, metalness: 0.8, roughness: 0.35 });
const coilGlow = std({ color: 0x9fe8ff, emissive: 0x5fd0ff, emissiveIntensity: 2.2 });
export function makeTurret(k) {
  const g = new THREE.Group(), stone = texMat(brickTex, 1, 0.5);
  mesh(new THREE.CylinderGeometry(1.25, 1.4, 0.8, 10), stone, 0, 0.4, 0, g);   // plinth
  const top = new THREE.Group();
  top.position.y = 0.8;
  g.add(top);
  if (k === 'bolt') {
    for (const a of [0, 2.1, 4.2]) mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.3, 6), woodMat, Math.sin(a) * 0.35, 0.55, Math.cos(a) * 0.35, top).rotation.set(Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3);
    mesh(new THREE.BoxGeometry(0.25, 0.22, 1.5), woodMat, 0, 1.25, 0.2, top);
    mesh(new THREE.TorusGeometry(0.75, 0.05, 5, 16, PI), woodMat, 0, 1.3, 0.75, top).rotation.set(PI / 2, 0, 0);
    mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 5), ironMat, 0, 1.4, 0.4, top).rotation.x = PI / 2;
  } else if (k === 'cannon') {
    mesh(new THREE.BoxGeometry(1.1, 0.4, 1.4), woodMat, 0, 0.3, 0, top);
    for (const x of [-0.6, 0.6]) mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 12), woodMat, x, 0.4, 0, top).rotation.z = PI / 2;
    mesh(new THREE.CylinderGeometry(0.3, 0.38, 1.7, 12), ironMat, 0, 0.85, 0.35, top).rotation.x = PI / 2 - 0.25;
  } else if (k === 'tesla') {
    mesh(new THREE.CylinderGeometry(0.28, 0.4, 2.2, 10), copperMat, 0, 1.1, 0, top);
    for (let i = 0; i < 4; i++) mesh(new THREE.TorusGeometry(0.42 - i * 0.04, 0.06, 6, 18), copperMat, 0, 0.5 + i * 0.45, 0, top).rotation.x = PI / 2;
    mesh(new THREE.SphereGeometry(0.42, 14, 10), coilGlow, 0, 2.5, 0, top).castShadow = false;
  } else if (k === 'mortar') {
    mesh(new THREE.BoxGeometry(1.4, 0.4, 1.4), woodMat, 0, 0.2, 0, top);
    mesh(new THREE.CylinderGeometry(0.5, 0.6, 1.3, 12), ironMat, 0, 0.9, 0.12, top).rotation.x = 0.35;
    for (let i = 0; i < 3; i++) mesh(new THREE.SphereGeometry(0.22, 10, 8), ironMat, 0.9, 0.2 + (i === 2 ? 0.35 : 0), -0.4 + (i % 2) * 0.4, top);
  } else if (k === 'ballista') {
    mesh(new THREE.BoxGeometry(0.5, 0.35, 2.6), woodMat, 0, 0.55, 0.2, top);
    for (const s2 of [-1, 1]) mesh(new THREE.BoxGeometry(1.7, 0.16, 0.2), woodMat, s2 * 0.8, 0.7, 1.1, top).rotation.y = s2 * 0.45;
    mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), ironMat, 0, 0.8, 0.5, top).rotation.x = PI / 2;
    mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.5, 8), woodMat, 0, 0.2, 0, top);
  }
  g.userData.top = top;
  return g;
}

function disposeTree(o) {
  o.traverse((c) => { if (c.isMesh) { c.geometry.dispose(); if (c.material.map && c.material !== woodMat) { c.material.map.dispose(); c.material.dispose(); } } });
}

export function buildWorld(scene, layout) {
  const { S } = layout;
  buildGround(scene, S);
  buildForest(scene, S);
  const walls = new THREE.Group();
  scene.add(walls);
  const world = { segs: [], towers: [], tier: -1, walls };
  world.setWallTier = (tier) => {
    if (tier === world.tier) return false;
    for (const g of [...world.segs, ...world.towers]) { walls.remove(g); disposeTree(g); }
    world.segs = layout.segs.map((s, i) => buildSegment(walls, s, tier, i));
    world.towers = layout.towers.map(([x, z]) => buildTower(walls, x, z, tier));
    world.tier = tier;
    world.wallH = TIERS[tier].wallH;
    world.towerTop = TIERS[tier].towerTop;
    return true;
  };
  world.setWallTier(0);
  const hall = buildTownHall(scene);
  world.hall = hall.g; world.flag = hall.flag; world.setKeepTier = hall.setTier;
  world.torches = [];
  for (const [x, y, z] of [[-3, 3.2, S + 1.6], [3, 3.2, S + 1.6], [0, 3.2, 4.4], [-S + 1.8, 3.2, 0], [S - 1.8, 3.2, 0], [0, 3.2, -S + 1.8]]) {
    const l = new THREE.PointLight(0xff8a3c, 0, 26, 2);
    l.position.set(x, y, z);
    scene.add(l);
    world.torches.push(l);
    mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 6), trunkMat, x, y - 0.6, z, scene);
    mesh(new THREE.SphereGeometry(0.16, 8, 6), fireMat, x, y, z, scene).castShadow = false;
  }
  return world;
}

export const orbMat = std({ color: 0x7fe8ff, emissive: 0x35c8ff, emissiveIntensity: 2.5 });
export const frostMat = std({ color: 0xdff6ff, emissive: 0x9fdcff, emissiveIntensity: 2 });

// ---- Defenders: one merged, vertex-coloured mesh per class ----
const unitMat = std({ vertexColors: true, roughness: 0.75 });
const unitCache = {};
const SKIN = 0xd9a273, LEATHER = 0x4a3222, STEEL = 0xaab2bd, WOOD = 0x6b4a2a, GOLD = 0xe8b830;
export const UNIT_COLORS = {
  archer: 0x8a2f2f, spear: 0x7f8894, mage: 0x5a3fa0, crossbow: 0x2f6a3a, frost: 0x5fa8d8, cleric: 0xe8e0c8, pyro: 0xc8481e,
  storm: 0x34488f, ranger: 0x4a6a2a, shield: 0x8a6a2a, bard: 0xb0306a, alchemist: 0x7a6038, priest: 0xf2ead2, bomber: 0x5c5a55, hexer: 0x3e2250,
};
const ROBES = new Set(['mage', 'frost', 'cleric', 'pyro', 'storm', 'priest', 'hexer']);
function unitGeo(k) {
  const G = THREE, P = new Parts(), a = (geo, col, pos, rot, scale) => P.add('u', geo, col, pos, rot, scale);
  const tunic = UNIT_COLORS[k], robe = ROBES.has(k);
  for (const s of [-1, 1]) a(new G.CylinderGeometry(0.11, 0.09, 0.7, 6), LEATHER, [s * 0.14, 0.47, 0]);
  if (robe) a(new G.ConeGeometry(0.52, 1.3, 10), tunic, [0, 0.72, 0]);
  a(new G.CylinderGeometry(0.33, 0.25, 0.72, 8), tunic, [0, 1.22, 0]);
  a(new G.CylinderGeometry(0.34, 0.34, 0.08, 8), LEATHER, [0, 0.92, 0]);   // belt
  a(new G.SphereGeometry(0.19, 10, 8), SKIN, [0, 1.8, 0]);
  for (const s of [-1, 1]) a(new G.SphereGeometry(0.03, 6, 4), 0x222222, [s * 0.07, 1.83, 0.17]);   // eyes
  a(new G.CylinderGeometry(0.08, 0.07, 0.6, 6), tunic, [0.43, 1.2, 0]);
  if (k === 'archer') {
    a(new G.ConeGeometry(0.27, 0.44, 8), tunic, [0, 1.99, -0.03]);
    a(new G.CylinderGeometry(0.08, 0.07, 0.6, 6), tunic, [-0.43, 1.45, 0.3], [-1.45, 0, 0]);
    a(new G.TorusGeometry(0.55, 0.03, 5, 14, PI), LEATHER, [-0.43, 1.45, 0.7], [0, -PI / 2, -PI / 2]);
    a(new G.CylinderGeometry(0.1, 0.1, 0.6, 8), LEATHER, [0.12, 1.4, -0.3], [0.3, 0, 0]);   // quiver
  } else if (k === 'spear') {
    a(new G.SphereGeometry(0.23, 10, 6, 0, PI * 2, 0, PI * 0.6), STEEL, [0, 1.82, 0]);
    a(new G.CylinderGeometry(0.08, 0.07, 0.6, 6), tunic, [-0.43, 1.2, 0]);
    a(new G.CylinderGeometry(0.035, 0.035, 3, 6), WOOD, [0.5, 1.5, 0.25], [0.35, 0, 0]);
    a(new G.ConeGeometry(0.09, 0.4, 6), STEEL, [0.5, 3.07, 0.82], [0.35, 0, 0]);
    a(new G.CylinderGeometry(0.4, 0.4, 0.06, 6), 0x2f4f8a, [-0.45, 1.15, 0.22], [PI / 2, 0, 0]);
  } else if (k === 'mage' || k === 'frost') {
    a(new G.CylinderGeometry(0.38, 0.38, 0.03, 12), tunic, [0, 1.93, 0]);
    a(new G.ConeGeometry(0.25, 0.62, 10), tunic, [0, 2.24, k === 'frost' ? -0.04 : 0], [k === 'frost' ? -0.2 : 0, 0, 0]);
    a(new G.CylinderGeometry(0.08, 0.07, 0.6, 6), tunic, [-0.43, 1.2, 0]);
    a(new G.CylinderGeometry(0.035, 0.035, 2.1, 6), k === 'frost' ? 0xcfe8f5 : WOOD, [0.52, 1.05, 0.3]);
    if (k === 'frost') a(new G.OctahedronGeometry(0.2, 0), 0xbff0ff, [0.52, 2.25, 0.3], [0, 0, 0], [0.7, 1.4, 0.7]);
    else a(new G.SphereGeometry(0.16, 10, 8), 0x9ff2ff, [0.52, 2.2, 0.3]);
    if (k === 'frost') a(new G.SphereGeometry(0.17, 8, 6, 0, PI * 2, PI * 0.4, PI * 0.6), 0xf2f2f2, [0, 1.74, 0.06]);   // beard
  } else if (k === 'cleric') {
    a(new G.SphereGeometry(0.24, 10, 8, 0, PI * 2, 0, PI * 0.62), tunic, [0, 1.84, -0.03]);   // hood
    a(new G.BoxGeometry(0.5, 0.12, 0.05), GOLD, [0, 1.3, 0.3]);
    a(new G.BoxGeometry(0.12, 0.5, 0.05), GOLD, [0, 1.25, 0.3]);
    a(new G.CylinderGeometry(0.08, 0.07, 0.6, 6), tunic, [-0.43, 1.2, 0]);
    a(new G.CylinderGeometry(0.04, 0.04, 1.0, 6), WOOD, [0.52, 1.1, 0.3]);
    a(new G.BoxGeometry(0.34, 0.24, 0.24), STEEL, [0.52, 1.65, 0.3]);   // mason's hammer
  } else if (k === 'pyro') {
    a(new G.SphereGeometry(0.24, 10, 8, 0, PI * 2, 0, PI * 0.62), 0x7a1e0e, [0, 1.84, -0.03]);   // hood
    a(new G.CylinderGeometry(0.08, 0.07, 0.6, 6), tunic, [-0.43, 1.2, 0]);
    a(new G.CylinderGeometry(0.035, 0.035, 1.9, 6), 0x2a1a10, [0.52, 1.0, 0.3]);
    a(new G.ConeGeometry(0.17, 0.42, 8), 0xffa030, [0.52, 2.15, 0.3]);   // flame
    a(new G.ConeGeometry(0.1, 0.3, 8), 0xffe070, [0.52, 2.12, 0.34]);
  } else if (k === 'storm') {
    a(new G.CylinderGeometry(0.36, 0.36, 0.03, 12), tunic, [0, 1.93, 0]);
    a(new G.ConeGeometry(0.24, 0.55, 10), tunic, [0, 2.2, 0]);
    a(new G.CylinderGeometry(0.08, 0.07, 0.6, 6), tunic, [-0.43, 1.45, 0.25], [-1.2, 0, 0]);
    a(new G.CylinderGeometry(0.035, 0.035, 2.1, 6), 0xd8d8e0, [0.52, 1.05, 0.3]);
    for (let i = 0; i < 3; i++) a(new G.BoxGeometry(0.06, 0.22, 0.06), 0xfff27a, [0.52 + (i % 2 ? 0.06 : -0.06), 2.12 + i * 0.16, 0.3], [0, 0, (i % 2 ? 1 : -1) * 0.6]);   // bolt
  } else if (k === 'ranger') {
    a(new G.SphereGeometry(0.25, 10, 8, 0, PI * 2, 0, PI * 0.6), tunic, [0, 1.84, -0.03]);   // hood
    a(new G.ConeGeometry(0.42, 1.0, 8, 1, true), 0x33481d, [0, 1.25, -0.08]);   // cloak
    a(new G.CylinderGeometry(0.08, 0.07, 0.6, 6), tunic, [-0.43, 1.45, 0.3], [-1.45, 0, 0]);
    a(new G.TorusGeometry(0.8, 0.03, 5, 18, PI), WOOD, [-0.43, 1.45, 0.7], [0, -PI / 2, -PI / 2]);   // long bow
    a(new G.CylinderGeometry(0.1, 0.1, 0.7, 8), LEATHER, [0.15, 1.4, -0.32], [0.35, 0, 0]);
  } else if (k === 'bard') {
    a(new G.CylinderGeometry(0.3, 0.32, 0.1, 12), tunic, [0, 1.95, 0]);   // hat brim
    a(new G.CylinderGeometry(0.2, 0.22, 0.2, 10), tunic, [0, 2.07, 0]);
    a(new G.ConeGeometry(0.04, 0.6, 5), 0xf0e6a0, [0.18, 2.3, -0.1], [-0.6, 0, -0.4]);   // feather
    a(new G.CylinderGeometry(0.08, 0.07, 0.6, 6), tunic, [-0.43, 1.2, 0]);
    a(new G.SphereGeometry(0.26, 10, 8), 0xb07a3a, [0.05, 1.2, 0.36], [0, 0, 0], [1, 1.2, 0.45]);   // lute
    a(new G.BoxGeometry(0.08, 0.6, 0.06), 0x6b4a2a, [0.25, 1.55, 0.36], [0, 0, -0.5]);
  } else if (k === 'alchemist') {
    a(new G.CylinderGeometry(0.22, 0.24, 0.16, 10), LEATHER, [0, 1.96, 0]);
    for (const s2 of [-1, 1]) a(new G.TorusGeometry(0.07, 0.02, 5, 10), 0x222222, [s2 * 0.08, 1.83, 0.17]);   // goggles
    a(new G.BoxGeometry(0.5, 0.6, 0.04), 0xd8cfb8, [0, 1.2, 0.27]);   // apron
    a(new G.CylinderGeometry(0.08, 0.07, 0.6, 6), tunic, [-0.43, 1.2, 0]);
    a(new G.SphereGeometry(0.14, 10, 8), 0x7dff5a, [0.5, 1.55, 0.3]);   // flask
    a(new G.CylinderGeometry(0.04, 0.05, 0.14, 6), 0xd8d8d8, [0.5, 1.72, 0.3]);
  } else if (k === 'priest') {
    a(new G.TorusGeometry(0.26, 0.03, 6, 20), GOLD, [0, 2.2, -0.05], [PI / 2, 0, 0]);   // halo
    a(new G.CylinderGeometry(0.08, 0.07, 0.6, 6), tunic, [-0.43, 1.2, 0]);
    a(new G.CylinderGeometry(0.035, 0.035, 2.2, 6), GOLD, [0.52, 1.1, 0.3]);
    a(new G.CylinderGeometry(0.2, 0.2, 0.04, 14), 0xfff0a0, [0.52, 2.3, 0.3], [PI / 2, 0, 0]);   // sun disc
    a(new G.BoxGeometry(0.1, 0.62, 0.04), GOLD, [0, 1.15, 0.29]);
  } else if (k === 'bomber') {
    a(new G.CylinderGeometry(0.24, 0.26, 0.14, 10), 0x3a3a3a, [0, 1.97, 0]);
    for (const s2 of [-1, 1]) a(new G.TorusGeometry(0.07, 0.025, 5, 10), 0xb08a3a, [s2 * 0.08, 1.84, 0.17]);
    a(new G.CylinderGeometry(0.08, 0.07, 0.6, 6), tunic, [-0.43, 1.2, 0]);
    a(new G.SphereGeometry(0.2, 10, 8), 0x1a1a1a, [0.5, 1.5, 0.3]);   // bomb
    a(new G.CylinderGeometry(0.02, 0.02, 0.18, 5), 0xd8c9a0, [0.5, 1.75, 0.3]);
    for (let i = 0; i < 3; i++) a(new G.SphereGeometry(0.1, 8, 6), 0x1a1a1a, [-0.2 + i * 0.2, 0.95, 0.3]);   // bomb belt
  } else if (k === 'shield') {
    a(new G.SphereGeometry(0.24, 10, 6, 0, PI * 2, 0, PI * 0.6), STEEL, [0, 1.84, 0]);   // helmet
    a(new G.BoxGeometry(0.06, 0.2, 0.34), STEEL, [0, 1.8, 0.12]);   // nose guard
    a(new G.CylinderGeometry(0.08, 0.07, 0.6, 6), tunic, [-0.43, 1.2, 0]);
    a(new G.BoxGeometry(0.85, 1.25, 0.1), 0x2f4f8a, [-0.05, 1.05, 0.42]);   // tower shield
    a(new G.BoxGeometry(0.95, 0.08, 0.12), STEEL, [-0.05, 1.66, 0.42]);
    a(new G.BoxGeometry(0.95, 0.08, 0.12), STEEL, [-0.05, 0.44, 0.42]);
    a(new G.BoxGeometry(0.12, 0.12, 0.04), GOLD, [-0.05, 1.1, 0.48]);
  } else if (k === 'hexer') {
    a(new G.CylinderGeometry(0.4, 0.4, 0.03, 12), tunic, [0, 1.93, 0]);
    a(new G.ConeGeometry(0.24, 0.75, 10), tunic, [0.05, 2.3, -0.08], [-0.35, 0, 0.25]);   // crooked hat
    a(new G.CylinderGeometry(0.08, 0.07, 0.6, 6), tunic, [-0.43, 1.2, 0]);
    a(new G.CylinderGeometry(0.035, 0.035, 2.0, 6), 0x3a2a1a, [0.52, 1.0, 0.3]);
    a(new G.SphereGeometry(0.14, 10, 8), 0xe8e0d0, [0.52, 2.08, 0.3]);   // skull
    a(new G.SphereGeometry(0.05, 6, 5), 0x9dff6a, [0.52, 2.1, 0.43]);
  } else {
    a(new G.CylinderGeometry(0.24, 0.26, 0.12, 10), LEATHER, [0, 1.98, 0]);
    a(new G.CylinderGeometry(0.08, 0.07, 0.6, 6), tunic, [-0.43, 1.45, 0.3], [-1.45, 0, 0]);
    a(new G.BoxGeometry(0.12, 0.1, 1.1), WOOD, [0, 1.42, 0.62]);
    a(new G.BoxGeometry(1.0, 0.07, 0.1), STEEL, [0, 1.45, 1.05]);
  }
  return P.build('u');
}
export const RARITY_COLORS = [0xb8c0cc, 0x4ea8ff, 0xb46bff, 0xffc340];
const ringGeo = new THREE.TorusGeometry(0.55, 0.06, 6, 24).rotateX(PI / 2);
const ringMats = RARITY_COLORS.map((c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85 }));
export function makeUnit(k, rar = 0) {
  const g = new THREE.Group();
  const m = new THREE.Mesh((unitCache[k] ??= unitGeo(k)), unitMat);
  m.castShadow = true;
  g.add(m);
  if (rar > 0) { const r = new THREE.Mesh(ringGeo, ringMats[rar]); r.position.y = 0.08; g.add(r); }
  g.scale.setScalar(1.15);
  return g;
}

// ---- Monsters: geometry is merged once per type and shared by every instance ----
const BONE = 0xd8cdb4;
export const BEASTS = [
  { hide: 0x3b3f47, glow: 0xff5a1a, scale: 0.8 },                                   // runner
  { hide: 0x4b403a, glow: 0xff8a1a, scale: 1.35, plates: true },                    // brute
  { hide: 0x2b2233, glow: 0xff2a6a, scale: 3.4, crown: true },                      // queen
  { hide: 0x3d4a2c, glow: 0x9dff3a, scale: 0.95, sac: true },                       // spitter
  { hide: 0x2e2a3a, glow: 0xc06bff, scale: 0.85, wings: true },                     // flyer
  { hide: 0x5a4030, glow: 0xffd23a, scale: 1.1, bloat: true },                      // splitter
  { hide: 0x3a4a4a, glow: 0x3affd8, scale: 1.3, shell: true },                      // shellback
  { hide: 0x433832, glow: 0xff3a1a, scale: 4.0, plates: true, shell: true },        // behemoth
  { hide: 0x4a3a28, glow: 0xffe23a, scale: 3.4, bloat: true, crown: true },         // brood mother
  { hide: 0x241e30, glow: 0xb04bff, scale: 2.8, wings: true, crown: true },         // sky tyrant
];
export const GLOW = BEASTS.map((b) => b.glow);
export const BEAST_SCALE = BEASTS.map((b) => b.scale);
const hideMat = std({ vertexColors: true, roughness: 0.75, flatShading: true });
const wingMat = std({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide, flatShading: true });
const glowMats = GLOW.map((c) => std({ color: c, emissive: c, emissiveIntensity: 1.6 }));
const LEGS = [[1, 0.48], [-1, 0.48], [1, -0.55], [-1, -0.55]];
const beastCache = [];

function beastGeo(t) {
  const G = THREE, P = new Parts(), B = BEASTS[t], hide = B.hide;
  const b = (geo, pos, rot, scale, parent, col = hide) => P.add('body', geo, col, pos, rot, scale, parent);
  const gl = (geo, pos, rot, scale, parent) => P.add('glow', geo, 0xffffff, pos, rot, scale, parent);
  const fat = B.bloat ? 1.45 : 1;
  b(new G.SphereGeometry(0.5, 12, 9), [0, 0.82, -0.1], undefined, [0.78 * fat, 0.7 * fat, 1.5]);
  b(new G.SphereGeometry(0.47, 12, 9), [0, 0.95, 0.5], undefined, [0.95, 0.95, 1]);
  const H = new G.Matrix4().makeTranslation(0, 1.02, 0.95);
  b(new G.SphereGeometry(0.32, 10, 8), [0, 0, 0.1], undefined, [0.85, 0.7, 1.1], H);
  b(new G.ConeGeometry(0.2, 0.62, 6), [0, -0.02, 0.6], [PI / 2, 0, 0], undefined, H);
  const J = H.clone().multiply(new G.Matrix4().compose(new G.Vector3(0, -0.14, 0.25), new G.Quaternion().setFromEuler(new G.Euler(0.32, 0, 0)), new G.Vector3(1, 1, 1)));
  b(new G.BoxGeometry(0.24, 0.06, 0.6), [0, 0, 0.3], undefined, undefined, J);
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) b(new G.ConeGeometry(0.025, 0.1, 4), [s * 0.09, 0.07, 0.12 + i * 0.13], undefined, undefined, J, BONE);
  for (const s of [-1, 1]) {
    gl(new G.SphereGeometry(0.05, 6, 6), [s * 0.2, 0.08, 0.3], undefined, undefined, H);
    b(new G.ConeGeometry(0.07, 0.5, 6), [s * 0.2, 0.22, -0.12], [-1.1, 0, s * -0.35], undefined, H, BONE);
  }
  if (!B.shell && !B.sac) for (let i = 0; i < 6; i++) { const k = 1 - i * 0.12; gl(new G.ConeGeometry(0.07 * k, 0.42 * k, 5), [0, 1.32 - i * 0.05, 0.55 - i * 0.28], [-0.35, 0, 0]); }
  b(new G.ConeGeometry(0.2, 1.5, 6), [0, 0.8, -1.5], [-PI / 2, 0, 0]);
  if (!B.wings) {
    P.add('leg', new G.CylinderGeometry(0.12, 0.07, 0.66, 7), hide, [0, -0.33, 0]);
    P.add('leg', new G.BoxGeometry(0.18, 0.1, 0.32), hide, [0, -0.73, 0.08]);
    for (let c = -1; c < 2; c++) P.add('leg', new G.ConeGeometry(0.025, 0.12, 4), BONE, [c * 0.06, -0.74, 0.28], [PI / 2, 0, 0]);
  }
  if (B.plates) {
    b(new G.CylinderGeometry(0.85, 0.85, 0.1, 7), [0, 1.25, 0.72], [PI / 2 - 0.25, 0, 0], [1, 1, 0.85], null, BONE);
    for (const s of [-1, 1]) b(new G.SphereGeometry(0.3, 8, 6), [s * 0.42, 1.05, 0.35], undefined, [0.7, 0.5, 1.1], null, BONE);
  }
  if (B.shell) {
    b(new G.SphereGeometry(0.75, 12, 8, 0, PI * 2, 0, PI / 2), [0, 0.95, -0.15], undefined, [1, 0.8, 1.35], null, 0x6c7a6a);
    for (let i = 0; i < 5; i++) b(new G.ConeGeometry(0.09, 0.4, 5), [0, 1.55, 0.45 - i * 0.3], [-0.2, 0, 0], undefined, null, BONE);
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) gl(new G.SphereGeometry(0.06, 6, 4), [s * 0.55, 1.15, 0.35 - i * 0.32]);
  }
  if (B.sac) {
    gl(new G.SphereGeometry(0.45, 12, 9), [0, 1.35, -0.35], undefined, [0.9, 0.8, 1.1]);
    for (const s of [-1, 1]) b(new G.TorusGeometry(0.42, 0.04, 5, 14), [0, 1.35, -0.35 + s * 0.2], undefined, [1, 0.9, 1]);
  }
  if (B.bloat) for (let i = 0; i < 9; i++) { const a = rnd() * PI * 2, y = 0.6 + rnd() * 0.6; gl(new G.SphereGeometry(0.08 + rnd() * 0.06, 6, 5), [Math.cos(a) * 0.55, y, -0.1 + Math.sin(a) * 0.6]); }
  if (B.crown) {
    for (let i = -2; i <= 2; i++) b(new G.ConeGeometry(0.08, 0.9 - Math.abs(i) * 0.15, 6), [i * 0.16, 0.45, -0.05], [-0.5, 0, -i * 0.28], undefined, H, BONE);
    if (!B.wings) for (let i = 0; i < 5; i++) for (const s of [-1, 1]) gl(new G.ConeGeometry(0.05, 0.34, 5), [s * 0.3, 1.1, 0.4 - i * 0.3], [0, 0, s * -0.9]);
  }
  const out = { body: P.build('body'), glow: P.build('glow') };
  if (!B.wings) out.leg = P.build('leg');
  else {
    // A leathery bat wing in the x/z plane, hinged at x = 0.
    const sh = new G.Shape();
    sh.moveTo(0, 0.35); sh.lineTo(1.1, 0.75); sh.lineTo(2.2, 0.35); sh.lineTo(1.75, -0.05); sh.lineTo(1.5, -0.45); sh.lineTo(1.0, -0.15); sh.lineTo(0.6, -0.55); sh.lineTo(0, -0.35);
    P.add('wing', new G.ShapeGeometry(sh).rotateX(-PI / 2), 0x4a3a5a);
    P.add('wing', new G.CylinderGeometry(0.035, 0.03, 2.2, 5).rotateZ(PI / 2).translate(1.1, 0.02, -0.4), BONE);
    out.wing = P.build('wing');
  }
  return out;
}

export function makeBeast(t) {
  const geo = (beastCache[t] ??= beastGeo(t)), g = new THREE.Group();
  mesh(geo.body, hideMat, 0, 0, 0, g);
  mesh(geo.glow, glowMats[t], 0, 0, 0, g).castShadow = false;
  const legs = geo.leg ? LEGS.map(([s, z]) => mesh(geo.leg, hideMat, s * 0.34, 0.78, z, g)) : [];
  const wings = [];
  if (geo.wing) for (const s of [1, -1]) { const w = mesh(geo.wing, wingMat, s * 0.3, 1.15, 0.2, g); w.scale.x = s; wings.push(w); }
  g.scale.setScalar(BEAST_SCALE[t] * (0.92 + rnd() * 0.16));
  return { g, legs, wings };
}

// ---- Portraits: each model rendered once into a small picture for the menus ----
let pr = null;
const portraits = new Map();
export function portrait(kind, key, rar = 0) {
  const id = `${kind}:${key}:${rar}`;
  if (portraits.has(id)) return portraits.get(id);
  if (!pr) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(128, 128);
    renderer.setPixelRatio(1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xdfeaff, 0x3a3020, 1.6));
    const key = new THREE.DirectionalLight(0xfff0dd, 3.2); key.position.set(3, 5, 6); scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fc4ff, 2); rim.position.set(-4, 3, -5); scene.add(rim);
    pr = { renderer, scene, camera: new THREE.PerspectiveCamera(30, 1, 0.1, 100) };
  }
  const obj = kind === 'unit' ? makeUnit(key, rar) : makeBeast(key).g;
  obj.scale.setScalar(1);
  obj.rotation.y = kind === 'unit' ? 0.5 : 0.75;
  for (const w of obj.children) if (w.geometry === beastCache[key]?.wing) w.rotation.z = (w.scale.x > 0 ? 1 : -1) * 0.35;
  pr.scene.add(obj);
  const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const d = Math.max(size.x, size.y, size.z) * (kind === 'unit' ? 1.9 : 1.45);
  pr.camera.position.set(c.x + d * 0.25, c.y + d * 0.28, c.z + d);
  pr.camera.lookAt(c);
  pr.renderer.render(pr.scene, pr.camera);
  const url = pr.renderer.domElement.toDataURL();
  pr.scene.remove(obj);
  portraits.set(id, url);
  return url;
}
