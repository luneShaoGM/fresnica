import React, { useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { Image, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useAppTheme, useThemedStyles } from '@ui/theme';
import { accountAvatarAddress } from '@capabilities/contacts/AccountAvatars';
import { AccountAvatarContext } from './accountAvatarContext';
import { createStyles } from './styles';
const EMPTY = Object.freeze({ enabled: false, readable: false, revision: 0 });
const subscribeNothing = () => () => {};
const emptySnapshot = () => EMPTY;

export function ActivitySymbol({ document = false }: Readonly<{ document?: boolean }>) {
  const theme = useAppTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.avatarFrame}
    >
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" accessible={false}>
        {document ? (
          <Path
            d="M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h6M9 16h6"
            stroke={theme.colors.textPrimary}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
        ) : (
          <>
            <Circle cx={12} cy={8} r={3.5} stroke={theme.colors.textPrimary} strokeWidth={1.6} />
            <Path
              d="M5 21v-2a7 7 0 0 1 14 0v2"
              stroke={theme.colors.textPrimary}
              strokeWidth={1.6}
              strokeLinecap="round"
            />
          </>
        )}
      </Svg>
    </View>
  );
}
export function ActivityAccountAvatar({ address, active = true }: Readonly<{ address: string; active?: boolean }>) {
  const service = useContext(AccountAvatarContext);
  const snapshot = useSyncExternalStore(
    service?.subscribe ?? subscribeNothing,
    service?.getSnapshot ?? emptySnapshot,
    emptySnapshot,
  );
  const styles = useThemedStyles(createStyles);
  const key = accountAvatarAddress(address) ?? '';
  const [image, setImage] = useState<Readonly<{ key: string; revision: number; uri?: string }>>({ key, revision: -1 });
  useEffect(() => {
    if (!active || !key || !service || !snapshot.enabled) {
      setImage({ key, revision: snapshot.revision });
      return;
    }
    const owner = new AbortController();
    setImage({ key, revision: snapshot.revision, uri: service.read(key) });
    service
      .load(key, owner.signal)
      .then(uri => {
        if (!owner.signal.aborted) setImage({ key, revision: snapshot.revision, uri });
      })
      .catch(() => undefined);
    return () => owner.abort();
  }, [active, key, service, snapshot.enabled, snapshot.revision]);
  if (!active || !snapshot.enabled || image.key !== key || image.revision !== snapshot.revision || !image.uri)
    return <ActivitySymbol />;
  const uri = image.uri;
  return (
    <Image
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      source={{ uri }}
      resizeMode="cover"
      style={styles.avatarFrame}
      onError={() => {
        service?.reject(key, uri);
        setImage(current =>
          current.key === key && current.uri === uri && current.revision === snapshot.revision
            ? { key, revision: snapshot.revision }
            : current,
        );
      }}
    />
  );
}
