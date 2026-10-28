import { authorizeSensitiveSetting } from '../capabilities/application-security/authorizeSensitiveSetting';
import { createNetworkSettings, type NetworkSettings } from '../capabilities/network/createNetworkSettings';
import {
  DEFAULT_NETWORK_PREFERENCES,
  NETWORKS,
  selectedNetwork,
  validateNetworkPreferences,
  type NetworkId,
  type NetworkProfile,
} from '../capabilities/network/networkPreferences';
import {
  openNetworkPreferences,
  RealmNetworkPreferenceStore,
} from '../platform/persistence/realm/RealmNetworkPreferenceStore';
import { createServiceSession } from './network/createServiceSession';
import { copyPublicText } from '../platform/system/copyPublicText';
import type { AssetCatalogPort } from '../capabilities/trustline/curatedAssetCatalog';
import { createHttpAssetCatalog } from '../platform/assets/HttpAssetCatalog';
import { createNodeReadSession, type NodeReadSession } from './readModels/createNodeReadSession';
import { createHorizonPublicReadGateway } from '../platform/stellar/HorizonPublicReadGateway';
import { bindNodeAccountEffects } from './readModels/bindNodeAccountEffects';
import { startPostSubmitReadConvergence } from './readModels/startPostSubmitReadConvergence';
import { createForegroundAccountSync, type ForegroundAccountSync } from './readModels/createForegroundAccountSync';
import { createHorizonAccountEffects } from '../platform/stellar/HorizonAccountEffects';
import { NativeModules } from 'react-native';

import { createLedgerReadRuntime, type LedgerReadRuntime } from './readModels/LedgerReadRuntime';
import { createDisplayReadGateway } from './readModels/createDisplayReadGateway';

import { APP_CONFIG } from './config/appConfig';
import { SessionLogger } from './diagnostics/SessionLogger';
import type { AccountSelectionPreferenceStore } from './accountSelectionPreferences';
import {
  createLedgerReadInvalidationStore,
  type LedgerReadInvalidationStore,
} from './readModels/LedgerReadInvalidationStore';
import {
  createTransactionReconciliationCoordinator,
  type TransactionReconciliationCoordinator,
} from './transaction/TransactionReconciliationCoordinator';
import type { OnboardingProvisioningDependencies } from '../features/onboarding/runOnboardingProvisioning';
import type { ApplicationSecurityDependencies } from '../capabilities/application-security/systemAuth';
import type { BalanceProductDependencies } from '../capabilities/balance/BalanceCacheHydration';
import type { FriendbotDependencies } from '../capabilities/network/fundTestnetAccountWithFriendbot';
import type { DappCatalogPort } from '../capabilities/dapp-catalog/catalog';
import type { AccountOrderDependencies } from '../capabilities/account/accountOrder';
import type { AccountVisibilityDependencies } from '../capabilities/account/accountVisibility';
import type { DeleteLocalAccountDependencies } from '../capabilities/account/deleteLocalAccount';
import type { RenameAccountDependencies } from '../capabilities/account/renameAccount';
import type { HistoryProductDependencies } from '../capabilities/history/HistoryCacheHydration';
import type { SendProductDependencies } from '../features/send/sendProductFlow';
import type { SwapPreviewProductDependencies } from '../features/swap/swapPreviewProductFlow';
import type { SwapSubmissionProductDependencies } from '../features/swap/swapSubmissionProductFlow';
import type { TrustlineProductDependencies } from '../features/trustlines/trustlineProductFlow';
import type { RequestProductDependencies } from '../features/request/requestProductFlow';
import { ReactNativeFresnicaSdk, loadNativeFresnicaModule } from '../platform/fresnica/native';
import {
  RealmAccountSignerRepository,
  RealmBalanceCacheRepository,
  RealmDefaultAccountPreferenceStore,
  RealmHistoryCacheRepository,
  RealmLocalePreferenceStore,
  RealmPendingSubmissionRepository,
  createRealmRecordId,
  openWalletRealm,
} from '../platform/persistence/realm';
import { StellarFriendbotGateway } from '../platform/stellar/StellarFriendbotGateway';
import { StellarSdkGateway } from '../platform/stellar/StellarSdkGateway';
import { StellarPathPaymentSdkGateway } from '../platform/stellar/StellarPathPaymentSdkGateway';
import { reactNativeExternalUrlOpener, type ExternalUrlOpener } from '../platform/system/externalUrl';
import { reactNativeRequestIngress } from '../platform/system/requestIngress';
import { reactNativeRequestOutput } from '../platform/system/requestOutput';
import { unconfiguredDappCatalog } from '../platform/dapps/unconfiguredDappCatalog';

