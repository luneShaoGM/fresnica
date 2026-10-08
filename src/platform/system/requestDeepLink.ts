import { Linking } from 'react-native';

import type { RequestDeepLinkPort } from '../../capabilities/request/RequestDeepLinkPort';

export const reactNativeRequestDeepLink: RequestDeepLinkPort = Object.freeze({
  async getInitialUrl(): Promise<string | undefined> {
    try {
      return (await Linking.getInitialURL()) ?? undefined;
    } catch {
      throw new Error('request-deep-link-initial-read-failed');
    }
  },

  subscribe(listener: (url: string) => void): () => void {
    const subscription = Linking.addEventListener('url', event => listener(event.url));
    return () => subscription.remove();
  },
});
