import Clipboard from '@react-native-clipboard/clipboard';
import { Platform, Share } from 'react-native';

import type { RequestOutputPort } from '../../capabilities/request/RequestOutputPort';

export const reactNativeRequestOutput: RequestOutputPort = Object.freeze({
  async copyRequestUri(uri: string): Promise<void> {
    try {
      Clipboard.setString(uri);
    } catch {
      throw new Error('request-copy-failed');
    }
  },

  async shareRequestUri(uri: string) {
    try {
      const result = await Share.share({ message: uri });
      // Android always reports sharedAction even when the user dismisses the chooser.
      // Do not claim delivery without a trustworthy completion signal.
      if (Platform.OS === 'android') return 'unconfirmed';
      if (result.action === Share.sharedAction) return 'shared';
      if (result.action === Share.dismissedAction) return 'cancelled';
      return 'unconfirmed';
    } catch {
      throw new Error('request-share-failed');
    }
  },
});
