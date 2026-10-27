import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { BottomSheet } from '@ui/components';
import { useAppTheme, useThemedStyles } from '@ui/theme';

import type { AccountRecord } from '../../capabilities/account/types';
import type { BalanceProductDependencies } from '@capabilities/balance/BalanceCacheHydration';
import { useBalanceDisplay } from './useBalanceDisplay';
import { BalanceFreshnessNotice } from './components/BalanceFreshnessNotice';
import type { BalanceAsset, BalanceLine } from '../../capabilities/balance/types';
import { useLocalization } from '../../locale';
import {
  canRemoveIssuedBalance,
  canSendBalance,
  resolveAssetDetailsSnapshot,
  type AssetDetailsSnapshotState,
} from './assetDetails';
import { createAssetDetailsSheetStyles } from './assetDetailsSheetStyles';

type Props = Readonly<{
  visible: boolean;
  asset?: BalanceAsset;
  account: AccountRecord;
  balanceDependencies: BalanceProductDependencies;
  active: boolean;
  invalidationRevision: number;
  canSign: boolean;
  onClose: () => void;
  copyPublicText: (text: string) => Promise<void>;
  onSend: (asset: BalanceAsset) => void;
  onRemove: (asset: Extract<BalanceAsset, { kind: 'credit' }>) => void;
}>;

type ViewState =
  Readonly<{ kind: 'loading' }> | Readonly<{ kind: 'error'; message: string }> | AssetDetailsSnapshotState;

export function AssetDetailsSheet({
  visible,
  asset,
  account,
  balanceDependencies,
  active,
  invalidationRevision,
  canSign,
  onClose,
  copyPublicText,
  onSend,
  onRemove,
}: Props): React.JSX.Element {
  const { t } = useLocalization();
  const theme = useAppTheme();
  const styles = useThemedStyles(createAssetDetailsSheetStyles);
  const { state: balanceState, refresh } = useBalanceDisplay(
    account,
    balanceDependencies,
    visible && active,
    invalidationRevision,
  );
  const state: ViewState =
    balanceState.kind === 'ready'
      ? asset
        ? resolveAssetDetailsSnapshot(balanceState.snapshot, asset)
        : { kind: 'missing' }
      : balanceState;
  const [confirmCopy, setConfirmCopy] = useState(false);
  const [copied, setCopied] = useState(false);
  const line = state.kind === 'ready' ? state.line : undefined;
  const actionable = active && balanceState.kind === 'ready' && !balanceState.stale && !balanceState.refreshing;

  return (
    <BottomSheet closeLabel={t('common.close')} onClose={onClose} visible={visible && asset !== undefined}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text numberOfLines={1} style={styles.title}>
            {asset?.kind === 'native' ? t('home.asset.balanceTitle') : (asset?.code ?? t('home.asset.balanceTitle'))}
          </Text>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.close}>
            <Text style={styles.closeText}>{t('common.close')}</Text>
          </Pressable>
        </View>
        <BalanceFreshnessNotice state={balanceState} onRefresh={refresh} />
        <Pressable accessibilityRole="button" onPress={() => refresh()}>
          <Text style={styles.helper}>{t('trustlines.add.retry')}</Text>
        </Pressable>
        {asset?.kind === 'native' ? <Text style={styles.explanation}>{t('home.asset.nativeExplanation')}</Text> : null}
        {state.kind === 'loading' ? (
          <View style={styles.status}>
            <ActivityIndicator color={theme.colors.actionPrimary} />
            <Text style={styles.statusText}>{t('home.asset.loading')}</Text>
          </View>
        ) : state.kind === 'error' ? (
          <View style={styles.status}>
            <Text style={styles.statusText}>{t('home.asset.error')}</Text>
          </View>
        ) : state.kind === 'inactive' ? (
          <View style={styles.status}>
            <Text style={styles.statusText}>{t('home.asset.inactive')}</Text>
          </View>
        ) : state.kind === 'unsupported-account' || state.kind === 'missing' || !asset || !line ? (
          <View style={styles.status}>
            <Text style={styles.statusText}>{t('home.asset.missing')}</Text>
          </View>
        ) : asset.kind === 'native' ? (
          <NativeBalance canSign={canSign} line={line} spendable={undefined} styles={styles} t={t} />
        ) : (
          <IssuedAsset
            asset={asset}
            canSend={canSign && actionable && canSendBalance(line.balance)}
            canRemove={canSign && actionable && canRemoveIssuedBalance(line.balance)}
            confirmCopy={confirmCopy}
            copied={copied}
            line={line}
            onCopy={() => {
              if (!confirmCopy) {
                setConfirmCopy(true);
                return;
              }
              void copyPublicText(asset.issuer)
                .then(() => setCopied(true))
                .catch(() => setCopied(false));
            }}
            onRemove={() => onRemove(asset)}
            onSend={() => onSend(asset)}
            styles={styles}
            t={t}
          />
        )}
      </View>
    </BottomSheet>
  );
}

