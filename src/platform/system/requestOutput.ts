import Clipboard from '@react-native-clipboard/clipboard';
import { Share } from 'react-native';

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
      return result.action === Share.dismissedAction ? 'cancelled' : 'shared';
    } catch {
      throw new Error('request-share-failed');
    }
  },
});
