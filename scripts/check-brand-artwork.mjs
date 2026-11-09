import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
function file(path) {
  return resolve(root, path);
}
function pngDimensions(path) {
  const bytes = readFileSync(file(path));
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', path);
  assert.equal(bytes.subarray(12, 16).toString('ascii'), 'IHDR', path);
  assert.equal(bytes[24], 8, 'PNG must be 8-bit: ' + path);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), colorType: bytes[25] };
}
function assertSize(path, width, height = width) {
  const actual = pngDimensions(path);
  assert.equal(actual.width, width, path + ': width');
  assert.equal(actual.height, height, path + ': height');
  return actual;
}

const artwork = [
  ['src/ui/components/TokenFallbackAvatar/assets/unknownTokenLight', 40],
  ['src/ui/assets/token/xlmSquare', 40],
  ['src/ui/assets/brand/fresnicaMark', 36],
];
for (const [base, points] of artwork) {
  for (const scale of [1, 2, 3]) {
    assertSize(base + (scale === 1 ? '' : '@' + scale + 'x') + '.png', points * scale);
  }
}

const catalogPath = 'ios/Fresnica/Images.xcassets/AppIcon.appiconset';
const catalog = JSON.parse(readFileSync(file(catalogPath + '/Contents.json'), 'utf8'));
assert.equal(catalog.images.length, 18, 'iPhone, iPad and App Store icon entries');
const entries = new Set();
for (const entry of catalog.images) {
  assert.ok(['iphone', 'ipad', 'ios-marketing'].includes(entry.idiom));
  const size = Number(entry.size.split('x')[0]);
  const scale = Number(entry.scale.replace('x', ''));
  assert.ok(size > 0 && [1, 2, 3].includes(scale));
  assert.ok(entry.filename && !entries.has(entry.filename), 'Missing or repeated app icon filename');
  entries.add(entry.filename);
  const png = assertSize(catalogPath + '/' + entry.filename, size * scale);
  if (entry.idiom === 'ios-marketing') {
    assert.equal(size * scale, 1024);
    assert.equal(png.colorType, 2, 'App Store icon must be opaque RGB, not RGBA');
  }
}
assert.equal(catalog.images.filter(e => e.idiom === 'iphone').length, 8);
assert.equal(catalog.images.filter(e => e.idiom === 'ipad').length, 9);
assert.equal(catalog.images.filter(e => e.idiom === 'ios-marketing').length, 1);

for (const [density, pixels] of Object.entries({
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
})) {
  const path = 'android/app/src/main/res/mipmap-' + density;
  assertSize(path + '/ic_launcher.png', pixels);
  assertSize(path + '/ic_launcher_round.png', pixels);
  assertSize(path + '/ic_launcher_foreground.png', (pixels * 9) / 4);
}
for (const name of ['ic_launcher', 'ic_launcher_round']) {
  const path = 'android/app/src/main/res/mipmap-anydpi-v26/' + name + '.xml';
  const xml = readFileSync(file(path), 'utf8');
  assert.match(xml, /<adaptive-icon\b/);
  assert.match(xml, /@color\/fresnica_launcher_background/);
  assert.match(xml, /@mipmap\/ic_launcher_foreground/);
}
assert.ok(existsSync(file('android/app/src/main/res/values/launcher_colors.xml')));
console.log('App artwork check passed: Token/XLM/brand 1x-3x, 18 iOS slots and 5 Android densities/adaptive icons.');
