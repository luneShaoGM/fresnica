import { createContext, useContext, useSyncExternalStore } from 'react';

import type { TokenIconPort } from '../../capabilities/assets/TokenIcons';

// Navigation provides the session port without importing presentation widgets.
export const TokenIconContext = createContext<TokenIconPort | undefined>(undefined);

const EMPTY = Object.freeze({ enabled: false, revision: 0 });
const noopSubscribe = () => () => {};

export function useTokenIconContext() {
  const service = useContext(TokenIconContext);
  const snapshot = useSyncExternalStore(
    service?.subscribe ?? noopSubscribe,
    service?.getSnapshot ?? (() => EMPTY),
    service?.getSnapshot ?? (() => EMPTY),
  );
  return { service, snapshot };
}
