#!/bin/zsh
# Remaining candidate rules against the same castles and the same hard waves.
cd "$(dirname "$0")"; C="$PWD/../cand"; SN="$PWD/snaps"; OUT="out/batch2.txt"; : > "$OUT"
one() { name="$1"; shift; t0=$(date +%s); env "$@" ./rep.sh "$C" "$name" "$SN" hard natural,battering 4 --chosen=hard; node ragg.mjs --title="$name ($*)" -t -m < "out/$name.all" > "out/$name.txt"; grep -E "^$name|^    w" "out/$name.txt" >> "$OUT"; echo "    took $(( $(date +%s) - t0 ))s" >> "$OUT"; }
one c5 RAM_PTS=12 HARD_PTS=1.6
one c6 RAM_PTS=12 HARD_PTS=1.5
one c9 RAM_PTS=12 HARD_PTS=1.65
one c10 RAM_PTS=12 HARD_PTS=1.5:1.75
one c7 HARD_MOD=0.2
one c8 RAM_PTS=12 HARD_PTS=1.6 HARD_MOD=0.2
for no in muts adapt weather season; do t0=$(date +%s); ./rep.sh "$C" "n-$no" "$SN" hard natural,battering 4 --chosen=hard --no=$no; node ragg.mjs --title="n-$no (without $no)" -t -m < "out/n-$no.all" > "out/n-$no.txt"; grep -E "^n-$no|^    w" "out/n-$no.txt" >> "$OUT"; echo "    took $(( $(date +%s) - t0 ))s" >> "$OUT"; done
echo DONE >> "$OUT"
