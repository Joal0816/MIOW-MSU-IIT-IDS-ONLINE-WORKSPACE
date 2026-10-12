#!/usr/bin/env bash
# Builds standalone desktop executables for Windows and Linux lab workstations.
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "=== Installing Electron Packager in kiosk companion ==="
bun install

PLATFORM="${1:-linux}"

if [ "$PLATFORM" = "win" ] || [ "$PLATFORM" = "windows" ]; then
  echo "Building Windows 64-bit standalone executable..."
  bun run dist:win
elif [ "$PLATFORM" = "all" ]; then
  echo "Building both Windows and Linux binaries..."
  bun run dist:linux
  bun run dist:win
else
  echo "Building Linux 64-bit standalone binary..."
  bun run dist:linux
fi

echo "=== Build complete. Artifacts saved in kiosk/dist/ ==="
