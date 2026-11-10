import React, { useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Image, StyleSheet } from 'react-native';

import type { TokenAssetIdentity } from '../../capabilities/assets/TokenMetadataCache';
import { TokenFallbackAvatar } from '../../ui/components/TokenFallbackAvatar';
import { TokenIconContext } from './tokenIconContext';

const EMPTY = Object.freeze({ enabled: false, revision: 0 });
const noopSubscribe = () => () => {};

function useIconContext() {
  const service = useContext(TokenIconContext);
  const snapshot = useSyncExternalStore(
    service?.subscribe ?? noopSubscribe,
    service?.getSnapshot ?? (() => EMPTY),
    service?.getSnapshot ?? (() => EMPTY),
  );
  return { service, snapshot };
}

export function TokenAssetIcon({
  asset,
  small = false,
  active = true,
}: Readonly<{ asset: { kind: 'native'; code: string } | TokenAssetIdentity; small?: boolean; active?: boolean }>) {
  const { service, snapshot } = useIconContext();
  const code = asset.code;
  const credit = asset.kind === 'credit';
  const issuer = credit ? asset.issuer : '';
  const key = credit ? JSON.stringify([code, issuer]) : 'native:XLM';
  const [state, setState] = useState<Readonly<{ key: string; uri?: string }>>({ key });
  const rejected = useRef<Readonly<{ key: string; uri: string }> | undefined>(undefined);
  const [retryRevision, setRetryRevision] = useState(0);
  const uri = state.key === key ? state.uri : undefined;
  const isRejected = (candidate: string) => rejected.current?.key === key && rejected.current.uri === candidate;

  useEffect(() => {
    if (!active || !credit || !service?.available || !snapshot.enabled) {
      setState({ key });
      return undefined;
    }
    const controller = new AbortController();
    const identity: TokenAssetIdentity = { kind: 'credit', code, issuer };
    const cached = service.readIcon(identity);
    if (cached && !(rejected.current?.key === key && rejected.current.uri === cached)) {
      setState({ key, uri: cached });
    } else if (!cached) {
      setState({ key });
    }

    service
      .loadIcon(identity, controller.signal)
      .then(result => {
        if (
          !controller.signal.aborted &&
          result &&
          !(rejected.current?.key === key && rejected.current.uri === result)
        ) {
          setState({ key, uri: result });
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [active, code, credit, issuer, key, service, snapshot.enabled, retryRevision]);

  // Another mounted consumer may complete the same asset's request after
  // this instance was cancelled or superseded. Observe successful shared
  // cache updates without restarting in-flight downloads on every revision.
  useEffect(() => {
    if (!active || !credit || !service?.available || !snapshot.enabled) return;
    const cached = service.readIcon({ kind: 'credit', code, issuer });
    if (!cached || (rejected.current?.key === key && rejected.current.uri === cached)) return;
    setState(previous => (previous.key === key && previous.uri === cached ? previous : { key, uri: cached }));
  }, [active, code, credit, issuer, key, service, snapshot.enabled, snapshot.revision]);

  if (!credit) {
    return (
      <Image
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        resizeMode="contain"
        source={require('../../ui/assets/token/xlmSquare.png')}
        style={[styles.icon, small ? styles.small : undefined]}
      />
    );
  }
  if (!active || !snapshot.enabled || !uri || isRejected(uri)) return <TokenFallbackAvatar small={small} />;
  return (
    <Image
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      source={{ uri }}
      resizeMode="contain"
      style={[styles.icon, small ? styles.small : undefined]}
      onError={() => {
        rejected.current = { key, uri };
        if (credit) service?.rejectIcon({ kind: 'credit', code, issuer }, uri);
        setState({ key });
        setRetryRevision(revision => revision + 1);
      }}
    />
  );
}

const styles = StyleSheet.create({
  icon: { width: 40, height: 40 },
  small: { width: 16, height: 16 },
});
