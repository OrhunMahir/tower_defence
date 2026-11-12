// Pure game simulation: no network and no timers. step(dt) advances the world,
// snapshot() returns what clients need to draw it. The server owns all rules.
//
// Players are commanders, not characters: between waves they pick one of two
// offered waves, recruit defenders for the walls and upgrade the castle with
// shared gold. Battles play out on their own.

export const TICK = 1 / 20;
export const S = 14;            // half-size of the castle square
const SEG = 4;                  // wall segment length
const WALL_T = 0.7;             // wall half-thickness
const TH_HALF = 3.5;            // keep half-size
const TOWER_R = 2.1;
const OVER_TIME = 8;
const START_GOLD = 100;

export const ENEMIES = [
  { name: 'runner', hp: 30, speed: 4.4, dmg: 6, r: 0.6, gold: 4, wallMul: 1, points: 1 },
  { name: 'brute', hp: 150, speed: 2.3, dmg: 16, r: 1.0, gold: 15, wallMul: 2.5, points: 4 },
  { name: 'queen', hp: 1800, speed: 1.6, dmg: 45, r: 2.4, gold: 250, wallMul: 3, points: 0 },
];

// Defenders. `kind` is the projectile look; melee units strike directly.
export const UNITS = {
  archer: { cost: 30, dmg: 10, cd: 1.4, range: 19, kind: 2, speed: 40 },
  spear: { cost: 25, dmg: 18, cd: 1.0, range: 4.5, melee: true },
  mage: { cost: 70, dmg: 14, cd: 2.4, range: 17, kind: 1, speed: 24, aoe: 3 },
  crossbow: { cost: 85, dmg: 55, cd: 3.0, range: 25, kind: 4, speed: 55, tough: true },
};
export const UNIT_KEYS = Object.keys(UNITS);
const COST_GROWTH = 1.08;
// PROMOTE[tier] is the price of raising every unit of one type from that tier to the next.
// Tier t+1 needs barracks level t. Each tier adds 35% damage.
export const PROMOTE = [0, 120, 260, 520, 1000];       // each unit of a type makes the next one this much dearer

// cost[level] is the price of going from that level to the next one.
export const BUILDINGS = {
  hall: { start: 1, max: 5, cost: [0, 100, 250, 500, 900] },
  walls: { start: 1, max: 5, cost: [0, 60, 150, 300, 550] },
  barracks: { start: 1, max: 5, cost: [0, 80, 200, 400, 700] },
  mine: { start: 0, max: 5, cost: [80, 120, 220, 380, 600] },
};
export const CAPACITY = [0, 10, 16, 22, 28, 32];   // defenders the walls can hold, by wall level
const SPOTS = { mine: { x: 8.5, z: -7, hw: 2, hd: 2 } };
// One of three random perks is offered each time the keep is upgraded. Perks stack.
export const PERKS = ['mortar', 'ballista', 'happy', 'sharp', 'rapid', 'masons'];
const MORTAR_R = 3.5;
const REPAIR_HP_PER_GOLD = 20;
const thMax = (l) => 1500 + 600 * (l - 1);
const wallMul = (l) => 1 + 0.5 * (l - 1);

const TOWERS = [[-S, -S], [S, -S], [-S, S], [S, S]];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const r2 = (v) => Math.round(v * 100) / 100;

function buildSegs() {
  const segs = [];
  for (let c = -S + SEG / 2; c < S; c += SEG) {
    segs.push({ x: c, z: -S, hw: SEG / 2, hd: WALL_T });
    segs.push({ x: c, z: S, hw: SEG / 2, hd: WALL_T, gate: c === 0 });
    segs.push({ x: -S, z: c, hw: WALL_T, hd: SEG / 2 });
    segs.push({ x: S, z: c, hw: WALL_T, hd: SEG / 2 });
  }
  for (const s of segs) { s.gate = !!s.gate; s.base = s.gate ? 600 : 400; s.max = s.base; s.hp = s.max; }
  return segs;
}

