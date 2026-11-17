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
    // The first message of type t, whether it has already arrived or not.
    seen: (t) => { const m = msgs.find((x) => x.t === t); return m ? Promise.resolve(m) : c.next(t); },
    next: (t, ms = 2000) => new Promise((resolve, reject) => {
      waiters.push({ t, resolve });
      setTimeout(() => reject(new Error(`no "${t}" message within ${ms} ms`)), ms).unref();
    }),
    async join(mode = 'solo', code, extra = {}) { await c.open; c.send({ t: 'join', mode, code, ...extra }); return c.next('hello'); },
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

test('serves the rules, so the same game can run in the browser without a server', async () => {
  for (const f of ['game.js', 'data.js', 'act.js']) {
    const r = await get(`/rules/${f}`);
    assert.equal(r.status, 200, f);
    assert.match(r.headers.get('content-type'), /javascript/);
    assert.match(await r.text(), /export /);
  }
  for (const f of ['index.js', '../package.json', 'game.js/../index.js']) { const r = await get(`/rules/${f}`); assert.equal(r.status, 404, f); await r.text(); }
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
  assert.equal(hello.layout.units.length, 36); assert.equal(hello.layout.plots.length, 7); assert.equal(hello.layout.turretSpots.length, 8);
  assert.equal(hello.layout.ages.length, 4); assert.equal(hello.layout.siege.length, 11);
  assert.ok(Object.keys(hello.layout.lords).includes('engineer'));
  await a.next('s');
  const n0 = a.msgs.length;
  await wait(500);
  const got = a.msgs.length - n0;
  assert.ok(got >= 6 && got <= 14, `${got} snapshots in 0.5 s`);
  const s = a.msgs.at(-1);
  assert.equal(s.ph, 'prep'); assert.equal(s.np, 1); assert.equal(s.wv.length, 2); assert.equal(s.gold, 60); assert.equal(s.spd, 1);
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
  const shop = (await b.next('s')).shop, i = shop.findIndex((o) => o && o.price <= 60);
  b.send({ t: 'buy', i });
  await wait(150);
  const sa = await a.next('s');
  assert.equal(sa.gold, 60 - shop[i].price, 'the other commander sees the purchase');
  assert.equal(sa.shop[i], null);
  assert.ok(!b.msgs.some((m) => m.t === 'save'), 'co-op rooms are not saved');
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
  a.send({ t: 'up', b: '__proto__' }); a.send({ t: 'buy', i: 'constructor' }); a.send({ t: 'lock', i: -1 }); a.send({ t: 'train', u: 'x' }); a.send({ t: 'dismiss', u: {} }); a.send({ t: 'pick', i: 1 }); a.send({ t: 'skip' }); a.send({ t: 'repair' }); a.send({ t: 'restart' });
  a.send({ t: 'ability', k: 'volley', x: 'x' }); a.send({ t: 'speed', v: 9 }); a.send({ t: 'speed', v: '2' });
  a.send({ t: 'wave', i: 'x' }); a.send({ t: 'wave', i: 5 }); a.send({ t: 'wave' });
  a.send({ t: 'dev', k: 'gold' });
  await wait(200);
  const s = await a.next('s');
  assert.equal(srv.rooms.size, 1, 'a second join is ignored');
  assert.equal(s.gold, 60, 'nothing was bought and dev shortcuts are off');
  assert.equal(s.un.length, 4); assert.equal(s.spd, 1);
  assert.equal(s.ph, 'prep');
  a.send('x'.repeat(70000));
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
  assert.equal(s.gold, 620);
  assert.ok(s.wv.every((w) => w.c[2] === 1), 'the next wave is a Queen wave');
  await dev.close();
});

test('the castle layout is served for the start menu', async () => {
  const r = await get('/layout.json');
  assert.equal(r.status, 200);
  const l = await r.json();
  assert.equal(l.segs.length, 28); assert.equal(l.slots.length, 32);
  assert.equal(l.enemies.length, 16); assert.ok(l.units.includes('cleric') && l.units.includes('musketeer'));
  for (const k of ['buildings', 'doctrines', 'events', 'specs', 'abilities', 'lords', 'items', 'tiers', 'mods']) assert.ok(k in l, k);
});

test('solo: the run is saved between waves and can be continued', async () => {
  const a = client();
  await a.join('solo', null, { siege: 0 });
  const first = await a.seen('save');
  assert.equal(first.d.wave, 0); assert.equal(first.d.siege, 0); assert.equal(first.d.v, 5);
  const s = await a.next('s');
  const i = s.shop.findIndex((o) => o && o.price <= s.gold);
  a.send({ t: 'buy', i });
  const saved = (await a.next('save')).d;
  assert.equal(saved.gold, 60 - s.shop[i].price);
  await a.close();
  const b = client();
  await b.join('solo', null, { save: { ...saved, gold: 4321 } });
  const sb = await b.next('s');
  assert.equal(sb.gold, 4321); assert.equal(sb.un.length, 4); assert.equal(sb.sv, 0);
  await b.close();
});

test('solo: a broken save is refused and a fresh run starts', async () => {
  const a = client();
  await a.open;
  a.send({ t: 'join', mode: 'solo', save: { v: 2, wave: 'lots' } });
  assert.equal((await a.seen('err')).why, 'badsave');
  await a.seen('hello');
  const s = await a.next('s');
  assert.equal(s.wave, 0); assert.equal(s.gold, 60);
  await a.close();
});

