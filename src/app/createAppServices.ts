import {NativeModules} from 'react-native';

import type {ProvisionAccountDependencies} from '../capabilities/account/provisionAccount';
import {
  ReactNativeFresnicaSdk,
  loadNativeFresnicaModule,
} from '../platform/fresnica/native';
import {
  RealmAccountSignerRepository,
  createRealmRecordId,
  openWalletRealm,
} from '../platform/persistence/realm';

export type AppServices = Readonly<{
  onboarding: ProvisionAccountDependencies;
  close: () => void;
}>;

export async function createAppServices(): Promise<AppServices> {
  const realm = await openWalletRealm();
  const sdk = new ReactNativeFresnicaSdk(loadNativeFresnicaModule(NativeModules));
  const repository = new RealmAccountSignerRepository(realm);

  return {
    onboarding: {
      sdk,
      repository,
      createId: () => createRealmRecordId(),
      now: () => new Date(),
    },
    close: () => realm.close(),
  };
}
