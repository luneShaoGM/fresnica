import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {Screen} from '@ui/components';

import type { AccountRecord } from '../../capabilities/account/types';
import { loadBalanceSnapshot } from '../../capabilities/balance/loadBalanceSnapshot';
import type { BalanceLine } from '../../capabilities/balance/types';
import type { TrustlineReview } from '../../capabilities/trustline/buildTrustlineReview';
import type { TrustlineAction } from '../../capabilities/trustline/prepareTrustline';
import { useAppTheme, useThemedStyles, type AppTheme } from '../../ui/theme';
import { SlideToConfirm } from '../../ui/SlideToConfirm';
import {projectFeatureError} from '../featureError';
import {
  prepareTrustlineProductReview,
  submitTrustlineProductReview,
  type TrustlineProductDependencies,
  type TrustlineSubmissionResult,
} from './trustlineProductFlow';

type LoadState =
  | Readonly<{ kind: 'loading' }>
  | Readonly<{ kind: 'blocked'; title: string; description: string }>
  | Readonly<{ kind: 'ready'; trustlines: readonly BalanceLine[] }>;

type FlowState =
  | Readonly<{ kind: 'manage' }>
  | Readonly<{ kind: 'review'; review: TrustlineReview }>
  | Readonly<{ kind: 'result'; result: TrustlineSubmissionResult }>;

type LimitEditorState = Readonly<{
  code: string;
  issuer: string;
  currentLimit?: string;
  value: string;
}>;

type Props = Readonly<{
  account: AccountRecord;
  dependencies: TrustlineProductDependencies;
  onDone: () => void;
}>;

