// HTTP static server + WebSocket game server on one port.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { randomInt } from 'node:crypto';
import { Game, TICK } from './game.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MOUNTS = [
  ['/vendor/three/', path.join(ROOT, 'node_modules/three/')],
  ['/', path.join(ROOT, 'client/')],
];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };
export const MAX_PLAYERS = 4;
const MAX_ROOMS = 200;

function serveStatic(req, res) {
  const notFound = () => { res.writeHead(404); res.end('Not found'); };
  let url;
  try { url = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { return notFound(); }
  if (url === '/') url = '/index.html';
  for (const [prefix, dir] of MOUNTS) {
    if (!url.startsWith(prefix)) continue;
    const file = path.join(dir, url.slice(prefix.length));
    if (!file.startsWith(dir)) break;
    fs.readFile(file, (err, data) => {
      if (err) return notFound();
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(data);
    });
    return;
  }
  notFound();
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const newCode = () => Array.from({ length: 4 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join('');

// Starts a game server. Every room is its own game: a solo room holds one commander,
// a co-op room up to four who share a four-letter code. `dev` enables testing shortcuts.
export function start({ port = 3000, host = '127.0.0.1', dev = false } = {}) {
  const server = http.createServer(serveStatic);
  const rooms = new Map();
  const wss = new WebSocketServer({ server, maxPayload: 2048 });

  function openRoom(solo) {
    if (rooms.size >= MAX_ROOMS) return null;
    let code;
    do code = solo ? `solo-${randomInt(1e9)}` : newCode(); while (rooms.has(code));
    const room = { code, solo, game: new Game(), clients: new Set() };
    rooms.set(code, room);
    return room;
  }

  wss.on('connection', (ws) => {
    let room = null, id = null;
    const reply = (m) => ws.send(JSON.stringify(m));
    ws.on('error', () => {});
    ws.on('message', (raw) => {
      let m;
      try { m = JSON.parse(raw); } catch { return; }
      if (!m || typeof m !== 'object') return;
      if (m.t === 'join' && !room) {
        let r;
        if (m.mode === 'join') {
          r = rooms.get(String(m.code || '').toUpperCase().slice(0, 8));
          if (!r || r.solo) return reply({ t: 'err', why: 'noroom' });
          if (r.clients.size >= MAX_PLAYERS) return reply({ t: 'err', why: 'full' });
        } else {
          r = openRoom(m.mode !== 'create');
          if (!r) return reply({ t: 'err', why: 'busy' });
        }
        room = r;
        room.clients.add(ws);
        id = room.game.addPlayer();
        reply({ t: 'hello', id, room: room.solo ? null : room.code, layout: room.game.layout() });
        return;
      }
      if (!room) return;
      const game = room.game;
      if (m.t === 'wave') game.chooseWave(id, m.i);
      else if (m.t === 'buy') game.recruit(id, m.k);
      else if (m.t === 'promote') game.promote(id, m.k);
      else if (m.t === 'up') game.upgrade(id, m.b);
      else if (m.t === 'repair') game.repair(id, m.what);
      else if (m.t === 'perk') game.choosePerk(id, m.k);
      else if (m.t === 'dev' && dev) {
        if (m.k === 'gold') game.gold += 500;
        else if (m.k === 'boss' && game.phase === 'prep') { game.wave = Math.floor(game.wave / 10) * 10 + 9; game.makeWaveOffers(); }
        else if (m.k === 'hurt') game.th.hp = Math.min(game.th.hp, 60);
      }
    });
    ws.on('close', () => {
      if (!room) return;
      room.clients.delete(ws);
      room.game.removePlayer(id);
      if (!room.clients.size) rooms.delete(room.code);
    });
  });

  const timer = setInterval(() => {
    for (const room of rooms.values()) {
      room.game.step(TICK);
      const msg = JSON.stringify(room.game.snapshot());
      for (const c of room.clients) if (c.readyState === 1) c.send(msg);
    }
  }, TICK * 1000);

  const ready = new Promise((resolve) => server.listen(port, host, () => resolve(server.address().port)));
  const close = () => new Promise((resolve) => {
    clearInterval(timer);
    for (const c of wss.clients) c.terminate();
    wss.close(() => server.close(() => resolve()));
  });
  return { server, rooms, ready, close };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const host = process.env.HOST || '127.0.0.1';
  start({ port: Number(process.env.PORT) || 3000, host, dev: process.argv.includes('--dev') })
    .ready.then((port) => console.log(`Castle defense: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`));
}
