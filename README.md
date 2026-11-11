# Castle Defense (working title)

A co-op castle defense game for 1–4 players in the browser. Waves of monsters attack the castle, a Queen arrives every tenth wave, and between waves the team spends shared gold on walls, archers, buildings and perks. When the keep falls, the run starts over.

The server runs every game rule; the browser only sends input and draws the 3D scene.

## Run it

```bash
npm install
npm start
```

Then open http://127.0.0.1:3000. To let others on your network join, start it with `HOST=0.0.0.0 npm start`.

## Commands

- `npm start` — game server and static files on port 3000 (`PORT` changes it).
- `npm test` — rule tests, bot runs and server tests.
- `npm run balance` — balance report: how far bot teams get and how long a run lasts.
- `node server/index.js --dev` — testing shortcuts in the game: `G` grants 500 gold and a level, `H` makes the next wave a Queen wave, `K` drops the keep to 60 HP.

## Layout

- `server/game.js` — the simulation: `Game.step(dt)` and `snapshot()`, no network or timers.
- `server/index.js` — HTTP static server and WebSocket game server.
- `client/` — Three.js client: `models.js` builds everything that is drawn, `main.js` handles the network, input and HUD.
- `test/` — tests and bots.
- `stil-demo.html` — the first visual style demo.
