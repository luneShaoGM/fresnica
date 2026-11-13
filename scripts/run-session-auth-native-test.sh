#!/usr/bin/env bash
# AndroidX/module cancellation mechanism regression; no wallet product acceptance.
set -euo pipefail
FRESNICA_AUTH_ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
FRESNICA_AUTH_DEVICE="${FRESNICA_ANDROID_DEVICE:-emulator-5554}"
FRESNICA_AUTH_ADB="${ANDROID_HOME:-$HOME/Library/Android/sdk}/platform-tools/adb"
FRESNICA_AUTH_INIT="$(mktemp -t fresnica-auth-init)"
trap 'rm -f "$FRESNICA_AUTH_INIT"' EXIT
cat > "$FRESNICA_AUTH_INIT" <<'GRADLE'
gradle.beforeProject { project ->
    project.pluginManager.withPlugin('com.android.application') {
        project.androidComponents.finalizeDsl { android ->
            android.buildTypes.getByName('debug').applicationIdSuffix = '.sessionauthtest'
            android.defaultConfig.testInstrumentationRunner = 'com.fresnica.wallet.SessionAuthenticationNativeTest'
        }
    }
}
GRADLE
cd "$FRESNICA_AUTH_ROOT"
mkdir -p test-results
(cd android && ./gradlew :app:assembleDebug :app:assembleDebugAndroidTest --no-watch-fs \
  --init-script "$FRESNICA_AUTH_INIT" -PreactNativeArchitectures=arm64-v8a)
"$FRESNICA_AUTH_ADB" -s "$FRESNICA_AUTH_DEVICE" get-state
"$FRESNICA_AUTH_ADB" -s "$FRESNICA_AUTH_DEVICE" install -r -t android/app/build/outputs/apk/debug/app-debug.apk
"$FRESNICA_AUTH_ADB" -s "$FRESNICA_AUTH_DEVICE" install -r -t android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
"$FRESNICA_AUTH_ADB" -s "$FRESNICA_AUTH_DEVICE" shell am instrument -w -r \
  com.fresnica.wallet.test.sessionauthtest.test/com.fresnica.wallet.SessionAuthenticationNativeTest \
  | tee test-results/session-auth-native.log
grep -q 'INSTRUMENTATION_RESULT: success=true' test-results/session-auth-native.log
