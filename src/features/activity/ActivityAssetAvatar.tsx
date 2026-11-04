import React, { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import type { ActivityAssetImages } from '@capabilities/assets/ActivityAssetImages';
import type { HistoryAsset } from '@capabilities/history/types';
import { IdentityAvatar } from '@ui/components/IdentityAvatar';
import { activityAssetIdentity } from './activityRowPresentation';
import { useThemedStyles } from '@ui/theme';
import { createStyles } from './styles';

export function ActivityAssetAvatar({
  asset,
  networkId,
  images,
  enabled,
  active,
  small = false,
}: Readonly<{
  asset: HistoryAsset;
  networkId: string;
  images?: ActivityAssetImages;
  enabled: boolean;
  active: boolean;
  small?: boolean;
}>) {
  const styles = useThemedStyles(createStyles);
  const identity = activityAssetIdentity(asset);
  const [loaded, setLoaded] = useState<Readonly<{ identity: string; uri: string }> | undefined>();
  useEffect(() => {
    if (!enabled || !active || !images || asset.kind === 'native') {
      setLoaded(undefined);
      return;
    }
    const controller = new AbortController();
    setLoaded(undefined);
    images
      .resolve(networkId, asset, controller.signal)
      .then(uri => {
        if (!controller.signal.aborted && uri) setLoaded({ identity, uri });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [active, asset, enabled, identity, images, networkId]);

  return loaded?.identity === identity && enabled && active ? (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.assetImageWrap, small ? styles.assetImageSmall : undefined]}
    >
      <Image
        source={{ uri: loaded.uri }}
        style={styles.assetImage}
        onError={() => setLoaded(current => (current?.identity === identity ? undefined : current))}
      />
    </View>
  ) : (
    <IdentityAvatar identity={identity} native={asset.kind === 'native'} small={small} />
  );
}
