import { NativeModules, Platform } from 'react-native';

type NetworkGuard = Readonly<{
  available: boolean;
  sameDocumentNavigation: boolean;
  prepare: () => Promise<void>;
}>;

function nativeGuard(): NetworkGuard | undefined {
  return NativeModules.DappNetworkGuard as NetworkGuard | undefined;
}

function canPrepareGuard(guard: NetworkGuard | undefined): guard is NetworkGuard {
  return guard?.available === true && guard.sameDocumentNavigation === true;
}

export function hasAndroidNetworkGuard(): boolean {
  return canPrepareGuard(nativeGuard());
}

export async function prepareDappNetworkGuard(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const guard = nativeGuard();
  if (!canPrepareGuard(guard)) throw new Error('dapp-guard-unavailable');
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      guard.prepare(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('dapp-guard-timeout')), 10000);
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}
