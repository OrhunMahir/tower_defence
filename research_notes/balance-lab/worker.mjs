// One slice of a measurement: plays bot runs and prints one JSON line per wave and per run.
// ROOT=<repo> node worker.mjs pick from count upTo siege [--no=muts,weather,season,adapt]
import { pathToFileURL } from 'node:url';
const ROOT = process.env.ROOT;
const G = await import(pathToFileURL(`${ROOT}/server/game.js`));
const B = await import(pathToFileURL(`${ROOT}/test/bots.js`));
const { TICK, ENEMIES } = G;
const { newGame, botTurn } = B;
const [pick, from, count, upTo, siege] = process.argv.slice(2);
if (!['easy', 'mixed', 'hard'].includes(pick)) throw new Error(`unknown pick "${pick}": easy, mixed or hard`);
const NO = (process.argv.find((a) => a.startsWith('--no=')) || '--no=').slice(5).split(',').filter(Boolean);
const UPTO = Number(upTo);
for (let i = Number(from); i < Number(from) + Number(count); i++) {
  const seed = 11 * (i + 1);
  const { g, id } = newGame(seed, 1, { siege: Number(siege) });
  if (NO.includes('muts')) g.mut = () => 0;
  if (NO.includes('weather')) { g.rollWeather = () => 'clear'; g.forecast = g.forecast.map(() => 'clear'); }
  if (NO.includes('season')) { const env = g.env.bind(g); g.env = (n, w) => { const o = env(n, w), wf = G.WEATHER_FX[w] || {}; return { ...o, harvest: 1, repair: 0, gold: 1, horde: 1, hp: 1, speed: wf.speed || 1, range: wf.range || 1, luck: wf.luck || 0 }; }; }
  if (NO.includes('adapt')) g.adaptNow = () => { for (const f in g.dealt) g.dealt[f] = 0; };
  let cur = null, keep0 = 0, walls0 = 0, t0 = 0, idle = 0, lastWave = -1, lastPhase = '', stuck = false;
  const orig = g.startWave.bind(g);
  g.startWave = (offer) => { cur = offer; keep0 = g.th.hp / g.th.max; walls0 = g.segs.reduce((a, s) => a + s.hp, 0) / g.segs.reduce((a, s) => a + s.max, 0); t0 = g.battleT; return orig(offer); };
  const ages = [];
  let age = 0;
  while (g.phase !== 'over' && !(g.wave >= UPTO && g.phase !== 'wave')) {
    const before = g.phase;
    botTurn(g, id, { pick });
    if (g.age > age) { age = g.age; ages.push(g.wave + 1); }
    g.step(TICK);
    if (g.wave === lastWave && g.phase === lastPhase) idle++; else { idle = 0; lastWave = g.wave; lastPhase = g.phase; }
    if (idle > 40 * 60 / TICK || (g.phase !== 'wave' && idle > 2000)) { stuck = true; break; }
    if (before !== 'wave' || g.phase === 'wave') continue;
    const dead = g.phase === 'over';
    const keep1 = Math.max(0, g.th.hp) / g.th.max, walls1 = g.segs.reduce((a, s) => a + Math.max(0, s.hp), 0) / g.segs.reduce((a, s) => a + s.max, 0);
    const r = { k: 'wave', seed, n: g.wave, tier: cur.tier, th: cur.th, mod: cur.mod, weather: g.weather, keep: keep0 - keep1, walls: walls0 - walls1, down: g.segs.filter((s) => s.hp <= 0).length, t: g.battleT - t0, dead,
      c: cur.c.map((x, t) => (x ? `${x} ${ENEMIES[t].key}` : '')).filter(Boolean).join(', '), hx: cur.hx, keep0, walls0,
      units: g.units.length, level: g.level, b: `${g.b.hall}/${g.b.walls}`, age: g.age, muts: g.muts ? Object.entries(g.muts).map(([a, b]) => `${a}${b > 1 ? b : ''}`).join('+') : '' };
    console.log(JSON.stringify(r));
  }
  const over = g.phase === 'over';
  console.log(JSON.stringify({ k: 'run', seed, wave: over ? g.reached ?? g.wave : g.wave, fell: over, min: g.battleT / 60, ages, stuck }));
}
