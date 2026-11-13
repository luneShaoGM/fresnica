const { readFileSync } = require('fs');

function readAndroidRootBuildGradle(): string {
  return readFileSync('android/build.gradle', 'utf8');
}

function readAndroidAppBuildGradle(): string {
  return readFileSync('android/app/build.gradle', 'utf8');
}

describe('Android native compatibility', () => {
  it('pins minSdkVersion 26 for Fresnica Native SDK 0.3.1', () => {
    expect(readAndroidRootBuildGradle()).toMatch(/minSdkVersion\s*=\s*26\b/);
  });

  it('requires independent release signing and forbids the debug signing fallback', () => {
    const source = readAndroidAppBuildGradle();
    const buildTypesStart = source.indexOf('    buildTypes {');
    const releaseStart = source.indexOf('        release {', buildTypesStart);
    const releaseBuildType = source.slice(
      releaseStart,
      source.indexOf('\n        }\n    }\n}\n\ndependencies', releaseStart),
    );

    expect(releaseBuildType).not.toContain('signingConfig signingConfigs.debug');
    expect(releaseBuildType).toContain('signingConfig signingConfigs.release');
    for (const propertyName of [
      'FRESNICA_ANDROID_RELEASE_STORE_FILE',
      'FRESNICA_ANDROID_RELEASE_STORE_PASSWORD',
      'FRESNICA_ANDROID_RELEASE_KEY_ALIAS',
      'FRESNICA_ANDROID_RELEASE_KEY_PASSWORD',
    ]) {
      expect(source).toContain(propertyName);
    }
    expect(source).toContain('gradle.taskGraph.whenReady');
    expect(source).toContain('debug signing fallback is forbidden');
  });

  it('pins the requested Android install identity and keeps native class names stable', () => {
    const source = readAndroidAppBuildGradle();
    expect(source).toContain('namespace "com.fresnica.wallet"');
    expect(source).toContain('applicationId "com.fresnica.wallet.test"');
    expect(source).not.toContain('applicationIdSuffix ".test"');
    expect(source).not.toMatch(/\bbetaRelease\s*\{/);
    const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
    expect((manifest.match(/android:label="@string\/app_name"/g) ?? []).length).toBe(2);
  });

  it('keeps Android smoke and instrumentation launchers aligned to the new install ID', () => {
    for (const path of [
      'scripts/run-native-runtime-smoke.sh',
      'scripts/run-product-flow-smoke.sh',
      'scripts/run-transaction-recovery-smoke.sh',
    ]) {
      expect(readFileSync(path, 'utf8')).toContain('BUNDLE_ID="com.fresnica.wallet.test"');
    }
    expect(readFileSync('scripts/run-dapp-browser-native-tests.sh', 'utf8')).toContain(
      'com.fresnica.wallet.test.test/com.fresnica.wallet.DappBrowserNetworkTest',
    );
    expect(readFileSync('scripts/run-session-auth-native-test.sh', 'utf8')).toContain(
      'com.fresnica.wallet.test.sessionauthtest.test/com.fresnica.wallet.SessionAuthenticationNativeTest',
    );
  });
  it('launches the namespace-qualified MainActivity from the new installation', () => {
    const script = readFileSync('scripts/run-native-runtime-smoke.sh', 'utf8');
    expect(script).toContain('adb shell am start -W -n "$BUNDLE_ID/com.fresnica.wallet.MainActivity"');
    expect(script).not.toContain('"$BUNDLE_ID/.MainActivity"');
  });

  it('targets the #202 screen-capture instrumentation under the new installation', () => {
    const script = readFileSync('scripts/run-screen-capture-native-test.sh', 'utf8');
    expect(script).toContain("android.buildTypes.getByName('debug').applicationIdSuffix = '.capturetest'");
    expect(script).toContain(
      "android.defaultConfig.testInstrumentationRunner = 'com.fresnica.wallet.ScreenCaptureProtectionNativeTest'",
    );
    expect(script).toContain(
      'com.fresnica.wallet.test.capturetest.test/com.fresnica.wallet.ScreenCaptureProtectionNativeTest',
    );
  });
});
