import { AccountAvatar } from '../contacts/AccountAvatar';
import React, {useEffect, useRef, useState} from 'react';
import {Pressable, ScrollView, Text, View} from 'react-native';

import {AppModal, Button, Field, Screen} from '@ui/components';
import {PassphrasePrompt} from '@ui/components/PassphrasePrompt/PassphrasePrompt';
import type {PassphraseInputHandle} from '@ui/components/PassphraseInput/PassphraseInput';

import type {AccountRecord} from '../../capabilities/account/types';
import {useLocalization} from '../../locale';
import { CopyAddressButton } from './CopyAddressButton';
import {useThemedStyles} from '@ui/theme';
import {createAccountDetailsStyles} from './styles';

type Props = Readonly<{
  account: AccountRecord;
  canHide: boolean;
  active?: boolean;
  onSend: () => void;
  onManageAssets: () => void;
  onRename: (label: string) => void | Promise<void>;
  onToggleHidden: () => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  canDowngrade: boolean;
  readOnly: boolean;
  onDowngrade: (passphrase: string, signal: AbortSignal) => Promise<void>;
  copyPublicText: (text: string) => Promise<void>;
  onOpenRecovery?: () => void;
  onBack: () => void;
}>;

type DeleteError = 'pending' | 'visible-required' | 'generic';

