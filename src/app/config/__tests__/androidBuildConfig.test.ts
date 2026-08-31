const { readFileSync } = require('fs');

function readAndroidRootBuildGradle(): string {
  return readFileSync('android/build.gradle', 'utf8');
}

function readAndroidAppBuildGradle(): string {
  return readFileSync('android/app/build.gradle', 'utf8');
}

describe('Android native compatibility', () => {
  it('pins minSdkVersion 26 for Fresnica Native SDK 0.2.1', () => {
    expect(readAndroidRootBuildGradle()).toMatch(/minSdkVersion\s*=\s*26\b/);
  });

  it('never signs release builds with the repository debug keystore', () => {
    const buildGradle = readAndroidAppBuildGradle();
    const debugSigningReferences = buildGradle.match(
      /signingConfig\s+signingConfigs\.debug\b/g,
    );

    expect(debugSigningReferences).toHaveLength(1);
    expect(buildGradle).toMatch(
      /debug\s*\{\s*signingConfig\s+signingConfigs\.debug\b/,
    );
  });

  it('requires external production signing material for release builds', () => {
    const buildGradle = readAndroidAppBuildGradle();

    expect(buildGradle).toContain("file('release/fresnica-release.keystore')");
    expect(buildGradle).toContain('FRESNICA_RELEASE_STORE_PASSWORD');
    expect(buildGradle).toContain('FRESNICA_RELEASE_KEY_ALIAS');
    expect(buildGradle).toContain('FRESNICA_RELEASE_KEY_PASSWORD');
    expect(buildGradle).toContain('if (releaseRequested && !hasReleaseSigning)');
    expect(buildGradle).toContain('signingConfig signingConfigs.release');
  });
});
