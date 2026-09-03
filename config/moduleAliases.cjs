const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');

const moduleAliasTargets = Object.freeze({
  '@app': 'src/app',
  '@capabilities': 'src/capabilities',
  '@features': 'src/features',
  '@platform': 'src/platform',
  '@ui': 'src/ui',
  '@lib': 'src/lib',
});

function resolveModuleAlias(moduleName) {
  for (const [alias, target] of Object.entries(moduleAliasTargets)) {
    if (moduleName === alias) {
      return path.resolve(projectRoot, target);
    }

    const prefix = `${alias}/`;
    if (moduleName.startsWith(prefix)) {
      return path.resolve(projectRoot, target, moduleName.slice(prefix.length));
    }
  }

  return null;
}

function createJestModuleNameMapper() {
  const mapper = {};

  for (const [alias, target] of Object.entries(moduleAliasTargets)) {
    const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    mapper[`^${escapedAlias}$`] = `<rootDir>/${target}`;
    mapper[`^${escapedAlias}/(.*)$`] = `<rootDir>/${target}/$1`;
  }

  return mapper;
}

module.exports = {
  moduleAliasTargets,
  resolveModuleAlias,
  createJestModuleNameMapper,
};
