// Everything that is drawn: terrain, castle, defenders and monsters. No game rules here.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SUN, sunLevel } from './look.js';

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

// ---- The land ----
// The ground is painted, not generated noise: washes of green first, then tufts of grass blade by
// blade, then a few flowers. Whatever is painted near an edge is painted again on the far side,
// so the picture repeats without a seam.
function tiled(size, paint) {
  return canvasTex(size, (g, s) => {
    const wrap = (x, y, r, draw) => {
      for (const dx of [-s, 0, s]) for (const dy of [-s, 0, s]) {
        if (x + dx < -r || x + dx > s + r || y + dy < -r || y + dy > s + r) continue;
        g.save(); g.translate(dx, dy); draw(); g.restore();
      }
    };
    paint(g, s, wrap);
  });
}
const pick = (a) => a[(rnd() * a.length) | 0];
const GRASS = ['#3a5f2c', '#42692f', '#55823c', '#679645', '#739f4a', '#345628'];
// A tuft: a few blades fanning out of one spot. The dice are thrown here and the drawing comes
// back as a function, so a tuft repeated across an edge is the same tuft.
function tuft(g, x, y, k = 1) {
  const n = 3 + ((rnd() * 5) | 0), lean = (rnd() - 0.5) * 1.2, c = pick(GRASS), alpha = 0.55 + rnd() * 0.4, blades = [];
  for (let i = 0; i < n; i++) blades.push([-PI / 2 + lean + (i - (n - 1) / 2) * 0.32 + (rnd() - 0.5) * 0.2, (7 + rnd() * 10) * k, (1.3 + rnd() * 1.3) * k]);
  return () => {
    g.strokeStyle = c; g.globalAlpha = alpha; g.lineCap = 'round';
    blades.forEach(([a, len, w], i) => {
      g.lineWidth = w; g.beginPath(); g.moveTo(x + (i - n / 2) * 1.6 * k, y);
      g.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + lean * 3 * k, y + Math.sin(a) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
      g.stroke();
    });
    g.globalAlpha = 1;
  };
}
// A soft dab of one colour, as a loaded brush leaves it.
const wash = (g, x, y, r, c) => () => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `${c}55`); gr.addColorStop(1, `${c}00`); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); };
const grassTex = tiled(1024, (g, s, wrap) => {
  g.fillStyle = '#4d7439'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 90; i++) { const x = rnd() * s, y = rnd() * s, r = 60 + rnd() * 150; wrap(x, y, r, wash(g, x, y, r, pick(['#3f6631', '#5a8640', '#466d35', '#63903f']))); }
  for (let i = 0; i < 2800; i++) { const x = rnd() * s, y = rnd() * s; wrap(x, y, 24, tuft(g, x, y)); }
  for (let i = 0; i < 150; i++) {
    const x = rnd() * s, y = rnd() * s, r = 1.6 + rnd() * 1.2, c = pick(['#f2ecd0', '#f2ecd0', '#e9cf5a', '#d9a0b8']);
    wrap(x, y, 6, () => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, PI * 2); g.fill(); g.fillStyle = '#b8892a'; g.beginPath(); g.arc(x, y, r * 0.4, 0, PI * 2); g.fill(); });
  }
});
// Trodden earth: washes, short dabs of the brush, pebbles with a shadow under them.
const dirtTex = tiled(512, (g, s, wrap) => {
  g.fillStyle = '#7d6c53'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 40; i++) { const x = rnd() * s, y = rnd() * s, r = 30 + rnd() * 70; wrap(x, y, r, wash(g, x, y, r, pick(['#6d5d47', '#8b7a5e', '#75644c', '#94826a']))); }
  for (let i = 0; i < 1500; i++) {
    const x = rnd() * s, y = rnd() * s, a = rnd() * PI, len = 3 + rnd() * 6, w = 1 + rnd() * 1.6, c = pick(['#665741', '#8f7d62', '#5c4e3a', '#9a886c']), al = 0.3 + rnd() * 0.4;
    wrap(x, y, 10, () => { g.strokeStyle = c; g.globalAlpha = al; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke(); g.globalAlpha = 1; });
  }
  for (let i = 0; i < 110; i++) {
    const x = rnd() * s, y = rnd() * s, rx = 2 + rnd() * 2.8, ry = rx * (0.6 + rnd() * 0.3), rot = rnd() * PI, c = pick(['#a39a88', '#8d8373', '#b0a590']);
    wrap(x, y, 8, () => { g.fillStyle = 'rgba(60,48,34,.5)'; g.beginPath(); g.ellipse(x + 0.8, y + 1.3, rx, ry, rot, 0, PI * 2); g.fill(); g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, PI * 2); g.fill(); });
  }
});
// Earth laid over the grass like a patch of paint. edge: its outline in pixels, each point with the
// way outwards, so the same outline can be drawn a little larger and fainter for a ragged rim.
// Grass grows back over the rim in tufts.
function patchTex(w, h, edge, tufts, more) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const trace = (grow) => { g.beginPath(); edge.forEach(([x, y, nx, ny], i) => (i ? g.lineTo(x + nx * grow, y + ny * grow) : g.moveTo(x + nx * grow, y + ny * grow))); g.closePath(); };
  g.fillStyle = g.createPattern(dirtTex.image, 'repeat');
  for (const [grow, alpha] of [[10, 0.3], [5, 0.55], [0, 1]]) { g.globalAlpha = alpha; trace(grow); g.fill(); }
  g.globalAlpha = 1;
  if (more) more(g);
  for (const [x, y] of tufts) tuft(g, x, y, 0.9)();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
const earthMat = (map) => std({ map, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, emissive: 0xaab6c4, emissiveIntensity: 0, userData: { smooth: true } });

// The grass, the trodden earth of the castle and the road to its gate, and the tufts and flowers
// that stand in the fields. Returns what the seasons repaint.
function buildGround(scene, S) {
  const geo = new THREE.PlaneGeometry(360, 360, 180, 180);
  geo.rotateX(-PI / 2);
  const p = geo.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, hAt(x, z));
    // Lighter and darker stretches, so the repeating picture is not seen to repeat.
    const v = 0.9 + Math.sin(x * 0.09) * Math.cos(z * 0.07) * 0.07 + Math.sin(x * 0.023 + 1.3) * Math.cos(z * 0.031) * 0.09 + rnd() * 0.04;
    col[i * 3] = v * 0.98; col[i * 3 + 1] = v; col[i * 3 + 2] = v * 0.94;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const grass = grassTex.clone();
  grass.needsUpdate = true; grass.repeat.set(9, 9);
  const ground = new THREE.Mesh(geo, std({ map: grass, vertexColors: true, roughness: 1, emissive: 0xaab6c4, emissiveIntensity: 0 }));
  ground.receiveShadow = true;
  ground.material.userData.smooth = true;   // see look.js: the land is never painted in bands
  scene.add(ground);

  // The castle stands on trodden earth: a square with rounded corners and an unsteady edge.
  const W = 2 * S + 12, px = 1024 / W, half = (S + 2.8) * px, mid = 512, edge = [], rim = [];
  const side = (ax, ay, nx, ny) => { for (let t = -half + 30; t <= half - 30; t += 13) { const j = (rnd() - 0.5) * 16; edge.push([mid + ax * t + nx * (half + j), mid + ay * t + ny * (half + j), nx, ny]); } };
  const corner = (cx, cy, from) => { for (let k = 1; k < 5; k++) { const a = from + (k / 5) * (PI / 2), j = (rnd() - 0.5) * 10; edge.push([mid + cx * (half - 30) + Math.cos(a) * (30 + j), mid + cy * (half - 30) + Math.sin(a) * (30 + j), Math.cos(a), Math.sin(a)]); } };
  side(1, 0, 0, -1); corner(1, -1, -PI / 2); side(0, 1, 1, 0); corner(1, 1, 0); side(-1, 0, 0, 1); corner(-1, 1, PI / 2); side(0, -1, -1, 0); corner(-1, -1, PI);
  for (let i = 0; i < 300; i++) { const [x, y, nx, ny] = pick(edge), d = (rnd() - 0.25) * 18; rim.push([x + nx * d + (rnd() - 0.5) * 14, y + ny * d + (rnd() - 0.5) * 14]); }
  const court = patchTex(1024, 1024, edge, rim, (g) => {
    // Darker where everybody walks: before the gate and around the keep.
    for (const [x, y, r] of [[mid, mid + S * px, 90], [mid, mid + S * px * 0.55, 110], [mid, mid, 150]]) wash(g, x, y, r, '#5a4b38')();
  });
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(W, W).rotateX(-PI / 2), earthMat(court));
  yard.position.y = 0.05; yard.receiveShadow = true; yard.renderOrder = 1;
  scene.add(yard);

  // The road from the gate: two ruts, a wandering edge. It repeats along its length.
  const RW = 256, RH = 1024, wander = () => { const ph = [rnd() * 6.3, rnd() * 6.3, rnd() * 6.3]; return (y) => 9 * Math.sin((y / RH) * 2 * PI + ph[0]) + 6 * Math.sin((y / RH) * 6 * PI + ph[1]) + 3.5 * Math.sin((y / RH) * 14 * PI + ph[2]); };
  const left = wander(), right = wander(), rut = wander(), roadEdge = [], roadRim = [];
  for (let y = 0; y <= RH; y += 12) roadEdge.push([38 + left(y), y, -1, 0]);
  for (let y = RH; y >= 0; y -= 12) roadEdge.push([218 + right(y), y, 1, 0]);
  for (let i = 0; i < 150; i++) { const y = 24 + rnd() * (RH - 48), l = rnd() < 0.5; roadRim.push([(l ? 38 + left(y) : 218 + right(y)) + (rnd() - 0.3) * 16 * (l ? -1 : 1), y]); }
  const roadPic = patchTex(RW, RH, roadEdge, roadRim, (g) => {
    g.lineCap = 'round';
    for (const x of [96, 160]) for (const [w, a] of [[17, 0.2], [7, 0.24]]) {
      g.strokeStyle = `rgba(62,49,34,${a})`; g.lineWidth = w; g.beginPath();
      for (let y = -10; y <= RH + 10; y += 10) g.lineTo(x + rut(y) * 0.45, y);
      g.stroke();
    }
  });
  roadPic.wrapT = THREE.RepeatWrapping;
  const L = 176 - S, rg = new THREE.PlaneGeometry(7.2, L, 6, Math.round(L / 2)).rotateX(-PI / 2).translate(0, 0, S - 1.2 + L / 2);
  for (let i = 0; i < rg.attributes.position.count; i++) rg.attributes.position.setY(i, hAt(rg.attributes.position.getX(i), rg.attributes.position.getZ(i)) + 0.09);
  rg.computeVertexNormals();
  roadPic.repeat.set(1, L / 28.8);
  const road = new THREE.Mesh(rg, earthMat(roadPic));
  road.receiveShadow = true; road.renderOrder = 1;
  scene.add(road);

  // Tufts of grass and a few flowers stand in the fields, away from the castle and off the road.
  // A tuft is three blades leaning apart. Each blade is drawn from both sides and lit like the
  // ground it stands on, or half of them would show their unlit backs.
  const blades = [];
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * PI * 2 + 0.4, c = Math.cos(a), sn = Math.sin(a), l = [-0.075 * sn, 0, 0.075 * c], r = [0.075 * sn, 0, -0.075 * c], tip = [c * 0.13, 0.32, sn * 0.13];
    blades.push(...l, ...r, ...tip, ...r, ...l, ...tip);
  }
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.Float32BufferAttribute(blades, 3));
  tg.setAttribute('normal', new THREE.Float32BufferAttribute(blades.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  const spots = [];
  for (let i = 0; i < 9000 && spots.length < 3600; i++) {
    const x = (rnd() - 0.5) * 300, z = (rnd() - 0.5) * 300, d = Math.hypot(x, z);
    if (Math.max(Math.abs(x), Math.abs(z)) < S + 4.5 || (Math.abs(x) < 4.6 && z > S) || (d > 70 && rnd() < 0.55)) continue;
    spots.push([x, hAt(x, z), z]);
  }
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), C = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
  const tufts = new THREE.InstancedMesh(tg, std({ roughness: 1, emissive: 0xaab6c4, emissiveIntensity: 0, userData: { smooth: true } }), spots.length);
  const flowers = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.1, 0), std({ roughness: 1, flatShading: true }), Math.floor(spots.length / 8));
  spots.forEach(([x, y, z], i) => {
    const k = 0.9 + rnd() * 1.3;
    tufts.setMatrixAt(i, M.compose(V.set(x, y, z), Q.setFromAxisAngle(up, rnd() * PI * 2), new THREE.Vector3(k, k * (0.8 + rnd() * 0.5), k)));
    tufts.setColorAt(i, C.set(pick([0x6b9a47, 0x7aa850, 0x5d8a40, 0x88b558])));
    if (i % 8 === 0 && i / 8 < flowers.count) {
      flowers.setMatrixAt(i / 8, M.compose(V.set(x + 0.2, y + 0.24, z + 0.1), Q, new THREE.Vector3(1, 0.55, 1)));
      flowers.setColorAt(i / 8, C.set(pick([0xf2ecd0, 0xf2ecd0, 0xe9cf5a, 0xd9a0b8, 0xb9a6e0])));
    }
  });
  tufts.userData.noInk = flowers.userData.noInk = true;   // a cartoon look draws no outline round every blade
  scene.add(tufts, flowers);
  return { ground, earth: [yard.material, road.material], tufts, flowers };
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
  return leaves;
}

