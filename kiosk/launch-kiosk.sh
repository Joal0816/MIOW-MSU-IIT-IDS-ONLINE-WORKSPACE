#!/usr/bin/env bash
# MIOW LMS Standalone Kiosk Launcher
# Launches Chromium or Chrome in full dedicated Kiosk Mode for testing & local deployments.

TARGET_URL="${1:-http://localhost:3000/dashboard/student/quizzes}"
PROFILE_DIR="/tmp/miow_kiosk_profile"

mkdir -p "$PROFILE_DIR"

echo "=========================================================="
echo " Starting MIOW Assessment Kiosk"
echo " Target URL : $TARGET_URL"
echo " Exit Key   : Alt+F4 or kill process"
echo "=========================================================="

if command -v chromium >/dev/null 2>&1; then
  CHROME_BIN="chromium"
elif command -v google-chrome >/dev/null 2>&1; then
  CHROME_BIN="google-chrome"
elif command -v brave-browser >/dev/null 2>&1; then
  CHROME_BIN="brave-browser"
else
  echo "Error: Chromium or Chrome is required to run standalone kiosk mode."
  exit 1
fi

exec "$CHROME_BIN" \
  --kiosk "$TARGET_URL" \
  --user-data-dir="$PROFILE_DIR" \
  --no-first-run \
  --disable-translate \
  --disable-features=Translate \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --disable-infobars \
  --incognito \
  --app="$TARGET_URL"
