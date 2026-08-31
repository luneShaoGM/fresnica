import {NativeModules} from 'react-native';

import type {ProvisionAccountDependencies} from '../capabilities/account/provisionAccount';
import type {ApplicationSecurityDependencies} from '../capabilities/application-security/systemAuth';
import type {BalanceDependencies} from '../capabilities/balance/loadBalanceSnapshot';
import {
  ReactNativeFresnicaSdk,
  loadNativeFresnicaModule,
} from '../platform/fresnica/native';
import {
  RealmAccountSignerRepository,
  createRealmRecordId,
  openWalletRealm,
} from '../platform/persistence/realm';
import {StellarSdkGateway} from '../platform/stellar/StellarSdkGateway';

export type AppServices = Readonly<{
  onboarding: ProvisionAccountDependencies;
  security: ApplicationSecurityDependencies;
  balance: BalanceDependencies;
  close: () => void;
}>;

export async function createAppServices(): Promise<AppServices> {
  const realm = await openWalletRealm();

  try {
    const nativeModule = loadNativeFresnicaModule(NativeModules);
    const sdk = new ReactNativeFresnicaSdk(nativeModule);
    const repository = new RealmAccountSignerRepository(realm);
    const stellarGateway = new StellarSdkGateway();

    return {
      onboarding: {
        sdk,
        repository,
        createId: () => createRealmRecordId(),
        now: () => new Date(),
      },
      security: {
        sdk,
        repository,
      },
      balance: {
        gateway: stellarGateway,
      },
      close: () => realm.close(),
    };
  } catch (error) {
    realm.close();
    throw error;
  }
}
