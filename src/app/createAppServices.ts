import { NativeModules } from 'react-native';

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
import type { BalanceDependencies } from '../capabilities/balance/loadBalanceSnapshot';
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
  accountManagement: AccountManagementDependencies;
  onboarding: OnboardingProvisioningDependencies;
  security: ApplicationSecurityDependencies;
  balance: BalanceDependencies;
  friendbot: FriendbotDependencies;
  send: SendProductDependencies;
  swapPreview: SwapPreviewProductDependencies;
  swapExecution: SwapSubmissionProductDependencies;
  history: HistoryProductDependencies;
  trustline: TrustlineProductDependencies;
  request: RequestProductDependencies;
  dappCatalog: DappCatalogPort;
  transactionRecovery: TransactionReconciliationCoordinator;
  ledgerReadInvalidation: LedgerReadInvalidationStore;
  localePreferences: RealmLocalePreferenceStore;
  accountSelectionPreferences: AccountSelectionPreferenceStore;
  externalUrl: ExternalUrlOpener;
  close: () => void;
}>;

export type CreateAppServicesOptions = Readonly<{
  realmPath?: string;
}>;

export async function createAppServices(options: CreateAppServicesOptions = {}): Promise<AppServices> {
  const diagnostics = new SessionLogger();
  const realm = await openWalletRealm(options.realmPath === undefined ? {} : { path: options.realmPath });

  try {
    const nativeModule = loadNativeFresnicaModule(NativeModules);
    const sdk = new ReactNativeFresnicaSdk(nativeModule);
    const repository = new RealmAccountSignerRepository(realm);
    const localePreferences = new RealmLocalePreferenceStore(realm);
    const accountSelectionPreferences = new RealmDefaultAccountPreferenceStore(realm);
    const pendingSubmissions = new RealmPendingSubmissionRepository(realm);
    const historyCache = new RealmHistoryCacheRepository(realm);
    const ledgerReadInvalidation = createLedgerReadInvalidationStore();
    const recovery = Object.freeze({
      repository: pendingSubmissions,
      readInvalidation: ledgerReadInvalidation,
      now: () => new Date(),
    });
    const network = Object.freeze({
      id: APP_CONFIG.network.id,
      networkPassphrase: APP_CONFIG.network.networkPassphrase,
    });
    const stellarGateway = new StellarSdkGateway({
      network,
      horizonUrl: APP_CONFIG.network.horizonUrl,
    });
    const pathPaymentGateway = new StellarPathPaymentSdkGateway({
      network,
      horizonUrl: APP_CONFIG.network.horizonUrl,
    });
    const quoteClock = Object.freeze({
      nowUnixMs: () => Date.now(),
      nowMonotonicMs: () => performance.now(),
    });
    const friendbotGateway = new StellarFriendbotGateway(APP_CONFIG.network.friendbotUrl);
    const transactionRecovery = createTransactionReconciliationCoordinator({
      gateway: stellarGateway,
      repository: pendingSubmissions,
      readInvalidation: ledgerReadInvalidation,
      networkId: network.id,
      now: () => new Date(),
      onRunStart: reason =>
        diagnostics.info('transaction-reconciliation-start', { details: { reason, networkId: network.id } }),
      onRunFailure: (reason, error) =>
        diagnostics.warn('transaction-reconciliation-failed', { details: { reason, networkId: network.id, error } }),
    });

    diagnostics.info('app-services-ready', { details: { networkId: network.id } });

    return {
      diagnostics,
      accountManagement: {
        repository,
        pendingSubmissions,
        historyCache,
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
        gateway: stellarGateway,
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
        gateway: stellarGateway,
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
      localePreferences,
      accountSelectionPreferences,
      externalUrl: reactNativeExternalUrlOpener,
      close: () => realm.close(),
    };
  } catch (error) {
    realm.close();
    throw error;
  }
}
