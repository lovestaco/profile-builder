# Profile Builder — Chrome Extension

Wraps the Peerlist launchpad upvote script into a two-button extension. No more
pasting JS into the console.

## Install (load unpacked)

1. Open `chrome://extensions` in Chrome.
2. Toggle **Developer mode** on (top right).
3. Click **Load unpacked** and select this `extension/` folder.
4. Pin the extension from the puzzle-piece menu.

## Use

1. Go to the weekly launchpad, e.g. `https://peerlist.io/launchpad/2026/week/26`.
2. Open any launch project so its popup is showing.
3. Click the extension icon.
4. Pick **Peerlist** from the dropdown → the **Auto Upvote Launch** card appears.
5. Click **Start**. It upvotes the current project, waits like a human, clicks
   **Next**, and repeats. Live status shows in the popup.
6. Click **Stop & Export CSV** anytime — it stops and downloads
   `peerlist_upvoted.csv`. (It also auto-exports when it reaches the end of the
   list.)

The loop runs in the page, so it keeps going even if you close the popup. Reopen
the popup to see live status and the Stop button.

## Adding more platforms

- `popup.js` → add an entry to `PLATFORMS` and an `<option>` in `popup.html`.
- `content.js` → handle the new platform's actions, gated by `manifest.json`
  `content_scripts.matches` / `host_permissions`.
