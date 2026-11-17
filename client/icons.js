// Every picture in the interface is drawn here, stroke by stroke, on a sheet of 48 by 48.
// There are no emoji and no icon font. The pen is unsteady on purpose: lines bow a little,
// round things are not quite round, and the paint never sits exactly inside the ink.

const PAINT = {
  paper: '#f1e6c8', bone: '#ddd0ad', white: '#fbf7ea',
  gold: '#e6b84a', ochre: '#c98d2e', orange: '#dd7b3c', red: '#c4482f', crimson: '#9e2f3c',
  rose: '#e08f88', pink: '#eab4a8', purple: '#7a5fa6', violet: '#a48fd0',
  blue: '#4e78a8', sky: '#8dbbd8', teal: '#4f9a92', green: '#5c9650', leaf: '#8db54b', olive: '#7d8644',
  brown: '#87572f', wood: '#b5824c', dark: '#4b3626', iron: '#a3aab1', steel: '#6d757e', stone: '#aaa191',
  ink: '#1c1410',
};

// ---- The pen ----

// A small seeded generator, so a picture is the same every time it is drawn.
const seeded = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const f = (n) => String(Math.round(n * 10) / 10);
const shake = (pts, r, by) => pts.map(([x, y]) => [x + (r() - 0.5) * 2 * by, y + (r() - 0.5) * 2 * by]);

// A curve through every point (Catmull-Rom, written as cubic Béziers).
function through(pts, closed) {
  const n = pts.length, at = (i) => pts[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = at(i - 1), b = at(i), c = at(i + 1), e = at(i + 2);
    d += `C${f(b[0] + (c[0] - a[0]) / 6)} ${f(b[1] + (c[1] - a[1]) / 6)} ${f(c[0] - (e[0] - b[0]) / 6)} ${f(c[1] - (e[1] - b[1]) / 6)} ${f(c[0])} ${f(c[1])}`;
  }
  return d + (closed ? 'Z' : '');
}
// Straight edges, each with a slight bow, as a ruler-less hand draws them.
function edges(pts, closed, r) {
  const n = pts.length;
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 1; i <= (closed ? n : n - 1); i++) {
    const a = pts[i - 1], b = pts[i % n], len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, k = (r() - 0.5) * 0.09 * len;
    d += `Q${f((a[0] + b[0]) / 2 - ((b[1] - a[1]) / len) * k)} ${f((a[1] + b[1]) / 2 + ((b[0] - a[0]) / len) * k)} ${f(b[0])} ${f(b[1])}`;
  }
  return d + (closed ? 'Z' : '');
}
const ring = (cx, cy, rx, ry, rot = 0, n = 10) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2, x = Math.cos(a) * rx, y = Math.sin(a) * ry, c = Math.cos(rot), s = Math.sin(rot);
  return [cx + x * c - y * s, cy + x * s + y * c];
});
const cog = (cx, cy, R, r, n) => { const out = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, w = Math.PI / n; for (const [da, rad] of [[-0.3 * w, R], [0.3 * w, R], [0.62 * w, r], [1.38 * w, r]]) out.push([cx + Math.cos(a + da) * rad, cy + Math.sin(a + da) * rad]); } return out; };

// ---- Reading a picture ----
// One stroke per line (or between semicolons):
//   e cx cy rx ry       an ellipse            p x y x y ...   a shape with straight edges
//   s x y x y ...       a rounded shape       l x y x y ...   an open line
//   c x y x y ...       an open curve         d x y [r]       a dot
//   gear cx cy R r n    a cogwheel            use part [dx dy [scale [paint]]]   a part drawn elsewhere ($ in it is the paint)
// then, in any order: a paint (the fill; "-" for none), k=paint (the ink; k=- for none), w.6 (a thinner or
// thicker pen), rot30 (an ellipse turned by degrees), o.5 (see-through), nh (no paper edge).
// "sym" in front draws the stroke twice, mirrored left to right.
function read(src, parts, depth = 0) {
  const out = [];
  for (const line of src.split(/[\n;]/)) {
    const t = line.trim().split(/\s+/).filter(Boolean);
    if (!t.length) continue;
    const sym = t[0] === 'sym'; if (sym) t.shift();
    const op = t.shift();
    if (op === 'use') {
      const [name, dx = 0, dy = 0, k = 1, paint = 'paper'] = t, sub = parts[name];
      if (!sub || depth > 3) throw new Error(`no such part: ${name}`);
      for (const sh of read(sub.replaceAll('$', paint), parts, depth + 1)) {
        const placed = { ...sh, pts: sh.pts.map(([x, y]) => [x * k + Number(dx), y * k + Number(dy)]), rx: sh.rx * k, ry: sh.ry * k, w: sh.w * (k < 0.8 ? Math.sqrt(k) : 1) };
        out.push(placed);
        if (sym) out.push({ ...placed, pts: placed.pts.map(([x, y]) => [48 - x, y]).reverse(), rot: -placed.rot });
      }
      continue;
    }
    const sh = { op, pts: [], rx: 0, ry: 0, rot: 0, fill: null, ink: 'ink', w: 1, o: 1, halo: true }, nums = [];
    for (const x of t) {
      if (/^-?\d*\.?\d+$/.test(x)) nums.push(Number(x));
      else if (x === '-') sh.fill = null;
      else if (x.startsWith('k=')) sh.ink = x === 'k=-' ? null : x.slice(2);
      else if (/^w\d*\.?\d+$/.test(x)) sh.w = Number(x.slice(1));
      else if (/^rot-?\d+$/.test(x)) sh.rot = (Number(x.slice(3)) * Math.PI) / 180;
      else if (/^o\d*\.?\d+$/.test(x)) sh.o = Number(x.slice(1));
      else if (x === 'nh') sh.halo = false;
      else if (PAINT[x]) sh.fill = x;
      else throw new Error(`cannot read "${x}" in: ${line.trim()}`);
    }
    if (op === 'e') { sh.pts = [[nums[0], nums[1]]]; sh.rx = nums[2]; sh.ry = nums[3] ?? nums[2]; }
    else if (op === 'd') { sh.pts = [[nums[0], nums[1]]]; sh.rx = sh.ry = nums[2] ?? 1.2; if (!sh.fill) sh.fill = 'ink'; }
    else if (op === 'gear') { sh.op = 'p'; sh.pts = cog(nums[0], nums[1], nums[2], nums[3], nums[4]); }
    else if ('pslc'.includes(op) && op.length === 1) { if (nums.length % 2 || nums.length < 4) throw new Error(`odd points in: ${line.trim()}`); for (let i = 0; i < nums.length; i += 2) sh.pts.push([nums[i], nums[i + 1]]); }
    else throw new Error(`unknown stroke "${op}" in: ${line.trim()}`);
    if (sh.ink && !PAINT[sh.ink]) throw new Error(`unknown ink "${sh.ink}" in: ${line.trim()}`);
    out.push(sh);
    if (sym) out.push({ ...sh, pts: sh.pts.map(([x, y]) => [48 - x, y]).reverse(), rot: -sh.rot });
  }
  return out;
}

// One picture as the inside of an SVG symbol. mono: a plain glyph in the colour of the text around it.
function draw(name, src, parts, mono) {
  const r = seeded(hash(name)), shapes = read(src, parts);
  let edge = '', edgeOpen = '', body = '';
  for (const sh of shapes) {
    const closed = sh.op !== 'l' && sh.op !== 'c', o = sh.o < 1 ? ` opacity="${sh.o}"` : '';
    // A style, not an attribute: the sheet's own rules would win over a stroke attribute.
    const pen = [sh.w !== 1 ? `stroke-width:calc(var(--sw,2.4px)*${sh.w})` : '', !mono && sh.ink && sh.ink !== 'ink' ? `stroke:${PAINT[sh.ink]}` : ''].filter(Boolean).join(';');
    const sw = pen ? ` style="${pen}"` : '';
    if (sh.op === 'd') {
      const [x, y] = shake(sh.pts, r, 0.25)[0];
      body += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(sh.rx)}" fill="${mono ? 'currentColor' : PAINT[sh.fill]}"${o}/>`;
      continue;
    }
    const line = (by) => {
      if (sh.op === 'e') return through(shake(ring(sh.pts[0][0], sh.pts[0][1], sh.rx, sh.ry, sh.rot), r, by + Math.min(sh.rx, sh.ry) * 0.035), true);
      const pts = shake(sh.pts, r, by);
      return sh.op === 'p' || sh.op === 'l' ? edges(pts, closed, r) : through(pts, closed);
    };
    const ink = line(0.35);
    if (mono) { body += `<path d="${ink}" class="pm${closed && sh.fill ? ' f' : ''}"${sw}${o}/>`; continue; }
    if (sh.halo) { if (closed) edge += ink; else edgeOpen += ink; }
    if (closed && sh.fill) body += `<path d="${line(0.6)}" fill="${PAINT[sh.fill]}"${o}/>`;
    if (sh.ink) body += `<path d="${ink}" class="pk"${sw}${o}/>`;
  }
  return `${edge ? `<path class="pe" d="${edge}"/>` : ''}${edgeOpen ? `<path class="pe o" d="${edgeOpen}"/>` : ''}${body}`;
}

