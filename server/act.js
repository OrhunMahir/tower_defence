// Turns commander messages into calls on a game. Pure, so the browser-only build can use it too.
import { levelNeed, ageNeed, nextBossWave, BOSSES, SEASON_LEN, WEATHER } from './game.js';

// What a join message may ask for; Game itself checks every value.
export const runOptions = (m) => ({ siege: m.siege, lord: m.lord, classes: m.classes, items: m.items, relics: m.relics, abilities: m.abilities, daily: !!m.daily });

// Applies one commander message to a game. Returns true when something changed.
// Shared with the browser-only build, which runs the same rules without a server.
export function act(game, id, m, dev = false) {
  if (m.t === 'wave') return game.chooseWave(id, m.i);
  if (m.t === 'pick') return game.choose(id, m.i);
  if (m.t === 'skip') return game.skip(id);
  if (m.t === 'repick') return game.rerollPick(id);
  if (m.t === 'buy') return game.buy(id, m.i);
  if (m.t === 'lock') return game.lock(id, m.i);
  if (m.t === 'reroll') return game.rerollShop(id);
  if (m.t === 'train') return game.train(id, m.u);
  if (m.t === 'dismiss') return game.dismiss(id, m.u);
  if (m.t === 'move') return game.move(id, m.u, m.s);
  if (m.t === 'spec') return game.specialize(id, m.u, m.b);
  if (m.t === 'up') return game.upgrade(id, m.b);
  if (m.t === 'repair') return game.repair(id, m.what);
  if (m.t === 'age') return game.advanceAge(id, m.path);
  if (m.t === 'retire') return game.retire(id);
  if (m.t === 'build') return game.build(id, m.p, m.k);
  if (m.t === 'upbuild') return game.upgradeBuilding(id, m.p);
  if (m.t === 'demolish') return game.demolish(id, m.p);
  if (m.t === 'restart') return game.restart(id);
  if (m.t === 'ability') return game.ability(id, m.k, m.x, m.z);
  if (m.t === 'dev' && dev) {
    if (m.k === 'gold') game.gold += 500 + game.gold;
    else if (m.k === 'hurt') game.th.hp = Math.min(game.th.hp, 60);
    else if (game.phase !== 'prep') return false;
    else if (m.k === 'boss') game.jump(nextBossWave(game.wave + 1));
    else if (m.k === 'skip') game.jump(game.wave + SEASON_LEN + 1);
    else if (m.k === 'level') { game.castleXp(levelNeed(game.level) - game.xp); game.resume = true; game.nextPick(); }
    else if (m.k === 'age') { const a = ageNeed(game.age + 1); game.bossWaves = Math.max(game.bossWaves, game.age + 1); game.level = Math.max(game.level, a.level); game.gold += a.gold; }
    else if (m.k === 'event') { game.picks.push({ type: 'event' }); game.resume = true; game.nextPick(); }
    else if (m.k === 'relic') { game.picks.push({ type: 'relic' }); game.resume = true; game.nextPick(); }
    else if (m.k === 'mutate') { game.picks.push({ type: 'mutation', boss: Math.floor(Math.random() * BOSSES.length) }); game.resume = true; game.nextPick(); }
    else if (m.k === 'weather') { game.forecast[0] = WEATHER[(WEATHER.indexOf(game.forecast[0]) + 1) % WEATHER.length]; game.e = game.env(game.wave + 1, game.forecast[0]); game.makeWaveOffers(); }
    return true;
  }
  return false;
}
