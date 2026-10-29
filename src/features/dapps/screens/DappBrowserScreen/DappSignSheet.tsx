import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { BottomSheet } from '@ui/components';
import { useThemedStyles } from '@ui/theme';

import type { DappTransactionIntent } from '../../../../capabilities/dapp-interaction/dappTransactionIntent';
import { SwapPassphraseInput, type SwapPassphraseInputHandle } from '../../../swap/SwapPassphraseInput';
import { useLocalization } from '../../../../locale';
import { createConnectSheetStyles } from './connectStyles';

type Props = Readonly<{
  visible: boolean;
  origin: string;
  intent: DappTransactionIntent;
  passphraseRequired: boolean;
  failed: boolean;
  onConfirm: (appPassphrase: string) => void;
  onReject: () => void;
}>;

export function DappSignSheet({ visible, origin, intent, passphraseRequired, failed, onConfirm, onReject }: Props) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createConnectSheetStyles);
  const secureInput = useRef<SwapPassphraseInputHandle>(null);
  const [hasPassphrase, setHasPassphrase] = useState(false);
  const confirm = () => {
    if (passphraseRequired && !hasPassphrase) return;
    onConfirm(secureInput.current?.consume() ?? '');
  };
  const reject = () => {
    secureInput.current?.clear();
    onReject();
  };
  return (
    <BottomSheet closeLabel={t('dapps.sign.reject')} onClose={reject} visible={visible}>
      <ScrollView contentContainerStyle={styles.sheet}>
        <Text style={styles.title}>{t('dapps.sign.title')}</Text>
        <Text selectable style={styles.origin}>
          {origin}
        </Text>
        <Text style={styles.message}>{t('dapps.sign.message')}</Text>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('dapps.sign.source')}</Text>
          <Text selectable style={styles.cardValue}>
            {intent.source}
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('dapps.sign.sequence')}</Text>
          <Text selectable style={styles.cardValue}>
            {intent.sequence}
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('dapps.sign.fee')}</Text>
          <Text style={styles.cardValue}>{intent.fee} stroops</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('dapps.sign.memo')}</Text>
          <Text selectable style={styles.cardValue}>
            {intent.memo ?? t('dapps.sign.none')}
          </Text>
        </View>
        {intent.timeBounds ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>{t('dapps.sign.timeBounds')}</Text>
            <Text selectable style={styles.cardValue}>
              {intent.timeBounds.minTime} – {intent.timeBounds.maxTime}
            </Text>
          </View>
        ) : null}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('dapps.sign.hash')}</Text>
          <Text selectable style={styles.cardValue}>
            {intent.hash}
          </Text>
        </View>
        {intent.operations.map((operation, index) => (
          <View key={index} style={styles.sheet}>
            <Text style={styles.title}>
              {t('dapps.sign.payment')} {index + 1}
            </Text>
            <Text selectable style={styles.cardValue}>
              {t('dapps.sign.destination')}: {operation.destination}
            </Text>
            <Text selectable style={styles.cardValue}>
              {t('dapps.sign.amount')}: {operation.amount}
            </Text>
            <Text selectable style={styles.cardValue}>
              {t('dapps.sign.asset')}: {operation.assetCode}
            </Text>
            {operation.assetIssuer ? (
              <Text selectable style={styles.cardValue}>
                {t('dapps.sign.issuer')}: {operation.assetIssuer}
              </Text>
            ) : null}
          </View>
        ))}
        <SwapPassphraseInput
          ref={secureInput}
          disabled={!passphraseRequired}
          hint={t('dapps.sign.passphraseRequired')}
          label={t('dapps.sign.passphrase')}
          onPresenceChange={setHasPassphrase}
          style={styles.passphraseInput}
        />
        {passphraseRequired ? <Text style={styles.hint}>{t('dapps.sign.passphraseRequired')}</Text> : null}
        {failed ? <Text style={styles.hint}>{t('dapps.sign.retryError')}</Text> : null}
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={reject} style={[styles.action, styles.secondary]}>
            <Text style={styles.actionText}>{t('dapps.sign.reject')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={passphraseRequired && !hasPassphrase}
            onPress={confirm}
            style={styles.action}
          >
            <Text style={styles.actionText}>{t('dapps.sign.confirm')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </BottomSheet>
  );
}
