import Clipboard from '@react-native-clipboard/clipboard';
import { check, openSettings, request, RESULTS } from 'react-native-permissions';

import { reactNativeRequestIngress } from '../requestIngress';

jest.mock('@react-native-clipboard/clipboard', () => ({
  __esModule: true,
  default: { getString: jest.fn() },
}));

jest.mock('react-native-permissions', () => ({
  check: jest.fn(),
  request: jest.fn(),
  openSettings: jest.fn(),
  RESULTS: {
    UNAVAILABLE: 'unavailable',
    DENIED: 'denied',
    BLOCKED: 'blocked',
    GRANTED: 'granted',
    LIMITED: 'limited',
  },
  PERMISSIONS: {
    IOS: { CAMERA: 'camera' },
    ANDROID: { CAMERA: 'camera' },
  },
}));

const checkMock = check as jest.MockedFunction<typeof check>;
const requestMock = request as jest.MockedFunction<typeof request>;
const openSettingsMock = openSettings as jest.MockedFunction<typeof openSettings>;
const clipboardGetString = Clipboard.getString as jest.MockedFunction<typeof Clipboard.getString>;

describe('reactNativeRequestIngress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads clipboard text only when the explicit port method is invoked', async () => {
    clipboardGetString.mockResolvedValue('web+stellar:pay?destination=GDESTINATION');
    expect(clipboardGetString).not.toHaveBeenCalled();
    await expect(reactNativeRequestIngress.readClipboardText()).resolves.toBe(
      'web+stellar:pay?destination=GDESTINATION',
    );
    expect(clipboardGetString).toHaveBeenCalledTimes(1);
  });

  it('maps permission statuses to stable Request camera states', async () => {
    for (const [status, expected] of [
      [RESULTS.GRANTED, 'granted'],
      [RESULTS.LIMITED, 'granted'],
      [RESULTS.DENIED, 'denied'],
      [RESULTS.BLOCKED, 'blocked'],
      [RESULTS.UNAVAILABLE, 'unavailable'],
    ] as const) {
      checkMock.mockResolvedValueOnce(status);
      await expect(reactNativeRequestIngress.checkCameraPermission()).resolves.toBe(expected);
    }
  });

  it('requests camera permission through the same stable mapping', async () => {
    requestMock.mockResolvedValue(RESULTS.BLOCKED);
    await expect(reactNativeRequestIngress.requestCameraPermission()).resolves.toBe('blocked');
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it('opens only application settings for permission recovery', async () => {
    openSettingsMock.mockResolvedValue(undefined);
    await reactNativeRequestIngress.openCameraSettings();
    expect(openSettingsMock).toHaveBeenCalledWith('application');
  });

  it('maps clipboard, permission, and settings failures to stable non-sensitive errors', async () => {
    clipboardGetString.mockRejectedValueOnce(new Error('clipboard-secret'));
    await expect(reactNativeRequestIngress.readClipboardText()).rejects.toThrow('request-clipboard-read-failed');

    checkMock.mockRejectedValueOnce(new Error('permission-detail'));
    await expect(reactNativeRequestIngress.checkCameraPermission()).rejects.toThrow('request-camera-permission-failed');

    openSettingsMock.mockRejectedValueOnce(new Error('settings-detail'));
    await expect(reactNativeRequestIngress.openCameraSettings()).rejects.toThrow('request-camera-settings-failed');
  });
});
