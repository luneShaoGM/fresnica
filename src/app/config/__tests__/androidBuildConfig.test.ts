const { readFileSync } = require('fs');

function readAndroidRootBuildGradle(): string {
  return readFileSync('android/build.gradle', 'utf8');
}

function readAndroidAppBuildGradle(): string {
  return readFileSync('android/app/build.gradle', 'utf8');
}

describe('Android native compatibility', () => {
  it('pins minSdkVersion 26 for Fresnica Native SDK 0.3.0', () => {
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

});