// Pushes circle e (radius r) out of an axis-aligned box. Returns true on contact.
function pushOutBox(e, r, bx, bz, hw, hd) {
  const cx = clamp(e.x, bx - hw, bx + hw), cz = clamp(e.z, bz - hd, bz + hd);
  const dx = e.x - cx, dz = e.z - cz, d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return false;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    e.x = cx + (dx / d) * r; e.z = cz + (dz / d) * r;
  } else {
    const px = hw + r - Math.abs(e.x - bx), pz = hd + r - Math.abs(e.z - bz);
    if (px < pz) e.x = bx + (e.x >= bx ? 1 : -1) * (hw + r);
    else e.z = bz + (e.z >= bz ? 1 : -1) * (hd + r);
  }
  return true;
}

function pushOutCircle(e, r, cx, cz, cr) {
  const dx = e.x - cx, dz = e.z - cz, d = Math.hypot(dx, dz), min = r + cr;
  if (d >= min) return false;
  if (d < 1e-6) { e.x = cx + min; return true; }
  e.x = cx + (dx / d) * min; e.z = cz + (dz / d) * min;
  return true;
}

export class Game {
  constructor(rng = Math.random) {
    this.rng = rng;
    this.players = new Set();
    this.nextId = 1;
    this.reset();
  }

  reset() {
    this.wave = 0;
    this.phase = 'prep';
    this.timer = 0;
    this.gold = START_GOLD;
    this.b = Object.fromEntries(Object.entries(BUILDINGS).map(([k, d]) => [k, d.start]));
    this.th = { hp: thMax(1), max: thMax(1) };
    this.segs = buildSegs();
    // A slot is a place a defender can stand: the four towers, then every wall segment.
    this.slots = [...TOWERS.map(([x, z]) => ({ x, z, seg: -1 })), ...this.segs.map((s, i) => ({ x: s.x, z: s.z, seg: i }))];
    this.units = [0, 1, 2, 3].map((slot) => ({ slot, k: 'archer', cd: 0 }));
    this.tiers = Object.fromEntries(UNIT_KEYS.map((k) => [k, 1]));
    this.enemies = [];
    this.projs = [];
    this.fx = [];
    this.queue = [];
    this.spawnT = 0;
    this.spawnGap = 1;
    this.reached = 0;
    this.hpMul = 1;
    this.dmgMul = 1;
    this.reward = 0;
    this.perks = Object.fromEntries(PERKS.map((k) => [k, 0]));
    this.offer = null;
    this.shells = [];
    this.mortarCd = 0;
    this.ballistaCd = 0;
    this.makeWaveOffers();
  }

  layout() {
    return {
      S,
      segs: this.segs.map((s) => ({ x: s.x, z: s.z, hw: s.hw, hd: s.hd, gate: s.gate })),
      towers: TOWERS,
      thHalf: TH_HALF,
      spots: SPOTS,
      slots: this.slots.map((p) => [p.x, p.z, p.seg]),
      buildings: BUILDINGS,
      units: UNIT_KEYS,
      promote: PROMOTE,
      capacity: CAPACITY,
      perks: PERKS,
    };
  }

  addPlayer() {
    const id = this.nextId++;
    this.players.add(id);
    return id;
  }

  removePlayer(id) {
    this.players.delete(id);
    if (this.players.size === 0) this.reset();
  }

  // ---- Waves: two offers, the commanders pick one ----

  // Both offers are built from the same budget; one is harder and pays double.
  // The first leans towards a swarm of runners, the second towards brutes.
  makeWaveOffers() {
    const n = this.wave + 1;
    const budget = 5 + 3 * n + (n >= 3 ? (n - 2) * 3.2 : 0);
    const hardMul = 1.5 + this.rng() * 0.4, hardFirst = this.rng() < 0.5;
    this.waves = [0, 1].map((i) => {
      const hard = hardFirst ? i === 0 : i === 1, pts = budget * (hard ? hardMul : 1);
      const heavy = n < 2 ? 0 : i === 0 ? this.rng() * 0.25 : 0.35 + this.rng() * 0.35;
      const brutes = Math.round((pts * heavy) / ENEMIES[1].points);
      const runners = Math.max(3, Math.round(pts * (1 - heavy)));
      const queens = n % 10 === 0 ? (hard && n >= 20 ? 2 : 1) : 0;
      return { c: [runners, brutes, queens], gold: (40 + 15 * n) * (hard ? 2 : 1), hard };
    });
  }