// ---- The castle changes look with every age: palisade, stone, fortress, citadel ----
export const TIERS = [
  { name: 'Wooden palisade', wallH: 2.9, towerTop: 5.3 },
  { name: 'Stone walls', wallH: 3.4, towerTop: 6.6 },
  { name: 'Fortress walls', wallH: 4.0, towerTop: 7.6 },
  { name: 'Marble citadel', wallH: 4.6, towerTop: 8.6 },
];

// What the castle looks like in the nine ages of the three paths. They share one shape (taller
// than the citadel) and differ in stone, trim, glow, banners and one ornament each. A whole wall
// segment is merged into two meshes: the stonework and whatever glows.
export const LOOKS = {
  obsidian: { wallH: 4.9, towerTop: 9.0, body: 0x1c1a24, rough: 0.25, metal: 0.35, trim: 0x2c2838, accent: 0x3a3048, glow: 0xff4a10, banner: 0x8a1a10, roof: 0x2a1820, keep: 0x5a5468, orn: 'seam' },
  crystal: { wallH: 5.1, towerTop: 9.4, body: 0xcfe6f2, rough: 0.2, metal: 0.1, trim: 0xe8f6ff, accent: 0x9fd8f0, glow: 0x5fd8ff, banner: 0x3a8ab8, roof: 0x8fd0ea, keep: 0xdff2ff, orn: 'spikes' },
  star: { wallH: 5.4, towerTop: 9.8, body: 0x1a2148, rough: 0.35, metal: 0.5, trim: 0x2a3466, accent: 0xf0d060, glow: 0xfff0a0, banner: 0x1a2a7a, roof: 0x141a3a, keep: 0x5a66a8, orn: 'orbs' },
  steel: { wallH: 4.9, towerTop: 9.0, body: 0x7a828c, rough: 0.4, metal: 0.8, trim: 0x565c66, accent: 0x2b2b2e, glow: 0, banner: 0x4a5560, roof: 0x4a5058, keep: 0xc0c6d0, orn: 'rivets' },
  powder: { wallH: 5.1, towerTop: 9.4, body: 0x6a5648, rough: 0.8, metal: 0.1, trim: 0x4a4038, accent: 0x1c1c1e, glow: 0, banner: 0x7a2a1a, roof: 0x3a302a, keep: 0xb8a898, orn: 'guns', guns: true },
  steam: { wallH: 5.4, towerTop: 9.8, body: 0x5a5048, rough: 0.6, metal: 0.4, trim: 0xb8763a, accent: 0xc87533, glow: 0xff9a3a, banner: 0x8a5a2a, roof: 0x4a3a30, keep: 0xb0a090, orn: 'stacks', guns: true },
  rune: { wallH: 4.9, towerTop: 9.0, body: 0x6f7480, rough: 0.9, metal: 0, trim: 0x8a909c, accent: 0x4a5670, glow: 0x3fc0ff, banner: 0x1f4a8a, roof: 0x34405a, keep: 0xc8d0e0, orn: 'runes' },
  dragon: { wallH: 5.1, towerTop: 9.4, body: 0x5a2a22, rough: 0.8, metal: 0, trim: 0xe8dcc4, accent: 0xd8c8a8, glow: 0xff5a2a, banner: 0xa01a1a, roof: 0x7a1a14, keep: 0xc89080, orn: 'horns' },
  celestial: { wallH: 5.4, towerTop: 9.8, body: 0xf4efe2, rough: 0.4, metal: 0.1, trim: 0xfff8e0, accent: 0xf0c850, glow: 0xfff2b0, banner: 0xf0d878, roof: 0xe8d898, keep: 0xffffff, orn: 'halo' },
};
const lookMats = {};
function matsOf(key) {
  const st = LOOKS[key];
  return (lookMats[key] ??= [std({ vertexColors: true, roughness: st.rough, metalness: st.metal }), std({ color: st.glow || 0x000000, emissive: st.glow || 0x000000, emissiveIntensity: st.glow ? 1.9 : 0 })]);
}

// A wall segment of a path age. +z points out of the castle.
function styledSegment(g, s, key, idx, L, T) {
  const st = LOOKS[key], H = st.wallH, P = new Parts(), B = (geo, col, pos, rot, scale) => P.add('b', geo, col, pos, rot, scale), E = (geo, pos, rot, scale) => P.add('g', geo, 0xffffff, pos, rot, scale);
  const G = THREE, out = T / 2;
  if (s.gate) {
    B(new G.BoxGeometry(L, 1.3, T + 0.3), st.body, [0, H - 0.4, 0]);
    for (const k of [-1, 1]) B(new G.BoxGeometry(L / 2 - 0.05, H - 1.05, 0.3), st.accent, [(k * L) / 4, (H - 1.05) / 2, 0]);
    for (const k of [-1, 0, 1]) B(new G.BoxGeometry(L, 0.14, 0.38), st.trim, [0, 1.4 + k * 0.9, 0]);
    for (let i = -3; i <= 3; i++) B(new G.BoxGeometry(0.08, H - 1.1, 0.08), 0x2b2b2e, [i * 0.55, (H - 1.1) / 2, out + 0.2]);
  } else {
    B(new G.BoxGeometry(L, H, T), st.body, [0, H / 2, 0]);
    B(new G.BoxGeometry(L, 1.0, T + 0.5), st.trim, [0, 0.5, 0]);   // plinth
    for (const x of [-1, 1]) B(new G.BoxGeometry(0.12, 1.0, 0.05), 0x15151a, [x * 0.9, H * 0.58, out + 0.01]);   // arrow slits
    if (idx % 2 === 0) B(new G.PlaneGeometry(0.9, 1.9), st.banner, [0, H - 1.15, out + 0.05]);
  }
  B(new G.BoxGeometry(L, 0.24, T + 0.22), st.accent, [0, H, 0]);   // coping
  for (let i = 0; i < 3; i++) for (const k of [-1, 1]) {
    const x = -L / 2 + 0.67 + i * 1.33, z = k * (out - 0.18);
    B(new G.BoxGeometry(0.9, 0.9, 0.35), st.trim, [x, H + 0.5, z]);
    B(new G.BoxGeometry(0.96, 0.08, 0.41), st.accent, [x, H + 0.99, z]);
    if (k < 0) continue;
    if (st.orn === 'spikes') E(new G.OctahedronGeometry(0.26, 0), [x, H + 1.45, z], [0, 0, 0], [0.7, 1.6, 0.7]);
    if (st.orn === 'orbs' && i === 1) E(new G.SphereGeometry(0.17, 8, 6), [x, H + 1.45, z]);
    if (st.orn === 'horns') B(new G.ConeGeometry(0.13, 0.9, 6), st.trim, [x, H + 1.35, z + 0.15], [0.5, 0, 0]);
    if (st.orn === 'rivets') B(new G.ConeGeometry(0.1, 0.45, 5), st.accent, [x, H + 1.25, z]);
    if (st.orn === 'halo' && i === 1) E(new G.SphereGeometry(0.14, 8, 6), [x, H + 2.0, z - 0.2]);
  }
  if (st.orn === 'seam') { E(new G.BoxGeometry(L, 0.1, 0.06), [0, 1.08, out + 0.27]); E(new G.BoxGeometry(L * 0.6, 0.08, 0.06), [(idx % 2 ? 0.5 : -0.5), H * 0.62, out + 0.02], [0, 0, idx % 2 ? 0.25 : -0.25]); }
  if (st.orn === 'rivets') for (const y of [H * 0.34, H * 0.7]) B(new G.BoxGeometry(L, 0.2, T + 0.08), st.trim, [0, y, 0]);
  if (st.orn === 'guns' && !s.gate && idx % 2 === 1) { B(new G.CylinderGeometry(0.2, 0.24, 1.5, 8), st.accent, [0, H * 0.62, out + 0.5], [PI / 2, 0, 0]); B(new G.BoxGeometry(0.9, 0.7, 0.1), 0x15151a, [0, H * 0.62, out + 0.02]); }
  if (st.orn === 'stacks') { B(new G.CylinderGeometry(0.11, 0.11, L, 8), st.accent, [0, H * 0.7, out + 0.14], [0, 0, PI / 2]); if (!s.gate) { B(new G.TorusGeometry(0.2, 0.05, 6, 10), st.trim, [idx % 2 ? 0.8 : -0.8, H * 0.7, out + 0.26]); E(new G.BoxGeometry(0.3, 0.16, 0.04), [idx % 2 ? -0.9 : 0.9, H * 0.4, out + 0.02]); } }
  if (st.orn === 'runes' && !s.gate) for (const x of [-1.2, 0, 1.2]) { E(new G.BoxGeometry(0.07, 0.6, 0.04), [x, H * 0.36, out + 0.02]); E(new G.BoxGeometry(0.34, 0.07, 0.04), [x, H * 0.36 + ((idx + x) % 2 ? 0.16 : -0.1), out + 0.02], [0, 0, 0.5]); }
  const [body, glow] = matsOf(key);
  mesh(P.build('b'), body, 0, 0, 0, g);
  if (P.groups.g) mesh(P.build('g'), glow, 0, 0, 0, g).castShadow = false;
}

