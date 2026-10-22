import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { DappCatalogPort } from '@capabilities/dapp-catalog/catalog';
import { DAppsScreen } from '@features/dapps/screens/DAppsScreen';

import type { DAppsStackParamList } from './navigationTypes';

const Stack = createNativeStackNavigator<DAppsStackParamList>();

export function DAppsStackNavigator({
  catalog,
  openExternalUrl,
}: Readonly<{ catalog: DappCatalogPort; openExternalUrl: (url: string) => Promise<void> }>) {
  return (
    <Stack.Navigator initialRouteName="dapps" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="dapps">
        {() => <DAppsScreen catalog={catalog} openExternalUrl={openExternalUrl} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
