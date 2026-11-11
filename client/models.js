// Everything that is drawn: terrain, castle, heroes and monsters. No game rules here.
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
const brickTex = canvasTex(256, (g, s) => {
  g.fillStyle = '#4a4742'; g.fillRect(0, 0, s, s);
  for (let r = 0; r < 8; r++) { const off = r % 2 ? 32 : 0; for (let c = -1; c < 4; c++) { const v = (120 + rnd() * 50) | 0; g.fillStyle = `rgb(${v + 8},${v + 4},${v - 6})`; g.fillRect(c * 64 + off + 2, r * 32 + 2, 60, 28); } }
  for (let i = 0; i < 3500; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.14})`; g.fillRect(rnd() * s, rnd() * s, 2, 2); }
});
const woodTex = canvasTex(128, (g, s) => {
  for (let i = 0; i < 8; i++) { const v = (70 + rnd() * 30) | 0; g.fillStyle = `rgb(${v + 35},${v},${v - 35})`; g.fillRect(i * 16, 0, 15, s); }
  g.fillStyle = 'rgba(0,0,0,.4)'; for (let i = 0; i < 8; i++) g.fillRect(i * 16 + 15, 0, 1, s);
});
const roofTex = canvasTex(128, (g, s) => {
  g.fillStyle = '#555'; g.fillRect(0, 0, s, s);
  for (let r = 0; r < 8; r++) for (let c = 0; c < 9; c++) { const v = (150 + rnd() * 70) | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(c * 16 + (r % 2 ? 8 : 0) - 8, r * 16, 15, 14); }
});
function stoneMat(rx, ry) { const t = brickTex.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return std({ map: t, roughness: 0.95 }); }
function roofMat(color, rx, ry) { const t = roofTex.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return std({ map: t, color, roughness: 0.8, flatShading: true }); }

const stonePlain = std({ color: 0x8f8b84, roughness: 0.95 });
const woodMat = std({ map: woodTex, roughness: 0.85 });
const trunkMat = std({ color: 0x5a3d24, roughness: 1 });
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

const WALL_H = 3.4;
function buildSegment(scene, s) {
  const g = new THREE.Group();
  g.position.set(s.x, 0, s.z);
  scene.add(g);
  const alongX = s.hw > s.hd, L = Math.max(s.hw, s.hd) * 2, T = Math.min(s.hw, s.hd) * 2;
  if (!alongX) g.rotation.y = PI / 2;
  if (s.gate) {
    mesh(new THREE.BoxGeometry(L, 1.1, T + 0.3), stoneMat(1, 0.3), 0, WALL_H - 0.3, 0, g);
    for (const k of [-1, 1]) mesh(new THREE.BoxGeometry(L / 2 - 0.05, WALL_H - 0.9, 0.3), woodMat, (k * L) / 4, (WALL_H - 0.9) / 2, 0, g);
    for (const k of [-1, 0, 1]) mesh(new THREE.BoxGeometry(L, 0.14, 0.38), stonePlain, 0, 1.25 + k * 0.8, 0, g).material = ironMat;
  } else {
    mesh(new THREE.BoxGeometry(L, WALL_H, T), stoneMat(L / 4, WALL_H / 4), 0, WALL_H / 2, 0, g);
    for (let i = 0; i < 3; i++) for (const k of [-1, 1]) mesh(new THREE.BoxGeometry(0.8, 0.7, 0.35), stonePlain, -L / 2 + 0.67 + i * 1.33, WALL_H + 0.35, k * (T / 2 - 0.18), g);
  }
  return g;
}
const ironMat = std({ color: 0x2b2b2e, metalness: 0.8, roughness: 0.45 });

function buildTower(scene, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  scene.add(g);
  mesh(new THREE.CylinderGeometry(1.9, 2.1, 6.2, 14), stoneMat(4, 2), 0, 3.1, 0, g);
  mesh(new THREE.CylinderGeometry(2.25, 2.25, 0.6, 14), stonePlain, 0, 6.3, 0, g);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; mesh(new THREE.BoxGeometry(0.8, 0.7, 0.4), stonePlain, Math.cos(a) * 2.05, 6.95, Math.sin(a) * 2.05, g).rotation.y = -a + PI / 2; }
  mesh(new THREE.ConeGeometry(2, 2.6, 14), roofMat(0x4a5d78, 6, 2), 0, 8.2, 0, g);
  return g;
}

function buildTownHall(scene) {
  const g = new THREE.Group();
  scene.add(g);
  mesh(new THREE.BoxGeometry(7, 5.5, 7), stoneMat(2, 1.5), 0, 2.75, 0, g);
  for (let i = 0; i < 5; i++) for (const s of [-1, 1]) {
    mesh(new THREE.BoxGeometry(0.8, 0.7, 0.4), stonePlain, -2.8 + i * 1.4, 5.85, s * 3.3, g);
    mesh(new THREE.BoxGeometry(0.4, 0.7, 0.8), stonePlain, s * 3.3, 5.85, -2.8 + i * 1.4, g);
  }
  mesh(new THREE.BoxGeometry(4.4, 4, 4.4), stoneMat(1.2, 1), 0, 7.5, 0, g);
  mesh(new THREE.ConeGeometry(3.6, 3.4, 4), roofMat(0x8a3a2e, 4, 2), 0, 11.2, 0, g).rotation.y = PI / 4;
  mesh(new THREE.BoxGeometry(1.6, 2.6, 0.2), woodMat, 0, 1.3, 3.55, g);
  for (const x of [-2.2, 2.2]) mesh(new THREE.BoxGeometry(0.6, 1, 0.1), winMat, x, 3.4, 3.52, g);
  for (const x of [-1, 1]) mesh(new THREE.BoxGeometry(0.5, 0.9, 0.1), winMat, x, 8, 2.22, g);
  mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 6), trunkMat, 0, 14.2, 0, g);
  const fg = new THREE.PlaneGeometry(1.8, 1.1, 6, 1);
  fg.translate(0.9, 0, 0);
  return { g, flag: mesh(fg, std({ color: 0xb3242a, side: THREE.DoubleSide, roughness: 0.8 }), 0, 15, 0, g) };
}

function buildMine(scene, s) {
  const g = new THREE.Group();
  g.position.set(s.x, 0, s.z);
  scene.add(g);
  const rock = std({ color: 0x6b6660, roughness: 1, flatShading: true });
  mesh(new THREE.DodecahedronGeometry(2.1, 0), rock, 0, 0.9, -0.3, g).scale.set(1, 0.75, 0.9);
  mesh(new THREE.DodecahedronGeometry(1.2, 0), rock, -1.2, 0.5, 0.6, g);
  mesh(new THREE.BoxGeometry(1.3, 1.5, 0.3), std({ color: 0x0c0a08 }), 0.2, 0.75, 1.35, g);
  for (const k of [-1, 1]) mesh(new THREE.BoxGeometry(0.18, 1.7, 0.18), woodMat, 0.2 + k * 0.75, 0.85, 1.5, g);
  mesh(new THREE.BoxGeometry(1.9, 0.18, 0.2), woodMat, 0.2, 1.7, 1.5, g);
  const gold = std({ color: 0xf2c230, metalness: 0.9, roughness: 0.3 });
  for (let i = 0; i < 6; i++) mesh(new THREE.IcosahedronGeometry(0.17, 0), gold, 1.1 + rnd() * 0.7, 0.15, 0.9 + rnd() * 0.9, g);
  return g;
}

function buildSmith(scene, s) {
  const g = new THREE.Group();
  g.position.set(s.x, 0, s.z);
  scene.add(g);
  mesh(new THREE.BoxGeometry(4, 2.6, 3.4), stoneMat(1.2, 0.8), 0, 1.3, 0, g);
  mesh(new THREE.ConeGeometry(3.3, 1.8, 4), roofMat(0x3d3d44, 3, 1.5), 0, 3.5, 0, g).rotation.y = PI / 4;
  mesh(new THREE.BoxGeometry(0.9, 3.2, 0.9), stonePlain, 1.2, 3.4, -0.8, g);
  mesh(new THREE.BoxGeometry(1.4, 1, 0.2), fireMat, -0.6, 0.8, 1.72, g);
  mesh(new THREE.BoxGeometry(0.9, 0.5, 0.4), ironMat, 2.6, 0.45, 1.2, g);
  return g;
}

function buildMortar(scene) {
  const g = new THREE.Group();
  g.position.set(...MORTAR_POS);
  scene.add(g);
  mesh(new THREE.BoxGeometry(1.6, 0.5, 1.6), woodMat, 0, 0.25, 0, g);
  mesh(new THREE.CylinderGeometry(0.55, 0.65, 1.5, 12), ironMat, 0, 1.1, 0.15, g).rotation.x = 0.35;
  for (let i = 0; i < 3; i++) mesh(new THREE.SphereGeometry(0.3, 10, 8), ironMat, 1.3 + (i % 2) * 0.55, 0.3, -0.3 + i * 0.3, g);
  return g;
}

function buildBallista(scene) {
  const g = new THREE.Group();
  g.position.set(...BALLISTA_POS);
  scene.add(g);
  mesh(new THREE.BoxGeometry(0.5, 0.35, 2.6), woodMat, 0, 0.3, 0.2, g);
  for (const k of [-1, 1]) mesh(new THREE.BoxGeometry(1.7, 0.16, 0.2), woodMat, k * 0.8, 0.45, 1.1, g).rotation.y = k * 0.45;
  mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), ironMat, 0, 0.55, 0.5, g).rotation.x = PI / 2;
  return g;
}
export const MORTAR_POS = [6.5, 0, 8];
export const BALLISTA_POS = [2.4, 5.5, 2.4];

export function buildWorld(scene, layout) {
  const { S } = layout;
  buildGround(scene, S);
  buildForest(scene, S);
  const segs = layout.segs.map((s) => buildSegment(scene, s));
  const towers = layout.towers.map(([x, z]) => buildTower(scene, x, z));
  const { g: hall, flag } = buildTownHall(scene);
  const mine = buildMine(scene, layout.spots.mine), smith = buildSmith(scene, layout.spots.smith);
  const mortar = buildMortar(scene), ballista = buildBallista(hall);
  // Wall archers. The four tower posts shoot from inside the tower, so they get no figure.
  const guards = layout.posts.map(([x, z, seg]) => {
    if (seg < 0) return null;
    const m = makeGuard();
    m.position.set(x, WALL_H, z);
    m.rotation.y = Math.abs(x) > Math.abs(z) ? (x > 0 ? PI / 2 : -PI / 2) : (z > 0 ? 0 : PI);
    scene.add(m);
    return m;
  });
  const torches = [];
  for (const [x, y, z] of [[-3, 3.2, S + 1.2], [3, 3.2, S + 1.2], [0, 3.2, 4.4], [-S + 1.5, 3.2, 0], [S - 1.5, 3.2, 0], [0, 3.2, -S + 1.5]]) {
    const l = new THREE.PointLight(0xff8a3c, 0, 26, 2);
    l.position.set(x, y, z);
    scene.add(l);
    torches.push(l);
    mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 6), trunkMat, x, y - 0.6, z, scene);
    mesh(new THREE.SphereGeometry(0.16, 8, 6), fireMat, x, y, z, scene).castShadow = false;
  }
  return { segs, flag, torches, towers, hall, mine, smith, mortar, ballista, guards, wallH: WALL_H };
}

// ---- Heroes ----
const skin = std({ color: 0xd9a273, roughness: 0.8 });
const steel = std({ color: 0x9aa3ae, metalness: 0.85, roughness: 0.35 });
const blade = std({ color: 0xe8edf2, metalness: 1, roughness: 0.2 });
const leather = std({ color: 0x4a3222, roughness: 0.9 });
export const orbMat = std({ color: 0x7fe8ff, emissive: 0x35c8ff, emissiveIntensity: 2.5 });
const BODY = { knight: steel, archer: std({ color: 0x5b4a32, roughness: 0.85 }), mage: std({ color: 0x40305e, roughness: 0.85 }) };
export const TEAM_COLORS = [0x2f6fd0, 0xc23b3b, 0xe0b030, 0x3d9a4a];

export function makeHero(kind, color) {
  const bodyM = BODY[kind], accM = std({ color, roughness: 0.85 }), g = new THREE.Group(), G = THREE;
  const legs = [-1, 1].map((s) => {
    const p = new G.Group(); p.position.set(s * 0.14, 0.85, 0); g.add(p);
    mesh(new G.CylinderGeometry(0.11, 0.09, 0.7, 8), bodyM, 0, -0.38, 0, p);
    mesh(new G.BoxGeometry(0.17, 0.14, 0.32), leather, 0, -0.78, 0.05, p);
    return p;
  });
  if (kind === 'mage') mesh(new G.ConeGeometry(0.52, 1.3, 12), accM, 0, 0.72, 0, g);
  mesh(new G.CylinderGeometry(0.33, 0.25, 0.72, 12), bodyM, 0, 1.22, 0, g);
  mesh(new G.CylinderGeometry(0.275, 0.275, 0.1, 12), leather, 0, 0.9, 0, g);
  mesh(new G.SphereGeometry(0.19, 14, 10), skin, 0, 1.8, 0, g);
  const arms = [-1, 1].map((s) => {
    const p = new G.Group(); p.position.set(s * 0.43, 1.5, 0); g.add(p);
    mesh(new G.SphereGeometry(0.16, 10, 8), kind === 'knight' ? bodyM : accM, 0, 0, 0, p).scale.set(1, 0.8, 1);
    mesh(new G.CylinderGeometry(0.085, 0.075, 0.6, 8), bodyM, 0, -0.32, 0, p);
    mesh(new G.SphereGeometry(0.09, 8, 6), skin, 0, -0.66, 0, p);
    return p;
  });
  mesh(new G.BoxGeometry(0.62, 1.05, 0.04), accM, 0, 1.0, -0.31, g).rotation.x = 0.12;
  if (kind === 'knight') {
    mesh(new G.BoxGeometry(0.34, 0.95, 0.04), accM, 0, 1.05, 0.3, g);
    mesh(new G.SphereGeometry(0.23, 14, 8, 0, PI * 2, 0, PI * 0.6), steel, 0, 1.82, 0, g);
    mesh(new G.BoxGeometry(0.05, 0.22, 0.04), steel, 0, 1.76, 0.21, g);
    mesh(new G.ConeGeometry(0.07, 0.42, 8), accM, 0, 2.14, -0.03, g);
    mesh(new G.BoxGeometry(0.07, 0.03, 0.95), blade, 0, -0.66, 0.56, arms[1]);
    mesh(new G.BoxGeometry(0.3, 0.05, 0.06), leather, 0, -0.66, 0.08, arms[1]);
    mesh(new G.CylinderGeometry(0.42, 0.42, 0.06, 6), accM, 0, -0.42, 0.17, arms[0]).rotation.x = PI / 2;
    mesh(new G.SphereGeometry(0.09, 8, 6), steel, 0, -0.42, 0.22, arms[0]);
    arms[0].rotation.x = -0.7;
  } else if (kind === 'archer') {
    mesh(new G.ConeGeometry(0.27, 0.44, 10), accM, 0, 1.99, -0.03, g);
    mesh(new G.CylinderGeometry(0.09, 0.09, 0.6, 8), leather, 0.14, 1.35, -0.38, g).rotation.z = -0.3;
    mesh(new G.TorusGeometry(0.55, 0.028, 6, 18, PI), leather, -0.43, 1.45, 0.7, g).rotation.set(0, -PI / 2, -PI / 2);
    mesh(new G.CylinderGeometry(0.006, 0.006, 1.1, 4), blade, -0.43, 1.45, 0.7, g);
    arms[0].rotation.x = -1.45;
  } else {
    mesh(new G.CylinderGeometry(0.38, 0.38, 0.03, 14), accM, 0, 1.93, 0, g);
    mesh(new G.ConeGeometry(0.25, 0.62, 12), accM, 0, 2.24, 0, g);
    mesh(new G.CylinderGeometry(0.035, 0.035, 2.1, 6), leather, 0.52, 1.05, 0.3, g);
    mesh(new G.SphereGeometry(0.15, 12, 10), orbMat, 0.52, 2.2, 0.3, g).castShadow = false;
  }
  g.scale.setScalar(1.2);
  return { g, legs, arms, kind };
}

// Per-frame hero pose. swing goes 1 -> 0 after an attack.
export function poseHero(h, walk, swing, t) {
  const w = Math.sin(t * 11) * 0.7 * walk;
  h.legs[0].rotation.x = w; h.legs[1].rotation.x = -w;
  if (h.kind === 'knight') h.arms[1].rotation.x = swing > 0 ? -2.5 + (1 - swing) * 2.7 : -0.25 - w * 0.5;
  else if (h.kind === 'archer') h.arms[1].rotation.x = -0.9 - swing * 0.6;
  else h.arms[1].rotation.x = -1 - swing * 1.2;
}

// ---- Monsters: geometry is merged once per type and shared by every instance ----
const _c = new THREE.Color(), _e = new THREE.Euler(), _q = new THREE.Quaternion();
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
    (this.groups[key] ??= []).push(geo);
  }
  build(key) { return mergeGeometries(this.groups[key]); }
}

let guardGeo = null;
const guardMat = std({ vertexColors: true, roughness: 0.85 });
function makeGuard() {
  if (!guardGeo) {
    const G = THREE, P = new Parts(), a = (geo, col, pos, rot) => P.add('g', geo, col, pos, rot);
    for (const s of [-1, 1]) a(new G.CylinderGeometry(0.11, 0.09, 0.7, 6), 0x4a3222, [s * 0.14, 0.47, 0]);
    a(new G.CylinderGeometry(0.33, 0.25, 0.72, 8), 0x8a2f2f, [0, 1.22, 0]);
    a(new G.SphereGeometry(0.19, 10, 8), 0xd9a273, [0, 1.8, 0]);
    a(new G.ConeGeometry(0.27, 0.44, 8), 0x8a2f2f, [0, 1.99, -0.03]);
    a(new G.CylinderGeometry(0.08, 0.07, 0.6, 6), 0x8a2f2f, [-0.43, 1.45, 0.3], [-1.45, 0, 0]);
    a(new G.CylinderGeometry(0.08, 0.07, 0.6, 6), 0x8a2f2f, [0.43, 1.2, 0]);
    a(new G.TorusGeometry(0.55, 0.03, 5, 14, PI), 0x4a3222, [-0.43, 1.45, 0.7], [0, -PI / 2, -PI / 2]);
    guardGeo = P.build('g');
  }
  const m = new THREE.Mesh(guardGeo, guardMat);
  m.castShadow = true;
  return m;
}

const HIDE = [0x3b3f47, 0x4b403a, 0x2b2233], BONE = 0xd8cdb4;
export const GLOW = [0xff5a1a, 0xff8a1a, 0xff2a6a];
export const BEAST_SCALE = [0.8, 1.35, 3.4];
const hideMat = std({ vertexColors: true, roughness: 0.75, flatShading: true });
const glowMats = GLOW.map((c) => std({ color: c, emissive: c, emissiveIntensity: 1.6 }));
const LEGS = [[1, 0.48], [-1, 0.48], [1, -0.55], [-1, -0.55]];
const beastCache = [];

function beastGeo(t) {
  const G = THREE, P = new Parts(), hide = HIDE[t];
  const b = (geo, pos, rot, scale, parent, col = hide) => P.add('body', geo, col, pos, rot, scale, parent);
  const gl = (geo, pos, rot, parent) => P.add('glow', geo, 0xffffff, pos, rot, undefined, parent);
  b(new G.SphereGeometry(0.5, 10, 8), [0, 0.82, -0.1], undefined, [0.78, 0.7, 1.5]);
  b(new G.SphereGeometry(0.47, 10, 8), [0, 0.95, 0.5], undefined, [0.95, 0.95, 1]);
  const H = new G.Matrix4().makeTranslation(0, 1.02, 0.95);
  b(new G.SphereGeometry(0.32, 10, 8), [0, 0, 0.1], undefined, [0.85, 0.7, 1.1], H);
  b(new G.ConeGeometry(0.2, 0.62, 6), [0, -0.02, 0.6], [PI / 2, 0, 0], undefined, H);
  const J = H.clone().multiply(new G.Matrix4().compose(new G.Vector3(0, -0.14, 0.25), new G.Quaternion().setFromEuler(new G.Euler(0.32, 0, 0)), new G.Vector3(1, 1, 1)));
  b(new G.BoxGeometry(0.24, 0.06, 0.6), [0, 0, 0.3], undefined, undefined, J);
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) b(new G.ConeGeometry(0.025, 0.1, 4), [s * 0.09, 0.07, 0.12 + i * 0.13], undefined, undefined, J, BONE);
  for (const s of [-1, 1]) {
    gl(new G.SphereGeometry(0.05, 6, 6), [s * 0.2, 0.08, 0.3], undefined, H);
    b(new G.ConeGeometry(0.07, 0.5, 6), [s * 0.2, 0.22, -0.12], [-1.1, 0, s * -0.35], undefined, H, BONE);
  }
  for (let i = 0; i < 6; i++) { const k = 1 - i * 0.12; gl(new G.ConeGeometry(0.07 * k, 0.42 * k, 5), [0, 1.32 - i * 0.05, 0.55 - i * 0.28], [-0.35, 0, 0]); }
  b(new G.ConeGeometry(0.2, 1.5, 6), [0, 0.8, -1.5], [-PI / 2, 0, 0]);
  P.add('leg', new G.CylinderGeometry(0.12, 0.07, 0.66, 7), hide, [0, -0.33, 0]);
  P.add('leg', new G.BoxGeometry(0.18, 0.1, 0.32), hide, [0, -0.73, 0.08]);
  for (let c = -1; c < 2; c++) P.add('leg', new G.ConeGeometry(0.025, 0.12, 4), BONE, [c * 0.06, -0.74, 0.28], [PI / 2, 0, 0]);
  if (t === 1) {
    b(new G.CylinderGeometry(0.85, 0.85, 0.1, 7), [0, 1.25, 0.72], [PI / 2 - 0.25, 0, 0], [1, 1, 0.85], null, BONE);
    for (const s of [-1, 1]) b(new G.SphereGeometry(0.3, 8, 6), [s * 0.42, 1.05, 0.35], undefined, [0.7, 0.5, 1.1], null, BONE);
  }
  if (t === 2) {
    for (let i = -2; i <= 2; i++) b(new G.ConeGeometry(0.08, 0.9 - Math.abs(i) * 0.15, 6), [i * 0.16, 0.45, -0.05], [-0.5, 0, -i * 0.28], undefined, H, BONE);
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) gl(new G.ConeGeometry(0.05, 0.34, 5), [s * 0.3, 1.1, 0.4 - i * 0.3], [0, 0, s * -0.9]);
  }
  return { body: P.build('body'), glow: P.build('glow'), leg: P.build('leg') };
}

export function makeBeast(t) {
  const geo = (beastCache[t] ??= beastGeo(t)), g = new THREE.Group();
  mesh(geo.body, hideMat, 0, 0, 0, g);
  mesh(geo.glow, glowMats[t], 0, 0, 0, g).castShadow = false;
  const legs = LEGS.map(([s, z]) => mesh(geo.leg, hideMat, s * 0.34, 0.78, z, g));
  g.scale.setScalar(BEAST_SCALE[t] * (0.92 + rnd() * 0.16));
  return { g, legs };
}