  chooseWave(id, i) {
    if (this.phase !== 'prep' || !this.players.has(id) || !Number.isInteger(i) || !this.waves[i]) return false;
    this.startWave(this.waves[i]);
    return true;
  }

  startWave(offer) {
    const n = ++this.wave;
    this.phase = 'wave';
    this.reward = offer.gold;
    const types = [];
    offer.c.slice(0, 2).forEach((count, t) => { for (let i = 0; i < count; i++) types.push(t); });
    for (let i = types.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [types[i], types[j]] = [types[j], types[i]];
    }
    for (let q = 0; q < offer.c[2]; q++) types.splice(Math.floor(types.length * 0.4), 0, 2);
    const dirs = [];
    for (let i = 1 + (n >= 4) + (n >= 8); i > 0; i--) dirs.push(this.rng() * Math.PI * 2);
    this.hpMul = 1.09 ** (n - 1);
    this.dmgMul = 1 + 0.04 * (n - 1);
    this.queue = types.map((t) => ({ t, a: dirs[Math.floor(this.rng() * dirs.length)] + (this.rng() - 0.5) * 0.7 }));
    this.spawnGap = Math.max(0.15, 0.9 - n * 0.05);
    this.spawnT = 0;
    this.waves = [];
  }

  spawn({ t, a }) {
    const d = ENEMIES[t], dist = 52 + this.rng() * 8;
    // The queen grows more slowly than the horde, so later boss waves stay winnable.
    const hp = Math.round(d.hp * (t === 2 ? this.hpMul ** 0.6 : this.hpMul));
    this.enemies.push({ id: this.nextId++, t, x: Math.sin(a) * dist, z: Math.cos(a) * dist, hp, max: hp, cd: this.rng() });
  }

  endWave() {
    this.phase = 'prep';
    this.gold += Math.round((this.reward + 25 * this.b.mine) * (1 + 0.5 * this.perks.happy));
    this.projs = [];
    this.shells = [];
    this.makeWaveOffers();
  }

  // ---- Spending shared gold: anyone may, but only between waves ----

  unitCost(k) {
    return Math.round(UNITS[k].cost * COST_GROWTH ** this.units.filter((u) => u.k === k).length);
  }

  // A new defender takes the free slot furthest from everyone else, so the walls fill evenly.
  freeSlot(k) {
    const used = new Set(this.units.map((u) => u.slot));
    let best = -1, bd = -1;
    this.slots.forEach((s, i) => {
      if (used.has(i) || (UNITS[k].melee && s.seg < 0)) return;
      let d = Infinity;
      for (const u of this.units) { const o = this.slots[u.slot]; d = Math.min(d, Math.hypot(o.x - s.x, o.z - s.z)); }
      if (d > bd) { bd = d; best = i; }
    });
    return best;
  }

  recruit(id, k) {
    if (!Object.hasOwn(UNITS, k) || this.phase !== 'prep' || !this.players.has(id)) return false;
    if (this.units.length >= CAPACITY[this.b.walls]) return false;
    const cost = this.unitCost(k), slot = this.freeSlot(k);
    if (this.gold < cost || slot < 0) return false;
    this.gold -= cost;
    this.units.push({ slot, k, cd: 0 });
    this.fx.push([8, this.slots[slot].x, this.slots[slot].z, k]);
    return true;
  }

  promote(id, k) {
    if (!Object.hasOwn(UNITS, k) || this.phase !== 'prep' || !this.players.has(id)) return false;
    const t = this.tiers[k];
    if (t >= PROMOTE.length || this.b.barracks < t || this.gold < PROMOTE[t]) return false;
    this.gold -= PROMOTE[t];
    this.tiers[k] = t + 1;
    this.fx.push([9, 0, 0, k]);
    return true;
  }

