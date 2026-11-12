// The real server on a random port: static files, rooms, snapshots, bad input.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { start, MAX_PLAYERS } from '../server/index.js';

let srv, port;
before(async () => { srv = start({ port: 0 }); port = await srv.ready; });
after(() => srv.close());

const get = (path) => fetch(`http://127.0.0.1:${port}${path}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// A client that collects every message and can wait for the next one of a given type.
function client(p = port) {
  const ws = new WebSocket(`ws://127.0.0.1:${p}`);
  const msgs = [], waiters = [];
  ws.on('message', (raw) => {
    const m = JSON.parse(raw);
    msgs.push(m);
    for (let i = waiters.length - 1; i >= 0; i--) if (waiters[i].t === m.t) waiters.splice(i, 1)[0].resolve(m);
  });
  const c = {
    ws, msgs,
    open: new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); }),
    closed: new Promise((res) => ws.on('close', res)),
    send: (m) => ws.send(typeof m === 'string' ? m : JSON.stringify(m)),
    next: (t, ms = 2000) => new Promise((resolve, reject) => {
      waiters.push({ t, resolve });
      setTimeout(() => reject(new Error(`no "${t}" message within ${ms} ms`)), ms).unref();
    }),
    async join(mode = 'solo', code) { await c.open; c.send({ t: 'join', mode, code }); return c.next('hello'); },
    async close() { ws.close(); await c.closed; await wait(20); },
  };
  return c;
}

test('serves the client and the three.js module', async () => {
  const index = await get('/');
  assert.equal(index.status, 200);
  assert.match(index.headers.get('content-type'), /text\/html/);
  assert.match(await index.text(), /main\.js/);
  const main = await get('/main.js');
  assert.equal(main.status, 200);
  assert.match(main.headers.get('content-type'), /javascript/);
  assert.equal((await get('/vendor/three/build/three.module.js')).status, 200);
});

test('does not serve files outside the client and vendor folders', async () => {
  for (const path of ['/../package.json', '/%2e%2e/package.json', '/..%2fpackage.json', '/vendor/three/..%2f..%2fpackage.json', '/vendor/three/../../server/game.js', '/nope.js']) {
    const r = await get(path);
    assert.equal(r.status, 404, path);
    await r.text();
  }
});

test('a malformed URL gets a 404 instead of crashing the server', async () => {
  assert.equal((await get('/%E0%A4%A')).status, 404);
  assert.equal((await get('/')).status, 200, 'still serving');
});

test('solo: a private room, the layout, then about 20 snapshots per second', async () => {
  const a = client();
  const hello = await a.join('solo');
  assert.equal(hello.room, null, 'a solo room has no code to share');
  assert.equal(hello.layout.segs.length, 28);
  assert.equal(hello.layout.slots.length, 32);
  assert.deepEqual(hello.layout.units, ['archer', 'spear', 'mage', 'crossbow']);
  await a.next('s');
  const n0 = a.msgs.length;
  await wait(500);
  const got = a.msgs.length - n0;
  assert.ok(got >= 6 && got <= 14, `${got} snapshots in 0.5 s`);
  const s = a.msgs.at(-1);
  assert.equal(s.ph, 'prep'); assert.equal(s.np, 1); assert.equal(s.wv.length, 2); assert.equal(s.gold, 100);
  await a.close();
  assert.equal(srv.rooms.size, 0, 'an empty room is removed');
});

test('two solo players get separate games', async () => {
  const a = client(), b = client();
  await a.join('solo'); await b.join('solo');
  assert.equal(srv.rooms.size, 2);
  a.send({ t: 'wave', i: 0 });
  await wait(200);
  assert.equal((await a.next('s')).ph, 'wave');
  const sb = await b.next('s');
  assert.equal(sb.ph, 'prep'); assert.equal(sb.np, 1);
  await a.close(); await b.close();
});

