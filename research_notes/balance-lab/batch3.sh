#!/bin/zsh
# Whole runs to wave 32 under the candidate rules (same 48 seeds as the baseline), then standard waves on easy-bot castles.
cd "$(dirname "$0")"; C="$PWD/../cand"; OUT="out/batch3.txt"; : > "$OUT"
run() { name="$1"; pick="$2"; shift 2; t0=$(date +%s); env "$@" ./run.sh "$C" "$name" "$pick" 48 32 1; node agg.mjs --title="$name ($*)" -r < "out/$name.all" >> "$OUT"; echo "    took $(( $(date +%s) - t0 ))s" >> "$OUT"; }
run a-easy easy RAM_PTS=12
run b-mixed mixed RAM_PTS=12 HARD_PTS=1.65
run c-mixed mixed RAM_PTS=12 HARD_PTS=1.5:1.75
run a-mixed mixed RAM_PTS=12 HARD_PTS=1.6
run c-hard hard RAM_PTS=12 HARD_PTS=1.5:1.75
run b-hard hard RAM_PTS=12 HARD_PTS=1.65
rep() { name="$1"; shift; env "$@" ./rep.sh "$C" "$name" "$PWD/snaps-easy" std natural,battering 4 --chosen=std; node ragg.mjs --title="$name ($*)" -t < "out/$name.all" > "out/$name.txt"; grep -E "^$name|^    w|battering" "out/$name.txt" >> "$OUT"; }
rep e0 X=1
rep e1 RAM_PTS=12
echo DONE >> "$OUT"
