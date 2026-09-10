import React from 'react';
import {useIsFocused} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import type {AccountRecord} from '@capabilities/account/types';
import {ActivityScreen} from '@features/activity/ActivityScreen';
import {OperationDetailsScreen} from '@features/activity/OperationDetailsScreen';

import type {AppServices} from '../createAppServices';
import {resolveVisibleAccount} from './accountSelection';
import type {ActivityStackParamList} from './navigationTypes';

const Stack = createNativeStackNavigator<ActivityStackParamList>();

type Props = Readonly<{
  accounts: readonly AccountRecord[];
  selectedAccountId: string;
  services: AppServices;
}>;

export function ActivityStackNavigator({accounts, selectedAccountId, services}: Props) {
  const account = resolveVisibleAccount(accounts, selectedAccountId);

  return (
    <Stack.Navigator initialRouteName="activity" screenOptions={{headerShown: false}}>
      <Stack.Screen name="activity">
        {({navigation}) => (
          <ActivityRoute
            account={account}
            dependencies={services.history}
            onOpenOperation={operationId =>
              navigation.navigate('operation-details', {accountId: account.id, operationId})
            }
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="operation-details">
        {({navigation, route}) => (
          <OperationDetailsRoute
            account={requireAccount(accounts, route.params.accountId)}
            dependencies={services.history}
            operationId={route.params.operationId}
            onBack={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

function ActivityRoute(props: Omit<React.ComponentProps<typeof ActivityScreen>, 'active'>) {
  const active = useIsFocused();
  return <ActivityScreen {...props} active={active} />;
}

function OperationDetailsRoute(
  props: Omit<React.ComponentProps<typeof OperationDetailsScreen>, 'active'>,
) {
  const active = useIsFocused();
  return <OperationDetailsScreen {...props} active={active} />;
}

function requireAccount(accounts: readonly AccountRecord[], accountId: string): AccountRecord {
  const account = accounts.find(candidate => candidate.id === accountId);
  if (!account) {
    throw new Error('account-not-found');
  }
  return account;
}
