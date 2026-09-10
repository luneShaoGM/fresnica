import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readlinkSync } from 'node:fs';
import { extname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const indexPath = resolve(root, 'docs/provenance/donor-blob-index.tsv');
const allowlistPath = resolve(root, 'docs/provenance/target-tree-collision-allowlist.json');
const expectedDonors = new Map([
  ['Stellar', 'bd0f4540b2496a57314e4e29bc6fcf8ff691b60f'],
  ['Xaman', '01e2538b08efa2c960233911fad02633f31ce6cd'],
]);
const implementationRoots = ['src/', 'android/app/src/', 'ios/'];
const sourceExtensions = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.kt',
  '.kts',
  '.java',
  '.swift',
  '.m',
  '.mm',
  '.gradle',
]);
const migrationMarkers = [
  ['Source port', /source port\s*:/i],
  ['source-equivalent', /source-equivalent/i],
  ['donor implementation', /\bdonor\b/i],
  ['Stellar source path', /stellar\/src\//i],
  ['Xaman source path', /xaman\/src\//i],
  ['presentation adaptation', /presentation adaptation/i],
  ['presentation authority', /presentation authority\s*:\s*(stellar|xaman)/i],
];

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' });
}

function gitBlobHash(bytes) {
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

function fileBytes(relativePath) {
  const absolutePath = resolve(root, relativePath);
  const stat = lstatSync(absolutePath);
  if (stat.isSymbolicLink()) {
    return Buffer.from(readlinkSync(absolutePath));
  }
  if (!stat.isFile()) return undefined;
  return readFileSync(absolutePath);
}

if (git(['rev-parse', '--show-object-format']).trim() !== 'sha1') {
  throw new Error('Donor collision gate currently requires a SHA-1 Git object repository.');
}

const donorBlobs = new Map();
const observedDonors = new Map();
for (const line of readFileSync(indexPath, 'utf8').split('\n')) {
  if (!line) continue;
  if (line.startsWith('# donor\t')) {
    const [, name, commit] = line.split('\t');
    observedDonors.set(name, commit);
    continue;
  }
  if (line.startsWith('#') || line === 'donor\tcommit\tblob\tpath') continue;
  const [donor, commit, blob, path] = line.split('\t');
  const refs = donorBlobs.get(blob) ?? [];
  refs.push({ donor, commit, path });
  donorBlobs.set(blob, refs);
}
for (const [name, commit] of expectedDonors) {
  if (observedDonors.get(name) !== commit) {
    throw new Error(`Donor blob index is not pinned to ${name} ${commit}.`);
  }
}

const allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8'));
if (allowlist.schemaVersion !== 1 || !Array.isArray(allowlist.exceptions)) {
  throw new Error('Invalid target-tree collision allowlist schema.');
}
const allowanceByPath = new Map();
for (const allowance of allowlist.exceptions) {
  if (allowanceByPath.has(allowance.path)) {
    throw new Error(`Duplicate collision allowlist path: ${allowance.path}`);
  }
  allowanceByPath.set(allowance.path, allowance);
}

const targetPaths = git(['ls-files', '--cached', '--others', '--exclude-standard', '-z'])
  .split('\0')
  .filter(Boolean)
  .filter(relativePath => existsSync(resolve(root, relativePath)));
const errors = [];
const usedAllowances = new Set();
let allowedCollisionCount = 0;
let scannedFileCount = 0;

for (const relativePath of targetPaths) {
  const bytes = fileBytes(relativePath);
  if (!bytes) continue;
  scannedFileCount += 1;
  const blob = gitBlobHash(bytes);
  const donorRefs = donorBlobs.get(blob);
  if (!donorRefs) continue;

  const allowance = allowanceByPath.get(relativePath);
  if (!allowance) {
    const refs = donorRefs
      .slice(0, 3)
      .map(ref => `${ref.donor}:${ref.path}`)
      .join(', ');
    errors.push(`${relativePath}: exact donor blob ${blob} (${refs})`);
    continue;
  }

  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const source = allowance.source ?? {};
  const allowanceValid =
    allowance.gitBlob === blob &&
    allowance.sha256 === sha256 &&
    source.gitBlob === blob &&
    source.repository &&
    source.version &&
    source.path &&
    source.license === 'MIT' &&
    source.licensePath &&
    source.licenseGitBlob;
  if (!allowanceValid) {
    errors.push(`${relativePath}: collision allowlist metadata does not match the current file/source proof.`);
    continue;
  }
  usedAllowances.add(relativePath);
  allowedCollisionCount += 1;
}

for (const relativePath of allowanceByPath.keys()) {
  if (!usedAllowances.has(relativePath)) {
    errors.push(`${relativePath}: stale collision allowlist entry; remove or re-prove the exception.`);
  }
}

let migrationMarkerCount = 0;
for (const relativePath of targetPaths) {
  if (!implementationRoots.some(prefix => relativePath.startsWith(prefix))) continue;
  if (!sourceExtensions.has(extname(relativePath))) continue;
  const bytes = fileBytes(relativePath);
  if (!bytes || bytes.includes(0)) continue;
  const text = bytes.toString('utf8');
  for (const [label, pattern] of migrationMarkers) {
    const match = pattern.exec(text);
    if (!match) continue;
    migrationMarkerCount += 1;
    const line = text.slice(0, match.index).split('\n').length;
    errors.push(`${relativePath}:${line}: direct-migration marker '${label}'`);
  }
}

if (errors.length > 0) {
  console.error('Donor collision gate FAILED:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Donor collision gate passed: ${scannedFileCount} files scanned, 0 unapproved exact donor blobs, ${allowedCollisionCount} fixed template exception(s), ${migrationMarkerCount} direct-migration markers.`,
);
