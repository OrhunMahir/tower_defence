// Sends saved castles into one wave each under the rules of ROOT, and prints one JSON line per wave.
// ROOT=<repo> node replay.mjs snapDir slice slices tier modes [reps]
//   tier: which offer to take (hard | std | deadly). modes: comma list of 'natural' and theme keys (forced theme).
import { pathToFileURL } from 'node:url';
import { readFileSync, readdirSync } from 'node:fs';
import v8 from 'node:v8';
const ROOT = process.env.ROOT;
const G = await import(pathToFileURL(`${ROOT}/server/game.js`));
const B = await import(pathToFileURL(`${ROOT}/test/bots.js`));
const { TICK, ENEMIES, THEMES } = G;
const [dir, slice, slices, tier, modes, reps = 1] = process.argv.slice(2);
const ONLY = (process.argv.find((a) => a.startsWith('--chosen=')) || '--chosen=').slice(9);   // only castles whose bot chose this tier
const MIN = Number((process.argv.find((a) => a.startsWith('--min=')) || '--min=0').slice(6)), MAX = Number((process.argv.find((a) => a.startsWith('--max=')) || '--max=999').slice(6));
const NO = (process.argv.find((a) => a.startsWith('--no=')) || '--no=').slice(5).split(',').filter(Boolean);
const files = readdirSync(dir).filter((f) => f.endsWith('.bin')).sort().filter((f, i) => i % Number(slices) === Number(slice));
const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
for (const f of files) {
  const snap = v8.deserialize(readFileSync(`${dir}/${f}`));
  if (snap.boss || (ONLY && snap.chosen !== ONLY) || snap.n < MIN || snap.n > MAX) continue;
  for (const mode of modes.split(',')) {
    if (mode !== 'natural') { const th = THEMES.find((t) => t.key === mode); if (!th || (th.w ? !Object.keys(th.w).every((t) => ENEMIES[t].unlock <= snap.n) : snap.n < th.unlock)) continue; }
    for (let rep = 0; rep < Number(mode === 'natural' ? reps : 1); rep++) {
      const g = Object.assign(Object.create(G.Game.prototype), v8.deserialize(readFileSync(`${dir}/${f}`)).data);
      g.rng = B.seeded(hash(`${f}|${mode}|${rep}`));
      // Switch parts of the endless rules off for this one wave, to see what each costs.
      if (NO.includes('muts')) g.muts = {};
      if (NO.includes('adapt')) for (const k in g.adapt) g.adapt[k] = 0;
      if (NO.includes('weather')) g.forecast = g.forecast.map(() => 'clear');
      if (NO.includes('season')) { const env = G.Game.prototype.env; g.env = function (n, w) { const o = env.call(this, n, w), wf = G.WEATHER_FX[w] || {}; return { ...o, harvest: 1, repair: 0, gold: 1, horde: 1, hp: 1, speed: wf.speed || 1, range: wf.range || 1, luck: wf.luck || 0 }; }; }
      if (NO.length) g.refreshDerived();
      let offer = null;
      for (let tries = 0; tries < 3000 && !offer; tries++) {
        if (tier === 'deadly') g.scouted = true;   // a deadly offer needs a watchtower or scouts
        g.makeWaveOffers();
        offer = g.waves.find((w) => w.tier === tier && (mode === 'natural' || (w.th === mode && !w.mod))) || null;
        if (mode === 'natural') break;
      }
      if (!offer) continue;
      const keep0 = g.th.hp / g.th.max, wsum = () => g.segs.reduce((a, s) => a + Math.max(0, s.hp), 0) / g.segs.reduce((a, s) => a + s.max, 0), walls0 = wsum(), t0 = g.battleT;
      if (!g.chooseWave(snap.id, g.waves.indexOf(offer))) { console.error('could not choose', f); continue; }
      let guard = 0;
      while (g.phase === 'wave' && guard++ < 40 * 60 / TICK) { B.botTurn(g, snap.id, { pick: snap.pick }); g.step(TICK); }
      const dead = g.phase === 'over';
      console.log(JSON.stringify({ k: 'wave', mode, rep, seed: snap.seed, n: snap.n, tier: offer.tier, th: offer.th, mod: offer.mod, weather: g.weather, keep: keep0 - Math.max(0, g.th.hp) / g.th.max, walls: walls0 - wsum(),
        down: g.segs.filter((s) => s.hp <= 0).length, t: g.battleT - t0, dead, stuck: g.phase === 'wave', keep0, walls0, hx: offer.hx, count: offer.c.reduce((a, b) => a + b, 0),
        c: offer.c.map((x, t) => (x ? `${x} ${ENEMIES[t].key}` : '')).filter(Boolean).join(', '), gold: offer.gold, xp: offer.xp }));
    }
  }
}
