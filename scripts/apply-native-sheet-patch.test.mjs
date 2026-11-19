import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { applyNativeSheetPatch, sheetPatch } from './apply-native-sheet-patch.mjs';

test('native sheet patch survives reinstall, is idempotent, and refuses dependency drift before writing', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'fresnica-sheet-patch-'));
  const dependency = resolve(root, 'node_modules/react-native-screens');
  try {
    mkdirSync(dependency, { recursive: true });
    writeFileSync(resolve(dependency, 'package.json'), JSON.stringify({ version: '4.27.0' }));
    const originals = new Map();
    for (const patch of sheetPatch) {
      const installed = readFileSync(
        resolve(import.meta.dirname, '../node_modules/react-native-screens', patch.file),
        'utf8',
      );
      let original = installed;
      for (const [before, after] of patch.edits) original = original.replace(after, before);
      const path = resolve(dependency, patch.file);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, original);
      originals.set(path, original);
    }
    assert.throws(() => applyNativeSheetPatch(root, true), /missing/);
    for (const [path, original] of originals) assert.equal(readFileSync(path, 'utf8'), original);
    applyNativeSheetPatch(root);
    const applied = [...originals.keys()].map(path => readFileSync(path, 'utf8'));
    applyNativeSheetPatch(root);
    applyNativeSheetPatch(root, true);
    assert.deepEqual(
      [...originals.keys()].map(path => readFileSync(path, 'utf8')),
      applied,
    );
    for (const [path, original] of originals) writeFileSync(path, original);
    const last = [...originals.keys()].at(-1);
    writeFileSync(last, `${originals.get(last)}\n// dependency drift\n`);
    assert.throws(() => applyNativeSheetPatch(root), /source mismatch/);
    const first = [...originals.keys()][0];
    assert.equal(readFileSync(first, 'utf8'), originals.get(first));
    writeFileSync(resolve(dependency, 'package.json'), JSON.stringify({ version: '4.28.0' }));
    assert.throws(() => applyNativeSheetPatch(root), /Revalidate/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
