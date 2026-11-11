// Balance report: how far do bot teams get, and how long does a run last?
// Usage: node test/balance.js [minutes]
import { Game, TICK } from '../server/game.js';
import { seeded, botInput, botSpend } from './bots.js';

const MINUTES = Number(process.argv[2]) || 60;
const idle = { mx: 0, mz: 0, aim: 0, atk: false };

function run(classes, seed, { fight = true, spend = true } = {}) {
  const g = new Game(seeded(seed));
  const ps = classes.map((c) => g.addPlayer(c));
  const marks = {};
  for (let i = 0; i < (MINUTES * 60) / TICK; i++) {
    for (const p of ps) { g.setInput(p.id, fight ? botInput(g, p) : idle); g.setReady(p.id); }
    if (spend) botSpend(g, ps);
    const w = g.wave;
    g.step(TICK);
    if (g.wave > w && [5, 10, 15, 20].includes(g.wave)) marks[g.wave] = `${(i * TICK / 60).toFixed(1)}m L${ps.map((p) => p.lvl).join('/')} b${Object.values(g.b).join('')} w${ps[0].wpn} gold${g.gold}`;
    if (g.phase === 'over') return { wave: g.reached, min: (i * TICK) / 60, marks };
  }
  return { wave: g.wave, min: MINUTES, alive: true, marks };
}

const rows = [
  ['castle only, no spending', ['knight'], { fight: false, spend: false }],
  ['castle only, spending', ['knight'], { fight: false }],
  ['solo knight', ['knight'], {}],
  ['solo archer', ['archer'], {}],
  ['solo mage', ['mage'], {}],
  ['duo archer+mage', ['archer', 'mage'], {}],
  ['four', ['knight', 'archer', 'mage', 'archer'], {}],
];
for (const [name, team, opt] of rows) {
  const rs = [11, 22, 33].map((seed) => run(team, seed, opt));
  const waves = rs.map((r) => (r.alive ? `${r.wave}+` : r.wave)).join(', ');
  const mins = rs.map((r) => r.min.toFixed(0)).join(', ');
  console.log(`${name.padEnd(26)} waves ${waves.padEnd(14)} minutes ${mins}`);
  if (process.argv.includes('-v')) console.log('   ', JSON.stringify(rs[0].marks));
}
