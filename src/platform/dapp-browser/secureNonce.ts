import 'react-native-get-random-values';

// Frame-bound channel tokens must come from native secure entropy, never
// Math.random. The package's insecure Chrome-remote-debug fallback is disabled.
export function createDappBridgeNonce(): string {
  if (__DEV__ && !('RN$Bridgeless' in globalThis) && !('nativeCallSyncHook' in globalThis)) {
    throw new Error('dapp-browser-native-entropy-required');
  }
  const bytes = new Uint8Array(32);
  if (!globalThis.crypto?.getRandomValues) throw new Error('dapp-browser-native-entropy-required');
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
}
