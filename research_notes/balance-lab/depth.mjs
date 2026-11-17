// Depth table from whole runs played to the fall of the castle. node depth.mjs name=file.all ...
import { readFileSync } from 'node:fs';
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
for (const a of process.argv.slice(2)) {
  const [name, file] = a.split('=');
  const runs = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((l) => l.k === 'run');
  const depth = runs.map((r) => r.wave), past = runs.filter((r) => r.wave > 32);
  const q = (p) => [...depth].sort((x, y) => x - y)[Math.min(depth.length - 1, Math.floor(p * depth.length))];
  const ages = [0, 1, 2, 3, 4, 5].map((i) => { const v = runs.map((r) => r.ages[i]).filter(Boolean); return v.length ? `${med(v)}(${v.length})` : '-'; });
  console.log(`${name.padEnd(22)} runs ${String(runs.length).padStart(3)}  median ${String(med(depth)).padStart(3)}  mean ${(depth.reduce((x, y) => x + y, 0) / depth.length).toFixed(1).padStart(5)}  quartiles ${q(0.25)}-${q(0.75)}  deepest ${Math.max(...depth)}  past year one ${past.length}/${runs.length} (${Math.round(100 * past.length / runs.length)}%)  minutes ${past.length ? med(past.map((r) => r.min)).toFixed(0) : '-'}  still standing ${runs.filter((r) => !r.fell).length}  stuck ${runs.filter((r) => r.stuck).length}  ages ${ages.join(' ')}`);
}