function NativeBalance({
  line,
  spendable,
  canSign,
  styles,
  t,
}: Readonly<{
  line: BalanceLine;
  spendable: string | undefined;
  canSign: boolean;
  styles: ReturnType<typeof createAssetDetailsSheetStyles>;
  t: (key: string, params?: Record<string, string>) => string;
}>): React.JSX.Element {
  return (
    <ScrollView contentContainerStyle={styles.bodyContent} style={styles.body}>
      <BalanceCard label={t('home.asset.accountBalance')} styles={styles} value={line.balance} />
      <BalanceCard
        label={t('home.asset.available')}
        styles={styles}
        value={spendable ?? t('home.asset.availableUnavailable')}
      />
      {canSign ? null : <Text style={styles.warning}>{t('home.asset.readOnlySpendable')}</Text>}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('home.asset.reserved')}</Text>
        <Text style={styles.helper}>{t('home.asset.reservedUnavailable')}</Text>
      </View>
    </ScrollView>
  );
}

function IssuedAsset({
  asset,
  line,
  canSend,
  canRemove,
  confirmCopy,
  copied,
  onSend,
  onRemove,
  onCopy,
  styles,
  t,
}: Readonly<{
  asset: Extract<BalanceAsset, { kind: 'credit' }>;
  line: BalanceLine;
  canSend: boolean;
  canRemove: boolean;
  confirmCopy: boolean;
  copied: boolean;
  onSend: () => void;
  onRemove: () => void;
  onCopy: () => void;
  styles: ReturnType<typeof createAssetDetailsSheetStyles>;
  t: (key: string, params?: Record<string, string>) => string;
}>): React.JSX.Element {
  return (
    <ScrollView contentContainerStyle={styles.bodyContent} style={styles.body}>
      <View style={styles.balanceBlock}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{asset.code.slice(0, 1)}</Text>
        </View>
        <Text style={styles.amount}>{line.balance}</Text>
        <Text style={styles.code}>{asset.code}</Text>
      </View>
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>{t('home.asset.issuer')}</Text>
          <Pressable accessibilityRole="button" onPress={onCopy} style={styles.issuerButton}>
            <Text selectable style={styles.cardValue}>
              {asset.issuer}
            </Text>
            <Text style={styles.helper}>{copied ? t('common.copied') : t('home.asset.copyIssuer')}</Text>
          </Pressable>
        </View>
        {confirmCopy && !copied ? <Text style={styles.warning}>{t('home.asset.copyIssuerWarning')}</Text> : null}
        {line.limit ? (
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>{t('home.asset.limit')}</Text>
            <Text style={styles.cardValue}>{line.limit}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSend }}
          disabled={!canSend}
          onPress={onSend}
          style={[styles.action, canSend ? undefined : styles.disabled]}
        >
          <Text style={styles.actionText}>{t('home.asset.send')}</Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !canRemove }}
        disabled={!canRemove}
        onPress={onRemove}
        style={[styles.remove, canRemove ? undefined : styles.disabled]}
      >
        <Text style={styles.removeText}>{t('home.asset.remove')}</Text>
      </Pressable>
      {canRemove ? null : <Text style={styles.helper}>{t('home.asset.removeUnavailable')}</Text>}
    </ScrollView>
  );
}

function BalanceCard({
  label,
  value,
  styles,
}: Readonly<{
  label: string;
  value: string;
  styles: ReturnType<typeof createAssetDetailsSheetStyles>;
}>): React.JSX.Element {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{label}</Text>
      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>XLM</Text>
        <Text style={styles.cardValue}>{value}</Text>
      </View>
    </View>
  );
}
