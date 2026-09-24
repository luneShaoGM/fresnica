import Clipboard from '@react-native-clipboard/clipboard';
import { Share } from 'react-native';

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
    jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.dismissedAction, activityType: undefined });
    await expect(reactNativeRequestOutput.shareRequestUri(uri)).resolves.toBe('cancelled');
    expect(Share.share).toHaveBeenCalledWith({ message: uri });
  });

  it('maps a platform share failure to the stable Request error', async () => {
    jest.spyOn(Share, 'share').mockRejectedValue(new Error('platform-failed'));
    await expect(reactNativeRequestOutput.shareRequestUri('web+stellar:pay?destination=GDESTINATION')).rejects.toThrow(
      'request-share-failed',
    );
  });
});
