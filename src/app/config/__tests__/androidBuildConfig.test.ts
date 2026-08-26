declare const require: (id: string) => {
  readFileSync(path: string, encoding: string): string;
};
declare const process: { cwd(): string };

const { readFileSync } = require('fs');

function readAndroidRootBuildGradle(): string {
  return readFileSync(`${process.cwd()}/android/build.gradle`, 'utf8');
}

describe('Android native compatibility', () => {
  it('pins minSdkVersion 26 for Fresnica Native SDK 0.2.1', () => {
    expect(readAndroidRootBuildGradle()).toMatch(/minSdkVersion\s*=\s*26\b/);
  });
});
