import { NativeModules, Platform } from 'react-native';

type NotificationModule = {
  show(origin: string, title: string, body: string): Promise<boolean>;
};

export async function showDappNotification(origin: string, title: string, body: string): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const module = NativeModules.DappNotification as NotificationModule | undefined;
  return (await module?.show(origin, title, body)) === true;
}
