import { NETWORKS } from '../../capabilities/network/networkPreferences';

export const APP_CONFIG = Object.freeze({
  appName: 'Fresnica',
  projectName: 'fresnica-mobile',
  // Fixed Testnet fixtures; production sessions use persisted Network preferences.
  network: Object.freeze({ ...NETWORKS['stellar-testnet'], friendbotUrl: 'https://friendbot.stellar.org' }),
});
