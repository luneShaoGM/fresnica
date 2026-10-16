const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { resolveModuleAlias } = require('./config/moduleAliases.cjs');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    resolveRequest: (context, moduleName, platform) => {
      const resolvedName =
        moduleName === '@react-native/assets-registry/registry'
          ? 'react-native/asset-registry'
          : (resolveModuleAlias(moduleName) ?? moduleName);
      return context.resolveRequest(context, resolvedName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
