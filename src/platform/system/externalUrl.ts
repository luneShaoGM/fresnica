import { Linking } from 'react-native';

export type ExternalUrlOpener = Readonly<{
  open: (url: string) => Promise<void>;
}>;

export const reactNativeExternalUrlOpener: ExternalUrlOpener = Object.freeze({
  open: async (url: string) => {
    await Linking.openURL(url);
  },
});
