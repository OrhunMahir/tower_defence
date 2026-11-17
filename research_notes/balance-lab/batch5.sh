#!/bin/zsh
# 720 more first years per rule and bot (seeds 240 to 959), added to the 240 of batch4: 960 in all.
# The bot is the first part of the name (mixed-b plays the mixed bot).
cd "$(dirname "$0")"; C="$PWD/../cand"; OUT="out/batch5.txt"; : > "$OUT"
more() { name="$1"; pick="${name%%-*}"; shift; t0=$(date +%s); env "$@" OFFSET=240 ./run.sh "$C" "M-$name" "$pick" 720 32 1; cat "out/L-$name.all" "out/M-$name.all" > "out/A-$name.all"; node agg.mjs --title="A-$name [$pick] ($*)" < "out/A-$name.all" >> "$OUT"; echo "    took $(( $(date +%s) - t0 ))s; errors: $(cat out/M-$name.*.err | head -c 200)" >> "$OUT"; }
env RAM_PTS=12 ./run.sh "$C" L-hard-ram hard 240 32 1
more mixed-b RAM_PTS=12 HARD_PTS=1.65
more mixed-a RAM_PTS=12 HARD_PTS=1.6
more mixed-ram RAM_PTS=12
more mixed-base X=1
more hard-b RAM_PTS=12 HARD_PTS=1.65
more hard-a RAM_PTS=12 HARD_PTS=1.6
more hard-ram RAM_PTS=12
more hard-base X=1
more easy-ram RAM_PTS=12
more easy-base X=1
echo DONE >> "$OUT"
