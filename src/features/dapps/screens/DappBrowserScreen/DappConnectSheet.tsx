import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { BottomSheet } from '@ui/components';
import { useThemedStyles } from '@ui/theme';

import { useLocalization } from '../../../../locale';
import { createConnectSheetStyles } from './connectStyles';

type Props = Readonly<{
  visible: boolean;
  origin: string;
  address: string;
  networkLabel: string;
  onAllowOnce: () => void;
  onAllowAlways: () => void;
  onReject: () => void;
}>;

export function DappConnectSheet({
  visible,
  origin,
  address,
  networkLabel,
  onAllowOnce,
  onAllowAlways,
  onReject,
}: Props): React.JSX.Element {
  const { t } = useLocalization();
  const styles = useThemedStyles(createConnectSheetStyles);
  let hostname = origin;
  try {
    hostname = new URL(origin).hostname;
  } catch {
    hostname = origin;
  }

  return (
    <BottomSheet closeLabel={t('dapps.permission.reject')} onClose={onReject} visible={visible}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <View style={styles.spacer} />
          <Text numberOfLines={1} style={styles.title}>
            {t('dapps.permission.connectTitle')}
          </Text>
          <Pressable
            accessibilityLabel={t('dapps.permission.reject')}
            accessibilityRole="button"
            onPress={onReject}
            style={styles.close}
          >
            <Text style={styles.closeText}>×</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.hero}>
          <Text selectable style={styles.address}>
            {address}
          </Text>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{hostname.slice(0, 1).toUpperCase()}</Text>
          </View>
          <Text numberOfLines={1} style={styles.name}>
            {hostname}
          </Text>
          <Text numberOfLines={1} style={styles.origin}>
            {origin}
          </Text>
          <Text style={styles.message}>{t('dapps.permission.connectMessage')}</Text>
        </ScrollView>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('dapps.permission.network')}</Text>
          <Text numberOfLines={1} style={styles.cardValue}>
            {networkLabel}
          </Text>
        </View>
        <Text style={styles.hint}>{t('dapps.permission.manageHint')}</Text>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={onAllowOnce} style={[styles.action, styles.secondary]}>
            <Text style={styles.actionText}>{t('dapps.permission.allowOnce')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onAllowAlways} style={styles.action}>
            <Text style={styles.actionText}>{t('dapps.permission.allowAlways')}</Text>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}
