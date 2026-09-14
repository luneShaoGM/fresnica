import React, {useState} from 'react';
import {AccessibilityInfo, Pressable, ScrollView, Text, View} from 'react-native';

import type {AccountMoveDirection} from '@capabilities/account/accountOrder';
import {Screen} from '@ui/components';

import type {AccountRecord} from '../../capabilities/account/types';
import {useLocalization} from '../../locale';
import {createStyles} from './styles';
import {useThemedStyles} from '@ui/theme';

type Props = Readonly<{
  accounts: readonly AccountRecord[];
  onOpenAccount: (accountId: string) => void;
  onAddAccount: () => void;
  onMoveAccount: (accountId: string, direction: AccountMoveDirection) => void | Promise<void>;
  onBack: () => void;
}>;

export function AccountsScreen({accounts, onOpenAccount, onAddAccount, onMoveAccount, onBack}: Props) {
  const {t} = useLocalization();
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
        <Pressable accessibilityLabel="Back" accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Accounts</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.description}>Accounts available on this device</Text>
        {moveError ? (
          <Text accessibilityLiveRegion="assertive" style={styles.sortError}>
            {t('accounts.sort.error')}
          </Text>
        ) : null}
        {accounts.map((account, index) => (
          <View key={account.id} style={styles.accountGroup}>
            <Pressable
              accessibilityRole="button"
              onPress={() => onOpenAccount(account.id)}
              style={({pressed}) => [
                styles.accountCard,
                account.hidden ? styles.accountCardHidden : undefined,
                pressed ? styles.pressed : undefined,
              ]}>
              <View style={styles.accountTopRow}>
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
              <Text numberOfLines={1} selectable style={styles.address}>
                {account.address}
              </Text>
              <Text style={styles.network}>{account.networkId}</Text>
            </Pressable>
            <View style={styles.sortControls}>
              <Pressable
                accessibilityLabel={t('accounts.sort.moveUp')}
                accessibilityRole="button"
                accessibilityState={{disabled: movingAccountId !== undefined || index === 0}}
                disabled={movingAccountId !== undefined || index === 0}
                onPress={() => reorder(account.id, 'up')}
                style={({pressed}) => [
                  styles.sortButton,
                  movingAccountId !== undefined || index === 0 ? styles.sortButtonDisabled : undefined,
                  pressed ? styles.pressed : undefined,
                ]}>
                <Text
                  style={[
                    styles.sortButtonText,
                    movingAccountId !== undefined || index === 0 ? styles.sortButtonTextDisabled : undefined,
                  ]}>
                  {t('accounts.sort.moveUp')}
                </Text>
              </Pressable>
              <Pressable
                accessibilityLabel={t('accounts.sort.moveDown')}
                accessibilityRole="button"
                accessibilityState={{disabled: movingAccountId !== undefined || index === accounts.length - 1}}
                disabled={movingAccountId !== undefined || index === accounts.length - 1}
                onPress={() => reorder(account.id, 'down')}
                style={({pressed}) => [
                  styles.sortButton,
                  movingAccountId !== undefined || index === accounts.length - 1
                    ? styles.sortButtonDisabled
                    : undefined,
                  pressed ? styles.pressed : undefined,
                ]}>
                <Text
                  style={[
                    styles.sortButtonText,
                    movingAccountId !== undefined || index === accounts.length - 1
                      ? styles.sortButtonTextDisabled
                      : undefined,
                  ]}>
                  {t('accounts.sort.moveDown')}
                </Text>
              </Pressable>
            </View>
          </View>
        ))}

        <Pressable
          accessibilityRole="button"
          onPress={onAddAccount}
          style={({pressed}) => [styles.addButton, pressed ? styles.pressed : undefined]}>
          <Text style={styles.addIcon}>＋</Text>
          <Text style={styles.addText}>Add account</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