// A tower of a path age.
function styledTower(g, key) {
  const st = LOOKS[key], top = st.towerTop - 0.4, P = new Parts(), B = (geo, col, pos, rot, scale) => P.add('b', geo, col, pos, rot, scale), E = (geo, pos, rot, scale) => P.add('g', geo, 0xffffff, pos, rot, scale);
  const G = THREE;
  B(new G.CylinderGeometry(1.95, 2.2, top, 14), st.body, [0, top / 2, 0]);
  B(new G.CylinderGeometry(2.5, 2.65, 1.3, 14), st.trim, [0, 0.65, 0]);
  B(new G.CylinderGeometry(2.5, 2.15, 0.7, 14), st.accent, [0, top + 0.1, 0]);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * PI * 2;
    B(new G.BoxGeometry(0.8, 0.8, 0.4), st.trim, [Math.cos(a) * 2.3, top + 0.8, Math.sin(a) * 2.3], [0, -a + PI / 2, 0]);
    B(new G.BoxGeometry(0.86, 0.08, 0.46), st.accent, [Math.cos(a) * 2.3, top + 1.24, Math.sin(a) * 2.3], [0, -a + PI / 2, 0]);
  }
  B(new G.PlaneGeometry(1.1, 2.6), st.banner, [0, top - 1.7, 2.24]);
  B(new G.CylinderGeometry(0.05, 0.05, 3.4, 6), st.accent, [1.6, top + 2.0, -1.2]);
  const fg = new G.PlaneGeometry(1.3, 0.8, 4, 1); fg.translate(0.65, 0, 0);
  B(fg, st.banner, [1.6, top + 3.3, -1.2]);
  if (st.glow) E(new G.TorusGeometry(2.24, 0.07, 6, 28), [0, top - 0.5, 0], [PI / 2, 0, 0]);
  if (st.orn === 'seam') E(new G.TorusGeometry(2.62, 0.07, 6, 28), [0, 1.34, 0], [PI / 2, 0, 0]);
  if (st.orn === 'spikes') { E(new G.OctahedronGeometry(0.7, 0), [0, top + 2.6, 0], [0, 0, 0], [0.7, 2.2, 0.7]); for (const a of [0.6, 2.7, 4.8]) E(new G.OctahedronGeometry(0.35, 0), [Math.cos(a) * 1.1, top + 1.5, Math.sin(a) * 1.1], [0.3, a, 0], [0.7, 1.8, 0.7]); }
  if (st.orn === 'orbs') { E(new G.SphereGeometry(0.55, 14, 10), [0, top + 2.4, 0]); B(new G.ConeGeometry(0.6, 1.6, 8), st.accent, [0, top + 1.0, 0]); }
  if (st.orn === 'rivets') for (const y of [top * 0.3, top * 0.62]) B(new G.CylinderGeometry(2.14, 2.18, 0.26, 14), st.trim, [0, y, 0]);
  if (st.guns) { B(new G.CylinderGeometry(0.26, 0.32, 2.4, 10), 0x1c1c1e, [0, top + 1.05, 1.1], [PI / 2, 0, 0]); B(new G.BoxGeometry(1.0, 0.5, 1.4), 0x4a3320, [0, top + 0.72, 0.2]); for (const s of [-1, 1]) B(new G.CylinderGeometry(0.38, 0.38, 0.12, 10), 0x2b2b2e, [s * 0.58, top + 0.72, 0.2], [0, 0, PI / 2]); }
  if (st.orn === 'stacks') { B(new G.CylinderGeometry(0.34, 0.42, 3.2, 10), st.accent, [-1.1, top + 2.0, -0.6]); E(new G.CylinderGeometry(0.3, 0.3, 0.14, 10), [-1.1, top + 3.62, -0.6]); B(new G.TorusGeometry(0.7, 0.14, 6, 12), st.trim, [0, top - 2.2, 2.1]); }
  if (st.orn === 'runes') for (let i = 0; i < 5; i++) { const a = (i / 5) * PI * 2 + 0.3; E(new G.BoxGeometry(0.09, 0.8, 0.05), [Math.cos(a) * 2.08, top * 0.55, Math.sin(a) * 2.08], [0, -a + PI / 2, 0]); }
  if (st.orn === 'horns') for (const s of [-1, 1]) { B(new G.ConeGeometry(0.3, 2.6, 7), st.trim, [s * 1.5, top + 1.9, 1.2], [0.5, 0, -s * 0.5]); B(new G.ConeGeometry(0.2, 1.6, 7), st.trim, [s * 1.9, top + 1.4, -0.8], [-0.4, 0, -s * 0.7]); }
  if (st.orn === 'halo') { E(new G.TorusGeometry(1.5, 0.09, 8, 32), [0, top + 3.2, 0], [PI / 2, 0, 0]); B(new G.ConeGeometry(1.5, 1.8, 12), st.accent, [0, top + 1.2, 0]); }
  const [body, glow] = matsOf(key);
  mesh(P.build('b'), body, 0, 0, 0, g);
  if (P.groups.g) mesh(P.build('g'), glow, 0, 0, 0, g).castShadow = false;
}

