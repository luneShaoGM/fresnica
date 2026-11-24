import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';

export type SensitiveFlowRequest = Readonly<{ epoch: number; owner: object; identity?: string }>;

// Retiring presentation cannot cancel a provisioning call which may already
// persist an account. Keep its duplicate gate until settlement, even on blur.
export function useSensitiveFlowLifetime(
  onRetire: (updateUi: boolean) => void,
  onResume: () => void,
  owner: object,
  identity?: string,
) {
  const focused = useIsFocused();
  const focus = useRef(focused);
  const mounted = useRef(true);
  const foreground = useRef(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const epoch = useRef(0);
  const scope = useRef({ owner, identity });
  scope.current = { owner, identity };
  const committedScope = useRef(scope.current);
  const request = useRef<SensitiveFlowRequest | undefined>(undefined);
  const callbacks = useRef({ onRetire, onResume });
  callbacks.current = { onRetire, onResume };
  const [busy, setBusy] = useState(false);
  const [renderEpoch, setRenderEpoch] = useState(0);
  const active = useCallback(() => mounted.current && focus.current && foreground.current, []);
  const retire = useCallback(() => {
    epoch.current += 1;
    // Even an empty form needs a new public render after layout/focus
    // retirement, so only its newly rendered callbacks can start work.
    if (mounted.current) setRenderEpoch(epoch.current);
    callbacks.current.onRetire(mounted.current);
  }, []);
  const owns = useCallback((candidate: SensitiveFlowRequest) => active() && candidate.epoch === epoch.current
    && candidate.owner === scope.current.owner && candidate.identity === scope.current.identity, [active]);
  const resume = useCallback(() => {
    if (active()) callbacks.current.onResume();
  }, [active]);

  useLayoutEffect(() => {
    if (committedScope.current.owner === owner && committedScope.current.identity === identity) return;
    committedScope.current = { owner, identity };
    // Drop old native output before painting a replacement signer/dependency.
    retire();
    resume();
  }, [owner, identity, retire, resume]);

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', next => {
      foreground.current = next === 'active';
      if (!foreground.current) retire();
      else resume();
    });
    return () => {
      mounted.current = false;
      retire();
      subscription.remove();
    };
  }, [retire, resume]);

  useFocusEffect(useCallback(() => {
    focus.current = true;
    resume();
    return () => {
      focus.current = false;
      retire();
    };
  }, [resume, retire]));

  return {
    busy,
    active,
    owns,
    retire,
    resume,
    begin(): SensitiveFlowRequest | undefined {
      // Capture the caller's render, not the latest scope at click time. An
      // old button must not become usable after blur/return or a mode change.
      const next = { epoch: renderEpoch, owner, identity };
      if (!owns(next) || request.current) return undefined;
      request.current = next;
      setBusy(true);
      return next;
    },
    isCurrent(candidate: SensitiveFlowRequest): boolean {
      return request.current === candidate && owns(candidate);
    },
    finish(candidate: SensitiveFlowRequest) {
      if (request.current !== candidate) return;
      request.current = undefined;
      if (mounted.current) setBusy(false);
    },
  };
}
