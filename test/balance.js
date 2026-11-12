// Balance report: how far do bot commanders get, and how long does a run last?
// Usage: node test/balance.js [minutes] [-v]
import { TICK } from '../server/game.js';
import { newGame, botTurn } from './bots.js';

const MINUTES = Number(process.argv[2]) || 60;

function run(seed, opt) {
  const { g, id } = newGame(seed);
  const marks = {};
  for (let i = 0; i < (MINUTES * 60) / TICK; i++) {
    const w = g.wave;
    botTurn(g, id, opt);
    if (g.wave > w && [5, 10, 15, 20, 25].includes(g.wave)) marks[g.wave] = `${(i * TICK / 60).toFixed(1)}m b${Object.values(g.b).join('')} units${g.units.length} gold${g.gold}`;
    g.step(TICK);
    if (g.phase === 'over') return { wave: g.reached, min: (i * TICK) / 60, marks };
  }
  return { wave: g.wave, min: MINUTES, alive: true, marks };
}

const rows = [
  ['no spending, easy waves', { spend: false }],
  ['easy waves', { pick: 'easy' }],
  ['mixed waves', { pick: 'mixed' }],
  ['hard waves', { pick: 'hard' }],
];
for (const [name, opt] of rows) {
  const rs = [11, 22, 33, 44].map((seed) => run(seed, opt));
  const waves = rs.map((r) => (r.alive ? `${r.wave}+` : r.wave)).join(', ');
  console.log(`${name.padEnd(26)} waves ${waves.padEnd(18)} minutes ${rs.map((r) => r.min.toFixed(0)).join(', ')}`);
  if (process.argv.includes('-v')) console.log('   ', JSON.stringify(rs[0].marks));
}