export function AccountDetailsScreen({
  account,
  canHide,
  active = true,
  onSend,
  onManageAssets,
  onRename,
  onToggleHidden,
  onDelete,
  canDowngrade,
  readOnly,
  onDowngrade,
  onBack,
  copyPublicText,
  onOpenRecovery,
}: Props) {
  const {t} = useLocalization();
  const styles = useThemedStyles(createAccountDetailsStyles);
  const [renameVisible, setRenameVisible] = useState(false);
  const [draftLabel, setDraftLabel] = useState(account.label);
  const [renameState, setRenameState] = useState<'idle' | 'saving' | 'error'>('idle');
  const [visibilityState, setVisibilityState] = useState<'idle' | 'saving' | 'error'>('idle');
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleteState, setDeleteState] = useState<'idle' | 'deleting'>('idle');
  const [deleteError, setDeleteError] = useState<DeleteError | undefined>();
  const [downgradeStep, setDowngradeStep] = useState<'closed' | 'warning' | 'passphrase' | 'busy'>('closed');
  const [downgradeError, setDowngradeError] = useState<string | undefined>();
  const [hasPassphrase, setHasPassphrase] = useState(false);
  const passphraseInput = useRef<PassphraseInputHandle>(null);
  const downgradeOwner = useRef<AbortController | null>(null);

  useEffect(() => {
    const field = passphraseInput.current;
    if (!active) {
      downgradeOwner.current?.abort();
      field?.clear();
      setDowngradeStep('closed');
    }
    return () => {
      downgradeOwner.current?.abort();
      field?.clear();
    };
  }, [active]);

  const cancelDowngrade = () => {
    downgradeOwner.current?.abort();
    downgradeOwner.current = null;
    passphraseInput.current?.clear();
    setDowngradeStep('closed');
    setDowngradeError(undefined);
  };

  const confirmDowngrade = async () => {
    if (downgradeStep !== 'passphrase' || downgradeOwner.current) return;
    const passphrase = passphraseInput.current?.consume();
    if (!passphrase) return;
    const owner = new AbortController();
    downgradeOwner.current = owner;
    setDowngradeStep('busy');
    setDowngradeError(undefined);
    try {
      await onDowngrade(passphrase, owner.signal);
      if (!owner.signal.aborted) setDowngradeStep('closed');
    } catch (error) {
      if (!owner.signal.aborted) {
        setDowngradeError(error instanceof Error && error.message === 'invalid-passcode'
          ? t('accounts.downgrade.wrongPassphrase') : t('accounts.downgrade.error'));
        setDowngradeStep('passphrase');
      }
    } finally {
      if (downgradeOwner.current === owner) downgradeOwner.current = null;
    }
  };

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
        <Pressable
          accessibilityLabel={t('common.back')}
          accessibilityRole="button"
          onPress={onBack}
          style={styles.backButton}>
          <Text allowFontScaling={false} style={styles.backGlyph}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Account</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.identityBlock}>
          <AccountAvatar address={account.address} active={active} size={68} />
          <Text style={styles.accountLabel}>{account.label || 'Stellar account'}</Text>
          <Button label={t('accounts.rename.open')} onPress={openRename} variant="ghost" />
          <CopyAddressButton key={account.address} address={account.address} copyPublicText={copyPublicText} numberOfLines={0} addressStyle={styles.address} />
        </View>

        <View style={styles.section}>
          <DetailRow label="Identity" value={account.identityKind} styles={styles} />
          <DetailRow label="Network" value={account.networkId} styles={styles} />
          <DetailRow label="Visibility" value={account.hidden ? 'Hidden' : 'Visible'} styles={styles} />
        </View>

        {!account.hidden && !readOnly ? (
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

        {onOpenRecovery && !readOnly ? <View style={styles.actionRow}><Button label={t('recovery.title')} onPress={onOpenRecovery} variant="secondary" /></View> : null}
        <Text style={styles.sectionLabel}>{t('accounts.localActions')}</Text>
        <View style={styles.actionRow}>
          {readOnly || canDowngrade ? <Text style={styles.lifecycleNote}>{readOnly ? t('accounts.downgrade.readOnly') : t('accounts.downgrade.fullAccess')}</Text> : null}
          {canDowngrade ? <Button label={t('accounts.downgrade.open')} onPress={() => setDowngradeStep('warning')} variant="secondary" /> : null}
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
        visible={renameVisible}
        scrollable>
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
            <Button
              disabled={renameState === 'saving'}
              label={t('accounts.rename.cancel')}
              onPress={closeRename}
              variant="secondary"
            />
            <Button
              disabled={renameState === 'saving'}
              label={renameState === 'saving' ? t('accounts.rename.saving') : t('accounts.rename.save')}
              onPress={saveRename}
            />
          </View>
        </View>
      </AppModal>

      <AppModal
        title={t('accounts.downgrade.title')}
        description={t('accounts.downgrade.warning')}
        visible={downgradeStep === 'warning'}
        onRequestClose={cancelDowngrade}
        scrollable>
        <View style={styles.renameActions}>
          <Button label={t('accounts.downgrade.continue')} onPress={() => setDowngradeStep('passphrase')} />
          <Button label={t('accounts.delete.cancel')} onPress={cancelDowngrade} variant="secondary" />
        </View>
      </AppModal>
      <PassphrasePrompt
        visible={downgradeStep === 'passphrase' || downgradeStep === 'busy'}
        active={active}
        busy={downgradeStep === 'busy'}
        title={t('accounts.downgrade.title')}
        label={t('accounts.downgrade.passphrase')}
        hint={t('accounts.downgrade.passphraseHint')}
        confirmLabel={t('accounts.downgrade.confirm')}
        cancelLabel={t('accounts.delete.cancel')}
        inputRef={passphraseInput}
        hasValue={hasPassphrase}
        onPresenceChange={setHasPassphrase}
        onConfirm={confirmDowngrade}
        onCancel={cancelDowngrade}
        onExpire={cancelDowngrade}
        error={downgradeError}
      />

      <AppModal
        description={t('accounts.delete.description')}
        onRequestClose={closeDelete}
        title={t('accounts.delete.title')}
        visible={deleteVisible}
        scrollable>
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

type Styles = ReturnType<typeof createAccountDetailsStyles>;

function DetailRow({label, value, styles}: Readonly<{label: string; value: string; styles: Styles}>) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text numberOfLines={2} selectable style={styles.detailValue}>{value}</Text>
    </View>
  );
}