test('co-op: a room code lets friends share one castle and its gold', async () => {
  const a = client(), b = client();
  const ha = await a.join('create');
  assert.match(ha.room, /^[A-Z]{4}$/);
  const hb = await b.join('join', ha.room.toLowerCase());
  assert.equal(hb.room, ha.room);
  assert.equal((await a.next('s')).np, 2);
  b.send({ t: 'buy', k: 'archer' });
  await wait(150);
  const sa = await a.next('s');
  assert.equal(sa.gold, 100 - 41, 'the other commander sees the purchase (fifth archer costs 41)');
  assert.equal(sa.un.length, 5);
  a.send({ t: 'wave', i: 1 });
  await wait(150);
  assert.equal((await b.next('s')).ph, 'wave', 'one click starts the wave for everyone');
  await a.close();
  assert.equal(srv.rooms.size, 1, 'the room lives on while someone is in it');
  await b.close();
  assert.equal(srv.rooms.size, 0);
});

test('joining needs a real code; a room holds four commanders', async () => {
  const lost = client();
  await lost.open;
  lost.send({ t: 'join', mode: 'join', code: 'ZZZZ' });
  assert.equal((await lost.next('err')).why, 'noroom');
  lost.send({ t: 'join', mode: 'join' });
  assert.equal((await lost.next('err')).why, 'noroom');
  const host = client(), hello = await host.join('create'), cs = [host];
  for (let i = 1; i < MAX_PLAYERS; i++) { const c = client(); await c.join('join', hello.room); cs.push(c); }
  lost.send({ t: 'join', mode: 'join', code: hello.room });
  assert.equal((await lost.next('err')).why, 'full');
  const solo = client(), hs = await solo.join('solo');
  assert.equal(hs.room, null);
  const sneak = client();
  await sneak.open;
  sneak.send({ t: 'join', mode: 'join', code: [...srv.rooms.keys()].find((k) => k.startsWith('solo-')) });
  assert.equal((await sneak.next('err')).why, 'noroom', 'solo rooms cannot be joined');
  for (const c of [...cs, lost, solo, sneak]) await c.close();
  assert.equal(srv.rooms.size, 0);
});

test('garbage and oversized messages are ignored', async () => {
  const a = client();
  await a.open;
  a.send('not json'); a.send('null'); a.send('[1,2]'); a.send({ t: 'wave', i: 0 }); a.send({ t: 'up', b: 'hall' });
  await wait(100);
  assert.equal(srv.rooms.size, 0, 'nothing happens before joining');
  await a.join('solo');
  a.send({ t: 'join', mode: 'create' });
  a.send({ t: 'up', b: '__proto__' }); a.send({ t: 'buy', k: 'constructor' }); a.send({ t: 'promote', k: 'toString' }); a.send({ t: 'perk', k: 1 }); a.send({ t: 'repair' });
  a.send({ t: 'wave', i: 'x' }); a.send({ t: 'wave', i: 5 }); a.send({ t: 'wave' });
  a.send({ t: 'dev', k: 'gold' });
  await wait(200);
  const s = await a.next('s');
  assert.equal(srv.rooms.size, 1, 'a second join is ignored');
  assert.equal(s.gold, 100, 'nothing was bought and dev shortcuts are off');
  assert.equal(s.ph, 'prep');
  a.send('x'.repeat(5000));
  await a.closed;
  await wait(50);
  assert.equal(srv.rooms.size, 0, 'an oversized message drops the connection');
  assert.equal((await get('/')).status, 200, 'the server is still up');
});

test('dev shortcuts work only on a server started with dev', async () => {
  const dev = start({ port: 0, dev: true });
  const a = client(await dev.ready);
  await a.join('solo');
  a.send({ t: 'dev', k: 'gold' }); a.send({ t: 'dev', k: 'boss' });
  await wait(150);
  const s = await a.next('s');
  assert.equal(s.gold, 600);
  assert.ok(s.wv.every((w) => w.c[2] === 1), 'the next wave is a Queen wave');
  await dev.close();
});
