import React, { useContext, useState } from 'react';
import { Platform, Pressable, Text, View, type StyleProp, type TextStyle } from 'react-native';

import { SmallCopy } from '@ui/components/SmallIcons';
import { FeedbackContext } from '@ui/feedback';
import { formatPublicAddress } from '@ui/formatPublicAddress';
import { useAppTheme, useThemedStyles } from '@ui/theme';

import { useLocalization } from '../../locale';
import { createStyles } from './styles';

type Props = Readonly<{
  address: string;
  copyPublicText: (text: string) => Promise<void>;
  numberOfLines?: number;
  addressStyle?: StyleProp<TextStyle>;
  kind?: 'address' | 'transaction-hash';
}>;

export function CopyAddressButton({ address, copyPublicText, numberOfLines = 1, addressStyle, kind = 'address' }: Props) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const theme = useAppTheme();
  const feedback = useContext(FeedbackContext);
  const isHash = kind === 'transaction-hash';
  const [status, setStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle');
  const copy = async () => {
    if (status === 'copying') return;
    feedback?.();
    setStatus('copying');
    try {
      await copyPublicText(address);
      setStatus('copied');
    } catch {
      setStatus('error');
    }
  };

  return (
    <View style={styles.copyBlock}>
      <View style={[styles.copyAddressRow, isHash ? styles.copyAddressRowEnd : undefined]}>
        <Text
          numberOfLines={numberOfLines}
          ellipsizeMode="middle"
          accessibilityLabel={isHash ? address : undefined}
          selectable={!isHash && (Platform.OS !== 'android' || numberOfLines !== 1)}
          style={[styles.address, styles.copyAddressText, addressStyle]}
        >
          {isHash ? formatPublicAddress(address) : address}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(isHash ? 'activity.detail.hashCopy.action' : 'accounts.copy.action')}
          accessibilityState={{ disabled: status === 'copying', busy: status === 'copying' }}
          disabled={status === 'copying'}
          onPress={copy}
          style={({ pressed }) => [styles.copyButton, pressed || status === 'copying' ? styles.pressed : undefined]}
        >
          <SmallCopy color={theme.colors.textSecondary} />
        </Pressable>
      </View>
      {status === 'copied' || status === 'error' ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.copyFeedback, isHash ? styles.copyFeedbackEnd : undefined, status === 'error' ? styles.copyError : undefined]}
        >
          {t(isHash
            ? (status === 'copied' ? 'activity.detail.hashCopy.success' : 'activity.detail.hashCopy.error')
            : (status === 'copied' ? 'accounts.copy.success' : 'accounts.copy.error'))}
        </Text>
      ) : null}
    </View>
  );
}