export type AccountManagementDependencies = RenameAccountDependencies &
  AccountVisibilityDependencies &
  AccountOrderDependencies &
  DeleteLocalAccountDependencies;

export type AppServices = Readonly<{
  diagnostics: SessionLogger;
  networkProfile: NetworkProfile;
  networkSettings?: NetworkSettings;
  accountManagement: AccountManagementDependencies;
  onboarding: OnboardingProvisioningDependencies;
  security: ApplicationSecurityDependencies;
  balance: BalanceProductDependencies;
  friendbot: FriendbotDependencies;
  send: SendProductDependencies;
  swapPreview: SwapPreviewProductDependencies;
  swapExecution: SwapSubmissionProductDependencies;
  history: HistoryProductDependencies;
  trustline: TrustlineProductDependencies;
  request: RequestProductDependencies;
  dappCatalog: DappCatalogPort;
  assetCatalog: AssetCatalogPort;
  copyPublicText: (text: string) => Promise<void>;
  transactionRecovery: TransactionReconciliationCoordinator;
  ledgerReadInvalidation: LedgerReadInvalidationStore;
  ledgerReadRuntime: LedgerReadRuntime;
  foregroundAccountSync: ForegroundAccountSync;
  nodeReadSession: NodeReadSession;
  localePreferences: RealmLocalePreferenceStore;
  accountSelectionPreferences: AccountSelectionPreferenceStore;
  externalUrl: ExternalUrlOpener;
  close: () => void;
}>;

export type CreateAppServicesOptions = Readonly<{
  realmPath?: string;
  fixedNetwork?: NetworkId;
  onNetworkChanged?: () => void;
}>;