// ---- The pictures ----
// Parts are pieces several pictures share. "$" is painted by whoever uses the part.
const PARTS = {
  cloud: 's 9 31 8 25 13 21 18 22 21 16 29 15 34 19 39 21 41 27 38 32 24 33 12 33 $',
  hang: 'l 7 9 41 9 w1.3; p 12 9 36 9 36 39 24 32 12 39 $; d 7 9 1.8 gold; d 41 9 1.8 gold',
  book: 'p 14 40.5 38 37.5 39.5 41.5 16 44.5 paper w.7; p 10.5 9.5 35 7 38 38 13.5 41 $; l 15 11 17 40 w.6',
  medal: 'p 15 4 22.5 4 26.5 19 20 21 blue; p 25.5 4 33 4 28 21 21.5 19 red; e 24 31 11.5 11.5 $; e 24 31 7.5 7.5 - w.6',
  bag: 's 17 12 15 5 20 8 24 5 28 8 33 5 31 12 $; s 24 12 31 15 38 27 38 37 31 43 17 43 10 37 10 27 17 15 $; p 17 11.5 31 11.5 31.5 15.5 16.5 15.5 red w.7',
  flask: 'p 19 2.5 29 2.5 28.5 7 19.5 7 wood w.8; p 20.5 7 27.5 7 27.5 18 20.5 18 white w.8; s 20.5 17 12 29 11.5 38 17 43.5 31 43.5 36.5 38 36 29 27.5 17 $; c 13 30.5 19 28 26 31 35 29.5 w.6; d 18.5 37.5 1.7 white; d 24 34.5 1 white; d 29 39.5 1.2 white',
  hammer: 'p 20 17 25 16 31 42 26 44 wood; p 7 10 31 5.5 33 16 9 20.5 $; l 13 9 14.5 19.5 w.6',
  anvil: 'p 5 15 34 15 43 19.5 34 24 30.5 24 28.5 31 35 36 35 42 12 42 12 36 18.5 31 16.5 24 5 22 steel; l 16.5 24 30.5 24 w.6',
  tower: 'p 15 44 16.5 17 31.5 17 33 44 stone; p 11.5 8 17 8 17 12 21.5 12 21.5 8 26.5 8 26.5 12 31 12 31 8 36.5 8 36.5 17.5 11.5 17.5 stone; s 20 44 20 35 24 31 28 35 28 44 dark; l 24 21.5 24 26.5 w1.3; l 16 24 19.5 24 w.5; l 28.5 28 32 28 w.5; l 17 38 19.5 38 w.5',
  mug: 'c 31 20 39.5 20.5 39.5 33.5 30.5 36 w1.3; p 10 14 31.5 14 30.5 42.5 11.5 42.5 $; l 16 20 16.5 37 w.6; l 21 20 21 37 w.6; l 26 20 25.5 37 w.6; s 9 15 8 9.5 13 7 17 9.5 21 6 26 8.5 30 7 33.5 11 32 15.5 white',
  bolt: 'p 27.5 3 11.5 26.5 21.5 26.5 17.5 45 36.5 19.5 26 19.5 31.5 3 $',
  drop: 's 24 4.5 31 16.5 35.5 27 32.5 37.5 24 41.5 15.5 37.5 12.5 27 17 16.5 $',
  gem: 'p 14 8 34 8 42.5 18 24 42.5 5.5 18 $; l 5.5 18 42.5 18 w.6; l 14 8 19 18 24 42 w.5; l 34 8 29 18 24 42 w.5; l 19 18 24 8 29 18 w.5',
  egg: 's 24 4 33 12 38 26 35.5 37 24 43.5 12.5 37 10 26 15 12 $',
  eye: 's 3.5 24 13 14 24 11 35 14 44.5 24 35 34 24 37 13 34 white; e 24 24 8.5 8.5 $; e 24 24 3.6 3.6 ink',
  person: 's 24 20 33 23.5 35.5 43 12.5 43 15 23.5 $; e 24 12.5 6.5 6.5 pink',
  skullp: 's 24 5.5 35 8.5 39.5 19.5 36.5 29 31 31.5 31 38 17 38 17 31.5 11.5 29 8.5 19.5 13 8.5 bone; e 17.6 21 3.9 4.6 ink; e 30.4 21 3.9 4.6 ink; p 24 26 26.2 30.2 21.8 30.2 ink w.6; l 21 33.5 21 38 w.6; l 24 33.5 24 38 w.6; l 27 33.5 27 38 w.6',
  crownp: 'p 8.5 35 5.5 13.5 15 24 24 9 33 24 42.5 13.5 39.5 35 $; p 8 35 40 35 40 41.5 8 41.5 ochre; d 24 38.2 1.5 red; d 15 38.2 1.3 blue; d 33 38.2 1.3 blue',
  starp: 'p 24 5 29.3 17.6 42.8 18.8 32.4 27.8 35.7 41 24 33.8 12.3 41 15.6 27.8 5.2 18.8 18.7 17.6 $',
  heartp: 's 24 41 11 29.5 6.5 19 10.5 10.5 18 9 24 15.5 30 9 37.5 10.5 41.5 19 37 29.5 $',
  shieldp: 's 10 9.5 24 7 38 9.5 38.5 22 33.5 33 24 42 14.5 33 9.5 22 $',
  swordp: 'p 41.5 5.5 42.6 11 21.8 31.8 16.3 26.3 37 5.6 iron; l 38.5 9.5 20.5 27.5 w.5; p 9.5 26.5 12.5 23.5 24.5 35.5 21.5 38.5 gold; p 13.3 31.5 16.6 34.8 10.6 40.8 7.3 37.5 brown; e 7 41 3.2 3.2 gold',
  greatswordp: 'p 24 2.5 28.5 9 28 30 20 30 19.5 9 iron; l 24 7 24 29 w.5; p 12.5 29.5 35.5 29.5 35.5 34 12.5 34 gold; p 21.8 34 26.2 34 26.2 42 21.8 42 brown; e 24 44 2.8 2.8 gold; d 24 31.7 1.2 red',
  snowp: 'e 24 24 18 18 sky; l 24 7 24 41; l 9.3 15.5 38.7 32.5; l 9.3 32.5 38.7 15.5; sym l 24 13 20 9.5 w.7; sym l 24 35 20 38.5 w.7; sym l 14.5 18.5 9.5 19.5 w.7; sym l 14.5 18.5 13 13.5 w.7; sym l 14.5 29.5 9.5 28.5 w.7; sym l 14.5 29.5 13 34.5 w.7',
  sunp: 'sym l 24 4 24 9.5; sym l 9.8 9.8 13.8 13.8; sym l 4 24 9.5 24; sym l 9.8 38.2 13.8 34.2; l 24 38.5 24 44; e 24 24 10 10 $',
  moonp: 's 31 5.5 21 7 12.5 14 9.5 24 12.5 34 21 41 32 42.5 25.5 36 21 28 21 19.5 24.5 12 gold',
  flamep: 's 25 3 30 13 37 21 38 31 32 41 24 44 16 41 10 32 12 23 18 17 21 9 $; s 24.5 19 28.5 26 30 33 27 39.5 23 40 19 35 19.5 28 gold w.7',
  arrowp: 'l 9 39 37 11 w1.1; p 41 7 39 17.5 30.5 9 iron w.8; l 9 39 6.5 32 w.7; l 9 39 16 41.5 w.7; l 13 35 10.5 28 w.7; l 13 35 20 37.5 w.7',
  arrowdn: 'l 8 6 21.5 33 w1; p 24.5 39 17.5 33.5 25 30.5 iron w.7; l 8 6 5 11.5 w.7; l 8 6 13.5 5 w.7; l 9.8 9.6 6.8 15.1 w.7; l 9.8 9.6 15.3 8.6 w.7',
  face: 'p 11.5 16 8 5 17 11 bone; p 36.5 16 40 5 31 11 bone; e 24 26 15.5 14.5 $; l 14 19.5 21 23 w1.1; l 34 19.5 27 23 w1.1; d 19 25 1.5; d 29 25 1.5; p 16.5 32 31.5 32 29.5 35.5 26.8 32.5 24 36.5 21.2 32.5 18.5 35.5 white w.6',
  blob: 'e 24 26 11 10 $; d 20 24 1.5; d 28 24 1.5; l 20 30.5 28 30.5 w.7',
  coins: 'e 24 36 14 5.5 ochre; e 24 30.5 14 5.5 gold; e 24 25 14 5.5 ochre; e 24 19.5 14 5.5 gold; e 24 19.5 8 2.6 - w.5',
  hornp: 's 3.5 19 7.9 34.3 23.3 41 38.6 32.3 45.3 13.5 31.7 10.5 31.4 27.7 22.7 35 10.1 31.7 bone; e 38.5 12 7.2 2.6 rot15 dark w.7; p 32.6 20.5 43.8 21.5 41.6 27.8 32.6 25.3 gold w.7; p 15.2 33.6 14 39.2 19.4 41 20 34.8 gold w.7',
  hand: 's 15.5 44.5 14 31 9.5 23 12.5 20.5 17 26 17 10.5 20.5 9.5 22 21 23 6.5 26.5 6.5 27.5 21 29.5 9 33 10 31.5 23 34.5 18 38 20 34.5 33 32.5 44.5 $',
  housep: 'p 8.5 44.5 8.5 24 39.5 24 39.5 44.5 bone; p 30 7 34.5 7 34.5 17 30 17 stone w.8; p 4 25.5 24 7.5 44 25.5 red; p 20.5 44.5 20.5 33 27.5 33 27.5 44.5 brown; p 12 29.5 17 29.5 17 34.5 12 34.5 sky w.6; p 31 29.5 36 29.5 36 34.5 31 34.5 sky w.6',
  brick: 'p 5 14 43 14 43 42 5 42 $; l 5 23.5 43 23.5 w.6; l 5 33 43 33 w.6; l 17 14 17 23.5 w.6; l 31 14 31 23.5 w.6; l 11 23.5 11 33 w.6; l 24 23.5 24 33 w.6; l 37 23.5 37 33 w.6; l 17 33 17 42 w.6; l 31 33 31 42 w.6',
  chest: 'p 6 22 42 22 42 41 6 41 wood; s 6 22 7.5 13 15 8.5 33 8.5 40.5 13 42 22 brown; l 6 22 42 22 w.9; l 13.5 9 13.5 41 w.6; l 34.5 9 34.5 41 w.6; p 20.5 18 27.5 18 27.5 27 20.5 27 gold w.8; d 24 22.5 1.2',
};

