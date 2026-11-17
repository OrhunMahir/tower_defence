// Balance report. A run has no last wave, so the question is not "do bots win" but how deep bot
// commanders get before the castle falls, how long that takes, and when they reach each age.
// Usage: node test/balance.js [--seeds=8] [--row=name] [--cap=200] [-v]
//        node test/balance.js --siege=4[,6,12] [--pick=easy|mixed|hard]    rows for other siege levels
//        node test/balance.js --trace=seed[,pick[,siege[,fromWave]]]       one run, wave by wave
import { TICK, SIEGE, SEASON_LEN, YEAR_LEN, ageKey, hpMul } from '../server/game.js';
import { newGame, botTurn } from './bots.js';

const arg = (name, fallback) => { const a = process.argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : fallback; };
const SEEDS = Number(arg('seeds', 8)), CAP = Number(arg('cap', 200)), VERBOSE = process.argv.includes('-v');
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };

// One run, played to its end (or to the cap, for a bot that will not fall).
// trace: print every wave from this one on.
function run(seed, opt, siege, trace = 0) {
  const { g, id } = newGame(seed, 1, { siege });
  const ages = [], seasons = [];
  let age = 0, start = 0, offer = '';
  while (g.phase !== 'over' && !(g.wave >= CAP && g.phase !== 'wave')) {
    const w = g.wave, before = g.phase;
    const offers = trace && g.phase === 'prep' ? g.waves.map((o) => `${o.tier}/${o.th}${o.mod ? `+${o.mod}` : ''}`).join(' ') : '';
    botTurn(g, id, opt);
    if (g.age > age) { age = g.age; ages.push([ageKey(g.age, g.path), g.wave + 1]); }
    if (g.wave > w) { start = g.battleT; offer = offers; }
    g.step(TICK);
    if (before !== 'wave' || g.phase === 'wave') continue;
    // A wave has ended, one way or the other.
    if (trace && g.wave >= trace) {
      console.log(`w${g.wave} ${(g.battleT - start).toFixed(0)}s ${g.weather}${g.dark ? ' night' : ''} [${offer}] keep ${Math.round(g.th.hp)}/${g.th.max} walls ${g.segs.filter((s) => s.hp > 0).length}/${g.segs.length}`
        + ` gold ${Math.round(g.gold)} L${g.level} b${g.b.hall}/${g.b.walls} units ${g.units.length} age ${ageKey(g.age, g.path)} muts ${JSON.stringify(g.muts)}`);
    }
    if (g.phase !== 'over' && g.wave % SEASON_LEN === 0) {
      const dps = g.units.reduce((a, u) => a + (g.support(u.k) ? 0 : g.unitPower(u) / Math.max(0.05, g.unitReload(u))), 0);
      seasons.push(`w${g.wave} ${(g.battleT / 60).toFixed(0)}m ${ageKey(g.age, g.path)} L${g.level} b${g.b.hall}/${g.b.walls} units${g.units.length} lv${Math.round(g.units.reduce((a, u) => a + u.lv, 0) / g.units.length)}`
        + ` dps${Math.round(dps)} hp×${hpMul(g.wave).toFixed(0)} turrets${g.turrets.length} yard${g.plots.filter(Boolean).length} muts${Object.values(g.muts).reduce((a, b) => a + b, 0)}`);
    }
  }
  const over = g.phase === 'over';
  return { wave: over ? g.reached : g.wave, alive: !over, min: g.battleT / 60, ages, seasons, path: g.path, renown: over ? g.summary.renown : null };
}

const trace = arg('trace', '');
if (trace) {
  const [seed, pick = 'easy', siege = 1, from = 1] = trace.split(',');
  const r = run(Number(seed), { pick }, Number(siege), Number(from));
  console.log(r.alive ? `still standing at wave ${r.wave}` : `fell on wave ${r.wave}`, `after ${r.min.toFixed(0)} min of battle; ages ${r.ages.map((a) => a.join('@')).join(' ')}`);
  process.exit(0);
}

// name, how the bot plays, siege level
const rows = [
  ['no spending', { spend: false }, 1],
  ['relaxed, easy waves', { pick: 'easy' }, 0],
  ['normal, easy waves', { pick: 'easy' }, 1],
  ['normal, mixed waves', { pick: 'mixed' }, 1],
  ['normal, hard waves', { pick: 'hard' }, 1],
  ['siege 3, easy', { pick: 'easy' }, 3],
  ['siege 6, easy', { pick: 'easy' }, 6],
  ['siege 10, easy', { pick: 'easy' }, 10],
  ['siege 14, easy', { pick: 'easy' }, 14],
  ['siege 20, easy', { pick: 'easy' }, 20],
];
const only = arg('row', '');
// Other siege levels than the standard rows, with one way of choosing waves.
const extra = arg('siege', '');
if (extra) rows.splice(0, rows.length, ...extra.split(',').map((n) => [`siege ${n}, ${arg('pick', 'easy')}`, { pick: arg('pick', 'easy') }, Number(n)]));
console.log(`${SEEDS} seeds each, to the fall of the castle (cap: wave ${CAP}). A year is ${YEAR_LEN} waves. Named siege levels: ${SIEGE.map((s) => s.key).join(', ')}`);
console.log(`${'row'.padEnd(21)}${'median'.padStart(7)}${'year 1'.padStart(8)}${'min'.padStart(6)}   fell on wave (sorted)${' '.repeat(18)}ages reached at wave (median)`);
for (const [name, opt, siege] of rows) {
  if (only && !name.includes(only)) continue;
  const rs = Array.from({ length: SEEDS }, (_, i) => run(11 * (i + 1), opt, siege));
  const depth = rs.map((r) => r.wave), sorted = [...rs].sort((a, b) => a.wave - b.wave).map((r) => (r.alive ? `${r.wave}+` : r.wave)).join(', ');
  const year = rs.filter((r) => r.wave > YEAR_LEN).length;
  // The battle time of the runs that got past the first year says how long a good run lasts.
  const long = rs.filter((r) => r.wave > YEAR_LEN).map((r) => r.min);
  const ages = [0, 1, 2, 3, 4, 5].map((i) => { const v = rs.map((r) => r.ages[i]?.[1]).filter(Boolean); return v.length ? `${median(v)}${v.length < SEEDS ? `(${v.length})` : ''}` : '-'; });
  console.log(`${name.padEnd(21)}${String(median(depth)).padStart(7)}${`${year}/${SEEDS}`.padStart(8)}${(long.length ? median(long).toFixed(0) : '-').padStart(6)}   ${sorted.padEnd(38)} ${ages.join(', ')}`);
  if (VERBOSE) for (const r of rs) { console.log(`    seed run to ${r.wave}${r.alive ? '+' : ''}, ${r.min.toFixed(0)} min, path ${r.path || '-'}, renown ${r.renown ?? '-'}`); for (const s of r.seasons) console.log('       ', s); }
}
console.log('median: the wave the middle run fell on. year 1: runs that got past the first year. min: battle minutes of those runs (median).');
console.log('ages: the wave at which the stone, iron and golden age and the three ages of a path were reached; (n) when only n runs got there.');
