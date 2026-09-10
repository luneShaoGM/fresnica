import { NativeModules } from 'react-native';

import { APP_CONFIG } from './config/appConfig';
import { SessionLogger } from './diagnostics/SessionLogger';
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
    const network = Object.freeze({
      id: APP_CONFIG.network.id,
      networkPassphrase: APP_CONFIG.network.networkPassphrase,
    });
    const stellarGateway = new StellarSdkGateway({
      network,
      horizonUrl: APP_CONFIG.network.horizonUrl,
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
        network,
      },
      localePreferences,
      close: () => realm.close(),
    };
  } catch (error) {
    realm.close();
    throw error;
  }
}
