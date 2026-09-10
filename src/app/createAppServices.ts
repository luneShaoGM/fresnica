import { NativeModules } from 'react-native';

import { APP_CONFIG } from './config/appConfig';
import { SessionLogger } from './diagnostics/SessionLogger';
import {createLedgerReadInvalidationStore, type LedgerReadInvalidationStore} from './readModels/LedgerReadInvalidationStore';
import {createTransactionReconciliationCoordinator, type TransactionReconciliationCoordinator} from './transaction/TransactionReconciliationCoordinator';
import type { OnboardingProvisioningDependencies } from '../features/onboarding/runOnboardingProvisioning';
import type { ApplicationSecurityDependencies } from '../capabilities/application-security/systemAuth';
import type { BalanceDependencies } from '../capabilities/balance/loadBalanceSnapshot';
import type { HistoryDependencies } from '../capabilities/history/loadHistoryPage';
import type { SendProductDependencies } from '../features/send/sendProductFlow';
import type { TrustlineProductDependencies } from '../features/trustlines/trustlineProductFlow';
import { ReactNativeFresnicaSdk, loadNativeFresnicaModule } from '../platform/fresnica/native';
import {
  RealmAccountSignerRepository,
  RealmLocalePreferenceStore,
  RealmPendingSubmissionRepository,
  createRealmRecordId,
  openWalletRealm,
} from '../platform/persistence/realm';
import { StellarSdkGateway } from '../platform/stellar/StellarSdkGateway';

export type AppServices = Readonly<{
  diagnostics: SessionLogger;
  onboarding: OnboardingProvisioningDependencies;
  security: ApplicationSecurityDependencies;
  balance: BalanceDependencies;
  send: SendProductDependencies;
  history: HistoryDependencies;
  trustline: TrustlineProductDependencies;
  transactionRecovery: TransactionReconciliationCoordinator;
  ledgerReadInvalidation: LedgerReadInvalidationStore;
  localePreferences: RealmLocalePreferenceStore;
  close: () => void;
}>;

export async function createAppServices(): Promise<AppServices> {
  const diagnostics = new SessionLogger();
  const realm = await openWalletRealm();

  try {
    const nativeModule = loadNativeFresnicaModule(NativeModules);
    const sdk = new ReactNativeFresnicaSdk(nativeModule);
    const repository = new RealmAccountSignerRepository(realm);
    const localePreferences = new RealmLocalePreferenceStore(realm);
    const pendingSubmissions = new RealmPendingSubmissionRepository(realm);
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
    const transactionRecovery = createTransactionReconciliationCoordinator({
      gateway: stellarGateway,
      repository: pendingSubmissions,
      readInvalidation: ledgerReadInvalidation,
      networkId: network.id,
      now: () => new Date(),
      onRunStart: reason =>
        diagnostics.info('transaction-reconciliation-start', {details: {reason, networkId: network.id}}),
      onRunFailure: (reason, error) =>
        diagnostics.warn('transaction-reconciliation-failed', {details: {reason, networkId: network.id, error}}),
    });

    diagnostics.info('app-services-ready', {details: {networkId: network.id}});

    return {
      diagnostics,
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
      send: {
        gateway: stellarGateway,
        sdk,
        repository,
        recovery,
        network,
      },
      history: {
        gateway: stellarGateway,
        networkId: network.id,
      },
      trustline: {
        gateway: stellarGateway,
        sdk,
        repository,
        recovery,
        network,
      },
      transactionRecovery,
      ledgerReadInvalidation,
      localePreferences,
      close: () => realm.close(),
    };
  } catch (error) {
    realm.close();
    throw error;
  }
}
