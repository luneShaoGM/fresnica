import { AccountAvatar } from '../contacts/AccountAvatar';
import React, { useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, Text, View } from 'react-native';

import type { AccountMoveDirection } from '@capabilities/account/accountOrder';
import { Screen } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';

import type { AccountRecord } from '../../capabilities/account/types';
import { useLocalization } from '../../locale';
import { createStyles } from './styles';
import { CopyAddressButton } from './CopyAddressButton';
import { useThemedStyles } from '@ui/theme';

type Props = Readonly<{
  accounts: readonly AccountRecord[];
  active?: boolean;
  onOpenAccount: (accountId: string) => void;
  onAddAccount: () => void;
  onMoveAccount: (accountId: string, direction: AccountMoveDirection) => void | Promise<void>;
  copyPublicText: (text: string) => Promise<void>;
  onBack: () => void;
}>;

export function AccountsScreen({
  accounts,
  active = true,
  onOpenAccount,
  onAddAccount,
  onMoveAccount,
  copyPublicText,
  onBack,
}: Props) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const [movingAccountId, setMovingAccountId] = useState<string | undefined>();
  const [moveError, setMoveError] = useState(false);

  const reorder = async (accountId: string, direction: AccountMoveDirection) => {
    if (movingAccountId !== undefined) return;
    setMovingAccountId(accountId);
    setMoveError(false);
    try {
      await onMoveAccount(accountId, direction);
    } catch {
      setMoveError(true);
      AccessibilityInfo.announceForAccessibility(t('accounts.sort.error'));
    } finally {
      setMovingAccountId(undefined);
    }
  };
  return (
    <Screen scrollable={false} contentInset="none">
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <NativeButton label={t('common.back')} onPress={onBack} size="sm" variant="quiet" />
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          {t('settings.accounts')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {moveError ? <Text style={styles.sortError}>{t('accounts.sort.error')}</Text> : null}
        {accounts.map((account, index) => (
          <View key={account.id} style={styles.accountGroup}>
            <View style={[styles.accountCard, account.hidden ? styles.accountCardHidden : undefined]}>
              <Pressable
                accessibilityRole="button"
                onPress={() => onOpenAccount(account.id)}
                style={({ pressed }) => [styles.accountOpen, pressed ? styles.pressed : undefined]}
              >
                <View style={styles.accountTopRow}>
                  <AccountAvatar address={account.address} active={active} />
                  <View style={styles.accountIdentity}>
                    <Text numberOfLines={1} style={styles.accountLabel}>
                      {account.label || 'Stellar account'}
                    </Text>
                    <View style={styles.badges}>
                      <View style={styles.accessBadge}>
                        <Text style={styles.accessBadgeText}>{account.identityKind}</Text>
                      </View>
                      {account.hidden ? (
                        <View style={styles.hiddenBadge}>
                          <Text style={styles.hiddenBadgeText}>Hidden</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </View>
                <Text style={styles.network}>{account.networkId}</Text>
              </Pressable>
              <CopyAddressButton key={account.address} address={account.address} copyPublicText={copyPublicText} />
            </View>
            <View style={styles.sortControls}>
              <Pressable
                accessibilityLabel={t('accounts.sort.moveUp')}
                accessibilityRole="button"
                accessibilityState={{ disabled: movingAccountId !== undefined || index === 0 }}
                disabled={movingAccountId !== undefined || index === 0}
                onPress={() => reorder(account.id, 'up')}
                style={({ pressed }) => [
                  styles.sortButton,
                  movingAccountId !== undefined || index === 0 ? styles.sortButtonDisabled : undefined,
                  pressed ? styles.pressed : undefined,
                ]}
              >
                <Text
                  style={[
                    styles.sortButtonText,
                    movingAccountId !== undefined || index === 0 ? styles.sortButtonTextDisabled : undefined,
                  ]}
                >
                  {t('accounts.sort.moveUp')}
                </Text>
              </Pressable>
              <Pressable
                accessibilityLabel={t('accounts.sort.moveDown')}
                accessibilityRole="button"
                accessibilityState={{ disabled: movingAccountId !== undefined || index === accounts.length - 1 }}
                disabled={movingAccountId !== undefined || index === accounts.length - 1}
                onPress={() => reorder(account.id, 'down')}
                style={({ pressed }) => [
                  styles.sortButton,
                  movingAccountId !== undefined || index === accounts.length - 1
                    ? styles.sortButtonDisabled
                    : undefined,
                  pressed ? styles.pressed : undefined,
                ]}
              >
                <Text
                  style={[
                    styles.sortButtonText,
                    movingAccountId !== undefined || index === accounts.length - 1
                      ? styles.sortButtonTextDisabled
                      : undefined,
                  ]}
                >
                  {t('accounts.sort.moveDown')}
                </Text>
              </Pressable>
            </View>
          </View>
        ))}

        <View style={styles.addButtonContainer}>
          <NativeButton
            icon={
              <Text allowFontScaling={false} style={styles.addIcon}>
                ＋
              </Text>
            }
            label="Add account"
            onPress={onAddAccount}
            size="lg"
            variant="primary"
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