const PICS = {
  // Money and marks
  coin: 'e 24 24 15.5 15.5 gold; e 24 24 10.5 10.5 - w.6; use starp 12 12.4 .5 ochre',
  star: 'use starp 0 0 1 sky',
  clover: 'c 24 30 23.5 38 27.5 44.5 w1.1; e 17.5 17.5 7.4 7.4 green; e 30.5 17.5 7.4 7.4 green; e 17.5 30.5 7.4 7.4 green; e 30.5 30.5 7.4 7.4 green; l 19 19 22.5 22.5 w.5; l 29 19 25.5 22.5 w.5; l 19 29 22.5 25.5 w.5; l 29 29 25.5 25.5 w.5',
  turret: 'p 11 44 13.5 31 34.5 31 37 44 stone; l 13 37 35 37 w.6; l 20 37 20 44 w.6; l 28 31 28 37 w.6; p 20 31 21 23 27 23 28 31 wood; c 8 13 16 19 24 20 32 19 40 13 w1.3; l 8.5 13 39.5 13 w.6; p 22.3 6 25.7 6 25.7 25 22.3 25 wood; p 24 1.5 28 8 20 8 iron',
  tesla: 'p 13.5 44 16 34 32 34 34.5 44 stone; p 21 34 22 16 26 16 27 34 wood; e 24 30 6.2 2.1 - w.8; e 24 25 5.6 2 - w.8; e 24 20 5 1.9 - w.8; e 24 11 5.6 5.6 sky; l 31 6.5 35.5 3 34.5 8.5 40 6.5 w.7; l 17 6.5 12.5 3 13.5 8.5 8 6.5 w.7',
  mortar: 'p 8.5 44 12 34 36 34 39.5 44 wood; p 15 34 11.5 16.5 30 10 34.5 28.5 steel; e 20.8 13.2 9.4 3.4 rot-18 dark w.8; e 34 6 3.3 3.3 dark w.8; l 13.5 24 32.5 18 w.6',
  ballista: 'l 10 44.5 24 29 38 44.5 w1.3; c 4 18.5 14 12.5 24 11.5 34 12.5 44 18.5 w1.6; l 4.5 18.5 24 31 43.5 18.5 w.6; p 21.5 6 26.5 6 26.5 34.5 21.5 34.5 wood; p 24 1 27.8 7.5 20.2 7.5 iron',
  quill: 'p 7.5 26 30 22.5 32.5 41 10 44.5 paper; l 13 31.5 26 29.5 w.5; l 13.8 36 22 34.8 w.5; s 40.5 3.5 43.5 12.5 39 22 31.5 28 26 29.5 28 22.5 33.5 13 white; l 22.5 36.5 40.5 6 w.8',
  skull: 'use skullp',

  // Items
  whetstone: 'p 6 29 29 21 42 26.5 19 35.5 stone; p 6 29 19 35.5 19 42 6 35.5 stone; p 19 35.5 42 26.5 42 33 19 42 stone; p 14 15 37 6 39.5 10.5 16 19.5 iron; l 6 8 10 12 w.7; l 10 6 10 14 w.7; l 6 12 14 8 w.7',
  fletching: 's 38 5 42 15 37 27 27 35 17 37.5 19 28 27 16 white; l 9 45 38 8 w.9; l 22 31 29 30 w.5; l 26 26 34 24 w.5; l 30 20 38 17 w.5; l 33 14 40 11 w.5',
  wardrum: 'p 9 14 39 14 37.5 37 30 41 18 41 10.5 37 red; l 9.5 15 14.5 37 19.5 15 24 37 28.5 15 33.5 37 38.5 15 w.6; e 24 14 15 5.5 bone; l 5 3 19 12 w1.3; l 43 3 29 12 w1.3; d 5 3 2 wood; d 43 3 2 wood',
  horseshoe: 'p 11 7 18.5 7 18.5 26 21.5 32.5 26.5 32.5 29.5 26 29.5 7 37 7 37 28 31.5 40 16.5 40 11 28 steel; d 14.8 13 1.1; d 14.8 22 1.1; d 33.2 13 1.1; d 33.2 22 1.1; d 18 32 1.1; d 30 32 1.1',
  ledger: 'use book 0 0 1 brown; l 21 15.5 32 14.5 w.6; l 21 20.5 32.5 19.5 w.6; l 21.5 25.5 28 25 w.6; e 30.5 31 4.2 4.2 gold w.7',
  lime: 'c 10 18 15 3 33 3 38 18 w.9; p 9.5 18 38.5 18 34.5 42.5 13.5 42.5 wood; l 11 25.5 37 25.5 w.6; l 12.5 35 35.5 35 w.6; e 24 18 14.5 4.6 white',
  tome: 'use book 0 0 1 blue; use starp 14.5 11 .5 gold; p 35 19 40.5 18.6 40.8 24 35.4 24.4 gold w.7',
  kindling: 'p 7 36 38 29 39.5 34.5 9 41.5 brown; p 6.5 29.5 36 21 37.5 26.5 8.5 35 wood; p 11 23.5 33 16.5 34.5 22 12.5 29 brown; p 19.5 17.5 26 16 30 38 23.5 39.5 red w.7; use flamep 24.5 -1 .42 orange',
  toolbox: 'c 15.5 20 15.5 8.5 32.5 8.5 32.5 20 w1.3; p 6.5 19.5 41.5 19.5 41.5 41.5 6.5 41.5 red; l 6.5 27 41.5 27 w.7; p 20.5 23.5 27.5 23.5 27.5 31 20.5 31 gold w.7',
  banner: 'l 11 6 11 45 w1.3; p 12 8.5 40.5 10.5 33.5 18 40.5 25.5 12 26.5 red; d 11 5 2.2 gold',
  coinpurse: 'e 34 11 5.2 5.2 gold w.7; use bag 0 1 .98 wood',
  heavybolts: 'p 11 13 15 13 15 41 11 41 wood; p 13 3.5 17.5 13.5 8.5 13.5 iron; p 22 13 26 13 26 41 22 41 wood; p 24 3.5 28.5 13.5 19.5 13.5 iron; p 33 13 37 13 37 41 33 41 wood; p 35 3.5 39.5 13.5 30.5 13.5 iron; p 7.5 26 40.5 26 40.5 32 7.5 32 red w.7',
  spyglass: 'p 5.5 30.5 19.5 20.5 24 26.5 10 36.5 wood; p 19.5 20.5 31.5 12 35 17.5 23.5 26 ochre; p 31.5 12 41 5.5 45 11.5 35 17.5 gold; e 43 8.5 2.2 4 rot-35 sky w.7',
  grindstone: 'p 9 44 14 28 34 28 39 44 wood; l 12 37 36 37 w.6; e 24 19.5 14.5 14.5 stone; e 24 19.5 3.2 3.2 dark w.7; l 24 19.5 37.5 12.5 w1.1; l 37.5 12.5 42 15 w1.3; l 9 9 5 5 w.6; l 12 6.5 10 2 w.6',
  oil: 'l 13 40 9.5 45 w1.1; l 35 40 38.5 45 w1.1; s 8 20 9 33 16 42 32 42 39 33 40 20 steel; e 24 20 16.5 4.8 steel; e 24 20 12.5 3 gold w.6; e 17 11 2.2 2.2 gold w.6; e 26.5 6.5 2.9 2.9 gold w.6; e 32 13 1.7 1.7 gold w.6',
  bounty: 'l 24 33 24 45 w1.5; p 5.5 7.5 42.5 7.5 42.5 34 5.5 34 wood; p 12.5 11.5 30.5 11.5 30.5 30 12.5 30 paper w.7; e 21.5 20.5 5 5 - w.6; d 21.5 20.5 1.4 red; e 36.5 26 4 4 gold w.7; d 21.5 11.5 1.3 red',
  piggy: 'p 13 34 12.5 42 17.5 42 18 36 rose; p 27 37 26.5 42 31.5 42 32 36 rose; e 23 27 15.5 11.5 rose; p 12.5 20.5 10.5 11.5 19.5 16 rose; e 37.5 28 4.6 4.2 pink; d 36.2 28 .9; d 38.9 28 .9; d 30.5 23.5 1.2; l 17 18 25.5 17.5 w.8; c 8.2 27 4.6 25 5.4 21 8.4 22 w.8',
  chimes: 'l 24 4 24 9 w.7; l 14 14 14 20 w.6; l 21 14 21 23 w.6; l 28 14 28 21 w.6; l 35 14 35 19 w.6; p 8.5 10 39.5 9 40 13.5 9 14.5 wood; p 12 20 16 20 16 34 12 34 sky; p 19 23 23 23 23 41 19 41 sky; p 26 21 30 21 30 37 26 37 sky; p 33 19 37 19 37 31 33 31 sky',
  grimoire: 'use book 0 0 1 crimson; e 26.5 23 5.6 5.6 gold w.7; l 26.5 19 26.5 27 w.6; l 22.8 23 30.2 23 w.6; p 35 19 40.5 18.6 40.8 24 35.4 24.4 gold w.7',
  cogs: 'gear 18 29 13.5 9.8 8 gold; e 18 29 3.6 3.6 dark w.7; gear 33.5 14.5 10 7.2 7 iron; e 33.5 14.5 2.7 2.7 dark w.7',
  bells: 'e 24 5.5 2.7 2.7 - w.9; s 24 8 31 12 33 26 38.5 34 9.5 34 15 26 17 12 gold; e 24 38 3.2 3.2 ochre; l 15.5 27 32.5 27 w.6',
  drillbook: 'use book 0 0 1 green; l 20.5 16 32 29.5 w.9; l 32 16 20.5 29.5 w.9; d 20.5 16 1.3 gold; d 32 16 1.3 gold',
  poster: 'p 9.5 5.5 38.5 5.5 38.5 40 9.5 40 paper; p 9.5 40 38.5 40 36.5 44.5 11.5 44.5 bone w.7; e 24 15.5 4.6 4.6 pink w.7; c 15 28.5 17.5 22.5 30.5 22.5 33 28.5 w.8; l 14.5 33.5 33.5 33.5 w.6; l 17 37 31 37 w.6; d 24 5.5 1.9 red',
  marksflag: 'use hang 0 0 1 red; c 20.5 13.5 28.5 21.5 20.5 29.5 w1; l 20.5 13.5 20.5 29.5 w.5; l 16.5 21.5 31.5 21.5 w.7; l 31.5 21.5 28.5 19 w.7; l 31.5 21.5 28.5 24 w.7',
  arcaneflag: 'use hang 0 0 1 purple; p 24 12.5 26 19.5 33 21.5 26 23.5 24 30.5 22 23.5 15 21.5 22 19.5 white w.6',
  alchemyflag: 'use hang 0 0 1 green; p 22 12.5 26 12.5 26 18 30.5 27.5 17.5 27.5 22 18 white w.6; l 19.5 23.5 28.5 23.5 w.5',
  faithflag: 'use hang 0 0 1 gold; e 24 21 4.2 4.2 white w.6; l 24 12.5 24 15.2 w.7; l 24 26.8 24 29.5 w.7; l 15.5 21 18.2 21 w.7; l 29.8 21 32.5 21 w.7; l 18 15 19.9 16.9 w.7; l 30 15 28.1 16.9 w.7; l 18 27 19.9 25.1 w.7; l 30 27 28.1 25.1 w.7',
  wardenflag: 'use hang 0 0 1 blue; s 17.5 14.5 24 13 30.5 14.5 30.5 21 24 29.5 17.5 21 white w.6; l 24 13.5 24 29 w.5',
  engineerflag: 'use hang 0 0 1 orange; gear 24 21 8 5.6 7 white w.6; d 24 21 1.6',
  cursedbanner: 'l 7 9 41 9 w1.3; p 12 9 36 9 36 38 31.5 32.5 27.5 39 24 31.5 20 38.5 16.5 32.5 12 39 purple; use skullp 12.5 9.5 .48',
  hourglass: 'p 14 9 34 9 34 14 26.5 24 34 34 34 39 14 39 14 34 21.5 24 14 14 white; p 17.5 14.5 30.5 14.5 25.5 21 22.5 21 gold k=- nh; p 16.5 38 31.5 38 27.5 33 24 30.5 20.5 33 gold k=- nh; l 24 24.5 24 30 k=ochre w.6 nh; p 10.5 4.5 37.5 4.5 37.5 9.5 10.5 9.5 wood; p 10.5 38.5 37.5 38.5 37.5 43.5 10.5 43.5 wood',
  thorns: 'p 7.5 26 12.5 8 17.5 26 iron; p 19 26 24 5 29 26 iron; p 30.5 26 35.5 8 40.5 26 iron; p 5.5 26 42.5 26 42.5 43.5 5.5 43.5 stone; l 5.5 34.5 42.5 34.5 w.6; l 18 26 18 34.5 w.6; l 30 26 30 34.5 w.6; l 12 34.5 12 43.5 w.6; l 24 34.5 24 43.5 w.6; l 36 34.5 36 43.5 w.6',
  crown: 'use crownp 0 0 1 gold; d 5.5 12.5 1.8 gold; d 24 8 1.8 gold; d 42.5 12.5 1.8 gold',
  quiver: 'c 14.5 18 5.5 26 9.5 41 w.9; l 18 15 15 5 w.9; l 22.5 14.5 22.5 4 w.9; l 27.5 14 30.5 5 w.9; p 15 5 12 10.5 18 11 red w.6; p 22.5 3.5 19.8 9 25.2 9 red w.6; p 30.5 4.5 27 9.5 32.8 10.8 red w.6; p 13.5 16 30.5 13.5 34.5 42 19.5 44.5 brown; l 14.5 21.5 31.5 19 w.6',
  stormglass: 's 24 6 30.5 10 36.5 24 33.5 36.5 24 41.5 14.5 36.5 11.5 24 17.5 10 sky; use bolt 12.5 12.5 .48 gold; p 20 2.5 28 2.5 28 8 20 8 wood',
  bellows: 'p 9 12 33 22.5 33 25.5 9 36 brown; l 13 14.5 13 33.5 w.5; l 18 16.5 18 31.5 w.5; l 23 18.7 23 29.3 w.5; l 28 20.8 28 27.2 w.5; p 2 6 35 21 34 24 1 9 wood; p 2 42 35 27 34 24 1 39 wood; p 34 21.5 44.5 22.8 44.5 25.2 34 26.5 iron',
  gearbox: 'p 5.5 11.5 42.5 11.5 42.5 40.5 5.5 40.5 wood; l 5.5 17 42.5 17 w.6; gear 18 28.5 9.2 6.6 7 iron w.8; d 18 28.5 1.5; gear 31.5 27 7.2 5.1 6 gold w.8; d 31.5 27 1.3; d 9.5 14.3 1; d 38.5 14.3 1',
  bulwark: 'p 8 12 40.5 9.5 40.5 36 8 38.5 blue; e 8.3 25.2 2.6 13.3 bone w.7; l 14 30.5 36 28.5 k=white w.8 nh; l 14 30.5 14 22.5 17.5 22.2 17.5 25.2 21.5 24.9 21.5 21.9 25.5 21.6 25.5 24.6 29.5 24.3 29.5 21.3 33.5 21 36 20.8 36 28.5 k=white w.8 nh',
  elixir: 'use flask 0 0 1 purple',
  midas: 'use hand 0 0 1 gold; l 4 8 8 4 w.7; l 4 4 8 8 w.7; l 40 34 44 38 w.7; l 40 38 44 34 w.7',
  dragonheart: 's 24 14.5 19.5 8 24 1.5 27.5 7 30.5 3.5 31.5 11 28 15.5 orange w.8; use heartp 0 3 1 crimson; l 15 20.5 17.5 23.5 20 20.5 w.5; l 28 20.5 30.5 23.5 33 20.5 w.5; l 21.5 26.5 24 29.5 26.5 26.5 w.5; l 15.5 30 18 33 20.5 30 w.5; l 27.5 30 30 33 32.5 30 w.5; l 21.5 35.5 24 38.5 26.5 35.5 w.5',
  aegis: 'use shieldp 0 0 1 gold; s 15 14 24 12 33 14 33 22 29.5 30.5 24 36 18.5 30.5 15 22 white w.7; e 24 22 3.8 4.8 blue w.7',
  warhorn: 'c 6.5 21 13 6 29 3.5 35.5 9.5 w.8; use hornp',
  map: 'p 6.5 10 18.5 13.5 29.5 9 41.5 12.5 41.5 38.5 29.5 35 18.5 39.5 6.5 36 paper; l 18.5 13.5 18.5 39.5 w.5; l 29.5 9 29.5 35 w.5; l 31.5 16.5 36.5 21.5 k=red w1 nh; l 36.5 16.5 31.5 21.5 k=red w1 nh; d 11.5 31 1; d 15.5 27 1; d 21 26 1; d 25 22 1; d 28.5 19.5 1',
  kingsbanner: 'use hang 0 0 1 crimson; p 17 26 15.5 16.5 20.5 20.5 24 14.5 27.5 20.5 32.5 16.5 31 26 gold w.7',
  queencrown: 'p 8.5 36 4 15.5 13 26.5 16 7.5 21 24.5 24 4.5 27 24.5 32 7.5 35 26.5 44 15.5 39.5 36 purple; p 8 36 40 36 40 42 8 42 violet; d 24 39 1.6 gold; d 15.5 39 1.3 gold; d 32.5 39 1.3 gold',
  behemothplate: 's 4.5 41 7.5 28.5 24 22.5 40.5 28.5 43.5 41 steel; s 8 32 11 20.5 24 15.5 37 20.5 40 32 steel; s 12.5 23 15.5 12.5 24 8 32.5 12.5 35.5 23 iron; d 9.5 37.5 1.2; d 38.5 37.5 1.2; d 12.5 28.5 1.1; d 35.5 28.5 1.1; d 24 13.5 1.3; l 22 35 26 35 w.5; l 20 26 28 26 w.5',
  tyrantwing: 's 5.5 35 7.5 16 20 5.5 42.5 5.5 34.5 13 41.5 17 32.5 22 38.5 27 28.5 30 31.5 36.5 18.5 36.5 purple; l 8 33 20.5 7.5 w.6; l 10 33.5 33.5 12.5 w.5; l 12 34 31.5 22 w.5; l 14 35 28 30 w.5',
  broodheart: 'use heartp 0 0 1 olive; c 24 16 22 24 25 31 23 39 w.6; c 23 24 17 22 13 25 w.5; c 24.5 28 30 26 34 28 w.5; s 33 35 35.5 39.5 33 43 30.5 39.5 olive w.6',
  warbanner: 'use hang 0 0 1 red; l 18 14 30.5 28.5 w1; l 30.5 14 18 28.5 w1; l 17 25.5 20.5 29.5 w.8; l 31.5 25.5 28 29.5 w.8',
  philosopher: 'use gem 0 2 1 red; l 5 6 9 10 w.7; l 9 6 5 10 w.7; l 40 3 40 9 w.7; l 37 6 43 6 w.7',
  ancienttome: 'p 5 15.5 23 11 23 39 5 43 paper; p 25 11 43 15.5 43 43 25 39 paper; p 23 11 25 11 25 39 23 39 brown w.7; l 9 20 19.5 17.5 w.5; l 9 25 19.5 22.5 w.5; l 9 30 19.5 27.5 w.5; l 9 35 16 33.5 w.5; l 28.5 17.5 39 20 w.5; l 28.5 22.5 39 25 w.5; l 28.5 27.5 39 30 w.5; p 31 9.5 35 10.5 35 22 33 19.5 31 21.5 red w.6',
  dragonegg: 'use egg 0 0 1 gold; c 11 21.5 24 26 37 21.5 w.6; gear 24 31.5 6.6 4.6 7 iron w.7; d 24 31.5 1.3; d 17 14.5 1; d 24 12 1; d 31 14.5 1',
  hourglassages: 'p 14 9 34 9 34 14 26.5 24 34 34 34 39 14 39 14 34 21.5 24 14 14 white; p 17.5 14.5 30.5 14.5 25.5 21 22.5 21 violet k=- nh; p 16.5 38 31.5 38 27.5 33 24 30.5 20.5 33 violet k=- nh; l 24 24.5 24 30 k=purple w.6 nh; p 10.5 4.5 37.5 4.5 37.5 9.5 10.5 9.5 gold; p 10.5 38.5 37.5 38.5 37.5 43.5 10.5 43.5 gold; d 24 7 1.3 red; d 24 41 1.3 red',
  titanhammer: 'p 21 18 26 17.5 29.5 44 24.5 44.5 wood; p 5.5 7 40.5 3.5 42.5 18.5 7.5 22 steel; l 12 6.5 13.5 21.5 k=gold w.9 nh; l 34.5 4 36 19 k=gold w.9 nh; l 22 34 28 33.5 w.6',
  phoenix: 's 38.5 4.5 42 15.5 36 27.5 26 36.5 15.5 39.5 18.5 28.5 26.5 16.5 orange; s 35.5 10.5 36.5 18 31 26.5 23.5 32.5 26 24 30.5 17 gold w.6; l 8.5 45.5 38 8 w.9',
  kingsseal: 'p 18 27 11.5 44.5 17.5 41 21.5 45.5 25 30 blue; p 30 27 36.5 44.5 30.5 41 26.5 45.5 23 30 blue; s 24 5 31.5 7 37.5 12.5 39.5 20.5 36.5 28.5 29.5 33.5 21 33.5 13 29.5 8.5 21.5 10.5 12.5 16.5 7 red; e 24 19.5 9 9 - w.6; p 18.5 23.5 17.5 15.5 21.5 19 24 14 26.5 19 30.5 15.5 29.5 23.5 - w.7',
  stormbanner: 'use hang 0 0 1 blue; use bolt 13.5 9.5 .44 gold',
  wheat: 'l 24 44.5 24 8 w.9; c 24 38 16.5 34 12 38.5 w.7; sym e 19.2 13 2.7 5.2 rot-25 gold w.7; sym e 18.8 21.5 2.7 5.2 rot-25 gold w.7; sym e 18.8 30 2.7 5.2 rot-25 gold w.7; e 24 6.5 2.7 5 gold w.7',
  mirrorshard: 'p 20 3.5 34.5 9.5 41 26 28.5 44.5 13.5 36.5 9.5 18 sky; l 17 15 25 12.5 k=white w1 nh; l 15.5 23 30 16.5 k=white w1 nh; l 24.5 6 26.5 24 20.5 40 w.5',
  voidlantern: 'e 24 5.5 3 3 - w.9; p 15 9.5 33 9.5 30.5 15 17.5 15 dark; p 14 15 34 15 32 36.5 16 36.5 purple; s 24 18 29 24 28 31 24 33.5 20 31 19 24 violet w.6; p 12.5 36.5 35.5 36.5 37.5 41.5 10.5 41.5 dark',
  titanheart: 'use heartp 0 0 1 rose; l 24 17.5 24 31.5 k=white w1.6 nh; l 17 24.5 31 24.5 k=white w1.6 nh',
  thorncrown: 'e 24 25 16.5 9.5 - w1.3; e 24 28 16.5 9.5 - w.8; l 8.5 21.5 4.5 17 w.9; l 13.5 17 11.5 11.5 w.9; l 21 15.5 20 10 w.9; l 29.5 16 31.5 10.5 w.9; l 36.5 18.5 40.5 14 w.9; l 40.5 25 45.5 23.5 w.9; l 37.5 33 41.5 37 w.9; l 28.5 37 29.5 42.5 w.9; l 19 37 17 42.5 w.9; l 10.5 33 6.5 36.5 w.9; l 7.5 26.5 2.5 26.5 w.9',

  // Lords
  medal: 'use medal 0 0 1 gold; use starp 16.3 23.6 .32 ochre',
  moneybag: 'use bag 0 0 1 ochre; e 24 29.5 5.5 5.5 gold w.7; l 24 26.5 24 32.5 w.6',
  wizardhat: 's 23 3 29.5 17 35.5 33 12.5 33 17.5 17 purple; p 15 27.5 33 27.5 35 33 13 33 gold w.7; e 24 35.5 19.5 5.6 purple; use starp 16.5 10 .26 gold',
  goldgear: 'gear 24 24 18 13.4 8 gold; e 24 24 5.6 5.6 dark w.8',
  candle: 'p 19 22 29 22 29 41.5 19 41.5 white; s 24 7.5 28.5 13.5 27.5 19.5 24 21.5 20.5 19.5 19.5 13.5 gold; p 12.5 40 35.5 40 33.5 45 14.5 45 gold; l 24 21.5 24 24 w.7; sym l 14.5 11.5 9 8.5 w.7; sym l 12.5 17.5 6.5 17.5 w.7; l 24 1 24 4.5 w.7; l 21 28 21 34 w.5',
  wardenshield: 'use shieldp 0 0 1 blue; p 18.5 30 18.5 17 21 17 21 19.5 22.8 19.5 22.8 17 25.2 17 25.2 19.5 27 19.5 27 17 29.5 17 29.5 30 white w.6',
  bow: 's 13 4.5 22 8.5 30.5 16.5 34 24 30.5 31.5 22 39.5 13 43.5 15.5 40.5 23.5 34 28.5 27 29.8 24 28.5 21 23.5 14 15.5 7.5 wood; l 14 6 14 42 w.5; l 6 24 41 24 w1; p 45 24 37.5 20 37.5 28 iron w.7; l 6 24 3.5 20.5 w.7; l 6 24 3.5 27.5 w.7; l 9.5 24 7 20.5 w.7; l 9.5 24 7 27.5 w.7',
  dice: 'p 4.5 22 16 15 28 21.5 16.5 28.5 white; p 4.5 22 16.5 28.5 16.5 42.5 4.5 36 white; p 16.5 28.5 28 21.5 28 35.5 16.5 42.5 bone; d 16 21.5 1.5; d 8.5 29 1.3; d 12.5 36.5 1.3; d 22.5 32 1.3; p 26 9.5 38 6 43.5 16 31.5 20 white; p 31.5 20 43.5 16 43 29 31.5 33 bone; p 26 9.5 31.5 20 31.5 33 26.5 23 white; d 32 11.5 1.3; d 37.5 14.5 1.3; d 37.5 24 1.4',
  setsquare: 'p 7.5 41 41 41 7.5 9 wood; p 13.5 35.5 28 35.5 13.5 21.5 paper w.7; l 7.5 15 10.5 15 w.5; l 7.5 21 10.5 21 w.5; l 7.5 27 10.5 27 w.5; l 7.5 33 10.5 33 w.5; l 33 41 33 38 w.5; l 26 41 26 38 w.5; l 19 41 19 38 w.5; p 31.5 5.5 36 4 43 26.5 40.5 30.5 37.5 27.5 gold w.7',
  hoodskull: 's 24 2.5 37 9 42.5 27 38.5 43.5 9.5 43.5 5.5 27 11 9 purple; use skullp 6.5 9.5 .73',
  eye: 'use eye 0 2 1 violet; l 24 3 24 8 w.8; sym l 13 6 15.5 10.5 w.8; sym l 4.5 13 8.5 16 w.8',
  greatsword: 'use greatswordp',
  sprig: 'c 24 45 24.5 30 22 10 w1.1; s 22.5 12 17 9 14 3 20 4 23.5 9 leaf; s 23.5 18 30 14.5 37 15.5 32.5 21 25 21.5 leaf; s 23.5 24 16 21.5 9 23.5 14.5 28.5 22.5 27.5 leaf; s 24.5 31 31.5 28 38 30 33 35 25.5 34.5 leaf; s 24 37.5 17.5 35.5 11.5 38 17 42 23.5 41 leaf',
  rook: 'p 10 37 38 37 40 44 8 44 bone; p 12.5 7.5 18 7.5 18 12 21.5 12 21.5 7.5 26.5 7.5 26.5 12 30 12 30 7.5 35.5 7.5 35.5 17.5 32 20.5 32 37 16 37 16 20.5 12.5 17.5 bone; l 16 20.5 32 20.5 w.6; l 24 25 24 31 w1.2',
  swords: 'sym use swordp',

  // Abilities
  volley: 'use arrowdn -3 2; use arrowdn 8 -3; use arrowdn 19 3',
  mend: 'p 5 28 23 28 23 35.5 5 35.5 orange; p 25 28 43 28 43 35.5 25 35.5 orange; p 13.5 36.5 34.5 36.5 34.5 44 13.5 44 orange; p 9.5 13 27 6 26 21.5 iron; p 26.5 9.5 38.5 3.5 41 8 28.5 14.5 wood',
  rally: 'use hornp -4 4 .86; c 41.5 4.5 45.5 9 44.5 15 w.8; c 36 1 43 2.5 47 9 w.8',
  snow: 'use snowp',
  bountyhunt: 'e 24 24 12.5 12.5 gold; e 24 24 8 8 - w.6; e 24 24 18 18 - w.8; l 24 2.5 24 11 w1; l 24 37 24 45.5 w1; l 2.5 24 11 24 w1; l 37 24 45.5 24 w1',
  meteor: 's 21 23 29 10.5 44.5 3.5 38.5 14 43 18.5 33 24 30 31 orange; s 25.5 23 33 13 39.5 9 34.5 18 31.5 25.5 gold w.6; s 11 28 15.5 21.5 24 20.5 29.5 26 28.5 34.5 21 39 13.5 36 stone; d 18 28 1.3; d 23.5 32.5 1',
  beacon: 'l 13 44.5 35 44.5 w1.3; p 21.8 28 26.2 28 27.5 44 20.5 44 wood; use flamep 11.5 -1.5 .52 orange; p 11.5 19.5 36.5 19.5 31.5 28.5 16.5 28.5 steel',
  caltrops: 'p 24 4.5 27.5 27 20.5 27 iron; p 5 42.5 19.5 25 25.5 30.5 iron; p 43 42.5 28.5 25 22.5 30.5 iron; e 24 28 3.6 3.6 steel w.8; p 37 9 39 15.5 35 15.5 iron w.6; p 31.5 19 37 15 38.5 18.5 iron w.6; p 42.5 19 37 15 35.5 18.5 iron w.6',
  laststand: 'use shieldp 0 0 1 gold; p 18.5 30 18.5 17 21 17 21 19.5 22.8 19.5 22.8 17 25.2 17 25.2 19.5 27 19.5 27 17 29.5 17 29.5 30 white w.6; sym l 3 12 6.5 14 w.7; sym l 2 24 6 24 w.7',

  // Wave modifiers
  angry: 'use face 0 0 1 red',
  armoured: 'use shieldp 0 0 1 steel; l 24 8 24 41 w.7; d 15 14.5 1.3; d 33 14.5 1.3; d 14.5 24.5 1.3; d 33.5 24.5 1.3; d 19.5 33 1.3; d 28.5 33 1.3',
  giants: 's 16.5 44.5 12 26 15.5 11 26.5 5.5 37 11.5 39.5 26 37 44.5 olive; d 22.5 16.5 1.5; d 31 16.5 1.5; l 22 23.5 32 23.5 w.8; p 24.5 23.5 26 27 27.5 23.5 white w.5; e 7 36.5 2.8 2.8 pink w.7; l 7 39.5 7 45 w.8; l 4 42 10 42 w.7',
  swarm: 'use blob -4 -7.5 .5 olive; use blob 14 -9.5 .5 olive; use blob 5 4 .5 olive; use blob 21.5 5.5 .5 olive; use blob -5 15 .5 olive; use blob 11.5 17.5 .5 olive',
  moon: 'use moonp; p 35 13 36.2 16.3 39.5 17.5 36.2 18.7 35 22 33.8 18.7 30.5 17.5 33.8 16.3 white w.6; d 38 29 1.3 white',
  regen: 'use heartp 0 0 1 green; l 24 17.5 24 31.5 k=white w1.6 nh; l 17 24.5 31 24.5 k=white w1.6 nh',

  // Paths of ages
  sparkgem: 'use gem 1.9 5 .92 sky; l 6 3 6 11 w.7; l 2 7 10 7 w.7; l 41 1.5 41 7.5 w.7; l 38 4.5 44 4.5 w.7',
  industry: 'p 9 44.5 12.5 17 20.5 17 24 44.5 stone; l 11.8 23 21.2 23 w.6; s 16.5 15 12.5 10 16 4.5 22 6.5 26 3 30.5 7.5 28 13 22 12.5 white w.7; gear 33.5 33 10.5 7.6 7 iron; e 33.5 33 3.2 3.2 dark w.7',
  dragon: 's 11.5 44.5 11.5 31 15.5 21 23.5 14.5 33.5 13 42 17.5 44.5 24 38.5 28 30.5 28 28.5 32.5 31 44.5 green; p 20.5 16.5 12.5 7 25.5 13.5 bone w.7; p 26 13.5 21 3.5 31 12.5 bone w.7; p 12 31.5 6 29.5 12 26.5 green w.7; p 13 25 7.5 21.5 14.5 20 green w.7; p 12 38.5 6.5 37.5 11.8 34 green w.7; l 28.5 17 33.5 19 w1; d 32 20.8 1.5; d 41.5 21 .9; c 44 25 38.5 26 32.5 24.5 w.6; p 35.5 25.6 37 28.6 38.5 25.6 white w.5; p 39.5 25.4 40.9 27.9 42.2 25.2 white w.5; l 17 36 26 37 w.5; l 16 41 27.5 41.5 w.5',

  // Seasons and weather
  sprout: 's 8 44 13 39 24 37 35 39 40 44 brown; c 24 38 23.5 30 24 20 w1.1; s 24 27 15 24 8 15 17 14 23 20 leaf; s 24 22 31 18 39 9 30 9 24 15 leaf; l 12 17.5 21 23 w.5; l 35 11.5 27 17 w.5',
  sun: 'use sunp 0 0 1 gold',
  leaf: 's 25 5 33 11 38 22 35 33 25 41 15 34 11 23 16 12 orange; c 25 8 24 22 25 45 w.7; l 24.5 18 31 13 w.5; l 24.5 25 33 21 w.5; l 24.5 18 18 14 w.5; l 24.5 26 16 22 w.5; l 24.6 32 30 30 w.5',
  clear: 'use sunp -5 -5 .78 gold; use cloud 9 11 .7 white',
  rain: 'use cloud 0 -8 1 iron; l 15 30 12.5 37 k=blue; l 24 30 21.5 37 k=blue; l 33 30 30.5 37 k=blue; l 19.5 37.5 17.5 43.5 k=blue; l 28.5 37.5 26.5 43.5 k=blue',
  fog: 'use cloud 0 -10 1 white; c 6 29 13 26.5 20 29 27 31.5 34 29 42 27; c 9 35.5 16 33 23 35.5 30 38 38 35.5; c 12 42 19 39.5 26 42 32 44 36 42.5',
  gale: 'c 4 15 20 15 30 13.5 32.5 8.5 28 5.5 24 9; c 3 24 26 24 38 22.5 41.5 17 37.5 13.5 33 17; c 7 33 22 33 30 35 31 40 26.5 41.5 23.5 38',
  storm: 'use cloud 0 -9 1 steel; use bolt 10.5 17.5 .56 gold',
  heat: 'use sunp 4.8 -3 .8 orange; c 13.5 35 11 38.5 15.5 41 13 45 k=red w.9; c 23.5 35 21 38.5 25.5 41 23 45 k=red w.9; c 33.5 35 31 38.5 35.5 41 33 45 k=red w.9',
  snowfall: 'use cloud 0 -9 1 white; l 14 32.5 14 39.5 w.6; l 11 34.3 17 37.7 w.6; l 17 34.3 11 37.7 w.6; l 24 36.5 24 43.5 w.6; l 21 38.3 27 41.7 w.6; l 27 38.3 21 41.7 w.6; l 34 32.5 34 39.5 w.6; l 31 34.3 37 37.7 w.6; l 37 34.3 31 37.7 w.6',
  blizzard: 'c 4 12 20 12 30 10.5 32.5 5.5 28 2.5 24 6; c 3 23 26 23 38 21.5 41.5 16 37.5 12.5 33 16; l 10 29.5 10 36.5 w.6; l 7 31.3 13 34.7 w.6; l 13 31.3 7 34.7 w.6; l 23 33.5 23 40.5 w.6; l 20 35.3 26 38.7 w.6; l 26 35.3 20 38.7 w.6; l 36 29.5 36 36.5 w.6; l 33 31.3 39 34.7 w.6; l 39 31.3 33 34.7 w.6; l 14 40.5 14 45.5 w.6; l 11.8 41.8 16.2 44.2 w.6; l 16.2 41.8 11.8 44.2 w.6; l 32 40.5 32 45.5 w.6; l 29.8 41.8 34.2 44.2 w.6; l 34.2 41.8 29.8 44.2 w.6',

  // The horde's mutations
  swell: 'use blob -4.9 1.9 .62 olive; use blob 23.1 1.9 .62 olive; use blob 3.4 5.6 .86 olive; l 24 1.5 24 9.5 w1.2; l 20 5.5 28 5.5 w1.2',
  warcry: 'use skullp -3 5 .8; c 37.5 14 41.5 21 38.5 29 w.8; c 41.5 9.5 46.5 21 42.5 33.5 w.8',
  frenzy: 'e 21 31 7.5 6.5 red; e 12.5 20.5 2.8 4.2 rot-20 red w.7; e 21 17 2.8 4.6 red w.7; e 29.5 20.5 2.8 4.2 rot20 red w.7; l 33.5 27 44.5 27 w.9; l 35.5 33 46 33 w.9; l 32.5 39 42.5 39 w.9',
  champions: 'p 16.5 11 15.5 2.5 20 6.5 24 1 28 6.5 32.5 2.5 31.5 11 gold w.7; use face 1.9 5.5 .92 olive',
  escort: 'p 16.5 13.5 15.5 4.5 20.5 8.5 24 3 27.5 8.5 32.5 4.5 31.5 13.5 gold w.7; use shieldp -4.5 14 .6 steel; use shieldp 23.7 14 .6 steel',
  runestone: 's 15.5 44.5 12.5 21 17.5 8 28.5 5.5 34.5 16 33.5 44.5 stone; l 21.5 16 21.5 35 k=blue w1.2 nh; l 21.5 16 28 21.5 21.5 26.5 k=blue w1.2 nh; l 21.5 26.5 29 35 k=blue w1.2 nh; l 9 44.5 39 44.5 w1.1',
  hide: 's 24 6 30 10 40.5 7.5 37.5 18 42.5 26 36.5 30 38.5 42.5 28.5 38 24 42.5 19.5 38 9.5 42.5 11.5 30 5.5 26 10.5 18 7.5 7.5 18 10 brown; l 24 12 24 36 w.5; l 20.5 16 27.5 16 w.5; l 20.5 22 27.5 22 w.5; l 20.5 28 27.5 28 w.5',
  shell: 's 5.5 34.5 7.5 20.5 17.5 10 30.5 10 40.5 20.5 42.5 34.5 teal; l 3.5 34.5 44.5 34.5 w1.2; p 18.5 15 29.5 15 33.5 22.5 28.5 29.5 19.5 29.5 14.5 22.5 - w.6; l 18.5 15 15 11 w.6; l 29.5 15 33 11 w.6; l 33.5 22.5 41 22 w.6; l 14.5 22.5 7 22 w.6; l 19.5 29.5 17 34.5 w.6; l 28.5 29.5 31 34.5 w.6',
  ram: 'l 5.5 13.5 5.5 37 w1.2; p 5.5 19.5 34 17.5 34 28 5.5 30 wood; l 14 19 14 29.5 w.6; l 24 18.2 24 28.8 w.6; s 33.5 15.5 41.5 18.5 44.5 23 41.5 27.5 33.5 30 iron; e 13.5 36.5 5.4 5.4 dark; e 29 36.5 5.4 5.4 dark; d 13.5 36.5 1.2 bone; d 29 36.5 1.2 bone',
  slashes: 'p 9.5 8 14 5.5 22.5 40 18 42.5 red; p 19.5 6 24 3.5 32.5 38 28 40.5 red; p 29.5 8 34 5.5 41.5 35 37 37.5 red',
  breastplate: 's 12 7.5 20 11.5 28 11.5 36 7.5 40.5 16 36.5 22 36.5 38.5 24 43.5 11.5 38.5 11.5 22 7.5 16 steel; l 24 12 24 43 w.6; c 12.5 26.5 24 30.5 35.5 26.5 w.6; c 12.5 33.5 24 37.5 35.5 33.5 w.6',
  rage: 'use face 2.4 6.5 .9 crimson; c 21 6.5 19 4 22 1.5 w.8; c 27 6.5 29 4 26 1.5 w.8',
  hatchling: 'e 24 21.5 7.5 7 olive; d 21 20 1.3; d 27 20 1.3; p 10 28 16.5 31.5 20 27 24 31.5 28 27 31.5 31.5 38 28 36.5 38 30 43.5 18 43.5 11.5 38 bone; p 31.5 8 39.5 5.5 42 13.5 36 13 bone w.7',
  burst: 'p 24 3 28 14 38.5 6.5 34.5 18 45.5 20 35.5 26 42.5 36.5 31 32.5 28 44.5 22 33.5 11.5 40.5 15 29 3.5 26 14 20 7.5 8.5 19 14 orange; p 24 13.5 26.5 19.5 32.5 16.5 30 23 35.5 25.5 29.5 27.5 31 33.5 24.5 30 19.5 34 19.5 27.5 13.5 25.5 18.5 21.5 16 15.5 21.5 18.5 gold w.6',
  burrow: 's 5.5 31 9.5 24 20 20 30.5 20 40.5 25 43.5 32 38.5 38 26 40.5 12 38.5 brown; e 24 30.5 13.5 6 ink; p 18.5 29.5 20.5 21.5 23.5 29.5 bone w.6; p 25 29.5 27.5 21.5 30 29.5 bone w.6; d 9 16 1.4 brown; d 38 14.5 1.6 brown; d 31 10 1.1 brown',
  twin: 'use crownp -1 -2 .6 purple; use crownp 19.5 13 .6 gold',
  undying: 'use skullp; d 17.6 21 2 leaf; d 30.4 21 2 leaf; sym l 4 5 8 9 w.7; sym l 8 5 4 9 w.7',
  bat: 'sym s 20.5 24 12.5 13.5 3.5 13.5 6 21.5 3.5 28.5 11 27.5 14 32.5 19.5 29.5 violet; e 24 26 5 6.8 purple; p 20.5 20.5 20 15.5 23 19 purple w.7; p 27.5 20.5 28 15.5 25 19 purple w.7; d 22.2 24.5 1 white; d 25.8 24.5 1 white',
  raids: 'use moonp -2 -2 .8; use swordp 18 16 .6',
  ghost: 's 24 4 34 8 39 20 40 42.5 34.5 38.5 29.5 43 24 38.5 18.5 43 13.5 38.5 8 42.5 9 20 14 8 white; e 18.5 20 2.8 4 ink; e 29.5 20 2.8 4 ink; e 24 29.5 3 4 ink',
  plunder: 'e 26 9.5 7.5 7.5 gold; e 26 9.5 4 4 - w.6; use hand 2 10 .78 olive',
  nazar: 'e 24 5 2.6 2.6 - w.8; e 24 25.5 16.5 16.5 blue; e 24 25.5 10.5 10.5 white w.7; e 24 25.5 6.2 6.2 sky w.7; e 24 25.5 2.8 2.8 ink',
  venom: 'use drop 0 0 1 leaf; d 20.5 26.5 1.7; d 27.5 26.5 1.7; l 21.5 33 26.5 33 w.8',

  // What comes with a mutation
  coins: 'use coins',
  levelup: 'use starp 3.3 8 .82 gold; l 40.5 3 40.5 11 w1.1; l 36.5 7 44.5 7 w1.1',
  chest: 'use chest',
  statup: 'p 6.5 34 14.5 34 14.5 42.5 6.5 42.5 sky; p 18.5 26.5 26.5 26.5 26.5 42.5 18.5 42.5 sky; p 30.5 17.5 38.5 17.5 38.5 42.5 30.5 42.5 sky; l 7 23 19 13 27.5 17 39.5 5.5 w1.1; p 41.5 3.5 33.5 4.5 40.5 11.5 red w.6',
  chevrons: 'p 8 21.5 24 9.5 40 21.5 40 28 24 16 8 28 gold; p 8 33.5 24 21.5 40 33.5 40 40 24 28 8 40 gold',
  key: 'p 19.5 18 22 15.5 40 33.5 37.5 36 gold; p 31 32.5 35 28.5 37.2 30.7 33.2 34.7 gold; p 36 37.5 40 33.5 42.2 35.7 38.2 39.7 gold; e 14 14 8 8 gold; e 14 14 3 3 ink',

  // Buildings
  forge: 'use anvil 0 3; use hammer 12 -1.5 .55 iron; l 8 8 4 4.5 w.7; l 5 13 1 12 w.7',
  tent: 'l 24 9 24 3.5 w.9; p 24 3.5 31.5 5.8 24 8.5 red w.6; p 5.5 41 24 8.5 42.5 41 bone; p 18.5 41 24 25 29.5 41 dark; l 24 8.5 24 25 w.5; l 3 41 45 41 w1',
  chapel: 'l 24 2.5 24 12 w1.2; l 20.3 5.8 27.7 5.8 w1.2; p 11.5 44.5 11.5 24 36.5 24 36.5 44.5 white; p 8 25 24 11.5 40 25 red; s 20 44.5 20 35.5 24 31.5 28 35.5 28 44.5 brown; e 24 20.5 2.4 2.4 sky w.6',
  market: 'l 8.5 20 8.5 44.5 w1.2; l 39.5 20 39.5 44.5 w1.2; p 6.5 32 41.5 32 41.5 37.5 6.5 37.5 wood; e 15.5 28.5 3.2 3.2 orange w.6; e 24 28.5 3.2 3.2 leaf w.6; e 32.5 28.5 3.2 3.2 gold w.6; p 5.5 20.5 9.5 7.5 38.5 7.5 42.5 20.5 red; p 13.5 7.5 19.5 7.5 18.5 20.5 11.5 20.5 white w.6; p 25.5 7.5 31.5 7.5 33.5 20.5 26.5 20.5 white w.6',
  masonblock: 'p 5.5 27 29.5 27 29.5 43 5.5 43 stone; p 5.5 27 11.5 20.5 35.5 20.5 29.5 27 stone; p 29.5 27 35.5 20.5 35.5 36.5 29.5 43 stone; p 29.5 6 33.5 8 25.5 21 21.5 19 iron w.7; p 33.5 1.5 44 5.5 42 12 31.5 8 wood w.8',
  workbench: 'l 8.5 31 8.5 44.5 w1.3; l 39.5 31 39.5 44.5 w1.3; l 8.5 38.5 39.5 38.5 w.7; p 4.5 26 43.5 26 43.5 31.5 4.5 31.5 wood; gear 15.5 17.5 7.6 5.4 7 iron w.7; d 15.5 17.5 1.3; use hammer 21 3 .5 iron',
  books: 'p 7.5 34.5 40.5 34.5 40.5 43 7.5 43 blue; p 34 36.3 40.5 36.3 40.5 41.2 34 41.2 paper w.6; p 9.5 26 37.5 26 37.5 34.5 9.5 34.5 red; p 31 27.8 37.5 27.8 37.5 32.7 31 32.7 paper w.6; p 11.5 17.5 39.5 17.5 39.5 26 11.5 26 green; p 33 19.3 39.5 19.3 39.5 24.2 33 24.2 paper w.6; p 17 17.5 21 4.5 27.5 6.5 23.5 17.5 gold w.8',
  watchtower: 'l 24 10 24 2 w.9; p 24 2 31.5 4.2 24 6.8 red w.6; use tower 1.2 2.4 .95',
  mint: 'p 17.5 3 30.5 3 30.5 19 17.5 19 steel; l 17.5 8 30.5 8 w.6; e 24 36 14.5 6 ochre; e 24 32 14.5 6 gold; e 24 32 8.5 2.8 - w.5; l 9 22 5.5 19 w.7; l 39 22 42.5 19 w.7; l 7 27 3 27 w.7; l 41 27 45 27 w.7',
  mug: 'use mug 0 0 1 wood',

  // Doctrines
  twinarrows: 'use arrowp -4 -3 .85; use arrowp 8 9 .85',
  orb: 'e 24 25 12.5 12.5 violet; c 16.5 21 18 16.5 22.5 15 k=white w.9 nh; l 24 2.5 22 6.5 26 7.5 24 11 w.8; l 44.5 15 40 15.5 41 19.5 37 20 w.8; l 3.5 15 8 15.5 7 19.5 11 20 w.8; l 40 41 37 37.5 34.5 40 32.5 36 w.8; l 8 41 11 37.5 13.5 40 15.5 36 w.8',
  wildfire: 'use flamep -5 15 .62 orange; use flamep 23 15 .62 orange; use flamep 0 -1 1 red',
  grail: 'l 24 1.5 24 6.5 w.8; sym l 14.5 3.5 16.5 8 w.8; s 12 10.5 36 10.5 34 22 28.5 28.5 19.5 28.5 14 22 gold; p 21.8 28.5 26.2 28.5 26.2 37 21.8 37 gold; p 14.5 37 33.5 37 35.5 42.5 12.5 42.5 ochre; l 13.5 15.5 34.5 15.5 w.6',
  shieldwall: 'use shieldp -5 8 .72 steel; use shieldp 18.5 8 .72 steel; use shieldp 4.8 3 .8 blue; l 24 9.5 24 36 w.6',
  clock: 'gear 24 24 19.5 15.5 10 gold; e 24 24 12 12 white w.7; l 24 24 24 15.5 w1; l 24 24 30.5 27.5 w1; d 24 24 1.6',
  wareconomy: 'use greatswordp -8 -2 .8; use coins 9 8 .8',
  helmet: 's 24 6.5 20 1.5 28.5 0.5 34.5 3.5 30 5.5 red w.7; s 10 30 10 18 16 9 24 6 32 9 38 18 38 30 iron; p 7.5 28 40.5 28 40.5 32.5 7.5 32.5 steel; p 22 19.5 26 19.5 26 35.5 22 35.5 iron w.7; d 14 23 1.1; d 34 23 1.1',
  moat: 'p 9.5 7.5 15.5 7.5 15.5 11.5 21 11.5 21 7.5 27 7.5 27 11.5 32.5 11.5 32.5 7.5 38.5 7.5 38.5 24 9.5 24 stone; l 9.5 16 38.5 16 w.5; s 3.5 27.5 10 23.5 16.5 27.5 23 23.5 29.5 27.5 36 23.5 44.5 27 44.5 44 3.5 44 blue; c 8 34.5 14 31.5 20 34.5 26 31.5 32 34.5 38 31.5 k=white w.9 nh; c 12 40.5 18 37.5 24 40.5 30 37.5 36 40.5 k=white w.9 nh',
  treasury: 'p 7 11 41 11 43 22.5 5 22.5 brown; s 7.5 24 13 16.5 24 13.5 35 16.5 40.5 24 gold; d 16 20 1.1 ochre; d 24 17.5 1.1 ochre; d 31.5 20.5 1.1 ochre; p 5.5 23 42.5 23 42.5 42 5.5 42 wood; l 13.5 23 13.5 42 w.6; l 34.5 23 34.5 42 w.6; p 20.5 27 27.5 27 27.5 35 20.5 35 gold w.8; d 24 31 1.2',
  blooddrop: 'use drop 0 0 1 red; c 17.5 26 18 31.5 21.5 35 k=pink w.9 nh; use drop 30.5 -1 .3 red; use drop 2.5 22 .28 red',
  shootingstar: 'l 5 43 16 32 w.9; l 4 34 11 27.5 w.7; l 13.5 44 20 37.5 w.7; use starp 9.5 -1 .78 gold',
  mountain: 'l 18 14.5 18 4.5 w.9; p 18 4.5 26.5 7 18 9.8 red w.6; p 3.5 42.5 18 14 26 26.5 32 18 44.5 42.5 stone; p 18 14 22 22.5 18.3 20.5 14.8 23.5 white w.6; p 32 18 35.5 25.5 32 23.8 29.3 26 white w.6',

  // Events
  wagon: 's 8 28 9 16 18 9 30 9 39 16 40 28 paper; c 16 28 16.5 14 20 9.5 w.5; c 24 28 24 9 w.5; c 32 28 31.5 14 28 9.5 w.5; p 5.5 28 42.5 28 40.5 34.5 7.5 34.5 wood; e 14 38.5 5.6 5.6 dark; e 34 38.5 5.6 5.6 dark; d 14 38.5 1.3 bone; d 34 38.5 1.3 bone',
  whiteflag: 'l 11.5 5 15.5 45.5 w1.3; s 12.5 8 22 6 31 10.5 40 8.5 41.5 25 32.5 27.5 23.5 23 14.5 25.5 white',
  sick: 'e 23 25 15.5 15.5 leaf; c 13.5 21.5 16.5 19.5 19.5 21.5 w.9; c 25.5 21.5 28.5 19.5 31.5 21.5 w.9; c 15.5 33 18.5 30.5 22.5 33 26.5 30.5 30 33 w.9; p 29 30.5 43.5 41 41.5 44 27.5 33.5 white w.7; d 42.5 42.5 2 red; s 36 9 38.5 13.5 36 16.5 33.5 13.5 sky w.6',
  shrine: 'p 9.5 43 11.5 18.5 36.5 18.5 38.5 43 stone; p 5.5 19 24 6 42.5 19 steel; s 18 43 18 28.5 24 23.5 30 28.5 30 43 dark; p 22.8 34 25.2 34 25.2 41 22.8 41 white w.6; s 24 28.5 26 31.5 24 34 22 31.5 gold w.6',
  refugees: 'use person -8.5 2 .78 blue; use person 14.5 2 .78 red; use person 11.5 20 .52 gold',
  nestegg: 'use egg 4.8 -1 .8 bone; d 21 14 1.5 ochre; d 28 20 1.2 ochre; d 20.5 24 1.1 ochre; s 5.5 33 9.5 27.5 38.5 27.5 42.5 33 36.5 42.5 11.5 42.5 wood; l 9 31.5 16 35.5 w.5; l 20 30 27 36 w.5; l 31 31 38 35 w.5; l 13 39 22 37 w.5; l 27 40 35 38 w.5',
  bunting: 'c 3.5 8.5 24 17 44.5 8.5 w.8; p 7.5 10.5 13.5 12.8 9.8 20.5 red w.6; p 16 13.5 22 15 18.5 23 gold w.6; p 26 15 32 13.5 29.5 23 blue w.6; p 34.5 12.8 40.5 10.5 38.2 20.5 green w.6; use mug 9.5 16.5 .62 wood',

  // Achievements
  tower: 'use tower',
  tenwaves: 'use hang 0 0 1 blue; l 18.5 14.5 29.5 27.5 k=white w1.3 nh; l 29.5 14.5 18.5 27.5 k=white w1.3 nh',
  twentywaves: 'use hang 0 0 1 red; l 15 15 21.5 27 k=white w1.2 nh; l 21.5 15 15 27 k=white w1.2 nh; l 26.5 15 33 27 k=white w1.2 nh; l 33 15 26.5 27 k=white w1.2 nh',
  trophy: 'c 13.5 10.5 5.5 11 6.5 19.5 14.5 21.5 w1.1; c 34.5 10.5 42.5 11 41.5 19.5 33.5 21.5 w1.1; s 12.5 7.5 35.5 7.5 34 20 29 27.5 19 27.5 14 20 gold; p 21.8 27.5 26.2 27.5 27.2 35.5 20.8 35.5 gold; p 13.5 35.5 34.5 35.5 36.5 42.5 11.5 42.5 ochre; l 18 12 18.8 18 w.6',
  cave: 's 7.5 43 7.5 22 15.5 9.5 32.5 9.5 40.5 22 40.5 43 stone; s 14 43 14 24 20 16 28 16 34 24 34 43 ink; d 20.5 30 1.5 gold; d 27.5 30 1.5 gold',
  twowinters: 'use snowp -2 -3 .6; use snowp 20.5 17.5 .6',
  wreath: 'sym c 22.5 43 10.5 35.5 7 22 13.5 8 w1; sym e 16.5 38.5 2.6 4.8 rot-55 leaf w.6; sym e 10.5 31.5 2.6 4.8 rot-25 leaf w.6; sym e 8 23 2.6 4.8 leaf w.6; sym e 9.5 14.5 2.6 4.8 rot25 leaf w.6; use starp 12.5 12 .48 gold',
  stonewall: 'use brick 0 0 1 stone',
  anvil: 'use anvil 0 2',
  signpost: 'l 24 11 24 45 w1.4; p 24 6.5 39.5 6.5 44 11 39.5 15.5 24 15.5 wood; p 24 18.5 8.5 18.5 4 23 8.5 27.5 24 27.5 wood; p 24 30.5 37.5 30.5 42 34.5 37.5 38.5 24 38.5 wood',
  temple: 'p 5.5 16.5 24 4.5 42.5 16.5 white; p 8.5 18 14 18 14 38 8.5 38 white; p 21.2 18 26.8 18 26.8 38 21.2 38 white; p 34 18 39.5 18 39.5 38 34 38 white; p 4.5 38 43.5 38 43.5 43.5 4.5 43.5 stone; l 5.5 17 42.5 17 w1.1',
  stairs: 'p 5.5 43 5.5 34.5 15.5 34.5 15.5 26.5 25.5 26.5 25.5 18.5 35.5 18.5 35.5 43 stone; use starp 26.5 -1 .4 gold',
  bronze: 'use medal 0 0 1 orange',
  silver: 'use medal 0 0 1 iron',
  goldmedal: 'use medal 0 0 1 gold',
  rosette: 'p 17 29 12.5 44.5 18.5 40.5 22.5 45 24.5 32 purple; p 31 29 35.5 44.5 29.5 40.5 25.5 45 23.5 32 purple; gear 24 20 15.5 12.5 12 purple; e 24 20 8.5 8.5 gold; use starp 17.3 13.8 .28 ochre',
  diamond: 'use gem 0 2 1 sky; l 4 5 8 9 w.7; l 8 5 4 9 w.7; l 40 37 44 41 w.7; l 44 37 40 41 w.7',
  goldstar: 'use starp 0 1 1 gold; sym l 6 6 9.5 9.5 w.7; l 24 43 24 46.5 w.7',
  house: 'use housep',
  diploma: 'p 8.5 16 39.5 12 40.5 30.5 9.5 34.5 paper; e 8.8 25.2 2.6 9.3 bone w.7; e 40.2 21.2 2.6 9.3 bone w.7; l 14.5 21 33.5 18.5 w.5; l 15 26.5 34 24 w.5; p 22 27.5 19.5 37.5 24 34.5 28.5 37.5 26 27.5 red w.6; e 24 26.5 4.2 4.2 red w.7',
  cannon: 'p 7.5 22.5 37.5 13.5 41 22 10.5 31.5 steel; l 33.5 14.8 36.8 23.2 w.7; e 39.8 17.6 2.2 4.6 rot-17 dark w.7; e 19.5 34.5 8.5 8.5 wood; d 19.5 34.5 1.6; l 19.5 26 19.5 43 w.6; l 11 34.5 28 34.5 w.6; e 37 40.5 3.6 3.6 dark w.8; e 43 34.5 3 3 dark w.8',
  village: 'use housep -1 -2 .55; use housep 22.5 -2 .55; use housep 8.6 14 .64',
  skulls: 'use skullp -0.2 17 .55; use skullp 21.8 17 .55; use skullp 9.1 1.5 .62',
  mutant: 's 9.5 41 7.5 24 13.5 11.5 26 7.5 36.5 13.5 40.5 28 36.5 41 leaf; e 17.5 20 3.3 3.3 white w.6; e 28 17.5 4 4 white w.6; e 31.5 28 2.6 2.6 white w.6; d 17.5 20.5 1.2; d 28.5 18 1.4; d 31.5 28.3 1; p 14.5 33.5 17.5 31 20.5 34.5 23.5 31 26.5 34.5 23.5 37.5 20.5 34.8 17.5 37.5 white w.6; c 9.5 30 4.5 28 4 22.5 w1.1; c 38.5 20 43.5 17 43 11.5 w1.1',
  pennants: 'l 9.5 44.5 9.5 10 w1.1; p 9.5 10 21.5 13.2 9.5 17 red w.7; l 24 44.5 24 4.5 w1.1; p 24 4.5 37.5 8.5 24 12.8 blue w.7; l 38 44.5 38 14 w1.1; p 38 14 46 16.6 38 20 gold w.7',
  bread: 's 5.5 30 7.5 20 16 13.5 32 13.5 40.5 20 42.5 30 38.5 38.5 9.5 38.5 ochre; c 14 19.5 17 26 16 32.5 w.8; c 22 17.5 25 25 24 33.5 w.8; c 30 19.5 33 26 32 32.5 w.8',
};

