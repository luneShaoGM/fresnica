import { MarketsScreen } from '@features/markets/MarketsScreen';
import { NetworkSwitchModal } from '@features/settings/NetworkSwitchModal';
import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { Screen, StateView } from '@ui/components';
import { useAppTheme } from '@ui/theme';
import { useLocalization } from '../../locale';
import type { AccountRecord } from '@capabilities/account/types';
import { canContinueRequestToSend } from '../requestDeepLinkRouting';
import { continueRequestToSendIfCurrent, createRequestRouteFocusLifetime } from './requestContinueRouting';
import { createRequestScanLifetime } from './requestScanLifetime';
import {
  captureAccountSelectionSession,
  captureSwapCurrentSession,
  type SwapCurrentSelection,
} from './swapCurrentSession';
import { AddAccountScreen } from '@features/accounts/AddAccountScreen';
import { AddAssetSheet } from '@features/trustlines/AddAssetSheet';
import { AssetDetailsSheet } from '@features/home/AssetDetailsSheet';
import { HomeScreen } from '@features/home/HomeScreen';
import { ClaimableScreen } from '@features/claimable/ClaimableScreen';
import { AssetCategoryDialog, type HomeAssetCategory } from '@features/home/components/AssetCategoryDialog';
import {
  advanceHomeAssetCategory,
  isCurrentClaimableCategory,
  type HomeAssetCategorySelection,
} from './homeAssetCategorySession';
import { CLAIMABLE_TTL_MS, displayedClaimable } from '@capabilities/claimable/records';
import type { ClaimableState } from '@capabilities/claimable/createClaimableProduct';
import { SendFlowScreen } from '@features/send/SendFlowScreen';
import { RequestFlowScreen } from '@features/request/RequestFlowScreen';
import { ManageAssetsScreen } from '@features/trustlines/ManageAssetsScreen';
import type { StellarPaymentAsset } from '../../capabilities/stellar/types';
import { ActionsSwapEntry } from '@features/swap/ActionsSwapEntry';
import { SwapPreviewScreen, SwapUnavailableScreen } from '@features/swap/SwapPreviewScreen';
import { ReactNativeRequestQrScannerView } from '@platform/system/RequestQrScannerView';
import { reactNativeRequestIngress } from '@platform/system/requestIngress';

import type { AppServices } from '../createAppServices';
import { resolveVisibleAccount } from './accountSelection';
import type { HomeStackParamList, MainTabParamList } from './navigationTypes';

const Stack = createNativeStackNavigator<HomeStackParamList>();

type Props = Readonly<{
  accounts: readonly AccountRecord[];
  selectedAccountId: string;
  selectableAccounts: readonly AccountRecord[];
  swapEnabled: boolean;
  onBalanceReload?: () => void;
  services: AppServices;
  onAccountsChanged: () => void;
  onCreatedAccountReady: (accountId: string) => void | Promise<void>;
  onSelectAccount: (accountId: string) => void | Promise<void>;
  getCurrentSwapSelection: () => SwapCurrentSelection | undefined;
  subscribeToSwapSelection: (listener: () => void) => () => void;
}>;

