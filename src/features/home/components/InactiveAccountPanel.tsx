import React from 'react';
import { Text, View } from 'react-native';

import { useLocalization } from '../../../locale';
import { Button } from '@ui/components';
import { useThemedStyles } from '@ui/theme';

import { createStyles } from '../styles';

export type FriendbotFundingState = 'idle' | 'funding' | 'error';

type Props = Readonly<{
  address: string;
  stale: boolean;
  verifiedInactive?: boolean;
  friendbotAvailable: boolean;
  friendbotState: FriendbotFundingState;
  onFundWithFriendbot: () => void;
  onRefresh: () => void;
}>;

export function InactiveAccountPanel({
  address,
  stale,
  verifiedInactive = false,
  friendbotAvailable,
  friendbotState,
  onFundWithFriendbot,
  onRefresh,
}: Props) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const showStale = stale && !verifiedInactive;
  return (
    <View style={styles.inactiveContainer} testID="not-activated-account-container">
      <Text style={styles.inactiveTitle}>{t(showStale ? 'home.inactive.staleTitle' : 'home.inactive.title')}</Text>

      {showStale ? (
        <Text style={styles.inactiveStepText}>{t('balance.cache.inactive')}</Text>
      ) : (
        <View style={styles.inactiveStep}>
          <Text style={styles.inactiveStepTitle}>{t('home.inactive.fundTitle')}</Text>
          <Text style={styles.inactiveStepText}>{t('home.inactive.fundMessage')}</Text>
        </View>
      )}

      <Text selectable style={styles.inactiveAddress}>
        {address}
      </Text>

      {!showStale && friendbotAvailable ? (
        <Button
          disabled={stale || friendbotState === 'funding'}
          label={t(friendbotState === 'funding' ? 'home.friendbot.funding' : 'home.friendbot.action')}
          onPress={onFundWithFriendbot}
        />
      ) : null}
      {!showStale && friendbotState === 'error' ? (
        <Text style={styles.inactiveError}>{t('home.friendbot.error')}</Text>
      ) : null}
      {showStale ? null : (
        <View style={styles.inactiveStep}>
          <Text style={styles.inactiveStepTitle}>{t('home.inactive.refreshTitle')}</Text>
          <Text style={styles.inactiveStepText}>{t('home.inactive.refreshMessage')}</Text>
        </View>
      )}

      <Button label={t('home.inactive.refreshAction')} onPress={onRefresh} variant="secondary" />
    </View>
  );
}
