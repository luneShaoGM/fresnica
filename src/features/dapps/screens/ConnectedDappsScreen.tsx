import React, { useSyncExternalStore, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import type { AccountRecord } from '../../../capabilities/account/types';
import type {
  DappGrantScope,
  DappPermissionStore,
  DappReadGrant,
} from '../../../capabilities/dapp-interaction/dappPermissionStore';
import { useLocalization } from '../../../locale';
import { NativeButton } from '../../../ui/components/NativeButton';
import { Screen } from '../../../ui/components';
import { useThemedStyles } from '../../../ui/theme';

import { createStyles } from './connectedDappsStyles';

type Props = Readonly<{
  permissions: DappPermissionStore;
  networkId: string;
  accounts: readonly AccountRecord[];
  onBack: () => void;
}>;

export function ConnectedDappsScreen({ permissions, networkId, accounts, onBack }: Props) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  useSyncExternalStore(permissions.subscribe, permissions.getRevision, permissions.getRevision);
  const [failed, setFailed] = useState(false);
  let grants: readonly DappReadGrant[] = [];
  let loadFailed = false;
  try {
    grants = permissions.list(networkId);
  } catch {
    loadFailed = true;
  }

  const disconnect = (scope: DappGrantScope) => {
    setFailed(false);
    try {
      // The storage write is synchronous; a failure must not show a revoked row.
      permissions.revoke(scope);
    } catch {
      setFailed(true);
    }
  };

  return (
    <Screen contentInset="none" scrollable={false}>
      <View style={styles.header}>
        <NativeButton label={t('common.back')} onPress={onBack} size="sm" variant="quiet" />
        <Text style={styles.title}>{t('dapps.connected.title')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.note}>{t('dapps.connected.hint')}</Text>
        {loadFailed ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {t('dapps.connected.loadFailed')}
          </Text>
        ) : null}
        {!loadFailed && grants.length === 0 ? <Text style={styles.empty}>{t('dapps.connected.empty')}</Text> : null}
        {grants.map(grant => {
          const account = accounts.find(a => a.networkId === networkId && a.id === grant.accountId);
          return (
            <View key={JSON.stringify([grant.networkId, grant.accountId, grant.origin])} style={styles.row}>
              <View style={styles.details}>
                <Text selectable style={styles.origin}>
                  {grant.origin}
                </Text>
                <Text selectable style={styles.account}>
                  {account?.label ?? grant.accountId}
                </Text>
              </View>
              <NativeButton
                label={t('dapps.connected.disconnect')}
                onPress={() =>
                  disconnect({ origin: grant.origin, accountId: grant.accountId, networkId: grant.networkId })
                }
                size="sm"
                variant="secondary"
              />
            </View>
          );
        })}
        {failed ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {t('dapps.connected.revokeFailed')}
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
