import React, { useSyncExternalStore } from 'react';
import { useIsFocused } from '@react-navigation/native';
import type { LedgerReadRuntime } from '../readModels/LedgerReadRuntime';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { DappCatalogPort } from '@capabilities/dapp-catalog/catalog';
import { DAppsScreen } from '@features/dapps/screens/DAppsScreen';

import type { DAppsStackParamList } from './navigationTypes';

const Stack = createNativeStackNavigator<DAppsStackParamList>();

export function DAppsStackNavigator({
  catalog,
  openExternalUrl,
  runtime,
}: Readonly<{
  catalog: DappCatalogPort;
  openExternalUrl: (url: string) => Promise<void>;
  runtime: LedgerReadRuntime;
}>) {
  const reads = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot, runtime.getSnapshot);
  return (
    <Stack.Navigator initialRouteName="dapps" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="dapps">
        {() => (
          <DAppsRoute
            catalog={catalog}
            openExternalUrl={openExternalUrl}
            foreground={reads.foreground}
            online={reads.connectivity !== 'offline'}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

function DAppsRoute({
  catalog,
  openExternalUrl,
  foreground,
  online,
}: Readonly<{
  catalog: DappCatalogPort;
  openExternalUrl: (url: string) => Promise<void>;
  foreground: boolean;
  online: boolean;
}>) {
  const focused = useIsFocused();
  return (
    <DAppsScreen catalog={catalog} openExternalUrl={openExternalUrl} active={focused && foreground} online={online} />
  );
}
