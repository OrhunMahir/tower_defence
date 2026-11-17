# Softening the hard waves of the first year

Orhun, 2026-11-17: "bunu evet yap ama aşırı da kolay olmasın" (soften the first year's hard waves, but not too easy).
**Done and applied on 2026-11-17.** The design note in `reports/Sonsuz güncelleme tasarımı.md` ("Ölçüm sonuçları") tells the same story in Turkish.

## What was applied

1. `server/data.js`: a ramhorn costs 12 points of a wave's budget instead of 9 (a quarter fewer of them, in every year and in standard waves too).
2. `server/data.js` `TIERS.*.pts1`, used by `makeWaveOffers` in `server/game.js` while `n <= YEAR_LEN`: through the first year a hard offer brings
   1.65 times the standard budget instead of 1.75, a deadly one 2.5 instead of 2.7. Rewards are unchanged. Full size from wave 33.
3. `test/waves.test.js`: one new test for the rule. `README.md`: one sentence.

To make it softer or harsher, change `pts1`. The next notch down (1.6) is measured below.

## First year, normal siege, 960 bot runs for each rule and bot

Share of runs that fall before the second year.

| bot | before | ramhorn price only | applied (ramhorn + 1.65) | ramhorn + 1.6 |
|---|---|---|---|---|
| easy waves only | 32.7% | 25.6% | 25.6% | 25.6% |
| mixed (a hard wave on every even wave) | 48.8% | 42.2% | 37.6% | 32.5% |
| hard waves always | 23.2% | 18.4% | 11.8% | 12.0% |

- Mixed bot, per hard wave: 5.0% end the run before, 3.6% after. Hard battering waves: 31% before, 15% after (now level with underminers).
- Every fall goes from a full keep to nothing within one wave (468 of 468). Few waves are survived badly hurt.
- Taking hard waves always stays the safest way to play, as it was before: double gold and experience snowball from wave 1.
- The endless rules are not the cause. With mutations, adaptation, weather or the season switched off one at a time,
  the share of hard waves that end the run only drops from 6.0% to between 5.2% and 5.9%.
- An earlier claim was wrong: "mixed bots fall before wave 30 in 10 of 16 runs, 6 of 16 before the endless update" was seed noise.
  With 48 runs the old version loses 23 and the new one 22. Only where they fall moved (waves 10 to 14 before, 18 to 22 now).

## The same castles against the same hard waves, under other rules

`snap.mjs` saves the castle right before every wave a bot chooses (953 castles from 48 mixed runs). `replay.mjs` sends each one into a wave
under the rules of another copy of `server/`. Same castle, same dice, so the difference is the rule. 363 castles where the bot took the hard wave, 4 rolls each (1452 waves),
plus a forced battering wave without a modifier on 227 castles.

| rule | hard waves as offered: fell | forced battering wave: fell |
|---|---|---|
| as it was (hard = 1.75 times the budget) | 6.0% | 22.5% |
| ramhorn at 12 points | 5.1% | 10.6% |
| hard = 1.6 in year one | 3.2% | 16.7% |
| hard = 1.5 in year one | 1.9% | 12.8% |
| ramhorn 12 + 1.65 (**applied**) | 3.5% | 7.9% |
| ramhorn 12 + a ramp from 1.5 at wave 1 to 1.75 at wave 32 | 3.0% | 7.9% |
| ramhorn 12 + 1.6 | 2.3% | 8.4% |
| ramhorn 12 + 1.5 | 1.3% | 4.8% |
| half as many modifiers on hard offers (0.2 instead of 0.4) | 5.4% | (same rule as the first row; 28.2% by other dice) |

- The forced battering numbers swing by about 6 points with the dice alone (the last row is the same rule as the first), so read them loosely.
- The applied rule in the real files reproduces the candidate line for line (1679 replays identical).
- Standard offers on easy-bot castles (886 castles, 3544 waves): 1.0% end the run before, 0.6% with the ramhorn at 12 points; standard battering waves 12.2% to 5.4%.
- Deadly offers on the mixed bot's castles: 35.5% end the run before, 27.1% after.
- The ramp was dropped: in whole runs it only moved the falls to the end of the year (waves 25 to 32) instead of preventing them.

## Why 1.65 and not 1.6

1.6 brings the mixed bot down to 32.5% and cuts the deadliness of a hard wave on the same castle to a third. That is close to what 1.5 alone gave,
which looked too soft for "not too easy". 1.65 is the middle: a hard wave is still a gamble (the mixed bot falls in 38% of runs, the easy bot in 26%).
The always-hard bot gains nothing more from 1.6 (12.0% against 11.8%).

## Depth, 48 runs a row, played to the fall of the castle

| row | before: median, mean, past year one, battle minutes | after |
|---|---|---|
| normal, easy waves | 36, 36.4, 31/48, 32 | 41, 37.7, 31/48, 32 |
| normal, mixed waves | 36, 33.6, 25/48, 33 | 36, 33.3, 30/48, 28 |
| normal, hard waves | 50, 45.5, 38/48, 35 | 59, 53.6, 45/48, 42 |
| relaxed, easy waves | 59, 58.0, 46/48, 36 | 61, 57.3, 47/48, 34 |
| siege 3, easy | 17, 25.4, 19/48, 36 | 22, 26.8, 18/48, 33 |
| siege 6, easy | 14, 14.8, 3/48, 27 | 14, 15.5, 4/48, 36 |
| siege 3, hard | 37, 32.9, 28/48, 37 | 38, 34.2, 27/48, 41 |
| siege 5, hard | 16, 19.9, 11/48, 29 | 17, 20.5, 13/48, 31 |

Medians of 16 runs (what `npm run balance` printed in the design note before) jump by ten waves from the dice alone; the note's table now uses 48 runs.

## Left alone on purpose

- Always-hard being the safest strategy (it was so before).
- The cliff: a hard wave is mostly either clean or the end of the run, and the wave card does not say whether the castle can take it.

## Running the tools

They live outside the repo's commits on purpose. Snapshots and raw rows were in a temporary folder and are not kept (about 1.2 GB); they take a few minutes to make again.
Result summaries: `results-2026-11-17.txt` (first day) and `results-2026-11-17-evening.txt`.

```bash
# whole runs to wave 32 (WORKERS processes at low priority; OFFSET skips seeds); output in ./out
WORKERS=8 ./run.sh "<repo>" base-mixed mixed 240 32 1 && node agg.mjs --title=base-mixed -r -t -w -m -d < out/base-mixed.all
# played to the fall of the castle, then the depth table
WORKERS=8 ./run.sh "<repo>" D-normal-hard hard 48 200 1 && node depth.mjs normal-hard=out/D-normal-hard.all
# castles before every chosen wave, then replays under another copy of the rules
ROOT="<repo>" node snap.mjs mixed 0 48 32 ./snaps 6
RAM_PTS=12 HARD_PTS=1.6 ./rep.sh "<candidate root>" c5 ./snaps hard natural,battering 4 --chosen=hard && node ragg.mjs --title=c5 -t < out/c5.all
```

The candidate root is a copy of `server/` at the rules **before** this change with the switches of `cand-switches.diff` applied, plus `test/bots.js` and `package.json`.
Switches: `HARD_PTS` (a number, or `lo:hi` for a ramp over the year), `HARD_JIT`, `HARD_MOD`, `NO_MODS`, `REGEN`, `RAM_PTS`, `RAM_WALL`, `RAM_HP`, `RAM_SPEED`, `RAM_DMG`, `RAM_UNLOCK`, `RAM_SHARE`, `RAM_MIX=brute`.
`batch2.sh` to `batch7.sh` are the exact runs behind the tables. A whole run to wave 32 takes 2 to 3 seconds of one core.

Two slips worth remembering: a wrong argument order once made 720 "mixed" runs play as the easy bot without any error (the worker now refuses an unknown bot),
and 16 or even 48 whole runs cannot tell two rules apart; it took paired replays and 960 runs.