// Plain glyphs that sit in a line of text and take its colour.
const GLYPHS = {
  check: 'c 9 26 19 37 39 11 w1.6',
  ring: 'e 24 24 13 13 - w1.3',
  up: 'l 24 41 24 9 w1.6; l 11 21 24 8 37 21 w1.6',
  swap: 'l 8 16.5 39 16.5 w1.4; l 31.5 9.5 39.5 16.5 31.5 23.5 w1.4; l 40 31.5 9 31.5 w1.4; l 16.5 24.5 8.5 31.5 16.5 38.5 w1.4',
  what: 'c 14.5 16 16 8 24 6 32 9 32.5 17 25.5 22.5 24 30 w1.6; d 24 39.5 2.4',
  pause: 'p 12.5 9.5 20 9.5 20 38.5 12.5 38.5 ink; p 28 9.5 35.5 9.5 35.5 38.5 28 38.5 ink',
  left: 'p 33 8 12 24 33 40 ink',
  right: 'p 15 8 36 24 15 40 ink',
  cog: 'gear 24 24 18.5 13.8 8 - w1.3; e 24 24 5.2 5.2 - w1.3',
  locked: 'c 15.5 22 15.5 8 32.5 8 32.5 22 w1.6; p 10.5 21.5 37.5 21.5 37.5 42.5 10.5 42.5 ink',
  dmg: 'l 10.5 37.5 36.5 11.5 w1.7; l 36.5 11.5 41 7 w1.7; l 9.5 30.5 17.5 38.5 w1.6; l 6.5 41.5 10.5 37.5 w1.7',
  spd: 'e 24 27.5 14.5 14.5 - w1.3; l 24 27.5 24 18.5 w1.4; l 24 27.5 30.5 30.5 w1.4; l 19.5 7.5 28.5 7.5 w1.6',
  rng: 'e 24 24 17.5 17.5 - w1.3; e 24 24 9.5 9.5 - w1.3; d 24 24 2.8',
  heal: 'p 19 7.5 29 7.5 29 19 40.5 19 40.5 29 29 29 29 40.5 19 40.5 19 29 7.5 29 7.5 19 19 19 ink',
  hp: 's 24 41 11 29.5 6.5 19 10.5 10.5 18 9 24 15.5 30 9 37.5 10.5 41.5 19 37 29.5 ink',
  kill: 's 24 5.5 35 8.5 39.5 19.5 36.5 29 31 31.5 31 38 17 38 17 31.5 11.5 29 8.5 19.5 13 8.5 - w1.3; d 18 21 3.2; d 30 21 3.2',
  xp: 'p 24 5 29.3 17.6 42.8 18.8 32.4 27.8 35.7 41 24 33.8 12.3 41 15.6 27.8 5.2 18.8 18.7 17.6 ink',
  move: 'l 24 6.5 24 41.5 w1.4; l 6.5 24 41.5 24 w1.4; l 18.5 12 24 6 29.5 12 w1.4; l 18.5 36 24 42 29.5 36 w1.4; l 12 18.5 6 24 12 29.5 w1.4; l 36 18.5 42 24 36 29.5 w1.4',
};

