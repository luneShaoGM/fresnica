import { Linking } from 'react-native';

import { reactNativeRequestDeepLink } from '../requestDeepLink';

describe('reactNativeRequestDeepLink', () => {
  afterEach(() => jest.restoreAllMocks());

  it('reads the cold-start URL without transforming it', async () => {
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue('web+stellar:pay?destination=GDESTINATION');
    await expect(reactNativeRequestDeepLink.getInitialUrl()).resolves.toBe('web+stellar:pay?destination=GDESTINATION');
  });

  it('forwards warm URL events and removes the listener', () => {
    let handler: ((event: { url: string }) => void) | undefined;
    const remove = jest.fn();
    jest.spyOn(Linking, 'addEventListener').mockImplementation((_, listener) => {
      handler = listener as (event: { url: string }) => void;
      return { remove } as never;
    });
    const listener = jest.fn();

    const unsubscribe = reactNativeRequestDeepLink.subscribe(listener);
    handler?.({ url: 'web+stellar:pay?destination=GDESTINATION' });
    unsubscribe();

    expect(listener).toHaveBeenCalledWith('web+stellar:pay?destination=GDESTINATION');
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('maps initial-link failures to a stable platform error', async () => {
    jest.spyOn(Linking, 'getInitialURL').mockRejectedValue(new Error('native-detail'));
    await expect(reactNativeRequestDeepLink.getInitialUrl()).rejects.toThrow('request-deep-link-initial-read-failed');
  });
});
