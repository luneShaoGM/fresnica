import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Screen } from '@ui/components';

import type { AccountRecord } from '../../capabilities/account/types';
import { loadBalanceSnapshot } from '../../capabilities/balance/loadBalanceSnapshot';
import type { BalanceLine } from '../../capabilities/balance/types';
import type { TrustlineReview } from '../../capabilities/trustline/buildTrustlineReview';
import type { TrustlineAction } from '../../capabilities/trustline/prepareTrustline';
import { useLocalization, type LocalizationRuntime } from '../../locale';
import { useAppTheme, useThemedStyles } from '../../ui/theme';
import { SlideToConfirm } from '../../ui/SlideToConfirm';
import { projectFeatureError } from '../featureError';
import {
  prepareTrustlineProductReview,
  submitTrustlineProductReview,
  type TrustlineProductDependencies,
  type TrustlineSubmissionResult,
} from './trustlineProductFlow';
import { createManageAssetsStyles } from './styles';

type Translate = LocalizationRuntime['t'];

type LoadState =
  | Readonly<{ kind: 'loading' }>
  | Readonly<{ kind: 'inactive' }>
  | Readonly<{ kind: 'unsupported-account' }>
  | Readonly<{ kind: 'error' }>
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
  const { t } = useLocalization();
  const theme = useAppTheme();
  const styles = useThemedStyles(createManageAssetsStyles);
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
          setLoadState({ kind: 'inactive' });
          return;
        }
        if (snapshot.status === 'unsupported-account') {
          setLoadState({ kind: 'unsupported-account' });
          return;
        }

        setLoadState({
          kind: 'ready',
          trustlines: snapshot.balances.filter(line => line.asset.kind === 'credit'),
        });
      })
      .catch(() => {
        if (loadVersion.current === version) {
          setLoadState({ kind: 'error' });
          AccessibilityInfo.announceForAccessibility(t('trustlines.load.errorAnnouncement'));
        }
      });
  }, [account, dependencies.gateway, dependencies.network.id, t]);

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
        const message = readableError(caught, t);
        setError(message);
        AccessibilityInfo.announceForAccessibility(message);
      } finally {
        setBuilding(false);
      }
    },
    [account, dependencies, t],
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
        AccessibilityInfo.announceForAccessibility(t('trustlines.authorization.passphraseRequired'));
        return;
      }
      setFlow({ kind: 'result', result });
    } catch (caught) {
      const message = readableError(caught, t);
      setError(message);
      AccessibilityInfo.announceForAccessibility(message);
    } finally {
      setSubmitting(false);
    }
  }, [account, appPassphrase, dependencies, flow, passphraseRequired, t]);

  if (loadState.kind === 'loading') {
    return (
      <MessageScreen
        backLabel={t('common.back')}
        headerTitle={t('trustlines.title')}
        loading
        message={t('trustlines.loading.message')}
        onBack={onDone}
        title={t('trustlines.loading.title')}
      />
    );
  }

  if (loadState.kind === 'inactive') {
    return (
      <MessageScreen
        backLabel={t('common.back')}
        headerTitle={t('trustlines.title')}
        message={t('trustlines.inactive.message')}
        onBack={onDone}
        title={t('trustlines.inactive.title')}
      />
    );
  }

  if (loadState.kind === 'unsupported-account') {
    return (
      <MessageScreen
        backLabel={t('common.back')}
        headerTitle={t('trustlines.title')}
        message={t('trustlines.unsupported.message')}
        onBack={onDone}
        title={t('trustlines.unsupported.title')}
      />
    );
  }

  if (loadState.kind === 'error') {
    return (
      <MessageScreen
        actionLabel={t('trustlines.retry')}
        backLabel={t('common.back')}
        headerTitle={t('trustlines.title')}
        message={t('trustlines.load.errorMessage')}
        onAction={loadTrustlines}
        onBack={onDone}
        title={t('trustlines.load.errorTitle')}
      />
    );
  }

  if (flow.kind === 'review') {
    const review = flow.review;
    return (
      <Screen scrollable={false} contentInset="none">
        <Header
          backLabel={t('common.back')}
          title={t('trustlines.review.title')}
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
            <Text style={styles.reviewAction}>{reviewActionLabel(review.operation, t)}</Text>
            <Text style={styles.reviewAsset}>{review.asset.code}</Text>
            <Text numberOfLines={2} selectable style={styles.reviewIssuer}>
              {review.asset.issuer}
            </Text>
          </View>

          <View style={styles.rows}>
            <ReviewRow label={t('trustlines.review.source')} value={review.source} mono />
            <ReviewRow
              label={t('trustlines.review.resultingLimit')}
              value={review.limit ?? t('trustlines.review.removeLimit')}
            />
            <ReviewRow
              label={t('trustlines.review.fee')}
              value={t('trustlines.review.feeValue', { fee: review.fee })}
            />
            {review.expectedAuthorization ? (
              <ReviewRow label={t('trustlines.review.expectedAuthorization')} value={review.expectedAuthorization} />
            ) : null}
            {review.expectedClawbackEnabled === undefined ? null : (
              <ReviewRow
                label={t('trustlines.review.expectedClawback')}
                value={t(review.expectedClawbackEnabled ? 'trustlines.state.enabled' : 'trustlines.state.disabled')}
              />
            )}
          </View>

          <View style={styles.authNote}>
            <Text style={styles.authTitle}>{t('trustlines.authorization.title')}</Text>
            <Text style={styles.authText}>{t('trustlines.authorization.description')}</Text>
          </View>

          {passphraseRequired ? (
            <View style={styles.passphraseBlock}>
              <Text style={styles.passphrasePrompt}>{t('trustlines.authorization.passphraseRequired')}</Text>
              <Text style={styles.fieldLabel}>{t('trustlines.authorization.appPassphrase')}</Text>
              <TextInput
                accessibilityHint={t('trustlines.authorization.passphraseHint')}
                accessibilityLabel={t('trustlines.authorization.appPassphrase')}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                editable={!submitting}
                onChangeText={setAppPassphrase}
                placeholder={t('trustlines.authorization.appPassphrasePlaceholder')}
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
            label={t(
              passphraseRequired
                ? 'trustlines.authorization.slideToAuthorize'
                : 'trustlines.authorization.slideToConfirm',
            )}
            loading={submitting}
            loadingLabel={t('trustlines.authorization.submitting')}
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
          <Text accessibilityRole="header" style={styles.resultTitle}>
            {resultTitle(flow.result, t)}
          </Text>
          <Text style={styles.resultDescription}>{resultDescription(flow.result, t)}</Text>
        </ScrollView>
        <View style={styles.bottomBar}>
          <Pressable
            accessibilityLabel={t('trustlines.result.backToWallet')}
            accessibilityRole="button"
            onPress={onDone}
            style={({ pressed }) => [styles.primaryButton, pressed ? styles.pressed : undefined]}
          >
            <Text style={styles.primaryButtonText}>{t('trustlines.result.backToWallet')}</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scrollable={false} contentInset="none">
      <Header backLabel={t('common.back')} title={t('trustlines.title')} onBack={onDone} />
      <ScrollView
        contentContainerStyle={styles.manageContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text numberOfLines={1} style={styles.accountCaption}>
          {account.label || account.address}
        </Text>

        <Text accessibilityRole="header" style={styles.sectionLabel}>
          {t('trustlines.add.section')}
        </Text>
        <View style={styles.addBlock}>
          <TextInput
            accessibilityLabel={t('trustlines.add.assetCode')}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!building}
            onChangeText={setAssetCode}
            placeholder={t('trustlines.add.assetCodePlaceholder')}
            placeholderTextColor={theme.colors.textTertiary}
            style={styles.input}
            value={assetCode}
          />
          <TextInput
            accessibilityLabel={t('trustlines.add.issuer')}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!building}
            onChangeText={setAssetIssuer}
            placeholder={t('trustlines.add.issuerPlaceholder')}
            placeholderTextColor={theme.colors.textTertiary}
            style={[styles.input, styles.issuerInput]}
            value={assetIssuer}
          />
          <Text style={styles.helperText}>{t('trustlines.add.helper')}</Text>
          <Pressable
            accessibilityLabel={t('trustlines.add.review')}
            accessibilityRole="button"
            accessibilityState={{
              disabled: building || assetCode.trim().length === 0 || assetIssuer.trim().length === 0,
            }}
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
              <Text style={styles.primaryButtonText}>{t('trustlines.add.review')}</Text>
            )}
          </Pressable>
        </View>

        <Text accessibilityRole="header" style={styles.sectionLabel}>
          {t('trustlines.assets.section')}
        </Text>
        <View style={styles.assetList}>
          {loadState.trustlines.length === 0 ? (
            <View style={styles.emptyAssets}>
              <Text accessibilityRole="header" style={styles.emptyTitle}>
                {t('trustlines.assets.emptyTitle')}
              </Text>
              <Text style={styles.emptyText}>{t('trustlines.assets.emptyMessage')}</Text>
            </View>
          ) : (
            loadState.trustlines.map(line => {
              const asset = line.asset;
              if (asset.kind !== 'credit') {
                return null;
              }
              const editingLimit = limitEditor?.code === asset.code && limitEditor.issuer === asset.issuer;
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
                      <Text style={styles.balance}>{t('trustlines.asset.balance', { balance: line.balance })}</Text>
                      <Text style={styles.limitText}>
                        {t('trustlines.asset.limit', {
                          limit: line.limit ?? t('trustlines.value.unavailable'),
                        })}
                      </Text>
                    </View>
                    <View style={styles.assetActions}>
                      <Pressable
                        accessibilityLabel={t('trustlines.asset.setLimitAccessibility', {
                          code: asset.code,
                        })}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: building }}
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
                        <Text style={styles.limitButtonText}>{t('trustlines.asset.setLimit')}</Text>
                      </Pressable>
                      <Pressable
                        accessibilityLabel={t('trustlines.asset.removeAccessibility', {
                          code: asset.code,
                        })}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: building }}
                        disabled={building}
                        onPress={() => void prepare('remove', asset.code, asset.issuer)}
                        style={({ pressed }) => [
                          styles.removeButton,
                          building ? styles.disabled : undefined,
                          pressed ? styles.pressed : undefined,
                        ]}
                      >
                        <Text style={styles.removeText}>{t('trustlines.asset.remove')}</Text>
                      </Pressable>
                    </View>
                  </View>
                  {editingLimit && limitEditor ? (
                    <View style={styles.limitEditor}>
                      <Text accessibilityRole="header" style={styles.limitEditorTitle}>
                        {t('trustlines.limit.title', { code: asset.code })}
                      </Text>
                      <Text style={styles.limitEditorMeta}>
                        {t('trustlines.limit.current', {
                          limit: limitEditor.currentLimit ?? t('trustlines.value.unavailable'),
                        })}
                      </Text>
                      <TextInput
                        accessibilityLabel={t('trustlines.limit.inputLabel', { code: asset.code })}
                        autoCorrect={false}
                        editable={!building}
                        keyboardType="decimal-pad"
                        onChangeText={value => setLimitEditor(current => (current ? { ...current, value } : current))}
                        placeholder={t('trustlines.limit.placeholder')}
                        placeholderTextColor={theme.colors.textTertiary}
                        style={styles.input}
                        value={limitEditor.value}
                      />
                      <Text style={styles.helperText}>{t('trustlines.limit.helper')}</Text>
                      <View style={styles.limitEditorActions}>
                        <Pressable
                          accessibilityLabel={t('trustlines.limit.cancel')}
                          accessibilityRole="button"
                          accessibilityState={{ disabled: building }}
                          disabled={building}
                          onPress={() => {
                            setLimitEditor(undefined);
                            setError(undefined);
                          }}
                          style={({ pressed }) => [styles.cancelLimitButton, pressed ? styles.pressed : undefined]}
                        >
                          <Text style={styles.cancelLimitText}>{t('trustlines.limit.cancel')}</Text>
                        </Pressable>
                        <Pressable
                          accessibilityLabel={t('trustlines.limit.review')}
                          accessibilityRole="button"
                          accessibilityState={{
                            disabled: building || limitEditor.value.trim().length === 0,
                          }}
                          disabled={building || limitEditor.value.trim().length === 0}
                          onPress={() => void prepare('set-limit', asset.code, asset.issuer, limitEditor.value)}
                          style={({ pressed }) => [
                            styles.reviewLimitButton,
                            building || limitEditor.value.trim().length === 0 ? styles.disabled : undefined,
                            pressed ? styles.pressed : undefined,
                          ]}
                        >
                          {building ? (
                            <ActivityIndicator color={theme.colors.onActionPrimary} />
                          ) : (
                            <Text style={styles.reviewLimitText}>{t('trustlines.limit.review')}</Text>
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
  backLabel,
  disabled = false,
}: Readonly<{ title: string; onBack: () => void; backLabel: string; disabled?: boolean }>) {
  const styles = useThemedStyles(createManageAssetsStyles);

  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel={backLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onBack}
        style={styles.backButton}
      >
        <Text style={styles.backGlyph}>‹</Text>
      </Pressable>
      <Text accessibilityRole="header" style={styles.headerTitle}>
        {title}
      </Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

function MessageScreen({
  title,
  message,
  headerTitle,
  backLabel,
  onBack,
  actionLabel,
  onAction,
  loading = false,
}: Readonly<{
  title: string;
  message: string;
  headerTitle: string;
  backLabel: string;
  onBack: () => void;
  actionLabel?: string;
  onAction?: () => void;
  loading?: boolean;
}>) {
  const theme = useAppTheme();
  const styles = useThemedStyles(createManageAssetsStyles);

  return (
    <Screen scrollable={false} contentInset="none">
      <Header backLabel={backLabel} title={headerTitle} onBack={onBack} />
      <View style={styles.messageBody}>
        {loading ? (
          <ActivityIndicator
            accessibilityLabel={message}
            accessibilityRole="progressbar"
            color={theme.colors.actionPrimary}
          />
        ) : (
          <View accessible={false} style={styles.messageIcon}>
            <Text style={styles.messageGlyph}>!</Text>
          </View>
        )}
        <Text accessibilityRole="header" style={styles.messageTitle}>
          {title}
        </Text>
        <Text style={styles.messageText}>{message}</Text>
        {actionLabel && onAction ? (
          <Pressable
            accessibilityLabel={actionLabel}
            accessibilityRole="button"
            onPress={onAction}
            style={({ pressed }) => [styles.messageAction, pressed ? styles.pressed : undefined]}
          >
            <Text style={styles.messageActionText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}

function ReviewRow({ label, value, mono = false }: Readonly<{ label: string; value: string; mono?: boolean }>) {
  const styles = useThemedStyles(createManageAssetsStyles);

  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text numberOfLines={mono ? 2 : 3} selectable style={[styles.reviewValue, mono ? styles.mono : undefined]}>
        {value}
      </Text>
    </View>
  );
}

function reviewActionLabel(operation: TrustlineReview['operation'], t: Translate): string {
  switch (operation) {
    case 'add':
      return t('trustlines.review.action.add');
    case 'set-limit':
      return t('trustlines.review.action.setLimit');
    case 'remove':
      return t('trustlines.review.action.remove');
  }
}

function resultTitle(result: TrustlineSubmissionResult, t: Translate): string {
  return t(`trustlines.result.${result.status}.title`);
}

function resultDescription(result: TrustlineSubmissionResult, t: Translate): string {
  switch (result.status) {
    case 'submitted':
      return result.ledger === undefined
        ? t('trustlines.result.submitted.description', { hash: result.hash })
        : t('trustlines.result.submitted.descriptionWithLedger', {
            hash: result.hash,
            ledger: result.ledger,
          });
    case 'rejected':
      return result.resultCode
        ? t('trustlines.result.rejected.descriptionWithCode', {
            hash: result.transactionHash,
            resultCode: result.resultCode,
          })
        : t('trustlines.result.rejected.description', {
            hash: result.transactionHash,
          });
    case 'uncertain':
      return t('trustlines.result.uncertain.description', {
        hash: result.transactionHash,
      });
    case 'authorization-blocked':
      return t('trustlines.result.authorization-blocked.description', {
        availableWeight: result.availableWeight,
        requiredWeight: result.requiredWeight,
      });
    case 'unsupported-signer':
      return t('trustlines.result.unsupported-signer.description');
    case 'watch-only':
      return t('trustlines.result.watch-only.description');
    case 'unsupported-account-signers':
      return t('trustlines.result.unsupported-account-signers.description');
    case 'passphrase-required':
      return t('trustlines.result.passphrase-required.description');
  }
}

const TRUSTLINE_ERROR_KEYS: Readonly<Record<string, string>> = {
  'invalid-passcode': 'trustlines.error.invalidPassphrase',
  'invalid-passphrase': 'trustlines.error.invalidPassphrase',
  'protected-signer-envelope-missing': 'trustlines.error.protectedSignerMissing',
  'user-cancel': 'trustlines.error.userCancel',
  'system-auth-unavailable': 'trustlines.error.systemAuthUnavailable',
  'system-auth-not-enrolled': 'trustlines.error.systemAuthNotEnrolled',
  'system-auth-invalidated': 'trustlines.error.systemAuthInvalidated',
  'system-auth-failed': 'trustlines.error.systemAuthFailed',
  'auth-in-progress': 'trustlines.error.authInProgress',
  timeout: 'trustlines.error.timeout',
  'review-expired': 'trustlines.error.reviewExpired',
  'invalid-trustline-limit': 'trustlines.error.invalidLimit',
  'trustline-limit-below-commitment': 'trustlines.error.limitBelowCommitment',
  'trustline-not-found': 'trustlines.error.notFound',
  'trustline-already-exists': 'trustlines.error.alreadyExists',
  'trustline-issuer-account-inactive': 'trustlines.error.issuerInactive',
  'trustline-issuer-cannot-trust-own-asset': 'trustlines.error.ownAsset',
  'trustline-source-account-inactive': 'trustlines.error.sourceInactive',
  'trustline-remove-nonzero-balance-or-liabilities': 'trustlines.error.removeNonzero',
  'invalid-trustline-asset-code': 'trustlines.error.invalidAsset',
  'invalid-trustline-asset-issuer': 'trustlines.error.invalidAsset',
  'trustline-network-mismatch': 'trustlines.error.contextChanged',
  'trustline-requires-classic-account': 'trustlines.error.classicOnly',
  'invalid-ledger-reserve-or-fee': 'trustlines.error.ledgerData',
  'trustline-insufficient-xlm-for-reserve-and-fee': 'trustlines.error.insufficientXlm',
  'trustline-remove-used-by-liquidity-pool': 'trustlines.error.liquidityPool',
  'trustline-review-operation-state-changed': 'trustlines.error.stateChanged',
  'trustline-review-limit-state-changed': 'trustlines.error.stateChanged',
  'trustline-review-authorization-state-changed': 'trustlines.error.stateChanged',
  'trustline-review-clawback-state-changed': 'trustlines.error.stateChanged',
  'trustline-built-transaction-context-mismatch': 'trustlines.error.contextChanged',
  'trustline-review-context-mismatch': 'trustlines.error.contextChanged',
  'trustline-review-account-mismatch': 'trustlines.error.contextChanged',
  'trustline-review-operation-xdr-mismatch': 'trustlines.error.contextChanged',
  'trustline-source-account-mismatch': 'trustlines.error.contextChanged',
  'trustline-issuer-account-mismatch': 'trustlines.error.contextChanged',
  'invalid-stellar-amount': 'trustlines.error.invalidLimit',
};

function readableError(error: unknown, t: Translate): string {
  const messages: Record<string, string> = {};
  for (const [code, key] of Object.entries(TRUSTLINE_ERROR_KEYS)) {
    messages[code] = t(key);
  }

  return projectFeatureError(error, {
    fallbackMessage: t('trustlines.error.generic'),
    messages,
  }).message;
}
