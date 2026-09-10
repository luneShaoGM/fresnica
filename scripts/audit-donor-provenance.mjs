import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const stellar = resolve(root, 'origin/Stellar');
const xaman = resolve(root, 'origin/Xaman-App');
const out = resolve(root, 'docs/provenance/donor-source-ledger.tsv');
const stellarAuditRevision = 'bd0f4540b2496a57314e4e29bc6fcf8ff691b60f';
const xamanAuditRevision = '01e2538b08efa2c960233911fad02633f31ce6cd';

function git(cwd, args) {
  return execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

function tree(cwd, revision) {
  const rows = new Map();
  for (const line of git(cwd, ['ls-tree', '-r', revision]).split('\n')) {
    if (!line) continue;
    const [meta, file] = line.split('\t');
    const blob = meta.split(' ')[2];
    rows.set(file, blob);
  }
  return rows;
}
function area(file) {
  if (file.startsWith('src/screens/xApps/')) return 'xApps';
  if (file.startsWith('src/screens/Modal/XAppBrowser/') || file.startsWith('src/components/Modules/XAppBrowserHeader/'))
    return 'XAppBrowser';
  if (file.startsWith('src/freighter/')) return 'freighter';
  if (file.startsWith('src/screens/Overlay/Vault/')) return 'Vault';
  if (/(^|\/)(navigation|navigator)/i.test(file) || /NavigationService|navigator\.ts/.test(file)) return 'navigation';
  if (file.startsWith('src/services/')) return 'services';
  if (file.startsWith('src/theme/')) return 'theme';
  if (
    /^android\/app\/src\/main\/res\/drawable-[^/]+\/.+\.(png|webp|jpg|jpeg|svg)$/i.test(file) ||
    /^android\/app\/src\/main\/assets\/fonts\/.+\.(ttf|otf)$/i.test(file) ||
    /^ios\/.*\.(png|jpg|jpeg)$/i.test(file) ||
    /^ios\/.*\.imageset\/Contents\.json$/i.test(file)
  )
    return 'local-assets';
  return undefined;
}

function safe(value) {
  return String(value ?? '')
    .replaceAll('\t', ' ')
    .replaceAll('\n', ' ');
}
const stellarTree = tree(stellar, stellarAuditRevision);
const xamanTree = tree(xaman, xamanAuditRevision);
const stellarCommit = git(stellar, ['rev-parse', `${stellarAuditRevision}^{commit}`]);
const xamanCommit = git(xaman, ['rev-parse', `${xamanAuditRevision}^{commit}`]);
const rows = [];

for (const [file, stellarBlob] of stellarTree) {
  const group = area(file);
  if (!group) continue;
  const xamanBlob = xamanTree.get(file);
  const classification = xamanBlob === stellarBlob ? 'Xaman inherited' : 'Stellar modified derivative';
  const evidence = xamanBlob
    ? xamanBlob === stellarBlob
      ? 'same path and same blob at audited commits'
      : 'same path exists in audited Xaman commit with different blob'
    : 'no same path in audited Xaman commit; independent ownership not proven';
  rows.push({
    group,
    file,
    classification,
    stellarBlob,
    xamanBlob: xamanBlob ?? '',
    evidence,
    handling: 'clean-room behavior rewrite; direct migration requires approval record',
  });
}
rows.sort((left, right) => left.group.localeCompare(right.group) || left.file.localeCompare(right.file));

const header = [
  '# audited Stellar commit',
  stellarCommit,
  '# audited Xaman commit',
  xamanCommit,
  'area\tpath\tclassification\tstellar_blob\txaman_blob\tevidence\thandling',
];
const body = rows.map(row =>
  [row.group, row.file, row.classification, row.stellarBlob, row.xamanBlob, row.evidence, row.handling]
    .map(safe)
    .join('\t'),
);

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, [...header, ...body, ''].join('\n'));

const counts = new Map();
for (const row of rows) {
  const current = counts.get(row.group) ?? { total: 0, inherited: 0, modified: 0 };
  current.total += 1;
  if (row.classification === 'Xaman inherited') current.inherited += 1;
  else current.modified += 1;
  counts.set(row.group, current);
}
console.log(
  JSON.stringify({ stellarCommit, xamanCommit, files: rows.length, counts: Object.fromEntries(counts) }, null, 2),
);
