#!/bin/zsh
setopt null_glob
# Usage: rep.sh <root> <name> <snapDir> <tier> <modes> <reps> [extra flags]   (4 workers, low priority)
root="$1"; name="$2"; snaps="$3"; tier="$4"; modes="$5"; reps="$6"; shift 6
dir="$(dirname "$0")/out"; mkdir -p "$dir"; rm -f "$dir/$name".*.jsonl
W=${WORKERS:-4}
for w in $(seq 0 $((W - 1))); do ROOT="$root" nice -n 15 node "$(dirname "$0")/replay.mjs" "$snaps" $w $W "$tier" "$modes" "$reps" "$@" > "$dir/$name.$w.jsonl" 2>"$dir/$name.$w.err" & done
wait
cat "$dir/$name".*.jsonl > "$dir/$name.all"; cat "$dir/$name".*.err | head -5
