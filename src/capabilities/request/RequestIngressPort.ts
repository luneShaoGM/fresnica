export type RequestCameraPermissionState = 'granted' | 'denied' | 'blocked' | 'unavailable';

export interface RequestIngressPort {
  readClipboardText(): Promise<string>;
  checkCameraPermission(): Promise<RequestCameraPermissionState>;
  requestCameraPermission(): Promise<RequestCameraPermissionState>;
  openCameraSettings(): Promise<void>;
}