// A small dragon that circles the castle in the ages of fire. Returns the group and its two wings.
export function makeDragon() {
  const g = new THREE.Group(), hide = std({ color: 0x9a2416, roughness: 0.7 }), belly = std({ color: 0xd8a04a, roughness: 0.8 }), skin = std({ color: 0x6a140c, roughness: 0.8, side: THREE.DoubleSide });
  mesh(new THREE.SphereGeometry(1, 12, 10).scale(0.9, 0.8, 2.2), hide, 0, 0, 0, g);
  mesh(new THREE.SphereGeometry(0.8, 10, 8).scale(0.7, 0.5, 1.9), belly, 0, -0.35, 0, g);
  mesh(new THREE.ConeGeometry(0.5, 2.6, 8).rotateX(PI / 2), hide, 0, 0.5, 2.9, g).rotation.x = -0.35;
  mesh(new THREE.ConeGeometry(0.55, 1.5, 8).rotateX(PI / 2), hide, 0, 1.15, 4.3, g);
  for (const s of [-1, 1]) mesh(new THREE.ConeGeometry(0.1, 0.6, 5), belly, s * 0.3, 1.6, 3.9, g).rotation.x = -0.6;
  mesh(new THREE.ConeGeometry(0.45, 3.6, 8).rotateX(-PI / 2), hide, 0, 0.1, -3.6, g);
  const wings = [];
  for (const s of [-1, 1]) {
    const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(4.6, 1.4), new THREE.Vector2(5.2, -0.6), new THREE.Vector2(3.4, -1.6), new THREE.Vector2(2.2, -1.0), new THREE.Vector2(1.0, -1.7)]);
    const w = new THREE.Mesh(new THREE.ShapeGeometry(shape).rotateX(-PI / 2), skin);
    w.scale.x = s; w.position.set(s * 0.6, 0.5, 0.4);
    w.castShadow = true;
    g.add(w); wings.push(w);
  }
  return { g, wings };
}

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
  if (typeof tier === 'string') { styledSegment(g, s, tier, idx, L, T); return g; }
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
  if (typeof tier === 'string') { styledTower(g, tier); return g; }
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
  // In the ages of a path something glows above the spire: an orb, and for the last age of each path a ring.
  const beaconMat = std({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.2 });
  const beacon = mesh(new THREE.SphereGeometry(0.42, 12, 10), beaconMat, 0, 15.0, 0, g), halo = mesh(new THREE.TorusGeometry(1.9, 0.09, 8, 36).rotateX(PI / 2), beaconMat, 0, 16.4, 0, g);
  beacon.castShadow = halo.castShadow = false;
  // t: 0-3 for the first four ages; st: the look of a path age (then t is 3).
  const setTier = (t, st = null) => {
    turrets.visible = t >= 1;
    spire.visible = t >= 3;
    const rc = st ? st.roof : [0x8a3a2e, 0x8a3a2e, 0x3c4d6e, 0xd8a838][t];
    roof.color.set(rc); turretRoof.color.set(rc);
    roof.metalness = turretRoof.metalness = st ? Math.max(0.2, st.metal) : t === 3 ? 0.6 : 0;
    const tint = st ? st.keep : t >= 2 ? 0xfff2dc : 0xffffff;
    stone.color.set(tint); upper.color.set(tint);
    flagMat.color.set(st ? st.banner : t >= 2 ? 0x2a4fb3 : 0xb3242a);
    beacon.visible = !!(st && st.glow);
    halo.visible = !!(st && st.glow && st.wallH >= 5.4);
    if (st && st.glow) { beaconMat.color.set(st.glow); beaconMat.emissive.set(st.glow); }
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
  const land = buildGround(scene, S), leaves = buildForest(scene, S);
  const walls = new THREE.Group();
  scene.add(walls);
  const world = { segs: [], towers: [], tier: -1, walls, leaves, ...land };
  // tier: 0-3 for the first four ages, or the key of a path age.
  world.setWallTier = (tier) => {
    if (tier === world.tier) return false;
    for (const g of [...world.segs, ...world.towers]) { walls.remove(g); disposeTree(g); }
    world.segs = layout.segs.map((s, i) => buildSegment(walls, s, tier, i));
    world.towers = layout.towers.map(([x, z]) => buildTower(walls, x, z, tier));
    world.tier = tier;
    const dims = typeof tier === 'string' ? LOOKS[tier] : TIERS[tier];
    world.wallH = dims.wallH;
    world.towerTop = dims.towerTop;
    return true;
  };
  world.setWallTier(0);
  // The courtyard is bare earth at first and gets paved as the ages pass.
  const yardMats = [null, texMat(brickTex, 7, 7, { color: 0xb8b0a0 }), texMat(ashlarTex, 6, 6, { color: 0xd8c8a8 }), texMat(marbleTex, 5, 5, { roughness: 0.6 })];
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(S * 2 - 1.2, S * 2 - 1.2).rotateX(-PI / 2), yardMats[1]);
  yard.position.y = 0.04; yard.receiveShadow = true; yard.visible = false;
  scene.add(yard);
  // age: the number of the age; key: its name (the ages of a path have a look of their own).
  world.setAge = (age, key = null) => {
    const st = key && LOOKS[key] ? LOOKS[key] : null, tier = Math.min(age, 3);
    const changed = world.setWallTier(st ? key : tier);
    hall.setTier(tier, st);
    yard.visible = age > 0;
    if (age > 0) yard.material = yardMats[tier];
    yardMats[3].color.set(st ? st.trim : 0xffffff);
    world.look = st;
    return changed;
  };
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
  tinker: 0xb5762a, musketeer: 0x24407a, sapper: 0x6a5a3a,
  lavamancer: 0x7a2a12, glaive: 0x2a2638, prismancer: 0xbfe6f5, shardbow: 0x3f8fb8, stargazer: 0x1f2a5a, starforger: 0x4a4f6a,
  repeater: 0x5a6470, ironclad: 0x6f7884, rocketeer: 0x8a3a2a, artillerist: 0x2a3a5a, galvanist: 0x2f6a78, wallwright: 0xc8a070,
  runeblade: 0x3a5a8a, runesmith: 0x5a6a7a, drakekeeper: 0x7a3a1e, lancer: 0x8a1e2a, seraph: 0xf6f0dc, skycaller: 0x8fc4ee,
};
const ROBES = new Set(['mage', 'frost', 'cleric', 'pyro', 'storm', 'priest', 'hexer', 'lavamancer', 'prismancer', 'stargazer', 'galvanist', 'seraph', 'skycaller', 'wallwright']);
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
  } else if (k === 'tinker') {
    a(new G.CylinderGeometry(0.23, 0.25, 0.14, 10), LEATHER, [0, 1.97, 0]);   // cap
    for (const s2 of [-1, 1]) a(new G.TorusGeometry(0.07, 0.025, 5, 10), 0xc87533, [s2 * 0.08, 1.97, 0.2]);   // goggles pushed up
    a(new G.BoxGeometry(0.52, 0.62, 0.04), LEATHER, [0, 1.2, 0.27]);   // apron
    a(new G.CylinderGeometry(0.08, 0.07, 0.6, 6), tunic, [-0.43, 1.2, 0]);
    a(new G.BoxGeometry(0.07, 0.7, 0.07), STEEL, [0.52, 1.45, 0.3]);   // wrench
    a(new G.TorusGeometry(0.12, 0.04, 5, 10, PI * 1.5), STEEL, [0.52, 1.88, 0.3], [0, 0, PI * 0.75]);
    a(new G.TorusGeometry(0.16, 0.05, 5, 8), 0xc87533, [-0.3, 0.98, 0.3]);   // a spare cog on the belt
  } else if (k === 'musketeer') {
    a(new G.CylinderGeometry(0.42, 0.42, 0.04, 14), 0x1c1c22, [0, 1.95, 0]);   // wide hat
    a(new G.CylinderGeometry(0.2, 0.23, 0.2, 10), 0x1c1c22, [0, 2.06, 0]);
    a(new G.ConeGeometry(0.05, 0.7, 5), 0xf2f2f2, [0.2, 2.3, -0.12], [-0.7, 0, -0.5]);   // plume
    a(new G.BoxGeometry(0.1, 0.72, 0.04), 0xf2ead2, [0, 1.22, 0.3], [0, 0, 0.6]);   // sash
    a(new G.CylinderGeometry(0.08, 0.07, 0.6, 6), tunic, [-0.43, 1.45, 0.3], [-1.45, 0, 0]);
    a(new G.BoxGeometry(0.1, 0.14, 0.7), WOOD, [0.1, 1.42, 0.35]);   // stock
    a(new G.CylinderGeometry(0.035, 0.035, 1.3, 6), 0x2b2b2e, [0.1, 1.47, 1.2], [PI / 2, 0, 0]);   // barrel
  } else if (k === 'sapper') {
    a(new G.SphereGeometry(0.25, 10, 6, 0, PI * 2, 0, PI * 0.55), 0x8a7a4a, [0, 1.84, 0]);   // helmet
    a(new G.CylinderGeometry(0.3, 0.3, 0.03, 12), 0x8a7a4a, [0, 1.86, 0]);
    a(new G.CylinderGeometry(0.08, 0.07, 0.6, 6), tunic, [-0.43, 1.2, 0]);
    a(new G.CylinderGeometry(0.035, 0.035, 1.5, 6), WOOD, [0.52, 1.1, 0.3]);   // shovel
    a(new G.BoxGeometry(0.26, 0.34, 0.04), STEEL, [0.52, 1.98, 0.3]);
    a(new G.CylinderGeometry(0.2, 0.2, 0.36, 10), 0x5a3d24, [-0.1, 1.25, -0.36], [0, 0, 0]);   // powder keg on the back
    a(new G.CylinderGeometry(0.21, 0.21, 0.05, 10), 0x2b2b2e, [-0.1, 1.33, -0.36]);
  } else if (k === 'lavamancer') {
    a(new G.SphereGeometry(0.24, 10, 8, 0, PI * 2, 0, PI * 0.62), 0x2a1410, [0, 1.84, -0.03]);   // soot-black hood
    a(new G.CylinderGeometry(0.08, 0.07, 0.6, 6), tunic, [-0.43, 1.2, 0]);
    a(new G.CylinderGeometry(0.04, 0.04, 1.9, 6), 0x1a1a1a, [0.52, 1.0, 0.3]);
    a(new G.DodecahedronGeometry(0.21, 0), 0xff5a10, [0.52, 2.12, 0.3]);   // a lump of molten rock
    a(new G.DodecahedronGeometry(0.1, 0), 0xffc040, [0.64, 2.3, 0.34]);
  } else if (k === 'glaive') {
    a(new G.SphereGeometry(0.24, 10, 6, 0, PI * 2, 0, PI * 0.6), 0x1c1a22, [0, 1.84, 0]);
    a(new G.BoxGeometry(0.05, 0.3, 0.42), 0x8a3ad0, [0, 2.1, -0.02]);   // crest
    a(new G.CylinderGeometry(0.08, 0.07, 0.6, 6), tunic, [-0.43, 1.2, 0]);
    a(new G.CylinderGeometry(0.035, 0.035, 3.1, 6), 0x1a1a1a, [0.5, 1.5, 0.25], [0.35, 0, 0]);
    a(new G.BoxGeometry(0.04, 0.95, 0.3), 0x4a3470, [0.5, 3.2, 0.87], [0.35, 0, 0]);   // obsidian blade
    for (const s2 of [-1, 1]) a(new G.SphereGeometry(0.2, 8, 6, 0, PI * 2, 0, PI / 2), 0x1c1a22, [s2 * 0.4, 1.5, 0]);   // pauldrons
  } else if (k === 'prismancer') {
    a(new G.CylinderGeometry(0.36, 0.36, 0.03, 12), 0xffffff, [0, 1.93, 0]);
    a(new G.ConeGeometry(0.22, 0.8, 6), 0xffffff, [0, 2.32, 0]);
    a(new G.CylinderGeometry(0.08, 0.07, 0.6, 6), tunic, [-0.43, 1.45, 0.25], [-1.2, 0, 0]);
    a(new G.CylinderGeometry(0.035, 0.035, 2.1, 6), 0xe8f0f8, [0.52, 1.05, 0.3]);
    a(new G.OctahedronGeometry(0.24, 0), 0x9ff0ff, [0.52, 2.3, 0.3], [0, 0.4, 0], [0.8, 1.5, 0.8]);   // prism
    a(new G.OctahedronGeometry(0.1, 0), 0xff9ae0, [0.36, 2.2, 0.36]);
  } else if (k === 'shardbow') {
    a(new G.SphereGeometry(0.25, 10, 8, 0, PI * 2, 0, PI * 0.6), tunic, [0, 1.84, -0.03]);
    a(new G.CylinderGeometry(0.08, 0.07, 0.6, 6), tunic, [-0.43, 1.45, 0.3], [-1.45, 0, 0]);
    a(new G.TorusGeometry(0.66, 0.035, 5, 16, PI), 0xdff6ff, [-0.43, 1.45, 0.7], [0, -PI / 2, -PI / 2]);   // crystal bow
    for (const y of [0.78, 2.12]) a(new G.OctahedronGeometry(0.1, 0), 0x7fe8ff, [-0.43, y, 0.7], [0, 0, 0], [0.7, 1.6, 0.7]);
    a(new G.CylinderGeometry(0.1, 0.1, 0.6, 8), 0x2a5a78, [0.12, 1.4, -0.3], [0.3, 0, 0]);
  } else if (k === 'stargazer') {
    a(new G.CylinderGeometry(0.4, 0.4, 0.03, 12), tunic, [0, 1.93, 0]);
    a(new G.ConeGeometry(0.24, 0.85, 10), tunic, [0, 2.34, 0]);
    a(new G.OctahedronGeometry(0.09, 0), GOLD, [0, 2.3, 0.2]);   // a star on the hat
    a(new G.CylinderGeometry(0.08, 0.07, 0.6, 6), tunic, [-0.43, 1.2, 0]);
    a(new G.CylinderGeometry(0.07, 0.1, 0.9, 8), 0xb08a3a, [0.5, 1.75, 0.45], [1.1, 0, 0]);   // spyglass
    a(new G.SphereGeometry(0.17, 8, 6, 0, PI * 2, PI * 0.4, PI * 0.6), 0xe8e8e8, [0, 1.74, 0.06]);   // beard
  } else if (k === 'starforger') {
    a(new G.CylinderGeometry(0.23, 0.25, 0.14, 10), LEATHER, [0, 1.97, 0]);
    a(new G.BoxGeometry(0.52, 0.62, 0.04), LEATHER, [0, 1.2, 0.27]);   // apron
    a(new G.CylinderGeometry(0.08, 0.07, 0.6, 6), tunic, [-0.43, 1.2, 0]);
    a(new G.CylinderGeometry(0.04, 0.04, 1.3, 6), WOOD, [0.52, 1.3, 0.3]);
    a(new G.BoxGeometry(0.46, 0.3, 0.3), 0xfff0a0, [0.52, 2.0, 0.3]);   // a hammer of star-metal
    a(new G.OctahedronGeometry(0.14, 0), 0xffd860, [-0.36, 1.0, 0.34]);
  } else if (k === 'repeater') {
    a(new G.SphereGeometry(0.25, 10, 6, 0, PI * 2, 0, PI * 0.55), STEEL, [0, 1.84, 0]);
    a(new G.CylinderGeometry(0.33, 0.33, 0.03, 12), STEEL, [0, 1.86, 0]);   // kettle hat
    a(new G.CylinderGeometry(0.08, 0.07, 0.6, 6), tunic, [-0.43, 1.45, 0.3], [-1.45, 0, 0]);
    a(new G.BoxGeometry(0.12, 0.1, 1.1), WOOD, [0, 1.42, 0.62]);
    a(new G.BoxGeometry(0.9, 0.07, 0.1), STEEL, [0, 1.45, 1.05]);
    a(new G.BoxGeometry(0.2, 0.34, 0.5), 0x4a3320, [0, 1.66, 0.62]);   // magazine
  } else if (k === 'ironclad') {
    a(new G.CylinderGeometry(0.24, 0.24, 0.36, 10), STEEL, [0, 1.82, 0]);   // great helm
    a(new G.BoxGeometry(0.3, 0.04, 0.06), 0x15151a, [0, 1.85, 0.23]);
    a(new G.CylinderGeometry(0.08, 0.07, 0.6, 6), STEEL, [-0.43, 1.2, 0]);
    a(new G.CylinderGeometry(0.5, 0.5, 0.08, 14), STEEL, [-0.45, 1.15, 0.32], [PI / 2, 0, 0]);   // round shield
    a(new G.SphereGeometry(0.12, 8, 6), 0xc87533, [-0.45, 1.15, 0.4]);
    a(new G.CylinderGeometry(0.04, 0.04, 1.0, 6), WOOD, [0.52, 1.45, 0.3]);
    a(new G.DodecahedronGeometry(0.2, 0), STEEL, [0.52, 2.05, 0.3]);   // mace
    for (const s2 of [-1, 1]) a(new G.SphereGeometry(0.2, 8, 6, 0, PI * 2, 0, PI / 2), STEEL, [s2 * 0.4, 1.5, 0]);
  } else if (k === 'rocketeer') {
    a(new G.CylinderGeometry(0.24, 0.26, 0.14, 10), 0x3a3a3a, [0, 1.97, 0]);
    for (const s2 of [-1, 1]) a(new G.TorusGeometry(0.07, 0.025, 5, 10), 0xb08a3a, [s2 * 0.08, 1.84, 0.17]);
    a(new G.CylinderGeometry(0.08, 0.07, 0.6, 6), tunic, [-0.43, 1.45, 0.3], [-1.45, 0, 0]);
    a(new G.CylinderGeometry(0.15, 0.15, 1.5, 10), 0x4a4f55, [0.42, 1.78, 0.25], [PI / 2 - 0.25, 0, 0]);   // launch tube on the shoulder
    a(new G.ConeGeometry(0.13, 0.36, 8), 0xd82a1a, [0.42, 2.0, 1.05], [PI / 2 - 0.25, 0, 0]);
  } else if (k === 'artillerist') {
    a(new G.CylinderGeometry(0.4, 0.4, 0.04, 3), 0x1c1c22, [0, 1.95, 0]);   // tricorn
    a(new G.CylinderGeometry(0.2, 0.23, 0.16, 10), 0x1c1c22, [0, 2.04, 0]);
    a(new G.CylinderGeometry(0.08, 0.07, 0.6, 6), tunic, [-0.43, 1.2, 0]);
    a(new G.CylinderGeometry(0.2, 0.26, 1.5, 10), 0x2b2b2e, [0, 0.75, 0.95], [PI / 2 - 0.2, 0, 0]);   // a small gun at their feet
    for (const s2 of [-1, 1]) a(new G.CylinderGeometry(0.3, 0.3, 0.08, 10), WOOD, [s2 * 0.34, 0.5, 0.7], [0, 0, PI / 2]);
    a(new G.CylinderGeometry(0.03, 0.03, 1.8, 6), WOOD, [0.52, 1.2, 0.3]);   // ramrod
  } else if (k === 'galvanist') {
    a(new G.CylinderGeometry(0.23, 0.25, 0.14, 10), LEATHER, [0, 1.97, 0]);
    for (const s2 of [-1, 1]) a(new G.TorusGeometry(0.07, 0.025, 5, 10), 0xc87533, [s2 * 0.08, 1.84, 0.17]);
    a(new G.CylinderGeometry(0.08, 0.07, 0.6, 6), tunic, [-0.43, 1.2, 0]);
    a(new G.CylinderGeometry(0.035, 0.035, 2.0, 6), 0xc87533, [0.52, 1.0, 0.3]);
    for (let i = 0; i < 3; i++) a(new G.TorusGeometry(0.13 - i * 0.02, 0.025, 5, 10), 0xc87533, [0.52, 1.75 + i * 0.13, 0.3], [PI / 2, 0, 0]);   // coil
    a(new G.SphereGeometry(0.13, 10, 8), 0xbff4ff, [0.52, 2.2, 0.3]);
  } else if (k === 'wallwright') {
    a(new G.SphereGeometry(0.24, 10, 8, 0, PI * 2, 0, PI * 0.62), tunic, [0, 1.84, -0.03]);
    a(new G.CylinderGeometry(0.08, 0.07, 0.6, 6), tunic, [-0.43, 1.2, 0]);
    a(new G.BoxGeometry(0.34, 0.2, 0.2), 0xa85a3a, [-0.43, 0.95, 0.2]);   // a brick in hand
    a(new G.CylinderGeometry(0.04, 0.04, 0.9, 6), WOOD, [0.52, 1.2, 0.3]);
    a(new G.BoxGeometry(0.3, 0.05, 0.4), STEEL, [0.52, 1.68, 0.4]);   // trowel
    a(new G.BoxGeometry(0.5, 0.12, 0.05), 0xc87533, [0, 1.3, 0.3]);
  } else if (k === 'runeblade') {
    a(new G.SphereGeometry(0.24, 10, 6, 0, PI * 2, 0, PI * 0.6), STEEL, [0, 1.84, 0]);
    a(new G.BoxGeometry(0.06, 0.2, 0.34), STEEL, [0, 1.8, 0.12]);
    a(new G.CylinderGeometry(0.08, 0.07, 0.6, 6), tunic, [-0.43, 1.2, 0]);
    a(new G.BoxGeometry(0.1, 1.5, 0.04), 0x7fe0ff, [0.52, 1.95, 0.3]);   // a sword that glows with runes
    a(new G.BoxGeometry(0.4, 0.08, 0.08), GOLD, [0.52, 1.2, 0.3]);
    a(new G.BoxGeometry(0.6, 0.8, 0.08), 0x2a3a5a, [-0.45, 1.15, 0.3]);
    a(new G.BoxGeometry(0.08, 0.5, 0.04), 0x7fe0ff, [-0.45, 1.15, 0.36]);
  } else if (k === 'runesmith') {
    a(new G.CylinderGeometry(0.23, 0.25, 0.14, 10), 0x34405a, [0, 1.97, 0]);
    a(new G.BoxGeometry(0.52, 0.62, 0.04), LEATHER, [0, 1.2, 0.27]);
    a(new G.CylinderGeometry(0.08, 0.07, 0.6, 6), tunic, [-0.43, 1.2, 0]);
    a(new G.BoxGeometry(0.5, 0.66, 0.1), 0x8a909c, [-0.42, 1.2, 0.36]);   // a stone tablet
    for (const y of [1.05, 1.3]) a(new G.BoxGeometry(0.3, 0.06, 0.04), 0x5fd8ff, [-0.42, y, 0.43]);
    a(new G.CylinderGeometry(0.035, 0.035, 0.7, 6), WOOD, [0.52, 1.4, 0.3]);
    a(new G.BoxGeometry(0.26, 0.16, 0.16), STEEL, [0.52, 1.8, 0.3]);   // chisel hammer
  } else if (k === 'drakekeeper') {
    a(new G.SphereGeometry(0.25, 10, 8, 0, PI * 2, 0, PI * 0.6), LEATHER, [0, 1.84, -0.03]);
    a(new G.CylinderGeometry(0.08, 0.07, 0.6, 6), tunic, [-0.43, 1.45, 0.3], [-1.45, 0, 0]);
    a(new G.SphereGeometry(0.2, 8, 6), 0xc0301a, [-0.43, 1.75, 0.62], [0, 0, 0], [0.8, 0.7, 1.5]);   // a young drake on the arm
    a(new G.ConeGeometry(0.11, 0.34, 6), 0xc0301a, [-0.43, 1.86, 0.98], [PI / 2, 0, 0]);
    for (const s2 of [-1, 1]) a(new G.ConeGeometry(0.22, 0.5, 3), 0x7a1810, [-0.43 + s2 * 0.24, 1.92, 0.56], [0, 0, -s2 * 1.1], [1, 1, 0.2]);
    a(new G.ConeGeometry(0.06, 0.5, 5), 0xc0301a, [-0.43, 1.7, 0.24], [-PI / 2, 0, 0]);
  } else if (k === 'lancer') {
    a(new G.SphereGeometry(0.24, 10, 6, 0, PI * 2, 0, PI * 0.6), STEEL, [0, 1.84, 0]);
    a(new G.ConeGeometry(0.05, 0.7, 5), 0xd82a1a, [0, 2.3, -0.14], [-0.5, 0, 0]);   // plume
    a(new G.CylinderGeometry(0.08, 0.07, 0.6, 6), tunic, [-0.43, 1.2, 0]);
    a(new G.CylinderGeometry(0.06, 0.05, 3.4, 6), 0xe8dcc4, [0.5, 1.9, 0.5], [1.15, 0, 0]);   // a heavy lance of bone
    a(new G.ConeGeometry(0.13, 0.6, 6), STEEL, [0.5, 2.72, 2.32], [1.15, 0, 0]);
    a(new G.ConeGeometry(0.2, 0.4, 8), 0xe8dcc4, [0.5, 1.72, 0.1], [1.15 + PI, 0, 0]);
  } else if (k === 'seraph') {
    a(new G.TorusGeometry(0.28, 0.035, 6, 20), GOLD, [0, 2.24, -0.05], [PI / 2, 0, 0]);   // halo
    a(new G.CylinderGeometry(0.08, 0.07, 0.6, 6), tunic, [-0.43, 1.2, 0]);
    for (const s2 of [-1, 1]) a(new G.ConeGeometry(0.34, 1.3, 4), 0xffffff, [s2 * 0.42, 1.55, -0.3], [0.25, 0, -s2 * 0.75], [1, 1, 0.25]);   // wings
    a(new G.CylinderGeometry(0.035, 0.035, 2.3, 6), GOLD, [0.52, 1.15, 0.3]);
    a(new G.OctahedronGeometry(0.16, 0), 0xfff6c0, [0.52, 2.42, 0.3]);
    a(new G.BoxGeometry(0.1, 0.62, 0.04), GOLD, [0, 1.15, 0.29]);
  } else if (k === 'skycaller') {
    a(new G.CylinderGeometry(0.44, 0.44, 0.03, 14), tunic, [0, 1.93, 0]);
    a(new G.ConeGeometry(0.22, 0.6, 10), tunic, [0, 2.22, 0]);
    a(new G.CylinderGeometry(0.08, 0.07, 0.6, 6), tunic, [-0.43, 1.45, 0.25], [-1.2, 0, 0]);
    a(new G.CylinderGeometry(0.035, 0.035, 2.2, 6), GOLD, [0.52, 1.1, 0.3]);
    a(new G.TorusGeometry(0.2, 0.03, 6, 16), GOLD, [0.52, 2.38, 0.3]);   // a ring that catches the sun
    a(new G.SphereGeometry(0.1, 8, 6), 0xfff6c0, [0.52, 2.38, 0.3]);
  } else {
    a(new G.CylinderGeometry(0.24, 0.26, 0.12, 10), LEATHER, [0, 1.98, 0]);
    a(new G.CylinderGeometry(0.08, 0.07, 0.6, 6), tunic, [-0.43, 1.45, 0.3], [-1.45, 0, 0]);
    a(new G.BoxGeometry(0.12, 0.1, 1.1), WOOD, [0, 1.42, 0.62]);
    a(new G.BoxGeometry(1.0, 0.07, 0.1), STEEL, [0, 1.45, 1.05]);
  }
  return P.build('u');
}
export const RARITY_COLORS = [0xb8c0cc, 0x4ea8ff, 0xb46bff, 0xffc340, 0xff5a7a, 0xfff2c0];
const ringGeo = new THREE.TorusGeometry(0.55, 0.06, 6, 24).rotateX(PI / 2);
const ringMats = RARITY_COLORS.map((c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85 }));
export function makeUnit(k, rar = 0) {
  const g = new THREE.Group();
  const m = new THREE.Mesh((unitCache[k] ??= unitGeo(k)), unitMat);
  m.castShadow = true;
  g.add(m);
  if (rar > 0) { const r = new THREE.Mesh(ringGeo, ringMats[Math.min(rar, ringMats.length - 1)]); r.position.y = 0.08; g.add(r); }
  g.scale.setScalar(1.15 + (rar >= 4 ? 0.1 : 0));
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
  { hide: 0x3a4a22, glow: 0xb6ff2a, scale: 0.75, pustule: true },                   // blightling
  { hide: 0x3a2f4a, glow: 0x5affc0, scale: 1.0, mask: true },                       // shaman
  { hide: 0x5a4a3a, glow: 0xffb03a, scale: 1.75, plates: true, horns: true },       // ramhorn
  { hide: 0x5a4632, glow: 0xffa04a, scale: 1.05, claws: true },                     // burrower
  { hide: 0xa8c0dc, glow: 0x9fe8ff, scale: 0.95, ghost: true },                     // wraith
  { hide: 0x4a4038, glow: 0xff7a3a, scale: 2.1, plates: true, boulder: true },      // hurler
];
export const GLOW = BEASTS.map((b) => b.glow);
export const BEAST_SCALE = BEASTS.map((b) => b.scale);
const hideMat = std({ vertexColors: true, roughness: 0.75, flatShading: true });
const wingMat = std({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide, flatShading: true });
const ghostMat = std({ vertexColors: true, roughness: 0.4, flatShading: true, transparent: true, opacity: 0.55, emissive: 0x4a6a9a, emissiveIntensity: 0.5, depthWrite: false });
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
  if (!B.shell && !B.sac && !B.pustule && !B.boulder) for (let i = 0; i < 6; i++) { const k = 1 - i * 0.12; gl(new G.ConeGeometry(0.07 * k, 0.42 * k, 5), [0, 1.32 - i * 0.05, 0.55 - i * 0.28], [-0.35, 0, 0]); }
  b(new G.ConeGeometry(0.2, 1.5, 6), [0, 0.8, -1.5], [-PI / 2, 0, 0]);
  const legless = B.wings || B.ghost;
  if (!legless) {
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
  if (B.pustule) {
    // A swollen, glowing sac that is about to burst.
    gl(new G.SphereGeometry(0.62, 12, 9), [0, 1.3, -0.2], undefined, [1, 0.95, 1.15]);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2; b(new G.ConeGeometry(0.06, 0.3, 5), [Math.cos(a) * 0.5, 1.3, -0.2 + Math.sin(a) * 0.55], [Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2], undefined, null, BONE); }
  }
  if (B.mask) {
    // A bone mask, feathers and a staff with a glowing charm.
    b(new G.CylinderGeometry(0.34, 0.26, 0.5, 6), [0, 0.1, 0.42], [PI / 2 - 0.2, 0, 0], [1, 0.3, 1], H, BONE);
    for (let i = -2; i <= 2; i++) b(new G.ConeGeometry(0.06, 0.8, 4), [i * 0.14, 0.62, -0.1], [-0.4, 0, -i * 0.22], undefined, H, [0xd84a3a, 0xf0c040, 0x3ac8d8][Math.abs(i)]);
    b(new G.CylinderGeometry(0.04, 0.05, 2.4, 6), [0.62, 1.2, 0.5], [0.15, 0, 0.08], undefined, null, 0x3a2a1a);
    gl(new G.OctahedronGeometry(0.2, 0), [0.66, 2.5, 0.68]);
    for (let i = 0; i < 3; i++) b(new G.SphereGeometry(0.07, 6, 5), [0.6 + (i - 1) * 0.12, 2.15 - i * 0.05, 0.62], undefined, undefined, null, BONE);
  }
  if (B.horns) {
    // Curled ram horns and a thick bone brow.
    for (const s of [-1, 1]) b(new G.TorusGeometry(0.34, 0.11, 6, 12, PI * 1.5), [s * 0.36, 0.12, 0.05], [0, s * PI / 2, PI * 0.9], undefined, H, BONE);
    b(new G.BoxGeometry(0.62, 0.3, 0.3), [0, 0.2, 0.42], [0.3, 0, 0], undefined, H, BONE);
    for (const s of [-1, 1]) gl(new G.SphereGeometry(0.07, 6, 5), [s * 0.5, 1.2, -0.3]);
  }
  if (B.claws) {
    // Shovel claws and a low, flat back for digging.
    for (const s of [-1, 1]) for (let c = -1; c < 2; c++) b(new G.ConeGeometry(0.06, 0.55, 5), [s * 0.5 + c * 0.1, 0.42, 1.0], [PI / 2 + 0.3, 0, 0], undefined, null, BONE);
    for (const s of [-1, 1]) b(new G.SphereGeometry(0.24, 8, 6), [s * 0.5, 0.6, 0.75], undefined, [1, 0.7, 1.3]);
    for (let i = 0; i < 4; i++) gl(new G.SphereGeometry(0.06, 6, 5), [0, 1.3 - i * 0.03, 0.3 - i * 0.35]);
  }
  if (B.ghost) {
    // No legs: a tattered shroud that trails behind.
    b(new G.ConeGeometry(0.62, 1.5, 8, 1, true), [0, 0.5, -0.1], [PI, 0, 0], [1, 1, 1.3]);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * PI * 2; b(new G.ConeGeometry(0.12, 0.7, 4), [Math.cos(a) * 0.4, -0.25, -0.1 + Math.sin(a) * 0.5], [PI, 0, 0]); }
    for (const s of [-1, 1]) b(new G.ConeGeometry(0.07, 0.8, 5), [s * 0.55, 0.95, 0.75], [PI / 2, 0, 0], undefined, null, BONE);   // reaching arms
  }
  if (B.boulder) {
    // A boulder strapped to its back, and one arm built for throwing.
    b(new G.DodecahedronGeometry(0.72, 0), [0, 1.75, -0.35], [0.4, 0.7, 0.2], undefined, null, 0x8a8880);
    for (const s of [-1, 1]) b(new G.TorusGeometry(0.72, 0.04, 4, 12), [0, 1.75, -0.35], [0, s * 0.8, 0], undefined, null, 0x3a2a1a);
    b(new G.SphereGeometry(0.34, 8, 6), [0.62, 1.2, 0.5], undefined, [1, 1.1, 1.2]);
    b(new G.CylinderGeometry(0.16, 0.2, 0.9, 6), [0.7, 0.75, 0.75], [0.5, 0, -0.15]);
    for (let i = 0; i < 4; i++) gl(new G.SphereGeometry(0.07, 6, 5), [(i % 2 ? 1 : -1) * 0.5, 1.2, 0.3 - i * 0.2]);
  }
  const out = { body: P.build('body'), glow: P.build('glow') };
  if (!legless) out.leg = P.build('leg');
  else if (B.wings) {
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
  mesh(geo.body, BEASTS[t].ghost ? ghostMat : hideMat, 0, 0, 0, g);
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
    pr = { renderer, scene, camera: new THREE.PerspectiveCamera(30, 1, 0.1, 100), key };
  }
  const obj = kind === 'unit' ? makeUnit(key, rar) : kind === 'building' ? makeBuilding(key) : makeBeast(key).g;
  obj.scale.setScalar(1);
  obj.rotation.y = kind === 'unit' ? 0.5 : 0.75;
  for (const w of obj.children) if (w.geometry === beastCache[key]?.wing) w.rotation.z = (w.scale.x > 0 ? 1 : -1) * 0.35;
  pr.scene.add(obj);
  const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const d = Math.max(size.x, size.y, size.z) * (kind === 'unit' ? 1.9 : kind === 'building' ? 1.7 : 1.45);
  pr.camera.position.set(c.x + d * 0.25, c.y + d * 0.28, c.z + d);
  pr.camera.lookAt(c);
  const sunWas = SUN.value;
  SUN.value = sunLevel(pr.key);   // in a cartoon look, full light is the portrait's own lamp
  pr.renderer.render(pr.scene, pr.camera);
  SUN.value = sunWas;
  const url = pr.renderer.domElement.toDataURL();
  pr.scene.remove(obj);
  portraits.set(id, url);
  return url;
}

