import type { DappContractTracking } from '@capabilities/dapp-interaction/dappContractTracking';
import { readDappNotificationTime, showDappNotification } from '../../platform/dapp-browser/dappNotification';
import React, { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { Share } from 'react-native';
import type { AccountRecord } from '@capabilities/account/types';
import type { NetworkSettings } from '@capabilities/network/createNetworkSettings';
import { NetworkSwitchModal } from '@features/settings/NetworkSwitchModal';
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
import type { DappMessageSigner } from '../../capabilities/dapp-interaction/dappMessageSigner';
import type { DappAssetRequest } from '../../capabilities/dapp-interaction/dappAssetRequest';
import type { DappTransactionSigner } from '../../capabilities/dapp-interaction/dappTransactionSigner';
import type { DappRecentHistory } from '../../capabilities/dapp-interaction/dappRecentHistory';
import type { DappCatalogEntry, DappCatalogPort } from '@capabilities/dapp-catalog/catalog';
import { createCuratedSessionLaunch } from '../../capabilities/dapp-interaction/curatedSessionLaunch';
import { DAppsScreen } from '@features/dapps/screens/DAppsScreen';

import type { DAppsStackParamList } from './navigationTypes';

type CatalogDisplayLaunch = { revision: number; entry: DappCatalogEntry };
type CatalogDisplayRef = React.RefObject<CatalogDisplayLaunch | undefined>;

const Stack = createNativeStackNavigator<DAppsStackParamList>();

export function DAppsStackNavigator({
  catalog,
  recentHistory,
  openExternalUrl,
  runtime,
  currentSelection,
  subscribeSelection,
  signTransaction,
  signMessage,
  addAsset,
  trackContract,
  permissions,
  browserAccounts,
  chooseBrowserAccount,
  browserNetworks,
}: Readonly<{
  catalog: DappCatalogPort;
  recentHistory?: DappRecentHistory;
  openExternalUrl: (url: string) => Promise<void>;
  runtime: LedgerReadRuntime;
  currentSelection: () => DappPublicSelection | undefined;
  subscribeSelection: (listener: () => void) => () => void;
  signTransaction: DappTransactionSigner;
  signMessage?: DappMessageSigner;
  addAsset?: DappAssetRequest;
  trackContract?: DappContractTracking;
  permissions: DappPermissionStore;
  browserAccounts?: readonly AccountRecord[];
  chooseBrowserAccount?: (id: string) => Promise<void>;
  browserNetworks?: NetworkSettings;
}>) {
  const reads = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot, runtime.getSnapshot);
  const launchRef = useRef<ReturnType<typeof createCuratedSessionLaunch> | undefined>(undefined);
  if (!launchRef.current) launchRef.current = createCuratedSessionLaunch();
  const trustedLaunch = launchRef.current;
  const catalogDisplay = useRef<CatalogDisplayLaunch | undefined>(undefined);
  return (
    <Stack.Navigator initialRouteName="dapps" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="dapps">
        {({ route, navigation }) => (
          <DAppsRoute
            scannedUrl={route?.params?.scannedUrl}
            clearScannedUrl={() => navigation?.setParams?.({ scannedUrl: undefined })}
            catalog={catalog}
            recentHistory={recentHistory}
            openExternalUrl={openExternalUrl}
            foreground={reads.foreground}
            online={reads.connectivity !== 'offline'}
            currentSelection={currentSelection}
            trustedLaunch={trustedLaunch}
            catalogDisplay={catalogDisplay}
          />
        )}
      </Stack.Screen>
      {canMountDappWebView() ? (
        <Stack.Screen name="dapp-browser">
          {({ route, navigation }) => (
            <DappBrowserRoute
              url={route.params.url}
              onVisit={recentHistory?.record}
              currentSelection={currentSelection}
              subscribeSelection={subscribeSelection}
              signTransaction={signTransaction}
              signMessage={signMessage}
              addAsset={addAsset}
              trackContract={trackContract}
              permissions={permissions}
              browserAccounts={browserAccounts}
              chooseBrowserAccount={chooseBrowserAccount}
              browserNetworks={browserNetworks}
              foreground={reads.foreground}
              onClose={() => navigation.goBack()}
              trustedLaunch={trustedLaunch}
              catalogDisplay={catalogDisplay}
              catalogMedia={catalog.publicMedia}
              online={reads.connectivity !== 'offline'}
            />
          )}
        </Stack.Screen>
      ) : null}
    </Stack.Navigator>
  );
}

