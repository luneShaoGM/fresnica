import Clipboard from '@react-native-clipboard/clipboard';
import { Platform } from 'react-native';
import {
  check,
  openSettings,
  PERMISSIONS,
  request,
  RESULTS,
  type Permission,
  type PermissionStatus,
} from 'react-native-permissions';

import type { RequestCameraPermissionState, RequestIngressPort } from '../../capabilities/request/RequestIngressPort';

export const reactNativeRequestIngress: RequestIngressPort = Object.freeze({
  async readClipboardText(): Promise<string> {
    try {
      return await Clipboard.getString();
    } catch {
      throw new Error('request-clipboard-read-failed');
    }
  },

  async checkCameraPermission(): Promise<RequestCameraPermissionState> {
    const permission = cameraPermission();
    if (permission === undefined) return 'unavailable';
    try {
      return mapPermissionStatus(await check(permission));
    } catch {
      throw new Error('request-camera-permission-failed');
    }
  },

  async requestCameraPermission(): Promise<RequestCameraPermissionState> {
    const permission = cameraPermission();
    if (permission === undefined) return 'unavailable';
    try {
      return mapPermissionStatus(await request(permission));
    } catch {
      throw new Error('request-camera-permission-failed');
    }
  },

  async openCameraSettings(): Promise<void> {
    try {
      await openSettings('application');
    } catch {
      throw new Error('request-camera-settings-failed');
    }
  },
});

function cameraPermission(): Permission | undefined {
  if (Platform.OS === 'ios') return PERMISSIONS.IOS.CAMERA;
  if (Platform.OS === 'android') return PERMISSIONS.ANDROID.CAMERA;
  return undefined;
}

function mapPermissionStatus(status: PermissionStatus): RequestCameraPermissionState {
  switch (status) {
    case RESULTS.GRANTED:
    case RESULTS.LIMITED:
      return 'granted';
    case RESULTS.DENIED:
      return 'denied';
    case RESULTS.BLOCKED:
      return 'blocked';
    case RESULTS.UNAVAILABLE:
    default:
      return 'unavailable';
  }
}
