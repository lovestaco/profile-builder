#!/usr/bin/env bash
set -euo pipefail

DIR="$(dirname "$0")"
LINKS_FILE="$DIR/links.txt"
OPENED_FILE="$DIR/opened.txt"
BATCH_SIZE=10

touch "$OPENED_FILE"

batch=()
while IFS= read -r url; do
    if grep -Fxq "$url" "$OPENED_FILE"; then
        continue
    fi
    batch+=("$url")
    if [[ ${#batch[@]} -ge $BATCH_SIZE ]]; then
        break
    fi
done < <(grep -E '^https?://' "$LINKS_FILE")

if [[ ${#batch[@]} -eq 0 ]]; then
    echo "No new links to open. All links have been opened."
    exit 0
fi

if grep -qi microsoft /proc/version 2>/dev/null; then
    CHROME="/mnt/c/Program Files/Google/Chrome/Application/chrome.exe"
    if [[ ! -x "$CHROME" ]]; then
        CHROME="/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"
    fi
    "$CHROME" "${batch[@]}"
else
    for url in "${batch[@]}"; do
        xdg-open "$url"
    done
fi

printf '%s\n' "${batch[@]}" >> "$OPENED_FILE"

echo "Opened ${#batch[@]} link(s). Total opened: $(wc -l < "$OPENED_FILE")."
