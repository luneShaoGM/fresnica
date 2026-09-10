#!/usr/bin/env bash
# Repeatable Fresnica + Realm native runtime smoke.
# Usage:
#   bash scripts/run-native-runtime-smoke.sh ios
#   bash scripts/run-native-runtime-smoke.sh android
#   bash scripts/run-native-runtime-smoke.sh ios --rebuild
set -euo pipefail

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT"

PLATFORM="${1:-}"
REBUILD=0
if [[ "${2:-}" == "--rebuild" ]]; then
  REBUILD=1
fi

if [[ "$PLATFORM" != "ios" && "$PLATFORM" != "android" ]]; then
  echo "Usage: bash scripts/run-native-runtime-smoke.sh <ios|android> [--rebuild]" >&2
  exit 2
fi

ENTRY="$ROOT/scripts/native-runtime-smoke-entry.js"
INDEX="$ROOT/index.js"
RESULT="$ROOT/native-runtime-smoke-result.json"
SMOKE_PORT="${FRESNICA_SMOKE_PORT:-8765}"
METRO_PORT="${FRESNICA_METRO_PORT:-8081}"
BUNDLE_ID="com.fresnica.mobile"
TIMEOUT_MS="${FRESNICA_SMOKE_TIMEOUT_MS:-120000}"

METRO_PID=""
SMOKE_PID=""
STARTED_METRO=0

cleanup() {
  local status=$?
  if [[ -n "$SMOKE_PID" ]] && kill -0 "$SMOKE_PID" 2>/dev/null; then
    kill "$SMOKE_PID" 2>/dev/null || true
    wait "$SMOKE_PID" 2>/dev/null || true
  fi
  if [[ "$STARTED_METRO" -eq 1 && -n "$METRO_PID" ]] && kill -0 "$METRO_PID" 2>/dev/null; then
    kill "$METRO_PID" 2>/dev/null || true
    wait "$METRO_PID" 2>/dev/null || true
  fi
  git checkout -- "$INDEX" 2>/dev/null || true
  reload_metro || true
  exit "$status"
}