export function HomeStackNavigator({
  accounts,
  selectedAccountId,
  selectableAccounts,
  swapEnabled,
  onBalanceReload,
  services,
  onAccountsChanged,
  onCreatedAccountReady,
  onSelectAccount,
  getCurrentSwapSelection,
  subscribeToSwapSelection,
}: Props) {
  const theme = useAppTheme();
  const [networkSwitchVisible, setNetworkSwitchVisible] = useState(false);
  const closeNetworkSwitch = useCallback(() => setNetworkSwitchVisible(false), []);
  const selectedAccount = resolveVisibleAccount(accounts, selectedAccountId);
  const canSign = !services.onboarding.repository.isWatchOnly(selectedAccount.id);
  const marketSelectionRevision = useSyncExternalStore(
    subscribeToSwapSelection,
    () => getCurrentSwapSelection()?.selectionRevision ?? 0,
    () => 0,
  );
  const captureMarketSession = (isCurrentFocusEpoch: () => boolean) =>
    services.markets
      ? captureSwapCurrentSession({
          account: selectedAccount,
          network: services.markets.network,
          getCurrentSelection: getCurrentSwapSelection,
          isCurrentFocusEpoch,
        })
      : () => false;

  // Async Continue callbacks must read the latest account selection, not their render's captured value.
  const selectionRef = useRef({ selectedAccountId, accounts });
  selectionRef.current = { selectedAccountId, accounts };
  const readRuntime = useSyncExternalStore(
    services.ledgerReadRuntime.subscribe,
    services.ledgerReadRuntime.getSnapshot,
    services.ledgerReadRuntime.getSnapshot,
  );
  const invalidationRevision = useSyncExternalStore(
    services.ledgerReadInvalidation.subscribe,
    () => services.ledgerReadInvalidation.getRevision(selectedAccount.networkId, selectedAccount.id),
    () => 0,
  );

  return (
    <Stack.Navigator initialRouteName="home" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="home">
        {({ navigation }) => (
          <>
            <HomeWithAssetSheets
              xlmQuotes={services.xlmQuotes}
              key={JSON.stringify([selectedAccount.id, selectedAccount.networkId])}
              navigation={navigation}
              catalog={services.assetCatalog}
              markets={services.markets}
              marketSelectionRevision={marketSelectionRevision}
              captureMarketSession={captureMarketSession}
              claimables={services.claimables}
              claimableTransaction={services.claimableTransaction}
              isSelectedAccount={() => {
                const latest = selectionRef.current;
                return (
                  latest.selectedAccountId === selectedAccount.id &&
                  latest.accounts.some(
                    candidate =>
                      candidate.id === selectedAccount.id &&
                      candidate.networkId === selectedAccount.networkId &&
                      !candidate.hidden,
                  )
                );
              }}
              onRecover={() => services.transactionRecovery.reconcile('manual-refresh')}
              developerMode={services.networkSettings?.getSnapshot().preferences.developerMode ?? false}
              foreground={readRuntime.foreground}
              account={selectedAccount}
              accountCount={selectableAccounts.length}
              selectableAccounts={selectableAccounts}
              balanceDependencies={services.balance}
              friendbotDependencies={services.friendbot}
              canSign={canSign}
              onSelectAccount={onSelectAccount}
              onSwitchNetwork={services.networkSettings ? () => setNetworkSwitchVisible(true) : undefined}
              onAddAccount={() => navigation.navigate('add-account')}
              onOrders={
                services.markets && selectedAccount.identityKind === 'classic'
                  ? () => navigation.navigate('orders', { accountId: selectedAccount.id })
                  : undefined
              }
              onSend={() => navigation.navigate('send-form', { accountId: selectedAccount.id })}
              onSwap={swapEnabled ? () => navigation.navigate('swap', { accountId: selectedAccount.id }) : undefined}
              onRequest={
                selectedAccount.identityKind === 'classic'
                  ? () => navigation.navigate('request', { accountId: selectedAccount.id })
                  : undefined
              }
              onManualRefresh={() => services.transactionRecovery.reconcile('manual-refresh')}
              onBalanceReload={onBalanceReload}
              invalidationRevision={invalidationRevision}
            />
            {networkSwitchVisible && services.networkSettings ? (
              <NetworkSwitchModal
                settings={services.networkSettings}
                monitor={services.nodeReadSession}
                onClose={closeNetworkSwitch}
                onOpenDeveloperMode={() =>
                  (navigation.getParent() as BottomTabNavigationProp<MainTabParamList> | undefined)?.navigate(
                    'settings',
                    { screen: 'advanced-settings' },
                  )
                }
              />
            ) : null}
          </>
        )}
      </Stack.Screen>
      <Stack.Screen
        name="asset-details"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.88],
          sheetGrabberVisible: true,
          sheetCornerRadius: theme.radii.lg,
          contentStyle: { backgroundColor: theme.colors.surface },
        }}
      >
        {({ navigation, route }) => {
          const account = accounts.find(candidate => candidate.id === route.params.accountId && !candidate.hidden);
          const current =
            !!account && account.id === selectedAccount.id && account.networkId === route.params.networkId;
          return (
            <AssetDetailsRoute
              foreground={readRuntime.foreground}
              current={current}
              onDiscard={() => navigation.popToTop()}
            >
              {account && current ? (
                <AssetDetailsSheet
                  key={JSON.stringify([account.id, account.networkId, route.params.asset])}
                  account={account}
                  asset={route.params.asset}
                  balanceDependencies={services.balance}
                  active={readRuntime.foreground}
                  invalidationRevision={invalidationRevision}
                  canSign={canSign}
                  copyPublicText={services.copyPublicText}
                  onClose={() => navigation.goBack()}
                  onSend={asset => {
                    if (!readRuntime.foreground || !current || !canSign) return;
                    navigation.replace('send-form', { accountId: account.id, initialAsset: asset });
                  }}
                  onRemove={asset => {
                    if (!readRuntime.foreground || !current || !canSign) return;
                    navigation.replace('manage-assets', {
                      accountId: account.id,
                      requestedAction: { action: 'remove', code: asset.code, issuer: asset.issuer },
                    });
                  }}
                />
              ) : null}
            </AssetDetailsRoute>
          );
        }}
      </Stack.Screen>
      <Stack.Screen name="add-account">
        {({ navigation }) => (
          <AddAccountScreen
            dependencies={services.onboarding}
            onAccountPersisted={onAccountsChanged}
            onCreatedAccountReady={async accountId => {
              await onCreatedAccountReady(accountId);
              navigation.popToTop();
            }}
            onWatchOnlyComplete={() => {
              onAccountsChanged();
              navigation.popToTop();
            }}
            onCancel={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="send-form">
        {({ navigation, route }) => {
          const account = resolveVisibleAccount(accounts, route.params.accountId);
          if (
            route.params.initialAsset &&
            (account.id !== route.params.accountId || account.id !== selectedAccount.id)
          ) {
            return <AssetAccountUnavailable onBack={() => navigation.popToTop()} />;
          }
          return (
            <SendRoute
              foreground={readRuntime.foreground}
              account={account}
              key={JSON.stringify([account.id, account.networkId])}
              contacts={services.contacts}
              scanner={{ ScannerView: ReactNativeRequestQrScannerView, ingress: reactNativeRequestIngress }}
              destinationAccounts={accounts}
              dependencies={services.send}
              requestIntent={route.params.requestIntent}
              initialAsset={route.params.initialAsset}
              onDone={() => navigation.popToTop()}
            />
          );
        }}
      </Stack.Screen>
      <Stack.Screen name="orders">
        {({ navigation, route }) => {
          if (
            !services.markets ||
            selectedAccount.id !== route.params.accountId ||
            selectedAccount.networkId !== services.markets.networkId
          )
            return <AssetAccountUnavailable onBack={() => navigation.popToTop()} />;
          return (
            <MarketsScreen
              key={JSON.stringify([selectedAccount.id, selectedAccount.networkId])}
              account={selectedAccount}
              product={services.markets}
              selectionRevision={marketSelectionRevision}
              captureSession={captureMarketSession}
              kind="orders"
              active={readRuntime.foreground}
              canSign={canSign}
              invalidationRevision={invalidationRevision}
              onBack={() => navigation.goBack()}
              onRecover={() => services.transactionRecovery.reconcile('manual-refresh')}
              isCurrentAccount={() =>
                navigation.isFocused() && selectionRef.current.selectedAccountId === route.params.accountId
              }
            />
          );
        }}
      </Stack.Screen>
      <Stack.Screen name="swap">
        {({ navigation, route }) => (
          <SwapPreviewRoute
            foreground={readRuntime.foreground}
            selectSource={route.params.selectSource === true}
            account={accounts.find(
              candidate =>
                candidate.id === route.params.accountId &&
                candidate.networkId === services.swapPreview.network.id &&
                !candidate.hidden,
            )}
            services={services}
            getCurrentSelection={getCurrentSwapSelection}
            subscribeToSelection={subscribeToSwapSelection}
            navigation={navigation}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="request">
        {({ navigation, route }) => (
          <RequestRoute
            account={resolveVisibleAccount(accounts, route.params.accountId)}
            activeAccountId={selectedAccountId}
            canSign={canSign}
            services={services}
            navigation={navigation}
            getCurrentSelection={() => selectionRef.current}
            initialScan={route.params.initialScan === true}
            getCurrentScanSelection={getCurrentSwapSelection}
            onScannedWebsite={url => {
              if (!navigation.isFocused() || selectionRef.current.selectedAccountId !== route.params.accountId) return;
              const tabs = navigation.getParent() as BottomTabNavigationProp<MainTabParamList> | undefined;
              navigation.popToTop();
              tabs?.navigate('dapps', {
                screen: 'dapps',
                params: { scannedUrl: url },
              });
            }}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="manage-assets">
        {({ navigation, route }) => {
          const account = resolveVisibleAccount(accounts, route.params.accountId);
          if (
            route.params.requestedAction &&
            (account.id !== route.params.accountId ||
              account.id !== selectedAccount.id ||
              account.networkId !== services.trustline.network.id)
          ) {
            return <AssetAccountUnavailable onBack={() => navigation.popToTop()} />;
          }
          return (
            <ManageAssetsScreen
              account={account}
              key={JSON.stringify([account.id, account.networkId])}
              dependencies={services.trustline}
              balanceDependencies={services.balance}
              catalog={services.assetCatalog}
              foreground={readRuntime.foreground}
              invalidationRevision={invalidationRevision}
              requestedAdd={route.params.requestedAction}
              onReviewDismiss={() => navigation.goBack()}
              onDone={() => navigation.popToTop()}
            />
          );
        }}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

type SwapPreviewRouteProps = Readonly<{
  foreground: boolean;
  selectSource?: boolean;
  account: AccountRecord | undefined;
  services: AppServices;
  getCurrentSelection: () => SwapCurrentSelection | undefined;
  subscribeToSelection: (listener: () => void) => () => void;
  navigation: NativeStackNavigationProp<HomeStackParamList, 'swap'>;
}>;

function SwapPreviewRoute({
  foreground,
  selectSource,
  account,
  services,
  getCurrentSelection,
  subscribeToSelection,
  navigation,
}: SwapPreviewRouteProps) {
  const focusLifetimeRef = useRef<ReturnType<typeof createRequestRouteFocusLifetime> | undefined>(undefined);
  if (focusLifetimeRef.current === undefined) {
    focusLifetimeRef.current = createRequestRouteFocusLifetime();
  }
  const focusLifetime = focusLifetimeRef.current;
  const [focusReady, setFocusReady] = useState(false);
  useFocusEffect(
    useCallback(() => {
      focusLifetime.focus();
      setFocusReady(true);
      return () => {
        focusLifetime.blur();
        setFocusReady(false);
      };
    }, [focusLifetime]),
  );
  const active = useIsFocused();
  const selectionRevision = useSyncExternalStore(
    subscribeToSelection,
    () => getCurrentSelection()?.selectionRevision ?? 0,
    () => 0,
  );
  const actualSelectedAccountId = getCurrentSelection()?.selectedAccountId ?? '';
  const captureSession = useCallback(() => {
    const currentFocus = focusLifetime.capture();
    if (!account) return () => false;
    return captureSwapCurrentSession({
      account,
      network: services.swapPreview.network,
      getCurrentSelection,
      isCurrentFocusEpoch: () => currentFocus() && navigation.isFocused(),
    });
  }, [account, focusLifetime, getCurrentSelection, navigation, services.swapPreview.network]);
  // The child must mount only AFTER the route's focus epoch is established.
  // Passive effect ordering alone cannot guarantee that its initial balance
  // request captures a valid focus epoch.
  if (!active || !focusReady) return null;
  if (!account) return <SwapUnavailableScreen onDone={() => navigation.goBack()} />;
  const preview = (initialSourceAsset?: StellarPaymentAsset) => (
    <SwapPreviewScreen
      key={String(selectionRevision)}
      account={account}
      initialSourceAsset={initialSourceAsset}
      active={active}
      foreground={foreground}
      selectedAccountId={actualSelectedAccountId}
      dependencies={services.swapPreview}
      execution={services.swapExecution}
      copyPublicText={services.copyPublicText}
      openExternalUrl={services.externalUrl.open}
      captureSession={captureSession}
      onDone={() => navigation.popToTop()}
    />
  );
  if (!selectSource) return preview();
  if (services.onboarding.repository.isWatchOnly(account.id))
    return <SwapUnavailableScreen onDone={() => navigation.popToTop()} />;
  return (
    <ActionsSwapEntry
      key={JSON.stringify([
        selectionRevision,
        account.id,
        account.address,
        account.networkId,
        services.swapPreview.network.networkPassphrase,
      ])}
      account={account}
      dependencies={services.swapPreview}
      captureSession={captureSession}
      foreground={foreground}
      onBack={() => navigation.popToTop()}
    >
      {preview}
    </ActionsSwapEntry>
  );
}

type RequestRouteProps = Readonly<{
  account: AccountRecord;
  activeAccountId: string;
  canSign: boolean;
  services: AppServices;
  navigation: NativeStackNavigationProp<HomeStackParamList, 'request'>;
  getCurrentSelection: () => Readonly<{ selectedAccountId: string; accounts: readonly AccountRecord[] }>;
  initialScan?: boolean;
  onScannedWebsite?: (url: string) => void;
  getCurrentScanSelection: () => SwapCurrentSelection | undefined;
}>;

function RequestRoute({
  account,
  activeAccountId,
  canSign,
  services,
  navigation,
  getCurrentSelection,
  initialScan,
  onScannedWebsite,
  getCurrentScanSelection,
}: RequestRouteProps) {
  const focusLifetimeRef = useRef<ReturnType<typeof createRequestRouteFocusLifetime> | undefined>(undefined);
  if (focusLifetimeRef.current === undefined) {
    focusLifetimeRef.current = createRequestRouteFocusLifetime();
  }
  const focusLifetime = focusLifetimeRef.current;

  const focused = useIsFocused();
  const foreground = useSyncExternalStore(
    services.ledgerReadRuntime.subscribe,
    () => services.ledgerReadRuntime.getSnapshot().foreground,
    () => false,
  );
  const scanLifetimeRef = useRef<ReturnType<typeof createRequestScanLifetime> | undefined>(undefined);
  const [focusReady, setFocusReady] = useState(false);

  useFocusEffect(
    useCallback(() => {
      focusLifetime.focus();
      const scanLifetime = createRequestScanLifetime(services.ledgerReadRuntime, retire => {
        const subscription = AppState.addEventListener('change', state => {
          // System permission dialogs may make iOS inactive without backgrounding the scanner.
          if (state === 'background') retire();
        });
        return () => subscription.remove();
      });
      scanLifetimeRef.current = scanLifetime;
      setFocusReady(true);
      return () => {
        focusLifetime.blur();
        scanLifetime.close();
      };
    }, [focusLifetime, services.ledgerReadRuntime]),
  );
  const captureScanSession = useCallback(
    (source: 'camera' | 'photo') => {
      const currentFocus = focusLifetime.capture();
      const isCurrentRoute = captureAccountSelectionSession({
        account,
        network: services.request.network,
        getCurrentSelection: getCurrentScanSelection,
        isCurrentFocusEpoch: () => currentFocus() && navigation.isFocused(),
      });
      return scanLifetimeRef.current?.capture(source, isCurrentRoute) ?? (() => false);
    },
    [account, focusLifetime, getCurrentScanSelection, navigation, services.request.network],
  );

  // Establish the route epoch before the child's initial camera effect runs.
  if (!focusReady) return null;

  return (
    <RequestFlowScreen
      account={account}
      activeAccountId={activeAccountId}
      initialScan={initialScan}
      foreground={foreground && focused}
      captureScanSession={captureScanSession}
      onScannedWebsite={(url, isCurrent) => {
        scanLifetimeRef.current?.deliverWhenForeground(isCurrent, () => onScannedWebsite?.(url));
      }}
      dependencies={services.request}
      onDone={() => navigation.popToTop()}
      onContinueSend={async (intent, isCurrent) => {
        if (account.identityKind !== 'classic') throw new Error('request-send-ineligible');
        const isSameFocusLifetime = focusLifetime.capture();
        const isCurrentRoute = () => {
          const latest = getCurrentSelection();
          if (
            !isSameFocusLifetime() ||
            !navigation.isFocused() ||
            latest.selectedAccountId !== account.id ||
            !latest.accounts.some(
              candidate =>
                candidate.id === account.id &&
                candidate.networkId === services.send.network.id &&
                candidate.identityKind === 'classic' &&
                !candidate.hidden,
            )
          ) {
            return false;
          }
          try {
            return !services.onboarding.repository.isWatchOnly(account.id);
          } catch {
            return false;
          }
        };

        await continueRequestToSendIfCurrent({
          isCurrentAttempt: isCurrent,
          isCurrentRoute,
          checkEligibility: () => canContinueRequestToSend(services.send, intent, account, !canSign),
          navigate: () => navigation.navigate('send-form', { accountId: account.id, requestIntent: intent }),
        });
      }}
      ScannerView={ReactNativeRequestQrScannerView}
    />
  );
}

function HomeWithAssetSheets({
  foreground,
  navigation,
  catalog,
  claimables,
  markets,
  marketSelectionRevision,
  captureMarketSession,
  claimableTransaction,
  isSelectedAccount,
  onRecover,
  developerMode,
  ...props
}: Omit<React.ComponentProps<typeof HomeScreen>, 'active' | 'onManageAssets' | 'onOpenAsset'> & {
  foreground: boolean;
  navigation: NativeStackNavigationProp<HomeStackParamList, 'home'>;
  catalog: AppServices['assetCatalog'];
  markets?: AppServices['markets'];
  marketSelectionRevision: number;
  captureMarketSession: (isCurrentFocusEpoch: () => boolean) => () => boolean;
  claimables: AppServices['claimables'];
  claimableTransaction: AppServices['claimableTransaction'];
  isSelectedAccount: () => boolean;
  onRecover: () => Promise<unknown>;
  developerMode: boolean;
}) {
  const focused = useIsFocused();
  const active = focused && foreground;
  const [categorySelection, setCategorySelection] = useState<HomeAssetCategorySelection>({
    value: 'tokens',
    epoch: 0,
  });
  const categoryRef = useRef(categorySelection);
  const assetCategory = categorySelection.value;
  const renderedCategoryEpoch = categorySelection.epoch;
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [claimableState, setClaimableState] = useState<ClaimableState>();
  const canReadClaimable =
    props.account.identityKind === 'classic' &&
    props.account.networkId === claimables.networkId &&
    !props.account.hidden;
  const cachedClaimable = canReadClaimable ? claimables.readCached(props.account) : undefined;
  const state = claimableState ?? cachedClaimable;
  const showClaimable =
    canReadClaimable && (developerMode || !!state?.snapshot.records.length || state?.snapshot.everSeen === true);
  const isCurrentClaimable = useCallback(
    () =>
      isCurrentClaimableCategory(categoryRef.current, renderedCategoryEpoch) &&
      navigation.isFocused() &&
      isSelectedAccount(),
    [isSelectedAccount, navigation, renderedCategoryEpoch],
  );
  useEffect(() => {
    if (!active || !canReadClaimable) return;
    let retained = true;
    void claimables
      .refresh(props.account)
      .then(value => {
        if (retained) setClaimableState(value);
      })
      .catch(() => undefined);
    return () => {
      retained = false;
    };
  }, [active, canReadClaimable, claimables, props.account]);
  const onSnapshotUpdated = useCallback((snapshot: ClaimableState) => setClaimableState(snapshot), []);
  const chooseCategory = (next: HomeAssetCategory) => {
    if (next === 'pools' && (!markets || props.account.identityKind !== 'classic')) return;
    if (next === 'claimable' && !showClaimable) return;
    // Advance the non-revivable session epoch synchronously. A fast
    // Claimable -> Assets -> Claimable sequence must never revive an
    // authorization launched by the first Claimable selection.
    const selection = advanceHomeAssetCategory(categoryRef.current, next);
    categoryRef.current = selection;
    setCategorySelection(selection);
    setCategoryPickerVisible(false);
    setSheet(undefined);
  };
  const safeClaimableNowCount =
    state &&
    !state.stale &&
    Date.now() >= state.snapshot.savedAt &&
    Date.now() - state.snapshot.savedAt < CLAIMABLE_TTL_MS
      ? state.snapshot.records.filter(record => {
          const shown = displayedClaimable(record, Math.floor(Date.now() / 1000), {
            userSpam: claimables.userSpam(props.account, record.id),
          });
          return shown.risk === 'SAFE' && shown.availability === 'claimable';
        }).length
      : 0;
  const [sheet, setSheet] = useState<'add'>();
  useFocusEffect(useCallback(() => () => setSheet(undefined), []));
  const manage = (action: 'add' | 'remove', asset: { code: string; issuer: string }) => {
    if (!active || !props.canSign) return;
    setSheet(undefined);
    navigation.navigate('manage-assets', { accountId: props.account.id, requestedAction: { action, ...asset } });
  };
  return (
    <>
      <HomeScreen
        {...props}
        active={active}
        assetCategory={assetCategory}
        claimableNowCount={safeClaimableNowCount}
        onOpenAssetCategory={() => setCategoryPickerVisible(true)}
        onShowClaimable={showClaimable ? () => chooseCategory('claimable') : undefined}
        onClaimablePullRefresh={() => setRefreshSignal(value => value + 1)}
        poolsContent={
          assetCategory === 'pools' && markets ? (
            <MarketsScreen
              account={props.account}
              product={markets}
              selectionRevision={marketSelectionRevision}
              captureSession={captureMarketSession}
              kind="pools"
              active={active}
              canSign={props.canSign}
              invalidationRevision={props.invalidationRevision}
              refreshSignal={refreshSignal}
              onRecover={onRecover}
              isCurrentAccount={() =>
                categoryRef.current.value === 'pools' &&
                categoryRef.current.epoch === renderedCategoryEpoch &&
                navigation.isFocused() &&
                isSelectedAccount()
              }
            />
          ) : undefined
        }
        claimableContent={
          assetCategory === 'claimable' && canReadClaimable ? (
            <ClaimableScreen
              account={props.account}
              product={claimables}
              transaction={claimableTransaction}
              active={active}
              canSign={props.canSign}
              invalidationRevision={props.invalidationRevision}
              refreshSignal={refreshSignal}
              onSnapshotUpdated={onSnapshotUpdated}
              onRecover={onRecover}
              isCurrentAccount={isCurrentClaimable}
            />
          ) : undefined
        }
        onManageAssets={() => setSheet('add')}
        onOpenAsset={asset => {
          if (active && isSelectedAccount())
            navigation.navigate('asset-details', {
              accountId: props.account.id,
              networkId: props.account.networkId,
              asset,
            });
        }}
      />
      <AssetCategoryDialog
        visible={active && categoryPickerVisible}
        current={assetCategory}
        showPools={!!markets && props.account.identityKind === 'classic'}
        showClaimable={showClaimable}
        onClose={() => setCategoryPickerVisible(false)}
        onSelect={chooseCategory}
      />
      {active && sheet === 'add' ? (
        <AddAssetSheet
          account={props.account}
          balanceDependencies={props.balanceDependencies}
          catalog={catalog}
          active={active}
          invalidationRevision={props.invalidationRevision}
          visible={active}
          onClose={() => setSheet(undefined)}
          onAddAndSign={asset => manage('add', asset)}
        />
      ) : null}
    </>
  );
}

function SendRoute({
  foreground,
  ...props
}: Omit<React.ComponentProps<typeof SendFlowScreen>, 'active'> & { foreground: boolean }) {
  const focused = useIsFocused();
  return <SendFlowScreen {...props} active={focused && foreground} />;
}

function AssetDetailsRoute({
  foreground,
  current,
  onDiscard,
  children,
}: React.PropsWithChildren<{
  foreground: boolean;
  current: boolean;
  onDiscard: () => void;
}>) {
  const focused = useIsFocused();
  const active = foreground && current && focused;
  useEffect(() => {
    if (!active) onDiscard();
  }, [active, onDiscard]);
  return active ? children : null;
}

function AssetAccountUnavailable({ onBack }: { onBack: () => void }) {
  const { t } = useLocalization();
  return (
    <Screen>
      <StateView
        kind="empty"
        title={t('home.asset.accountUnavailable')}
        message={t('home.asset.accountChanged')}
        actionLabel={t('common.back')}
        onAction={onBack}
      />
    </Screen>
  );
}
