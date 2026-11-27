import { AccountAvatar } from '../../contacts/AccountAvatar';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, Text, View } from 'react-native';

import type { AccountRecord } from '@capabilities/account/types';
import { useLocalization } from '../../../locale';
import { BottomSheet } from '@ui/components/BottomSheet';
import { NativeButton } from '@ui/components/NativeButton';
import { useThemedStyles } from '@ui/theme';

import { createStyles } from './AccountPickerSheet.styles';

type Props = Readonly<{
  accounts: readonly AccountRecord[];
  selectedAccountId: string;
  visible: boolean;
  active?: boolean;
  isWatchOnlyAccount: (accountId: string) => boolean;
  onAddAccount: () => void;
  onRequestClose: () => void;
  onSelectAccount: (accountId: string) => void | Promise<void>;
}>;

export function AccountPickerSheet({
  accounts,
  selectedAccountId,
  visible,
  active = true,
  isWatchOnlyAccount,
  onAddAccount,
  onRequestClose,
  onSelectAccount,
}: Props) {
  const { t, tPlural } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const [status, setStatus] = useState<'idle' | 'selecting' | 'error'>('idle');
  const closingOrSelecting = useRef(false);
  const selecting = status === 'selecting';

  useEffect(() => {
    if (!visible) {
      closingOrSelecting.current = false;
      setStatus('idle');
    }
  }, [visible]);

  const close = () => {
    if (!visible || closingOrSelecting.current) return false;
    closingOrSelecting.current = true;
    onRequestClose();
    return true;
  };

  const select = async (accountId: string) => {
    if (!visible || closingOrSelecting.current) return;

    closingOrSelecting.current = true;
    setStatus('selecting');
    try {
      await onSelectAccount(accountId);
      onRequestClose();
    } catch {
      closingOrSelecting.current = false;
      setStatus('error');
      AccessibilityInfo.announceForAccessibility(t('accounts.select.error'));
    }
  };

  return (
    <BottomSheet closeLabel={t('common.close')} onClose={close} visible={visible}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={styles.title}>
              {t('accounts.select.title')}
            </Text>
            <Text style={styles.description}>{tPlural('settings.accountCount', accounts.length)}</Text>
          </View>
          <NativeButton
            disabled={selecting}
            label={t('accounts.add.title')}
            onPress={() => {
              if (close()) onAddAccount();
            }}
            size="sm"
            variant="secondary"
          />
        </View>
        <Text style={styles.description}>{t('accounts.select.description')}</Text>
        {status === 'error' ? <Text style={styles.error}>{t('accounts.select.error')}</Text> : null}
        <ScrollView contentContainerStyle={styles.list}>
          {visible
            ? accounts.map(account => {
                const selected = account.id === selectedAccountId;
                const label = account.label || account.address;
                const kindLabel = t(
                  account.identityKind === 'contract'
                    ? 'accounts.select.kind.contract'
                    : isWatchOnlyAccount(account.id)
                      ? 'accounts.add.watchOnly.title'
                      : 'accounts.select.kind.classic',
                );
                return (
                  <Pressable
                    accessibilityLabel={`${label}, ${kindLabel}`}
                    accessibilityRole="radio"
                    accessibilityState={{ disabled: selecting, selected }}
                    disabled={selecting}
                    key={account.id}
                    onPress={() => select(account.id)}
                    style={({ pressed }) => [
                      styles.row,
                      selected ? styles.rowSelected : undefined,
                      selecting ? styles.rowDisabled : undefined,
                      pressed && !selecting ? styles.rowPressed : undefined,
                    ]}
                  >
                    <AccountAvatar address={account.address} active={active && visible} />
                    <View style={styles.identity}>
                      <Text numberOfLines={1} style={styles.label}>
                        {label}
                      </Text>
                      <Text style={styles.kind}>{kindLabel}</Text>
                      <Text numberOfLines={1} style={styles.address}>
                        {account.address}
                      </Text>
                    </View>
                    {selected ? <Text style={styles.current}>{t('accounts.select.current')}</Text> : null}
                  </Pressable>
                );
              })
            : null}
        </ScrollView>
      </View>
    </BottomSheet>
  );
}
