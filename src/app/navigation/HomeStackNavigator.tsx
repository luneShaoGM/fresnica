import React, { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { AccountRecord } from '@capabilities/account/types';
import type { BalanceAsset } from '@capabilities/balance/types';
import { canContinueRequestToSend } from '../requestDeepLinkRouting';
import { continueRequestToSendIfCurrent, createRequestRouteFocusLifetime } from './requestContinueRouting';
import { captureSwapCurrentSession, type SwapCurrentSelection } from './swapCurrentSession';
import { isSwapAvailableForAccount } from './swapAvailability';
import { AddAccountScreen } from '@features/accounts/AddAccountScreen';
import { AssetDetailsScreen } from '@features/home/AssetDetailsScreen';
import { AssetDetailsSheet } from '@features/home/AssetDetailsSheet';
import { HomeScreen } from '@features/home/HomeScreen';
import { SendFlowScreen } from '@features/send/SendFlowScreen';
import { RequestFlowScreen } from '@features/request/RequestFlowScreen';
import { ManageAssetsScreen } from '@features/trustlines/ManageAssetsScreen';
import { AddAssetSheet } from '@features/trustlines/AddAssetSheet';
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
  const pendingAddRef = useRef<
    Readonly<{ accountId: string; action: 'add' | 'remove'; code: string; issuer: string }> | undefined
  >(undefined);
  const pendingSendAssetRef = useRef<BalanceAsset | undefined>(undefined);
  const pendingSwapAssetRef = useRef<BalanceAsset | undefined>(undefined);
  const invalidationRevision = useSyncExternalStore(
    services.ledgerReadInvalidation.subscribe,
    () => services.ledgerReadInvalidation.getRevision(selectedAccount.networkId, selectedAccount.id),
    () => 0,
  );

  return (
    <Stack.Navigator initialRouteName="home" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="home">
        {({ navigation }) => (
          <HomeWithAddAsset
            account={selectedAccount}
            accountCount={selectableAccounts.length}
            selectableAccounts={selectableAccounts}
            balanceDependencies={services.balance}
            balanceCache={services.balanceCache}
            friendbotDependencies={services.friendbot}
            canSign={canSign}
            onSelectAccount={onSelectAccount}
            onAddAccount={() => navigation.navigate('add-account')}
            onSend={() => {
              pendingSendAssetRef.current = undefined;
              navigation.navigate('send-form', { accountId: selectedAccount.id });
            }}
            onRequest={
              selectedAccount.identityKind === 'classic'
                ? () => navigation.navigate('request', { accountId: selectedAccount.id })
                : undefined
            }
            onSwap={
              isSwapAvailableForAccount(selectedAccount, canSign)
                ? () => {
                    pendingSwapAssetRef.current = undefined;
                    navigation.navigate('exchange', { accountId: selectedAccount.id });
                  }
                : undefined
            }
            onManualRefresh={() => services.transactionRecovery.reconcile('manual-refresh')}
            invalidationRevision={invalidationRevision}
            navigation={navigation}
            pendingAddRef={pendingAddRef}
            pendingSendAssetRef={pendingSendAssetRef}
            pendingSwapAssetRef={pendingSwapAssetRef}
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
              initialAsset={pendingSendAssetRef.current}
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
            pendingAddRef={pendingAddRef}
            preferredSource={pendingSwapAssetRef.current}
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
          const pending = pendingAddRef.current;
          const requestedAdd =
            pending?.accountId === account.id
              ? { action: pending.action, code: pending.code, issuer: pending.issuer }
              : undefined;
          return (
            <ManageAssetsScreen
              account={account}
              dependencies={services.trustline}
              onDone={() => navigation.popToTop()}
              onRequestedAddConsumed={() => {
                pendingAddRef.current = undefined;
              }}
              onReviewDismiss={() => navigation.goBack()}
              requestedAdd={requestedAdd}
            />
          );
        }}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

type PendingAdd = Readonly<{ accountId: string; action: 'add' | 'remove'; code: string; issuer: string }>;

type SwapPreviewRouteProps = Readonly<{
  account: AccountRecord | undefined;
  services: AppServices;
  getCurrentSelection: () => SwapCurrentSelection | undefined;
  subscribeToSelection: (listener: () => void) => () => void;
  navigation: NativeStackNavigationProp<HomeStackParamList, 'exchange'>;
  pendingAddRef: React.MutableRefObject<PendingAdd | undefined>;
  preferredSource?: BalanceAsset;
}>;

function SwapPreviewRoute({
  account,
  services,
  getCurrentSelection,
  subscribeToSelection,
  navigation,
  pendingAddRef,
  preferredSource,
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
  const [addAssetOpen, setAddAssetOpen] = useState(false);
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
    <>
      <SwapPreviewScreen
        key={String(selectionRevision)}
        account={account}
        active={active}
        selectedAccountId={actualSelectedAccountId}
        dependencies={services.swapPreview}
        execution={services.swapExecution}
        captureSession={captureSession}
        openExternalUrl={services.externalUrl.open}
        onManageAssets={() => setAddAssetOpen(true)}
        onDone={() => navigation.popToTop()}
        preferredSource={preferredSource}
      />
      <AddAssetSheet
        account={account}
        balanceDependencies={services.swapPreview.balance}
        onAddAndSign={asset => {
          pendingAddRef.current = { accountId: account.id, action: 'add', code: asset.code, issuer: asset.issuer };
          setAddAssetOpen(false);
          navigation.navigate('manage-assets', { accountId: account.id });
        }}
        onClose={() => setAddAssetOpen(false)}
        signing={false}
        visible={addAssetOpen}
      />
    </>
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

function HomeWithAddAsset({
  navigation,
  pendingAddRef,
  pendingSendAssetRef,
  pendingSwapAssetRef,
  ...props
}: Omit<React.ComponentProps<typeof HomeScreen>, 'active' | 'onManageAssets' | 'onOpenAsset'> &
  Readonly<{
    navigation: NativeStackNavigationProp<HomeStackParamList, 'home'>;
    pendingAddRef: React.MutableRefObject<PendingAdd | undefined>;
    pendingSendAssetRef: React.MutableRefObject<BalanceAsset | undefined>;
    pendingSwapAssetRef: React.MutableRefObject<BalanceAsset | undefined>;
  }>) {
  const active = useIsFocused();
  const [addAssetOpen, setAddAssetOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<BalanceAsset>();
  return (
    <>
      <HomeScreen
        {...props}
        active={active}
        onManageAssets={() => setAddAssetOpen(true)}
        onOpenAsset={setSelectedAsset}
      />
      <AddAssetSheet
        account={props.account}
        balanceDependencies={props.balanceDependencies}
        onAddAndSign={asset => {
          pendingAddRef.current = {
            accountId: props.account.id,
            action: 'add',
            code: asset.code,
            issuer: asset.issuer,
          };
          setAddAssetOpen(false);
          navigation.navigate('manage-assets', { accountId: props.account.id });
        }}
        onClose={() => setAddAssetOpen(false)}
        visible={addAssetOpen}
      />
      <AssetDetailsSheet
        account={props.account}
        asset={selectedAsset}
        balanceCache={props.balanceCache}
        balanceDependencies={props.balanceDependencies}
        canSign={props.canSign}
        canSwap={typeof props.onSwap === 'function'}
        onClose={() => setSelectedAsset(undefined)}
        onRemove={asset => {
          pendingAddRef.current = {
            accountId: props.account.id,
            action: 'remove',
            code: asset.code,
            issuer: asset.issuer,
          };
          setSelectedAsset(undefined);
          navigation.navigate('manage-assets', { accountId: props.account.id });
        }}
        onSend={asset => {
          pendingSendAssetRef.current = asset;
          setSelectedAsset(undefined);
          navigation.navigate('send-form', { accountId: props.account.id });
        }}
        onSwap={asset => {
          pendingSwapAssetRef.current = asset;
          setSelectedAsset(undefined);
          navigation.navigate('exchange', { accountId: props.account.id });
        }}
        visible={selectedAsset !== undefined}
      />
    </>
  );
}

function AssetDetailsRoute(props: Omit<React.ComponentProps<typeof AssetDetailsScreen>, 'active'>) {
  const active = useIsFocused();
  return <AssetDetailsScreen {...props} active={active} />;
}
