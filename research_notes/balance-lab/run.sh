#!/bin/zsh
setopt null_glob
# Usage: run.sh <root> <name> <pick> <seeds> <upTo> <siege> [extra worker flags]   (WORKERS=4 at low priority; OFFSET=n skips the first n seeds)
root="$1"; name="$2"; pick="$3"; seeds="$4"; upto="$5"; siege="$6"; shift 6
dir="$(dirname "$0")/out"; mkdir -p "$dir"; rm -f "$dir/$name".*.jsonl
W=${WORKERS:-4}; per=$(( (seeds + W - 1) / W ))
for w in $(seq 0 $((W - 1))); do
  from=$((w * per)); cnt=$per; if [ $((from + cnt)) -gt $seeds ]; then cnt=$((seeds - from)); fi; from=$((from + ${OFFSET:-0}))
  if [ $cnt -gt 0 ]; then ROOT="$root" nice -n 15 node "$(dirname "$0")/worker.mjs" "$pick" $from $cnt "$upto" "$siege" "$@" > "$dir/$name.$w.jsonl" 2>"$dir/$name.$w.err" & fi
done
wait
cat "$dir/$name".*.jsonl > "$dir/$name.all"
cat "$dir/$name".*.err | head -5