function DAppsRoute({
  scannedUrl,
  clearScannedUrl,
  catalog,
  recentHistory,
  openExternalUrl,
  foreground,
  online,
  currentSelection,
  trustedLaunch,
  catalogDisplay,
}: Readonly<{
  scannedUrl?: string;
  clearScannedUrl: () => void;
  catalog: DappCatalogPort;
  recentHistory?: DappRecentHistory;
  openExternalUrl: (url: string) => Promise<void>;
  foreground: boolean;
  online: boolean;
  currentSelection: () => DappPublicSelection | undefined;
  trustedLaunch: ReturnType<typeof createCuratedSessionLaunch>;
  catalogDisplay: CatalogDisplayRef;
}>) {
  const focused = useIsFocused();
  const navigation = useNavigation<NavigationProp<DAppsStackParamList>>();
  return (
    <DAppsScreen
      scannedUrl={scannedUrl}
      clearScannedUrl={clearScannedUrl}
      catalog={catalog}
      recentHistory={recentHistory}
      openExternalUrl={openExternalUrl}
      openInApp={
        canMountDappWebView()
          ? url => {
              // Even a manual URL identical to a curated entry has no proof.
              trustedLaunch.clear();
              catalogDisplay.current = undefined;
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
              catalogDisplay.current = { entry, revision: trustedLaunch.revision() };
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
  onVisit,
  currentSelection,
  subscribeSelection,
  signTransaction,
  signMessage,
  addAsset,
  trackContract,
  permissions,
  browserAccounts,
  chooseBrowserAccount,
  browserNetworks,
  foreground,
  onClose,
  trustedLaunch,
  catalogDisplay,
  catalogMedia,
  online,
}: Readonly<{
  url: string;
  onVisit?: (url: string) => void;
  currentSelection: () => DappPublicSelection | undefined;
  subscribeSelection: (listener: () => void) => () => void;
  signTransaction: DappTransactionSigner;
  signMessage?: DappMessageSigner;
  addAsset?: DappAssetRequest;
  trackContract?: DappContractTracking;
  permissions: DappPermissionStore;
  browserAccounts?: readonly AccountRecord[];
  chooseBrowserAccount?: (id: string) => Promise<void>;
  browserNetworks?: NetworkSettings;
  foreground: boolean;
  onClose: () => void;
  trustedLaunch: ReturnType<typeof createCuratedSessionLaunch>;
  catalogDisplay: CatalogDisplayRef;
  catalogMedia?: DappCatalogPort['publicMedia'];
  online: boolean;
}>) {
  const focused = useIsFocused();
  const [reopened, setReopened] = useState<{ origin: string; revision: number }>();
  const [networkPicker, setNetworkPicker] = useState(false);
  const closeRoute = useRef(onClose);
  closeRoute.current = onClose;
  const closeNetworkPicker = useCallback(() => {
    setNetworkPicker(false);
    closeRoute.current();
  }, []);
  const proofRef = useRef<{ url: string; revision: number; origin?: string; entry?: DappCatalogEntry } | undefined>(
    undefined,
  );
  if (!proofRef.current || proofRef.current.url !== url || proofRef.current.revision !== trustedLaunch.revision()) {
    let selected: DappPublicSelection | undefined;
    try {
      selected = currentSelection();
    } catch {
      // A missing account fails closed, including before first route render.
    }
    const display = catalogDisplay.current;
    const entry =
      display?.revision === trustedLaunch.revision() && display.entry.websiteUrl === url ? display.entry : undefined;
    catalogDisplay.current = undefined;
    const origin = trustedLaunch.consume(url, selected);
    proofRef.current = { url, revision: trustedLaunch.revision(), origin, entry };
  }
  const choices = browserAccounts?.filter(account => account.identityKind === 'classic' && !account.hidden);
  return (
    <>
      <DappBrowserScreen
        key={reopened ? 'switched:' + reopened.origin + ':' + reopened.revision : url + ':' + proofRef.current.revision}
        url={reopened?.origin ?? url}
        catalogEntry={proofRef.current.entry}
        catalogMedia={catalogMedia}
        online={online}
        accountChoices={choices}
        onSwitchAccount={
          chooseBrowserAccount
            ? async (id, origin) => {
                await chooseBrowserAccount(id);
                setReopened(previous => ({ origin, revision: (previous?.revision ?? 0) + 1 }));
              }
            : undefined
        }
        onSwitchNetwork={browserNetworks ? () => setNetworkPicker(true) : undefined}
        active={focused && foreground}
        onClose={onClose}
        onVisit={onVisit}
        shareWebsite={origin => Share.share({ message: origin })}
        currentSelection={currentSelection}
        subscribeSelection={subscribeSelection}
        signTransaction={signTransaction}
        signMessage={signMessage}
        addAsset={addAsset}
        trackContract={trackContract}
        permissions={permissions}
        requireFreshConnection={reopened !== undefined}
        trustedCatalogOrigin={reopened ? undefined : proofRef.current.origin}
        createNonce={createDappBridgeNonce}
        showNotification={showDappNotification}
        notificationNow={readDappNotificationTime}
        BrowserSurface={SecureDappWebView}
      />
      {networkPicker && browserNetworks ? (
        <NetworkSwitchModal settings={browserNetworks} onClose={closeNetworkPicker} />
      ) : null}
    </>
  );
}
