import { readPublicDappNavigation } from './externalDappUrl';
import type { DappPublicSelection } from './freighterSession';

// A one-use, public-only launch proof kept in App composition memory.
// No trust flags, account data or secrets are written into navigation params.
const LAUNCH_TTL_MS = 30_000;

export function createCuratedSessionLaunch(now: () => number = Date.now) {
  let revision = 0;
  let pending:
    | Readonly<{
        url: string;
        origin: string;
        selection: DappPublicSelection;
        createdAt: number;
      }>
    | undefined;

  const clear = () => {
    pending = undefined;
    revision += 1;
  };

  const prepare = (url: string, selection: DappPublicSelection | undefined, liveVerified: boolean): void => {
    clear();
    if (!liveVerified || !selection) return;
    const target = readPublicDappNavigation(url);
    const createdAt = now();
    if (!target || target.url !== url || !Number.isSafeInteger(createdAt) || createdAt < 0) return;
    pending = { url, origin: target.origin, selection: Object.freeze({ ...selection }), createdAt };
  };

  const consume = (url: string, selection: DappPublicSelection | undefined): string | undefined => {
    const proof = pending;
    clear();
    if (!proof || !selection || proof.url !== url) return undefined;
    const age = now() - proof.createdAt;
    if (!Number.isFinite(age) || age < 0 || age > LAUNCH_TTL_MS) return undefined;
    const initial = proof.selection;
    if (
      selection.accountId !== initial.accountId ||
      selection.address !== initial.address ||
      selection.networkId !== initial.networkId ||
      selection.networkPassphrase !== initial.networkPassphrase ||
      selection.networkUrl !== initial.networkUrl ||
      selection.revision !== initial.revision
    )
      return undefined;
    return proof.origin;
  };

  return Object.freeze({ prepare, consume, clear, revision: () => revision });
}
