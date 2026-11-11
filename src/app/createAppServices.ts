import { createSessionAuthentication } from '../platform/system/sessionAuthentication';
import { createApplicationSession, type ApplicationSession } from './applicationSession';
import { createNetworkAccountRepository } from '../capabilities/account/createNetworkAccountRepository';
import { createWalletSelectionPreferences } from './createWalletSelectionPreferences';
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
import type { ContactBook } from '../features/contacts/contactBook';
import { RealmContactStore } from '../platform/persistence/realm/RealmContactStore';
import { copyPublicText } from '../platform/system/copyPublicText';
import type { AssetCatalogPort } from '../capabilities/trustline/curatedAssetCatalog';
import { createAccountAvatarPort, type AccountAvatarPort } from '../capabilities/contacts/AccountAvatars';
import type { TokenIconPort } from '../capabilities/assets/TokenIcons';
import { createNativeSafePublicTransport } from '../platform/assets/NativeSafePublicTransport';
import { createTokenMetadataPort } from '../platform/assets/TokenMetadataResolver';
import { createTokenIconPort } from '../platform/assets/TokenIconPort';
import { RealmTokenMetadataRepository } from '../platform/persistence/realm/RealmTokenMetadataRepository';
import { createHttpAssetCatalog } from '../platform/assets/HttpAssetCatalog';
import { createCachedAssetCatalog } from '../platform/assets/CachedAssetCatalog';
import { createNodeReadSession, type NodeReadSession } from './readModels/createNodeReadSession';
import { createHorizonPublicReadGateway } from '../platform/stellar/HorizonPublicReadGateway';
import { createHorizonClaimableGateway } from '../platform/stellar/HorizonClaimableGateway';
import { createClaimableProduct, type ClaimableProduct } from '../capabilities/claimable/createClaimableProduct';
import type { ClaimableTransactionDependencies } from '../capabilities/claimable/claimableTransaction';
import { RealmClaimableCacheStore } from '../platform/persistence/realm/RealmClaimableCacheStore';
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
import type { DappPermissionStore } from '../capabilities/dapp-interaction/dappPermissionStore';
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
  RealmDappCatalogRepository,
  RealmDappDetailCacheRepository,
  RealmCuratedSourceCacheRepository,
  RealmDappPermissionStore,
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
import { createFchainCatalog } from '../platform/dapps/loadFchainCatalog';
import { createFchainDappPublicMedia } from '../platform/dapps/FchainDappPublicMedia';

export type AccountManagementDependencies = RenameAccountDependencies &
  AccountVisibilityDependencies &
  AccountOrderDependencies &
  DeleteLocalAccountDependencies;

export type AppServices = Readonly<{
  diagnostics: SessionLogger;
  applicationSession?: ApplicationSession;
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
  claimables: ClaimableProduct;
  claimableTransaction: ClaimableTransactionDependencies;
  request: RequestProductDependencies;
  contacts: ContactBook;
  dappCatalog: DappCatalogPort;
  dappPermissions: DappPermissionStore;
  assetCatalog: AssetCatalogPort;
  tokenIcons: TokenIconPort;
  accountAvatars?: AccountAvatarPort;
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
  // The App owner must close the retired services after its screens unmount.
  onNetworkChanged?: () => void;
}>;

