// Balance report: how far do bot commanders get, and how much battle time does a run hold?
// Usage: node test/balance.js [maxWaves] [-v] [--row=name]
import { TICK, FINAL_WAVE } from '../server/game.js';
import { newGame, botTurn } from './bots.js';

const MAX_WAVES = Number(process.argv[2]) || 40;
const MARKS = [5, 10, 20, 30, 40, 50, 60, 80, 100];

function run(seed, opt, diff) {
  const { g, id } = newGame(seed, 1, diff);
  const marks = {};
  let ticks = 0, wonAt = null;
  while (ticks < 3600 * 60 * 20) {
    if (g.wave >= MAX_WAVES && g.phase !== 'wave') return { wave: g.wave, min: (ticks * TICK) / 60, alive: true, marks, wonAt };
    const w = g.wave;
    botTurn(g, id, opt);
    if (g.wave > w && MARKS.includes(g.wave)) {
      const fam = Object.entries(g.famTier).filter((e) => e[1]).map((e) => e.join('')).join(' ');
      marks[g.wave] = `${(ticks * TICK / 60).toFixed(0)}m b${Object.values(g.b).join('.')} u${g.units.length} t${g.turrets.length} L${g.level} lv${Math.round(g.units.reduce((a, u) => a + u.lv, 0) / g.units.length)} g${g.gold} ${fam}`;
    }
    if (g.won && wonAt === null) wonAt = (ticks * TICK) / 60;
    g.step(TICK);
    ticks++;
    if (g.phase === 'over') return { wave: g.reached, min: (ticks * TICK) / 60, marks, wonAt };
  }
  return { wave: g.wave, min: (ticks * TICK) / 60, alive: true, marks, wonAt };
}

const rows = [
  ['no spending, easy', { spend: false }, 'normal'],
  ['easy waves', { pick: 'easy' }, 'normal'],
  ['mixed waves', { pick: 'mixed' }, 'normal'],
  ['hard waves', { pick: 'hard' }, 'normal'],
  ['relaxed, easy', { pick: 'easy' }, 'relaxed'],
  ['brutal, easy', { pick: 'easy' }, 'brutal'],
];
const only = process.argv.find((a) => a.startsWith('--row='))?.slice(6);
for (const [name, opt, diff] of rows) {
  if (only && !name.includes(only)) continue;
  const rs = [11, 22, 33, 44].map((seed) => run(seed, opt, diff));
  const waves = rs.map((r) => (r.alive ? `${r.wave}+` : r.wave)).join(', ');
  const won = rs.map((r) => (r.wonAt ? `${r.wonAt.toFixed(0)}m` : '-')).join(', ');
  console.log(`${name.padEnd(20)} waves ${waves.padEnd(18)} battle min ${rs.map((r) => r.min.toFixed(0)).join(', ').padEnd(16)} won at ${won}`);
  if (process.argv.includes('-v')) console.log('   ', JSON.stringify(rs[0].marks));
}
