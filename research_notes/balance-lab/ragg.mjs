// Tables for replayed waves. node ragg.mjs [--title=x] [-t themes] [-w waves] [-m mods] < rows.jsonl
import { readFileSync } from 'node:fs';
const rows = readFileSync(0, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const has = (f) => process.argv.includes(f);
const title = (process.argv.find((a) => a.startsWith('--title=')) || '--title=').slice(8);
const stat = (rs) => { const n = rs.length || 1, dead = rs.filter((r) => r.dead).length, hurt = rs.filter((r) => !r.dead && r.keep > 0.3).length;
  return `${String(rs.length).padStart(4)} waves  fell ${String(dead).padStart(3)} (${(100 * dead / n).toFixed(1).padStart(4)}%)  badly hurt ${String(hurt).padStart(3)} (${(100 * hurt / n).toFixed(1).padStart(4)}%)  keep lost ${(100 * rs.reduce((a, r) => a + r.keep, 0) / n).toFixed(1).padStart(4)}%  walls lost ${(100 * rs.reduce((a, r) => a + r.walls, 0) / n).toFixed(1).padStart(4)}%  down ${(rs.reduce((a, r) => a + r.down, 0) / n).toFixed(2)}  ${(rs.reduce((a, r) => a + r.t, 0) / n).toFixed(0)}s  count ${(rs.reduce((a, r) => a + r.count, 0) / n).toFixed(0)}`; };
const group = (rs, key) => { const m = new Map(); for (const r of rs) { const k = key(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); } return m; };
for (const [mode, rs] of group(rows, (r) => r.mode)) {
  console.log(`${title} [${mode}] ${stat(rs)}${rs.some((r) => r.stuck) ? ' STUCK ' + rs.filter((r) => r.stuck).length : ''}`);
  const band = (r) => (r.n <= 9 ? 'w06-09' : r.n <= 16 ? 'w10-16' : r.n <= 24 ? 'w17-24' : 'w25-32');
  for (const [b, x] of [...group(rs, band)].sort()) console.log(`    ${b.padEnd(14)} ${stat(x)}`);
  if (has('-t') && mode === 'natural') for (const [th, x] of [...group(rs, (r) => r.th)].sort((a, b) => b[1].filter((r) => r.dead).length / b[1].length - a[1].filter((r) => r.dead).length / a[1].length)) console.log(`    ${th.padEnd(14)} ${stat(x)}`);
  if (has('-m') && mode === 'natural') { for (const [k, x] of [...group(rs, (r) => r.mod || '-')].sort()) console.log(`    mod ${k.padEnd(10)} ${stat(x)}`); for (const [k, x] of [...group(rs, (r) => r.weather)].sort()) console.log(`    wx ${k.padEnd(11)} ${stat(x)}`); }
  if (has('-w')) for (const [k, x] of [...group(rs, (r) => `w${String(r.n).padStart(2, '0')}`)].sort()) console.log(`    ${k.padEnd(14)} ${stat(x)}`);
}