// ---- The horde, drawn with instancing: one draw call per monster type and part, however many there are ----
const _m = new THREE.Matrix4(), _l = new THREE.Matrix4(), _o = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _qy = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);
const _ident = new THREE.Quaternion();
export class Horde {
  constructor(scene, cap = 260) {
    this.cap = cap;
    const mk = (geo, mat, n, shadow) => {
      const m = new THREE.InstancedMesh(geo, mat, n);
      m.count = 0; m.frustumCulled = false; m.castShadow = shadow; m.receiveShadow = false;
      scene.add(m);
      return m;
    };
    this.types = BEASTS.map((B, t) => {
      const geo = (beastCache[t] ??= beastGeo(t)), hide = B.ghost ? ghostMat : hideMat;
      return {
        body: mk(geo.body, hide, cap, !B.ghost), glow: mk(geo.glow, glowMats[t], cap, false),
        legs: geo.leg ? mk(geo.leg, hide, cap * 4, true) : null, wings: geo.wing ? mk(geo.wing, wingMat, cap * 2, true) : null,
      };
    });
    const basic = (color, opacity = 0.85) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    this.bars = mk(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xe5484d, depthTest: false, transparent: true }), cap, false);
    this.bars.renderOrder = 5;
    const ring = new THREE.TorusGeometry(0.8, 0.08, 6, 20).rotateX(PI / 2);
    // slowed, burning, cursed, hastened, stunned, fated, shelled
    this.rings = [0xaee8ff, 0xff8a3a, 0xc06bff, 0xff3a5a, 0xffe45a, 0xfff2c0, 0x9aa4b0].map((c) => mk(ring, basic(c), cap, false));
    this.crowns = mk(new THREE.TorusGeometry(0.55, 0.09, 6, 8).rotateX(PI / 2), new THREE.MeshStandardMaterial({ color: 0xffd23a, emissive: 0xffa000, emissiveIntensity: 1.4, metalness: 0.6, roughness: 0.3 }), 32, false);
    this.mounds = mk(new THREE.ConeGeometry(1, 0.55, 9), std({ color: 0x6a4e30, roughness: 1, flatShading: true }), cap, true);
    this.all = [...this.types.flatMap((t) => [t.body, t.glow, t.legs, t.wings].filter(Boolean)), this.bars, ...this.rings, this.crowns, this.mounds];
  }

  begin() { for (const m of this.all) m.count = 0; }

  // One monster: position, heading, size, leg swing and wing flap.
  add(t, x, y, z, rot, scale, swing, flap) {
    const T = this.types[t], i = T.body.count;
    if (i >= this.cap) return;
    _m.compose(_p.set(x, y, z), _qy.setFromAxisAngle(_up, rot), _s.set(scale, scale, scale));
    T.body.setMatrixAt(i, _m); T.glow.setMatrixAt(i, _m);
    T.body.count = T.glow.count = i + 1;
    if (T.legs) {
      for (let k = 0; k < 4; k++) {
        _l.makeRotationX((k === 0 || k === 3 ? 1 : -1) * swing).setPosition(LEGS[k][0] * 0.34, 0.78, LEGS[k][1]);
        T.legs.setMatrixAt(i * 4 + k, _o.multiplyMatrices(_m, _l));
      }
      T.legs.count = (i + 1) * 4;
    }
    if (T.wings) {
      for (let k = 0; k < 2; k++) {
        const s = k ? -1 : 1;
        _l.makeRotationZ(s * flap).setPosition(s * 0.3, 1.15, 0.2);
        _o.multiplyMatrices(_m, _l).scale(_s.set(s, 1, 1));
        T.wings.setMatrixAt(i * 2 + k, _o);
      }
      T.wings.count = (i + 1) * 2;
    }
  }

  // A health bar that always faces the camera.
  bar(x, y, z, w, quat) {
    const i = this.bars.count;
    if (i >= this.cap) return;
    this.bars.setMatrixAt(i, _m.compose(_p.set(x, y, z), quat, _s.set(w, 0.14, 1)));
    this.bars.count = i + 1;
  }

  ring(kind, x, y, z, s) {
    const m = this.rings[kind], i = m.count;
    if (i >= this.cap) return;
    m.setMatrixAt(i, _m.compose(_p.set(x, y, z), _ident, _s.set(s, s, s)));
    m.count = i + 1;
  }

  crown(x, y, z, s, spin) {
    const i = this.crowns.count;
    if (i >= 32) return;
    this.crowns.setMatrixAt(i, _m.compose(_p.set(x, y, z), _qy.setFromAxisAngle(_up, spin), _s.set(s, s, s)));
    this.crowns.count = i + 1;
  }

  mound(x, z, s) {
    const i = this.mounds.count;
    if (i >= this.cap) return;
    this.mounds.setMatrixAt(i, _m.compose(_p.set(x, 0.2, z), _ident, _s.set(s, 1, s)));
    this.mounds.count = i + 1;
  }

  end() { for (const m of this.all) if (m.count) m.instanceMatrix.needsUpdate = true; }
  setShadows(on) { for (const T of this.types) { T.body.castShadow = on && T.body.material !== ghostMat; if (T.legs) T.legs.castShadow = on; if (T.wings) T.wings.castShadow = on; } this.mounds.castShadow = on; }
}

