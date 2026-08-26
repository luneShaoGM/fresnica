import type { NativeFresnicaCoreModule } from './NativeFresnicaCoreModule';

const REQUIRED_METHODS = [
  'parseAccount',
  'protectSecret',
  'protectMnemonic',
  'generateMnemonic',
  'deriveMnemonicSigner',
  'reprotect',
  'reveal',
  'prepareEd25519Signing',
  'applyEd25519Signature',
  'canUseSystemAuth',
  'hasSystemAuthDomain',
  'initializeSystemAuth',
  'registerSignerSystemAuth',
  'hasSignerSystemAuth',
  'removeSignerSystemAuth',
  'removeSystemAuthDomain',
  'signWithSystemAuth',
  'signWithPasscode',
] as const satisfies ReadonlyArray<keyof NativeFresnicaCoreModule>;

type NativeModulesLike = Record<string, unknown>;

export function loadNativeFresnicaCoreModule(
  nativeModules: NativeModulesLike,
): NativeFresnicaCoreModule {
  const candidate = nativeModules.FresnicaCore;

  if (candidate === null || typeof candidate !== 'object') {
    throw new Error('FresnicaCore native module is not linked');
  }

  const moduleRecord = candidate as Record<string, unknown>;

  for (const method of REQUIRED_METHODS) {
    if (typeof moduleRecord[method] !== 'function') {
      throw new Error(
        `FresnicaCore native module is incompatible: missing ${method}`,
      );
    }
  }

  return candidate as NativeFresnicaCoreModule;
}
