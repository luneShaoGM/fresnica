import React from 'react';
import { AssetPicker } from '../assets/AssetPicker';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Screen } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';

import type { BalanceAsset, BalanceLine } from '../../capabilities/balance/types';
import type { StellarPaymentMemo } from '../../capabilities/stellar/types';
import { useLocalization } from '../../locale';
import { useAppTheme, useThemedStyles } from '../../ui/theme';
import { sendAssetKey } from './sendProductFlow';
import { createSendFormStyles } from './styles';

type Props = Readonly<{
  step: 'details' | 'recipient';
  active?: boolean;
  accountLabel: string;
  requestMessage?: string;
  balances: readonly BalanceLine[];
  selectedAsset: BalanceAsset;
  destination: string;
  amount: string;
  memoType: 'none' | StellarPaymentMemo['type'];
  memoValue: string;
  building: boolean;
  error?: string;
  onSelectAsset: (asset: BalanceAsset) => void;
  onChangeDestination: (value: string) => void;
  onChangeAmount: (value: string) => void;
  onSelectMemoType: (type: 'none' | StellarPaymentMemo['type']) => void;
  onChangeMemoValue: (value: string) => void;
  onChooseRecipient?: () => void;
  onScanRecipient?: () => void;
  onContinue: () => void;
}>;

export function SendEntryScreen({
  children,
  onBack,
  onCancel,
}: React.PropsWithChildren<Readonly<{ onBack?: () => void; onCancel: () => void }>>) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createSendFormStyles);

  return (
    <Screen scrollable={false} contentInset="none">
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <NativeButton
            label={t(onBack ? 'common.back' : 'common.cancel')}
            onPress={onBack ?? onCancel}
            size="sm"
            variant="quiet"
          />
        </View>
        <Text accessibilityRole="header" style={styles.headerTitle}>
          {t(onBack ? 'send.step.recipient' : 'nav.send')}
        </Text>
        <View style={[styles.headerSide, styles.headerTrailing]}>
          {onBack ? <NativeButton label={t('common.cancel')} onPress={onCancel} size="sm" variant="quiet" /> : null}
        </View>
      </View>
      {children}
    </Screen>
  );
}

export function SendFormScreen({
  step,
  active = true,
  accountLabel,
  requestMessage,
  balances,
  selectedAsset,
  destination,
  amount,
  memoType,
  memoValue,
  building,
  error,
  onSelectAsset,
  onChangeDestination,
  onChangeAmount,
  onSelectMemoType,
  onChangeMemoValue,
  onChooseRecipient,
  onScanRecipient,
  onContinue,
}: Props) {
  const theme = useAppTheme();
  const { t } = useLocalization();
  const styles = useThemedStyles(createSendFormStyles);
  const selectedBalance = balances.find(line => sendAssetKey(line.asset) === sendAssetKey(selectedAsset));

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text numberOfLines={1} style={styles.fromLabel}>
          From {accountLabel}
        </Text>

        <Text style={styles.stepIndicator}>
          {t(step === 'details' ? 'send.step.indicatorDetails' : 'send.step.indicatorRecipient')}
        </Text>
        {step === 'details' ? (
          <>
            <Text style={styles.sectionLabel}>ASSET</Text>
            <AssetPicker
              balances={balances}
              selectedAsset={selectedAsset}
              disabled={building || !active}
              onSelect={onSelectAsset}
              label={t('assets.picker.title')}
            />

            <View style={styles.balanceLine}>
              <Text style={styles.balanceLabel}>Available</Text>
              <Text style={styles.balanceValue}>
                {selectedBalance?.balance ?? '—'} {selectedAsset.code}
              </Text>
            </View>

            <Text style={styles.sectionLabel}>AMOUNT</Text>
            <View style={styles.amountBox}>
              <TextInput
                editable={!building}
                keyboardType="decimal-pad"
                onChangeText={onChangeAmount}
                placeholder="0"
                placeholderTextColor={theme.colors.textTertiary}
                style={styles.amountInput}
                value={amount}
              />
              <Text style={styles.amountAsset}>{selectedAsset.code}</Text>
            </View>
            <Text style={styles.fieldHint}>Up to 7 decimal places.</Text>
          </>
        ) : (
          <>
            <Text style={styles.recipientSummary}>
              {amount} {selectedAsset.code}
            </Text>
            <Text style={styles.sectionLabel}>RECIPIENT</Text>
            <View style={styles.fieldBox}>
              <TextInput
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!building}
                onChangeText={onChangeDestination}
                placeholder="Stellar G... address"
                placeholderTextColor={theme.colors.textTertiary}
                style={styles.fieldInput}
                value={destination}
              />
              {onChooseRecipient ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('contacts.choose')}
                  disabled={building}
                  onPress={onChooseRecipient}
                  style={styles.fieldAction}
                >
                  <Text style={styles.fieldActionGlyph}>⌕</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.fieldHint}>Classic Stellar G... destinations are supported.</Text>
            {onScanRecipient ? (
              <NativeButton label={t('contacts.scan.open')} variant="quiet" onPress={onScanRecipient} />
            ) : null}

            <Text style={styles.sectionLabel}>MEMO</Text>
            <View style={styles.memoTypeRow}>
              {(['none', 'text', 'id', 'hash', 'return'] as const).map(type => {
                const selected = memoType === type;
                return (
                  <Pressable
                    accessibilityLabel={t(`send.memo.type.${type}`)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    disabled={building}
                    key={type}
                    onPress={() => {
                      if (!selected) {
                        onSelectMemoType(type);
                      }
                    }}
                    style={({ pressed }) => [
                      styles.memoTypeButton,
                      selected ? styles.memoTypeButtonSelected : undefined,
                      pressed ? styles.pressed : undefined,
                    ]}
                  >
                    <Text style={[styles.memoTypeText, selected ? styles.memoTypeTextSelected : undefined]}>
                      {t(`send.memo.type.${type}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {memoType === 'none' ? (
              <Text style={styles.fieldHint}>{t('send.memo.hint.none')}</Text>
            ) : (
              <>
                <View style={styles.fieldBox}>
                  <TextInput
                    accessibilityLabel={t(`send.memo.input.${memoType}`)}
                    autoCapitalize={memoType === 'hash' || memoType === 'return' ? 'characters' : 'none'}
                    autoCorrect={false}
                    editable={!building}
                    keyboardType={memoType === 'id' ? 'number-pad' : 'default'}
                    onChangeText={onChangeMemoValue}
                    placeholder={t(`send.memo.placeholder.${memoType}`)}
                    placeholderTextColor={theme.colors.textTertiary}
                    style={styles.fieldInput}
                    value={memoValue}
                  />
                </View>
                <Text style={styles.fieldHint}>{t(`send.memo.hint.${memoType}`)}</Text>
              </>
            )}

            {requestMessage ? (
              <View>
                <Text style={styles.sectionLabel}>{t('send.request.context')}</Text>
                <Text style={styles.fieldHint}>{t('send.request.untrusted')}</Text>
                <Text selectable style={styles.fieldHint}>
                  {requestMessage}
                </Text>
              </View>
            ) : null}
          </>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable
          accessibilityRole="button"
          disabled={building}
          onPress={onContinue}
          style={({ pressed }) => [
            styles.reviewButton,
            building ? styles.reviewButtonDisabled : undefined,
            pressed ? styles.pressed : undefined,
          ]}
        >
          <Text style={styles.reviewButtonText}>
            {building
              ? t('send.step.preparing')
              : t(step === 'details' ? 'send.step.toRecipient' : 'send.step.toSummary')}
          </Text>
        </Pressable>
      </View>
    </>
  );
}
