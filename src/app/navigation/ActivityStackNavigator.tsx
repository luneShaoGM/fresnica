import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import type {AccountRecord} from '@capabilities/account/types';
import {ActivityScreen} from '@features/activity/ActivityScreen';

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
        {() => <ActivityScreen account={account} dependencies={services.history} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