export async function createAppServices(options: CreateAppServicesOptions = {}): Promise<AppServices> {
  const diagnostics = new SessionLogger();
  const realm = await openWalletRealm(options.realmPath === undefined ? {} : { path: options.realmPath });

  const session = createServiceSession();
  let closeReadRecovery = () => {};
  let closePreferences = () => {};
  let stopSettingsLifecycle = () => {};
  let networkSettings: NetworkSettings | undefined;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    session.close();
    networkSettings?.close();
    stopSettingsLifecycle();
    closeReadRecovery();
    closePreferences();
    realm.close();
  };
  const restartNetworkSession = () => {
    close();
    options.onNetworkChanged?.();
  };
  try {
    const nativeModule = loadNativeFresnicaModule(NativeModules);
    const sdk = session.bind(new ReactNativeFresnicaSdk(nativeModule), true);
    const repository = new RealmAccountSignerRepository(realm);
    const localePreferences = new RealmLocalePreferenceStore(realm);
    const accountSelectionPreferences = new RealmDefaultAccountPreferenceStore(realm);
    const pendingSubmissions = new RealmPendingSubmissionRepository(realm);
    const historyCache = new RealmHistoryCacheRepository(realm);
    const balanceCache = new RealmBalanceCacheRepository(realm);
    const ledgerReadInvalidation = createLedgerReadInvalidationStore();
    const ledgerReadRuntime = createLedgerReadRuntime();
    const recovery = Object.freeze({
      repository: pendingSubmissions,
      readInvalidation: ledgerReadInvalidation,
      now: () => new Date(),
    });
    const preferencesRealm = options.fixedNetwork ? undefined : await openNetworkPreferences(realm.path);
    closePreferences = () => preferencesRealm?.close();
    const preferences = preferencesRealm ? new RealmNetworkPreferenceStore(preferencesRealm) : undefined;
    const storedPreferences = preferences?.load();
    const previousPreferences = storedPreferences ?? {
      ...DEFAULT_NETWORK_PREFERENCES,
      selectionConfirmed:
        options.fixedNetwork !== undefined ||
        (repository.listAccounts().length === 0 && pendingSubmissions.listUnresolved().length === 0),
    };
    const retainedTestnet = repository.listAccounts().some(account => account.networkId === 'stellar-testnet');
    const revokeSelectedTestnet =
      !options.fixedNetwork &&
      !previousPreferences.developerMode &&
      previousPreferences.networkId === 'stellar-testnet' &&
      !retainedTestnet;
    // Never abandon unresolved recovery in an accountless legacy partition.
    if (revokeSelectedTestnet && pendingSubmissions.listUnresolved('stellar-testnet').length > 0)
      throw new Error('pending-submission');
    const initialPreferences = validateNetworkPreferences({
      ...previousPreferences,
      retainedTestnet,
      ...(revokeSelectedTestnet
        ? {
            networkId: 'stellar-mainnet',
            selectionConfirmed: false,
            endpoints: { ...previousPreferences.endpoints, 'stellar-mainnet': NETWORKS['stellar-mainnet'].horizonUrl },
          }
        : {}),
    });
    if (
      preferences &&
      storedPreferences &&
      ((storedPreferences.retainedTestnet === true) !== retainedTestnet || revokeSelectedTestnet)
    ) {
      preferences.save(initialPreferences);
    }
    const networkProfile = options.fixedNetwork ? NETWORKS[options.fixedNetwork] : selectedNetwork(initialPreferences);
    const network = Object.freeze({ id: networkProfile.id, networkPassphrase: networkProfile.networkPassphrase });
    const stellarGateway = session.bind(
      new StellarSdkGateway({ network, horizonUrl: networkProfile.horizonUrl }),
      new Set(['submitTransaction']),
    );
    const publicReads = createHorizonPublicReadGateway();
    const nodeReadSession = createNodeReadSession({
      endpoint: networkProfile.horizonUrl,
      networkPassphrase: network.networkPassphrase,
      runtime: ledgerReadRuntime,
      probe: publicReads.probe,
      onState: snapshot => {
        diagnostics.info('node-read-state', {
          details: { phase: snapshot.phase, generation: snapshot.generation, failure: snapshot.failure },
        });
        if (['checking', 'healthy', 'cooldown', 'wrong-network'].includes(snapshot.phase)) {
          for (const account of repository.listAccounts()) {
            if (!account.hidden && account.networkId === network.id)
              ledgerReadInvalidation.refresh({ networkId: network.id, accountId: account.id, reason: 'node-recovery' });
          }
        }
      },
    });
    closeReadRecovery = () => nodeReadSession.close();
    const displayReadGateway = createDisplayReadGateway({
      gateway: {
        loadAccountBalances: address =>
          nodeReadSession.run((signal, endpoint) => publicReads.loadAccountBalances(endpoint, address, signal)),
        loadAccountOperations: input =>
          nodeReadSession.run((signal, endpoint) => publicReads.loadAccountOperations(endpoint, input, signal)),
        loadOperation: input =>
          nodeReadSession.run((signal, endpoint) => publicReads.loadOperation(endpoint, input, signal)),
      },
      runtime: ledgerReadRuntime,
      getAccountRevision: address =>
        JSON.stringify(
          repository
            .listAccounts()
            .filter(account => account.networkId === network.id && account.address === address)
            .map(account => [account.id, ledgerReadInvalidation.getRevision(network.id, account.id)]),
        ),
    });
    const pathPaymentGateway = session.bind(
      new StellarPathPaymentSdkGateway({
        network,
        horizonUrl: networkProfile.horizonUrl,
      }),
    );
    const quoteClock = Object.freeze({
      nowUnixMs: () => Date.now(),
      nowMonotonicMs: () => performance.now(),
    });
    const friendbotGateway = session.bind(new StellarFriendbotGateway(APP_CONFIG.network.friendbotUrl));
    const transactionRecovery = createTransactionReconciliationCoordinator({
      gateway: {
        loadTransactionOutcome: hash =>
          nodeReadSession.run((signal, endpoint) => publicReads.loadTransactionOutcome(endpoint, hash, signal)),
      },
      repository: pendingSubmissions,
      readInvalidation: ledgerReadInvalidation,
      networkId: network.id,
      now: () => new Date(),
      onRunStart: reason =>
        diagnostics.info('transaction-reconciliation-start', { details: { reason, networkId: network.id } }),
      onRunFailure: (reason, error) =>
        diagnostics.warn('transaction-reconciliation-failed', { details: { reason, networkId: network.id, error } }),
    });

    const foregroundAccountSync = createForegroundAccountSync({
      networkId: network.id,
      runtime: ledgerReadRuntime,
      invalidation: ledgerReadInvalidation,
      effects: bindNodeAccountEffects(nodeReadSession, createHorizonAccountEffects),
      node: nodeReadSession,
      onFailure: () => diagnostics.warn('account-effects-probe-failed'),
      isReading: displayReadGateway.hasPendingReads,
    });

    closeReadRecovery = () => {
      foregroundAccountSync.close();
      nodeReadSession.close();
    };
    const stopPostSubmitReadConvergence = startPostSubmitReadConvergence({
      networkId: network.id,
      runtime: ledgerReadRuntime,
      node: nodeReadSession,
      invalidation: ledgerReadInvalidation,
      pending: pendingSubmissions,
      coordinator: transactionRecovery,
      balance: { gateway: displayReadGateway, networkId: network.id, cache: balanceCache, now: () => new Date() },
      history: { gateway: displayReadGateway, networkId: network.id, cache: historyCache, now: () => new Date() },
      getAccount: id => repository.getAccount(id),
      onComplete: result => diagnostics.info('post-submit-read-completed', { details: { result } }),
    });

    closeReadRecovery = () => {
      stopPostSubmitReadConvergence();
      foregroundAccountSync.close();
      nodeReadSession.close();
    };
    if (preferences) {
      networkSettings = createNetworkSettings({
        store: preferences,
        initial: initialPreferences,
        authorize: (passphrase, signal) => authorizeSensitiveSetting({ sdk, repository }, passphrase, signal),
        probe: publicReads.probe,
        isForeground: () => ledgerReadRuntime.getSnapshot().foreground,
        assertCanSwitch: target => {
          session.assertIdle();
          if (
            !initialPreferences.selectionConfirmed &&
            pendingSubmissions.listUnresolved().some(record => record.networkId !== target)
          )
            throw new Error('pending-submission');
          if (repository.listSigners().some(signer => signer.backupState === 'pending'))
            throw new Error('pending-backup');
          if (target !== network.id && pendingSubmissions.listUnresolved(network.id).length > 0)
            throw new Error('pending-submission');
        },
        restart: restartNetworkSession,
      });
      stopSettingsLifecycle = ledgerReadRuntime.subscribe(() => {
        if (!ledgerReadRuntime.getSnapshot().foreground) networkSettings?.cancel();
      });
    }
    diagnostics.info('app-services-ready', { details: { networkId: network.id } });

    return {
      diagnostics,
      networkProfile,
      networkSettings,
      assetCatalog: createHttpAssetCatalog(),
      copyPublicText,
      accountManagement: {
        repository,
        pendingSubmissions,
        historyCache,
        balanceCache,
        onDeleted: () => {
          if (
            networkSettings?.getSnapshot().preferences.retainedTestnet &&
            !repository.listAccounts().some(account => account.networkId === 'stellar-testnet')
          ) {
            // Retire before the delete flow can expose onboarding on the old Testnet profile.
            // Reopening derives and persists the new policy from the authoritative account inventory.
            restartNetworkSession();
          }
        },
        now: () => new Date(),
      },
      onboarding: {
        sdk,
        repository,
        createId: () => createRealmRecordId(),
        now: () => new Date(),
        networkId: network.id,
      },
      security: {
        sdk,
        repository,
      },
      balance: {
        cache: balanceCache,
        now: () => new Date(),
        gateway: displayReadGateway,
        networkId: network.id,
      },
      friendbot: {
        gateway: friendbotGateway,
        networkId: network.id,
      },
      send: {
        gateway: stellarGateway,
        sdk,
        repository,
        recovery,
        network,
      },
      swapPreview: {
        network,
        balance: { gateway: stellarGateway, networkId: network.id },
        quotes: {
          network,
          gateway: pathPaymentGateway,
          isClassicAccountAddress: address => stellarGateway.isClassicAccountAddress(address),
          ...quoteClock,
        },
        prepare: {
          preflight: { network, gateway: stellarGateway, clock: quoteClock },
          transactionGateway: pathPaymentGateway,
        },
      },
      swapExecution: {
        network,
        gateway: stellarGateway,
        inspector: pathPaymentGateway,
        sdk,
        signerRepository: repository,
        recovery,
        transactionRecovery,
      },
      history: {
        gateway: displayReadGateway,
        networkId: network.id,
        cache: historyCache,
        now: () => new Date(),
      },
      trustline: {
        gateway: stellarGateway,
        sdk,
        repository,
        recovery,
        network,
      },
      request: {
        gateway: stellarGateway,
        network,
        output: reactNativeRequestOutput,
        ingress: reactNativeRequestIngress,
      },
      dappCatalog: unconfiguredDappCatalog,
      transactionRecovery,
      ledgerReadInvalidation,
      ledgerReadRuntime,
      foregroundAccountSync,
      nodeReadSession,
      localePreferences,
      accountSelectionPreferences,
      externalUrl: reactNativeExternalUrlOpener,
      close,
    };
  } catch (error) {
    close();
    throw error;
  }
}
