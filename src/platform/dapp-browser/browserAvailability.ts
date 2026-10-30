import { Platform } from 'react-native';
import { hasAndroidNetworkGuard } from './androidNetworkGuard';

// The transport must also await proxy installation before mounting any WebView.
export function canMountDappWebView(): boolean {
  return Platform.OS === 'ios' || (Platform.OS === 'android' && hasAndroidNetworkGuard());
}
