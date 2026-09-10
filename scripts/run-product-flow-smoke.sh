#!/usr/bin/env bash
set -euo pipefail

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT"

PLATFORM="${1:-}"
REBUILD="${2:-}"
if [[ "$PLATFORM" != "android" ]]; then
  echo "Usage: bash scripts/run-product-flow-smoke.sh android [--rebuild]" >&2
  exit 2
fi

ENTRY="$ROOT/scripts/product-flow-smoke-entry.js"
INDEX="$ROOT/index.js"
RESULT="/tmp/fresnica-product-flow-result.json"
SERVER_LOG="/tmp/fresnica-product-flow-server.log"
METRO_LOG="/tmp/fresnica-product-flow-metro.log"
BUNDLE_ID="com.fresnica.mobile"
METRO_PORT=8081
CALLBACK_PORT=8767
TIMEOUT_MS="${FRESNICA_PRODUCT_FLOW_TIMEOUT_MS:-180000}"

METRO_PID=""
SERVER_PID=""
STARTED_METRO=0
INDEX_BACKUP="$(mktemp /tmp/fresnica-product-flow-index.XXXXXX)"
cp "$INDEX" "$INDEX_BACKUP"

stop_app() {
  adb shell am force-stop "$BUNDLE_ID" >/dev/null 2>&1 || true
}

clear_product_realm() {
  adb shell run-as "$BUNDLE_ID" rm -f files/product-flow-smoke.realm >/dev/null 2>&1 || true
  adb shell run-as "$BUNDLE_ID" rm -f files/product-flow-smoke.realm.lock >/dev/null 2>&1 || true
  adb shell run-as "$BUNDLE_ID" rm -f files/product-flow-smoke.realm.note >/dev/null 2>&1 || true
  adb shell run-as "$BUNDLE_ID" rm -rf files/product-flow-smoke.realm.management >/dev/null 2>&1 || true
}

reload_metro() {
  curl --silent --fail "http://127.0.0.1:${METRO_PORT}/reload" >/dev/null 2>&1 || true
}

cleanup() {
  local status=$?
  stop_app
  clear_product_realm
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  if [[ "$STARTED_METRO" -eq 1 && -n "$METRO_PID" ]] && kill -0 "$METRO_PID" 2>/dev/null; then
    kill "$METRO_PID" 2>/dev/null || true
    wait "$METRO_PID" 2>/dev/null || true
  fi
  if [[ -f "$INDEX_BACKUP" ]]; then
    cp "$INDEX_BACKUP" "$INDEX"
    rm -f "$INDEX_BACKUP"
  fi
  reload_metro
  exit "$status"
}
trap cleanup EXIT INT TERM

if ! command -v adb >/dev/null 2>&1; then
  echo "adb is required for the product-flow smoke" >&2
  exit 1
fi
if ! adb devices | grep -w 'device' >/dev/null; then
  echo "No Android device/emulator is available" >&2
  exit 1
fi
if [[ ! -f "$ENTRY" ]]; then
  echo "Missing product-flow smoke entry: $ENTRY" >&2
  exit 1
fi

if [[ "$REBUILD" == "--rebuild" ]]; then
  echo "Rebuilding Android debug APK"
  (
    cd "$ROOT/android"
    ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}" \
      ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}" \
      ./gradlew :app:assembleDebug
  )
fi

APK="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
if [[ ! -f "$APK" ]]; then
  echo "Missing debug APK. Run with --rebuild first." >&2
  exit 1
fi

adb install -r "$APK" >/dev/null
stop_app
clear_product_realm
cp "$ENTRY" "$INDEX"
rm -f "$RESULT" "$SERVER_LOG"

if curl --silent --fail "http://127.0.0.1:${METRO_PORT}/status" 2>/dev/null | grep -q 'packager-status:running'; then
  echo "Reusing Metro on 127.0.0.1:${METRO_PORT}"
else
  echo "Starting Metro on 127.0.0.1:${METRO_PORT}"
  npm start -- --port "$METRO_PORT" >"$METRO_LOG" 2>&1 &
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
    echo "Metro did not become ready. See $METRO_LOG" >&2
    exit 1
  fi
fi

if lsof -nP -iTCP:"$CALLBACK_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port ${CALLBACK_PORT} is already in use" >&2
  exit 1
fi

adb reverse "tcp:${METRO_PORT}" "tcp:${METRO_PORT}"
adb reverse "tcp:${CALLBACK_PORT}" "tcp:${CALLBACK_PORT}"
reload_metro
sleep 1
echo "Starting product-flow callback server"
FRESNICA_PRODUCT_FLOW_PORT="$CALLBACK_PORT" \
  FRESNICA_PRODUCT_FLOW_RESULT="$RESULT" \
  FRESNICA_PRODUCT_FLOW_TIMEOUT_MS="$TIMEOUT_MS" \
  node "$ROOT/scripts/product-flow-smoke-server.mjs" >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
sleep 0.5
if ! kill -0 "$SERVER_PID" 2>/dev/null; then
  echo "Product-flow callback server failed to start" >&2
  cat "$SERVER_LOG" >&2
  exit 1
fi

adb shell monkey -p "$BUNDLE_ID" -c android.intent.category.LAUNCHER 1 >/dev/null

echo "Waiting for cold onboarding -> main shell -> Testnet read/write"
set +e
wait "$SERVER_PID"
server_status=$?
set -e
SERVER_PID=""

if [[ ! -f "$RESULT" ]]; then
  echo "No product-flow result was written" >&2
  cat "$SERVER_LOG" >&2
  exit 1
fi
echo
echo "----- product-flow result -----"
cat "$RESULT"
echo "-------------------------------"

if [[ "$server_status" -ne 0 ]]; then
  echo "Product-flow smoke FAILED (exit $server_status)" >&2
  cat "$SERVER_LOG" >&2
  exit "$server_status"
fi

node -e '
const fs = require("fs");
const result = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (result.marker !== "FRESNICA_PRODUCT_FLOW_SMOKE_OK") process.exit(1);
const body = typeof result.body === "string" ? JSON.parse(result.body) : result.body;
const expected = {
  networkId: "stellar-testnet",
  coldBootstrap: "onboarding",
  pendingBackup: "pending-mnemonic-backup",
  mainShell: "ready",
  accountRead: "active",
};
for (const [key, value] of Object.entries(expected)) {
  if (body?.[key] !== value) {
    console.error(`Unexpected ${key}:`, body?.[key]);
    process.exit(1);
  }
}if (!/^G[A-Z2-7]{55}$/.test(body?.sourceAddress ?? "")) process.exit(1);
if (!/^[0-9a-f]{64}$/.test(body?.transactionHash ?? "")) process.exit(1);
if (!body?.beforeNativeBalance || !body?.afterNativeBalance) process.exit(1);
if (body.beforeNativeBalance === body.afterNativeBalance) {
  console.error("Balance did not change after the Testnet write");
  process.exit(1);
}
if (body.writeStatus !== "submitted" && body.writeStatus !== "confirmed") {
  console.error("Unexpected write status:", body.writeStatus);
  process.exit(1);
}
' "$RESULT"

echo "Product native-flow smoke PASSED on Android"
