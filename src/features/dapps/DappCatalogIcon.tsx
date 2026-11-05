import React, { useState, useSyncExternalStore } from 'react';
import { Image, Text, View } from 'react-native';

import type { DappCatalogEntry } from '@capabilities/dapp-catalog/catalog';
import type { DappPublicMediaPort, PublicDappIconState } from '@capabilities/dapp-catalog/dappPublicMedia';
import { NativeButton } from '@ui/components/NativeButton';

import { useLocalization } from '../../locale';
import type { createStyles } from './screens/DAppsScreen/styles';

type Styles = ReturnType<typeof createStyles>;
const DISABLED: PublicDappIconState = Object.freeze({ enabled: false, revision: 0 });
const idleSubscribe = () => () => {};
const idleSnapshot = () => DISABLED;

export function useDappIconState(media: DappPublicMediaPort | undefined): PublicDappIconState {
  return useSyncExternalStore(media?.subscribeIcons ?? idleSubscribe, media?.getIconState ?? idleSnapshot);
}

export function DappPublicIconToggle({ media }: Readonly<{ media?: DappPublicMediaPort }>) {
  const { t } = useLocalization();
  const state = useDappIconState(media);
  if (!media?.available) return null;
  return (
    <NativeButton
      label={t(state.enabled ? 'dapps.icons.disable' : 'dapps.icons.enable')}
      variant="secondary"
      onPress={() => media.setIconsEnabled(!state.enabled)}
    />
  );
}

export function DappCatalogIcon({
  entry,
  media,
  styles,
}: Readonly<{ entry: DappCatalogEntry; media?: DappPublicMediaPort; styles: Styles }>) {
  const state = useDappIconState(media);
  const [failed, setFailed] = useState<{ appId: string; uri: string }>();
  const candidate = state.enabled ? media?.readIcon(entry) : undefined;
  const uri = failed?.appId === entry.id && failed.uri === candidate ? undefined : candidate;
  if (uri?.startsWith('data:image/png;base64,') || uri?.startsWith('data:image/jpeg;base64,')) {
    return (
      <Image
        source={{ uri }}
        style={styles.appIcon}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        onError={() => setFailed({ appId: entry.id, uri })}
      />
    );
  }
  return (
    <View style={styles.appIcon}>
      <Text style={styles.appInitials}>{entry.title.trim().slice(0, 2).toUpperCase()}</Text>
    </View>
  );
}