export async function createAppServices(options: CreateAppServicesOptions = {}): Promise<AppServices> {
  const diagnostics = new SessionLogger();
  const realm = await openWalletRealm(options.realmPath === undefined ? {} : { path: options.realmPath });

  const session = createServiceSession();
  let closeReadRecovery = () => {};
  let closePreferences = () => {};
  let stopSettingsLifecycle = () => {};
  let closeDappCatalog = () => {};
  let closeAssetCatalog = () => {};
  let closeTokenIcons = () => {};
  let closeAccountAvatars = () => {};
  let closeApplicationSession = () => {};
  let stopIconPrivacySync = () => {};
  let closeDappPermissions = () => {};
  let closeClaimables = () => {};
  let networkSettings: NetworkSettings | undefined;
  let retired = false;
  let closed = false;
  const retire = () => {
    if (retired) return;
    retired = true;
    session.close();
    closeApplicationSession();
    closeDappCatalog();
    closeAssetCatalog();
    stopIconPrivacySync();
    closeAccountAvatars();
    closeTokenIcons();
    closeDappPermissions();
    closeClaimables();
    networkSettings?.close();
    stopSettingsLifecycle();
    closeReadRecovery();
  };
  const close = () => {
    if (closed) return;
    closed = true;
    retire();
    closePreferences();
    realm.close();
  };
  const restartNetworkSession = () => {
    // Retire authority immediately; the App owner disposes Realm after its old screens unmount.
    retire();
    if (options.onNetworkChanged) options.onNetworkChanged();
    else close();
  };
  try {
    const nativeModule = loadNativeFresnicaModule(NativeModules);
    const rawSdk = session.bind(new ReactNativeFresnicaSdk(nativeModule), true);
    const storedAccounts = new RealmAccountSignerRepository(realm);
    const applicationSession = createApplicationSession({
      sdk: rawSdk,
      repository: storedAccounts,
      sessionAuthentication: createSessionAuthentication(),
    });
    closeApplicationSession = applicationSession.close;
    // Explicit fixed-network carriers retain their existing helper contract.
    const sdk = options.fixedNetwork ? rawSdk : session.bind(applicationSession.bindSensitive(rawSdk));
    const localePreferences = new RealmLocalePreferenceStore(realm);
    const storedSelectionPreferences = new RealmDefaultAccountPreferenceStore(realm);
    const dappPermissions = new RealmDappPermissionStore(realm);
    closeDappPermissions = () => dappPermissions.close();
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
        (storedAccounts.listAccounts().length === 0 && pendingSubmissions.listUnresolved().length === 0),
    };
    const retainedTestnet = storedAccounts.listAccounts().some(account => account.networkId === 'stellar-testnet');
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
    const repository = createNetworkAccountRepository(storedAccounts, network.id);
    const accountSelectionPreferences = createWalletSelectionPreferences(storedSelectionPreferences, repository);
    const stellarGateway = session.bind(
      new StellarSdkGateway({ network, horizonUrl: networkProfile.horizonUrl }),
      new Set(['submitTransaction']),
    );
    const publicReads = createHorizonPublicReadGateway();
    const claimableReads = createHorizonClaimableGateway();
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
    const claimables = createClaimableProduct({
      networkId: network.id,
      cache: new RealmClaimableCacheStore(realm),
      now: () => Date.now(),
      read: {
        page: (address, cursor) =>
          nodeReadSession.run((signal, endpoint) => claimableReads.page(endpoint, address, cursor, signal)),
        byId: (address, id) =>
          nodeReadSession.run((signal, endpoint) => claimableReads.byId(endpoint, id, address, signal)),
      },
    });
    closeClaimables = claimables.close;
    const displayReadGateway = createDisplayReadGateway({
      gateway: {
        loadAccountBalances: address =>
          nodeReadSession.run((signal, endpoint) => publicReads.loadAccountBalances(endpoint, address, signal)),
        loadAccountOperations: input =>
          nodeReadSession.run((signal, endpoint) => publicReads.loadAccountOperations(endpoint, input, signal)),
        loadOperationEffects: input =>
          nodeReadSession.run((signal, endpoint) => publicReads.loadOperationEffects(endpoint, input, signal)),
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
      confirmMissing: async address =>
        (await nodeReadSession.run((signal, endpoint) => publicReads.loadAccountBalances(endpoint, address, signal)))
          .status === 'inactive',
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
    const directory = createFchainCatalog({
      cache: new RealmDappCatalogRepository(realm),
      networkId: networkProfile.id,
    });
    const publicMedia = createFchainDappPublicMedia({
      cache: new RealmDappDetailCacheRepository(realm),
      networkId: networkProfile.id,
      transport: createNativeSafePublicTransport(),
    });
    const dappCatalog: DappCatalogPort = {
      load: directory.load,
      readCached: directory.readCached,
      publicMedia,
    };
    closeDappCatalog = () => {
      directory.close();
      publicMedia.close();
    };
    const contactStore = new RealmContactStore(realm);
    const guardedContacts = session.bind(contactStore);
    const assetCatalog = createCachedAssetCatalog({
      networkId: networkProfile.id,
      http: createHttpAssetCatalog(),
      cache: new RealmCuratedSourceCacheRepository(realm),
    });
    closeAssetCatalog = assetCatalog.close;
    const publicAssetTransport = createNativeSafePublicTransport();
    const tokenMetadata = createTokenMetadataPort({
      networkId: networkProfile.id,
      networkPassphrase: network.networkPassphrase,
      horizonUrl: networkProfile.horizonUrl,
      catalog: assetCatalog,
      cache: new RealmTokenMetadataRepository(realm),
      transport: publicAssetTransport,
    });
    const tokenIcons = createTokenIconPort({
      networkId: networkProfile.id,
      metadata: tokenMetadata,
      catalog: assetCatalog,
      transport: publicAssetTransport,
      initialEnabled: initialPreferences.externalTokenImagesEnabled !== false,
    });
    closeTokenIcons = tokenIcons.close;
    const accountAvatars = createAccountAvatarPort({
      available: publicAssetTransport.available,
      initialEnabled: initialPreferences.externalAccountAvatarsEnabled === true,
      loadImage: async (url, signal) => (await publicAssetTransport.readAvatar(url, signal)).dataUri,
    });
    const syncAvatarRuntime = () => {
      const runtime = ledgerReadRuntime.getSnapshot();
      accountAvatars.setReadable(runtime.foreground && runtime.connectivity !== 'offline');
    };
    syncAvatarRuntime();
    const stopAvatarRuntime = ledgerReadRuntime.subscribe(syncAvatarRuntime);
    closeAccountAvatars = () => {
      stopAvatarRuntime();
      accountAvatars.close();
    };
    if (networkSettings) {
      const settings = networkSettings;
      stopIconPrivacySync = settings.subscribe(() => {
        accountAvatars.setEnabled(settings.getSnapshot().preferences.externalAccountAvatarsEnabled === true);
        tokenIcons.setEnabled(settings.getSnapshot().preferences.externalTokenImagesEnabled !== false);
      });
    }
    diagnostics.info('app-services-ready', { details: { networkId: network.id } });

    return {
      applicationSession: options.fixedNetwork ? undefined : applicationSession,
      diagnostics,
      networkProfile,
      networkSettings,
      assetCatalog,
      tokenIcons,
      accountAvatars,
      copyPublicText,
      contacts: {
        store: {
          list: guardedContacts.list,
          save: guardedContacts.save,
          remove: guardedContacts.remove,
          subscribe: contactStore.subscribe,
          getRevision: contactStore.getRevision,
        },
        network,
        isClassicAccountAddress: address => {
          try {
            return stellarGateway.isClassicAccountAddress(address);
          } catch {
            return false;
          }
        },
        createId: () => {
          session.assertOpen();
          return createRealmRecordId();
        },
        copyPublicText: session.bind({ copy: copyPublicText }).copy,
        output: session.bind(reactNativeRequestOutput),
      },
      accountManagement: {
        repository,
        pendingSubmissions,
        cacheNetworkIds: Object.keys(NETWORKS),
        historyCache,
        balanceCache,
        onDeleted: () => {
          if (
            networkSettings?.getSnapshot().preferences.retainedTestnet &&
            !storedAccounts.listAccounts().some(account => account.networkId === 'stellar-testnet')
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
        nativeReader: {
          networkId: network.id,
          loadAccountState: address => stellarGateway.loadAccountState(address),
          loadLedgerParameters: () => stellarGateway.loadLedgerParameters(),
        },
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
      claimables,
      claimableTransaction: {
        network,
        reader: claimables,
        gateway: stellarGateway,
        repository,
        sdk,
        recovery,
      },
      request: {
        gateway: stellarGateway,
        network,
        output: reactNativeRequestOutput,
        ingress: reactNativeRequestIngress,
      },
      dappCatalog,
      dappPermissions,
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
