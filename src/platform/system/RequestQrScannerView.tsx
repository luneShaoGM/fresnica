import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Camera, CameraType } from 'react-native-camera-kit';

import type { RequestScannerViewProps } from '../../capabilities/request/RequestScannerViewPort';

export function ReactNativeRequestQrScannerView({ active, torchEnabled, onCode, onError }: RequestScannerViewProps) {
  if (!active) return null;

  return (
    <View style={styles.container}>
      <Camera
        allowedBarcodeTypes={['qr']}
        cameraType={CameraType.Back}
        onError={onError}
        onReadCode={event => onCode(event.nativeEvent.codeStringValue)}
        scanBarcode
        scanThrottleDelay={400}
        style={styles.camera}
        torchMode={torchEnabled ? 'on' : 'off'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  camera: { flex: 1 },
});
