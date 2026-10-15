import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { DappCatalogPort } from '@capabilities/dapp-catalog/catalog';
import { DAppsScreen } from '@features/dapps/screens/DAppsScreen';

import type { DAppsStackParamList } from './navigationTypes';

const Stack = createNativeStackNavigator<DAppsStackParamList>();

export function DAppsStackNavigator({ catalog }: Readonly<{ catalog: DappCatalogPort }>) {
  return (
    <Stack.Navigator initialRouteName="dapps" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="dapps">
        {() => <DAppsScreen catalog={catalog} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
