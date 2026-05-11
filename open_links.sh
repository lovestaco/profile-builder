#!/usr/bin/env bash
set -euo pipefail

LINKS_FILE="$(dirname "$0")/links.txt"
CHROME="/mnt/c/Program Files/Google/Chrome/Application/chrome.exe"

if [[ ! -x "$CHROME" ]]; then
    CHROME="/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"
fi

mapfile -t urls < <(grep -E '^https?://' "$LINKS_FILE")

"$CHROME" "${urls[@]}"
