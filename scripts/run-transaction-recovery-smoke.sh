#!/usr/bin/env bash
set -euo pipefail

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT"

ENTRY="$ROOT/scripts/transaction-recovery-smoke-entry.js"
INDEX="$ROOT/index.js"
PENDING_RESULT="/tmp/fresnica-transaction-recovery-pending.json"
FINAL_RESULT="/tmp/fresnica-transaction-recovery-final.json"
SERVER_LOG="/tmp/fresnica-transaction-recovery-server.log"
METRO_LOG="/tmp/fresnica-transaction-recovery-metro.log"
BUNDLE_ID="com.fresnica.mobile"
METRO_PORT=8081
CALLBACK_PORT=8766
REBUILD="${1:-}"

METRO_PID=""
SERVER_PID=""
STARTED_METRO=0
INDEX_BACKUP="$(mktemp /tmp/fresnica-index-backup.XXXXXX)"
cp "$INDEX" "$INDEX_BACKUP"

stop_test_app() {
  adb shell am force-stop "$BUNDLE_ID" >/dev/null 2>&1 || true
}

clear_recovery_realm() {
  adb shell run-as "$BUNDLE_ID" rm -f files/transaction-recovery-smoke.realm >/dev/null 2>&1 || true
  adb shell run-as "$BUNDLE_ID" rm -f files/transaction-recovery-smoke.realm.lock >/dev/null 2>&1 || true
  adb shell run-as "$BUNDLE_ID" rm -f files/transaction-recovery-smoke.realm.note >/dev/null 2>&1 || true
  adb shell run-as "$BUNDLE_ID" rm -rf files/transaction-recovery-smoke.realm.management >/dev/null 2>&1 || true
}

reload_metro() {
  curl --silent --fail "http://127.0.0.1:${METRO_PORT}/reload" >/dev/null 2>&1 || true
}

cleanup() {
  local status=$?
  stop_test_app
  clear_recovery_realm
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
  echo "adb is required for the Transaction recovery smoke" >&2
  exit 1
fi
if ! adb devices | grep -w 'device' >/dev/null; then
  echo "No Android device/emulator is available" >&2
  exit 1
fi
if [[ ! -f "$ENTRY" ]]; then
  echo "Missing Transaction smoke entry: $ENTRY" >&2
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
stop_test_app
clear_recovery_realm
cp "$ENTRY" "$INDEX"
rm -f "$PENDING_RESULT" "$FINAL_RESULT" "$SERVER_LOG"

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

adb reverse "tcp:${METRO_PORT}" "tcp:${METRO_PORT}"
adb reverse "tcp:${CALLBACK_PORT}" "tcp:${CALLBACK_PORT}"
reload_metro
echo "Starting Transaction callback server"
FRESNICA_TRANSACTION_RECOVERY_PORT="$CALLBACK_PORT" \
  FRESNICA_TRANSACTION_RECOVERY_PENDING_RESULT="$PENDING_RESULT" \
  FRESNICA_TRANSACTION_RECOVERY_FINAL_RESULT="$FINAL_RESULT" \
  node "$ROOT/scripts/transaction-recovery-smoke-server.mjs" >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
sleep 0.5
if ! kill -0 "$SERVER_PID" 2>/dev/null; then
  echo "Transaction callback server failed to start" >&2
  cat "$SERVER_LOG" >&2
  exit 1
fi

launch_app() {
  adb shell monkey -p "$BUNDLE_ID" -c android.intent.category.LAUNCHER 1 >/dev/null
}

launch_app
first_pid=""
for _ in $(seq 1 30); do
  first_pid="$(adb shell pidof "$BUNDLE_ID" 2>/dev/null | tr -d '\r' || true)"
  if [[ -n "$first_pid" ]]; then
    break
  fi
  sleep 1
done
if [[ -z "$first_pid" ]]; then
  echo "First Transaction app process did not start" >&2
  exit 1
fi
echo "Waiting for a real Testnet submission to become uncertain and durable"
pending_ready=0
for _ in $(seq 1 120); do
  if [[ -f "$PENDING_RESULT" ]]; then
    pending_ready=1
    break
  fi
  if [[ -f "$FINAL_RESULT" ]]; then
    break
  fi
  sleep 1
done
if [[ "$pending_ready" -ne 1 ]]; then
  echo "Pending stage did not complete" >&2
  cat "$FINAL_RESULT" 2>/dev/null || true
  cat "$SERVER_LOG" >&2
  exit 1
fi

echo "Pending persisted; inspecting dedicated Realm before process death"
cat "$PENDING_RESULT"
adb shell run-as "$BUNDLE_ID" ls -la files 2>/dev/null | grep transaction-recovery-smoke || true
echo "Force-stopping process $first_pid"
stop_test_app
for _ in $(seq 1 20); do
  if ! adb shell pidof "$BUNDLE_ID" 2>/dev/null | grep -q '[0-9]'; then
    break
  fi
  sleep 0.25
done
if adb shell pidof "$BUNDLE_ID" 2>/dev/null | grep -q '[0-9]'; then
  echo "First process did not terminate" >&2
  exit 1
fi

launch_app
second_pid=""
for _ in $(seq 1 30); do
  second_pid="$(adb shell pidof "$BUNDLE_ID" 2>/dev/null | tr -d '\r' || true)"
  if [[ -n "$second_pid" ]]; then
    break
  fi
  sleep 1
done
if [[ -z "$second_pid" || "$second_pid" == "$first_pid" ]]; then
  echo "Second process was not a fresh process: first=$first_pid second=$second_pid" >&2
  exit 1
fi

echo "Fresh process $second_pid is reconciling the persisted hash"
set +e
wait "$SERVER_PID"
server_status=$?
set -e
SERVER_PID=""

if [[ "$server_status" -ne 0 || ! -f "$FINAL_RESULT" ]]; then
  echo "Transaction recovery server failed with status $server_status" >&2
  cat "$FINAL_RESULT" 2>/dev/null || true
  cat "$SERVER_LOG" >&2
  exit 1
fi

node -e '
const fs = require("fs");
const pendingResult = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const finalResult = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
if (pendingResult.marker !== "FRESNICA_TRANSACTION_RECOVERY_PENDING") process.exit(1);
if (finalResult.marker !== "FRESNICA_TRANSACTION_RECOVERY_RECOVERED") process.exit(1);
const pending = JSON.parse(pendingResult.body);
const final = JSON.parse(finalResult.body);
if (final.state !== "confirmed" || !final.transactionHash) process.exit(1);
for (const key of ["networkId", "accountId", "sourceAddress", "transactionHash", "realmPath"]) {
  if (pending[key] !== final[key]) {
    console.error(`Transaction recovery identity mismatch for ${key}: ${pending[key]} != ${final[key]}`);
    process.exit(1);
  }
}
' "$PENDING_RESULT" "$FINAL_RESULT"
echo
echo "----- pending before process death -----"
cat "$PENDING_RESULT"
echo "----- recovered after restart -----"
cat "$FINAL_RESULT"
echo "-----------------------------------"
echo "Transaction Testnet recovery PASSED: first_pid=$first_pid second_pid=$second_pid"