  upgrade(id, key) {
    const d = BUILDINGS[key];
    if (!Object.hasOwn(BUILDINGS, key) || this.phase !== 'prep' || !this.players.has(id)) return false;
    const l = this.b[key];
    if (l >= d.max || (key !== 'hall' && l >= this.b.hall) || this.gold < d.cost[l]) return false;
    if (key === 'hall' && this.offer) return false;   // pick the pending perk first
    this.gold -= d.cost[l];
    this.b[key] = l + 1;
    if (key === 'hall') {
      const m = thMax(l + 1); this.th.hp += m - this.th.max; this.th.max = m;
      const pool = [...PERKS];
      this.offer = [0, 1, 2].map(() => pool.splice(Math.floor(this.rng() * pool.length), 1)[0]);
    }
    if (key === 'walls') for (const s of this.segs) { const m = Math.round(s.base * wallMul(l + 1)); if (s.hp > 0) s.hp += m - s.max; s.max = m; }
    this.fx.push([4, 0, 0, key]);
    return true;
  }

  // The shared perk choice: the first player to click decides.
  choosePerk(id, key) {
    if (!this.offer || !this.offer.includes(key) || this.phase === 'over' || !this.players.has(id)) return false;
    this.perks[key]++;
    this.offer = null;
    this.fx.push([6, 0, 0, key]);
    return true;
  }

  repairCost(what) {
    const missing = what === 'hall' ? this.th.max - this.th.hp : this.segs.reduce((a, s) => a + s.max - s.hp, 0);
    return Math.ceil((missing / REPAIR_HP_PER_GOLD) * 0.6 ** this.perks.masons);
  }

  // Repairs as much as the shared gold allows, spread evenly over the damage.
  repair(id, what) {
    if ((what !== 'hall' && what !== 'walls') || this.phase !== 'prep' || !this.players.has(id)) return false;
    const cost = this.repairCost(what);
    if (cost <= 0 || this.gold <= 0) return false;
    const pay = Math.min(cost, this.gold), f = pay / cost;
    this.gold -= pay;
    if (what === 'hall') this.th.hp = Math.min(this.th.max, this.th.hp + (this.th.max - this.th.hp) * f);
    else for (const s of this.segs) s.hp = Math.min(s.max, s.hp + (s.max - s.hp) * f);
    return true;
  }

  // ---- Simulation ----

  step(dt) {
    if (this.players.size === 0) return;
    if (this.phase === 'over') {
      this.timer -= dt;
      if (this.timer <= 0) this.reset();
      return;
    }
    if (this.phase !== 'wave') return;   // preparation has no clock: it lasts until a wave is chosen
    this.spawnT -= dt;
    while (this.spawnT <= 0 && this.queue.length) { this.spawn(this.queue.pop()); this.spawnT += this.spawnGap; }
    this.updateEnemies(dt);
    this.updateUnits(dt);
    this.updateEngines(dt);
    this.updateProjs(dt);
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    if (this.th.hp <= 0) {
      this.th.hp = 0; this.phase = 'over'; this.timer = OVER_TIME; this.reached = this.wave;
    } else if (!this.queue.length && !this.enemies.length) this.endWave();
  }

  hurtEnemy(e, dmg) {
    if (e.hp <= 0) return;
    e.hp -= dmg;
    if (e.hp > 0) return;
    this.gold += ENEMIES[e.t].gold;
    this.fx.push([0, r2(e.x), r2(e.z), e.t]);
  }

  // Defenders on the walls. A unit is out of action while its wall segment is down.
  updateUnits(dt) {
    const train = 1 + 0.25 * (this.b.barracks - 1), haste = 1 + 0.2 * this.perks.rapid;
    for (const u of this.units) {
      const post = this.slots[u.slot], d = UNITS[u.k];
      u.cd -= dt;
      if (u.cd > 0 || (post.seg >= 0 && this.segs[post.seg].hp <= 0)) continue;
      let best = null, bd = Infinity, bh = 0;
      for (const e of this.enemies) {
        const q = Math.hypot(e.x - post.x, e.z - post.z);
        if (q > d.range + ENEMIES[e.t].r) continue;
        if (d.tough ? e.hp > bh : q < bd) { best = e; bd = q; bh = e.hp; }
      }
      if (!best) continue;
      u.cd = (d.cd / haste) * (0.9 + this.rng() * 0.2);
      const dmg = d.dmg * train * (1 + 0.35 * (this.tiers[u.k] - 1)) * (u.k === 'archer' ? 1 + 0.3 * this.perks.sharp : 1);
      if (d.melee) { this.hurtEnemy(best, dmg); this.fx.push([7, r2(best.x), r2(best.z), 0]); continue; }
      const dist = Math.hypot(best.x - post.x, best.z - post.z) || 1, dx = (best.x - post.x) / dist, dz = (best.z - post.z) / dist;
      this.projs.push({ id: this.nextId++, kind: d.kind, x: post.x + dx, z: post.z + dz, vx: dx * d.speed, vz: dz * d.speed, ttl: (d.range / d.speed) * 1.2, r: 0.4, aoe: d.aoe || 0, dmg });
    }
  }