export function ManageAssetsScreen({ account, dependencies, onDone }: Props) {
  const theme = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'loading' });
  const [flow, setFlow] = useState<FlowState>({ kind: 'manage' });
  const [assetCode, setAssetCode] = useState('');
  const [assetIssuer, setAssetIssuer] = useState('');
  const [limitEditor, setLimitEditor] = useState<LimitEditorState>();
  const [building, setBuilding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [passphraseRequired, setPassphraseRequired] = useState(false);
  const [appPassphrase, setAppPassphrase] = useState('');
  const [error, setError] = useState<string>();
  const loadVersion = useRef(0);

  const loadTrustlines = useCallback(() => {
    const version = loadVersion.current + 1;
    loadVersion.current = version;
    setLoadState({ kind: 'loading' });

    void loadBalanceSnapshot({ gateway: dependencies.gateway, networkId: dependencies.network.id }, account)
      .then(snapshot => {
        if (loadVersion.current !== version) {
          return;
        }
        if (snapshot.status === 'inactive') {
          setLoadState({
            kind: 'blocked',
            title: 'Account not activated',
            description: 'This Stellar account must exist on Testnet before trustlines can be changed.',
          });
          return;
        }
        if (snapshot.status === 'unsupported-account') {
          setLoadState({
            kind: 'blocked',
            title: 'Manage assets unavailable',
            description: 'Classic ChangeTrust semantics are not applied to contract accounts.',
          });
          return;
        }

        setLoadState({
          kind: 'ready',
          trustlines: snapshot.balances.filter(line => line.asset.kind === 'credit'),
        });
      })
      .catch(caught => {
        if (loadVersion.current === version) {
          setLoadState({
            kind: 'blocked',
            title: 'Unable to load trustlines',
            description: readableError(caught),
          });
        }
      });
  }, [account, dependencies.gateway, dependencies.network.id]);

  useEffect(() => {
    setFlow({ kind: 'manage' });
    setAssetCode('');
    setAssetIssuer('');
    setLimitEditor(undefined);
    setAppPassphrase('');
    setPassphraseRequired(false);
    setError(undefined);
    loadTrustlines();

    return () => {
      loadVersion.current += 1;
    };
  }, [loadTrustlines]);

  const prepare = useCallback(
    async (action: TrustlineAction, code: string, issuer: string, limit?: string) => {
      setBuilding(true);
      setError(undefined);
      try {
        const review = await prepareTrustlineProductReview(dependencies, account, {
          action,
          asset: { code, issuer },
          ...(limit === undefined ? {} : { limit }),
        });
        setAppPassphrase('');
        setPassphraseRequired(false);
        setFlow({ kind: 'review', review });
      } catch (caught) {
        setError(readableError(caught));
      } finally {
        setBuilding(false);
      }
    },
    [account, dependencies],
  );

  const submit = useCallback(async () => {
    if (flow.kind !== 'review') {
      return;
    }

    const passphrase = passphraseRequired ? appPassphrase : undefined;
    if (passphraseRequired) {
      setAppPassphrase('');
    }

    setSubmitting(true);
    setError(undefined);
    try {
      const result = await submitTrustlineProductReview(dependencies, account, flow.review, passphrase);
      if (result.status === 'passphrase-required') {
        setPassphraseRequired(true);
        return;
      }
      setFlow({ kind: 'result', result });
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setSubmitting(false);
    }
  }, [account, appPassphrase, dependencies, flow, passphraseRequired]);

  if (loadState.kind === 'loading') {
    return (
      <MessageScreen title="Manage assets" message="Loading current Stellar trustlines…" loading onBack={onDone} />
    );
  }

  if (loadState.kind === 'blocked') {
    return <MessageScreen title={loadState.title} message={loadState.description} onBack={onDone} />;
  }

  if (flow.kind === 'review') {
    const review = flow.review;
    return (
      <Screen scrollable={false} contentInset="none">
        <Header
          title="Review asset change"
          disabled={submitting}
          onBack={() => {
            setAppPassphrase('');
            setPassphraseRequired(false);
            setError(undefined);
            setFlow({ kind: 'manage' });
          }}
        />
        <ScrollView
          contentContainerStyle={styles.reviewContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.reviewHero}>
            <View style={styles.assetHeroIcon}>
              <Text style={styles.assetHeroGlyph}>{review.asset.code.slice(0, 1)}</Text>
            </View>
            <Text style={styles.reviewAction}>{reviewActionLabel(review.operation)}</Text>
            <Text style={styles.reviewAsset}>{review.asset.code}</Text>
            <Text numberOfLines={2} selectable style={styles.reviewIssuer}>
              {review.asset.issuer}
            </Text>
          </View>

          <View style={styles.rows}>
            <ReviewRow label="Source" value={review.source} mono />
            <ReviewRow label="Resulting limit" value={review.limit ?? '0 (remove)'} />
            <ReviewRow label="Fee" value={`${review.fee} stroops`} />
            {review.expectedAuthorization ? (
              <ReviewRow label="Expected authorization" value={review.expectedAuthorization} />
            ) : null}
            {review.expectedClawbackEnabled === undefined ? null : (
              <ReviewRow label="Expected clawback" value={review.expectedClawbackEnabled ? 'Enabled' : 'Disabled'} />
            )}
          </View>

          <View style={styles.authNote}>
            <Text style={styles.authTitle}>Authorization</Text>
            <Text style={styles.authText}>
              Current ledger authorization is reloaded before signing. Routine signing uses System Auth first, with
              app-passphrase fallback only when required.
            </Text>
          </View>

          {passphraseRequired ? (
            <View style={styles.passphraseBlock}>
              <Text style={styles.fieldLabel}>APP PASSPHRASE</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                editable={!submitting}
                onChangeText={setAppPassphrase}
                placeholder="Current app passphrase"
                placeholderTextColor={theme.colors.textTertiary}
                secureTextEntry
                style={styles.input}
                value={appPassphrase}
              />
            </View>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
        <View style={styles.bottomBar}>
          <SlideToConfirm
            disabled={submitting || (passphraseRequired && appPassphrase.length === 0)}
            label="Slide to confirm"
            loading={submitting}
            onComplete={() => void submit()}
          />
        </View>
      </Screen>
    );
  }

  if (flow.kind === 'result') {
    const positive = flow.result.status === 'submitted';
    const uncertain = flow.result.status === 'uncertain';
    return (
      <Screen scrollable={false} contentInset="none">
        <ScrollView contentContainerStyle={styles.resultContent}>
          <View
            style={[
              styles.resultIcon,
              positive ? styles.resultPositive : uncertain ? styles.resultUncertain : styles.resultNegative,
            ]}
          >
            <Text style={styles.resultGlyph}>{positive ? '✓' : uncertain ? '?' : '!'}</Text>
          </View>
          <Text style={styles.resultTitle}>{resultTitle(flow.result)}</Text>
          <Text style={styles.resultDescription}>{resultDescription(flow.result)}</Text>
        </ScrollView>
        <View style={styles.bottomBar}>
          <Pressable
            onPress={onDone}
            style={({ pressed }) => [styles.primaryButton, pressed ? styles.pressed : undefined]}
          >
            <Text style={styles.primaryButtonText}>Back to Wallet</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scrollable={false} contentInset="none">
      <Header title="Manage assets" onBack={onDone} />
      <ScrollView
        contentContainerStyle={styles.manageContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text numberOfLines={1} style={styles.accountCaption}>
          {account.label || account.address}
        </Text>

        <Text style={styles.sectionLabel}>ADD ASSET</Text>
        <View style={styles.addBlock}>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            editable={!building}
            onChangeText={setAssetCode}
            placeholder="Asset code"
            placeholderTextColor={theme.colors.textTertiary}
            style={styles.input}
            value={assetCode}
          />
          <TextInput
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!building}
            onChangeText={setAssetIssuer}
            placeholder="Issuer G..."
            placeholderTextColor={theme.colors.textTertiary}
            style={[styles.input, styles.issuerInput]}
            value={assetIssuer}
          />
          <Text style={styles.helperText}>
            Fresnica uses the normative default trustline limit and preflights issuer state, reserve and fee capacity
            before building XDR.
          </Text>
          <Pressable
            disabled={building || assetCode.trim().length === 0 || assetIssuer.trim().length === 0}
            onPress={() => void prepare('add', assetCode, assetIssuer)}
            style={({ pressed }) => [
              styles.primaryButton,
              building || assetCode.trim().length === 0 || assetIssuer.trim().length === 0
                ? styles.disabled
                : undefined,
              pressed ? styles.pressed : undefined,
            ]}
          >
            {building ? (
              <ActivityIndicator color={theme.colors.onActionPrimary} />
            ) : (
              <Text style={styles.primaryButtonText}>Review add</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>YOUR ASSETS</Text>
        <View style={styles.assetList}>
          {loadState.trustlines.length === 0 ? (
            <View style={styles.emptyAssets}>
              <Text style={styles.emptyTitle}>No issued assets</Text>
              <Text style={styles.emptyText}>Ordinary issued-asset trustlines will appear here.</Text>
            </View>
          ) : (
            loadState.trustlines.map(line => {
              const asset = line.asset;
              if (asset.kind !== 'credit') {
                return null;
              }
              const editingLimit =
                limitEditor?.code === asset.code && limitEditor.issuer === asset.issuer;
              return (
                <React.Fragment key={`${asset.code}:${asset.issuer}`}>
                  <View style={styles.assetRow}>
                    <View style={styles.assetIcon}>
                      <Text style={styles.assetIconText}>{asset.code.slice(0, 1)}</Text>
                    </View>
                    <View style={styles.assetIdentity}>
                      <Text style={styles.assetCode}>{asset.code}</Text>
                      <Text numberOfLines={1} style={styles.assetIssuer}>
                        {asset.issuer}
                      </Text>
                      <Text style={styles.balance}>Balance {line.balance}</Text>
                      <Text style={styles.limitText}>Limit {line.limit ?? 'Unavailable'}</Text>
                    </View>
                    <View style={styles.assetActions}>
                      <Pressable
                        disabled={building}
                        onPress={() => {
                          setError(undefined);
                          setLimitEditor({
                            code: asset.code,
                            issuer: asset.issuer,
                            ...(line.limit === undefined ? {} : { currentLimit: line.limit }),
                            value: line.limit ?? '',
                          });
                        }}
                        style={({ pressed }) => [
                          styles.limitButton,
                          building ? styles.disabled : undefined,
                          pressed ? styles.pressed : undefined,
                        ]}
                      >
                        <Text style={styles.limitButtonText}>Set limit</Text>
                      </Pressable>
                      <Pressable
                        disabled={building}
                        onPress={() => void prepare('remove', asset.code, asset.issuer)}
                        style={({ pressed }) => [
                          styles.removeButton,
                          building ? styles.disabled : undefined,
                          pressed ? styles.pressed : undefined,
                        ]}
                      >
                        <Text style={styles.removeText}>Remove</Text>
                      </Pressable>
                    </View>
                  </View>
                  {editingLimit && limitEditor ? (
                    <View style={styles.limitEditor}>
                      <Text style={styles.limitEditorTitle}>Set {asset.code} trustline limit</Text>
                      <Text style={styles.limitEditorMeta}>
                        Current limit: {limitEditor.currentLimit ?? 'Unavailable'}
                      </Text>
                      <TextInput
                        autoCorrect={false}
                        editable={!building}
                        keyboardType="decimal-pad"
                        onChangeText={value => setLimitEditor(current => current ? { ...current, value } : current)}
                        placeholder="New positive limit"
                        placeholderTextColor={theme.colors.textTertiary}
                        style={styles.input}
                        value={limitEditor.value}
                      />
                      <Text style={styles.helperText}>
                        The resulting limit must be at least the current balance plus buying liabilities. Fresnica
                        rechecks that ledger state before signing.
                      </Text>
                      <View style={styles.limitEditorActions}>
                        <Pressable
                          disabled={building}
                          onPress={() => {
                            setLimitEditor(undefined);
                            setError(undefined);
                          }}
                          style={({ pressed }) => [styles.cancelLimitButton, pressed ? styles.pressed : undefined]}
                        >
                          <Text style={styles.cancelLimitText}>Cancel</Text>
                        </Pressable>
                        <Pressable
                          disabled={building || limitEditor.value.trim().length === 0}
                          onPress={() =>
                            void prepare('set-limit', asset.code, asset.issuer, limitEditor.value)
                          }
                          style={({ pressed }) => [
                            styles.reviewLimitButton,
                            building || limitEditor.value.trim().length === 0 ? styles.disabled : undefined,
                            pressed ? styles.pressed : undefined,
                          ]}
                        >
                          {building ? (
                            <ActivityIndicator color={theme.colors.onActionPrimary} />
                          ) : (
                            <Text style={styles.reviewLimitText}>Review limit</Text>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  ) : null}
                </React.Fragment>
              );
            })
          )}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </Screen>
  );
}

function Header({
  title,
  onBack,
  disabled = false,
}: Readonly<{ title: string; onBack: () => void; disabled?: boolean }>) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.header}>
      <Pressable accessibilityLabel="Back" disabled={disabled} onPress={onBack} style={styles.backButton}>
        <Text style={styles.backGlyph}>‹</Text>
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

function MessageScreen({
  title,
  message,
  onBack,
  loading = false,
}: Readonly<{ title: string; message: string; onBack: () => void; loading?: boolean }>) {
  const theme = useAppTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <Screen scrollable={false} contentInset="none">
      <Header title="Manage assets" onBack={onBack} />
      <View style={styles.messageBody}>
        {loading ? (
          <ActivityIndicator color={theme.colors.actionPrimary} />
        ) : (
          <View style={styles.messageIcon}>
            <Text style={styles.messageGlyph}>!</Text>
          </View>
        )}
        <Text style={styles.messageTitle}>{title}</Text>
        <Text style={styles.messageText}>{message}</Text>
      </View>
    </Screen>
  );
}

function ReviewRow({ label, value, mono = false }: Readonly<{ label: string; value: string; mono?: boolean }>) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text numberOfLines={mono ? 2 : 3} selectable style={[styles.reviewValue, mono ? styles.mono : undefined]}>
        {value}
      </Text>
    </View>
  );
}

function reviewActionLabel(operation: TrustlineReview['operation']): string {
  switch (operation) {
    case 'add':
      return 'ADD TRUSTLINE';
    case 'set-limit':
      return 'SET TRUSTLINE LIMIT';
    case 'remove':
      return 'REMOVE TRUSTLINE';
  }
}

function resultTitle(result: TrustlineSubmissionResult): string {
  switch (result.status) {
    case 'submitted':
      return 'Asset change submitted';
    case 'rejected':
      return 'Transaction rejected';
    case 'uncertain':
      return 'Status uncertain';
    case 'authorization-blocked':
      return 'Authorization blocked';
    case 'unsupported-signer':
      return 'Signer unsupported';
    case 'watch-only':
      return 'Watch-only account';
    case 'unsupported-account-signers':
      return 'Multiple signers not supported yet';
    case 'passphrase-required':
      return 'App passphrase required';
  }
}

function resultDescription(result: TrustlineSubmissionResult): string {
  switch (result.status) {
    case 'submitted':
      return `Accepted as ${result.hash}${result.ledger === undefined ? '' : ` in ledger ${result.ledger}`}. Return to Wallet to refresh asset state.`;
    case 'rejected':
      return `Horizon deterministically rejected ${result.transactionHash}${result.resultCode ? ` (${result.resultCode})` : ''}.`;
    case 'uncertain':
      return `The network outcome for ${result.transactionHash} is uncertain. Verify the hash before retrying.`;
    case 'authorization-blocked':
      return `Current ledger authorization cannot satisfy the medium threshold (${result.availableWeight}/${result.requiredWeight}).`;
    case 'unsupported-signer':
      return 'The attached signer is not a supported protected software signer.';
    case 'watch-only':
      return 'This account has no attached local signer, so Fresnica will not execute ChangeTrust.';
    case 'unsupported-account-signers':
      return 'This account has multiple attached local signers. Multisig coordination is a later milestone, so Fresnica fails closed.';
    case 'passphrase-required':
      return 'Enter the current app passphrase on the review screen.';
  }
}

function readableError(error: unknown): string {
  return projectFeatureError(error, {fallbackMessage: 'Unable to manage this asset.'}).message;
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    backButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
    backGlyph: { fontSize: 36, lineHeight: 38, fontWeight: '300', color: theme.colors.secondary },
    headerTitle: { fontSize: 18, lineHeight: 22, fontWeight: '800', color: theme.colors.textPrimary },
    headerSpacer: { width: 42 },
    manageContent: { paddingBottom: 36 },
    accountCaption: { paddingHorizontal: 18, paddingTop: 14, fontSize: 11, color: theme.colors.textTertiary },
    sectionLabel: {
      paddingHorizontal: 18,
      paddingTop: 22,
      paddingBottom: 8,
      fontSize: 10,
      lineHeight: 13,
      color: theme.colors.textTertiary,
      fontWeight: '800',
    },
    addBlock: { paddingHorizontal: 18, gap: 9 },
    input: {
      minHeight: 52,
      borderRadius: 10,
      backgroundColor: theme.colors.surfaceMuted,
      paddingHorizontal: 14,
      color: theme.colors.textPrimary,
      fontSize: 14,
    },
    issuerInput: { fontSize: 11, fontVariant: ['tabular-nums'] },
    helperText: { fontSize: 9, lineHeight: 14, color: theme.colors.textTertiary },
    primaryButton: {
      minHeight: 52,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.actionPrimary,
    },
    primaryButtonText: { fontSize: 14, color: theme.colors.onActionPrimary, fontWeight: '800' },
    disabled: { opacity: 0.45 },
    assetList: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border },
    assetRow: {
      minHeight: 76,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      paddingHorizontal: 18,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    assetIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceStrong,
    },
    assetIconText: { fontSize: 16, color: theme.colors.onSurfaceStrong, fontWeight: '800' },
    assetIdentity: { flex: 1, gap: 2 },
    assetCode: { fontSize: 14, lineHeight: 18, color: theme.colors.textPrimary, fontWeight: '800' },
    assetIssuer: { fontSize: 10, lineHeight: 13, color: theme.colors.textTertiary },
    balance: { fontSize: 10, lineHeight: 13, color: theme.colors.textSecondary },
    limitText: { fontSize: 10, lineHeight: 13, color: theme.colors.textSecondary },
    assetActions: { alignItems: 'stretch', gap: 6 },
    limitButton: {
      minWidth: 72,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceMuted,
      paddingHorizontal: 10,
    },
    limitButtonText: { fontSize: 10, color: theme.colors.secondary, fontWeight: '800' },
    removeButton: {
      minWidth: 64,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceMuted,
      paddingHorizontal: 10,
    },
    removeText: { fontSize: 10, color: theme.colors.negative, fontWeight: '800' },
    limitEditor: {
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceMuted,
      gap: 8,
    },
    limitEditorTitle: { fontSize: 12, lineHeight: 16, color: theme.colors.textPrimary, fontWeight: '800' },
    limitEditorMeta: { fontSize: 10, lineHeight: 14, color: theme.colors.textSecondary },
    limitEditorActions: { flexDirection: 'row', gap: 9 },
    cancelLimitButton: {
      flex: 1,
      minHeight: 44,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
    },
    cancelLimitText: { fontSize: 12, color: theme.colors.secondary, fontWeight: '800' },
    reviewLimitButton: {
      flex: 1,
      minHeight: 44,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.actionPrimary,
    },
    reviewLimitText: { fontSize: 12, color: theme.colors.onActionPrimary, fontWeight: '800' },
    emptyAssets: { minHeight: 110, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 5 },
    emptyTitle: { fontSize: 14, color: theme.colors.textPrimary, fontWeight: '800' },
    emptyText: { fontSize: 10, lineHeight: 15, color: theme.colors.textSecondary, textAlign: 'center' },
    error: {
      marginHorizontal: 18,
      marginTop: 14,
      borderRadius: 9,
      padding: 12,
      backgroundColor: theme.colors.negativeMuted,
      color: theme.colors.negative,
      fontSize: 11,
      lineHeight: 16,
    },
    reviewContent: { paddingBottom: 28 },
    reviewHero: { alignItems: 'center', paddingHorizontal: 22, paddingTop: 28, paddingBottom: 24, gap: 6 },
    assetHeroIcon: {
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceStrong,
      marginBottom: 5,
    },
    assetHeroGlyph: { fontSize: 25, color: theme.colors.onSurfaceStrong, fontWeight: '800' },
    reviewAction: {
      fontSize: 9,
      lineHeight: 12,
      color: theme.colors.textTertiary,
      fontWeight: '800',
      letterSpacing: 0.7,
    },
    reviewAsset: { fontSize: 24, lineHeight: 29, color: theme.colors.textPrimary, fontWeight: '800' },
    reviewIssuer: { fontSize: 10, lineHeight: 14, color: theme.colors.textSecondary, textAlign: 'center' },
    rows: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border },
    reviewRow: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 18,
      paddingHorizontal: 18,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    reviewLabel: { fontSize: 12, lineHeight: 16, color: theme.colors.textSecondary, fontWeight: '600' },
    reviewValue: {
      flex: 1,
      fontSize: 12,
      lineHeight: 16,
      color: theme.colors.textPrimary,
      fontWeight: '600',
      textAlign: 'right',
    },
    mono: { fontSize: 10, lineHeight: 14, color: theme.colors.textSecondary, fontWeight: '400' },
    authNote: {
      marginHorizontal: 18,
      marginTop: 20,
      borderRadius: 11,
      backgroundColor: theme.colors.surfaceMuted,
      padding: 14,
      gap: 5,
    },
    authTitle: { fontSize: 12, lineHeight: 16, color: theme.colors.secondary, fontWeight: '800' },
    authText: { fontSize: 10, lineHeight: 15, color: theme.colors.textSecondary },
    passphraseBlock: { marginHorizontal: 18, marginTop: 18 },
    fieldLabel: { paddingBottom: 7, fontSize: 10, lineHeight: 13, color: theme.colors.textTertiary, fontWeight: '800' },
    bottomBar: {
      paddingHorizontal: 18,
      paddingTop: 10,
      paddingBottom: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    resultContent: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 30,
      paddingVertical: 40,
      gap: 10,
    },
    resultIcon: {
      width: 78,
      height: 78,
      borderRadius: 39,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 7,
    },
    resultPositive: { backgroundColor: theme.colors.positive },
    resultNegative: { backgroundColor: theme.colors.negative },
    resultUncertain: { backgroundColor: theme.colors.warning },
    resultGlyph: { fontSize: 34, color: theme.colors.onActionPrimary, fontWeight: '800' },
    resultTitle: {
      fontSize: 21,
      lineHeight: 26,
      color: theme.colors.textPrimary,
      fontWeight: '800',
      textAlign: 'center',
    },
    resultDescription: { fontSize: 12, lineHeight: 18, color: theme.colors.textSecondary, textAlign: 'center' },
    messageBody: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34, gap: 10 },
    messageIcon: {
      width: 58,
      height: 58,
      borderRadius: 29,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceMuted,
    },
    messageGlyph: { fontSize: 24, color: theme.colors.textSecondary, fontWeight: '800' },
    messageTitle: {
      fontSize: 18,
      lineHeight: 23,
      color: theme.colors.textPrimary,
      fontWeight: '800',
      textAlign: 'center',
    },
    messageText: { fontSize: 12, lineHeight: 18, color: theme.colors.textSecondary, textAlign: 'center' },
    pressed: { opacity: 0.68 },
  });
}
