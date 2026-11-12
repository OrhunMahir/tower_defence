# Castle Defense (working title)

A castle defense game for the browser, solo or co-op for up to four. You are the commander, not a character: before each wave you choose which of two monster waves to face, recruit defenders for the walls and upgrade the castle. Battles play out on their own. A Queen arrives every tenth wave, and when the keep falls the run starts over.

The server runs every game rule; the browser only sends the commander's choices and draws the 3D scene.

## How it plays

- **Choose the wave.** Two offers show the monsters and the reward. One is harder and pays double.
- **Recruit.** Archers, spearmen, mages and crossbowmen take a free place on the walls. Taller walls hold more.
- **Upgrade.** Keep, walls, barracks and gold mine have their own levels. Each keep level offers one of three perks, such as a mortar or a ballista.
- **Promote.** Raise a whole unit type by a tier for more damage.
- **No clock.** Preparation lasts until someone picks a wave.
- **Co-op.** One castle and one purse; the first commander to click decides.

## Run it

```bash
npm install
npm start
```

Then open http://127.0.0.1:3000. "Play solo" opens a private game; "Create co-op room" gives a four-letter code for friends. To let others on your network reach the server, start it with `HOST=0.0.0.0 npm start`.

## Commands

- `npm start` — game server and static files on port 3000 (`PORT` changes it).
- `npm test` — rule tests, bot runs and server tests.
- `npm run balance` — balance report: how far bot commanders get and how long a run lasts.
- `node server/index.js --dev` — testing shortcuts in the game: `G` grants 500 gold, `H` makes the next wave a Queen wave, `K` drops the keep to 60 HP.

## Layout

- `server/game.js` — the simulation: `Game.step(dt)` and `snapshot()`, no network or timers.
- `server/index.js` — HTTP static server, WebSocket server and rooms.
- `client/` — Three.js client: `models.js` builds everything that is drawn, `main.js` handles the network, camera and HUD.
- `test/` — tests and bot commanders.
- `stil-demo.html` — the first visual style demo.
