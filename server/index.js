// HTTP static server + WebSocket game server on one port.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { randomInt } from 'node:crypto';
import { Game, TICK, seededRng } from './game.js';
import { act, runOptions } from './act.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// The rules are served too: the same files run in the browser when the game is played without a server.
const MOUNTS = [
  ['/vendor/three/', path.join(ROOT, 'node_modules/three/')],
  ['/rules/', path.join(ROOT, 'server/')],
  ['/', path.join(ROOT, 'client/')],
];
const RULE_FILES = new Set(['game.js', 'data.js', 'act.js']);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };
export const MAX_PLAYERS = 4;
const MAX_ROOMS = 200;
const LAYOUT = new Game().layout();

function serveStatic(req, res) {
  const notFound = () => { res.writeHead(404); res.end('Not found'); };
  let url;
  try { url = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { return notFound(); }
  if (url === '/') url = '/index.html';
  if (url === '/layout.json') {
    // The castle layout is the same for every game, so the menu can show it before joining.
    res.writeHead(200, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-cache' });
    return res.end(JSON.stringify(LAYOUT));
  }
  for (const [prefix, dir] of MOUNTS) {
    if (!url.startsWith(prefix)) continue;
    const rel = url.slice(prefix.length), file = path.join(dir, rel);
    if (!file.startsWith(dir) || (prefix === '/rules/' && !RULE_FILES.has(rel))) break;
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
  const wss = new WebSocketServer({ server, maxPayload: 64 * 1024 });

  function openRoom(solo, m) {
    if (rooms.size >= MAX_ROOMS) return null;
    let code;
    do code = solo ? `solo-${randomInt(1e9)}` : newCode(); while (rooms.has(code));
    // A daily challenge is dealt from its seed, so everyone gets the same run.
    const rng = Number.isInteger(m.seed) ? seededRng(m.seed) : Math.random;
    const room = { code, solo, game: new Game(rng, runOptions(m)), clients: new Set(), phase: 'prep', speed: 1 };
    rooms.set(code, room);
    return room;
  }

  // Solo runs are saved in the player's browser between waves, so they can be continued later.
  function sendSave(room) {
    if (!room.solo) return;
    const ph = room.game.phase;
    if (ph === 'wave') return;
    const msg = JSON.stringify({ t: 'save', d: ph === 'over' ? null : room.game.save() });
    for (const c of room.clients) if (c.readyState === 1) c.send(msg);
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
          r = openRoom(m.mode !== 'create', m);
          if (!r) return reply({ t: 'err', why: 'busy' });
          if (r.solo && m.save && !r.game.load(m.save)) reply({ t: 'err', why: 'badsave' });
        }
        room = r;
        room.clients.add(ws);
        id = room.game.addPlayer();
        reply({ t: 'hello', id, room: room.solo ? null : room.code, layout: room.game.layout() });
        sendSave(room);
        return;
      }
      if (!room) return;
      if (m.t === 'speed') { if (room.solo && [0, 1, 2, 3].includes(m.v)) room.speed = m.v; return; }
      if (act(room.game, id, m, dev)) sendSave(room);
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
      // Solo games can be paused or sped up; the rules always advance in the same fixed steps.
      for (let i = 0; i < room.speed; i++) room.game.step(TICK);
      if (room.game.phase !== room.phase) { room.phase = room.game.phase; if (room.phase !== 'wave') sendSave(room); }
      const msg = JSON.stringify({ ...room.game.snapshot(), spd: room.speed });
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
    .ready.then((port) => console.log(`Hordewall: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`));
}
