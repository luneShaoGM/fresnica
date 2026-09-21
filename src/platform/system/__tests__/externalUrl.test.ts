import { Linking } from 'react-native';

import { reactNativeExternalUrlOpener } from '../externalUrl';

describe('reactNativeExternalUrlOpener', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('passes the trusted URL through unchanged', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const url =
      'https://stellar.expert/explorer/testnet/tx/abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';

    await reactNativeExternalUrlOpener.open(url);

    expect(openURL).toHaveBeenCalledTimes(1);
    expect(openURL).toHaveBeenCalledWith(url);
  });

  it('propagates an OS open failure to the product surface', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('open-failed'));

    await expect(
      reactNativeExternalUrlOpener.open(
        'https://stellar.expert/explorer/testnet/tx/abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
      ),
    ).rejects.toThrow('open-failed');
  });
});