test('solo: the save is cleared when the castle falls', async () => {
  const dev = start({ port: 0, dev: true });
  const a = client(await dev.ready);
  await a.join('solo');
  await a.seen('save');
  a.send({ t: 'wave', i: 0 });
  await wait(100);
  for (const room of dev.rooms.values()) room.game.th.hp = 0.1, room.game.th.max = 1;
  for (const room of dev.rooms.values()) room.game.fall();
  const cleared = await a.next('save');
  assert.equal(cleared.d, null);
  a.send({ t: 'restart' });
  const fresh = await a.next('save');
  assert.equal(fresh.d.wave, 0);
  await a.close();
  await dev.close();
});

test('solo: the chosen lord starts the run; the game can be paused and sped up', async () => {
  const a = client();
  await a.join('solo', null, { lord: 'engineer' });
  const s = await a.next('s');
  assert.equal(s.lord, 'engineer'); assert.equal(s.tu.length, 1);
  a.send({ t: 'speed', v: 3 });
  a.send({ t: 'wave', i: 0 });
  await wait(300);
  const fast = await a.next('s');
  assert.equal(fast.spd, 3);
  a.send({ t: 'speed', v: 0 });
  await wait(100);
  const p1 = await a.next('s');
  await wait(300);
  const p2 = await a.next('s');
  assert.equal(p2.spd, 0);
  assert.deepEqual(p2.en, p1.en, 'nothing moves while paused');
  await a.close();
});

test('co-op rooms cannot be paused or sped up', async () => {
  const a = client();
  await a.join('create');
  a.send({ t: 'speed', v: 3 });
  await wait(100);
  assert.equal((await a.next('s')).spd, 1);
  await a.close();
});

test('solo: siege level, lord, unlocked classes and abilities are chosen when joining', async () => {
  const a = client();
  await a.join('solo', null, { siege: 5, lord: 'merchant', classes: ['archer', 'mage'], abilities: ['meteor', 'freeze', 'mend'], daily: true });
  const s = await a.next('s');
  assert.equal(s.sv, 5); assert.equal(s.lord, 'merchant'); assert.equal(s.daily, true);
  assert.deepEqual(s.ab.map((x) => x[0]), ['meteor', 'freeze', 'mend']);
  const d = (await a.seen('save')).d;
  assert.deepEqual(d.classes, ['archer', 'mage']);
  await a.close();
  const b = client();
  await b.join('solo', null, { siege: 'x', lord: '__proto__', classes: 'all', abilities: ['meteor'] });
  const sb = await b.next('s');
  assert.equal(sb.sv, 1); assert.equal(sb.lord, 'marshal'); assert.deepEqual(sb.ab.map((x) => x[0]), ['volley', 'mend', 'rally']);
  await b.close();
});

test('solo: two players with the same daily seed are dealt the same waves and shop', async () => {
  const a = client(), b = client(), c = client();
  await a.join('solo', null, { seed: 20261116, daily: true }); await b.join('solo', null, { seed: 20261116, daily: true }); await c.join('solo', null, { seed: 20261117, daily: true });
  const [sa, sb, sc] = [await a.next('s'), await b.next('s'), await c.next('s')];
  assert.deepEqual(sa.wv, sb.wv); assert.deepEqual(sa.shop, sb.shop);
  assert.notDeepEqual([sa.wv, sa.shop], [sc.wv, sc.shop]);
  await a.close(); await b.close(); await c.close();
});

test('the commander moves defenders, builds in the courtyard and advances the age over the wire', async () => {
  const dev = start({ port: 0, dev: true });
  const a = client(await dev.ready);
  await a.join('solo');
  let s = await a.next('s');
  const u = s.ro.find((r) => r[14] >= 4), free = [...Array(32).keys()].find((i) => i >= 4 && !s.ro.some((r) => r[14] === i));
  for (const room of dev.rooms.values()) room.game.level = 3;   // the first building needs castle level 2
  a.send({ t: 'move', u: u[0], s: free });
  a.send({ t: 'dev', k: 'gold' }); a.send({ t: 'dev', k: 'gold' });
  a.send({ t: 'build', p: 0, k: 'forge' });
  a.send({ t: 'build', p: 1, k: 'nope' }); a.send({ t: 'build', p: 99, k: 'market' }); a.send({ t: 'upbuild', p: 5 }); a.send({ t: 'demolish', p: 3 });
  await wait(150);
  s = await a.next('s');
  assert.equal(s.ro.find((r) => r[0] === u[0])[14], free);
  assert.deepEqual(s.pl.map((p) => p && p[0]), [0, null, null, null, null, null, null]);
  assert.equal(s.age, 0);
  a.send({ t: 'age' });
  await wait(100);
  assert.equal((await a.next('s')).age, 0, 'no boss has fallen yet');
  a.send({ t: 'dev', k: 'age' }); a.send({ t: 'age' });
  await wait(150);
  s = await a.next('s');
  assert.equal(s.age, 1); assert.equal(s.ph, 'reward'); assert.equal(s.pick.type, 'doctrine'); assert.equal(s.pick.opts.length, 3);
  a.send({ t: 'pick', i: 0 });
  await wait(100);
  s = await a.next('s');
  assert.equal(s.ph, 'prep'); assert.equal(s.dc.length, 1);
  a.send({ t: 'demolish', p: 0 });
  a.send({ t: 'dev', k: 'event' });
  await wait(150);
  s = await a.next('s');
  assert.equal(s.pl[0], null); assert.equal(s.pick.type, 'event'); assert.ok(s.pick.ev);
  await a.close();
  await dev.close();
});