  // Perk weapons chosen on keep upgrades.
  updateEngines(dt) {
    if (this.perks.mortar) {
      this.mortarCd -= dt;
      if (this.mortarCd <= 0) {
        let best = null, score = 0;
        for (const e of this.enemies) {
          if (Math.hypot(e.x, e.z) > 34) continue;
          let c = 0;
          for (const o of this.enemies) if (Math.hypot(o.x - e.x, o.z - e.z) < MORTAR_R) c += o.t + 1;
          if (c > score) { score = c; best = e; }
        }
        if (best) {
          this.mortarCd = 4;
          // Lead the target: aim where the group will be when the shell lands, but not inside the walls.
          const d = Math.hypot(best.x, best.z), edge = Math.max(Math.abs(best.x), Math.abs(best.z));
          const lead = Math.min(ENEMIES[best.t].speed * 1.1, Math.max(0, d * (1 - (S + 1) / edge)));
          const tx = best.x * (1 - lead / d), tz = best.z * (1 - lead / d);
          this.shells.push({ x: tx, z: tz, t: 1.1 });
          this.fx.push([5, r2(tx), r2(tz), 1.1]);
        }
      }
    }
    for (const sh of this.shells) sh.t -= dt;
    for (const sh of this.shells) {
      if (sh.t > 0) continue;
      this.fx.push([1, r2(sh.x), r2(sh.z), MORTAR_R]);
      for (const e of this.enemies) if (Math.hypot(e.x - sh.x, e.z - sh.z) < MORTAR_R + ENEMIES[e.t].r) this.hurtEnemy(e, 40 * this.perks.mortar);
    }
    this.shells = this.shells.filter((sh) => sh.t > 0);
    if (this.perks.ballista) {
      this.ballistaCd -= dt;
      if (this.ballistaCd <= 0) {
        let best = null;
        for (const e of this.enemies) if (Math.hypot(e.x, e.z) < 32 && (!best || e.hp > best.hp)) best = e;
        if (best) {
          this.ballistaCd = 3;
          const d = Math.hypot(best.x, best.z) || 1;
          this.projs.push({ id: this.nextId++, kind: 4, x: 0, z: 0, vx: (best.x / d) * 60, vz: (best.z / d) * 60, ttl: 0.6, r: 0.6, aoe: 0, dmg: 120 * this.perks.ballista });
        }
      }
    }
  }

  updateProjs(dt) {
    const keep = [];
    for (const b of this.projs) {
      let hit = null;
      for (let i = 0; i < 2 && !hit; i++) {
        b.x += b.vx * dt * 0.5; b.z += b.vz * dt * 0.5;
        for (const e of this.enemies) {
          if (e.hp > 0 && Math.hypot(e.x - b.x, e.z - b.z) < b.r + ENEMIES[e.t].r) { hit = e; break; }
        }
      }
      b.ttl -= dt;
      if (!hit && b.ttl > 0) { keep.push(b); continue; }
      if (b.aoe) {
        this.fx.push([1, r2(b.x), r2(b.z), b.aoe]);
        for (const e of this.enemies) if (Math.hypot(e.x - b.x, e.z - b.z) < b.aoe + ENEMIES[e.t].r) this.hurtEnemy(e, b.dmg);
      } else if (hit) this.hurtEnemy(hit, b.dmg);
    }
    this.projs = keep;
  }

