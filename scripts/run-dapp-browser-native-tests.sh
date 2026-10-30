#!/usr/bin/env bash
# Android WebView/network mechanism tests; this is not wallet product acceptance.
set -euo pipefail
FRESNICA_BROWSER_ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
FRESNICA_BROWSER_DEVICE="${FRESNICA_ANDROID_DEVICE:-emulator-5554}"
FRESNICA_BROWSER_ADB="${ANDROID_HOME:-$HOME/Library/Android/sdk}/platform-tools/adb"
cd "$FRESNICA_BROWSER_ROOT"
mkdir -p test-results
if [[ "${1:-}" == "--rebuild" ]]; then
  (cd android && ./gradlew :app:assembleDebug :app:assembleDebugAndroidTest -PreactNativeArchitectures=arm64-v8a)
fi
"$FRESNICA_BROWSER_ADB" -s "$FRESNICA_BROWSER_DEVICE" get-state
"$FRESNICA_BROWSER_ADB" -s "$FRESNICA_BROWSER_DEVICE" shell getprop ro.build.version.sdk
"$FRESNICA_BROWSER_ADB" -s "$FRESNICA_BROWSER_DEVICE" shell dumpsys webviewupdate | sed -n '/Current WebView package/p'
"$FRESNICA_BROWSER_ADB" -s "$FRESNICA_BROWSER_DEVICE" install -r -t android/app/build/outputs/apk/debug/app-debug.apk
"$FRESNICA_BROWSER_ADB" -s "$FRESNICA_BROWSER_DEVICE" install -r -t android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
"$FRESNICA_BROWSER_ADB" -s "$FRESNICA_BROWSER_DEVICE" shell am instrument -w -r \
  com.fresnica.mobile.test/com.fresnica.mobile.DappBrowserNetworkTest \
  | tee test-results/dapp-browser-native.log
# Android's instrumentation command can exit zero even when a test failed.
grep -q 'INSTRUMENTATION_RESULT: success=true' test-results/dapp-browser-native.log
grep -q 'failed=0 forbiddenConnections=0' test-results/dapp-browser-native.log
