import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { BottomSheet, Field } from '@ui/components';
import { useThemedStyles } from '@ui/theme';

import { useLocalization } from '../../../../locale';
import { createConnectSheetStyles } from './connectStyles';

type Props = Readonly<{
  visible: boolean;
  origin: string;
  source: string;
  fee: string;
  operationCount: number;
  passphraseRequired: boolean;
  onConfirm: (appPassphrase: string) => void;
  onReject: () => void;
}>;

export function DappSignSheet({
  visible,
  origin,
  source,
  fee,
  operationCount,
  passphraseRequired,
  onConfirm,
  onReject,
}: Props): React.JSX.Element {
  const { t } = useLocalization();
  const styles = useThemedStyles(createConnectSheetStyles);
  const [passphrase, setPassphrase] = useState('');

  return (
    <BottomSheet closeLabel={t('dapps.sign.reject')} onClose={onReject} visible={visible}>
      <View style={styles.sheet}>
        <Text style={styles.title}>{t('dapps.sign.title')}</Text>
        <Text selectable style={styles.origin}>
          {origin}
        </Text>
        <Text style={styles.message}>{t('dapps.sign.message')}</Text>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('dapps.sign.source')}</Text>
          <Text selectable style={styles.cardValue}>
            {source}
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('dapps.sign.fee')}</Text>
          <Text style={styles.cardValue}>{fee}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('dapps.sign.operations')}</Text>
          <Text style={styles.cardValue}>{String(operationCount)}</Text>
        </View>
        <Field
          autoCapitalize="none"
          autoCorrect={false}
          label={t('dapps.sign.passphrase')}
          onChangeText={setPassphrase}
          secureTextEntry
          value={passphrase}
        />
        {passphraseRequired ? <Text style={styles.hint}>{t('dapps.sign.passphraseRequired')}</Text> : null}
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={onReject} style={[styles.action, styles.secondary]}>
            <Text style={styles.actionText}>{t('dapps.sign.reject')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => onConfirm(passphrase)} style={styles.action}>
            <Text style={styles.actionText}>{t('dapps.sign.confirm')}</Text>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}
