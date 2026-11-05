import type { DappPublicSelection } from './freighterSession';
import { readPublicDappNavigation } from './externalDappUrl';

// A one-use, non-serialized launch proof. Never put trust flags, permission
// tokens or sensitive signer information in route parameters.
export function createCuratedSessionLaunch() {
  let pending:
    | Readonly<{
        url: string;
        origin: string;
        selection: DappPublicSelection;
      }>
    | undefined;

  const clear = () => {
    pending = undefined;
  };

  const prepare = (url: string, selection: DappPublicSelection | undefined, verified: boolean): void => {
    clear();
    if (!verified || !selection) return;
    const target = readPublicDappNavigation(url);
    if (!target || target.url !== url) return;
    pending = { url, origin: target.origin, selection: Object.freeze({ ...selection }) };
  };

  const consume = (url: string, current: DappPublicSelection | undefined): string | undefined => {
    const ticket = pending;
    clear();
    if (!ticket || !current || ticket.url !== url) return undefined;
    const before = ticket.selection;
    if (
      current.accountId !== before.accountId ||
      current.address !== before.address ||
      current.networkId !== before.networkId ||
      current.networkPassphrase !== before.networkPassphrase ||
      current.networkUrl !== before.networkUrl ||
      current.revision !== before.revision
    )
      return undefined;
    return ticket.origin;
  };

  return { prepare, consume, clear };
}
