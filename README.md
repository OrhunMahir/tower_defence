# Hordewall

A round-based castle defense roguelite for the browser, in the spirit of *Brotato* and *How Many Dudes?*. You are the commander, not a character. Hold the castle for as long as you can: there is no last wave. Every round you choose which horde to face, and after every wave you pick your rewards. The seasons turn, the weather changes, and after every boss the horde keeps a new trait and learns to resist whatever hurt it most. A run ends when the keep falls.

A solo run is simulated in the browser, so the game needs no server to play. The same rules also run on a Node server, which the tests use and which hosts co-op rooms.

## How a round plays

1. **Prepare (no clock).**
   - Pick one of the waves on offer. Each has a theme (*Swarm*, *Siege*, *Blight*, *Haunting* and so on) and shows which monsters come, their health and damage, the weather of the day, and what it pays.
   - A **harder** wave brings more monsters and pays double gold and experience, with luckier spoils. A watchtower finds a third, **deadly** wave. Through the first year the harder waves are a little smaller than they are afterwards.
   - From wave 8 some waves carry a **modifier** (frenzied, armoured, giants, swarm, night, regenerating) and pay a quarter more.
   - Spend gold in the shop, upgrade the keep and walls, raise buildings in the courtyard, train or move defenders.
2. **Battle.**
   - Defenders on the walls and turrets in the courtyard fight on their own.
   - You take three castle abilities into a run, such as *Volley*, *Mend walls*, *Rally*, *Deep freeze*, *Meteor*, *Caltrops* and *Last stand*.
   - Pause or play at 1×, 2× or 3× speed.
3. **Rewards.**
   - Every castle level offers **1 of 4 stat upgrades**. The castle gains experience from kills and from every cleared wave.
   - The **spoils** offer **1 of 3**: a new defender, an item, a turret, or a blessing for one class. On full walls a newcomer may take the post of your weakest defender.
   - A boss leaves a **relic** (1 of 3, found nowhere else) and a **mutation** for the horde (see below).
   - Every fourth wave brings an **event**: a short story with two or three answers.

Defenders are never bought; they only arrive as spoils.

## A run without an end

- **The calendar.** A season lasts eight waves and ends with its boss; four seasons make a year. The bosses come in the same order every year: the Queen (spring), the Behemoth (summer), the Brood Mother (autumn) and the Sky Tyrant (winter).
- **Seasons.** Each gives something to the castle and something to the horde: spring pays a better harvest but brings a larger horde, summer lengthens every reach but speeds the monsters up, autumn pays more gold for tougher monsters, winter slows the horde but halves the harvest.
- **Weather.** Every wave has its weather, and you see it coming two waves ahead: rain damps fire and helps lightning, fog shortens every reach, a gale grounds what flies, a thunderstorm strikes both sides, a heatwave feeds fire, snow and blizzards slow the horde and shorten the reach.
- **Mutations.** After every boss the horde keeps one new trait for the rest of the run, and you choose which: one of three, two of them from the legacy of the boss that just fell. There are 24 mutations with three levels each; six of them change the bosses themselves (a second boss, a royal guard, a second wind). Each choice comes with a boon: gold, castle levels, an item, a stat, a promotion or one more relic.
- **Adaptation.** From the second boss on, the horde grows a resistance to the family of defenders that hurt it most during the season (8% each time, up to 40%) and forgets a little about the others. A mixed army gives it nothing to learn; the **Horde** tab shows what it knows.
- **Growth.** The first year plays like a campaign. After it, monsters grow 12% tougher and hit 12% harder with every wave, bosses keep pace, and a wave that drags on for two minutes drives the horde into a fury. Sooner or later the keep falls; how deep you got is the score.

## Ages

The castle starts in the **Timber Age** behind a wooden palisade. Each later age is opened by slaying a boss, and then bought with gold once the castle level is high enough, so an age cannot be rushed.

| Age | Opened by | Walls | New |
|---|---|---|---|
| Timber | start | wooden palisade | archer, mage, cleric, bard, spearman, shieldbearer |
| Stone | the Queen (wave 8) | stone walls | crossbowman, frost mage, pyromancer, priest, hexer, tinker; cannon and mortar; mason, workshop, library |
| Iron | the Behemoth (wave 16) | fortress walls | ranger, stormcaller, alchemist, bombardier, musketeer, sapper; tesla coil and ballista; watchtower, mint, tavern |
| Golden | the Brood Mother (wave 24) | marble citadel | mythic recruits |

After the Golden Age the castle follows **one of three paths**, chosen once with the fifth age (the Sky Tyrant, wave 32). The other two are closed for the run. Every age of a path has its own walls, a power that lasts for the rest of the run, and two new classes.

| Path | Ages | Powers |
|---|---|---|
| **Splendour**: critical hits and raw power | Obsidian → Crystal → Star | razor walls, crits that leap to a second monster, falling stars |
| **Industry**: turrets, guns and sturdy walls | Steel → Powder → Steam | plated walls and cheap repairs, a gun on every tower, faster turrets and a free restock |
| **Legend**: wards, dragon fire and miracles | Rune → Dragonfire → Celestial | walls that mend and refuse to fall, a dragon over the castle, a keep that survives a killing blow |

The third age of a path brings **exalted** recruits, a sixth rarity. After it every further boss opens an **ascension**: the same age again with higher caps, two legendary stat choices and a doctrine while any are left. There is no last one.

A new age rebuilds the walls and the keep, raises the level caps, opens building plots and better rarities, and lets you choose one of three **doctrines**: a rule that lasts for the whole run, such as *Volley fire*, *Moat* or *War economy*.

