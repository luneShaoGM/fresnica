import React from 'react';
import { Camera } from 'react-native-camera-kit';

import { ReactNativeRequestQrScannerView } from '../RequestQrScannerView';

jest.mock('react-native-camera-kit', () => ({
  Camera: function CameraMock() {
    return null;
  },
  CameraType: { Back: 'back' },
}));

type CameraNodeProps = Readonly<{
  allowedBarcodeTypes?: readonly string[];
  cameraType?: string;
  scanBarcode?: boolean;
  scanThrottleDelay?: number;
  torchMode?: string;
  onReadCode?: (event: { nativeEvent: { codeStringValue: string } }) => void;
  onError?: () => void;
}>;

function findCamera(node: React.ReactNode): React.ReactElement<CameraNodeProps> | undefined {
  if (!React.isValidElement(node)) return undefined;
  if (node.type === Camera) return node as React.ReactElement<CameraNodeProps>;
  const props = node.props as Readonly<{ children?: React.ReactNode }>;
  let found: React.ReactElement<CameraNodeProps> | undefined;
  React.Children.forEach(props.children, child => {
    found ??= findCamera(child);
  });
  return found;
}

describe('ReactNativeRequestQrScannerView', () => {
  it('renders only QR scanning and forwards the raw value to the feature callback', () => {
    const onCode = jest.fn();
    const onError = jest.fn();
    const root = ReactNativeRequestQrScannerView({ active: true, torchEnabled: true, onCode, onError });
    const camera = findCamera(root);

    expect(camera?.props.allowedBarcodeTypes).toEqual(['qr']);
    expect(camera?.props.scanBarcode).toBe(true);
    expect(camera?.props.scanThrottleDelay).toBe(400);
    expect(camera?.props.torchMode).toBe('on');
    camera?.props.onReadCode?.({ nativeEvent: { codeStringValue: 'web+stellar:pay?destination=GDESTINATION' } });
    expect(onCode).toHaveBeenCalledWith('web+stellar:pay?destination=GDESTINATION');
    camera?.props.onError?.();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('does not mount the camera while the scanner is inactive', () => {
    expect(
      ReactNativeRequestQrScannerView({
        active: false,
        torchEnabled: false,
        onCode: jest.fn(),
        onError: jest.fn(),
      }),
    ).toBeNull();
  });
});
