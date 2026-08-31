import React, {useCallback, useEffect, useState} from 'react';

import type {AccountRecord} from '../../capabilities/account/types';
import {AccountDetailsScreen} from '../../features/accounts/AccountDetailsScreen';
import {AccountsScreen} from '../../features/accounts/AccountsScreen';
import {AddWatchOnlyAccountScreen} from '../../features/accounts/AddWatchOnlyAccountScreen';
import {ActivityHomeScreen} from '../../features/history/ActivityHomeScreen';
import {WalletHomeScreen} from '../../features/portfolio/WalletHomeScreen';
import {SecuritySettingsScreen} from '../../features/security/SecuritySettingsScreen';
import {SendFlowScreen} from '../../features/send/SendFlowScreen';
import {AboutScreen} from '../../features/settings/AboutScreen';
import {NetworkSettingsScreen} from '../../features/settings/NetworkSettingsScreen';
import {SettingsHomeScreen} from '../../features/settings/SettingsHomeScreen';
import {ManageAssetsScreen} from '../../features/trustlines/ManageAssetsScreen';
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

type Props = Readonly<{
  accounts: readonly AccountRecord[];
  services: AppServices;
  onAccountsChanged: () => void;
}>;

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
    dispatch({type: 'select-tab', tab: 'wallet'});
  }, [dispatch, onAccountsChanged]);

  const selectedAccount = resolveSelectedAccount(navigation, accounts);
  const destination = navigation.destination;

  let content: React.ReactNode;
  switch (destination.route) {
    case 'wallet-home':
      content = (
        <WalletHomeScreen
          account={selectedAccount}
          accountCount={accounts.filter(account => !account.hidden).length}
          balanceDependencies={services.balance}
          onSwitchAccount={() =>
            dispatch({
              type: 'select-account',
              accountId: nextSelectableAccountId(navigation, accounts),
            })
          }
          onAddAccount={() => dispatch({type: 'open-add-account'})}
          onOpenAccount={() => dispatch({type: 'open-account', accountId: selectedAccount.id})}
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
          onDone={() => dispatch({type: 'select-tab', tab: 'wallet'})}
        />
      );
      break;
    }
    case 'manage-assets': {
      const account = resolveAccountById(accounts, destination.accountId);
      content = <ManageAssetsScreen accountLabel={account.label || account.address} />;
      break;
    }
    case 'history':
      content = (
        <ActivityHomeScreen
          account={selectedAccount}
          dependencies={services.history}
        />
      );
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
      content = <NetworkSettingsScreen />;
      break;
    case 'about':
      content = <AboutScreen />;
      break;
  }

  return (
    <ProductShell
      activeTab={destination.tab}
      onSelectTab={tab => dispatch({type: 'select-tab', tab})}>
      {content}
    </ProductShell>
  );
}
