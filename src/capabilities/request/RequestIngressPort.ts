export type RequestCameraPermissionState = 'granted' | 'denied' | 'blocked' | 'unavailable';

export type RequestPhotoQrPick =
  | { readonly status: 'cancelled' }
  | { readonly status: 'empty' }
  | { readonly status: 'found'; readonly value: string };

export interface RequestIngressPort {
  readClipboardText(): Promise<string>;
  checkCameraPermission(): Promise<RequestCameraPermissionState>;
  requestCameraPermission(): Promise<RequestCameraPermissionState>;
  openCameraSettings(): Promise<void>;
  pickPaymentQrFromPhotos(): Promise<RequestPhotoQrPick>;
}
