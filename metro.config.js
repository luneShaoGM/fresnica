const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const {resolveModuleAlias} = require('./config/moduleAliases.cjs');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    resolveRequest: (context, moduleName, platform) =>
      context.resolveRequest(
        context,
        resolveModuleAlias(moduleName) ?? moduleName,
        platform,
      ),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