// ---- Mines buried by sappers ----
export const mineGeo = mergeGeometries([new THREE.CylinderGeometry(0.42, 0.5, 0.16, 10).toNonIndexed(), new THREE.CylinderGeometry(0.1, 0.1, 0.16, 6).translate(0, 0.14, 0).toNonIndexed()]);
export const mineMat = std({ color: 0x2a2a2e, roughness: 0.5, metalness: 0.6, emissive: 0xff2a1a, emissiveIntensity: 0.5 });

// ---- Courtyard buildings: each stands on a plot about four metres wide ----
const plaster = std({ color: 0xe8dcc0, roughness: 0.95 });
const timber = std({ color: 0x4a3320, roughness: 0.9 });
const clothRed = std({ color: 0xb3242a, roughness: 0.8, side: THREE.DoubleSide });
const clothBlue = std({ color: 0x2a4fb3, roughness: 0.8, side: THREE.DoubleSide });
const clothGold = std({ color: 0xd8a838, roughness: 0.8, side: THREE.DoubleSide });
const stoneGrey = texMat(brickTex, 1.5, 1);
const hayMat = std({ color: 0xc8a850, roughness: 1 });
const glassBlue = std({ color: 0x9fd0ff, emissive: 0x5aa8ff, emissiveIntensity: 1.2 });
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (a, b, h, n = 10) => new THREE.CylinderGeometry(a, b, h, n);
// A pitched roof: a box turned into a prism.
function gable(w, h, d, mat, x, y, z, g, turn = 0) {
  const geo = new THREE.CylinderGeometry(0.001, w / Math.SQRT2, h, 4, 1).rotateY(PI / 4);
  geo.scale(1, 1, d / w);
  const m = mesh(geo, mat, x, y + h / 2, z, g);
  m.rotation.y = turn;
  return m;
}
export function makeBuilding(k) {
  const g = new THREE.Group(), red = roofMat(0x8a3a2e, 2, 1), slate = roofMat(0x3c4d6e, 2, 1), thatch = roofMat(0xa08040, 2, 1);
  if (k === 'forge') {
    mesh(box(3, 1.9, 2.6), stoneGrey, 0, 0.95, -0.2, g);
    gable(3.4, 1.2, 3, slate, 0, 1.9, -0.2, g);
    mesh(box(0.7, 3.4, 0.7), stoneGrey, 1.0, 1.7, -1.0, g);                 // chimney
    mesh(new THREE.SphereGeometry(0.28, 8, 6), fireMat, 1.0, 3.45, -1.0, g).castShadow = false;
    mesh(box(1.1, 0.9, 0.1), fireMat, 0, 0.75, 1.12, g).castShadow = false;  // the hearth glows through the door
    mesh(box(0.7, 0.35, 0.4), ironMat, -1.0, 0.75, 1.6, g);                 // anvil
    mesh(cyl(0.25, 0.3, 0.6, 8), trunkMat, -1.0, 0.3, 1.6, g);
  } else if (k === 'barracks') {
    mesh(box(3.6, 1.7, 2.2), woodMat, 0, 0.85, -0.2, g);
    gable(4, 1.1, 2.7, red, 0, 1.7, -0.2, g);
    mesh(box(0.8, 1.2, 0.1), timber, 0, 0.6, 0.92, g);
    for (let i = 0; i < 4; i++) mesh(cyl(0.03, 0.03, 1.9, 5), trunkMat, -1.3 + i * 0.22, 0.95, 1.35, g).rotation.x = -0.25;   // spear rack
    mesh(box(1.1, 0.08, 0.08), timber, -1.0, 1.2, 1.15, g);
    mesh(cyl(0.05, 0.05, 3.4, 6), trunkMat, 1.6, 1.7, 1.0, g);
    mesh(new THREE.PlaneGeometry(1, 0.7), clothRed, 2.1, 3.0, 1.0, g).castShadow = false;
    mesh(cyl(0.45, 0.45, 0.12, 12), hayMat, 0.9, 1.0, 1.4, g).rotation.x = PI / 2 - 0.3;   // straw target
  } else if (k === 'chapel') {
    mesh(box(2.2, 2.2, 3), plaster, 0, 1.1, 0, g);
    gable(2.6, 1.6, 3.4, slate, 0, 2.2, 0, g, PI / 2);
    mesh(box(1, 3.6, 1), plaster, 0, 1.8, -1.3, g);                          // bell tower
    mesh(new THREE.ConeGeometry(0.85, 1.4, 4), slate, 0, 4.3, -1.3, g).rotation.y = PI / 4;
    mesh(box(0.1, 0.8, 0.1), goldMat, 0, 5.4, -1.3, g);
    mesh(box(0.5, 0.1, 0.1), goldMat, 0, 5.5, -1.3, g);
    mesh(box(0.6, 1.1, 0.08), winMat, 0, 1.2, 1.52, g);
    for (const s of [-1, 1]) mesh(box(0.08, 0.8, 0.4), glassBlue, s * 1.12, 1.4, 0.2, g).castShadow = false;
  } else if (k === 'market') {
    for (const [x, z] of [[-1.5, -1], [1.5, -1], [-1.5, 1], [1.5, 1]]) mesh(cyl(0.07, 0.07, 2.2, 6), trunkMat, x, 1.1, z, g);
    for (let i = 0; i < 6; i++) mesh(box(0.56, 0.06, 2.6), i % 2 ? clothRed : plaster, -1.4 + i * 0.56, 2.25 + (i % 2) * 0.01, 0, g).rotation.x = 0.12;   // striped awning
    mesh(box(3, 0.8, 0.9), woodMat, 0, 0.4, 0.6, g);                         // counter
    for (const [x, c] of [[-0.9, 0xd8482a], [0, 0xe8b830], [0.9, 0x5a9a3a]]) mesh(new THREE.SphereGeometry(0.28, 8, 6), std({ color: c, roughness: 0.8 }), x, 0.95, 0.6, g);
    mesh(box(0.7, 0.7, 0.7), woodMat, -1.0, 0.35, -0.8, g);
    mesh(box(0.6, 0.6, 0.6), woodMat, -0.3, 0.3, -1.0, g).rotation.y = 0.4;
    mesh(cyl(0.35, 0.35, 0.8, 10), woodMat, 0.9, 0.4, -0.9, g);
  } else if (k === 'mason') {
    for (const [x, y, z, r] of [[-0.8, 0.3, 0.6, 0], [0.1, 0.3, 0.7, 0.2], [-0.4, 0.9, 0.65, 0.1], [1.0, 0.3, -0.2, 0.5], [1.0, 0.9, -0.2, 0.3]]) mesh(box(0.9, 0.6, 0.7), sandPlain, x, y, z, g).rotation.y = r;
    mesh(cyl(0.1, 0.12, 3.6, 6), trunkMat, -1.0, 1.8, -0.9, g);              // crane post
    mesh(box(2.6, 0.14, 0.14), trunkMat, 0.1, 3.5, -0.9, g).rotation.z = 0.12;
    mesh(cyl(0.02, 0.02, 1.6, 4), ironMat, 1.2, 2.85, -0.9, g);
    mesh(box(0.7, 0.5, 0.6), sandPlain, 1.2, 1.9, -0.9, g);                  // a block on the hook
    mesh(box(1.4, 0.1, 0.9), woodMat, -0.6, 0.75, -0.2, g);                  // workbench
    for (const s of [-1, 1]) mesh(box(0.1, 0.7, 0.8), timber, -0.6 + s * 0.6, 0.35, -0.2, g);
  } else if (k === 'workshop') {
    mesh(box(3, 2, 2.4), woodMat, 0, 1, -0.2, g);
    mesh(box(3.3, 0.18, 2.8), copperMat, 0, 2.1, -0.2, g).rotation.x = 0.12;
    mesh(new THREE.TorusGeometry(0.6, 0.14, 6, 10), copperMat, -0.7, 1.2, 1.05, g);   // cog on the wall
    mesh(new THREE.TorusGeometry(0.35, 0.1, 6, 8), ironMat, 0.4, 0.8, 1.05, g);
    mesh(cyl(0.16, 0.16, 2.8, 8), copperMat, 1.2, 1.9, -1.0, g);             // exhaust pipe
    mesh(new THREE.SphereGeometry(0.2, 8, 6), coilGlow, 1.2, 3.4, -1.0, g).castShadow = false;
    mesh(box(0.8, 0.5, 0.6), ironMat, 1.1, 0.25, 1.4, g);
  } else if (k === 'library') {
    mesh(cyl(1.5, 1.65, 3.2, 12), stoneGrey, 0, 1.6, 0, g);
    mesh(new THREE.ConeGeometry(1.9, 2.2, 12), roofMat(0x2a4fb3, 3, 1), 0, 4.3, 0, g);
    mesh(new THREE.SphereGeometry(0.22, 10, 8), orbMat, 0, 5.6, 0, g).castShadow = false;
    for (let i = 0; i < 4; i++) { const a = (i / 4) * PI * 2 + 0.4; mesh(box(0.5, 0.9, 0.1), glassBlue, Math.sin(a) * 1.56, 2.1, Math.cos(a) * 1.56, g).rotation.y = a; }
    mesh(box(0.8, 1.3, 0.12), woodMat, 0, 0.65, 1.62, g);
  } else if (k === 'watchtower') {
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(cyl(0.12, 0.16, 5.4, 6), trunkMat, a * 0.9, 2.7, b * 0.9, g);
    for (const y of [1.4, 3.2]) for (const s of [-1, 1]) { mesh(box(2, 0.1, 0.1), timber, 0, y, s * 0.9, g).rotation.z = 0.5; mesh(box(0.1, 0.1, 2), timber, s * 0.9, y, 0, g).rotation.x = 0.5; }
    mesh(box(2.6, 0.2, 2.6), woodMat, 0, 5.4, 0, g);
    for (const s of [-1, 1]) { mesh(box(2.6, 0.5, 0.1), woodMat, 0, 5.8, s * 1.25, g); mesh(box(0.1, 0.5, 2.6), woodMat, s * 1.25, 5.8, 0, g); }
    mesh(new THREE.ConeGeometry(2, 1.3, 4), thatch, 0, 7.5, 0, g).rotation.y = PI / 4;
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(cyl(0.06, 0.06, 1.4, 5), trunkMat, a * 1.15, 6.2, b * 1.15, g);
    mesh(new THREE.SphereGeometry(0.2, 8, 6), fireMat, 0, 6.1, 0, g).castShadow = false;   // signal fire
  } else if (k === 'mint') {
    mesh(box(3, 2.2, 2.6), texMat(ashlarTex, 1.5, 1), 0, 1.1, -0.2, g);
    mesh(box(3.3, 0.3, 2.9), goldMat, 0, 2.35, -0.2, g);
    for (const s of [-1, 1]) mesh(cyl(0.18, 0.2, 2.2, 8), marblePlain, s * 0.9, 1.1, 1.2, g);   // columns
    mesh(box(1.1, 1.5, 0.12), ironMat, 0, 0.75, 1.12, g);                    // vault door
    mesh(new THREE.TorusGeometry(0.25, 0.05, 6, 12), goldMat, 0, 0.9, 1.2, g);
    for (let i = 0; i < 5; i++) mesh(cyl(0.22, 0.22, 0.07, 10), goldMat, 1.4, 0.05 + i * 0.07, 1.5, g).rotation.y = i;   // a stack of coins
    for (let i = 0; i < 3; i++) mesh(cyl(0.22, 0.22, 0.07, 10), goldMat, 1.0, 0.05 + i * 0.07, 1.7, g);
  } else if (k === 'tavern') {
    mesh(box(3.2, 1.5, 2.4), plaster, 0, 0.75, -0.2, g);
    mesh(box(3.3, 1.2, 2.5), plaster, 0, 2.1, -0.2, g);
    for (const x of [-1.6, 0, 1.6]) mesh(box(0.14, 2.7, 0.14), timber, x, 1.35, 1.02, g);   // half-timbering
    mesh(box(3.4, 0.14, 0.14), timber, 0, 1.5, 1.02, g);
    gable(3.8, 1.4, 3, thatch, 0, 2.7, -0.2, g);
    for (const x of [-0.8, 0.8]) mesh(box(0.6, 0.6, 0.08), winMat, x, 2.1, 1.06, g).castShadow = false;
    mesh(box(0.7, 1.2, 0.1), woodMat, 0.8, 0.6, 1.02, g);
    mesh(cyl(0.4, 0.4, 0.9, 10), woodMat, -1.0, 0.45, 1.5, g);               // barrel
    mesh(box(0.08, 0.08, 1), timber, -1.75, 2.3, 1.4, g);
    mesh(box(0.06, 0.6, 0.7), clothGold, -1.75, 1.95, 1.7, g);               // sign
  }
  // Pennants on the roof show the level.
  const pips = [];
  for (let i = 0; i < 5; i++) {
    const p = mesh(new THREE.ConeGeometry(0.16, 0.5, 4), goldMat, -1.2 + i * 0.6, 0, 1.95, g);
    p.rotation.x = PI; p.position.y = 0.3; p.castShadow = false;
    pips.push(p);
  }
  g.userData.setLevel = (lv) => { pips.forEach((p, i) => { p.visible = i < lv; }); g.scale.setScalar(0.88 + 0.03 * lv); };
  g.userData.setLevel(1);
  return g;
}

// An empty plot: a staked-out square with a sign, waiting for a building.
export function makePlot() {
  const g = new THREE.Group();
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(cyl(0.06, 0.08, 0.7, 5), trunkMat, a * 1.7, 0.35, b * 1.7, g);
  const rope = std({ color: 0xc8b890, roughness: 1 });
  for (const s of [-1, 1]) { mesh(box(3.4, 0.03, 0.03), rope, 0, 0.55, s * 1.7, g).castShadow = false; mesh(box(0.03, 0.03, 3.4), rope, s * 1.7, 0.55, 0, g).castShadow = false; }
  const dirt = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4).rotateX(-PI / 2), std({ color: 0x6a5238, roughness: 1 }));
  dirt.position.y = 0.06; dirt.receiveShadow = true; g.add(dirt);
  mesh(cyl(0.05, 0.05, 1.1, 5), trunkMat, 0, 0.55, 1.7, g);
  mesh(box(0.8, 0.45, 0.06), woodMat, 0, 1.05, 1.7, g);
  return g;
}
