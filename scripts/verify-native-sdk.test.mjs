import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { verifyNativeFiles } from './verify-native-sdk.mjs';

test('rejects modified, missing, additional and substituted SDK files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fresnica-integrity-'));
  try {
    fs.mkdirSync(path.join(root, 'SDK'));
    const binary = path.join(root, 'SDK/binary');
    fs.writeFileSync(binary, 'dummy-sdk');
    const pins = { 'SDK/binary': { sha256: crypto.createHash('sha256').update('dummy-sdk').digest('hex') } };
    verifyNativeFiles(root, pins);
    fs.writeFileSync(binary, 'changed-sdk');
    assert.throws(() => verifyNativeFiles(root, pins), /mismatch/);
    fs.unlinkSync(binary);
    assert.throws(() => verifyNativeFiles(root, pins));
    fs.writeFileSync(binary, 'dummy-sdk');
    fs.writeFileSync(path.join(root, 'SDK/extra'), 'extra');
    assert.throws(() => verifyNativeFiles(root, pins), /inventory/);
    fs.unlinkSync(path.join(root, 'SDK/extra'));
    fs.unlinkSync(binary);
    fs.symlinkSync('/outside/binary', binary);
    assert.throws(() => verifyNativeFiles(root, pins), /mismatch/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
