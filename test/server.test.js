// The real server on a random port: static files, joining, snapshots, bad input.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { start, MAX_PLAYERS } from '../server/index.js';

let srv, port;
before(async () => { srv = start({ port: 0 }); port = await srv.ready; });
after(() => srv.close());

const get = (path) => fetch(`http://127.0.0.1:${port}${path}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// A client that collects every message and can wait for one of a given type.
function client() {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
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
    async join(cls = 'archer') { await c.open; c.send({ t: 'join', cls }); return c.next('hello'); },
    async close() { ws.close(); await c.closed; await wait(20); },
  };
  return c;
}

test('serves the client and the three.js module', async () => {
  const index = await get('/');
  assert.equal(index.status, 200);
  assert.match(index.headers.get('content-type'), /text\/html/);
  assert.match(await index.text(), /<canvas|main\.js/);
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

test('joining returns the layout, then snapshots arrive at about 20 per second', async () => {
  const a = client();
  const hello = await a.join('mage');
  assert.equal(typeof hello.id, 'number');
  assert.equal(hello.layout.segs.length, 28);
  assert.equal(hello.layout.towers.length, 4);
  assert.ok(hello.layout.buildings.hall && hello.layout.gear.wpn && hello.layout.perks.length >= 6);
  await a.next('s');
  const n0 = a.msgs.length;
  await wait(500);
  const got = a.msgs.length - n0;
  assert.ok(got >= 6 && got <= 14, `${got} snapshots in 0.5 s`);
  const s = a.msgs.at(-1);
  assert.equal(s.ph, 'prep'); assert.equal(s.wave, 0);
  assert.equal(s.pl.length, 1); assert.equal(s.pl[0][0], hello.id); assert.equal(s.pl[0][1], 'mage');
  await a.close();
  assert.equal(srv.game.players.size, 0, 'leaving removes the hero');
});

test('input moves the hero; the wave starts only when everyone is ready', async () => {
  const a = client(), b = client();
  const ha = await a.join('knight'); await b.join('archer');
  const before = (await a.next('s')).pl.find((r) => r[0] === ha.id);
  a.send({ t: 'in', mx: 1, mz: 0, aim: 1, atk: false });
  await wait(400);
  const after = (await a.next('s')).pl.find((r) => r[0] === ha.id);
  assert.ok(after[2] > before[2] + 1, `x moved from ${before[2]} to ${after[2]}`);
  assert.equal((await b.next('s')).pl.length, 2, 'both clients see both heroes');
  a.send({ t: 'ready' });
  await wait(300);
  assert.equal((await a.next('s')).ph, 'prep', 'one ready player is not enough');
  b.send({ t: 'ready' });
  await wait(200);
  const s = await b.next('s');
  assert.equal(s.ph, 'wave'); assert.equal(s.wave, 1);
  await a.close(); await b.close();
  assert.equal(srv.game.wave, 0, 'an empty room resets the run');
});

test('the room holds four players; the fifth is turned away', async () => {
  const cs = [];
  for (let i = 0; i < MAX_PLAYERS; i++) { const c = client(); await c.join(); cs.push(c); }
  const extra = client();
  await extra.open;
  extra.send({ t: 'join', cls: 'knight' });
  await extra.next('full');
  await extra.closed;
  assert.equal(srv.game.players.size, MAX_PLAYERS);
  for (const c of cs) await c.close();
});

test('garbage and oversized messages are ignored', async () => {
  const a = client();
  await a.open;
  a.send('not json'); a.send('null'); a.send('[1,2]'); a.send({ t: 'ready' }); a.send({ t: 'up', b: 'hall' });
  await wait(100);
  assert.equal(srv.game.players.size, 0, 'nothing happens before joining');
  const hello = await a.join('__proto__');
  assert.equal((await a.next('s')).pl[0][1], 'knight');
  a.send({ t: 'join', cls: 'mage' });
  a.send({ t: 'in', mx: 'x', mz: null, aim: {}, atk: [] });
  a.send({ t: 'up', b: '__proto__' }); a.send({ t: 'stat', k: 'constructor' }); a.send({ t: 'gear', k: 'toString' }); a.send({ t: 'perk', k: 1 }); a.send({ t: 'repair' });
  a.send({ t: 'dev', k: 'gold' });
  await wait(200);
  const s = await a.next('s');
  assert.equal(s.pl.length, 1, 'a second join is ignored');
  assert.equal(s.gold, 0, 'dev shortcuts are off by default');
  assert.ok(Number.isFinite(s.pl.find((r) => r[0] === hello.id)[2]));
  a.send('x'.repeat(5000));
  await a.closed;
  await wait(50);
  assert.equal(srv.game.players.size, 0, 'an oversized message drops the connection');
  assert.equal((await get('/')).status, 200, 'the server is still up');
});

test('dev shortcuts work only on a server started with dev', async () => {
  const dev = start({ port: 0, dev: true });
  const p = await dev.ready;
  const ws = new WebSocket(`ws://127.0.0.1:${p}`);
  await new Promise((r) => ws.on('open', r));
  ws.send(JSON.stringify({ t: 'join', cls: 'knight' }));
  await wait(100);
  ws.send(JSON.stringify({ t: 'dev', k: 'gold' }));
  await wait(100);
  assert.equal(dev.game.gold, 500);
  await dev.close();
});
