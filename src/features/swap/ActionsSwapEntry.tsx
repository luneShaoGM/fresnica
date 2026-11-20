import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { AccountRecord } from '@capabilities/account/types';
import type { StellarPaymentAsset } from '@capabilities/stellar/types';
import { assetKey } from '@capabilities/stellar/classicAmounts';
import { Screen } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';
import { useThemedStyles } from '@ui/theme';
import { useLocalization } from '../../locale';
import {
  loadActionsSwapSources,
  type ActionsSwapSource,
  type SwapPreviewProductDependencies,
} from './swapPreviewProductFlow';
import { createSwapPreviewStyles } from './styles';

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; sources: readonly ActionsSwapSource[]; isCurrent: () => boolean }
  | { kind: 'failed'; reason: 'empty' | 'assets' | 'session' | 'unavailable' }
  | { kind: 'chosen'; asset: StellarPaymentAsset };
export function ActionsSwapEntry({
  account,
  dependencies,
  captureSession,
  foreground,
  onBack,
  children,
}: Readonly<{
  account: AccountRecord;
  dependencies: SwapPreviewProductDependencies;
  captureSession: () => () => boolean;
  foreground: boolean;
  onBack: () => void;
  children: (asset: StellarPaymentAsset) => React.ReactNode;
}>) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createSwapPreviewStyles);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [retry, setRetry] = useState(0);
  const phase = useRef(state);
  phase.current = state;
  const foregroundRef = useRef(foreground);
  foregroundRef.current = foreground;
  const retired = useRef(false);
  const publish = useCallback((value: State) => {
    phase.current = value;
    setState(value);
  }, []);
  useEffect(() => {
    // Once entry is complete, the existing Swap screen owns its full lifecycle.
    if (phase.current.kind === 'chosen' || retired.current) return;
    let current = true;
    const session = captureSession();
    const valid = () => current && !retired.current && foregroundRef.current && session();
    publish({ kind: 'loading' });
    if (!valid()) {
      publish({ kind: 'failed', reason: 'session' });
      return;
    }
    Promise.resolve()
      .then(() => (valid() ? loadActionsSwapSources(dependencies, account, valid) : undefined))
      .then(sources => {
        if (!sources || !valid()) return;
        publish(
          sources.length === 0
            ? { kind: 'failed', reason: 'empty' }
            : sources.length === 1
              ? { kind: 'chosen', asset: sources[0].asset }
              : { kind: 'ready', sources, isCurrent: valid },
        );
      })
      .catch(error => {
        if (!valid()) return;
        const reason = error instanceof Error && error.message === 'swap-assets-unavailable' ? 'assets' : 'unavailable';
        publish({ kind: 'failed', reason });
      });
    return () => {
      current = false;
    };
  }, [account, dependencies, captureSession, foreground, retry, publish]);
  if (state.kind === 'chosen') return <>{children(state.asset)}</>;
  const close = () => {
    if (retired.current) return;
    retired.current = true;
    onBack();
  };
  return (
    <Screen>
      <View style={styles.content}>
        <NativeButton label={t('common.back')} onPress={close} variant="quiet" />
        <Text accessibilityRole="header" style={styles.heading}>
          {t('actions.swap.choose')}
        </Text>
        {state.kind === 'loading' ? <ActivityIndicator accessibilityLabel={t('swap.preview.loading')} /> : null}
        {state.kind === 'failed' ? (
          <>
            <Text accessibilityLiveRegion="polite" style={styles.error}>
              {t(
                state.reason === 'empty'
                  ? 'actions.swap.noSources'
                  : state.reason === 'assets'
                    ? 'swap.error.assets'
                    : state.reason === 'session'
                      ? 'swap.error.session'
                      : 'nav.accountUnavailable',
              )}
            </Text>
            <NativeButton
              label={t('swap.preview.retryAssets')}
              disabled={!foreground}
              onPress={() => {
                if (!retired.current) setRetry(value => value + 1);
              }}
            />
          </>
        ) : null}
        {state.kind === 'ready'
          ? state.sources.map(source => (
              <NativeButton
                key={assetKey(source.asset)}
                label={assetKey(source.asset) + ' · ' + source.spendable}
                disabled={!foreground}
                onPress={() => {
                  if (phase.current !== state || !state.isCurrent() || !state.sources.includes(source)) return;
                  publish({ kind: 'chosen', asset: source.asset });
                }}
                variant="secondary"
              />
            ))
          : null}
      </View>
    </Screen>
  );
}
