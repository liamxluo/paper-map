#!/bin/bash
# Paper Map: make the Mac app on this Mac. Double-click this file in Finder (or run: bash build-mac.command).
# The first time it installs what it needs (Apple's command line tools, Rust); Node.js you install yourself.
cd "$(dirname "$0")" || exit 1
echo "Paper Map: making the Mac app…"
if ! xcode-select -p >/dev/null 2>&1; then
  echo "Apple's command line tools are needed. A window opens to install them; run this again when it has finished."
  xcode-select --install; exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is needed: install the LTS version from nodejs.org, then run this again."
  open "https://nodejs.org/en/download"; exit 1
fi
if ! command -v cargo >/dev/null 2>&1; then
  if [ -x "$HOME/.cargo/bin/cargo" ]; then export PATH="$HOME/.cargo/bin:$PATH"
  else
    echo "Installing Rust (only this once)…"
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y || exit 1
    export PATH="$HOME/.cargo/bin:$PATH"
  fi
fi
npm install && npm run mac || { echo "The build stopped: see the messages above."; exit 1; }
DMG=$(ls -t src-tauri/target/release/bundle/dmg/*.dmg 2>/dev/null | head -1)
echo "Done: $DMG"
[ -n "$DMG" ] && open -R "$DMG"
