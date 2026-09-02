import React, {useCallback, useEffect, useState} from 'react';

import type {AccountRecord} from '../../capabilities/account/types';
import {AccountDetailsScreen} from '../../features/accounts/AccountDetailsScreen';
import {AccountsScreen} from '../../features/accounts/AccountsScreen';
import {AddWatchOnlyAccountScreen} from '../../features/accounts/AddWatchOnlyAccountScreen';
import {ActivityHomeScreen} from '../../features/history/ActivityHomeScreen';
import {HomeScreen} from '../../features/home/HomeScreen';
import {SecuritySettingsScreen} from '../../features/security/SecuritySettingsScreen';
import {SendFlowScreen} from '../../features/send/SendFlowScreen';
import {AboutScreen} from '../../features/settings/AboutScreen';
import {NetworkSettingsScreen} from '../../features/settings/NetworkSettingsScreen';
import {SettingsHomeScreen} from '../../features/settings/SettingsHomeScreen';
import {ManageAssetsScreen} from '../../features/trustlines/ManageAssetsScreen';
import {XAppsScreen} from '../../features/xapps/screens/XAppsScreen';
import type {AppServices} from '../createAppServices';
import {ProductShell} from './ProductShell';
import {
  createInitialProductNavigation,
  nextSelectableAccountId,
  reconcileProductNavigation,
  reduceProductNavigation,
  resolveAccountById,
  resolveSelectedAccount,
  type ProductNavigationAction,
  type ProductNavigationState,
} from './productNavigationState';
import type {ProductAction} from './productRoutes';

type Props = Readonly<{
  accounts: readonly AccountRecord[];
  services: AppServices;
  onAccountsChanged: () => void;
}>;

const PRODUCT_ACTION_AVAILABILITY: Readonly<Record<ProductAction, boolean>> = {
  send: true,
  swap: false,
  request: false,
};

export function ProductRuntime({accounts, services, onAccountsChanged}: Props) {
  const [navigation, setNavigation] = useState<ProductNavigationState>(() =>
    createInitialProductNavigation(accounts),
  );

  useEffect(() => {
    setNavigation(current => reconcileProductNavigation(current, accounts));
  }, [accounts]);

  const dispatch = useCallback(
    (action: ProductNavigationAction) => {
      setNavigation(current => reduceProductNavigation(current, action, accounts));
    },
    [accounts],
  );

  const completeAccountChange = useCallback(() => {
    onAccountsChanged();
    dispatch({type: 'select-tab', tab: 'home'});
  }, [dispatch, onAccountsChanged]);

  const selectedAccount = resolveSelectedAccount(navigation, accounts);
  const selectedAccountCanSign = !services.onboarding.repository.isWatchOnly(
    selectedAccount.id,
  );
  const destination = navigation.destination;
  const showTabBar =
    destination.route === 'home' ||
    destination.route === 'events' ||
    destination.route === 'xapps' ||
    destination.route === 'settings-home';

  const handleSelectAction = useCallback(
    (action: ProductAction) => {
      if (action === 'send') {
        dispatch({type: 'open-send', accountId: selectedAccount.id});
      }
    },
    [dispatch, selectedAccount.id],
  );

  let content: React.ReactNode;
  switch (destination.route) {
    case 'home':
      content = (
        <HomeScreen
          account={selectedAccount}
          accountCount={accounts.filter(account => !account.hidden).length}
          balanceDependencies={services.balance}
          canSign={selectedAccountCanSign}
          onSwitchAccount={() =>
            dispatch({
              type: 'select-account',
              accountId: nextSelectableAccountId(navigation, accounts),
            })
          }
          onAddAccount={() => dispatch({type: 'open-add-account'})}
          onSend={() => dispatch({type: 'open-send', accountId: selectedAccount.id})}
          onManageAssets={() =>
            dispatch({type: 'open-manage-assets', accountId: selectedAccount.id})
          }
        />
      );
      break;
    case 'account-details': {
      const account = resolveAccountById(accounts, destination.accountId);
      content = (
        <AccountDetailsScreen
          account={account}
          onBack={() => dispatch({type: 'back-to-root'})}
          onSend={() => dispatch({type: 'open-send', accountId: account.id})}
          onManageAssets={() => dispatch({type: 'open-manage-assets', accountId: account.id})}
        />
      );
      break;
    }
    case 'add-account':
      content = (
        <AddWatchOnlyAccountScreen
          dependencies={services.onboarding}
          onComplete={completeAccountChange}
          onCancel={() => dispatch({type: 'back-to-root'})}
        />
      );
      break;
    case 'send-form': {
      const account = resolveAccountById(accounts, destination.accountId);
      content = (
        <SendFlowScreen
          account={account}
          dependencies={services.send}
          onDone={() => dispatch({type: 'select-tab', tab: 'home'})}
        />
      );
      break;
    }
    case 'manage-assets': {
      const account = resolveAccountById(accounts, destination.accountId);
      content = (
        <ManageAssetsScreen
          account={account}
          dependencies={services.trustline}
          onDone={() => dispatch({type: 'select-tab', tab: 'home'})}
        />
      );
      break;
    }
    case 'events':
      content = (
        <ActivityHomeScreen
          account={selectedAccount}
          dependencies={services.history}
        />
      );
      break;
    case 'xapps':
      content = <XAppsScreen />;
      break;
    case 'settings-home':
      content = (
        <SettingsHomeScreen
          accountCount={accounts.filter(account => !account.hidden).length}
          onOpenAccounts={() =>
            dispatch({type: 'open-settings-route', route: 'accounts-settings'})
          }
          onOpenSecurity={() =>
            dispatch({type: 'open-settings-route', route: 'security-settings'})
          }
          onOpenNetwork={() =>
            dispatch({type: 'open-settings-route', route: 'network-settings'})
          }
          onOpenAbout={() => dispatch({type: 'open-settings-route', route: 'about'})}
        />
      );
      break;
    case 'accounts-settings':
      content = (
        <AccountsScreen
          accounts={accounts}
          onBack={() => dispatch({type: 'back-to-root'})}
          onOpenAccount={accountId => dispatch({type: 'open-account', accountId})}
          onAddAccount={() => dispatch({type: 'open-add-account'})}
        />
      );
      break;
    case 'security-settings':
      content = (
        <SecuritySettingsScreen
          dependencies={services.security}
          onClose={() => dispatch({type: 'back-to-root'})}
        />
      );
      break;
    case 'network-settings':
      content = <NetworkSettingsScreen onBack={() => dispatch({type: 'back-to-root'})} />;
      break;
    case 'about':
      content = <AboutScreen onBack={() => dispatch({type: 'back-to-root'})} />;
      break;
  }

  return (
    <ProductShell
      activeTab={destination.tab}
      actionAvailability={PRODUCT_ACTION_AVAILABILITY}
      onSelectAction={handleSelectAction}
      onSelectTab={tab => dispatch({type: 'select-tab', tab})}
      showTabBar={showTabBar}>
      {content}
    </ProductShell>
  );
}
