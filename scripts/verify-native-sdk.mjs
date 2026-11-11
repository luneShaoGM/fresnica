import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pins = JSON.parse(fs.readFileSync(path.join(root, 'config/native-sdk-integrity.json'), 'utf8'));

export function verifyNativeFiles(directory, expected) {
  const actual = new Map();
  function walk(relative) {
    const absolute = path.join(directory, relative);
    const info = fs.lstatSync(absolute);
    if (info.isSymbolicLink()) actual.set(relative, { symlink: fs.readlinkSync(absolute) });
    else if (info.isDirectory()) {
      for (const child of fs.readdirSync(absolute).sort()) walk(path.posix.join(relative, child));
    } else if (info.isFile()) {
      actual.set(relative, { sha256: crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex') });
    } else throw new Error(`Unsupported SDK entry: ${relative}`);
  }
  // Visit only the pinned SDK roots, never adapter or unrelated download files.
  for (const name of new Set(Object.keys(expected).map(entry => entry.split('/')[0]))) walk(name);
  if (actual.size !== Object.keys(expected).length) throw new Error('Unexpected SDK file inventory');
  for (const [name, value] of Object.entries(expected)) {
    if (JSON.stringify(actual.get(name)) !== JSON.stringify(value)) throw new Error(`SDK integrity mismatch: ${name}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const platform = process.argv[2];
    if (!['android', 'apple'].includes(platform)) throw new Error('Expected android or apple');
    verifyNativeFiles(path.join(root, 'vendor/fresnica/native'), pins[platform]);
    console.log(`Fresnica Native SDK ${pins.version} ${platform}: pinned integrity verified`);
  } catch (error) {
    console.error(`${error.message}. Restore the exact pinned SDK; see vendor/fresnica/README.md.`);
    process.exitCode = 1;
  }
}
