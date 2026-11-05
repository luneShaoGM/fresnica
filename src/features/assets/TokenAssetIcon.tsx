import React, { useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Image, StyleSheet } from 'react-native';

import type { TokenAssetIdentity } from '../../capabilities/assets/TokenMetadataCache';
import { IdentityAvatar } from '../../ui/components/IdentityAvatar';
import { NativeButton } from '../../ui/components/NativeButton';
import { useLocalization } from '../../locale';
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

export function PublicIconToggle({ networkId }: Readonly<{ networkId: string }>) {
  const { t } = useLocalization();
  const { service, snapshot } = useIconContext();
  if (networkId !== 'stellar-mainnet' || !service?.available) return null;
  return (
    <NativeButton
      label={t(snapshot.enabled ? 'assets.publicIcons.disable' : 'assets.publicIcons.enable')}
      size="sm"
      variant="secondary"
      onPress={() => service.setEnabled(!snapshot.enabled)}
    />
  );
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
  }, [active, code, credit, issuer, key, service, snapshot.enabled]);

  if (!active || !snapshot.enabled || !credit || !uri || isRejected(uri)) {
    return <IdentityAvatar identity={key} native={asset.kind === 'native'} small={small} />;
  }
  return (
    <Image
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      source={{ uri }}
      style={[styles.icon, small ? styles.small : undefined]}
      onError={() => {
        rejected.current = { key, uri };
        setState({ key });
      }}
    />
  );
}

const styles = StyleSheet.create({
  icon: { width: 40, height: 40, borderRadius: 20 },
  small: { width: 16, height: 16, borderRadius: 8 },
});
