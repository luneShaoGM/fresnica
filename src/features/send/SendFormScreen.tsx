import React from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import {Screen} from '@ui/components';

import type {BalanceAsset, BalanceLine} from '../../capabilities/balance/types';
import type {StellarPaymentMemo} from '../../capabilities/stellar/types';
import {useLocalization} from '../../locale';
import {useAppTheme, useThemedStyles} from '../../ui/theme';
import {sendAssetKey} from './sendProductFlow';
import {createSendFormStyles} from './styles';

type Props = Readonly<{
  accountLabel: string;
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
  onContinue: () => void;
  onCancel: () => void;
}>;

export function SendFormScreen({
  accountLabel,
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
  onContinue,
  onCancel,
}: Props) {
  const theme = useAppTheme();
  const {t} = useLocalization();
  const styles = useThemedStyles(createSendFormStyles);
  const selectedBalance = balances.find(
    line => sendAssetKey(line.asset) === sendAssetKey(selectedAsset),
  );

  return (
    <Screen scrollable={false} contentInset="none">
      <View style={styles.header}>
        <Pressable accessibilityLabel="Cancel send" onPress={onCancel} style={styles.backButton}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Send</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Text numberOfLines={1} style={styles.fromLabel}>From {accountLabel}</Text>

        <Text style={styles.sectionLabel}>ASSET</Text>
        <ScrollView
          contentContainerStyle={styles.assetList}
          horizontal
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}>
          {balances.map(line => {
            const selected = sendAssetKey(line.asset) === sendAssetKey(selectedAsset);
            return (
              <Pressable
                key={sendAssetKey(line.asset)}
                onPress={() => onSelectAsset(line.asset)}
                disabled={building}
                style={({pressed}) => [
                  styles.assetCard,
                  selected ? styles.assetCardSelected : undefined,
                  pressed ? styles.pressed : undefined,
                ]}>
                <View style={[styles.assetIcon, selected ? styles.assetIconSelected : undefined]}>
                  <Text style={[styles.assetIconText, selected ? styles.assetIconTextSelected : undefined]}>
                    {line.asset.code.slice(0, 1)}
                  </Text>
                </View>
                <Text style={styles.assetCode}>{line.asset.code}</Text>
                <Text numberOfLines={1} style={styles.assetBalance}>{line.balance}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.balanceLine}>
          <Text style={styles.balanceLabel}>Available</Text>
          <Text style={styles.balanceValue}>
            {selectedBalance?.balance ?? '—'} {selectedAsset.code}
          </Text>
        </View>

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
          <View style={styles.fieldAction}><Text style={styles.fieldActionGlyph}>⌕</Text></View>
        </View>
        <Text style={styles.fieldHint}>Classic Stellar G... destinations are supported.</Text>

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

        <Text style={styles.sectionLabel}>MEMO</Text>
        <View style={styles.memoTypeRow}>
          {(['none', 'text', 'id', 'hash'] as const).map(type => {
            const selected = memoType === type;
            return (
              <Pressable
                accessibilityLabel={t(`send.memo.type.${type}`)}
                accessibilityRole="button"
                accessibilityState={{selected}}
                disabled={building}
                key={type}
                onPress={() => {
                  if (!selected) {
                    onSelectMemoType(type);
                  }
                }}
                style={({pressed}) => [
                  styles.memoTypeButton,
                  selected ? styles.memoTypeButtonSelected : undefined,
                  pressed ? styles.pressed : undefined,
                ]}>
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
                autoCapitalize={memoType === 'hash' ? 'characters' : 'none'}
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

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable
          accessibilityRole="button"
          disabled={building}
          onPress={onContinue}
          style={({pressed}) => [
            styles.reviewButton,
            building ? styles.reviewButtonDisabled : undefined,
            pressed ? styles.pressed : undefined,
          ]}>
          <Text style={styles.reviewButtonText}>{building ? 'Preparing…' : 'Review payment'}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
