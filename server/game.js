// Pure game simulation: no network and no timers. step(dt) advances the world,
// snapshot() returns what clients need to draw it. The server owns all rules.

export const TICK = 1 / 20;
export const S = 14;            // half-size of the castle square
const SEG = 4;                  // wall segment length
const WALL_T = 0.7;             // wall half-thickness
const TH_HALF = 3.5;            // town hall half-size
const TOWER_R = 2.1;
const PREP_FIRST = 30, PREP = 30, OVER_TIME = 8, RESPAWN = 5;

export const CLASSES = {
  knight: { hp: 140, speed: 7, cd: 0.45, dmg: 32, range: 3.2, arc: 2.2 },
  archer: { hp: 90, speed: 7.6, cd: 0.5, dmg: 18, proj: { kind: 0, speed: 34, ttl: 1.1, r: 0.35 } },
  mage: { hp: 80, speed: 7, cd: 0.95, dmg: 24, proj: { kind: 1, speed: 22, ttl: 1.4, r: 0.45, aoe: 3 } },
};

export const ENEMIES = [
  { name: 'runner', hp: 30, speed: 4.4, dmg: 6, r: 0.6, xp: 8, gold: 3, wallMul: 1 },
  { name: 'brute', hp: 150, speed: 2.3, dmg: 16, r: 1.0, xp: 30, gold: 12, wallMul: 2.5 },
  { name: 'queen', hp: 1800, speed: 1.6, dmg: 45, r: 2.4, xp: 400, gold: 250, wallMul: 3 },
];

// cost[level] is the price of going from that level to the next one.
export const BUILDINGS = {
  hall: { start: 1, max: 5, cost: [0, 100, 250, 500, 900] },
  walls: { start: 1, max: 5, cost: [0, 60, 150, 300, 550] },
  archers: { start: 1, max: 5, cost: [0, 80, 200, 400, 700] },
  mine: { start: 0, max: 5, cost: [80, 120, 220, 380, 600] },
  smith: { start: 0, max: 5, cost: [100, 180, 320, 520, 800] },
};
// Buildings that only exist (and block movement) once they are built.
const SPOTS = { mine: { x: 8.5, z: -7, hw: 2, hd: 2 }, smith: { x: -8.5, z: 5.5, hw: 2.2, hd: 1.9 } };
// Wall archers per archer level. Posts fill in order: corner towers, side centres, then the rest.
const ARCHER_COUNT = [0, 4, 6, 8, 12, 16];
const POST_ORDER = [[0, S], [0, -S], [S, 0], [-S, 0], [-8, S], [8, S], [-8, -S], [8, -S], [S, -8], [S, 8], [-S, -8], [-S, 8]];
// One of three random perks is offered each time the town hall is upgraded. Perks stack.
export const PERKS = ['mortar', 'ballista', 'happy', 'sharp', 'rapid', 'masons'];
const MORTAR_R = 3.5;
// Hero growth: one stat point per level, gear tiers bought with shared gold at the blacksmith.
export const STATS = ['str', 'agi', 'vit', 'crit'];
const STAT_MAX = 20;
// GEAR[kind][tier] is the price of going from that tier to the next; tier t+1 needs blacksmith level t.
export const GEAR = { wpn: [0, 60, 140, 280, 500], arm: [0, 50, 120, 240, 420] };
const CASTLE_XP_SHARE = 0.4;   // every hero earns this share of XP for kills made by archers and engines
const heroMaxHp = (p) => CLASSES[p.cls].hp + 15 * p.st.vit;
const thMax = (l) => 1500 + 600 * (l - 1);
const wallMul = (l) => 1 + 0.5 * (l - 1);
const REPAIR_HP_PER_GOLD = 20;

