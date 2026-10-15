import Clipboard from '@react-native-clipboard/clipboard';
import { Platform, Share } from 'react-native';

import { reactNativeRequestOutput } from '../requestOutput';

jest.mock('@react-native-clipboard/clipboard', () => ({
  __esModule: true,
  default: { setString: jest.fn() },
}));

describe('reactNativeRequestOutput', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('writes only the exact canonical URI to the clipboard', async () => {
    const uri = 'web+stellar:pay?destination=GDESTINATION';
    await reactNativeRequestOutput.copyRequestUri(uri);
    expect(Clipboard.setString).toHaveBeenCalledTimes(1);
    expect(Clipboard.setString).toHaveBeenCalledWith(uri);
  });

  it('passes the exact canonical URI to system Share and treats dismissal as cancellation', async () => {
    const uri = 'web+stellar:pay?destination=GDESTINATION&amount=1';
    jest.replaceProperty(Platform, 'OS', 'ios');
    jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.dismissedAction, activityType: undefined });
    await expect(reactNativeRequestOutput.shareRequestUri(uri)).resolves.toBe('cancelled');
    expect(Share.share).toHaveBeenCalledWith({ message: uri });
  });

  it('reports confirmed iOS sharing only for the actual shared action', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
    await expect(reactNativeRequestOutput.shareRequestUri('web+stellar:pay?destination=GDESTINATION')).resolves.toBe(
      'shared',
    );
  });

  it('does not claim share success for an unrecognized iOS action', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    jest.spyOn(Share, 'share').mockResolvedValue({ action: 'unknown', activityType: undefined });
    await expect(reactNativeRequestOutput.shareRequestUri('web+stellar:pay?destination=GDESTINATION')).resolves.toBe(
      'unconfirmed',
    );
  });

  it('does not treat Android chooser dismissal as confirmed sharing', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const uri = 'web+stellar:pay?destination=GDESTINATION&amount=1';
    jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
    await expect(reactNativeRequestOutput.shareRequestUri(uri)).resolves.toBe('unconfirmed');
    expect(Share.share).toHaveBeenCalledWith({ message: uri });
  });

  it('maps a platform share failure to the stable Request error', async () => {
    jest.spyOn(Share, 'share').mockRejectedValue(new Error('platform-failed'));
    await expect(reactNativeRequestOutput.shareRequestUri('web+stellar:pay?destination=GDESTINATION')).rejects.toThrow(
      'request-share-failed',
    );
  });
});
