// Plays bot runs and saves the castle as it stands right before every wave the bot is about to
// choose (after its spending), so the same castle can be sent into the same wave under other rules.
// ROOT=<repo> node snap.mjs pick from count upTo outDir [minWave]
import { pathToFileURL } from 'node:url';
import { writeFileSync, mkdirSync } from 'node:fs';
import v8 from 'node:v8';
const ROOT = process.env.ROOT;
const G = await import(pathToFileURL(`${ROOT}/server/game.js`));
const B = await import(pathToFileURL(`${ROOT}/test/bots.js`));
const [pick, from, count, upTo, out, minWave = 6] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
let saved = 0;
for (let i = Number(from); i < Number(from) + Number(count); i++) {
  const seed = 11 * (i + 1);
  const { g, id } = B.newGame(seed, 1, { siege: 1 });
  const choose = g.chooseWave.bind(g);
  g.chooseWave = (pid, k) => {
    const n = g.wave + 1;
    if (g.phase === 'prep' && n >= Number(minWave) && g.waves[k]) {
      const data = {};
      for (const key of Object.keys(g)) if (typeof g[key] !== 'function') data[key] = g[key];
      writeFileSync(`${out}/${pick}-${String(seed).padStart(4, '0')}-${String(n).padStart(2, '0')}.bin`, v8.serialize({ seed, n, id: pid, pick, chosen: g.waves[k].tier, boss: G.bossIndex(n) >= 0, data }));
      saved++;
    }
    return choose(pid, k);
  };
  let idle = 0, lw = -1, lp = '';
  while (g.phase !== 'over' && !(g.wave >= Number(upTo) && g.phase !== 'wave')) {
    B.botTurn(g, id, { pick });
    g.step(G.TICK);
    if (g.wave === lw && g.phase === lp) idle++; else { idle = 0; lw = g.wave; lp = g.phase; }
    if (idle > 40 * 60 / G.TICK) break;
  }
}
console.log(`saved ${saved} castles`);
