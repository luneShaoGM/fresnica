import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { AppModal } from '@ui/components';
import { useAppTheme, useThemedStyles } from '@ui/theme';

import type { AccountRecord } from '../../capabilities/account/types';
import type { BalanceProductDependencies } from '@capabilities/balance/BalanceCacheHydration';
import { useBalanceDisplay } from './useBalanceDisplay';
import { matchingNativeBalance, useNativeBalanceBreakdown } from './useNativeBalanceBreakdown';
import { TokenAssetIcon } from '../assets/TokenAssetIcon';
import type { NativeBalanceBreakdown } from '@capabilities/balance/nativeBalanceBreakdown';
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
  const nativeReady = actionable && visible && asset?.kind === 'native' && !!line;
  const nativeDetails = useNativeBalanceBreakdown(
    account,
    balanceDependencies,
    nativeReady,
    invalidationRevision,
    balanceState.kind === 'ready' ? balanceState.lastSuccessfulUpdateAt?.getTime() : undefined,
  );
  const safeNativeDetails =
    line && asset?.kind === 'native' ? matchingNativeBalance(nativeDetails, line.balance, !nativeReady) : undefined;

  return (
    <AppModal presentation="sheet" swipeToDismiss onRequestClose={onClose} visible={visible && asset !== undefined}>
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
          <NativeBalance canSign={canSign} line={line} breakdown={safeNativeDetails} styles={styles} t={t} />
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
    </AppModal>
  );
}

function NativeBalance({
  line,
  breakdown,
  canSign,
  styles,
  t,
}: Readonly<{
  line: BalanceLine;
  breakdown?: NativeBalanceBreakdown;
  canSign: boolean;
  styles: ReturnType<typeof createAssetDetailsSheetStyles>;
  t: (key: string, params?: Record<string, string>) => string;
}>): React.JSX.Element {
  return (
    <ScrollView contentContainerStyle={styles.bodyContent} style={styles.body}>
      <View style={styles.balanceBlock}>
        <TokenAssetIcon asset={{ kind: 'native', code: 'XLM' }} />
      </View>
      <BalanceCard label={t('home.asset.accountBalance')} styles={styles} value={line.balance} />
      <BalanceCard
        label={t('home.asset.available')}
        styles={styles}
        value={breakdown?.available ?? t('home.asset.availableUnavailable')}
      />
      {!canSign ? <Text style={styles.warning}>{t('home.asset.readOnlySpendable')}</Text> : null}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('home.asset.reserved')}</Text>
        {breakdown ? (
          <>
            <BalanceDetailRow label={t('home.asset.reserved')} value={breakdown.reserved} styles={styles} />
            <BalanceDetailRow label={t('home.asset.baseReserve')} value={breakdown.accountMinimum} styles={styles} />
            <BalanceDetailRow
              label={t('home.asset.grossEntryReserve')}
              value={breakdown.grossEntryReserve}
              styles={styles}
            />
            <BalanceDetailRow
              label={t('home.asset.sponsorshipOffset')}
              value={breakdown.sponsorshipOffset}
              styles={styles}
            />
            <BalanceDetailRow
              label={t('home.asset.sellingLiabilities')}
              value={breakdown.sellingLiabilities}
              styles={styles}
            />
            <BalanceDetailRow
              label={t('home.asset.subentries')}
              value={String(breakdown.subentryCount)}
              styles={styles}
            />
            <BalanceDetailRow
              label={t('home.asset.sponsoring')}
              value={String(breakdown.numSponsoring)}
              styles={styles}
            />
            <BalanceDetailRow
              label={t('home.asset.sponsored')}
              value={String(breakdown.numSponsored)}
              styles={styles}
            />
          </>
        ) : (
          <Text style={styles.helper}>{t('home.asset.reservedUnavailable')}</Text>
        )}
      </View>
      {breakdown ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('home.asset.trustlines')}</Text>
          {breakdown.trustlines.length ? (
            breakdown.trustlines.map(lineItem => (
              <View key={lineItem.code + ':' + lineItem.issuer} style={styles.trustline}>
                <Text style={styles.cardLabel}>{lineItem.code}</Text>
                <Text selectable style={styles.trustlineIssuer}>
                  {lineItem.issuer}
                </Text>
                <Text style={styles.helper}>
                  {lineItem.authorized ? t('home.asset.trustlineAuthorized') : t('home.asset.trustlineRestricted')}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.helper}>{t('home.asset.noTrustlines')}</Text>
          )}
          <Text style={styles.helper}>{t('home.asset.trustlineReserveNote')}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function BalanceDetailRow({
  label,
  value,
  styles,
}: Readonly<{
  label: string;
  value: string;
  styles: ReturnType<typeof createAssetDetailsSheetStyles>;
}>): React.JSX.Element {
  return (
    <View style={styles.cardRow}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text selectable style={styles.cardValue}>
        {value}
      </Text>
    </View>
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
        <TokenAssetIcon asset={asset} />
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
