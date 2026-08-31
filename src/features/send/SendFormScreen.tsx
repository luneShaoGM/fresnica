import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import type {BalanceAsset, BalanceLine} from '../../capabilities/balance/types';
import {Button} from '../../ui/Button';
import {Card} from '../../ui/Card';
import {Field} from '../../ui/Field';
import {Screen} from '../../ui/Screen';
import {palette, spacing, typography} from '../../ui/theme';
import {sendAssetKey} from './sendProductFlow';

type Props = Readonly<{
  accountLabel: string;
  balances: readonly BalanceLine[];
  selectedAsset: BalanceAsset;
  destination: string;
  amount: string;
  memo: string;
  building: boolean;
  error?: string;
  onSelectAsset: (asset: BalanceAsset) => void;
  onChangeDestination: (value: string) => void;
  onChangeAmount: (value: string) => void;
  onChangeMemo: (value: string) => void;
  onContinue: () => void;
  onCancel: () => void;
}>;

export function SendFormScreen({
  accountLabel,
  balances,
  selectedAsset,
  destination,
  amount,
  memo,
  building,
  error,
  onSelectAsset,
  onChangeDestination,
  onChangeAmount,
  onChangeMemo,
  onContinue,
  onCancel,
}: Props) {
  return (
    <Screen
      eyebrow="Send"
      title="New payment"
      description={`From ${accountLabel}. The next screen will be derived from the exact unsigned transaction XDR.`}
      keyboardShouldPersistTaps="handled">
      <Card title="Asset">
        {balances.map(line => {
          const selected = sendAssetKey(line.asset) === sendAssetKey(selectedAsset);
          return (
            <View key={sendAssetKey(line.asset)} style={styles.assetRow}>
              <View style={styles.assetDetails}>
                <Text style={styles.assetCode}>{line.asset.code}</Text>
                <Text selectable numberOfLines={1} style={styles.assetMeta}>
                  {line.asset.kind === 'credit' ? line.asset.issuer : 'Stellar native asset'}
                </Text>
                <Text style={styles.assetMeta}>Balance: {line.balance}</Text>
              </View>
              <View style={styles.assetAction}>
                <Button
                  label={selected ? 'Selected' : 'Use'}
                  variant={selected ? 'primary' : 'secondary'}
                  onPress={() => onSelectAsset(line.asset)}
                  disabled={building || selected}
                />
              </View>
            </View>
          );
        })}
      </Card>

      <Card title="Payment details">
        <Field
          label="Recipient"
          hint="Classic Stellar G... and muxed M... destinations are supported."
          value={destination}
          onChangeText={onChangeDestination}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!building}
        />
        <Field
          label={`Amount (${selectedAsset.code})`}
          hint="Up to 7 decimal places."
          value={amount}
          onChangeText={onChangeAmount}
          keyboardType="decimal-pad"
          editable={!building}
        />
        <Field
          label="Memo (optional)"
          hint="Text memo, maximum 28 UTF-8 bytes."
          value={memo}
          onChangeText={onChangeMemo}
          autoCorrect={false}
          editable={!building}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Card>

      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button
            label="Cancel"
            variant="secondary"
            onPress={onCancel}
            disabled={building}
          />
        </View>
        <View style={styles.flex}>
          <Button
            label={building ? 'Building...' : 'Review'}
            onPress={onContinue}
            disabled={building}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  assetDetails: {
    flex: 1,
  },
  assetAction: {
    minWidth: 104,
  },
  assetCode: {
    ...typography.body,
    color: palette.text,
    fontWeight: '700',
  },
  assetMeta: {
    ...typography.caption,
    color: palette.textMuted,
  },
  error: {
    ...typography.caption,
    color: palette.danger,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
});
