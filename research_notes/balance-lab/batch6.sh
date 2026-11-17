#!/bin/zsh
# The depth table under the applied rules: 48 runs a row, played to the fall of the castle (cap: wave 200).
cd "$(dirname "$0")"; ROOT_NEW="$1"; OUT="out/batch6.txt"; : > "$OUT"
row() { name="$1"; pick="$2"; siege="$3"; t0=$(date +%s); ./run.sh "$ROOT_NEW" "D-$name" "$pick" 48 200 "$siege"; node depth.mjs "$name=out/D-$name.all" >> "$OUT"; echo "    took $(( $(date +%s) - t0 ))s" >> "$OUT"; }
row normal-mixed mixed 1
row normal-hard hard 1
row normal-easy easy 1
row relaxed-easy easy 0
row siege3-easy easy 3
row siege6-easy easy 6
row siege10-easy easy 10
row siege3-hard hard 3
row siege5-hard hard 5
echo DONE >> "$OUT"
