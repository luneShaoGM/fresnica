import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { NativeButton } from '@ui/components/NativeButton';
import { useThemedStyles } from '@ui/theme';

import { useLocalization } from '../../locale';
import { createStyles } from './styles';

type Props = Readonly<{
  address: string;
  copyPublicText: (text: string) => Promise<void>;
}>;

export function CopyAddressButton({ address, copyPublicText }: Props) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const [status, setStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle');
  const copy = async () => {
    if (status === 'copying') return;
    setStatus('copying');
    try {
      await copyPublicText(address);
      setStatus('copied');
    } catch {
      setStatus('error');
    }
  };

  return (
    <View>
      <NativeButton
        label={t('contacts.copy')}
        size="sm"
        variant="quiet"
        disabled={status === 'copying'}
        onPress={copy}
      />
      {status === 'copied' || status === 'error' ? (
        <Text accessibilityLiveRegion="polite" style={status === 'error' ? styles.sortError : styles.description}>
          {t(status === 'copied' ? 'accounts.copy.success' : 'accounts.copy.error')}
        </Text>
      ) : null}
    </View>
  );
}
