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
    const releaseBlock = buildGradle.match(/release\s*\{([\s\S]*?)\n\s*\}/)?.[1];

    expect(releaseBlock).toBeDefined();
    expect(releaseBlock).not.toMatch(/signingConfig\s+signingConfigs\.debug\b/);
  });
});
