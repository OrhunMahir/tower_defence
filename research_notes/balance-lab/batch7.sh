#!/bin/zsh
# The same depth rows under the rules as they were before the softening (the candidate copy without switches), for a like-for-like comparison.
cd "$(dirname "$0")"; C="$PWD/../cand"; OUT="out/batch7.txt"; : > "$OUT"
until grep -q DONE out/batch5.txt; do sleep 5; done
row() { name="$1"; pick="$2"; siege="$3"; t0=$(date +%s); ./run.sh "$C" "O-$name" "$pick" 48 200 "$siege"; node depth.mjs "old-$name=out/O-$name.all" >> "$OUT"; echo "    took $(( $(date +%s) - t0 ))s" >> "$OUT"; }
row normal-mixed mixed 1
row normal-hard hard 1
row normal-easy easy 1
row relaxed-easy easy 0
row siege3-easy easy 3
row siege6-easy easy 6
row siege3-hard hard 3
row siege5-hard hard 5
echo DONE >> "$OUT"
