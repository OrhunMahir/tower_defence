# Castle Defense (working title)

A round-based castle defense roguelite for the browser, in the spirit of *Brotato* and *How Many Dudes?*. You are the commander, not a character. Hold the castle through thirty waves. Every round you choose which horde to face, and after every wave you pick your rewards. The run ends with a final boss on wave 30, and after that you can keep going in endless mode.

The server runs every game rule. The browser only sends the commander's choices and draws the 3D scene.

## How a round plays

1. **Prepare (no clock).**
   - Pick one of two waves. Each offer has a theme (*Swarm*, *Siege*, *Sky raid* and so on) and shows which monsters come, their health and damage, and the reward. One offer is harder, pays double gold and brings luckier spoils.
   - Spend gold in the shop: four offers of items and turrets. You can lock an offer, and rerolls cost more each time.
   - Upgrade the keep and walls, repair, or train a defender.
2. **Battle.**
   - Defenders on the walls and turrets in the courtyard fight on their own.
   - You have three castle abilities with cooldowns: *Volley* (arrows on a spot you click), *Mend walls* and *Rally*.
   - Pause or play at 1×, 2× or 3× speed.
3. **Rewards.**
   - Every castle level gained from kills offers **1 of 4 stat upgrades**, in four rarities.
   - Then the **spoils** offer **1 of 3**: a new defender, an item, a turret, or a blessing for one class.
   - Boss waves give two spoils. You can reroll the choices for gold or skip them for gold.

Defenders are never bought; they only arrive as spoils.

## What there is

- **15 defender classes in 5 families.** Two, four or six of a family give a family bonus.

  | Family | Classes |
  |---|---|
  | Marksmen | archer, crossbowman, ranger |
  | Arcane | mage, frost mage, stormcaller |
  | Alchemy | pyromancer, alchemist, bombardier |
  | Faith | cleric, priest, bard |
  | Wardens | spearman, shieldbearer, hexer |

  Every defender has a name, a rarity, rolled stats and sometimes traits. Each one levels up from their own kills.
- **13 castle stats:** damage, attack speed, range, crit, elemental, engineering, wall HP, keep HP, wall regen, armour, harvesting, luck and experience.
- **36 items.** Many are trade-offs (*Cursed banner*: +30% damage, −15% wall HP). Some have special effects: boiling oil, an hourglass, family banners.
- **5 turrets:** bolt thrower, cannon, tesla coil, mortar and ballista. Another copy raises a turret's level.
- **5 lords** to start a run with, each with a different starting army and a strength traded for a weakness: Marshal, Archmage, Merchant, Engineer and Saint.
- **Monsters:**
  - runners, brutes
  - spitters (spit at walls from range)
  - gloomwings (fly over the walls)
  - broodsacks (burst into runners)
  - armoured shellbacks
  - bosses: the Queen, the Behemoth, the Sky Tyrant (the final boss) and the Brood Mother
- **Walls that change look** as they grow: wooden palisade, then stone, fortress and finally a marble citadel. The keep grows turrets, a slate roof and then gold.
- **Relaxed, Normal and Brutal** difficulty. Best waves and victories are remembered in the browser.
- **Save and continue.** The run is saved in the browser every round.
- **Sound and feedback.** Music and sound effects are synthesised in the browser, with no audio files. Damage numbers float over the monsters, critical hits show in gold, and the camera shakes when walls fall or bosses arrive.
- **Tips for new players.** Short tips explain each step the first time it comes up; they can be switched off.

A Normal run takes about 20 minutes of battle; the balance report measures this with bots. The research behind the design is in [`reports/`](reports/).

## Run it

```bash
npm install
npm start
```

Then open http://127.0.0.1:3000. Co-op rooms still exist on the server but are hidden from the menu for now.

## Controls

| Key | Action |
|---|---|
| `WASD` / arrows | move the camera |
| Mouse wheel | zoom |
| `1`–`4` | pick a wave or a reward |
| `1`–`3` in battle | use an ability (*Volley* then needs a click on the ground) |
| `Space` | pause |
| `M` | music on or off (sound buttons sit next to the speed buttons) |
| `Tab` | switch panels |

## Commands

- `npm start` runs the game server and static files on port 3000 (`PORT` changes it).
- `npm test` runs the rule tests, bot runs and server tests.
- `npm run balance` prints a balance report: how far bot commanders get on each difficulty and how long a run takes.
- `node server/index.js --dev` turns on testing shortcuts:

  | Key | Effect |
  |---|---|
  | `G` | more gold |
  | `H` | next wave is a boss wave |
  | `J` | skip nine waves |
  | `K` | keep at 60 HP |
  | `L` | a castle level-up |
  | `V` | the victory screen |

## Layout

- `server/game.js` holds the simulation: `Game.step(dt)`, `snapshot()`, `save()` and `load()`. It has no network code or timers.
- `server/index.js` is the HTTP static server, the WebSocket server, rooms, speed control and saves.
- `client/` is the Three.js client:
  - `models.js` builds everything that is drawn, including the wall tiers and the portraits.
  - `main.js` handles the network, camera, HUD, reward screens and tips.
  - `audio.js` synthesises the sound effects and music.
- `test/` holds the tests, the bot commanders and the balance report.
- `reports/` holds the genre research (in Turkish).
