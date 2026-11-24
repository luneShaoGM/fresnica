import { NativeModules, Platform } from 'react-native';

type NotificationModule = {
  monotonicTime(): number;
  show(origin: string, title: string, body: string, expiresAt: number): boolean;
};

function showAndroidDappNotification(origin: string, title: string, body: string, expiresAt: number): boolean {
  const module = NativeModules.DappNotification as NotificationModule | undefined;
  return module?.show(origin, title, body, expiresAt) === true;
}

export const showDappNotification = Platform.OS === 'android' ? showAndroidDappNotification : undefined;

export function readDappNotificationTime(): number {
  try {
    const module = NativeModules.DappNotification as NotificationModule | undefined;
    const now = Platform.OS === 'android' ? module?.monotonicTime() : undefined;
    return typeof now === 'number' && Number.isSafeInteger(now) && now >= 0 ? now : Number.NaN;
  } catch {
    return Number.NaN;
  }
}