  collideStatic(e, r) {
    let hit = null;
    for (const s of this.segs) if (s.hp > 0 && pushOutBox(e, r, s.x, s.z, s.hw, s.hd)) hit = s;
    for (const [tx, tz] of TOWERS) pushOutCircle(e, r, tx, tz, TOWER_R);
    for (const k in SPOTS) if (this.b[k] > 0) pushOutBox(e, r, SPOTS[k].x, SPOTS[k].z, SPOTS[k].hw, SPOTS[k].hd);
    const th = pushOutBox(e, r, 0, 0, TH_HALF, TH_HALF);
    return { seg: hit, th };
  }

  // Monsters walk at the keep, break whatever wall is in the way and pour through breaches.
  updateEnemies(dt) {
    const breaches = this.segs.filter((s) => s.hp <= 0);
    const es = this.enemies;
    for (const e of es) {
      const d = ENEMIES[e.t];
      let tx = 0, tz = 0;
      if (Math.abs(e.x) > S - 1 || Math.abs(e.z) > S - 1) {
        let bd = 14;
        for (const s of breaches) { const q = Math.hypot(s.x - e.x, s.z - e.z); if (q < bd) { bd = q; tx = s.x; tz = s.z; } }
        if (bd < 1.5) { tx = 0; tz = 0; }   // standing in the breach: carry on to the keep
      }
      const dx = tx - e.x, dz = tz - e.z, len = Math.hypot(dx, dz);
      if (len > 0.01) { e.x += (dx / len) * d.speed * dt; e.z += (dz / len) * d.speed * dt; }
    }
    for (let i = 0; i < es.length; i++) {
      const a = es[i], ar = ENEMIES[a.t].r;
      for (let j = i + 1; j < es.length; j++) {
        const b = es[j], min = (ar + ENEMIES[b.t].r) * 0.9;
        const dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz;
        if (d2 >= min * min || d2 < 1e-9) continue;
        const dist = Math.sqrt(d2), push = min - dist, wa = a.t >= b.t ? 0.3 : 0.7;
        a.x -= (dx / dist) * push * wa; a.z -= (dz / dist) * push * wa;
        b.x += (dx / dist) * push * (1 - wa); b.z += (dz / dist) * push * (1 - wa);
      }
    }
    for (const e of es) {
      const d = ENEMIES[e.t];
      const c = this.collideStatic(e, d.r);
      const nearTH = c.th || (Math.abs(e.x) < TH_HALF + d.r + 0.4 && Math.abs(e.z) < TH_HALF + d.r + 0.4);
      e.cd -= dt;
      if (e.cd > 0) continue;
      if (nearTH) { e.cd = 1; this.th.hp -= d.dmg * this.dmgMul; }
      else if (c.seg) { e.cd = 1; c.seg.hp = Math.max(0, c.seg.hp - d.dmg * this.dmgMul * d.wallMul); }
    }
  }

  snapshot() {
    const fx = this.fx;
    this.fx = [];
    return {
      t: 's', ph: this.phase, wave: this.wave, tm: Math.ceil(this.timer), gold: this.gold,
      th: [Math.round(this.th.hp), this.th.max], reached: this.reached,
      left: this.queue.length + this.enemies.length, np: this.players.size,
      b: Object.keys(BUILDINGS).map((k) => this.b[k]),
      rc: [this.repairCost('walls'), this.repairCost('hall')],
      pk: PERKS.map((k) => this.perks[k]),
      of: this.offer,
      wv: this.waves,
      un: this.units.map((u) => [u.slot, UNIT_KEYS.indexOf(u.k)]),
      cap: CAPACITY[this.b.walls],
      uc: UNIT_KEYS.map((k) => this.unitCost(k)),
      ut: UNIT_KEYS.map((k) => this.tiers[k]),
      sg: this.segs.map((s) => Math.round((s.hp / s.max) * 100)),
      en: this.enemies.map((e) => [e.id, e.t, r2(e.x), r2(e.z), Math.max(1, Math.round((e.hp / e.max) * 100))]),
      pr: this.projs.map((b) => [b.id, b.kind, r2(b.x), r2(b.z), r2(Math.atan2(b.vx, b.vz))]),
      fx,
    };
  }
}
