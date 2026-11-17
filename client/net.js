// Where the game runs. A solo run is simulated right here in the browser with the same rules the
// server uses, so the game needs no server at all. A co-op room talks to the server over a WebSocket.
// Either way the rest of the client only sees snapshots, saves and a send() function.
import { Game, TICK, seededRng } from './rules/game.js';
import { act, runOptions } from './rules/act.js';

// handlers: hello(layout), snap(snapshot), save(data | null), error(why)
export function startLocal({ opts = {}, save = null, seed = null, dev = false }, on) {
  const game = new Game(Number.isInteger(seed) ? seededRng(seed) : Math.random, runOptions(opts));
  if (save && !game.load(save)) on.error('badsave');
  const id = game.addPlayer();
  let speed = 1, phase = game.phase, acc = 0, last = performance.now(), closed = false;
  const sendSave = () => { if (game.phase !== 'wave') on.save(game.phase === 'over' ? null : game.save()); };
  const emit = () => on.snap(JSON.parse(JSON.stringify({ ...game.snapshot(), spd: speed })));
  // The rules advance in fixed steps. A hidden tab runs its timers rarely, so the game slows
  // down there instead of racing to catch up.
  function tick() {
    if (closed) return;
    const now = performance.now();
    acc = Math.min(acc + (now - last) / 1000, TICK * 3);
    last = now;
    // The summary of a finished run stays until the commander decides what to do next: only a
    // room on a server starts the next run by itself.
    while (acc >= TICK) { acc -= TICK; if (game.phase !== 'over') for (let i = 0; i < speed; i++) game.step(TICK); }
    if (game.phase !== phase) { phase = game.phase; sendSave(); }
    emit();
  }
  const timer = setInterval(tick, TICK * 1000);
  queueMicrotask(() => { if (closed) return; on.hello(game.layout()); sendSave(); emit(); });
  return {
    local: true, game,
    send(m) {
      if (closed || !m || typeof m !== 'object') return;
      if (m.t === 'speed') { if ([0, 1, 2, 3].includes(m.v)) speed = m.v; return; }
      if (act(game, id, m, dev)) { phase = game.phase; sendSave(); }
    },
    // For tests and debugging: run the rules forward without waiting for the clock.
    advance(steps = 1) { for (let i = 0; i < steps; i++) game.step(TICK); if (game.phase !== phase) { phase = game.phase; sendSave(); } emit(); },
    close() { closed = true; clearInterval(timer); },
  };
}

export function startRemote({ opts = {}, save = null, seed = null, mode = 'solo', code = '' }, on) {
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);
  let joined = false, closed = false;
  ws.onopen = () => ws.send(JSON.stringify({ t: 'join', mode, code, ...runOptions(opts), seed: Number.isInteger(seed) ? seed : undefined, save: save || undefined }));
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.t === 'hello') { joined = true; on.hello(m.layout, m.room); } else if (m.t === 's') on.snap(m);
    else if (m.t === 'save') on.save(m.d);
    else if (m.t === 'err') on.error(m.why);
  };
  ws.onclose = () => { if (!closed) on.error(joined ? 'lost' : 'noserver'); };
  return {
    local: false,
    send(m) { if (ws.readyState === 1) ws.send(JSON.stringify(m)); },
    advance() {},
    close() { closed = true; ws.close(); },
  };
}