reload_metro() {
  curl --silent --fail "http://127.0.0.1:${METRO_PORT}/reload" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

if [[ ! -x "$ROOT/node_modules/.bin/react-native" ]]; then
  echo "react-native CLI not found. Run npm ci in $ROOT first." >&2
  exit 1
fi
if [[ ! -f "$ENTRY" ]]; then
  echo "missing smoke entry: $ENTRY" >&2
  exit 1
fi

cp "$ENTRY" "$INDEX"
rm -f "$RESULT"

if curl --silent --fail "http://127.0.0.1:${METRO_PORT}/status" 2>/dev/null | grep -q 'packager-status:running'; then
  echo "Reusing Metro on 127.0.0.1:${METRO_PORT}"
else
  echo "Starting Metro on 127.0.0.1:${METRO_PORT}"
  npm start -- --port "$METRO_PORT" >/tmp/fresnica-metro.log 2>&1 &
  METRO_PID=$!
  STARTED_METRO=1
  ready=0
  for _ in $(seq 1 60); do
    if curl --silent --fail "http://127.0.0.1:${METRO_PORT}/status" 2>/dev/null | grep -q 'packager-status:running'; then
      ready=1
      break
    fi
    sleep 1
  done
  if [[ "$ready" -ne 1 ]]; then
    echo "Metro did not become ready. See /tmp/fresnica-metro.log" >&2
    exit 1
  fi
fi

if lsof -nP -iTCP:"$SMOKE_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port ${SMOKE_PORT} is already in use. Stop the previous smoke server and retry." >&2
  exit 1
fi

reload_metro
sleep 1

echo "Starting smoke callback server on 127.0.0.1:${SMOKE_PORT}"
FRESNICA_SMOKE_PORT="$SMOKE_PORT" \
  FRESNICA_SMOKE_RESULT="$RESULT" \
  FRESNICA_SMOKE_TIMEOUT_MS="$TIMEOUT_MS" \
  node "$ROOT/scripts/native-runtime-smoke-server.mjs" &
SMOKE_PID=$!
sleep 0.4
if ! kill -0 "$SMOKE_PID" 2>/dev/null; then
  echo "Smoke server failed to start" >&2
  exit 1
fi

launch_android() {
  if ! command -v adb >/dev/null 2>&1; then
    echo "adb is required for Android smoke" >&2
    exit 1
  fi
  if ! adb devices | grep -w 'device' >/dev/null; then
    echo "No Android device/emulator (adb status=device). Start one and retry." >&2
    exit 1
  fi
  adb reverse "tcp:${METRO_PORT}" "tcp:${METRO_PORT}"
  adb reverse "tcp:${SMOKE_PORT}" "tcp:${SMOKE_PORT}"
  if [[ "$REBUILD" -eq 1 ]]; then
    echo "Rebuilding Android debug APK"
    (
      cd "$ROOT/android"
      ./gradlew :app:assembleDebug
    )
    adb install -r "$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
  fi
  adb shell am force-stop "$BUNDLE_ID"
  adb shell monkey -p "$BUNDLE_ID" -c android.intent.category.LAUNCHER 1 >/dev/null
}

launch_ios() {
  if [[ "$(uname -s)" != "Darwin" ]]; then
    echo "iOS smoke must run on macOS" >&2
    exit 1
  fi
  local udid=""
  udid="$(xcrun simctl list devices booted | grep -E '\([0-9A-Fa-f-]{36}\)' | head -1 | sed -E 's/.*\(([0-9A-Fa-f-]{36})\).*/\1/' || true)"
  if [[ -z "$udid" ]]; then
    udid="$(xcrun simctl list devices available | grep -E 'iPhone .*\([0-9A-Fa-f-]{36}\)' | head -1 | sed -E 's/.*\(([0-9A-Fa-f-]{36})\).*/\1/' || true)"
    if [[ -z "$udid" ]]; then
      echo "No iOS Simulator available. Boot one in Simulator.app and retry." >&2
      exit 1
    fi
    echo "Booting simulator $udid"
    xcrun simctl boot "$udid" || true
    xcrun simctl bootstatus "$udid" -b
  fi
  if [[ "$REBUILD" -eq 1 ]]; then
    echo "Rebuilding iOS simulator app"
    local derived="/tmp/fresnica-smoke-derived"
    rm -rf "$derived"
    xcodebuild \
      -workspace "$ROOT/ios/Fresnica.xcworkspace" \
      -scheme Fresnica \
      -configuration Debug \
      -sdk iphonesimulator \
      -destination "id=$udid" \
      -derivedDataPath "$derived" \
      CODE_SIGNING_ALLOWED=NO \
      build
    xcrun simctl install "$udid" "$derived/Build/Products/Debug-iphonesimulator/Fresnica.app"
  fi
  xcrun simctl terminate "$udid" "$BUNDLE_ID" || true
  xcrun simctl launch "$udid" "$BUNDLE_ID"
}

echo "Launching $PLATFORM app $BUNDLE_ID"
if [[ "$PLATFORM" == "android" ]]; then
  launch_android
else
  launch_ios
fi

echo "Waiting for smoke callback..."
set +e
wait "$SMOKE_PID"
smoke_status=$?
set -e
SMOKE_PID=""

if [[ ! -f "$RESULT" ]]; then
  echo "No smoke result file written: $RESULT" >&2
  exit 1
fi

echo
echo "----- smoke result -----"
cat "$RESULT"
echo "------------------------"

if [[ "$smoke_status" -ne 0 ]]; then
  echo "Native runtime smoke FAILED (exit $smoke_status)" >&2
  exit "$smoke_status"
fi

node -e '
const fs = require("fs");
const result = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (result.marker !== "FRESNICA_PARSE_ACCOUNT_SMOKE_OK") {
  console.error("Unexpected smoke marker:", result.marker);
  process.exit(1);
}
const body = typeof result.body === "string" ? JSON.parse(result.body) : result.body;
if (body?.realm !== "ok") {
  console.error("Missing Realm runtime proof in smoke body:", body);
  process.exit(1);
}
' "$RESULT"

echo "Native runtime smoke PASSED on $PLATFORM (FresnicaCore + Realm)"
