#!/bin/zsh
# Whole first years, 240 seeds per rule and bot, so that the rules can be told apart.
cd "$(dirname "$0")"; C="$PWD/../cand"; OUT="out/batch4.txt"; : > "$OUT"; N=${SEEDS:-240}
run() { name="$1"; pick="$2"; shift 2; t0=$(date +%s); env "$@" ./run.sh "$C" "$name" "$pick" $N 32 1; node agg.mjs --title="$name ($*)" < "out/$name.all" >> "$OUT"; echo "    took $(( $(date +%s) - t0 ))s" >> "$OUT"; }
run L-mixed-base mixed X=1
run L-mixed-c mixed RAM_PTS=12 HARD_PTS=1.5:1.75
run L-mixed-b mixed RAM_PTS=12 HARD_PTS=1.65
run L-mixed-a mixed RAM_PTS=12 HARD_PTS=1.6
run L-mixed-ram mixed RAM_PTS=12
run L-easy-base easy X=1
run L-easy-ram easy RAM_PTS=12
run L-hard-base hard X=1
run L-hard-c hard RAM_PTS=12 HARD_PTS=1.5:1.75
run L-hard-b hard RAM_PTS=12 HARD_PTS=1.65
run L-hard-a hard RAM_PTS=12 HARD_PTS=1.6
echo DONE >> "$OUT"
