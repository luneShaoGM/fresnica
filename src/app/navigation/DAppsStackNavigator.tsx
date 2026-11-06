import React, { useRef, useSyncExternalStore } from 'react';
import { canMountDappWebView } from '../../platform/dapp-browser/browserAvailability';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { useIsFocused } from '@react-navigation/native';
import type { LedgerReadRuntime } from '../readModels/LedgerReadRuntime';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { DappBrowserScreen } from '@features/dapps/screens/DappBrowserScreen/DappBrowserScreen';
import { SecureDappWebView } from '../../platform/dapp-browser/SecureDappWebView';
import { createDappBridgeNonce } from '../../platform/dapp-browser/secureNonce';
import type { DappPublicSelection } from '../../capabilities/dapp-interaction/freighterSession';
import type { DappPermissionStore } from '../../capabilities/dapp-interaction/dappPermissionStore';
import type { DappTransactionSigner } from '../../capabilities/dapp-interaction/dappTransactionSigner';
import type { DappCatalogEntry, DappCatalogPort } from '@capabilities/dapp-catalog/catalog';
import { createCuratedSessionLaunch } from '../../capabilities/dapp-interaction/curatedSessionLaunch';
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
  permissions,
}: Readonly<{
  catalog: DappCatalogPort;
  openExternalUrl: (url: string) => Promise<void>;
  runtime: LedgerReadRuntime;
  currentSelection: () => DappPublicSelection | undefined;
  subscribeSelection: (listener: () => void) => () => void;
  signTransaction: DappTransactionSigner;
  permissions: DappPermissionStore;
}>) {
  const reads = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot, runtime.getSnapshot);
  const launchRef = useRef<ReturnType<typeof createCuratedSessionLaunch> | undefined>(undefined);
  if (!launchRef.current) launchRef.current = createCuratedSessionLaunch();
  const trustedLaunch = launchRef.current;
  return (
    <Stack.Navigator initialRouteName="dapps" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="dapps">
        {() => (
          <DAppsRoute
            catalog={catalog}
            openExternalUrl={openExternalUrl}
            foreground={reads.foreground}
            online={reads.connectivity !== 'offline'}
            currentSelection={currentSelection}
            trustedLaunch={trustedLaunch}
          />
        )}
      </Stack.Screen>
      {canMountDappWebView() ? (
        <Stack.Screen name="dapp-browser">
          {({ route, navigation }) => (
            <DappBrowserRoute
              url={route.params.url}
              currentSelection={currentSelection}
              subscribeSelection={subscribeSelection}
              signTransaction={signTransaction}
              permissions={permissions}
              foreground={reads.foreground}
              onClose={() => navigation.goBack()}
              trustedLaunch={trustedLaunch}
            />
          )}
        </Stack.Screen>
      ) : null}
    </Stack.Navigator>
  );
}

function DAppsRoute({
  catalog,
  openExternalUrl,
  foreground,
  online,
  currentSelection,
  trustedLaunch,
}: Readonly<{
  catalog: DappCatalogPort;
  openExternalUrl: (url: string) => Promise<void>;
  foreground: boolean;
  online: boolean;
  currentSelection: () => DappPublicSelection | undefined;
  trustedLaunch: ReturnType<typeof createCuratedSessionLaunch>;
}>) {
  const focused = useIsFocused();
  const navigation = useNavigation<NavigationProp<DAppsStackParamList>>();
  return (
    <DAppsScreen
      catalog={catalog}
      openExternalUrl={openExternalUrl}
      openInApp={
        canMountDappWebView()
          ? url => {
              // Even a manual URL identical to a curated entry has no proof.
              trustedLaunch.clear();
              navigation.navigate('dapp-browser', { url });
            }
          : undefined
      }
      openCatalogInApp={
        canMountDappWebView()
          ? (entry: DappCatalogEntry, fresh: boolean) => {
              let selected: DappPublicSelection | undefined;
              let verified = false;
              try {
                selected = currentSelection();
                verified = fresh && online && catalog.isTrustedLiveEntry?.(entry) === true;
              } catch {
                // A closed/throwing selection/catalog adapter never mints trust.
              }
              trustedLaunch.prepare(entry.websiteUrl, selected, verified);
              navigation.navigate('dapp-browser', { url: entry.websiteUrl });
            }
          : undefined
      }
      inAppUnavailable={!canMountDappWebView()}
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
  permissions,
  foreground,
  onClose,
  trustedLaunch,
}: Readonly<{
  url: string;
  currentSelection: () => DappPublicSelection | undefined;
  subscribeSelection: (listener: () => void) => () => void;
  signTransaction: DappTransactionSigner;
  permissions: DappPermissionStore;
  foreground: boolean;
  onClose: () => void;
  trustedLaunch: ReturnType<typeof createCuratedSessionLaunch>;
}>) {
  const focused = useIsFocused();
  const proofRef = useRef<{ url: string; revision: number; origin?: string } | undefined>(undefined);
  if (!proofRef.current || proofRef.current.url !== url || proofRef.current.revision !== trustedLaunch.revision()) {
    let selected: DappPublicSelection | undefined;
    try {
      selected = currentSelection();
    } catch {
      // A missing account fails closed, including before first route render.
    }
    const origin = trustedLaunch.consume(url, selected);
    proofRef.current = { url, revision: trustedLaunch.revision(), origin };
  }
  return (
    <DappBrowserScreen
      key={url + ':' + String(proofRef.current.revision)}
      url={url}
      active={focused && foreground}
      onClose={onClose}
      currentSelection={currentSelection}
      subscribeSelection={subscribeSelection}
      signTransaction={signTransaction}
      permissions={permissions}
      trustedCatalogOrigin={proofRef.current.origin}
      createNonce={createDappBridgeNonce}
      BrowserSurface={SecureDappWebView}
    />
  );
}
