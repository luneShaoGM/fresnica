import React, { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { AccountRecord } from '@capabilities/account/types';
import { canContinueRequestToSend } from '../requestDeepLinkRouting';
import { continueRequestToSendIfCurrent, createRequestRouteFocusLifetime } from './requestContinueRouting';
import { captureSwapCurrentSession, type SwapCurrentSelection } from './swapCurrentSession';
import { isSwapAvailableForAccount } from './swapAvailability';
import { AddAccountScreen } from '@features/accounts/AddAccountScreen';
import { AssetDetailsScreen } from '@features/home/AssetDetailsScreen';
import { HomeScreen } from '@features/home/HomeScreen';
import { SendFlowScreen } from '@features/send/SendFlowScreen';
import { RequestFlowScreen } from '@features/request/RequestFlowScreen';
import { ManageAssetsScreen } from '@features/trustlines/ManageAssetsScreen';
import { SwapLoadingScreen, SwapPreviewScreen, SwapUnavailableScreen } from '@features/swap/SwapPreviewScreen';
import { ReactNativeRequestQrScannerView } from '@platform/system/RequestQrScannerView';

import type { AppServices } from '../createAppServices';
import { resolveVisibleAccount } from './accountSelection';
import type { HomeStackParamList } from './navigationTypes';

const Stack = createNativeStackNavigator<HomeStackParamList>();

type Props = Readonly<{
  accounts: readonly AccountRecord[];
  selectedAccountId: string;
  selectableAccounts: readonly AccountRecord[];
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
  services,
  onAccountsChanged,
  onCreatedAccountReady,
  onSelectAccount,
  getCurrentSwapSelection,
  subscribeToSwapSelection,
}: Props) {
  const selectedAccount = resolveVisibleAccount(accounts, selectedAccountId);
  const canSign = !services.onboarding.repository.isWatchOnly(selectedAccount.id);
  // Async Continue callbacks must read the latest account selection, not their render's captured value.
  const selectionRef = useRef({ selectedAccountId, accounts });
  selectionRef.current = { selectedAccountId, accounts };
  const invalidationRevision = useSyncExternalStore(
    services.ledgerReadInvalidation.subscribe,
    () => services.ledgerReadInvalidation.getRevision(selectedAccount.networkId, selectedAccount.id),
    () => 0,
  );

  return (
    <Stack.Navigator initialRouteName="home" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="home">
        {({ navigation }) => (
          <HomeRoute
            account={selectedAccount}
            accountCount={selectableAccounts.length}
            selectableAccounts={selectableAccounts}
            balanceDependencies={services.balance}
            balanceCache={services.balanceCache}
            friendbotDependencies={services.friendbot}
            canSign={canSign}
            onSelectAccount={onSelectAccount}
            onAddAccount={() => navigation.navigate('add-account')}
            onSend={() => navigation.navigate('send-form', { accountId: selectedAccount.id })}
            onRequest={
              selectedAccount.identityKind === 'classic'
                ? () => navigation.navigate('request', { accountId: selectedAccount.id })
                : undefined
            }
            onManageAssets={() => navigation.navigate('manage-assets', { accountId: selectedAccount.id })}
            onOpenAsset={asset => navigation.navigate('asset-details', { accountId: selectedAccount.id, asset })}
            onSwap={
              isSwapAvailableForAccount(selectedAccount, canSign)
                ? () => navigation.navigate('exchange', { accountId: selectedAccount.id })
                : undefined
            }
            onManualRefresh={() => services.transactionRecovery.reconcile('manual-refresh')}
            invalidationRevision={invalidationRevision}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="asset-details">
        {({ navigation, route }) => {
          const account = resolveVisibleAccount(accounts, route.params.accountId);
          return (
            <AssetDetailsRoute
              account={account}
              asset={route.params.asset}
              dependencies={services.balance}
              invalidationRevision={invalidationRevision}
              onBack={() => navigation.goBack()}
            />
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
          return (
            <SendFlowScreen
              account={account}
              dependencies={services.send}
              requestIntent={route.params.requestIntent}
              onDone={() => navigation.popToTop()}
            />
          );
        }}
      </Stack.Screen>
      <Stack.Screen name="exchange">
        {({ navigation, route }) => (
          <SwapPreviewRoute
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
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="manage-assets">
        {({ navigation, route }) => {
          const account = resolveVisibleAccount(accounts, route.params.accountId);
          return (
            <ManageAssetsScreen
              account={account}
              dependencies={services.trustline}
              onDone={() => navigation.popToTop()}
            />
          );
        }}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

type SwapPreviewRouteProps = Readonly<{
  account: AccountRecord | undefined;
  services: AppServices;
  getCurrentSelection: () => SwapCurrentSelection | undefined;
  subscribeToSelection: (listener: () => void) => () => void;
  navigation: NativeStackNavigationProp<HomeStackParamList, 'exchange'>;
}>;

function SwapPreviewRoute({
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
  if (!active || !focusReady) return <SwapLoadingScreen />;
  if (!account) return <SwapUnavailableScreen onDone={() => navigation.goBack()} />;
  return (
    <SwapPreviewScreen
      key={String(selectionRevision)}
      account={account}
      active={active}
      selectedAccountId={actualSelectedAccountId}
      dependencies={services.swapPreview}
      execution={services.swapExecution}
      captureSession={captureSession}
      openExternalUrl={services.externalUrl.open}
      onManageAssets={() => navigation.navigate('manage-assets', { accountId: account.id })}
      onDone={() => navigation.popToTop()}
    />
  );
}

type RequestRouteProps = Readonly<{
  account: AccountRecord;
  activeAccountId: string;
  canSign: boolean;
  services: AppServices;
  navigation: NativeStackNavigationProp<HomeStackParamList, 'request'>;
  getCurrentSelection: () => Readonly<{ selectedAccountId: string; accounts: readonly AccountRecord[] }>;
}>;

function RequestRoute({
  account,
  activeAccountId,
  canSign,
  services,
  navigation,
  getCurrentSelection,
}: RequestRouteProps) {
  const focusLifetimeRef = useRef<ReturnType<typeof createRequestRouteFocusLifetime> | undefined>(undefined);
  if (focusLifetimeRef.current === undefined) {
    focusLifetimeRef.current = createRequestRouteFocusLifetime();
  }
  const focusLifetime = focusLifetimeRef.current;

  // A blur permanently invalidates attempts from the previous focus epoch,
  // even when the user returns to this still-mounted Request screen.
  useFocusEffect(
    useCallback(() => {
      focusLifetime.focus();
      return () => focusLifetime.blur();
    }, [focusLifetime]),
  );

  return (
    <RequestFlowScreen
      account={account}
      activeAccountId={activeAccountId}
      dependencies={services.request}
      onDone={() => navigation.popToTop()}
      onContinueSend={async (intent, isCurrent) => {
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

function HomeRoute(props: Omit<React.ComponentProps<typeof HomeScreen>, 'active'>) {
  const active = useIsFocused();
  return <HomeScreen {...props} active={active} />;
}

function AssetDetailsRoute(props: Omit<React.ComponentProps<typeof AssetDetailsScreen>, 'active'>) {
  const active = useIsFocused();
  return <AssetDetailsScreen {...props} active={active} />;
}
