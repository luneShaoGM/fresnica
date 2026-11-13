#!/usr/bin/env bash
# Screen-capture window/lifecycle mechanism regression; no wallet product acceptance.
set -euo pipefail
FRESNICA_CAPTURE_ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
FRESNICA_CAPTURE_DEVICE="${FRESNICA_ANDROID_DEVICE:-emulator-5554}"
FRESNICA_CAPTURE_ADB="${ANDROID_HOME:-$HOME/Library/Android/sdk}/platform-tools/adb"
FRESNICA_CAPTURE_INIT="$(mktemp -t fresnica-capture-init)"
trap 'rm -f "$FRESNICA_CAPTURE_INIT"' EXIT
cat > "$FRESNICA_CAPTURE_INIT" <<'GRADLE'
gradle.beforeProject { project ->
    project.pluginManager.withPlugin('com.android.application') {
        project.androidComponents.finalizeDsl { android ->
            android.buildTypes.getByName('debug').applicationIdSuffix = '.capturetest'
            android.defaultConfig.testInstrumentationRunner = 'com.fresnica.wallet.ScreenCaptureProtectionNativeTest'
        }
    }
}
GRADLE
cd "$FRESNICA_CAPTURE_ROOT"
mkdir -p test-results
(cd android && ./gradlew :app:assembleDebug :app:assembleDebugAndroidTest --no-watch-fs \
  --init-script "$FRESNICA_CAPTURE_INIT" -PreactNativeArchitectures=arm64-v8a)
"$FRESNICA_CAPTURE_ADB" -s "$FRESNICA_CAPTURE_DEVICE" get-state
"$FRESNICA_CAPTURE_ADB" -s "$FRESNICA_CAPTURE_DEVICE" install -r -t android/app/build/outputs/apk/debug/app-debug.apk
"$FRESNICA_CAPTURE_ADB" -s "$FRESNICA_CAPTURE_DEVICE" install -r -t android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
"$FRESNICA_CAPTURE_ADB" -s "$FRESNICA_CAPTURE_DEVICE" shell am instrument -w -r \
  com.fresnica.wallet.test.capturetest.test/com.fresnica.wallet.ScreenCaptureProtectionNativeTest \
  | tee test-results/screen-capture-native.log
grep -q 'INSTRUMENTATION_RESULT: success=true' test-results/screen-capture-native.log
