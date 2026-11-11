// HTTP static server + WebSocket game server on one port.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Game, TICK, xpNext } from './game.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MOUNTS = [
  ['/vendor/three/', path.join(ROOT, 'node_modules/three/')],
  ['/', path.join(ROOT, 'client/')],
];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';

const server = http.createServer((req, res) => {
  let url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (url === '/') url = '/index.html';
  for (const [prefix, dir] of MOUNTS) {
    if (!url.startsWith(prefix)) continue;
    const file = path.join(dir, url.slice(prefix.length));
    if (!file.startsWith(dir)) break;
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(data);
    });
    return;
  }
  res.writeHead(404); res.end('Not found');
});

const game = new Game();
const wss = new WebSocketServer({ server });
const MAX_PLAYERS = 4;
const DEV = process.argv.includes('--dev');   // testing aid: lets a client grant gold

wss.on('connection', (ws) => {
  let player = null;
  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;
    if (m.t === 'join' && !player) {
      if (game.players.size >= MAX_PLAYERS) { ws.send(JSON.stringify({ t: 'full' })); ws.close(); return; }
      player = game.addPlayer(m.cls);
      ws.send(JSON.stringify({ t: 'hello', id: player.id, layout: game.layout() }));
    } else if (!player) return;
    else if (m.t === 'in') game.setInput(player.id, m);
    else if (m.t === 'ready') game.setReady(player.id);
    else if (m.t === 'cls') game.setClass(player.id, m.cls);
    else if (m.t === 'up') game.upgrade(player.id, m.b);
    else if (m.t === 'repair') game.repair(player.id, m.what);
    else if (m.t === 'perk') game.choosePerk(player.id, m.k);
    else if (m.t === 'stat') game.addStat(player.id, m.k);
    else if (m.t === 'gear') game.buyGear(player.id, m.k);
    else if (m.t === 'dev' && DEV) {
      if (m.k === 'gold') { game.gold += 500; game.giveXp(player, xpNext(player.lvl)); }
      else if (m.k === 'boss' && game.phase === 'prep') game.wave = Math.floor(game.wave / 10) * 10 + 9;
      else if (m.k === 'hurt') game.th.hp = Math.min(game.th.hp, 60);
    }
  });
  ws.on('close', () => { if (player) game.removePlayer(player.id); });
});

setInterval(() => {
  game.step(TICK);
  if (!game.players.size) return;
  const msg = JSON.stringify(game.snapshot());
  for (const c of wss.clients) if (c.readyState === 1) c.send(msg);
}, TICK * 1000);

server.listen(PORT, HOST, () => console.log(`Kale savunma: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`));
