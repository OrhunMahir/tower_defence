// Reads the workers' JSON lines from stdin and prints the tables. Flags: -d deaths, -t themes, -w by wave, -a all.
import { readFileSync } from 'node:fs';
const lines = readFileSync(0, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const rows = lines.filter((l) => l.k === 'wave'), runs = lines.filter((l) => l.k === 'run').sort((a, b) => a.wave - b.wave);
const has = (f) => process.argv.includes(f) || process.argv.includes('-a');
const title = process.argv.find((a) => a.startsWith('--title=')), Y = Number((process.argv.find((a) => a.startsWith('--year=')) || '--year=32').slice(7));
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const deaths = rows.filter((r) => r.dead);
const hb = rows.filter((r) => r.tier === 'hard' && r.th === 'battering');
const y1 = runs.filter((r) => r.wave > Y).length, d = (lo, hi) => deaths.filter((r) => r.n >= lo && r.n <= hi).length;
const hard = rows.filter((r) => r.tier === 'hard' && r.n <= Y), std = rows.filter((r) => r.tier === 'std' && r.n <= Y);
const full = deaths.filter((r) => r.n <= Y && r.keep0 > 0.95).length, dy = deaths.filter((r) => r.n <= Y).length;
console.log(`${title ? title.slice(8) + ': ' : ''}${runs.length} runs, median ${med(runs.map((r) => r.wave))}, past wave ${Y}: ${y1}/${runs.length} (${Math.round(100 * y1 / runs.length)}%), min ${med(runs.filter((r) => r.wave > Y).map((r) => r.min))?.toFixed(0) ?? '-'}`
  + ` | fell in w1-9: ${d(1, 9)}, w10-16: ${d(10, 16)}, w17-24: ${d(17, 24)}, w25-${Y}: ${d(25, Y)} | hard: ${hard.length} waves, ${hard.filter((r) => r.dead).length} fell (${(100 * hard.filter((r) => r.dead).length / Math.max(1, hard.length)).toFixed(1)}%), keep lost ${(100 * hard.reduce((a, r) => a + r.keep, 0) / Math.max(1, hard.length)).toFixed(0)}%`
  + ` | std: ${std.length} waves, ${std.filter((r) => r.dead).length} fell, keep lost ${(100 * std.reduce((a, r) => a + r.keep, 0) / Math.max(1, std.length)).toFixed(1)}% | hard battering ${hb.filter((r) => r.n <= Y).length}/${hb.filter((r) => r.dead && r.n <= Y).length} fell | from a full keep ${full}/${dy}${runs.some((r) => r.stuck) ? ' | STUCK ' + runs.filter((r) => r.stuck).map((r) => r.seed) : ''}`);
if (has('-r')) console.log('  fell on: ' + runs.map((r) => (r.fell ? r.wave : `${r.wave}+`)).join(' '));
if (has('-d')) for (const x of deaths) console.log(`  seed ${x.seed} w${x.n} ${x.tier}/${x.th}${x.mod ? `+${x.mod}` : ''} ${x.weather} ${x.t.toFixed(0)}s [${x.c}] hx ${x.hx} keep ${x.keep0.toFixed(2)} walls ${x.walls0.toFixed(2)} down ${x.down} | units ${x.units} L${x.level} b${x.b} age ${x.age} muts ${x.muts}`);
const by = (key, filter) => {
  const m = new Map();
  for (const r of rows.filter(filter)) { const k = key(r); const a = m.get(k) || { n: 0, dead: 0, keep: 0, walls: 0, down: 0, bad: 0 }; a.n++; a.dead += r.dead; a.keep += r.keep; a.walls += r.walls; a.down += r.down; a.bad += r.keep > 0.3 || r.dead; m.set(k, a); }
  return [...m.entries()].sort((a, b) => b[1].dead / b[1].n - a[1].dead / a[1].n || b[1].keep / b[1].n - a[1].keep / a[1].n)
    .map(([k, a]) => `  ${String(k).padEnd(22)} waves ${String(a.n).padStart(3)}  fell ${String(a.dead).padStart(2)} (${(100 * a.dead / a.n).toFixed(0).padStart(2)}%)  keep lost ${(100 * a.keep / a.n).toFixed(0).padStart(3)}%  walls lost ${(100 * a.walls / a.n).toFixed(0).padStart(3)}%  down ${(a.down / a.n).toFixed(1)}  bad ${a.bad}`).join('\n');
};
if (has('-t')) {
  console.log('hard waves by theme:\n' + by((r) => r.th, (r) => r.tier === 'hard' && r.n <= Y));
  console.log('std waves by theme:\n' + by((r) => r.th, (r) => r.tier === 'std' && r.n <= Y));
}
if (has('-m')) {
  console.log('hard waves by modifier:\n' + by((r) => r.mod || '-', (r) => r.tier === 'hard' && r.n <= Y));
  console.log('hard waves by weather:\n' + by((r) => r.weather, (r) => r.tier === 'hard' && r.n <= Y));
}
if (has('-w')) console.log('hard waves by wave number:\n' + by((r) => `w${String(r.n).padStart(2, '0')}`, (r) => r.tier === 'hard' && r.n <= Y).split('\n').sort().join('\n'));
