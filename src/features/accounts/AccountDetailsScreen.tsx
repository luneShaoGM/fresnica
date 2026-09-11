import React, {useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';

import {AppModal, Button, Field, Screen} from '@ui/components';

import type {AccountRecord} from '../../capabilities/account/types';
import {useLocalization} from '../../locale';
import {useThemedStyles, type AppTheme} from '@ui/theme';

type Props = Readonly<{
  account: AccountRecord;
  canHide: boolean;
  onSend: () => void;
  onManageAssets: () => void;
  onRename: (label: string) => void | Promise<void>;
  onToggleHidden: () => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  onBack: () => void;
}>;

type DeleteError = 'pending' | 'visible-required' | 'generic';

export function AccountDetailsScreen({
  account,
  canHide,
  onSend,
  onManageAssets,
  onRename,
  onToggleHidden,
  onDelete,
  onBack,
}: Props) {
  const {t} = useLocalization();
  const styles = useThemedStyles(createStyles);
  const [renameVisible, setRenameVisible] = useState(false);
  const [draftLabel, setDraftLabel] = useState(account.label);
  const [renameState, setRenameState] = useState<'idle' | 'saving' | 'error'>('idle');
  const [visibilityState, setVisibilityState] = useState<'idle' | 'saving' | 'error'>('idle');
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleteState, setDeleteState] = useState<'idle' | 'deleting'>('idle');
  const [deleteError, setDeleteError] = useState<DeleteError | undefined>();

  const openRename = () => {
    setDraftLabel(account.label);
    setRenameState('idle');
    setRenameVisible(true);
  };

  const closeRename = () => {
    if (renameState === 'saving') return;
    setRenameVisible(false);
    setRenameState('idle');
  };

  const saveRename = async () => {
    if (renameState === 'saving') return;
    setRenameState('saving');
    try {
      await onRename(draftLabel);
      setRenameVisible(false);
      setRenameState('idle');
    } catch {
      setRenameState('error');
    }
  };

  const toggleHidden = async () => {
    if (visibilityState === 'saving') return;
    setVisibilityState('saving');
    try {
      await onToggleHidden();
      setVisibilityState('idle');
    } catch {
      setVisibilityState('error');
    }
  };

  const openDelete = () => {
    setDeleteError(undefined);
    setDeleteState('idle');
    setDeleteVisible(true);
  };

  const closeDelete = () => {
    if (deleteState === 'deleting') return;
    setDeleteVisible(false);
    setDeleteError(undefined);
  };

  const confirmDelete = async () => {
    if (deleteState === 'deleting') return;
    setDeleteState('deleting');
    setDeleteError(undefined);
    try {
      await onDelete();
    } catch (error) {
      setDeleteState('idle');
      setDeleteError(resolveDeleteError(error));
    }
  };

  return (
    <Screen scrollable={false} contentInset="none">
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Account</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.identityBlock}>
          <View style={styles.accountIcon}><Text style={styles.accountIconText}>{(account.label || 'S').slice(0, 1).toUpperCase()}</Text></View>
          <Text style={styles.accountLabel}>{account.label || 'Stellar account'}</Text>
          <Button label={t('accounts.rename.open')} onPress={openRename} variant="ghost" />
          <Text selectable style={styles.address}>{account.address}</Text>
        </View>

        <View style={styles.section}>
          <DetailRow label="Identity" value={account.identityKind} styles={styles} />
          <DetailRow label="Network" value={account.networkId} styles={styles} />
          <DetailRow label="Visibility" value={account.hidden ? 'Hidden' : 'Visible'} styles={styles} />
        </View>

        {!account.hidden ? (
          <>
            <Text style={styles.sectionLabel}>Wallet actions</Text>
            <View style={styles.actionRow}>
              <Pressable onPress={onSend} style={({pressed}) => [styles.primaryAction, pressed ? styles.pressed : undefined]}>
                <Text style={styles.primaryActionText}>Send</Text>
              </Pressable>
              <Pressable onPress={onManageAssets} style={({pressed}) => [styles.secondaryAction, pressed ? styles.pressed : undefined]}>
                <Text style={styles.secondaryActionText}>Manage assets</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        <Text style={styles.sectionLabel}>{t('accounts.localActions')}</Text>
        <View style={styles.actionRow}>
          <Button
            disabled={visibilityState === 'saving' || (!account.hidden && !canHide)}
            label={
              visibilityState === 'saving'
                ? t('accounts.visibility.saving')
                : account.hidden
                  ? t('accounts.visibility.restore')
                  : t('accounts.visibility.hide')
            }
            onPress={toggleHidden}
            variant="secondary"
          />
          {!account.hidden && !canHide ? (
            <Text style={styles.lifecycleNote}>{t('accounts.visibility.lastVisible')}</Text>
          ) : null}
          {visibilityState === 'error' ? (
            <Text accessibilityLiveRegion="polite" style={styles.lifecycleError}>
              {t('accounts.visibility.error')}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={openDelete}
            style={({pressed}) => [styles.deleteAction, pressed ? styles.pressed : undefined]}>
            <Text style={styles.deleteActionText}>{t('accounts.delete.open')}</Text>
          </Pressable>
        </View>

        <Text style={styles.note}>
          Signer access is derived from Fresnica Account-Signer relationships. Ledger balances and trustlines remain network state and are not stored as account identity truth.
        </Text>
      </ScrollView>

      <AppModal
        description={t('accounts.rename.description')}
        onRequestClose={closeRename}
        title={t('accounts.rename.title')}
        visible={renameVisible}>
        <View style={styles.renameContent}>
          <Field
            accessibilityLabel={t('accounts.rename.field')}
            autoCapitalize="sentences"
            label={t('accounts.rename.field')}
            onChangeText={setDraftLabel}
            placeholder={t('accounts.rename.placeholder')}
            value={draftLabel}
          />
          {renameState === 'error' ? (
            <Text accessibilityLiveRegion="polite" style={styles.renameError}>
              {t('accounts.rename.error')}
            </Text>
          ) : null}
          <View style={styles.renameActions}>
            <Button disabled={renameState === 'saving'} label={t('accounts.rename.cancel')} onPress={closeRename} variant="secondary" />
            <Button disabled={renameState === 'saving'} label={renameState === 'saving' ? t('accounts.rename.saving') : t('accounts.rename.save')} onPress={saveRename} />
          </View>
        </View>
      </AppModal>

      <AppModal
        description={t('accounts.delete.description')}
        onRequestClose={closeDelete}
        title={t('accounts.delete.title')}
        visible={deleteVisible}>
        <View style={styles.renameContent}>
          {deleteError ? (
            <Text accessibilityLiveRegion="polite" style={styles.lifecycleError}>
              {t(deleteErrorKey(deleteError))}
            </Text>
          ) : null}
          <View style={styles.renameActions}>
            <Button disabled={deleteState === 'deleting'} label={t('accounts.delete.cancel')} onPress={closeDelete} variant="secondary" />
            <Pressable
              accessibilityRole="button"
              disabled={deleteState === 'deleting'}
              onPress={confirmDelete}
              style={({pressed}) => [styles.deleteConfirm, pressed && deleteState !== 'deleting' ? styles.pressed : undefined, deleteState === 'deleting' ? styles.disabled : undefined]}>
              <Text style={styles.deleteConfirmText}>{deleteState === 'deleting' ? t('accounts.delete.deleting') : t('accounts.delete.confirm')}</Text>
            </Pressable>
          </View>
        </View>
      </AppModal>
    </Screen>
  );
}

function resolveDeleteError(error: unknown): DeleteError {
  if (error instanceof Error && error.message === 'account-delete-blocked-by-pending-submission') return 'pending';
  if (error instanceof Error && error.message === 'account-delete-requires-visible-account') return 'visible-required';
  return 'generic';
}

function deleteErrorKey(error: DeleteError): string {
  if (error === 'pending') return 'accounts.delete.pendingError';
  if (error === 'visible-required') return 'accounts.delete.visibleRequired';
  return 'accounts.delete.error';
}

type Styles = ReturnType<typeof createStyles>;

function DetailRow({label, value, styles}: Readonly<{label: string; value: string; styles: Styles}>) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text numberOfLines={2} selectable style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    header: {minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border},
    backButton: {width: 42, height: 42, alignItems: 'center', justifyContent: 'center'},
    backGlyph: {fontSize: 36, lineHeight: 38, fontWeight: '300', color: theme.colors.surfaceStrong},
    title: {fontSize: 18, lineHeight: 22, fontWeight: '800', color: theme.colors.textPrimary},
    headerSpacer: {width: 42},
    content: {paddingBottom: 34},
    identityBlock: {alignItems: 'center', paddingHorizontal: 24, paddingTop: 28, paddingBottom: 24, gap: 8},
    accountIcon: {width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceStrong},
    accountIconText: {fontSize: 27, color: theme.colors.onSurfaceStrong, fontWeight: '800'},
    accountLabel: {fontSize: 20, lineHeight: 25, fontWeight: '800', color: theme.colors.textPrimary},
    address: {fontSize: 10, lineHeight: 15, color: theme.colors.textSecondary, textAlign: 'center', fontVariant: ['tabular-nums']},
    section: {borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border},
    detailRow: {minHeight: 55, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border, gap: 20},
    detailLabel: {fontSize: 13, lineHeight: 17, color: theme.colors.textPrimary, fontWeight: '600'},
    detailValue: {flex: 1, fontSize: 12, lineHeight: 16, color: theme.colors.textSecondary, textAlign: 'right'},
    sectionLabel: {paddingHorizontal: 18, paddingTop: 24, paddingBottom: 8, fontSize: 11, color: theme.colors.textTertiary, fontWeight: '700'},
    actionRow: {paddingHorizontal: 18, gap: 10},
    primaryAction: {minHeight: 52, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.actionPrimary},
    primaryActionText: {fontSize: 15, color: theme.colors.onActionPrimary, fontWeight: '800'},
    secondaryAction: {minHeight: 52, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceMuted},
    secondaryActionText: {fontSize: 15, color: theme.colors.surfaceStrong, fontWeight: '800'},
    deleteAction: {minHeight: 52, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.negative},
    deleteActionText: {fontSize: 15, color: theme.colors.negative, fontWeight: '800'},
    deleteConfirm: {minHeight: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.negative},
    deleteConfirmText: {fontSize: 15, color: theme.colors.onActionPrimary, fontWeight: '800'},
    lifecycleNote: {...theme.typography.caption, color: theme.colors.textTertiary},
    lifecycleError: {...theme.typography.body, color: theme.colors.negative},
    note: {paddingHorizontal: 22, paddingTop: 18, fontSize: 10, lineHeight: 15, color: theme.colors.textTertiary, textAlign: 'center'},
    renameContent: {gap: theme.spacing.md},
    renameActions: {gap: theme.spacing.sm},
    renameError: {...theme.typography.body, color: theme.colors.negative},
    pressed: {opacity: 0.68},
    disabled: {opacity: 0.45},
  });
}
