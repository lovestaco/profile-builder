#!/usr/bin/env bash
set -euo pipefail

LINKS_FILE="$(dirname "$0")/links.txt"
mapfile -t urls < <(grep -E '^https?://' "$LINKS_FILE")

if grep -qi microsoft /proc/version 2>/dev/null; then
    CHROME="/mnt/c/Program Files/Google/Chrome/Application/chrome.exe"
    if [[ ! -x "$CHROME" ]]; then
        CHROME="/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"
    fi
    "$CHROME" "${urls[@]}"
else
    xdg-open /dev/null 2>/dev/null || true
    for url in "${urls[@]}"; do
        xdg-open "$url"
    done
fi
