import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = process.cwd();
const { moduleAliasTargets, createJestModuleNameMapper } = require(path.join(root, 'config/moduleAliases.cjs'));
const violations = [];

function addViolation(scope, detail) {
  violations.push({ scope, detail });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const expectedAliases = ['@app', '@capabilities', '@features', '@platform', '@ui', '@lib'];
const configuredAliases = Object.keys(moduleAliasTargets);

if (JSON.stringify(configuredAliases) !== JSON.stringify(expectedAliases)) {
  addViolation(
    'config/moduleAliases.cjs',
    `expected aliases ${expectedAliases.join(', ')}, got ${configuredAliases.join(', ')}`,
  );
}

for (const [alias, target] of Object.entries(moduleAliasTargets)) {
  const normalizedTarget = target.split(path.sep).join('/');
  if (!normalizedTarget.startsWith('src/') || normalizedTarget.includes('..')) {
    addViolation('config/moduleAliases.cjs', `${alias} must resolve inside src/, got ${target}`);
  }
}

const tsconfig = readJson(path.join(root, 'tsconfig.json'));
const paths = tsconfig.compilerOptions?.paths ?? {};
for (const [alias, target] of Object.entries(moduleAliasTargets)) {
  const direct = paths[alias];
  const wildcard = paths[`${alias}/*`];
  const expectedDirect = [`./${target}`];
  const expectedWildcard = [`./${target}/*`];

  if (JSON.stringify(direct) !== JSON.stringify(expectedDirect)) {
    addViolation('tsconfig.json', `${alias} must map to ${expectedDirect[0]}`);
  }
  if (JSON.stringify(wildcard) !== JSON.stringify(expectedWildcard)) {
    addViolation('tsconfig.json', `${alias}/* must map to ${expectedWildcard[0]}`);
  }
}

const jestConfig = require(path.join(root, 'jest.config.js'));
const expectedJestMapper = createJestModuleNameMapper();
if (JSON.stringify(jestConfig.moduleNameMapper) !== JSON.stringify(expectedJestMapper)) {
  addViolation('jest.config.js', 'moduleNameMapper must be generated from config/moduleAliases.cjs');
}

const metroConfig = require(path.join(root, 'metro.config.js'));
const metroResolveRequest = metroConfig.resolver?.resolveRequest;
if (typeof metroResolveRequest !== 'function') {
  addViolation('metro.config.js', 'resolver.resolveRequest is missing');
} else {
  const probeContext = {
    resolveRequest: (_context, moduleName) => ({ type: 'sourceFile', filePath: moduleName }),
  };
  const aliased = metroResolveRequest(probeContext, '@app/navigation/ProductRuntime', 'android');
  const expectedAliasedPath = path.join(root, 'src/app/navigation/ProductRuntime');
  if (aliased.filePath !== expectedAliasedPath) {
    addViolation('metro.config.js', `@app probe resolved to ${aliased.filePath}, expected ${expectedAliasedPath}`);
  }

  const external = metroResolveRequest(probeContext, 'react', 'android');
  if (external.filePath !== 'react') {
    addViolation('metro.config.js', `external package probe was rewritten to ${external.filePath}`);
  }
}

if (violations.length > 0) {
  console.error('Module alias check found violations:');
  for (const violation of violations) {
    console.error(`- ${violation.scope}: ${violation.detail}`);
  }
  process.exit(1);
}

console.log('Module alias check passed.');