const TOWERS = [[-S, -S], [S, -S], [-S, S], [S, S]];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const r2 = (v) => Math.round(v * 100) / 100;
export const xpNext = (lvl) => Math.round(40 * lvl ** 1.5);

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
    this.players = new Map();
    this.nextId = 1;
    this.reset();
  }

  reset() {
    this.wave = 0;
    this.phase = 'prep';
    this.timer = PREP_FIRST;
    this.gold = 0;
    this.b = Object.fromEntries(Object.entries(BUILDINGS).map(([k, d]) => [k, d.start]));
    this.th = { hp: thMax(1), max: thMax(1) };
    this.segs = buildSegs();
    this.enemies = [];
    this.projs = [];
    this.fx = [];
    this.queue = [];
    this.spawnT = 0;
    this.spawnGap = 1;
    this.posts = [...TOWERS.map(([x, z]) => ({ x, z, seg: -1 })), ...POST_ORDER.map(([x, z]) => ({ x, z, seg: this.segs.findIndex((s) => s.x === x && s.z === z) }))];
    this.archerCd = this.posts.map(() => 0);
    this.perks = Object.fromEntries(PERKS.map((k) => [k, 0]));
    this.offer = null;
    this.shells = [];
    this.mortarCd = 0;
    this.ballistaCd = 0;
    this.reached = 0;
    this.hpMul = 1;
    this.dmgMul = 1;
    let i = 0;
    for (const p of this.players.values()) this.resetPlayer(p, i++);
  }

  resetPlayer(p, slot = 0) {
    p.lvl = 1; p.xp = 0; p.pts = 0; p.wpn = 1; p.arm = 1;
    p.st = { str: 0, agi: 0, vit: 0, crit: 0 };
    p.maxhp = heroMaxHp(p); p.hp = p.maxhp;
    p.x = (slot - 1.5) * 1.2; p.z = 6.5; p.aim = 0;
    p.cd = 0; p.dead = 0; p.atkN = 0; p.ready = false;
  }

  layout() {
    return {
      S,
      segs: this.segs.map((s) => ({ x: s.x, z: s.z, hw: s.hw, hd: s.hd, gate: s.gate })),
      towers: TOWERS,
      thHalf: TH_HALF,
      spots: SPOTS,
      posts: this.posts.map((p) => [p.x, p.z, p.seg]),
      archerCount: ARCHER_COUNT,
      perks: PERKS,
      buildings: BUILDINGS,
      gear: GEAR,
    };
  }

  addPlayer(cls) {
    if (!CLASSES[cls]) cls = 'knight';
    const p = { id: this.nextId++, cls, in: { mx: 0, mz: 0, aim: 0, atk: false } };
    this.resetPlayer(p, this.players.size);
    this.players.set(p.id, p);
    return p;
  }

  removePlayer(id) {
    this.players.delete(id);
    if (this.players.size === 0) this.reset();
  }

  setInput(id, m) {
    const p = this.players.get(id);
    if (!p) return;
    const num = (v) => (Number.isFinite(v) ? v : 0);
    p.in.mx = clamp(num(m.mx), -1, 1);
    p.in.mz = clamp(num(m.mz), -1, 1);
    p.in.aim = num(m.aim);
    p.in.atk = !!m.atk;
  }

  setReady(id) {
    const p = this.players.get(id);
    if (p && this.phase === 'prep') p.ready = true;
  }

  // Class can only change between waves; level and XP are kept.
  setClass(id, cls) {
    const p = this.players.get(id);
    if (!p || !CLASSES[cls] || this.phase !== 'prep') return;
    p.cls = cls;
    p.maxhp = heroMaxHp(p);
    p.hp = p.maxhp;
  }

  // Stat points are personal and can be spent at any time.
  addStat(id, key) {
    const p = this.players.get(id);
    if (!p || !STATS.includes(key) || p.pts <= 0 || p.st[key] >= STAT_MAX) return false;
    p.pts--; p.st[key]++;
    if (key === 'vit') { p.maxhp += 15; if (p.dead <= 0) p.hp += 15; }
    return true;
  }

  buyGear(id, kind) {
    const p = this.players.get(id);
    if (!p || !Object.hasOwn(GEAR, kind) || this.phase !== 'prep') return false;
    const t = p[kind];
    if (t >= GEAR[kind].length || this.b.smith < t || this.gold < GEAR[kind][t]) return false;
    this.gold -= GEAR[kind][t];
    p[kind] = t + 1;
    return true;
  }

  giveXp(p, amount) {
    p.xp += amount;
    while (p.xp >= xpNext(p.lvl)) {
      p.xp -= xpNext(p.lvl); p.lvl++; p.pts++;
      if (p.dead <= 0) p.hp = p.maxhp;
      this.fx.push([2, r2(p.x), r2(p.z), p.id]);
    }
  }

  // Anyone may spend the shared gold, but only between waves.
  upgrade(id, key) {
    const d = BUILDINGS[key];
    if (!d || !Object.hasOwn(BUILDINGS, key) || this.phase !== 'prep' || !this.players.has(id)) return false;
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

  step(dt) {
    if (this.players.size === 0) return;
    if (this.phase === 'over') {
      this.timer -= dt;
      if (this.timer <= 0) this.reset();
      return;
    }
    if (this.phase === 'prep') {
      this.timer -= dt;
      let allReady = true;
      for (const p of this.players.values()) if (!p.ready) allReady = false;
      if (this.timer <= 0 || allReady) this.startWave();
    } else {
      this.spawnT -= dt;
      while (this.spawnT <= 0 && this.queue.length) { this.spawn(this.queue.pop()); this.spawnT += this.spawnGap; }
      this.updateEnemies(dt);
      this.updateArchers(dt);
      this.updateEngines(dt);
    }
    this.updatePlayers(dt);
    this.updateProjs(dt);
    if (this.phase === 'wave') {
      this.enemies = this.enemies.filter((e) => e.hp > 0);
      if (this.th.hp <= 0) {
        this.th.hp = 0; this.phase = 'over'; this.timer = OVER_TIME; this.reached = this.wave;
      } else if (!this.queue.length && !this.enemies.length) this.endWave();
    }
  }

  startWave() {
    const n = ++this.wave, mul = 0.6 + 0.4 * this.players.size;
    this.phase = 'wave';
    for (const p of this.players.values()) p.ready = false;
    const types = [];
    for (let i = Math.round((5 + 3 * n) * mul); i > 0; i--) types.push(0);
    if (n >= 3) for (let i = Math.round((n - 2) * 0.8 * mul); i > 0; i--) types.push(1);
    for (let i = types.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [types[i], types[j]] = [types[j], types[i]];
    }
    if (n % 10 === 0) types.splice(Math.floor(types.length * 0.6), 0, 2);
    const dirs = [];
    for (let i = 1 + (n >= 4) + (n >= 8); i > 0; i--) dirs.push(this.rng() * Math.PI * 2);
    this.hpMul = 1.09 ** (n - 1);
    this.dmgMul = 1 + 0.04 * (n - 1);
    this.queue = types.map((t) => ({ t, a: dirs[Math.floor(this.rng() * dirs.length)] + (this.rng() - 0.5) * 0.7 }));
    this.spawnGap = Math.max(0.15, 0.9 - n * 0.05);
    this.spawnT = 0;
  }

  spawn({ t, a }) {
    const d = ENEMIES[t], dist = 52 + this.rng() * 8;
    // The queen grows more slowly than the horde, so later boss waves stay winnable.
    const hp = Math.round(d.hp * (t === 2 ? this.hpMul ** 0.6 * (0.6 + 0.4 * this.players.size) : this.hpMul));
    this.enemies.push({ id: this.nextId++, t, x: Math.sin(a) * dist, z: Math.cos(a) * dist, hp, max: hp, cd: this.rng() });
  }

  endWave() {
    this.phase = 'prep';
    this.timer = PREP;
    this.gold += Math.round((25 + 8 * this.wave + 25 * this.b.mine) * (1 + 0.5 * this.perks.happy));
    this.shells = [];
    this.projs = [];
    let i = 0;
    for (const p of this.players.values()) {
      if (p.dead > 0) { p.dead = 0; p.hp = p.maxhp; p.x = (i - 1.5) * 1.2; p.z = 6.5; }
      i++;
    }
  }

  collideStatic(e, r, isEnemy) {
    let hit = null;
    for (const s of this.segs) {
      if (s.hp <= 0) continue;
      if (pushOutBox(e, r, s.x, s.z, s.hw, s.hd)) hit = s;
    }
    for (const [tx, tz] of TOWERS) pushOutCircle(e, r, tx, tz, TOWER_R);
    for (const k in SPOTS) if (this.b[k] > 0) pushOutBox(e, r, SPOTS[k].x, SPOTS[k].z, SPOTS[k].hw, SPOTS[k].hd);
    const th = pushOutBox(e, r, 0, 0, TH_HALF, TH_HALF);
    return { seg: hit, th };
  }

  updatePlayers(dt) {
    for (const p of this.players.values()) {
      if (p.dead > 0) {
        p.dead -= dt;
        if (p.dead <= 0) { p.dead = 0; p.hp = p.maxhp; p.x = 0; p.z = 6.5; }
        continue;
      }
      const c = CLASSES[p.cls];
      let { mx, mz } = p.in;
      const len = Math.hypot(mx, mz);
      if (len > 1) { mx /= len; mz /= len; }
      const sp = c.speed * (1 + 0.03 * p.st.agi);
      p.x += mx * sp * dt; p.z += mz * sp * dt;
      this.collideStatic(p, 0.5, false);
      // Defenders never leave the castle, even through a breach.
      p.x = clamp(p.x, -S + 1.3, S - 1.3); p.z = clamp(p.z, -S + 1.3, S - 1.3);
      p.aim = p.in.aim;
      p.cd -= dt;
      if (p.in.atk && p.cd <= 0) { p.cd = c.cd / (1 + 0.06 * p.st.agi); p.atkN++; this.attack(p, c); }
    }
  }

  attack(p, c) {
    const crit = this.rng() < 0.05 * p.st.crit ? 2 : 1;
    const dmg = c.dmg * (1 + 0.08 * p.st.str) * (1 + 0.35 * (p.wpn - 1)) * crit;
    const sx = Math.sin(p.aim), sz = Math.cos(p.aim);
    if (c.proj) {
      this.projs.push({
        id: this.nextId++, kind: c.proj.kind, x: p.x + sx * 0.8, z: p.z + sz * 0.8,
        vx: sx * c.proj.speed, vz: sz * c.proj.speed, ttl: c.proj.ttl, r: c.proj.r, aoe: c.proj.aoe || 0, dmg, owner: p.id,
      });
      return;
    }
    for (const e of this.enemies) {
      const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz), er = ENEMIES[e.t].r;
      if (d > c.range + er) continue;
      let da = Math.atan2(dx, dz) - p.aim;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      if (d < er + 0.8 || Math.abs(da) <= c.arc / 2) this.hurtEnemy(e, dmg, p.id);
    }
  }

  hurtEnemy(e, dmg, ownerId) {
    if (e.hp <= 0) return;
    e.hp -= dmg;
    if (e.hp > 0) return;
    const d = ENEMIES[e.t];
    this.gold += d.gold;
    this.fx.push([0, r2(e.x), r2(e.z), e.t]);
    const p = this.players.get(ownerId);
    if (p) this.giveXp(p, d.xp);
    else for (const q of this.players.values()) this.giveXp(q, Math.round(d.xp * CASTLE_XP_SHARE));
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
        for (const e of this.enemies) if (Math.hypot(e.x - b.x, e.z - b.z) < b.aoe + ENEMIES[e.t].r) this.hurtEnemy(e, b.dmg, b.owner);
      } else if (hit) this.hurtEnemy(hit, b.dmg, b.owner);
    }
    this.projs = keep;
  }

  // Wall archers: one per manned post, silent while their wall segment is down.
  updateArchers(dt) {
    const l = this.b.archers, n = ARCHER_COUNT[l];
    const dmg = (9 + 3 * (l - 1)) * (1 + 0.3 * this.perks.sharp), gap = 1.5 / (1 + 0.2 * this.perks.rapid), range = 18 + l;
    for (let i = 0; i < n; i++) {
      const post = this.posts[i];
      this.archerCd[i] -= dt;
      if (this.archerCd[i] > 0 || (post.seg >= 0 && this.segs[post.seg].hp <= 0)) continue;
      let best = null, bd = range;
      for (const e of this.enemies) { const d = Math.hypot(e.x - post.x, e.z - post.z); if (d < bd) { bd = d; best = e; } }
      if (!best) continue;
      this.archerCd[i] = gap * (0.9 + this.rng() * 0.2);
      const dx = (best.x - post.x) / bd, dz = (best.z - post.z) / bd;
      this.projs.push({ id: this.nextId++, kind: 2, x: post.x + dx, z: post.z + dz, vx: dx * 40, vz: dz * 40, ttl: 0.75, r: 0.4, aoe: 0, dmg, owner: 0 });
    }
  }

  // Perk weapons chosen on town hall upgrades.
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
          this.shells.push({ x: best.x, z: best.z, t: 1.1 });
          this.fx.push([5, r2(best.x), r2(best.z), 1.1]);
        }
      }
    }
    for (const sh of this.shells) sh.t -= dt;
    for (const sh of this.shells) {
      if (sh.t > 0) continue;
      this.fx.push([1, r2(sh.x), r2(sh.z), MORTAR_R]);
      for (const e of this.enemies) if (Math.hypot(e.x - sh.x, e.z - sh.z) < MORTAR_R + ENEMIES[e.t].r) this.hurtEnemy(e, 40 * this.perks.mortar, 0);
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
          this.projs.push({ id: this.nextId++, kind: 4, x: 0, z: 0, vx: (best.x / d) * 60, vz: (best.z / d) * 60, ttl: 0.6, r: 0.6, aoe: 0, dmg: 120 * this.perks.ballista, owner: 0 });
        }
      }
    }
  }

  updateEnemies(dt) {
    const breaches = this.segs.filter((s) => s.hp <= 0);
    const alive = [...this.players.values()].filter((p) => p.dead <= 0);
    const es = this.enemies;
    for (const e of es) {
      const d = ENEMIES[e.t];
      let tx = 0, tz = 0, prey = null, pd = 9;
      for (const p of alive) { const q = Math.hypot(p.x - e.x, p.z - e.z); if (q < pd) { pd = q; prey = p; } }
      if (prey) { tx = prey.x; tz = prey.z; }
      else if (Math.abs(e.x) > S - 1 || Math.abs(e.z) > S - 1) {
        let bd = 14;
        for (const s of breaches) { const q = Math.hypot(s.x - e.x, s.z - e.z); if (q < bd) { bd = q; tx = s.x; tz = s.z; } }
      }
      const dx = tx - e.x, dz = tz - e.z, len = Math.hypot(dx, dz);
      const reach = prey && pd <= d.r + 1.1;
      if (len > 0.01 && !reach) { e.x += (dx / len) * d.speed * dt; e.z += (dz / len) * d.speed * dt; }
      e.prey = prey; e.reach = reach;
    }
    for (let i = 0; i < es.length; i++) {
      const a = es[i], ar = ENEMIES[a.t].r;
      for (let j = i + 1; j < es.length; j++) {
        const b = es[j], min = (ar + ENEMIES[b.t].r) * 0.9;
        const dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz;
        if (d2 >= min * min || d2 < 1e-9) continue;
        const dist = Math.sqrt(d2), push = (min - dist) / 2, wa = a.t >= b.t ? 0.3 : 0.7;
        a.x -= (dx / dist) * push * wa * 2; a.z -= (dz / dist) * push * wa * 2;
        b.x += (dx / dist) * push * (1 - wa) * 2; b.z += (dz / dist) * push * (1 - wa) * 2;
      }
    }
    for (const e of es) {
      const d = ENEMIES[e.t];
      const c = this.collideStatic(e, d.r, true);
      const nearTH = c.th || (Math.abs(e.x) < TH_HALF + d.r + 0.4 && Math.abs(e.z) < TH_HALF + d.r + 0.4);
      e.cd -= dt;
      if (e.cd > 0) continue;
      if (e.reach && e.prey.dead <= 0) {
        e.cd = 1;
        e.prey.hp -= d.dmg * this.dmgMul * (1 - 0.12 * (e.prey.arm - 1));
        if (e.prey.hp <= 0) { e.prey.hp = 0; e.prey.dead = RESPAWN; this.fx.push([3, r2(e.prey.x), r2(e.prey.z), e.prey.id]); }
      } else if (nearTH) { e.cd = 1; this.th.hp -= d.dmg * this.dmgMul; }
      else if (c.seg) { e.cd = 1; c.seg.hp = Math.max(0, c.seg.hp - d.dmg * this.dmgMul * d.wallMul); }
    }
  }

  snapshot() {
    const fx = this.fx;
    this.fx = [];
    return {
      t: 's', ph: this.phase, wave: this.wave, tm: Math.ceil(this.timer), gold: this.gold,
      th: [Math.round(this.th.hp), this.th.max], reached: this.reached,
      left: this.queue.length + this.enemies.length,
      b: Object.keys(BUILDINGS).map((k) => this.b[k]),
      rc: [this.repairCost('walls'), this.repairCost('hall')],
      pk: PERKS.map((k) => this.perks[k]),
      of: this.offer,
      sg: this.segs.map((s) => Math.round((s.hp / s.max) * 100)),
      pl: [...this.players.values()].map((p) => [p.id, p.cls, r2(p.x), r2(p.z), r2(p.aim), Math.round(p.hp), p.maxhp, p.lvl, p.xp, xpNext(p.lvl), Math.ceil(p.dead), p.atkN, p.ready ? 1 : 0, p.pts, STATS.map((k) => p.st[k]), p.wpn, p.arm]),
      en: this.enemies.map((e) => [e.id, e.t, r2(e.x), r2(e.z), Math.max(1, Math.round((e.hp / e.max) * 100))]),
      pr: this.projs.map((b) => [b.id, b.kind, r2(b.x), r2(b.z), r2(Math.atan2(b.vx, b.vz))]),
      fx,
    };
  }
}
