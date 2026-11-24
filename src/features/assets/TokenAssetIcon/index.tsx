import React, { useEffect, useState } from 'react';
import { Image } from 'react-native';

import type { TokenAssetIdentity } from '../../../capabilities/assets/TokenMetadataCache';
import { TokenFallbackAvatar } from '../../../ui/components/TokenFallbackAvatar';
import { useTokenIconContext } from '../tokenIconContext';
import { styles } from './styles';

export function TokenAssetIcon({
  asset,
  small = false,
  active = true,
  resizeMode = 'contain',
  size,
}: Readonly<{
  asset: { kind: 'native'; code: string } | TokenAssetIdentity;
  small?: boolean;
  active?: boolean;
  resizeMode?: 'contain' | 'cover';
  size?: number;
}>) {
  const { service, snapshot } = useTokenIconContext();
  const dimensions = size === undefined ? undefined : { width: size, height: size };
  const code = asset.code;
  const credit = asset.kind === 'credit';
  const issuer = credit ? asset.issuer : '';
  const [retryRevision, setRetryRevision] = useState(0);
  // The shared cache is authoritative, including decode failures and recovery.
  const uri = active && credit && snapshot.enabled ? service?.readIcon({ kind: 'credit', code, issuer }) : undefined;

  // Publishing a cached/stale icon must not cancel its own refresh. Only
  // lifecycle recovery, identity changes and decode rejection request a retry.
  useEffect(() => {
    if (!active || !credit || !service?.available || !snapshot.enabled) return;
    const controller = new AbortController();
    service.loadIcon({ kind: 'credit', code, issuer }, controller.signal).catch(() => undefined);
    return () => controller.abort();
  }, [active, code, credit, issuer, service, snapshot.enabled, snapshot.retryRevision, retryRevision]);

  if (!credit) {
    return (
      <Image
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        resizeMode={resizeMode}
        source={require('../../../ui/assets/token/xlmSquare.png')}
        style={[styles.icon, small ? styles.small : undefined, dimensions]}
      />
    );
  }
  if (!active || !snapshot.enabled || !uri) return <TokenFallbackAvatar small={small} size={size} />;
  return (
    <Image
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      source={{ uri }}
      resizeMode={resizeMode}
      style={[styles.icon, small ? styles.small : undefined, dimensions]}
      onError={() => {
        if (credit) service?.rejectIcon({ kind: 'credit', code, issuer }, uri);
        setRetryRevision(revision => revision + 1);
      }}
    />
  );
}