## What there is

- **36 defender classes in 6 families** (Marksmen, Arcane, Alchemy, Faith, Wardens, Engineers): 18 from the four ages and 18 from the three paths. Two, four or six of a family give a family bonus. Every defender has a name, a rarity, rolled stats and sometimes traits, and levels up from their own kills. At level 6 each one chooses one of two **specialisations**.
- **Placement.** Click a defender, then a place on the walls. Whoever stands in a tower reaches 15% further.
- **10 courtyard buildings**: forge, barracks, chapel, market, mason's yard, workshop, library, watchtower, mint and tavern. Every age allows one more level.
- **64 items**, 18 of them boss relics. Many are trade-offs; some change the rules.
- **5 turrets**, **16 doctrines** and **10 events**.
- **16 monsters**: runners, brutes, spitters, gloomwings, broodsacks, shellbacks, blightlings (burst against the wall), shamans (heal), ramhorns (break walls), burrowers (dig under the walls), wraiths (dodge) and hurlers (boulders from afar). Four bosses, each with its own power.
- **15 lords** to start a run with, each with its own army and a strength traded for a weakness.
- **9 castle abilities**; three come along on a run.
- **A siege ladder without a top.** Level 0 is relaxed, level 1 is the normal game, levels 2 to 10 each add one rule, and every level above makes the horde tougher and gives it mutations to start with. Outlasting the first year at the highest open level opens the next, and every boss slain after that in the same run opens one more.

## Between runs

Every run earns **renown**: for waves cleared, seasons outlasted and ages reached, more at higher siege levels. Renown unlocks new lords, classes, items, relics and abilities. It only buys variety and never makes the castle stronger.

All the renown ever earned also counts towards a **title**, from Recruit to Emperor and on without end. A title is a rank to show, nothing more.

The menu also holds 32 achievements, a codex of everything met so far (monsters, mutations, weather, defenders, items), the last runs, and a **daily challenge**: the same seed, lord and siege level for everyone, with everything unlocked.

The run is saved in the browser between waves. Progress is kept in the browser's local storage. You can give up a run from the pause menu; it counts as it stands.

## Run it

```bash
npm install
npm start
```

Then open http://127.0.0.1:3000.

To build the game as static files for any web host:

```bash
npm run build
```

This writes `dist/`. Serve that folder as it is; no server code is needed.

## Controls

| Key | Action |
|---|---|
| `WASD` / arrows, or right-drag | move the camera |
| Mouse wheel | zoom |
| `1`–`6` | pick a wave, a reward or an ability |
| `Space` | pause |
| `Tab` | switch panels |
| `Esc` | cancel, or open the pause menu and settings |
| `M` | music on or off |

## Commands

- `npm start` runs the game server and static files on port 3000 (`PORT` changes it).
- `npm test` runs the rule tests, bot runs, profile tests and server tests.
- `npm run balance` prints a balance report: how deep bot commanders get on each siege level before the castle falls, how long that takes, and when they reach each age. `npm run balance -- --trace=22` follows one run wave by wave.
- `npm run build` writes the static build to `dist/`.

Opening the game with `?dev` in the address turns on testing shortcuts:

| Key | Effect |
|---|---|
| `G` | more gold |
| `H` | the next wave is a boss wave |
| `J` | skip a season |
| `K` | keep at 60 HP |
| `L` | a castle level-up |
| `B` | the next age becomes available |
| `N` | an event |
| `R` | a relic |
| `V` | a mutation to choose |
| `Y` | the next kind of weather |

`?server` makes the browser play on the Node server over a WebSocket instead of running the rules itself.

## Layout

- `server/data.js` holds every table: monsters, classes, items, buildings, ages and paths, seasons, weather, mutations and so on. It has no logic.
- `server/game.js` holds the simulation: `Game.step(dt)`, `snapshot()`, `save()` and `load()`. It has no network code or timers.
- `server/act.js` turns a commander's message into a call on a game.
- `server/index.js` is the HTTP static server, the WebSocket server, rooms and speed control. It also serves the three rule files to the browser.
- `client/` is the Three.js client:
  - `main.js` draws the scene from snapshots and handles the camera.
  - `net.js` runs the rules in the browser, or connects to the server.
  - `hud.js` is everything on screen during a run; `menu.js` is the main menu.
  - `profile.js` keeps renown, unlocks, the siege ladder, the title, achievements and settings.
  - `models.js` builds everything that is drawn, and paints the ground and the wall textures on canvases.
  - `text.js` holds every word and names the picture that goes with it; `audio.js` synthesises sound and music.
  - `icons.js` holds every picture of the interface. They are drawn in code, stroke by stroke, on a 48 by 48 sheet: there are no emoji and no icon font. `scripts/icons.html` shows them all at the sizes the game uses (serve the repository folder and open it).
  - `look.js` holds four cartoon ways of drawing the scene, still on trial: flat bands of light, wobbly ink outlines and a paper finish. `?look=ink`, `paper`, `comic` or `water` in the address turns one on; without it the scene is drawn as before.
  - `index.html` holds the page and its look: flat paint, dark outlines, paper slips. The three typefaces (Grenze Gotisch, Alegreya Sans and its small caps) come from Google Fonts; without a connection the page falls back to the system's fonts.
- `scripts/build.js` writes the static build; `scripts/icons.html` is the working sheet for the pictures. `scripts/looks.html` shows the four cartoon looks side by side (run the build first, then serve the repository folder).
- `test/` holds the tests, the bot commanders and the balance report.
- `reports/` holds the genre research and the design notes (in Turkish).
