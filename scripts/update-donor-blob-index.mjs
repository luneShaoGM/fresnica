import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'docs/provenance/donor-blob-index.tsv');
const donors = [
  {
    name: 'Stellar',
    directory: resolve(root, 'origin/Stellar'),
    revision: 'bd0f4540b2496a57314e4e29bc6fcf8ff691b60f',
  },
  {
    name: 'Xaman',
    directory: resolve(root, 'origin/Xaman-App'),
    revision: '01e2538b08efa2c960233911fad02633f31ce6cd',
  },
];

function git(cwd, args) {
  return execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

function safe(value) {
  return value.replaceAll('\t', ' ').replaceAll('\n', ' ');
}

const rows = [];
const headers = ['# format\tfresnica-donor-blob-index-v1'];
for (const donor of donors) {
  const commit = git(donor.directory, ['rev-parse', `${donor.revision}^{commit}`]).trim();
  if (commit !== donor.revision) {
    throw new Error(`${donor.name} audit revision resolved unexpectedly: ${commit}`);
  }
  headers.push(`# donor\t${donor.name}\t${commit}`);
  for (const entry of git(donor.directory, ['ls-tree', '-r', '-z', commit]).split('\0')) {
    if (!entry) continue;
    const separator = entry.indexOf('\t');
    const meta = entry.slice(0, separator).split(' ');
    const path = entry.slice(separator + 1);
    rows.push([donor.name, commit, meta[2], safe(path)].join('\t'));
  }
}

rows.sort();
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, [...headers, 'donor\tcommit\tblob\tpath', ...rows, ''].join('\n'));
console.log(`Wrote ${rows.length} fixed donor blob rows to ${output}`);
