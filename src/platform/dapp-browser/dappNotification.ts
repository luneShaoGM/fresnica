import { NativeModules, Platform } from 'react-native';

type NotificationModule = {
  show(origin: string, title: string, body: string, expiresAt: number): boolean;
};

function showAndroidDappNotification(origin: string, title: string, body: string, expiresAt: number): boolean {
  const module = NativeModules.DappNotification as NotificationModule | undefined;
  return module?.show(origin, title, body, expiresAt) === true;
}

export const showDappNotification = Platform.OS === 'android' ? showAndroidDappNotification : undefined;