export const PICTURES = [...Object.keys(PICS), ...Object.keys(GLYPHS)];
const KNOWN = new Set(PICTURES);

// The picture called name, as markup. It takes its size from the text around it.
// A name nobody drew is a mistake in the tables, so it fails at once instead of showing nothing.
export const icon = (name, cls = '') => {
  if (!KNOWN.has(name)) throw new Error(`no picture called "${name}"`);
  return `<svg class="ico${cls ? ` ${cls}` : ''}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
};

// All the pictures as one hidden sheet of symbols at the top of the page; icon() points into it.
export function sheet() {
  const sym = (name, src, mono) => `<symbol id="i-${name}" viewBox="0 0 48 48">${draw(name, src, PARTS, mono)}</symbol>`;
  // The rules name no ancestor: inside a <use> the copied strokes do not sit under the sheet.
  return `<svg id="pictures" width="0" height="0" style="position:absolute" aria-hidden="true"><style>
.pk{fill:none;stroke:var(--pen,${PAINT.ink});stroke-width:var(--sw,2.4px);stroke-linecap:round;stroke-linejoin:round}
.pe{fill:var(--edge,${PAINT.paper});stroke:var(--edge,${PAINT.paper});stroke-width:calc(var(--sw,2.4px) + 3.4px);stroke-linecap:round;stroke-linejoin:round}
.pe.o{fill:none}
.pm{fill:none;stroke:currentColor;stroke-width:var(--sw,2.4px);stroke-linecap:round;stroke-linejoin:round}
.pm.f{fill:currentColor}
</style>${Object.entries(PICS).map(([k, v]) => sym(k, v, false)).join('')}${Object.entries(GLYPHS).map(([k, v]) => sym(k, v, true)).join('')}</svg>`;
}
if (typeof document !== 'undefined' && !document.getElementById('pictures')) document.body.insertAdjacentHTML('afterbegin', sheet());
