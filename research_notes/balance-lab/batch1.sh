#!/bin/zsh
# Candidate rules against the same castles and the same hard waves.
cd "$(dirname "$0")"; C="$(dirname "$0")/../cand"; S="$(dirname "$0")/snaps"
one() { name="$1"; shift; env "$@" ./rep.sh "$C" "$name" "$S" hard natural,battering 4 --chosen=hard; node ragg.mjs --title="$name" < "out/$name.all" | grep -v "^    w"; }
one c0 X=1
one c1 RAM_PTS=12
one c2 HARD_PTS=1.6
one c3 HARD_PTS=1.5
one c4 HARD_PTS=1.4
one c5 RAM_PTS=12 HARD_PTS=1.6
one c6 RAM_PTS=12 HARD_PTS=1.5
one c7 HARD_MOD=0.2
one c8 RAM_PTS=12 HARD_PTS=1.6 HARD_MOD=0.2
for no in muts adapt weather season; do ./rep.sh "$C" "n-$no" "$S" hard natural,battering 4 --chosen=hard --no=$no; node ragg.mjs --title="without $no" < "out/n-$no.all" | grep -v "^    w"; done
