import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, Text, View } from 'react-native';

import type { AccountRecord } from '@capabilities/account/types';
import { useLocalization } from '../../../locale';
import { AppModal } from '@ui/components';
import { useThemedStyles } from '@ui/theme';

import { createStyles } from './AccountPickerModal.styles';

type Props = Readonly<{
  accounts: readonly AccountRecord[];
  selectedAccountId: string;
  visible: boolean;
  onRequestClose: () => void;
  onSelectAccount: (accountId: string) => void | Promise<void>;
}>;

export function AccountPickerModal({ accounts, selectedAccountId, visible, onRequestClose, onSelectAccount }: Props) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const [selectingAccountId, setSelectingAccountId] = useState<string | undefined>();
  const [selectionError, setSelectionError] = useState(false);

  useEffect(() => {
    if (!visible) {
      setSelectingAccountId(undefined);
      setSelectionError(false);
    }
  }, [visible]);

  const close = () => {
    if (selectingAccountId === undefined) {
      onRequestClose();
    }
  };

  const select = async (accountId: string) => {
    if (selectingAccountId !== undefined) return;

    setSelectingAccountId(accountId);
    setSelectionError(false);
    try {
      await onSelectAccount(accountId);
      onRequestClose();
    } catch {
      setSelectionError(true);
      AccessibilityInfo.announceForAccessibility(t('accounts.select.error'));
    } finally {
      setSelectingAccountId(undefined);
    }
  };

  return (
    <AppModal
      description={t('accounts.select.description')}
      onRequestClose={close}
      title={t('accounts.select.title')}
      visible={visible}
    >
      {selectionError ? <Text style={styles.error}>{t('accounts.select.error')}</Text> : null}
      <ScrollView contentContainerStyle={styles.list} style={styles.scroll}>
        {accounts.map(account => {
          const selected = account.id === selectedAccountId;
          const disabled = selectingAccountId !== undefined;
          return (
            <Pressable
              accessibilityLabel={account.label || account.address}
              accessibilityRole="radio"
              accessibilityState={{ disabled, selected }}
              disabled={disabled}
              key={account.id}
              onPress={() => select(account.id)}
              style={({ pressed }) => [
                styles.row,
                selected ? styles.rowSelected : undefined,
                disabled ? styles.rowDisabled : undefined,
                pressed && !disabled ? styles.rowPressed : undefined,
              ]}
            >
              <View style={styles.identity}>
                <Text numberOfLines={1} style={styles.label}>
                  {account.label || account.address}
                </Text>
                <Text numberOfLines={1} style={styles.address}>
                  {account.address}
                </Text>
              </View>
              {selected ? <Text style={styles.current}>{t('accounts.select.current')}</Text> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </AppModal>
  );
}
