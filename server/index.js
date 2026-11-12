// HTTP static server + WebSocket game server on one port.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { randomInt } from 'node:crypto';
import { Game, TICK, DIFFICULTY, LORDS, levelNeed, FINAL_WAVE } from './game.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MOUNTS = [
  ['/vendor/three/', path.join(ROOT, 'node_modules/three/')],
  ['/', path.join(ROOT, 'client/')],
];
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
  const wss = new WebSocketServer({ server, maxPayload: 64 * 1024 });

  function openRoom(solo, diff, lord) {
    if (rooms.size >= MAX_ROOMS) return null;
    let code;
    do code = solo ? `solo-${randomInt(1e9)}` : newCode(); while (rooms.has(code));
    const room = { code, solo, game: new Game(Math.random, Object.hasOwn(DIFFICULTY, diff) ? diff : 'normal', Object.hasOwn(LORDS, lord) ? lord : 'marshal'), clients: new Set(), phase: 'prep', speed: 1 };
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
          r = openRoom(m.mode !== 'create', m.diff, m.lord);
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
      const game = room.game;
      let done = false;
      if (m.t === 'wave') done = game.chooseWave(id, m.i);
      else if (m.t === 'pick') done = game.choose(id, m.i);
      else if (m.t === 'skip') done = game.skip(id);
      else if (m.t === 'repick') done = game.rerollPick(id);
      else if (m.t === 'buy') done = game.buy(id, m.i);
      else if (m.t === 'lock') done = game.lock(id, m.i);
      else if (m.t === 'reroll') done = game.rerollShop(id);
      else if (m.t === 'train') done = game.train(id, m.u);
      else if (m.t === 'dismiss') done = game.dismiss(id, m.u);
      else if (m.t === 'up') done = game.upgrade(id, m.b);
      else if (m.t === 'repair') done = game.repair(id, m.what);
      else if (m.t === 'restart') done = game.restart(id);
      else if (m.t === 'ability') done = game.ability(id, m.k, m.x, m.z);
      else if (m.t === 'speed' && room.solo && [0, 1, 2, 3].includes(m.v)) room.speed = m.v;
      else if (m.t === 'dev' && dev) {
        done = true;
        if (m.k === 'gold') game.gold += 500 + game.gold;
        else if (m.k === 'boss' && game.phase === 'prep') { game.wave = Math.floor(game.wave / 10) * 10 + 9; game.makeWaveOffers(); }
        else if (m.k === 'hurt') game.th.hp = Math.min(game.th.hp, 60);
        else if (m.k === 'skip' && game.phase === 'prep') { game.wave += 9; game.makeWaveOffers(); game.makeShop(); }
        else if (m.k === 'victory' && game.phase === 'prep') { game.wave = FINAL_WAVE; game.won = true; game.picks.unshift({ type: 'victory' }); game.nextPick(); }
        else if (m.k === 'level' && game.phase === 'prep') { game.castleXp(levelNeed(game.level) - game.xp); game.nextPick(); }
      }
      if (done) sendSave(room);
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
    .ready.then((port) => console.log(`Castle defense: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`));
}
