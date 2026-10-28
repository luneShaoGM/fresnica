import React, { useSyncExternalStore } from 'react';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { useIsFocused } from '@react-navigation/native';
import type { LedgerReadRuntime } from '../readModels/LedgerReadRuntime';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { DappBrowserScreen } from '@features/dapps/screens/DappBrowserScreen/DappBrowserScreen';
import { SecureDappWebView } from '../../platform/dapp-browser/SecureDappWebView';
import { createDappBridgeNonce } from '../../platform/dapp-browser/secureNonce';
import type { DappPublicSelection } from '../../capabilities/dapp-interaction/freighterSession';
import type { DappTransactionSigner } from '../../capabilities/dapp-interaction/dappTransactionSigner';
import type { DappCatalogPort } from '@capabilities/dapp-catalog/catalog';
import { DAppsScreen } from '@features/dapps/screens/DAppsScreen';

import type { DAppsStackParamList } from './navigationTypes';

const Stack = createNativeStackNavigator<DAppsStackParamList>();

export function DAppsStackNavigator({
  catalog,
  openExternalUrl,
  runtime,
  currentSelection,
  subscribeSelection,
  signTransaction,
}: Readonly<{
  catalog: DappCatalogPort;
  openExternalUrl: (url: string) => Promise<void>;
  runtime: LedgerReadRuntime;
  currentSelection: () => DappPublicSelection | undefined;
  subscribeSelection: (listener: () => void) => () => void;
  signTransaction: DappTransactionSigner;
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
      <Stack.Screen name="dapp-browser">
        {({ route, navigation }) => (
          <DappBrowserRoute
            url={route.params.url}
            currentSelection={currentSelection}
            subscribeSelection={subscribeSelection}
            signTransaction={signTransaction}
            foreground={reads.foreground}
            onClose={() => navigation.goBack()}
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
  const navigation = useNavigation<NavigationProp<DAppsStackParamList>>();
  return (
    <DAppsScreen
      catalog={catalog}
      openExternalUrl={openExternalUrl}
      openInApp={url => navigation.navigate('dapp-browser', { url })}
      active={focused && foreground}
      online={online}
      focused={focused}
    />
  );
}

function DappBrowserRoute({
  url,
  currentSelection,
  subscribeSelection,
  signTransaction,
  foreground,
  onClose,
}: Readonly<{
  url: string;
  currentSelection: () => DappPublicSelection | undefined;
  subscribeSelection: (listener: () => void) => () => void;
  signTransaction: DappTransactionSigner;
  foreground: boolean;
  onClose: () => void;
}>) {
  const focused = useIsFocused();
  return (
    <DappBrowserScreen
      url={url}
      active={focused && foreground}
      onClose={onClose}
      currentSelection={currentSelection}
      subscribeSelection={subscribeSelection}
      signTransaction={signTransaction}
      createNonce={createDappBridgeNonce}
      BrowserSurface={SecureDappWebView}
    />
  );
}
